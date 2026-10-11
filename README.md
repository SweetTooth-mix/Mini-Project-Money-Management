# Kira Rapi — JKKR App

Kira Rapi ialah aplikasi web pengurusan kewangan untuk **Jawatankuasa Kemajuan & Keselamatan Kampung (JKKR)**. Aplikasi ini mengurus akaun, transaksi, dana, yuran ahli, serta penyediaan dan cetakan resit, baucer, dan rumusan kewangan.

> Dokumentasi ini berdasarkan ringkasan sistem sedia ada. Kod aplikasi, schema Prisma, dan skrip projek belum tersedia dalam repository ini; arahan setup di bawah ialah panduan umum yang perlu disemak apabila kod dimasukkan.

## Stack teknologi

| Komponen | Teknologi |
| --- | --- |
| Framework | Next.js 14.2.5, App Router, React 18 |
| Bahasa | TypeScript |
| Pangkalan data | PostgreSQL 16 |
| ORM | Prisma 5.22 |
| Authentication | JWT melalui `jose`, `bcryptjs`, cookie session selama 8 jam |
| UI | Tailwind CSS, design system `kira-rapi-ui.css`, `lucide-react`, `recharts` |
| Deployment | PM2, nginx reverse proxy |

## Fungsi utama

- **Akaun kewangan:** akaun BANK, CASH, dan OTHER dengan baki pembukaan.
- **Buku tunai:** rekod pendapatan dan perbelanjaan, ledger, serta penapisan transaksi.
- **Pengurusan dana:** pengasingan transaksi mengikut dana.
- **Resit dan baucer:** dokumen berstatus DRAFT, APPROVED, atau PAID, dengan sokongan cetakan.
- **Rumusan kewangan:** pengiraan baki pembukaan dan penutupan bulanan serta cetakan laporan.
- **Yuran ahli:** rekod yuran bulanan.
- **Tetapan organisasi:** profil organisasi, akaun, senarai, template dokumen, dan kelulusan.
- **Audit:** jejak tindakan melalui AuditLog.

## Model data

| Model | Tujuan |
| --- | --- |
| `Account` | Akaun kewangan dengan jenis BANK/CASH/OTHER dan opening balance |
| `Transaction` | Transaksi INCOME/EXPENSE yang dikaitkan dengan akaun dan dana |
| `Dana` | Enum dana: GAB_JKKR, AC_TUMPANG, DANA_KEROHANIAN, LAIN2 |
| `ListItem` | Senarai tersuai, termasuk tambahan pilihan dana pada aplikasi |
| `BaucerResit` | Dokumen baucer/resit dengan status DRAFT/APPROVED/PAID |
| `YuranRecord` | Rekod yuran bulanan ahli |
| `CompanyProfile` | Profil organisasi dan penandatangan sedia, semak, serta lulus |
| `DocumentTemplate` | Template resit, baucer, dan rumusan; logo, label, serta penandatangan |
| `AuditLog` | Rekod tindakan pengguna |

Peranan pengguna: **SUPER_ADMIN**, **ADMIN**, dan **USER**. Perincian kebenaran setiap peranan perlu dirujuk pada implementasi aplikasi.

## Modul dan route

| Route | Modul |
| --- | --- |
| `/dashboard` | Dashboard utama |
| `/dashboard/buku-tunai` | Buku tunai, ledger, dan filter |
| `/dashboard/baucer-resit` | Pengurusan dan cetakan resit/baucer |
| `/dashboard/rumusan` | Rumusan kewangan |
| `/dashboard/rumusan/cetak` | Cetakan rumusan |
| `/dashboard/yuran` | Yuran bulanan |
| `/dashboard/settings` | Template, senarai, akaun, dan kelulusan |

Sistem dilaporkan mempunyai **27 API route** yang merangkumi authentication (`/api/auth/*`), accounts, transactions, baucer-resit, company-profiles, list-types/items, templates, uploads, users, yuran, dan me. Method HTTP, payload, dan kebenaran endpoint perlu dirujuk pada kod route.

## Komponen khusus

- `lib/terbilang.ts` menukar nombor kepada perkataan Melayu, termasuk format “ringgit Malaysia” pada baucer.
- `lib/rumusan.ts` dan `rumusan-ledger.ts` mengira baki pembukaan dan penutupan mengikut bulan.
- `/dashboard/rumusan/cetak/print.css` menyediakan gaya cetakan rumusan.
- Middleware melindungi route kecuali `/login`, `/register`, dan `/`.
- Security headers merangkumi CSP, HSTS, dan `X-Frame-Options: DENY`.

