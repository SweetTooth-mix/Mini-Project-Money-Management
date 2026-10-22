# Kira Rapi Operations

## Development environment

Cloud directory: `/workspace/Mini-Project-Money-Management`.

```bash
npm run setup:local
npm run dev
```

Setup preserves an existing `.env` and the organisation data. PostgreSQL is stored in the Docker named volume `kira-data` under the Compose project. Never use `docker compose down -v` for a normal restart: that flag deletes the data volume.

Source files, the lockfile and scripts live in the repository. Dependencies, build output, `.env`, `.data` and Docker volumes are local state. The Next.js process and PostgreSQL must be restarted when a new machine is created. A filesystem snapshot alone does not prove that the Docker volume was also restored; `setup:local` can provision a fresh demo database if the volume is missing.

## Deployment to your own host

PM2 configuration ships in [`ecosystem.config.cjs`](../ecosystem.config.cjs). It uses its own checkout directory and binds Next.js to loopback for use behind a reverse proxy.

On a checkout of a new version with a complete production `.env`:

The template generator needs Python 3.10+ with a virtualenv, LibreOffice Calc and Liberation fonts on the host. See [Excel and PDF output](EXCEL-REPORTS.md) for installation and how the files link together.

```bash
npm ci
npm run setup:reports
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

To update the application, take a backup first, run the required migrations and build, then `pm2 restart kira-rapi --update-env`. PM2/nginx were not installed or configured on the original host by this task; review the example below against the real host and domain.

Example nginx block inside an existing HTTPS server configuration:

```nginx
client_max_body_size 6m;

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Use HTTPS and a matching `APP_URL` before building and starting. Keep the Host header so the Server Actions origin check works. Rate-limit login and registration requests at the reverse proxy for any publicly reachable deployment; the application also throttles attempts per email and per address.

Production deployment requires a **new database for this schema version**, `SEED_DEMO=false` and private initial users. Do not point it at a legacy database without a separate migration process. PostgreSQL does not need to be reachable from the Internet. Run the application process as a non-root user.

## Readiness

```bash
curl --fail --silent http://127.0.0.1:3000/api/health
curl --fail --silent --output /dev/null http://127.0.0.1:3000/login
```

`/api/health` returns the status of three checks:

| Check | Proves | On failure |
| --- | --- | --- |
| `database` | `SELECT 1` succeeds | `unavailable`, HTTP 503 |
| `uploads` | a probe file can be written and removed in `UPLOAD_DIR` | `unavailable`, HTTP 503 |
| `reports` | Python can import `openpyxl` and `soffice` is on the PATH | `degraded`, HTTP 200 |

Use HTTP 200 as the load-balancer readiness signal: a missing reporting toolchain still leaves the cash book, approvals and audit trail usable, so the instance should keep receiving traffic. Point alerting at the `degraded` payload instead. The reporting probe is cached for 60 seconds, so do not poll faster than that and expect a fresh answer.

For a functional check, sign in with a test account, open the dashboard and cash book, and exercise a document in a test database. An open PID or port alone does not prove the application works.

## Backup and recovery

Include three components: a PostgreSQL dump, the `UPLOAD_DIR` directory and the private deployment configuration. Keep backups outside the checkout and protect access to them.

Scheduled backup (dump + uploads + SHA-256 manifest, 14-day retention):

```bash
npm run backup                        # write to .data/backups
KEEP_DAYS=30 npm run backup           # different retention
BACKUP_DIR=/mnt/backup npm run backup # keep outside the checkout
```

It names files by timestamp (`kira-rapi-YYYYMMDD-HHMMSS.dump`), verifies the dump can be read back by `pg_restore`, and archives `UPLOAD_DIR` at the same time so attachments and the database stay aligned. Schedule it with cron, for example `15 2 * * * cd /srv/kira-rapi && npm run backup`.

If PostgreSQL is not running under Compose, call `pg_dump`/`pg_restore` directly against `DATABASE_URL` using the same format, and copy `UPLOAD_DIR` inside the same window. Never commit backups to Git.

**Test the restore, do not assume it.** The verification script restores the dump into a throwaway database (the name must end with `_test`), then compares row counts, ledger totals, per-account balances and uploads checksums against the source:

