# Operasi Kira Rapi

## Environment pembangunan

Direktori cloud: `/workspace/Mini-Project-Money-Management`.

```bash
npm run setup:local
npm run dev
```

Setup mengekalkan `.env` sedia ada dan data organisasi. PostgreSQL disimpan dalam named volume Docker `kira-data` di bawah project Compose. Jangan gunakan `docker compose down -v` untuk restart biasa: flag tersebut memadam volume data.

Fail source, lockfile dan skrip berada dalam repository. Dependencies, hasil build, `.env`, `.data` dan volume Docker ialah state tempatan. Proses Next.js dan PostgreSQL perlu dimulakan semula apabila mesin baharu diwujudkan. Snapshot filesystem sahaja tidak membuktikan volume Docker turut dipulihkan; `setup:local` boleh menyediakan DB demonstrasi baharu jika volume tiada.

## Deployment ke host sendiri

Konfigurasi PM2 disediakan dalam [`ecosystem.config.cjs`](../ecosystem.config.cjs). Ia menggunakan direktori checkout sendiri dan mengikat Next.js kepada loopback untuk digunakan di belakang reverse proxy.

Pada checkout versi baharu dengan `.env` production yang lengkap:

Penjana template memerlukan Python 3.10+ dengan venv, LibreOffice Calc dan fon Liberation pada host. Lihat [output Excel dan PDF](EXCEL-REPORTS.md) untuk pemasangan dan cara fail berpaut.

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

Untuk kemas kini aplikasi, buat backup dahulu, jalankan migration/build yang diperlukan, kemudian `pm2 restart kira-rapi --update-env`. PM2/nginx tidak dipasang atau dikonfigurasi pada host asal oleh task ini; semak contoh berikut mengikut host dan domain sebenar.

Contoh blok nginx dalam konfigurasi server HTTPS sedia ada:

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

Gunakan HTTPS dan `APP_URL` yang sepadan sebelum build/start. Kekalkan header Host supaya pemeriksaan origin Server Actions berfungsi. Hadkan kadar permintaan login/pendaftaran di reverse proxy untuk deployment yang boleh dicapai umum; aplikasi turut mengehadkan percubaan mengikut e-mel.

Deployment production memerlukan **DB baharu untuk schema versi ini**, `SEED_DEMO=false` dan pengguna awal yang peribadi. Jangan menggunakan DB legacy tanpa proses migrasi berasingan. PostgreSQL tidak perlu dibuka kepada Internet. Jalankan proses aplikasi sebagai pengguna bukan root.

## Readiness

```bash
curl --fail --silent http://127.0.0.1:3000/api/health
curl --fail --silent --output /dev/null http://127.0.0.1:3000/login
```

Health menunjukkan sambungan DB. Untuk semakan fungsi, login dengan akaun ujian, buka dashboard/buku tunai, dan uji dokumen dalam database ujian. PID atau port yang terbuka sahaja tidak mengesahkan aplikasi berfungsi.

## Backup dan pemulihan

Sertakan tiga komponen: dump PostgreSQL, direktori `UPLOAD_DIR`, dan konfigurasi deployment peribadi. Simpan backup di luar checkout dan lindungi aksesnya.

Backup berjadual (dump + uploads + manifest SHA-256, retensi 14 hari):

```bash
npm run backup                        # tulis ke .data/backups
KEEP_DAYS=30 npm run backup           # retensi berbeza
BACKUP_DIR=/mnt/backup npm run backup # simpan di luar checkout
```

Ia menamakan fail dengan tarikh (`kira-rapi-YYYYMMDD-HHMMSS.dump`), memeriksa dump boleh dibaca semula oleh `pg_restore`, dan mengarkibkan `UPLOAD_DIR` pada masa yang sama supaya lampiran dan DB selaras. Jadualkan melalui cron, contohnya `15 2 * * * cd /srv/kira-rapi && npm run backup`.

Jika PostgreSQL bukan dalam Compose, jalankan `pg_dump`/`pg_restore` terus terhadap `DATABASE_URL` dengan format yang sama, dan pastikan `UPLOAD_DIR` disalin dalam tetingkap yang sama. Jangan commit backup ke Git.

**Uji pemulihan, jangan andaikan.** Skrip verifikasi memulihkan dump ke database buangan (nama mesti berakhir `_test`), kemudian membandingkan kiraan baris, jumlah ledger, baki per akaun dan checksum uploads dengan sumber:

