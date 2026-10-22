# Kira Rapi

**Community finance, kept in order.**

A community finance management application with a Malay and English UI: cash book, accounts and funds, receipts and vouchers, member dues, monthly summaries and an audit trail. Excel/PDF output stays in Malay. One installation serves one organisation.

[![CI](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](package.json)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue)](compose.yaml)
[![Next.js](https://img.shields.io/badge/next.js-16.4.0-black)](package.json)

![Kira Rapi dashboard with demo data](docs/screenshots/dashboard.png)

> **Documentation language.** All documentation in this repository is in English.
> The product itself ships a bilingual Malay/English UI, keeps printable documents
> and Excel/PDF output in Malay, and its test fixtures and seed data use Malay
> strings.

## Contents

- [Modules](#modules)
- [Security and access control](#security-and-access-control)
- [Financial correctness](#financial-correctness)
- [Language and interface](#language-and-interface)
- [Stack and architecture](#stack-and-architecture)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Roles](#roles)
- [Tests and CI](#tests-and-ci)
- [Observability](#observability)
- [Operations](#operations)
- [Production deployment](#production-deployment)
- [Documentation](#documentation)
- [Current limitations and roadmap](#current-limitations-and-roadmap)

## Modules

| Module | Capability |
| --- | --- |
| Dashboard | Balances, receipts, expenses, outstanding dues, six-month chart and documents awaiting review |
| Cash book | Sequential ledger, running balance, search across details/reference/category, 50 transactions per page, month/account/fund filters, internal transfers and CSV export |
| Receipts & vouchers | Create and edit drafts, attach PDF/PNG/JPEG, approve, record payment, void and print at A4 |
| Member dues | Register members, monthly rates, generate dues without duplicates and collect through receipts |
| Accounts & funds | Bank/cash/other accounts, opening balances and custom funds |
| Summaries | Category breakdown, opening and closing balances, adjustment detail and print/save PDF via the browser |
| Excel reports | Four linked workbooks following the original templates, a 12-month report, funds account, dues summary and A4 PDF |
| Settings | Organisation profile, signatories, users, access requests, passwords and financial period lock |
| Audit | Action records with user, timestamp and change details; filter by user, action and date range (Malaysia time) plus free-text search, and export to CSV |

**Cash book.** Search is case-insensitive. Running balances and monthly totals cover every transaction in the selected month, account and fund, including rows that do not appear in the current search results or page. Previous/Next links preserve the filters; a new search starts at page one. CSV export and summary reports always use the full transaction set for the selected month, account and fund.

**Audit trail.** Filter by user, action code, date range (Malaysia time; a reversed range is swapped automatically) and free-text search over details, user names or action codes. **Export log CSV** applies the same filters, is capped at 50,000 rows, and runs every cell through `csvCell` so spreadsheet formulas cannot execute. The audit log is read-only because database triggers reject UPDATE/DELETE.

## Security and access control

| Control | Implementation |
| --- | --- |
| Authentication | 256-bit random session token, SHA-256 hash at rest, `HttpOnly`/`SameSite=Lax`/`Secure` cookie (when `APP_URL` is HTTPS), 8-hour expiry |
| Session revocation | Sessions are deleted when an account is disabled or a password changes |
| Login throttling | Three layers (see below); only failed attempts count; keys stored as hashes |
| Report throttling | 10 report generations per 15 minutes per user, because each render starts Python and LibreOffice |
| Authorisation | Roles are re-checked server-side for every financial action; hiding a button is not an access control. The audit trail and its CSV export require a manager role |
| Separation of duties | A preparer cannot approve their own document, including a Super Admin |
| Record integrity | PostgreSQL triggers reject UPDATE/DELETE on `LedgerEntry` and `AuditLog`, and freeze document values once submitted |
| Attachments | 5 MB limit, PDF/PNG/JPEG magic-byte validation, UUID storage name, login required to download, `Content-Security-Policy: sandbox` |
| Response headers | CSP without external script allowances, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS when HTTPS |
| CSV | Text fields are defused against spreadsheet formula injection (`csvCell`) |
| Registration | Public sign-up creates a `PENDING` account; only a Super Admin can activate it |

### Login throttling

Limits apply on three layers, and **only failed attempts** are counted:

| Bucket | Limit | Purpose |
| --- | --- | --- |
| Address + email | 8 failures / 15 min | Stop password guessing against one account |
| Address | 25 failures / 15 min | Stop a single host walking through many accounts |
| Email | 30 failures / 15 min | Stop a distributed attack from many addresses |

The layered design prevents **account lockout as a weapon**: a real user is only blocked after 30 failures, and a successful sign-in clears the account buckets. The per-address total survives a successful sign-in, so a valid account cannot be used to reset an attacker's budget. Public registration is limited to 5 requests per 15 minutes per address and per email.

The client address is read from `X-Forwarded-For` (left-most entry) or `X-Real-IP`, and only syntactically valid addresses are accepted. Trust is **opt-in**: set `TRUST_PROXY_HEADERS=true` behind a proxy you control. Left unset, the headers are ignored, so a client cannot choose its own bucket by forging them; the server warns at startup when trust and `APP_URL` disagree. No email address or IP is stored in plain text.

Production also refuses to start when `APP_URL` is not `https://`, because the session cookie would otherwise lose its `Secure` flag and HSTS would be omitted. Loopback URLs are accepted for local containers, and `ALLOW_INSECURE_HTTP=true` is the explicit exception for a throwaway environment.

## Financial correctness

- Money is stored as **integer sen (`BIGINT`)** and computed with `bigint`, never floating point.
- Balances are derived from the ledger; there is no separate account balance field to reconcile.
- Opening balances are posted as opening entries with an explicit account and fund.
- Drafts do not affect balances. The normal flow is **DRAFT → PENDING → APPROVED → PAID**.
- A preparer cannot approve their own document, including a Super Admin. Provide at least two users for the approval flow.
- Payment posting, dues updates, document status and audit all happen inside one database transaction.
- Unique constraints and transaction locking prevent duplicate payment postings, including concurrent requests.
- A voided payment produces a reversing entry. Original entries and audit records cannot be changed or deleted by normal application operations.
- Transfers record two balanced entries and are never counted as income or expense.
- Reports read a consistent snapshot of database transactions. The identity is **opening + receipts − expenses ± adjustments = closing**.
- Dues are marked paid only when the receipt completes; a void reopens them.
- Organisation details are frozen onto a document at approval, so later profile edits never change historic printouts.

Reversals are reported as adjustments on the reversal date. Negative balances are permitted so the ledger can represent the real record; reconcile bank and cash records periodically.

## Language and interface

The primary language is **Malay (`ms`)**. A **BM / EN** control next to the theme toggle switches menus, labels, forms and UI messages. The choice is stored for one year in the `kira-rapi-lang` cookie (`Path=/`, `SameSite=Lax`, `HttpOnly`; `Secure` when `APP_URL` is HTTPS). Server Components read the cookie before rendering, so the language survives reloads, navigation and sign-in. A missing or invalid cookie falls back to Malay.

The dictionary lives under [`lib/i18n/messages/`](lib/i18n/messages) as `{ ms, en }` pairs with named placeholders, grouped by screen area (documents, cashbook, reports, audit, auth, settings, common). [`lib/i18n.ts`](lib/i18n.ts) merges the groups and re-exports the helpers, so call sites import from one place. `LanguageToggle` uses a Server Action to set the cookie. The day/night theme uses a separate preference.

**Report language does not change with the UI.** The four Excel workbooks, PDFs and print previews for receipts, vouchers and summaries stay in Malay. Organisation names, funds, categories, transactions and audit records are source data and are never machine-translated. `lib/excel.ts`, `scripts/excel/*` and `templates/excel/*` are untouched by the bilingual feature.

The corporate UI supports desktop and mobile with **day and night themes**. The theme is stored in the browser and follows the device setting until a choice is made. Print output stays white. The mobile menu supports the keyboard and the Escape key, and fonts ship with the application, so no third-party font requests are made.

Previews: [day](docs/screenshots/dashboard.png) · [night](docs/screenshots/dashboard-night.png) · [mobile](docs/screenshots/dashboard-mobile.png) · [English](docs/screenshots/dashboard-en-day.png). Full guide: [UI/UX](docs/UI-UX.md).

## Stack and architecture

| Layer | Technology |
| --- | --- |
| Interface | Next.js **16.4.0** (App Router), React **19.3.0**, TypeScript, responsive CSS, Lucide |
| Server | Server Components, Server Actions, Route Handlers (`/api/*`) |
| Data | PostgreSQL **16**, Prisma **6.19.3**, SQL migrations with integrity triggers |
| Validation | Zod at form and URL-parameter boundaries |
| Passwords | bcryptjs (cost 12) |
| Reporting | Python 3 + openpyxl, LibreOffice for PDF |
| Deployment | PM2 behind nginx, or the provided multi-stage `Dockerfile` |

The application uses a single global Prisma Client, reads through `lib/queries.ts` and writes through `lib/finance.ts`. Every financial write takes a row lock on the organisation (`SELECT ... FOR UPDATE`) inside one transaction, which serialises payment posting, period closing and audit updates. Money never passes through `float`; `lib/money.ts` owns all conversion and formatting.

Pure logic (money parsing, ledger maths, throttle policy, audit filters, query-string parsing) is kept in modules that never import the Prisma Client. That is what lets the unit suite run with only Node installed, and it is why the throttle and audit tests need no database.

## Repository layout

```text
app/                      Pages, Server Actions and route handlers
  dashboard/              Nine UI modules
  api/                    attachments, audit/export, export, health, me, reports
components/               Responsive UI, forms, navigation and document views
lib/
  finance.ts              Document state, posting, reversals, DB transactions
  money.ts                Integer sen, RM formatting, dates, Malay amount words
  ledger.ts               Report maths and CSV safety
  queries.ts              Ledger reads, balances and paging
  audit.ts                Audit trail data access
  audit-filters.ts        Audit filter normalisation (pure, testable)
  throttle.ts             Atomic throttle counters
  throttle-policy.ts      Throttle limits and buckets (pure, testable)
  request-ip.ts           Client address resolution behind a proxy
  maintenance.ts          Expired session and counter cleanup
  auth.ts                 Revocable sessions
  uploads.ts              Attachment validation and storage
  search.ts               Query-string helpers with no DB dependency
prisma/                   Schema, migrations, integrity constraints and seed
scripts/                  Setup, backup, restore-verify and test runners
tests/                    Unit, PostgreSQL integration and browser suites
docs/                     Operations, UI/UX, Excel reports and legacy context
```

## Local development

Prerequisites: **Node.js 22+**, npm, Docker with Compose v2, **Python 3.10+ with venv** and **LibreOffice Calc** for Excel/PDF output. Development and testing have run on Node.js 22 and 24. See [Excel report setup](docs/EXCEL-REPORTS.md).

```bash
git clone https://github.com/SweetTooth-mix/Mini-Project-Money-Management.git
cd Mini-Project-Money-Management
npm run setup:local
npm run dev
```

`setup:local` will:

1. Generate a private `.env` if one does not exist, with random database credentials and two demo users.
2. Start PostgreSQL through Compose on local port **5434**.
3. Install dependencies with `npm ci`, generate the Prisma Client, run migrations and seed.
4. Create the Python virtualenv and check LibreOffice for report generation.

The application listens on port **3000** on `0.0.0.0`. `GET /api/health` checks the database connection and returns `503` when it is unavailable.

Setup is idempotent: an existing `.env` is kept, applied migrations are not re-run, and the seed never rewrites an existing organisation or password. If setup fails, read the error before retrying; do not delete the database volume to fix a dependency problem.

### Demo sign-in

Passwords live in the local `.env` generated by setup, not in the repository or documentation.

| Account | Email | Password variable |
| --- | --- | --- |
| Super Admin | Value of `SEED_ADMIN_EMAIL` (default `admin@kira-rapi.local`) | `SEED_ADMIN_PASSWORD` |
| Reviewer | `penyemak@kira-rapi.local` | `SEED_REVIEWER_PASSWORD` |

The demo seed contains fictitious organisations, names, transactions and balances. Use the reviewer account to approve documents prepared by the Super Admin, or vice versa. Changing seed values in `.env` does not change existing passwords; use the Settings page.

## Environment variables

See [`.env.example`](.env.example). Never commit `.env`, database dumps or uploads.

| Name | Required | Purpose |
| --- | :---: | --- |
| `DATABASE_URL` | ✓ | Application PostgreSQL connection |
| `APP_URL` | ✓ | Application origin; HTTPS enables `Secure` cookies and HSTS. Production refuses `http://` except loopback |
| `POSTGRES_PASSWORD` | ✓¹ | Local PostgreSQL container password |
| `UPLOAD_DIR` | — | Persistent attachment directory, default `.data/uploads` |
| `TRUST_PROXY_HEADERS` | — | Default `false`. Set `true` only behind a proxy that sets `X-Forwarded-For` |
| `SEED_ADMIN_EMAIL` | ✓² | Initial Super Admin email |
| `SEED_ADMIN_PASSWORD` | ✓² | Initial password, minimum 12 characters |
| `SEED_DEMO` | — | `true` for demo data; `false` for a new organisation |
| `SEED_REVIEWER_PASSWORD` | — | Required when `SEED_DEMO=true` |
| `DEV_PREVIEW_ORIGINS` | — | Development only: extra hosts for the dev server and preview iframes |
| `ALLOW_INSECURE_HTTP` | — | `true` lets production start on plain HTTP. Throwaway environments only |
| `TEST_DATABASE_URL` | — | External test database; the name must end with `_test` |
| `EXCEL_PYTHON` | — | Python interpreter path, default `.venv/bin/python` |
| `LOG_LEVEL` | — | `debug`, `info`, `warn` or `error`; default `info` |
| `SERVICE_NAME` | — | Label attached to every log line, default `kira-rapi` |
| `ERROR_WEBHOOK_URL` | — | Optional JSON POST target for error records; delivery failures are ignored |
| `APPROVAL_TELEGRAM_TOKEN` | — | Telegram bot token for approval notifications |
| `APPROVAL_TELEGRAM_CHAT_ID` | — | Chat or group that receives the notification |
| `APPROVAL_WEBHOOK_URL` | — | JSON POST target for approvals, for Slack-style hooks |
| `SMTP_URL` | — | SMTP connection URL for approval email, e.g. `smtps://user:pass@host:465` |
| `MAIL_FROM` | — | Sender shown on approval email |
| `APPROVAL_EMAIL_TO` | — | Reviewer address for approval email; all three SMTP values are needed |
| `METRICS_TOKEN` | — | Enables `/api/metrics`; without it the endpoint returns 404 |
| `METRICS_ENABLED` | — | `false` disables request timing entirely; default on |

¹ Only needed when PostgreSQL runs through Compose. ² Needed for the first seed run.

To use your own PostgreSQL, provide `.env`, then run `npm ci`, `npm run setup:reports` and `npm run db:setup`; Docker is not required.

## Roles

| Action | USER | ADMIN | SUPER_ADMIN |
| --- | :---: | :---: | :---: |
| View the dashboard, ledger, documents, dues, reports and organisation audit | ✓ | ✓ | ✓ |
| Create and edit own drafts and upload attachments | ✓ | ✓ | ✓ |
| Approve or reject other users' documents | — | ✓ | ✓ |
| Record payments, voids and transfers | — | ✓ | ✓ |
| Add accounts/funds, register members and generate dues | — | ✓ | ✓ |
| Manage users, profile and locked periods | — | — | ✓ |
| Change own password | ✓ | ✓ | ✓ |

Public registration creates a `PENDING` USER. Only a Super Admin can activate it.

## Tests and CI

| Suite | Command | Count | Requirements |
| --- | --- | :---: | --- |
| Unit | `npm test` | 61 tests | Node only |
| Integration | `npm run test:integration` | 15 tests | PostgreSQL |
| Excel/PDF reports | `npm run test:reports` | 9 tests | Python + LibreOffice |
| Browser and accessibility | `npm run test:e2e` | 16 scenarios, 3 of them axe audits over 13 screens | Current build + Chromium |

```bash
npm run test               # money, dates, ledger, CSV, i18n, throttling, audit filters, logging/health
npm run test:integration   # concurrent posting, approval, reversal, dues, period lock, throttling
npm run test:reports       # Excel templates, formula links, 12-month balances and PDF
npm run test:e2e           # Chromium: documents, Excel/PDF, theme, language, mobile and axe audits
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint: Next core-web-vitals + TypeScript
npm run format:check       # Prettier
npm run build              # Production build and type checking
npm audit                  # Dependency audit
```

**CI.** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and every push to `main`:

1. `quality` — `prisma generate`, `typecheck`, ESLint, Prettier, unit tests, `npm audit --omit=dev --audit-level=high` and a production build.
2. `integration` — PostgreSQL 16 as a service, a `kira_rapi_test` database, `prisma migrate deploy` and the 15 integration tests.
3. `reports` — installs LibreOffice Calc and the Python virtualenv, then runs the 9 report tests against real generated workbooks, including the PDF conversion and the LibreOffice recalculation check.
4. `accessibility` — production build, Chromium, then the Playwright suite against the isolated `kira_rapi_e2e_test` database, including the axe audits. The two scenarios that download generated Excel/PDF files are skipped there (`E2E_SKIP_REPORTS=true`) because the job has no LibreOffice or Python virtualenv; the `reports` job runs those files through the generator instead. Failure screenshots are uploaded as an artefact.
5. `container` — builds the runtime and migration images, applies migrations, seeds a demo organisation, starts the container and waits for its own `HEALTHCHECK` to report healthy. It then asserts that `/api/health` reports the reporting toolchain as `ok`, which proves LibreOffice and the Python virtualenv work inside the image.

Integration and browser failures are surfaced as check-run annotations, so the cause is readable without downloading job logs. Every suite now runs on each pull request; nothing is manual-only.

`test:integration` provisions `kira_rapi_test` on the local Compose PostgreSQL and cleans fixture data inside that database; the database name must end with `_test` or the suite refuses to run. `test:e2e` **resets the dedicated `kira_rapi_e2e_test` database**, creates fixtures and runs the production build on port 3100, so it needs a current build. It provisions that database through `docker compose` locally and lets Prisma create it in CI (`E2E_SKIP_COMPOSE_DB=true`). The application database `kira_rapi` is never reset by tests; screenshots and PDFs land in `.data/screenshots`.

## Metrics

`/api/metrics` exposes Prometheus text metrics for scraping. It is off unless `METRICS_TOKEN` is set, and then requires it as a bearer credential — traffic patterns are not public information.

| Metric | Type | Meaning |
| --- | --- | --- |
| `kira_http_requests_total` | counter | Completed requests by `method`, `route` and `status` class (`2xx` … `5xx`) |
| `kira_http_request_duration_seconds` | histogram | Latency from request start to response finish |
| `kira_request_errors_total` | counter | Unhandled errors reported by `onRequestError`, by route |
| `kira_metrics_dropped_series_total` | counter | Requests ignored after the 200-series limit was reached |
| `kira_process_uptime_seconds` | gauge | Seconds since the process began collecting |

```bash
METRICS_TOKEN=... # long random value, see .env.example
curl -s -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:3000/api/metrics | head
```

Routes are labelled by shape, not identity: `/dashboard/baucer-resit/cma1b2c3…` becomes `/dashboard/baucer-resit/:id`, query strings are dropped, and each label is capped at 200 time series with the overflow counted in `kira_metrics_dropped_series_total`. Static assets under `/_next/` are not recorded.

Timing covers the whole server, not just the API routes: Next.js has no "request finished" hook, so the Node HTTP server is instrumented once from `instrumentation.ts`. That patch is idempotent, guarded by `try/catch`, and can be switched off with `METRICS_ENABLED=false`. Counters live in memory and reset when the process restarts — this is a scrape target, not a time-series database.

## Accessibility

`tests/e2e/a11y.spec.ts` runs [axe-core](https://github.com/dequelabs/axe-core) over the login and register pages in both themes, all nine dashboard screens, and the sign-in failure state — 13 audits in three scenarios. It fails on `serious` and `critical` findings across the WCAG 2.0/2.1 A and AA rule sets; lower-impact findings are reported by axe but do not break the build, because several of them are deliberate design choices in this app.

The audit is part of `npm run test:e2e` and runs in CI on every pull request. It complements, and does not replace, manual keyboard and screen-reader checks: automated tooling finds a minority of real accessibility problems.

## Approval notifications

When a document is submitted for approval, reviewers can be notified without any mail server: the app posts one JSON request to whichever channels are configured.

| Channel | Variables |
| --- | --- |
| Telegram | `APPROVAL_TELEGRAM_TOKEN`, `APPROVAL_TELEGRAM_CHAT_ID` |
| Webhook (Slack, Mattermost, custom) | `APPROVAL_WEBHOOK_URL` |
| Email | `SMTP_URL`, `MAIL_FROM`, `APPROVAL_EMAIL_TO` |

The message stays in Malay, like the printed documents and reports, and carries the document number, type, party, description, formatted amount, the submitter's name and a link built from `APP_URL`. The webhook also receives the raw fields, with `amountSen` as a string because JSON has no integer type wide enough for `BigInt`.

Notifications are best-effort by design: they are sent after the transaction commits, each channel has a three-second timeout, and a failure is logged (`approval.notify_failed`) rather than shown to the user. A reviewer who misses a ping still sees the document in their pending queue. With no channel configured the code path is a no-op.

## Observability

**Structured logs.** Every server log line is one JSON object on stdout, with `time`, `level`, `message`, `service` and contextual fields. Credentials, tokens, cookies, session identifiers and any key containing `pass`, `secret`, `token` or `key` are replaced with `[redacted]` before a line is written, and long values are truncated. `LOG_LEVEL` controls verbosity (`info` by default).

**Request IDs.** Each API request carries an `x-request-id`: an upstream value from nginx or the platform is reused when it is well formed, otherwise one is generated. The ID is echoed in the response header and included in every related log line, so a user can quote it when reporting a problem. Route handlers, Server Actions and unhandled server errors (`instrumentation.ts` → `onRequestError`) all record it.

**Error forwarding.** Set `ERROR_WEBHOOK_URL` to receive error records as JSON POSTs. Delivery is fire-and-forget with a two-second timeout and never blocks or fails a request; the log line is already written first.

**Health checks.** `GET /api/health` probes three things:

| Check | What it proves | Failure effect |
| --- | --- | --- |
| `database` | `SELECT 1` succeeds | `unavailable`, HTTP 503 |
| `uploads` | a probe file can be written and removed in `UPLOAD_DIR` | `unavailable`, HTTP 503 |
| `reports` | Python can `import openpyxl`, and `soffice` exists | `degraded`, HTTP 200 |

A missing Python or LibreOffice install is reported as `degraded`, not as an outage, because the UI, cash book and audit trail still work without it. The reporting probe is cached for a minute so health polling does not spawn processes on every request. Responses contain check names only; filesystem paths and tool versions stay in the server logs.

```bash
curl -s http://127.0.0.1:3000/api/health | jq
# {"status":"ok","checks":{"database":"ok","uploads":"ok","reports":"ok"},"durationMs":12}
```

## Operations

```bash
npm run backup            # dump + uploads + SHA-256 manifest, 14-day retention
npm run restore:verify    # restore into a _test database and compare with the source
npm run cleanup           # remove expired sessions and stale throttle counters
```

- **Backup** writes to `.data/backups` (override with `BACKUP_DIR`), names files by timestamp, and verifies the dump can be read back by `pg_restore` before finishing.
- **Restore verification** restores into a throwaway database, then compares row counts, ledger totals, per-account balances and uploads checksums. A `PASS` means the backup is genuinely restorable.
- **Cleanup** runs automatically once an hour after a successful sign-in; the `cleanup` command is provided for cron on rarely used installations.

Recommended cron entries and the full recovery procedure are in the [operations guide](docs/OPERATIONS.md).

## Production deployment

Use a new database, `SEED_DEMO=false`, private passwords and an HTTPS `APP_URL` before production setup. Create a reviewer account through Settings after the first sign-in.

```bash
npm ci
npm run setup:reports
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Every instance needs access to the same database and uploads directory. For a single-host PM2/nginx deployment, run one instance first and keep uploads on persistent storage. Include both PostgreSQL and uploads in backups.

### Container deployment

The [`Dockerfile`](Dockerfile) builds a runtime image that already contains Node, LibreOffice Calc, Liberation fonts and a Python virtualenv with `openpyxl`, so nothing has to be installed by hand on the host.

```bash
docker build -t kira-rapi .                            # runtime image
docker build --target migrate -t kira-rapi:migrate .   # Prisma CLI for migrate deploy and seed
```

Or with Compose, which also wires the database and an uploads volume:

```bash
docker compose --profile container build
docker compose --profile container run --rm migrate            # migrate deploy
docker compose --profile container run --rm migrate npx prisma db seed
docker compose --profile container up -d app
```

Notes:

- The `container` profile is opt-in, so `docker compose up -d` still starts only PostgreSQL for local development.
- Migrations run as a separate one-off container because the runtime image deliberately omits the Prisma CLI; it is built from the `migrate` target.
- Mount a volume at `/data/uploads` (Compose uses `kira-uploads`). Nothing else in the image is written to at run time.
- The image runs as UID 1001 (`nextjs`) and declares a `HEALTHCHECK` against `/api/health`.
- `DATABASE_URL` must point at `db:5432` inside Compose, not `127.0.0.1:5434`.

The steps above have been exercised in a development environment; the application has not yet been installed on the original LXC host or production domain. PM2/nginx configuration, backup and recovery are described in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation

| Document | Contents |
| --- | --- |
| [OPERATIONS.md](docs/OPERATIONS.md) | PM2/nginx and container deployment, backup and recovery, logging, login throttling, audit, operating rules |
| [UI-UX.md](docs/UI-UX.md) | Design principles, typography, themes and responsive patterns |
| [DESIGN.md](DESIGN.md) | Binding design rules: palette and contrast, spacing and radius tokens, motion, bans |
| [EXCEL-REPORTS.md](docs/EXCEL-REPORTS.md) | Excel templates, fund mapping, PDF generation and Python requirements |
| [legacy-context.md](docs/legacy-context.md) | Context of the original system the requirements were drawn from |

## Current limitations and roadmap

Not yet implemented, in priority order:

1. **Bank reconciliation** and CSV statement import with suggested matches.
2. **Multiple attachments** per document (currently one file per document).
3. **Slimmer image**: the LibreOffice layer dominates the image size; a separate report worker image would let the web container stay small.
4. **Multi-organisation support** and legacy data migration (needs a schema mapping and a balance reconciliation against the source).

Antivirus scanning for attachments is not provided. Restoring a backup of real user data has not been performed in this environment; run `npm run restore:verify` on the production host before you need it.

## Relationship to the original system

Context for the original system lives in [docs/legacy-context.md](docs/legacy-context.md). This version was built from the stated requirements, not copied from the old source code. The schema and authentication differ; do not run these migrations against a legacy database.

The four original Excel templates are available through Excel Reports. Migrating real data requires a schema mapping and a balance reconciliation against the source system.