```bash
npm run restore:verify                # newest dump
npm run restore:verify -- .data/backups/kira-rapi-20261020-021500.dump --keep
```

A `PASS` result means the backup is genuinely restorable and consistent. Run it during a quiet period, because documents posted while the backup runs can legitimately make the comparison fail. The restored database is dropped after the check unless `--keep` is passed; on failure it is kept for investigation.

Restoring onto a new production host still has to be performed manually once, before the day you need it.

### Scheduled maintenance

Expired sessions and login-attempt counters are pruned automatically once an hour after a successful sign-in. For rarely used installations, schedule the cleanup in cron:

```bash
30 3 * * * cd /srv/kira-rapi && npm run cleanup
```

## Logging and monitoring

**Log format.** Every server log line is a single JSON object on stdout:

```json
{"time":"2026-10-22T07:12:04.512Z","level":"error","message":"report.generate_failed","service":"kira-rapi","requestId":"8f1c…","report":"monthly","format":"zip","year":2026,"errName":"Error"}
```

| Variable | Purpose |
| --- | --- |
| `LOG_LEVEL` | `debug`, `info` (default), `warn` or `error` |
| `SERVICE_NAME` | Label on every line, default `kira-rapi` |
| `ERROR_WEBHOOK_URL` | Optional JSON POST target for error records |

Values under keys matching `pass`, `secret`, `token`, `cookie`, `session`, `key`, `dsn` or `database_url` are replaced with `[redacted]`, and long strings are truncated. Reset failures record an error name only, because worker stderr can contain record values or local paths.

**Request correlation.** Every API request gets an `x-request-id` and the ID is returned in the response header. Ask the user for that ID when they report a problem, then search the logs. Pass it from nginx so one trace spans both hops:

```nginx
proxy_set_header X-Request-Id $request_id;
```

**Collecting the logs.** With PM2, `pm2 logs` already shows the JSON lines; to keep them, use `pm2 install pm2-logrotate` or run under systemd/journald and read them with `journalctl -u kira-rapi -o cat`. Ship them to Loki, OpenSearch or any collector that ingests JSON lines. Nothing in the application rotates log files itself.

**Alerting.** Forward errors by pointing `ERROR_WEBHOOK_URL` at a collector, chat webhook or error tracker. Delivery is fire-and-forget with a two-second timeout and never blocks a request. Suggested alerts: any `level=error` line, `/api/health` returning `unavailable`, and `/api/health` reporting `reports: degraded` for more than an hour after a deployment.

## Access control and login throttling

Limits are counted on three layers, and **only failed attempts** are counted:

| Layer | Limit | Purpose |
| --- | --- | --- |
| Address + email | 8 failures / 15 minutes | Stop password guessing against one account |
| Address | 25 failures / 15 minutes | Stop one host trying many accounts |
| Email | 30 failures / 15 minutes | Stop a distributed attack from many addresses |

This design prevents **account lockout as a weapon**: an attacker needs 30 failures before a real user is blocked, and a successful sign-in clears the address+email and email counters. The per-address counter survives a successful sign-in so a valid account cannot be used to reset an attacker's budget. Public registration is limited to 5 requests per 15 minutes per address and per email.

The client address is read from `X-Forwarded-For` (left-most entry) or `X-Real-IP`, and only valid addresses are accepted. If the application is exposed **without** a proxy, set `TRUST_PROXY_HEADERS=false`; otherwise a client can forge the header and bypass the per-address limit. Example nginx directive: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.

No email address or IP is stored in plain text: the throttle key is the SHA-256 of the kind, address and email combined.

## Audit trail

The Audit page supports filtering by user, action code, date range and free-text search over details, user names or action codes. The date range uses **Malaysia time (GMT+8)**, and a reversed range is swapped automatically.

The **Export log CSV** button downloads up to 50,000 rows using the same filters. CSV content comes from an append-only log; text fields are made safe against spreadsheet formulas. The audit log cannot be edited or deleted by the application, so these filters are read-only.

## Operating rules