```bash
npm run restore:verify                # dump terbaharu
npm run restore:verify -- .data/backups/kira-rapi-20261020-021500.dump --keep
```

Keputusan `PASS` bermaksud backup benar-benar boleh dipulihkan dan konsisten. Jalankan semasa tempoh tenang kerana dokumen yang dipos ketika backup berjalan boleh membuat perbandingan gagal secara sah. Database pemulihan dipadam selepas semakan kecuali `--keep`; pada kegagalan ia dikekalkan untuk siasatan.

Pemulihan ke host production baharu masih perlu dijalankan secara manual sekali sebelum hari kejadian.

### Penyelenggaraan berjadual

Sesi yang tamat tempoh dan kaunter cubaan log masuk dipadam secara automatik sekali sejam apabila ada log masuk berjaya. Untuk pemasangan yang jarang digunakan, jadualkan pembersihan dalam cron:

```bash
30 3 * * * cd /srv/kira-rapi && npm run cleanup
```

## Kawalan akses dan had cubaan log masuk

Had cubaan dikira pada tiga lapisan, dan **hanya percubaan gagal** ditukar kepada kiraan:

| Lapisan | Had | Tujuan |
| --- | --- | --- |
| Alamat + e-mel | 8 kegagalan / 15 minit | Hentikan tekaan kata laluan pada satu akaun |
| Alamat | 25 kegagalan / 15 minit | Hentikan satu host mencuba banyak akaun |
| E-mel | 30 kegagalan / 15 minit | Hentikan serangan bertaburan daripada banyak alamat |

Reka bentuk ini mengelakkan **kunci akaun sebagai senjata**: penyerang perlu 30 kegagalan sebelum pengguna sebenar disekat, dan log masuk yang berjaya mengosongkan kiraan alamat+e-mel serta e-mel. Kiraan mengikut alamat dikekalkan selepas log masuk berjaya supaya akaun sah tidak boleh digunakan untuk mereset bajet penyerang. Pendaftaran awam dihadkan 5 permohonan / 15 minit bagi setiap alamat dan setiap e-mel.

Alamat klien dibaca daripada `X-Forwarded-For` (entri paling kiri) atau `X-Real-IP`, dan hanya alamat yang sah diterima. Jika aplikasi didedahkan **tanpa** proxy, tetapkan `TRUST_PROXY_HEADERS=false`; jika tidak, klien boleh memalsukan header tersebut dan memintas had mengikut alamat. Contoh nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.

Tiada e-mel atau alamat IP disimpan dalam bentuk teks biasa: kunci had ialah SHA-256 bagi gabungan jenis, alamat dan e-mel.

## Jejak audit

Halaman Audit menyokong tapisan ikut pengguna, kod tindakan, julat tarikh dan carian pada butiran, nama pengguna atau kod tindakan. Julat tarikh menggunakan **waktu Malaysia (GMT+8)**, dan julat yang terbalik ditukar secara automatik.

Butang **Eksport log CSV** memuat turun sehingga 50,000 baris menggunakan penapis yang sama. Kandungan CSV diambil daripada log yang tidak boleh diubah; medan teks dijadikan selamat daripada formula spreadsheet. Log audit tidak boleh disunting atau dipadam oleh aplikasi, jadi tapisan ini hanya bacaan.

## Peraturan penting

- Untuk kesilapan draf, gunakan **Sunting draf**. Selepas dihantar, butiran kewangan dibekukan.
- Untuk kesilapan bayaran, gunakan **Batalkan dokumen** dengan sebab dan tarikh pembalikan; entri asal dikekalkan.
- Bila tutup bulan, semak jumlah dengan penyata bank/tunai sebelum mengunci tempoh.
- Jika yuran salah, batalkan resit berkaitan terlebih dahulu; rekod yuran kembali belum dibayar.
- Menyahaktifkan pengguna dan menukar kata laluan membatalkan sesi berkaitan.
- Lampiran maksimum 5 MB, dengan semakan tandatangan fail PDF/PNG/JPEG. Fail dimuat turun melalui route yang memerlukan login. Pengimbasan antivirus tidak disediakan.
- Eksport CSV melindungi medan teks daripada formula spreadsheet.
- Log audit dan ledger mempunyai trigger PostgreSQL yang menghalang UPDATE/DELETE aplikasi. Pentadbir database tetap mempunyai kuasa pentadbiran pada DB.

## Pengesahan pembangunan

