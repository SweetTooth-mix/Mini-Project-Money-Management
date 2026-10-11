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

```bash
npm ci
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
    proxy_read_timeout 60s;
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

Contoh backup DB Compose tempatan:

```bash
mkdir -p .data/backups
chmod 700 .data/backups
docker compose exec -T db pg_dump -U kira -d kira_rapi -Fc > .data/backups/kira-rapi.dump
chmod 600 .data/backups/kira-rapi.dump
```

Gunakan nama fail bertarikh dalam operasi biasa supaya backup terdahulu tidak ditimpa. Salin uploads dalam tetingkap penyelenggaraan yang sama untuk memastikan lampiran dan DB selaras. Jangan commit backup ke Git.

Uji pemulihan ke database dan direktori uploads yang berasingan dahulu. Sahkan kiraan dokumen, jumlah ledger, baki per akaun/dana dan beberapa lampiran sebelum menukar sambungan aplikasi. Pemulihan backup pengguna sebenar belum dijalankan dalam environment ini.

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
| Senario browser Chromium | 4 lulus, termasuk desktop/mobile, lampiran, kelulusan dan pembatalan akses |
| Audit dependencies npm | 0 vulnerability dilaporkan |
| Cetakan rumusan contoh | 1 halaman A4; sidebar dan kawalan aplikasi disembunyikan |

Ujian unit dan integrasi berada dalam `tests/`; senario browser berada dalam `tests/e2e/app.spec.ts`. Ujian menggunakan database berasingan. Jalankan `npm run build` sebelum `npm run test:e2e` supaya browser menguji kod semasa.

Screenshot dan PDF di `.data/screenshots` menggunakan data rekaan. Screenshot README disalin daripada run browser yang disahkan.

Override `deepmerge-ts@8.0.2` dalam `package.json` membetulkan advisory GHSA-ggr8-5vv4-36mx pada dependency konfigurasi Prisma. CLI Prisma, migration, build dan ujian digunakan untuk menyemak keserasiannya.