## Setup pembangunan

### Prasyarat

- Node.js dan package manager yang serasi dengan `package.json` serta lockfile projek.
- PostgreSQL 16.
- Kod aplikasi lengkap dan konfigurasi environment yang dirujuk oleh aplikasi.

### Langkah umum

1. Masukkan atau dapatkan kod aplikasi lengkap dalam checkout ini.
2. Semak `package.json`, lockfile, schema Prisma, dan contoh konfigurasi environment.
3. Pasang dependencies menggunakan package manager projek. Jika projek menggunakan `package-lock.json`, gunakan `npm ci`.
4. Sediakan pangkalan data PostgreSQL untuk pembangunan. Tetapkan sambungan DB dan konfigurasi authentication mengikut nama pemboleh ubah sebenar dalam kod. Jangan commit fail yang mengandungi rahsia.
5. Generate Prisma Client dan jalankan migration menggunakan skrip projek. Pastikan sambungan menunjuk kepada DB pembangunan sebelum menjalankan migration atau seed.
6. Jalankan skrip development yang ditetapkan dalam `package.json`.

Jika skrip dan struktur projek mengesahkan penggunaan npm/Prisma standard, contoh arahan ialah:

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev
```

Arahan ini belum diuji dalam repository ini kerana kod dan manifest belum tersedia. Gunakan arahan seed yang ditetapkan oleh projek hanya pada DB pembangunan atau ujian.

## Deployment sedia ada

Maklumat berikut ialah konfigurasi deployment yang dilaporkan, bukan hasil pemeriksaan langsung daripada repository ini:

| Tetapan | Nilai |
| --- | --- |
| Nama aplikasi | Kira Rapi — JKKR App |
| Container | LXC 101 |
| Domain | [debri.cipher-node.org](https://debri.cipher-node.org) |
| Pengguna sistem | `jkkr` |
| Direktori aplikasi | `/home/jkkr/jkkr-app` |
| Proses PM2 | `kira-rapi`, mode fork |
| Port aplikasi | `3000` |
| Reverse proxy | nginx, port 80 |
| Pangkalan data | PostgreSQL, `localhost:5432` |

Aliran trafik: nginx menerima permintaan web dan menghantarnya kepada Next.js pada port 3000; aplikasi menggunakan PostgreSQL sebagai stor data.

Untuk deployment seterusnya, gunakan skrip build projek dan konfigurasi PM2/nginx yang sebenar. Semak migration, backup DB, pemboleh ubah environment, serta readiness aplikasi sebelum restart servis.

### Pemeriksaan operasi

Pada host deployment, dengan akses yang sesuai:

```bash
# Jalankan sebagai pengguna jkkr untuk melihat proses PM2 aplikasi.
cd /home/jkkr/jkkr-app
pm2 status
pm2 logs kira-rapi --lines 50 --nostream

# Semak status servis sistem.
systemctl status nginx postgresql --no-pager
```

Status yang dilaporkan semasa ringkasan disediakan: PM2 `kira-rapi` online, nginx dan PostgreSQL active, serta Next.js mendengar pada port 3000. Status ini boleh berubah dan perlu diperiksa semula pada host.

## Akaun seed dan keselamatan

Seed dilaporkan menyediakan akaun contoh untuk peranan super admin dan pengguna. Semak skrip seed untuk butirannya dan gunakan hanya dalam persekitaran pembangunan atau ujian. Tukar atau nyahaktifkan akaun lalai sebelum penggunaan production; kata laluan tidak disimpan dalam README ini.

## Validasi

Selepas kod aplikasi tersedia, semak workflow berikut dengan DB ujian:

- Login, logout, tamat tempoh session, dan akses mengikut peranan.
- Rekod transaksi masuk/keluar serta kesannya pada baki akaun dan dana.
- Baki pembukaan/penutupan bulanan dalam buku tunai dan rumusan.
- Penyediaan, kelulusan, pembayaran, dan cetakan resit/baucer.
- Rekod yuran bulanan dan jejak audit.
- Build production serta ujian/type check yang disediakan oleh projek.

Tiada build atau test suite boleh dijalankan daripada kandungan repository semasa.
