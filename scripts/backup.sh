#!/usr/bin/env bash
# Create a consistent, verifiable backup of the database and the uploads folder.
#
# Usage: bash scripts/backup.sh
# Env:   BACKUP_DIR (default .data/backups), UPLOAD_DIR, KEEP_DAYS (default 14)
#
# The dump uses PostgreSQL custom format so it can be restored selectively.
# Both artefacts share one timestamp and are recorded in a sha256 manifest.
# No application downtime is required; pg_dump takes a consistent snapshot.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "error: .env not found. Copy .env.example and fill in the values." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in .env}"
BACKUP_DIR="${BACKUP_DIR:-.data/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-.data/uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"

read -r DB_USER DB_NAME <<<"$(
  node -e 'const u = new URL(process.argv[1]); console.log(u.username ? decodeURIComponent(u.username) : "kira", u.pathname.slice(1))' "$DATABASE_URL"
)"

COMPOSE_DB=(docker compose exec -T db)
stamp="$(date +%Y%m%d-%H%M%S)"
dump="$BACKUP_DIR/kira-rapi-$stamp.dump"
uploads="$BACKUP_DIR/kira-uploads-$stamp.tar.gz"
manifest="$BACKUP_DIR/kira-$stamp.sha256"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "==> Dumping database ${DB_NAME} as ${DB_USER}"
"${COMPOSE_DB[@]}" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --no-owner --no-privileges >"$dump"
chmod 600 "$dump"

if [[ ! -s "$dump" ]]; then
  echo "error: dump is empty. Is the Compose database running?" >&2
  exit 1
fi

# Prove the archive is readable before we rely on it.
if ! "${COMPOSE_DB[@]}" pg_restore --list >/dev/null <"$dump"; then
  echo "error: dump cannot be read back by pg_restore." >&2
  exit 1
fi

if [[ -d "$UPLOAD_DIR" ]]; then
  echo "==> Archiving uploads from ${UPLOAD_DIR}"
  tar -czf "$uploads" -C "$UPLOAD_DIR" .
  chmod 600 "$uploads"
else
  echo "warn: ${UPLOAD_DIR} not found; skipping attachments." >&2
fi

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$dump")" >"$manifest"
  [[ -f "$uploads" ]] && sha256sum "$(basename "$uploads")" >>"$manifest"
  chmod 600 "$manifest"
)

echo "==> Removing backups older than ${KEEP_DAYS} day(s)"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kira-*' -mtime +"$KEEP_DAYS" -print -delete

echo
echo "Backup complete:"
ls -lh "$dump"
[[ -f "$uploads" ]] && ls -lh "$uploads"
echo "Manifest: $manifest"
echo "Verify before relying on it: npm run restore:verify -- $dump"
