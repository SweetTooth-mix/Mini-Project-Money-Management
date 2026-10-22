# Kira Rapi

**Urus kewangan dengan lebih rapi.**

Aplikasi pengurusan kewangan komuniti dengan UI Bahasa Melayu dan English: buku tunai, akaun dan dana, resit/baucer, yuran ahli, rumusan bulanan serta jejak audit. Output Excel/PDF kekal Bahasa Melayu. Satu pemasangan melayani satu organisasi.

[![CI](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SweetTooth-mix/Mini-Project-Money-Management/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](package.json)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue)](compose.yaml)
[![Next.js](https://img.shields.io/badge/next.js-16.4.0-black)](package.json)

![Dashboard Kira Rapi dengan data demonstrasi](docs/screenshots/dashboard.png)

## Senarai kandungan

- [Modul](#modul)
- [Keselamatan dan kawalan akses](#keselamatan-dan-kawalan-akses)
- [Ketepatan kewangan](#ketepatan-kewangan)
- [Bahasa dan antara muka](#bahasa-dan-antara-muka)
- [Stack dan seni bina](#stack-dan-seni-bina)
- [Struktur repository](#struktur-repository)
- [Mula di mesin pembangunan](#mula-di-mesin-pembangunan)
- [Pemboleh ubah environment](#pemboleh-ubah-environment)
- [Peranan](#peranan)
- [Ujian dan CI](#ujian-dan-ci)
- [Operasi](#operasi)
- [Deployment production](#deployment-production)
- [Dokumentasi](#dokumentasi)
- [Had semasa dan pelan seterusnya](#had-semasa-dan-pelan-seterusnya)

## Modul

| Modul | Fungsi |
| --- | --- |
| Dashboard | Baki, penerimaan, perbelanjaan, tunggakan yuran, carta enam bulan dan dokumen menunggu semakan |
| Buku tunai | Ledger berturutan, baki berjalan, carian butiran/rujukan/kategori, 50 transaksi setiap halaman, penapis bulan/akaun/dana, pindahan dalaman dan eksport CSV |
| Resit & baucer | Cipta/sunting draf, lampiran PDF/PNG/JPEG, kelulusan, rekod bayaran, pembatalan dan cetakan A4 |
| Yuran ahli | Daftar ahli, kadar bulanan, jana yuran tanpa pendua dan kutipan melalui resit |
| Akaun & dana | Akaun bank/tunai/lain-lain, baki pembukaan serta dana tersuai |
| Rumusan | Pecahan kategori, baki awal/akhir, butiran pelarasan dan cetakan/simpan PDF melalui browser |
| Laporan Excel | Empat workbook berpaut mengikut template asal, laporan 12 bulan, akaun tunjang, rumusan yuran dan PDF A4 |
| Tetapan | Profil organisasi, penandatangan, pengguna, permohonan akses, kata laluan dan kunci tempoh kewangan |
| Audit | Rekod tindakan dengan pengguna, masa dan butiran perubahan; tapisan ikut pengguna, tindakan, julat tarikh (waktu Malaysia) dan carian teks, serta eksport CSV |

**Buku tunai.** Carian mengabaikan huruf besar/kecil. Baki berjalan dan jumlah bulanan merangkumi semua transaksi dalam pilihan bulan, akaun dan dana, termasuk transaksi yang tidak muncul dalam hasil carian atau halaman semasa. Pautan Sebelum/Seterusnya mengekalkan penapis; carian baharu bermula pada halaman pertama. Eksport CSV dan rumusan terus menggunakan keseluruhan transaksi bagi pilihan bulan/akaun/dana.

**Jejak audit.** Tapisan ikut pengguna, kod tindakan, julat tarikh (waktu Malaysia, julat terbalik ditukar automatik) dan carian pada butiran, nama pengguna atau kod tindakan. Butang **Eksport log CSV** menggunakan penapis yang sama, dihadkan kepada 50,000 baris, dan setiap sel melalui `csvCell` supaya formula spreadsheet tidak dapat dijalankan. Log audit hanya dibaca kerana trigger database menghalang UPDATE/DELETE.

## Keselamatan dan kawalan akses

| Kawalan | Pelaksanaan |
| --- | --- |
| Authentication | Token sesi rawak 256-bit, hash SHA-256 dalam database, cookie `HttpOnly`/`SameSite=Lax`/`Secure` (apabila `APP_URL` HTTPS), tamat tempoh 8 jam |
| Penamatan sesi | Log masuk semula tidak diperlukan: sesi dipadam apabila akaun dinyahaktifkan atau kata laluan ditukar |
| Had cubaan log masuk | Tiga lapisan (lihat jadual di bawah), hanya cubaan gagal dikira, kunci disimpan sebagai hash |
| Kebenaran | Semakan peranan dijalankan semula pada server untuk setiap tindakan kewangan; menyembunyikan butang bukan kawalan akses |
| Pengasingan tugas | Penyedia tidak boleh meluluskan dokumen sendiri, termasuk Super Admin |
| Integriti rekod | Trigger PostgreSQL menghalang UPDATE/DELETE pada `LedgerEntry` dan `AuditLog`, serta membekukan nilai dokumen selepas dihantar |
| Lampiran | Maksimum 5 MB, tandatangan fail PDF/PNG/JPEG disemak, nama storan UUID, muat turun memerlukan login, `Content-Security-Policy: sandbox` |
| Header | CSP tanpa `unsafe-inline` untuk script luaran, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS apabila HTTPS |
| CSV | Medan teks dijadikan selamat daripada formula spreadsheet (`csvCell`) |
| Pendaftaran | Akaun awam dicipta sebagai `PENDING`; hanya Super Admin boleh mengaktifkan |

### Had cubaan log masuk

Had dikira pada tiga lapisan dan **hanya percubaan gagal** ditukar kepada kiraan:

| Lapisan | Had | Tujuan |
| --- | --- | --- |
| Alamat + e-mel | 8 kegagalan / 15 minit | Hentikan tekaan kata laluan pada satu akaun |
| Alamat | 25 kegagalan / 15 minit | Hentikan satu host mencuba banyak akaun |
| E-mel | 30 kegagalan / 15 minit | Hentikan serangan bertaburan daripada banyak alamat |

Reka bentuk berlapis ini mengelakkan **kunci akaun sebagai senjata**: pengguna sebenar hanya disekat selepas 30 kegagalan, dan log masuk yang berjaya mengosongkan kiraan akaun. Kiraan mengikut alamat dikekalkan selepas log masuk berjaya supaya akaun sah tidak boleh digunakan untuk mereset bajet penyerang. Pendaftaran awam dihadkan kepada 5 permohonan / 15 minit bagi setiap alamat dan setiap e-mel.

Alamat klien dibaca daripada `X-Forwarded-For` (entri paling kiri) atau `X-Real-IP`, dan hanya alamat yang sah diterima. Jika aplikasi didedahkan **tanpa** proxy, tetapkan `TRUST_PROXY_HEADERS=false`; jika tidak, klien boleh memalsukan header tersebut dan memintas had mengikut alamat. Tiada e-mel atau alamat IP disimpan dalam bentuk teks biasa.

## Ketepatan kewangan

- Nilai wang disimpan sebagai **integer sen (`BIGINT`)** dan dikira menggunakan `bigint`, bukan floating point.
- Baki berasal daripada ledger; tiada medan baki akaun berasingan yang perlu diselaraskan.
- Baki awal dimasukkan sebagai entri pembukaan dengan akaun dan dana yang jelas.
- Draf tidak mengubah baki. Aliran biasa ialah **DRAFT → PENDING → APPROVED → PAID**.
- Penyedia tidak boleh meluluskan dokumen sendiri, termasuk Super Admin. Sediakan sekurang-kurangnya dua pengguna untuk proses kelulusan.
- Catatan bayaran, kemas kini yuran, status dokumen dan audit berlaku dalam satu transaksi database.
- Kekangan unik dan penguncian transaksi menghalang catatan bayaran berganda, termasuk permintaan serentak.
- Bayaran yang dibatalkan menghasilkan entri pembalikan. Entri asal dan log audit tidak boleh diubah atau dipadam oleh operasi biasa aplikasi.
- Pindahan merekodkan dua entri yang seimbang dan tidak dianggap pendapatan/perbelanjaan.
- Laporan menggunakan snapshot transaksi database yang konsisten. Rumusnya ialah **baki awal + penerimaan − perbelanjaan + pelarasan = baki akhir**.
- Yuran hanya ditanda dibayar apabila resit selesai; pembatalan membuka semula yuran tersebut.
- Maklumat organisasi pada dokumen dibekukan ketika diluluskan, supaya perubahan profil tidak mengubah cetakan dokumen lama.

Pembalikan dilaporkan sebagai pelarasan pada tarikh pembalikan. Baki negatif dibenarkan supaya ledger boleh mewakili rekod sebenar; semak dan selaraskan rekod bank/tunai secara berkala.

## Bahasa dan antara muka

Bahasa asal ialah **BM (`ms`)**. Butang **BM / EN** bersebelahan kawalan tema menukar bahasa menu, keterangan, borang dan mesej UI. Pilihan disimpan selama setahun dalam cookie `kira-rapi-lang` (`Path=/`, `SameSite=Lax`, `HttpOnly`; `Secure` apabila `APP_URL` HTTPS). Server Components membaca cookie sebelum menghasilkan halaman; bahasa kekal selepas reload, navigasi dan log masuk. Cookie yang tiada atau tidak sah kembali kepada BM.

Kamus tunggal berada dalam [`lib/i18n.ts`](lib/i18n.ts), dengan pasangan `{ ms, en }` dan placeholder bernama. `LanguageToggle` menggunakan Server Action untuk menukar cookie. Tema siang/malam menggunakan preference berasingan.

**Bahasa laporan tidak berubah apabila UI ditukar.** Empat workbook Excel, PDF dan pratonton cetakan resit/baucer/rumusan kekal BM. Nama organisasi, dana, kategori, transaksi dan rekod audit ialah data asal dan tidak diterjemah secara automatik. `lib/excel.ts`, `scripts/excel/*` dan `templates/excel/*` tidak diubah oleh fungsi dwibahasa ini.

UI korporat menyokong desktop dan telefon dengan **mod siang dan malam**. Tema disimpan dalam browser dan mengikut tetapan peranti sebelum pilihan dibuat. Cetakan dan PDF kekal berlatar putih. Menu telefon menyokong papan kekunci serta kekunci Escape, dan font dibekalkan bersama aplikasi (tiada permintaan font pihak ketiga).

Pratonton: [mod siang](docs/screenshots/dashboard.png) · [mod malam](docs/screenshots/dashboard-night.png) · [telefon](docs/screenshots/dashboard-mobile.png) · [English](docs/screenshots/dashboard-en-day.png). Panduan penuh: [UI/UX](docs/UI-UX.md).

## Stack dan seni bina

| Lapisan | Teknologi |
| --- | --- |
| Antara muka | Next.js **16.4.0** (App Router), React **19.3.0**, TypeScript, CSS responsif, Lucide |
| Pelayan | Server Components, Server Actions, Route Handlers (`/api/*`) |
| Data | PostgreSQL **16**, Prisma **6.19.3**, migrasi SQL dengan trigger integriti |
| Validasi | Zod pada sempadan borang dan parameter URL |
| Kata laluan | bcryptjs (cost 12) |
| Laporan | Python 3 + openpyxl, LibreOffice untuk PDF |

Aplikasi menggunakan satu Prisma Client global, membaca data melalui `lib/queries.ts` dan menulis melalui `lib/finance.ts`. Setiap tulisan kewangan mengambil kunci baris organisasi (`SELECT ... FOR UPDATE`) di dalam satu transaksi, yang menyelaraskan pengeposan bayaran, penutupan tempoh dan kemas kini audit. Nilai wang tidak pernah melalui `float`; `lib/money.ts` memegang semua penukaran dan format.

## Struktur repository

```text
app/                      Halaman, Server Actions dan route handler
  dashboard/              Sembilan modul UI
  api/                    attachments, audit/export, export, health, me, reports
components/               UI responsif, borang, navigasi dan paparan dokumen
lib/
  finance.ts              State dokumen, posting, pembalikan, transaksi DB
  money.ts                Integer sen, format RM, tarikh, terbilang Melayu
  ledger.ts               Pengiraan laporan dan keselamatan CSV
  queries.ts              Pembacaan ledger, baki dan penomboran halaman
  audit.ts                Akses data jejak audit
  audit-filters.ts        Normalisasi penapis audit (tulen, boleh diuji)
  throttle.ts             Kiraan had cubaan yang atomik
  throttle-policy.ts      Dasar had cubaan (tulen, boleh diuji)
  request-ip.ts           Pembacaan alamat klien daripada proxy
  maintenance.ts          Pembersihan sesi dan kaunter luput
  auth.ts                 Sesi yang boleh dibatalkan
  uploads.ts              Validasi dan storan lampiran
  search.ts               Pembantu query-string tanpa pergantungan DB
prisma/                   Schema, migrasi, kekangan integriti dan seed
scripts/                  Setup, backup, restore-verify dan runner ujian
tests/                    Unit, integrasi PostgreSQL dan browser
docs/                     Operasi, UI/UX, laporan Excel dan konteks legacy
```

## Mula di mesin pembangunan

Prasyarat: **Node.js 22+**, npm, Docker dengan Compose v2, **Python 3.10+ dengan venv** dan **LibreOffice Calc** untuk output Excel/PDF. Pembangunan dan ujian telah dijalankan dengan Node.js 22 dan 24. Rujuk [persediaan laporan Excel](docs/EXCEL-REPORTS.md).

```bash
git clone https://github.com/SweetTooth-mix/Mini-Project-Money-Management.git
cd Mini-Project-Money-Management
npm run setup:local
npm run dev
```

`setup:local` akan:

1. Menjana `.env` peribadi jika belum wujud, dengan kata laluan rawak untuk DB dan dua pengguna demonstrasi.
2. Menjalankan PostgreSQL melalui Compose pada port tempatan **5434**.
3. Memasang dependencies menggunakan `npm ci`, menjana Prisma Client, menjalankan migration dan seed.
4. Menyediakan virtualenv Python dan menyemak LibreOffice untuk penjanaan laporan.

Aplikasi menggunakan port **3000** dan mendengar pada `0.0.0.0`. Endpoint `GET /api/health` memeriksa sambungan database dan memulangkan `503` apabila tidak tersedia.

Arahan setup boleh diulang: `.env` sedia ada dikekalkan, migration yang sudah digunakan tidak diulang, dan seed tidak menulis semula organisasi atau kata laluan sedia ada. Jika setup gagal, baca ralat sebelum mencuba semula; jangan padam volume database untuk membaiki masalah dependency.

### Log masuk demonstrasi

Nilai kata laluan ada dalam `.env` tempatan yang dijana oleh setup, bukan dalam repository atau dokumentasi.

| Akaun | E-mel | Pemboleh ubah kata laluan |
| --- | --- | --- |
| Super Admin | Nilai `SEED_ADMIN_EMAIL` (lalai `admin@kira-rapi.local`) | `SEED_ADMIN_PASSWORD` |
| Penyemak | `penyemak@kira-rapi.local` | `SEED_REVIEWER_PASSWORD` |

Seed demonstrasi mengandungi organisasi, nama, transaksi dan baki rekaan. Gunakan akaun penyemak untuk meluluskan dokumen yang disediakan oleh Super Admin, atau sebaliknya. Menukar nilai seed dalam `.env` tidak menukar kata laluan pengguna yang sudah wujud; gunakan halaman Tetapan.

## Pemboleh ubah environment

Rujuk [`.env.example`](.env.example). Jangan commit `.env`, dump database atau uploads.

| Nama | Wajib | Kegunaan |
| --- | :---: | --- |
| `DATABASE_URL` | ✓ | Sambungan PostgreSQL aplikasi |
| `APP_URL` | ✓ | Origin aplikasi; HTTPS mengaktifkan cookie `Secure` dan HSTS |
| `POSTGRES_PASSWORD` | ✓¹ | Kata laluan container PostgreSQL tempatan |
| `UPLOAD_DIR` | — | Direktori lampiran berterusan, lalai `.data/uploads` |
| `TRUST_PROXY_HEADERS` | — | Lalai `true`; tetapkan `false` jika aplikasi didedahkan tanpa proxy |
| `SEED_ADMIN_EMAIL` | ✓² | E-mel Super Admin awal |
| `SEED_ADMIN_PASSWORD` | ✓² | Kata laluan awal, minimum 12 aksara |
| `SEED_DEMO` | — | `true` untuk data demonstrasi; `false` untuk organisasi baharu |
| `SEED_REVIEWER_PASSWORD` | — | Diperlukan apabila `SEED_DEMO=true` |
| `DEV_PREVIEW_ORIGINS` | — | Pembangunan sahaja: host tambahan untuk dev server dan iframe pratonton |
| `TEST_DATABASE_URL` | — | Database ujian luaran; nama mesti berakhir dengan `_test` |
| `EXCEL_PYTHON` | — | Laluan interpreter Python, lalai `.venv/bin/python` |

¹ Hanya diperlukan apabila PostgreSQL dijalankan melalui Compose. ² Diperlukan semasa seed pertama.

Jika menggunakan PostgreSQL sendiri, sediakan `.env`, kemudian jalankan `npm ci`, `npm run setup:reports` dan `npm run db:setup`; Docker tidak diperlukan.

## Peranan

| Tindakan | USER | ADMIN | SUPER_ADMIN |
| --- | :---: | :---: | :---: |
| Lihat dashboard, ledger, dokumen, yuran, laporan dan audit organisasi | ✓ | ✓ | ✓ |
| Sediakan/sunting draf sendiri dan muat naik lampiran | ✓ | ✓ | ✓ |
| Lulus/tolak dokumen pengguna lain | — | ✓ | ✓ |
| Rekod bayaran, pembatalan dan pindahan | — | ✓ | ✓ |
| Tambah akaun/dana, daftar ahli dan jana yuran | — | ✓ | ✓ |
| Urus pengguna, profil dan tempoh terkunci | — | — | ✓ |
| Tukar kata laluan sendiri | ✓ | ✓ | ✓ |

Pendaftaran awam menghasilkan pengguna `PENDING` dengan peranan USER. Hanya Super Admin boleh mengaktifkannya.

## Ujian dan CI

| Suite | Arahan | Bilangan | Keperluan |
| --- | --- | :---: | --- |
| Unit | `npm test` | 27 ujian | Node sahaja |
| Integrasi | `npm run test:integration` | 13 ujian | PostgreSQL |
| Laporan Excel/PDF | `npm run test:reports` | 8 ujian | Python + LibreOffice |
| Browser | `npm run test:e2e` | 13 senario | Build terkini + Chromium |

```bash
npm run test               # wang, tarikh, ledger, CSV, i18n, had cubaan, penapis audit
npm run test:integration   # transaksi serentak, kelulusan, pembalikan, yuran, kunci tempoh, had cubaan
npm run test:reports       # template Excel, pautan formula, baki 12 bulan dan PDF
npm run test:e2e           # Chromium: dokumen, Excel/PDF, tema, bahasa/cookie dan telefon
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint: Next core-web-vitals + TypeScript
npm run format:check       # Prettier
npm run build              # Build production dan semakan TypeScript
npm audit                  # Audit dependency
```

**CI.** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) berjalan pada setiap pull request dan setiap push ke `main`:

1. `quality` — `prisma generate`, `typecheck`, ESLint, Prettier, ujian unit, `npm audit --omit=dev --audit-level=high` dan build production.
2. `integration` — PostgreSQL 16 sebagai service, database `kira_rapi_test`, `prisma migrate deploy` dan 13 ujian integrasi.

Kegagalan ujian integrasi dipaparkan sebagai anotasi check-run supaya punca dapat dibaca tanpa memuat turun log. Ujian laporan Excel/PDF dan browser kekal manual kerana memerlukan LibreOffice dan Chromium.

`test:integration` menyediakan `kira_rapi_test` pada PostgreSQL Compose tempatan dan membersihkan data fixture dalam DB tersebut; nama database mesti berakhir dengan `_test` atau ujian menolak untuk berjalan. `test:e2e` **reset DB khusus `kira_rapi_e2e_test`**, mencipta fixture dan menjalankan aplikasi production pada port 3100, jadi ia memerlukan build terkini. DB aplikasi `kira_rapi` tidak direset oleh ujian; screenshot dan PDF ujian berada dalam `.data/screenshots`.

## Operasi

```bash
npm run backup            # dump + uploads + manifest SHA-256, retensi 14 hari
npm run restore:verify    # pulih ke DB _test dan banding dengan sumber
npm run cleanup           # buang sesi luput dan kaunter cubaan lama
```

- **Backup** menulis ke `.data/backups` (boleh diubah melalui `BACKUP_DIR`), menamakan fail dengan tarikh, dan memeriksa bahawa dump boleh dibaca semula oleh `pg_restore` sebelum selesai.
- **Restore verification** memulihkan dump ke database buangan, kemudian membandingkan kiraan baris, jumlah ledger, baki per akaun dan checksum uploads. Keputusan `PASS` bermaksud backup benar-benar boleh dipulihkan.
- **Pembersihan** berjalan automatik sekali sejam selepas log masuk berjaya; arahan `cleanup` disediakan untuk cron pada pemasangan yang jarang digunakan.

Jadual cron yang disyorkan dan prosedur pemulihan penuh ada dalam [panduan operasi](docs/OPERATIONS.md).

## Deployment production

Gunakan database baharu, `SEED_DEMO=false`, kata laluan peribadi dan `APP_URL` HTTPS sebelum setup production. Sediakan pengguna penyemak melalui Tetapan selepas login pertama.

```bash
npm ci
npm run setup:reports
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Setiap instance memerlukan akses kepada database dan direktori uploads yang sama. Untuk pemasangan PM2/nginx satu host, gunakan satu instance dahulu dan simpan uploads di storan berterusan. Sertakan kedua-dua PostgreSQL dan uploads dalam backup.

Arahan di atas telah diuji pada environment pembangunan; aplikasi ini belum dipasang pada LXC atau domain production asal. Konfigurasi PM2/nginx, backup dan pemulihan diterangkan dalam [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Dokumentasi

| Dokumen | Kandungan |
| --- | --- |
| [OPERATIONS.md](docs/OPERATIONS.md) | Deployment PM2/nginx, backup dan pemulihan, had cubaan log masuk, audit, peraturan operasi |
| [UI-UX.md](docs/UI-UX.md) | Prinsip reka bentuk, tipografi, tema dan corak responsif |
| [EXCEL-REPORTS.md](docs/EXCEL-REPORTS.md) | Template Excel, pemetaan dana, penjanaan PDF dan keperluan Python |
| [legacy-context.md](docs/legacy-context.md) | Konteks sistem asal yang menjadi asas keperluan |

## Had semasa dan pelan seterusnya

Belum disediakan, mengikut keutamaan:

1. **Rekonsiliasi bank** dan import penyata CSV dengan cadangan padanan automatik.
2. **Notifikasi kelulusan** melalui e-mel atau Telegram untuk dokumen `PENDING`.
3. **Lampiran berbilang** bagi setiap dokumen (kini satu fail setiap dokumen).
4. **Observability**: log berstruktur, request ID dan error tracking; `/api/health` kini memeriksa database sahaja.
5. **Dockerfile** untuk deployment yang boleh diulang bersama LibreOffice dan venv.
6. **Penghantaran e-mel**, sokongan berbilang organisasi dan pemindahan data legacy (perlu pemetaan schema serta semakan baki terhadap sumber asal).

Pengimbasan antivirus untuk lampiran tidak disediakan. Pemulihan backup pengguna sebenar belum dijalankan dalam environment ini; jalankan `npm run restore:verify` pada host production sebelum hari kejadian.

## Hubungan dengan sistem asal

Konteks sistem asal disimpan dalam [docs/legacy-context.md](docs/legacy-context.md). Versi ini dibina berdasarkan keperluan yang diterangkan, bukan salinan source code lama. Schema dan authentication berbeza; jangan jalankan migration ini pada database lama.

Empat template Excel asal tersedia melalui Laporan Excel. Pemindahan data sebenar memerlukan pemetaan schema serta semakan jumlah baki terhadap sumber asal.
