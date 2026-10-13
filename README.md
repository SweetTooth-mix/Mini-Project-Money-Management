# Kira Rapi

**Urus kewangan dengan lebih rapi.**

Aplikasi pengurusan kewangan komuniti dengan UI Bahasa Melayu dan English: buku tunai, akaun dan dana, resit/baucer, yuran ahli, rumusan bulanan, serta jejak audit. Output Excel/PDF kekal Bahasa Melayu. Versi baharu ini dibina untuk satu organisasi bagi setiap pemasangan.

![Dashboard Kira Rapi dengan data demonstrasi](docs/screenshots/dashboard.png)

## Apa yang tersedia

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
| Audit | Rekod tindakan dengan pengguna, masa dan butiran perubahan |

Carian Buku Tunai mengabaikan huruf besar/kecil. Baki berjalan dan jumlah bulanan merangkumi semua transaksi dalam pilihan bulan, akaun dan dana, termasuk transaksi yang tidak muncul dalam hasil carian atau halaman semasa. Pautan Sebelum/Seterusnya mengekalkan penapis; carian baharu bermula pada halaman pertama. Eksport CSV dan rumusan terus menggunakan keseluruhan transaksi bagi pilihan bulan/akaun/dana.

UI korporat moden menyokong desktop dan telefon, dengan **mod siang dan malam**. Butang bulan/matahari di bahagian atas menukar tema; pilihan disimpan dalam browser dan digunakan semula selepas reload. Sebelum pilihan dibuat, tema mengikut tetapan peranti. Cetakan dan PDF kekal berlatar putih.

Dashboard menyediakan pintasan kelulusan, yuran dan laporan. Penjana Excel membahagikan pilihan kepada tempoh laporan dan pemetaan dana. Menu telefon menyokong papan kekunci serta kekunci Escape. Font dibekalkan bersama aplikasi; tiada permintaan font pihak ketiga diperlukan semasa digunakan.

Pratonton: [mod siang](docs/screenshots/dashboard.png) · [mod malam](docs/screenshots/dashboard-night.png) · [telefon](docs/screenshots/dashboard-mobile.png). Lihat [panduan reka bentuk UI/UX](docs/UI-UX.md).

## Bahasa antaramuka

Bahasa asal ialah **BM (`ms`)**. Butang **BM / EN** bersebelahan kawalan tema menukar bahasa menu, keterangan, borang dan mesej UI. Pilihan disimpan selama setahun dalam cookie `kira-rapi-lang` (`Path=/`, `SameSite=Lax`, `HttpOnly`; `Secure` apabila `APP_URL` menggunakan HTTPS). Server Components membaca cookie sebelum menghasilkan halaman; bahasa kekal selepas reload, navigasi dan log masuk. Cookie yang tiada atau tidak sah kembali kepada BM.

Kamus tunggal berada dalam [`lib/i18n.ts`](lib/i18n.ts), dengan pasangan `{ ms, en }` dan placeholder bernama. `LanguageToggle` menggunakan Server Action untuk menukar cookie. Tema siang/malam menggunakan preference berasingan.

**Bahasa laporan tidak berubah apabila UI ditukar.** Empat workbook Excel, PDF dan pratonton cetakan resit/baucer/rumusan kekal BM. Nama organisasi, dana, kategori, transaksi dan rekod audit ialah data asal dan tidak diterjemah secara automatik. `lib/excel.ts`, `scripts/excel/*` dan `templates/excel/*` tidak diubah oleh fungsi dwibahasa ini.

Pratonton English: [mod siang](docs/screenshots/dashboard-en-day.png) · [mod malam](docs/screenshots/dashboard-en-night.png) · [laporan pada telefon](docs/screenshots/reports-en-mobile.png).

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

## Stack

Next.js **16.4.0** (App Router), React **19.3.0**, TypeScript, PostgreSQL **16**, Prisma **6.19.3**, Zod, bcryptjs, Lucide dan CSS responsif. Authentication menggunakan token sesi rawak dengan hash dalam database, cookie HttpOnly/SameSite dan tempoh lapan jam. Sesi boleh ditamatkan apabila akaun dinyahaktifkan atau kata laluan ditukar.

## Mula di mesin pembangunan

Prasyarat: **Node.js 22+**, npm, Docker dengan Compose v2, **Python 3.10+ dengan venv** dan **LibreOffice Calc** untuk output Excel/PDF. Pembangunan dan ujian cloud telah dijalankan menggunakan Node.js 24. Rujuk [persediaan dan penggunaan laporan Excel](docs/EXCEL-REPORTS.md).

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

Aplikasi menggunakan port **3000**. Buka port tersebut melalui kaedah akses yang disediakan oleh mesin pembangunan anda. Endpoint `/api/health` memeriksa sambungan database.

Arahan setup boleh diulang: `.env` sedia ada dikekalkan, migration yang sudah digunakan tidak diulang, dan seed tidak menulis semula organisasi atau kata laluan sedia ada. Jika setup gagal, baca ralat sebelum mencuba semula; jangan padam volume database untuk membaiki masalah dependency.

### Log masuk demonstrasi

Nilai kata laluan ada dalam `.env` tempatan yang dijana oleh setup, bukan dalam repository atau dokumentasi.

| Akaun | E-mel | Pemboleh ubah kata laluan |
| --- | --- | --- |
| Super Admin | Nilai `SEED_ADMIN_EMAIL` (lalai `admin@kira-rapi.local`) | `SEED_ADMIN_PASSWORD` |
| Penyemak | `penyemak@kira-rapi.local` | `SEED_REVIEWER_PASSWORD` |