- For a draft mistake, use **Edit draft**. Once submitted, financial details are frozen.
- For a payment mistake, use **Void document** with a reason and reversal date; the original entry is retained.
- When closing a month, reconcile the totals against the bank/cash statement before locking the period.
- If a due is wrong, void the related receipt first; the due record reopens as unpaid.
- Disabling a user and changing a password revoke the related sessions.
- Attachments are capped at 5 MB with PDF/PNG/JPEG magic-byte checks. Files are downloaded through a route that requires sign-in. Antivirus scanning is not provided.
- CSV export protects text fields against spreadsheet formulas.
- The audit log and ledger carry PostgreSQL triggers that reject application UPDATE/DELETE. Database administrators still hold administrative power over the database.

## Development verification

Verified on **12 October 2026 (Asia/Kuala_Lumpur)**:

| Check | Result |
| --- | --- |
| Production build and TypeScript | Pass |
| Unit tests | 8 passing |
| PostgreSQL integration tests | 10 passing |
| Excel output tests | 8 passing: 12-month balances, linked formulas, original formatting, dynamic rows, empty months and PDF |
| Chromium browser scenarios | 8 passing, covering desktop/mobile, day/night themes, menu focus, attachments, approval, access revocation and Excel/PDF downloads |
| UI visual review | Desktop and phone in both themes; no page overflow at the tested sizes |
| npm dependency audit | 0 vulnerabilities reported |
| Sample summary print | Original fixture 1 A4 page; fixture with an extra adjustment 2 pages. Printing from night mode stays white; sidebar and application controls are hidden |

Unit and integration tests live in `tests/`; browser scenarios live in `tests/e2e/app.spec.ts` and `tests/e2e/design.spec.ts`. Tests use separate databases. Run `npm run build` before `npm run test:e2e` so the browser exercises the current code.

The UI redesign was verified with a production build and eight browser scenarios. Excel template files, the report generator, financial logic and the schema were compared with SHA-256 and remained identical to the pre-redesign version. A contrast review of selected text on the dashboard, cash book, receipts/vouchers, Excel reports and settings found no threshold failures in either theme; this is not a full accessibility audit.

Additional bilingual UI review on **13 October 2026 (Asia/Kuala_Lumpur)**:

- Production build, TypeScript and **11 unit tests** passed.
- **12 browser scenarios** passed, covering server-side language without JavaScript, cookies across reloads and sign-in, module navigation, filters, form input and phone layout.
- Downloads from the Malay and English UI produced four workbooks with identical content XML, formulas, styles and links. The comparison excluded generation-time metadata, including its copy inside the external-link cache. `BACA DAHULU.txt` was identical too.
- PDF text from the English UI and the print previews for receipts, vouchers and summaries stayed in Malay. The language control is hidden when printing.
- SHA-256 for `lib/excel.ts`, `scripts/excel/*` and `templates/excel/*` matched the pre-bilingual version. No schema or migration changes.

Language scenarios live in `tests/e2e/i18n.spec.ts`; English screenshots are in `docs/screenshots/`. Use an HTTPS `APP_URL` in production so the language cookie receives the `Secure` attribute.

Verified on **22 October 2026 (Asia/Kuala_Lumpur)** for layered login throttling and the filterable audit trail:

| Check | Result |
| --- | --- |
| GitHub Actions (`quality`) | Pass: typecheck, ESLint, Prettier, unit tests, `npm audit --omit=dev --audit-level=high`, production build |
| GitHub Actions (`integration`) | Pass: PostgreSQL 16, 15 integration tests including concurrent throttle counting and health probes |
| Unit tests | 35 passing (9 audit filters, 7 throttling/client address, 8 logging/health, 11 existing) |
| PostgreSQL integration tests | 15 passing: 3 for throttling and audit filtering, 2 for health probes |
| Prettier and ESLint | 0 errors, 0 warnings across `app/`, `lib/`, `components/` and `tests/` |

Screenshots and PDFs in `.data/screenshots` use fictitious data. README screenshots are copied from verified browser runs.

The `deepmerge-ts@8.0.2` override in `package.json` fixes advisory GHSA-ggr8-5vv4-36mx in a Prisma configuration dependency. The Prisma CLI, migrations, build and tests were used to confirm compatibility.