Disahkan pada **12 Oktober 2026 (Asia/Kuala_Lumpur)**:

| Semakan | Keputusan |
| --- | --- |
| Build production dan TypeScript | Lulus |
| Ujian unit | 8 lulus |
| Ujian integrasi PostgreSQL | 10 lulus |
| Ujian output Excel | 8 lulus: baki 12 bulan, formula berpaut, format asal, baris dinamik, bulan kosong dan PDF |
| Senario browser Chromium | 8 lulus, termasuk desktop/mobile, tema siang/malam, fokus menu, lampiran, kelulusan, pembatalan akses dan muat turun Excel/PDF |
| Semakan visual UI | Desktop dan telefon dalam kedua-dua tema; tiada limpahan halaman pada saiz yang diuji |
| Audit dependencies npm | 0 vulnerability dilaporkan |
| Cetakan rumusan contoh | Fixture asal 1 halaman A4; fixture dengan pelarasan tambahan 2 halaman. Cetakan dari mod malam kekal putih; sidebar dan kawalan aplikasi disembunyikan |

Ujian unit dan integrasi berada dalam `tests/`; senario browser berada dalam `tests/e2e/app.spec.ts` dan `tests/e2e/design.spec.ts`. Ujian menggunakan database berasingan. Jalankan `npm run build` sebelum `npm run test:e2e` supaya browser menguji kod semasa.

Redesign UI disahkan dengan build production dan lapan senario browser. Fail template Excel, penjana laporan, logik kewangan dan schema dibandingkan menggunakan SHA-256 dan kekal sama seperti sebelum redesign. Semakan kontras teks terpilih pada dashboard, buku tunai, resit/baucer, laporan Excel dan tetapan tidak menemukan kegagalan ambang kontras dalam kedua-dua tema; ini bukan audit aksesibiliti menyeluruh.

Semakan tambahan UI dwibahasa pada **13 Oktober 2026 (Asia/Kuala_Lumpur)**:

- Build production, TypeScript dan **11 ujian unit** lulus.
- **12 senario browser** lulus, termasuk bahasa pada server tanpa JavaScript, cookie selepas reload/log masuk, navigasi modul, penapis, input borang dan paparan telefon.
- Muat turun daripada UI BM dan English menghasilkan empat workbook dengan XML kandungan, formula, gaya dan pautan yang sama. Perbandingan mengecualikan metadata masa penjanaan, termasuk salinannya dalam cache pautan luar. Fail `BACA DAHULU.txt` juga sama.
- Teks PDF daripada UI English dan kandungan pratonton cetakan resit/baucer/rumusan kekal BM. Kawalan bahasa disembunyikan semasa mencetak.
- SHA-256 bagi `lib/excel.ts`, `scripts/excel/*` dan `templates/excel/*` sepadan dengan versi sebelum penambahan bahasa. Tiada perubahan schema atau migration.

Senario bahasa berada dalam `tests/e2e/i18n.spec.ts`; screenshot English berada dalam `docs/screenshots/`. Gunakan `APP_URL` HTTPS pada production supaya cookie bahasa menerima atribut `Secure`.

Disahkan pada **22 Oktober 2026 (Asia/Kuala_Lumpur)** untuk had cubaan log masuk berlapis dan jejak audit boleh tapis:

| Semakan | Keputusan |
| --- | --- |
| CI GitHub Actions (`quality`) | Lulus: typecheck, ESLint, Prettier, ujian unit, `npm audit --omit=dev --audit-level=high`, build production |
| CI GitHub Actions (`integration`) | Lulus: PostgreSQL 16, 13 ujian integrasi termasuk kiraan had cubaan serentak |
| Ujian unit | 27 lulus (9 penapis audit, 7 had cubaan/alamat klien, 11 sedia ada) |
| Ujian integrasi PostgreSQL | 13 lulus: 3 baharu untuk had cubaan dan tapisan audit |
| Prettier dan ESLint | 0 ralat, 0 amaran pada `app/`, `lib/`, `components/` dan `tests/` |

Screenshot dan PDF di `.data/screenshots` menggunakan data rekaan. Screenshot README disalin daripada run browser yang disahkan.

Override `deepmerge-ts@8.0.2` dalam `package.json` membetulkan advisory GHSA-ggr8-5vv4-36mx pada dependency konfigurasi Prisma. CLI Prisma, migration, build dan ujian digunakan untuk menyemak keserasiannya.