Seed demonstrasi mengandungi organisasi, nama, transaksi dan baki rekaan. Gunakan akaun penyemak untuk meluluskan dokumen yang disediakan oleh Super Admin, atau sebaliknya. Menukar nilai seed dalam `.env` tidak menukar kata laluan pengguna yang sudah wujud; gunakan halaman Tetapan.

### Pemboleh ubah environment

Rujuk [`.env.example`](.env.example). Jangan commit `.env`, dump database atau uploads.

| Nama | Kegunaan |
| --- | --- |
| `DATABASE_URL` | Sambungan PostgreSQL aplikasi |
| `POSTGRES_PASSWORD` | Kata laluan container PostgreSQL tempatan |
| `APP_URL` | Origin aplikasi; gunakan HTTPS untuk production supaya cookie Secure dan HSTS diaktifkan |
| `UPLOAD_DIR` | Direktori lampiran yang berterusan, lalai `.data/uploads` |
| `SEED_ADMIN_EMAIL` | E-mel Super Admin awal |
| `SEED_ADMIN_PASSWORD` | Kata laluan awal, minimum 12 aksara |
| `SEED_DEMO` | `true` untuk data demonstrasi; `false` untuk organisasi baharu tanpa data rekaan |
| `SEED_REVIEWER_PASSWORD` | Diperlukan apabila `SEED_DEMO=true` |

Jika menggunakan PostgreSQL sendiri, sediakan `.env`, kemudian jalankan `npm ci`, `npm run setup:reports` dan `npm run db:setup`; Docker tidak diperlukan untuk menjalankan aplikasi dengan database luaran.

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

Pendaftaran awam menghasilkan pengguna `PENDING` dengan peranan USER. Hanya Super Admin boleh mengaktifkannya. Semakan peranan dibuat semula pada server untuk tindakan kewangan; menyembunyikan butang sahaja bukan kawalan akses.

## Ujian

```bash
npm run test               # Pengiraan wang, tarikh, ledger, CSV dan kamus bahasa
npm run test:integration   # Database test berasingan: transaksi serentak, kelulusan, pembalikan, yuran, kunci tempoh
npm run test:reports       # Template Excel, pautan formula, baki 12 bulan dan PDF
npm run build             # Build production dan semakan TypeScript
npm run test:e2e           # Chromium: dokumen, Excel/PDF, tema, bahasa/cookie dan telefon
npm run typecheck
npm audit
```

`test:integration` menyediakan `kira_rapi_test` pada PostgreSQL Compose tempatan dan membersihkan data fixture dalam DB tersebut. Untuk database ujian luaran, tetapkan `TEST_DATABASE_URL` yang nama databasenya berakhir dengan `_test`.

`test:e2e` **reset DB khusus `kira_rapi_e2e_test`**, mencipta fixture dan menjalankan aplikasi production pada port 3100. Ia memerlukan build yang terkini dan PostgreSQL Compose tempatan. DB aplikasi `kira_rapi` tidak direset oleh ujian. Runner memilih Chromium sistem jika tersedia; jika tiada, jalankan `npx playwright install chromium`. Screenshot dan PDF ujian berada dalam `.data/screenshots`.

Keputusan terakhir yang disahkan dan butiran deployment terdapat dalam [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Deployment production

Gunakan database baharu, `SEED_DEMO=false`, kata laluan peribadi dan `APP_URL` HTTPS sebelum menjalankan setup production. Sediakan pengguna penyemak melalui Tetapan selepas login pertama.

```bash
npm ci
npm run setup:reports
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Setiap instance aplikasi memerlukan akses kepada database dan direktori uploads yang sama. Untuk pemasangan PM2/nginx satu host seperti sistem asal, gunakan satu instance dahulu dan simpan uploads di storan berterusan. Sertakan kedua-dua PostgreSQL dan uploads dalam backup.

Arahan deployment di atas telah diuji pada environment pembangunan; aplikasi ini belum dipasang pada LXC atau domain production asal. Lihat [panduan operasi](docs/OPERATIONS.md) untuk PM2/nginx, backup dan pemulihan.

## Struktur

```text
app/                  Halaman, Server Actions dan endpoint muat turun/eksport
components/           UI responsif, borang, navigasi dan paparan dokumen
lib/finance.ts        State dokumen, posting, pembalikan dan transaksi database
lib/money.ts          Integer sen, format RM, tarikh dan terbilang Melayu
lib/ledger.ts         Pengiraan laporan dan keselamatan CSV
lib/auth.ts           Sesi yang boleh dibatalkan
lib/uploads.ts        Validasi dan storan lampiran
prisma/               Schema, migration, kekangan integriti dan seed
scripts/              Setup tempatan dan runner database ujian
tests/                Ujian unit, integrasi PostgreSQL dan browser
```

## Hubungan dengan sistem asal

Konteks sistem asal disimpan dalam [docs/legacy-context.md](docs/legacy-context.md). Versi ini dibina berdasarkan keperluan yang diterangkan, bukan salinan source code lama. Schema dan authentication berbeza; jangan jalankan migration ini pada database lama.

Empat template Excel asal tersedia melalui Laporan Excel. Pemindahan data legacy, editor visual untuk template/logo baharu, rekonsiliasi bank automatik, sokongan pelbagai organisasi dan penghantaran e-mel belum disediakan. Pemindahan data sebenar memerlukan pemetaan schema serta semakan jumlah baki terhadap sumber asal.
