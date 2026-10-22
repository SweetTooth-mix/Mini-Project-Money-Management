#!/usr/bin/env bash
# Restore a backup into a throw-away database and prove it matches the source.
#
# Usage: bash scripts/restore-verify.sh [dump-file] [--keep]
#        (no argument = newest dump in BACKUP_DIR)
#
# Checks performed:
#   1. pg_restore completes without errors
#   2. row counts match for the financial tables
#   3. ledger totals and per-account balances match exactly
#   4. every attachment row has a matching file inside the uploads archive
#   5. the uploads archive extracts with identical checksums
#
# The source database is never modified. Run during a quiet period: a backup
# taken while documents are being posted can legitimately differ from the
# source by a few rows.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "error: .env not found." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in .env}"
BACKUP_DIR="${BACKUP_DIR:-.data/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-.data/uploads}"

keep=0
dump=""
for arg in "$@"; do
  case "$arg" in
    --keep) keep=1 ;;
    *) dump="$arg" ;;
  esac
done

if [[ -z "$dump" ]]; then
  dump="$(find "$BACKUP_DIR" -maxdepth 1 -name 'kira-rapi-*.dump' -printf '%T@ %p\n' 2>/dev/null |
    sort -n | tail -1 | cut -d' ' -f2-)"
  if [[ -z "$dump" ]]; then
    echo "error: no dump found in ${BACKUP_DIR}. Pass a file path." >&2
    exit 1
  fi
fi
if [[ ! -s "$dump" ]]; then
  echo "error: $dump is missing or empty." >&2
  exit 1
fi

stamp="$(basename "$dump" .dump | sed 's/^kira-rapi-//')"
uploads="${BACKUP_DIR}/kira-uploads-${stamp}.tar.gz"

read -r DB_USER DB_NAME <<<"$(
  node -e 'const u = new URL(process.argv[1]); console.log(u.username ? decodeURIComponent(u.username) : "kira", u.pathname.slice(1))' "$DATABASE_URL"
)"

RESTORE_DB="${RESTORE_DB:-kira_rapi_restore_test}"
if [[ "$RESTORE_DB" != *_test ]]; then
  echo "error: RESTORE_DB must end in _test to avoid touching real data." >&2
  exit 1
fi

psql_db() {
  local db="$1" sql="$2"
  docker compose exec -T db psql -U "$DB_USER" -d "$db" -tAq -v ON_ERROR_STOP=1 -c "$sql"
}

cleanup() {
  if [[ "$keep" -eq 0 ]]; then
    docker compose exec -T db dropdb -U "$DB_USER" --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
  fi
  [[ -n "${upload_check_dir:-}" ]] && rm -rf "$upload_check_dir"
}
trap cleanup EXIT

failures=0
fail() {
  echo "  FAIL: $*" >&2
  failures=$((failures + 1))
}

echo "==> Recreating ${RESTORE_DB}"
docker compose exec -T db dropdb -U "$DB_USER" --if-exists "$RESTORE_DB" >/dev/null
docker compose exec -T db createdb -U "$DB_USER" "$RESTORE_DB"

echo "==> Restoring $(basename "$dump")"
if ! docker compose exec -T db pg_restore -U "$DB_USER" -d "$RESTORE_DB" \
  --no-owner --no-privileges --exit-on-error <"$dump"; then
  echo "error: pg_restore failed." >&2
  exit 1
fi

echo "==> Comparing row counts"
for table in Document LedgerEntry Account Fund User Due Attachment AuditLog; do
  expected="$(psql_db "$DB_NAME" "SELECT count(*) FROM \"$table\"")"
  actual="$(psql_db "$RESTORE_DB" "SELECT count(*) FROM \"$table\"")"
  if [[ "$expected" == "$actual" ]]; then
    printf '  ok   %-12s %s\n' "$table" "$expected"
  else
    fail "$table: source=$expected restored=$actual"
  fi
done

echo "==> Comparing ledger totals"
total_sql='SELECT COALESCE(sum("amountSen"),0) FROM "LedgerEntry"'
expected="$(psql_db "$DB_NAME" "$total_sql")"
actual="$(psql_db "$RESTORE_DB" "$total_sql")"
[[ "$expected" == "$actual" ]] &&
  printf '  ok   ledger total %s sen\n' "$expected" ||
  fail "ledger total: source=$expected restored=$actual"

balance_sql='SELECT "accountId" || ":" || COALESCE(sum("amountSen"),0) FROM "LedgerEntry" GROUP BY "accountId" ORDER BY "accountId"'
expected="$(psql_db "$DB_NAME" "$balance_sql")"
actual="$(psql_db "$RESTORE_DB" "$balance_sql")"
[[ "$expected" == "$actual" ]] &&
  echo "  ok   per-account balances" ||
  fail "per-account balances differ"

echo "==> Comparing uploads"
if [[ -f "$uploads" ]]; then
  upload_check_dir="$(mktemp -d)"
  tar -xzf "$uploads" -C "$upload_check_dir"
  if [[ -d "$UPLOAD_DIR" ]]; then
    expected="$(cd "$UPLOAD_DIR" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum | sha256sum)"
    actual="$(cd "$upload_check_dir" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum | sha256sum)"
    [[ "$expected" == "$actual" ]] &&
      echo "  ok   uploads checksum matches" ||
      fail "uploads checksum differs from ${UPLOAD_DIR}"
  else
    echo "  warn ${UPLOAD_DIR} not present; checksums skipped"
  fi

  # Every attachment referenced by the restored database must exist on disk.
  missing=0
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if [[ ! -f "$upload_check_dir/$name" ]]; then
      fail "attachment file missing from archive: $name"
      missing=$((missing + 1))
      [[ "$missing" -ge 10 ]] && { echo "  ... more missing files suppressed" >&2; break; }
    fi
  done < <(psql_db "$RESTORE_DB" 'SELECT "storedName" FROM "Attachment" ORDER BY "storedName"')
  [[ "$missing" -eq 0 ]] && echo "  ok   every attachment row has a file"
else
  echo "  warn no uploads archive for stamp ${stamp}; checksums skipped"
fi

echo
if [[ "$failures" -eq 0 ]]; then
  echo "RESULT: PASS — backup is restorable and consistent with ${DB_NAME}."
  [[ "$keep" -eq 1 ]] && echo "Restored database ${RESTORE_DB} kept for inspection."
else
  echo "RESULT: FAIL — ${failures} check(s) failed." >&2
  keep=1 # preserve the restored DB for investigation
  trap - EXIT
  [[ -n "${upload_check_dir:-}" ]] && rm -rf "$upload_check_dir"
  exit 1
fi
