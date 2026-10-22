# Kira Rapi — JKKR App

Kira Rapi is a web-based finance management application for a **Village Development and Security Committee (JKKR)**. It manages accounts, transactions, funds, member dues, and the preparation and printing of receipts, vouchers and financial summaries.

> This document is based on a summary of the pre-existing system. The application code, Prisma schema and project scripts were not available in this repository; the setup instructions below are general guidance to be rechecked when the code is added.

## Technology stack

| Component | Technology |
| --- | --- |
| Framework | Next.js 14.2.5, App Router, React 18 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.22 |
| Authentication | JWT via `jose`, `bcryptjs`, 8-hour session cookie |
| UI | Tailwind CSS, `kira-rapi-ui.css` design system, `lucide-react`, `recharts` |
| Deployment | PM2, nginx reverse proxy |

## Main capabilities

- **Financial accounts:** BANK, CASH and OTHER accounts with opening balances.
- **Cash book:** income and expense records, the ledger and transaction filtering.
- **Fund management:** separating transactions by fund.
- **Receipts and vouchers:** documents with DRAFT, APPROVED or PAID status, with print support.
- **Financial summaries:** monthly opening and closing balance calculations plus report printing.
- **Member dues:** monthly dues records.
- **Organisation settings:** organisation profile, accounts, lists, document templates and approvals.
- **Audit:** an action trail through AuditLog.

## Data model

| Model | Purpose |
| --- | --- |
| `Account` | Financial account with BANK/CASH/OTHER type and opening balance |
| `Transaction` | INCOME/EXPENSE transaction linked to an account and fund |
| `Dana` | Fund enum: GAB_JKKR, AC_TUMPANG, DANA_KEROHANIAN, LAIN2 |
| `ListItem` | Custom lists, including additional fund options in the application |
| `BaucerResit` | Voucher/receipt document with DRAFT/APPROVED/PAID status |
| `YuranRecord` | A member's monthly dues record |
| `CompanyProfile` | Organisation profile and prepared-by, checked-by and approved-by signatories |
| `DocumentTemplate` | Receipt, voucher and summary templates; logo, labels and signatories |
| `AuditLog` | Record of user actions |

User roles: **SUPER_ADMIN**, **ADMIN** and **USER**. The exact permission set per role must be taken from the application implementation.

## Modules and routes

| Route | Module |
| --- | --- |
| `/dashboard` | Main dashboard |
| `/dashboard/buku-tunai` | Cash book, ledger and filters |
| `/dashboard/baucer-resit` | Receipt/voucher management and printing |
| `/dashboard/rumusan` | Financial summaries |
| `/dashboard/rumusan/cetak` | Summary printing |
| `/dashboard/yuran` | Monthly dues |
| `/dashboard/settings` | Templates, lists, accounts and approvals |

The system reportedly has **27 API routes** covering authentication (`/api/auth/*`), accounts, transactions, baucer-resit, company-profiles, list-types/items, templates, uploads, users, yuran and me. HTTP methods, payloads and endpoint permissions must be taken from the route code.

## Specialised components

- `lib/terbilang.ts` converts numbers to Malay words, including the "ringgit Malaysia" format on vouchers.
- `lib/rumusan.ts` and `rumusan-ledger.ts` calculate monthly opening and closing balances.
- `/dashboard/rumusan/cetak/print.css` provides the summary print styles.
- Middleware protects routes except `/login`, `/register` and `/`.
- Security headers include CSP, HSTS and `X-Frame-Options: DENY`.

## Development setup

### Prerequisites

- A Node.js and package manager version compatible with the project's `package.json` and lockfile.
- PostgreSQL 16.
- The complete application code and the environment configuration the application refers to.

### General steps

1. Add or obtain the complete application code in this checkout.
2. Review `package.json`, the lockfile, the Prisma schema and the example environment configuration.
3. Install dependencies with the project's package manager. If the project uses `package-lock.json`, use `npm ci`.
4. Provision a PostgreSQL database for development. Set the database connection and authentication configuration using the real variable names in the code. Never commit files containing secrets.
5. Generate the Prisma Client and run migrations with the project scripts. Make sure the connection points at the development database before running migrations or seeds.
6. Run the development script defined in `package.json`.

If the scripts and project structure confirm standard npm/Prisma usage, the example commands are:

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev
```

These commands have not been tested in this repository because the code and manifest were not available. Use the seed command defined by the project only against a development or test database.

## Existing deployment

The following is the reported deployment configuration, not the result of a direct inspection of this repository:

| Setting | Value |
| --- | --- |
| Application name | Kira Rapi — JKKR App |
| Container | LXC 101 |
| Domain | [debri.cipher-node.org](https://debri.cipher-node.org) |
| System user | `jkkr` |
| Application directory | `/home/jkkr/jkkr-app` |
| PM2 process | `kira-rapi`, fork mode |
| Application port | `3000` |
| Reverse proxy | nginx, port 80 |
| Database | PostgreSQL, `localhost:5432` |

Traffic flow: nginx receives web requests and forwards them to Next.js on port 3000; the application uses PostgreSQL as its data store.

For future deployments, use the project's build scripts and the real PM2/nginx configuration. Review migrations, database backups, environment variables and application readiness before restarting the service.

### Operational checks

On the deployment host, with appropriate access:

```bash
# Run as the jkkr user to view the application's PM2 processes.
cd /home/jkkr/jkkr-app
pm2 status
pm2 logs kira-rapi --lines 50 --nostream

# Check the system services.
systemctl status nginx postgresql --no-pager
```

Status at the time the summary was prepared: PM2 `kira-rapi` online, nginx and PostgreSQL active, and Next.js listening on port 3000. This status can change and must be checked again on the host.

## Seed accounts and security

The seed reportedly provides sample accounts for the super admin and user roles. Review the seed script for details and use it only in development or test environments. Change or disable the default accounts before production use; passwords are not recorded in this README.

## Validation

Once the application code is available, check the following workflows against a test database:

- Sign-in, sign-out, session expiry and role-based access.
- Recording income and expense transactions and their effect on account and fund balances.
- Monthly opening and closing balances in the cash book and summaries.
- Preparing, approving, paying and printing receipts/vouchers.
- Monthly dues records and the audit trail.
- Production build and the tests or type checks the project provides.

No build or test suite can be run from the current repository contents.
