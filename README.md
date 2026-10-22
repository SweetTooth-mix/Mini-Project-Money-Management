# Kira Rapi

**Community finance, kept in order.**

A community finance management application with a Malay and English UI: cash book, accounts and funds, receipts and vouchers, member dues, monthly summaries and an audit trail. Excel/PDF output stays in Malay. One installation serves one organisation.

[![CI](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](package.json)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue)](compose.yaml)
[![Next.js](https://img.shields.io/badge/next.js-16.4.0-black)](package.json)

![Kira Rapi dashboard with demo data](docs/screenshots/dashboard.png)

> **Documentation language.** This README is in English. The operational runbooks
> under [`docs/`](docs/) remain in Malay, matching the language used by the
> organisation that runs the system.

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
| Authorisation | Roles are re-checked server-side for every financial action; hiding a button is not an access control |
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

The client address is read from `X-Forwarded-For` (left-most entry) or `X-Real-IP`, and only syntactically valid addresses are accepted. If the application is exposed **without** a proxy, set `TRUST_PROXY_HEADERS=false`; otherwise a client can forge the header and bypass the per-address limit. No email address or IP is stored in plain text.

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

The dictionary lives in [`lib/i18n.ts`](lib/i18n.ts) as `{ ms, en }` pairs with named placeholders. `LanguageToggle` uses a Server Action to set the cookie. The day/night theme uses a separate preference.

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
| `APP_URL` | ✓ | Application origin; HTTPS enables `Secure` cookies and HSTS |
| `POSTGRES_PASSWORD` | ✓¹ | Local PostgreSQL container password |
| `UPLOAD_DIR` | — | Persistent attachment directory, default `.data/uploads` |
| `TRUST_PROXY_HEADERS` | — | Default `true`; set `false` when the app is exposed without a proxy |
| `SEED_ADMIN_EMAIL` | ✓² | Initial Super Admin email |
| `SEED_ADMIN_PASSWORD` | ✓² | Initial password, minimum 12 characters |
| `SEED_DEMO` | — | `true` for demo data; `false` for a new organisation |
| `SEED_REVIEWER_PASSWORD` | — | Required when `SEED_DEMO=true` |
| `DEV_PREVIEW_ORIGINS` | — | Development only: extra hosts for the dev server and preview iframes |
| `TEST_DATABASE_URL` | — | External test database; the name must end with `_test` |
| `EXCEL_PYTHON` | — | Python interpreter path, default `.venv/bin/python` |

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
| Unit | `npm test` | 27 tests | Node only |
| Integration | `npm run test:integration` | 13 tests | PostgreSQL |
| Excel/PDF reports | `npm run test:reports` | 8 tests | Python + LibreOffice |
| Browser | `npm run test:e2e` | 13 scenarios | Current build + Chromium |

```bash
npm run test               # money, dates, ledger, CSV, i18n, throttling, audit filters
npm run test:integration   # concurrent posting, approval, reversal, dues, period lock, throttling
npm run test:reports       # Excel templates, formula links, 12-month balances and PDF
npm run test:e2e           # Chromium: documents, Excel/PDF, theme, language/cookies and mobile
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint: Next core-web-vitals + TypeScript
npm run format:check       # Prettier
npm run build              # Production build and type checking
npm audit                  # Dependency audit
```

**CI.** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and every push to `main`:

1. `quality` — `prisma generate`, `typecheck`, ESLint, Prettier, unit tests, `npm audit --omit=dev --audit-level=high` and a production build.
2. `integration` — PostgreSQL 16 as a service, a `kira_rapi_test` database, `prisma migrate deploy` and the 13 integration tests.

Integration failures are surfaced as check-run annotations, so the cause is readable without downloading job logs. Excel/PDF and browser suites stay manual because they need LibreOffice and Chromium.

`test:integration` provisions `kira_rapi_test` on the local Compose PostgreSQL and cleans fixture data inside that database; the database name must end with `_test` or the suite refuses to run. `test:e2e` **resets the dedicated `kira_rapi_e2e_test` database**, creates fixtures and runs the production build on port 3100, so it needs a current build. The application database `kira_rapi` is never reset by tests; screenshots and PDFs land in `.data/screenshots`.

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

The steps above have been exercised in a development environment; the application has not yet been installed on the original LXC host or production domain. PM2/nginx configuration, backup and recovery are described in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation

| Document | Contents |
| --- | --- |
| [OPERATIONS.md](docs/OPERATIONS.md) | PM2/nginx deployment, backup and recovery, login throttling, audit, operating rules |
| [UI-UX.md](docs/UI-UX.md) | Design principles, typography, themes and responsive patterns |
| [EXCEL-REPORTS.md](docs/EXCEL-REPORTS.md) | Excel templates, fund mapping, PDF generation and Python requirements |
| [legacy-context.md](docs/legacy-context.md) | Context of the original system the requirements were drawn from |

## Current limitations and roadmap

Not yet implemented, in priority order:

1. **Bank reconciliation** and CSV statement import with suggested matches.
2. **Approval notifications** over email or Telegram for `PENDING` documents.
3. **Multiple attachments** per document (currently one file per document).
4. **Observability**: structured logs, request IDs and error tracking; `/api/health` checks the database only.
5. **Dockerfile** for reproducible deployment with LibreOffice and the Python virtualenv.
6. **Email delivery**, multi-organisation support and legacy data migration (needs a schema mapping and a balance reconciliation against the source).

Antivirus scanning for attachments is not provided. Restoring a backup of real user data has not been performed in this environment; run `npm run restore:verify` on the production host before you need it.

## Relationship to the original system

Context for the original system lives in [docs/legacy-context.md](docs/legacy-context.md). This version was built from the stated requirements, not copied from the old source code. The schema and authentication differ; do not run these migrations against a legacy database.

The four original Excel templates are available through Excel Reports. Migrating real data requires a schema mapping and a balance reconciliation against the source system.
