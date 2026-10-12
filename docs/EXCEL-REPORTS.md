# Output mengikut template Excel asal

Buka **Laporan Excel** (`/dashboard/laporan-excel`). Pilih tahun, dana bagi tiga kolum asal dan dana akaun tunjang. Dana **Gabungan JKKR** menjadi pilihan asal tunjang. Dana tambahan digabungkan dalam **Lain2** supaya empat pecahan dana asal dikekalkan.

Butang **Jana 4 Excel berpaut (.zip)** menghasilkan:

| Fail | Kandungan dan pautan |
| --- | --- |
| `1. Baucer dan Resit.xlsx` | Resit/baucer yang mempunyai posting bagi tahun berkenaan, `Data` ledger boleh edit, baki awal, data yuran dan panduan |
| `2. Buku Kewangan.xlsx` | Januari–Disember, baki berjalan, bank/tunai dan pecahan dana; formula membaca fail 1 |
| `3. Bulanan dan Rumusan Tahunan.xlsx` | Laporan bulanan mengikut buku kewangan dan rumusan 12 bulan; formula membaca fail 2 |
| `4. Akaun Tunjang.xlsx` | Laporan bulanan dana pilihan, rumusan tahunan mengikut kategori asal dan rumusan yuran; formula membaca sumber fail 1 dan 2 |

Workbook mengekalkan sel gabungan, lebar kolum, fon, warna, border, label, susunan dan ruangan tandatangan daripada empat template yang dibekalkan. Fail `.xls` lama ditukar kepada `.xlsx`. Baris transaksi ditambah apabila ruang asal tidak mencukupi; tajuk jadual berulang pada halaman berikutnya. Ruangan teks panjang boleh bertambah tinggi. Kawasan cetakan ditetapkan supaya ruangan tandatangan tidak terpotong.

Helaian Februari asal yang kosong dilengkapkan menggunakan format Januari. Tahun, nama organisasi, penandatangan dan angka datang daripada aplikasi. Pautan lama ke drive Windows dan fail tahun 2021/2025/2026 tidak digunakan. Template dalam repository telah dibersihkan daripada transaksi, nama penandatangan, nombor cek, alamat, maklumat workbook dan cache pautan asal; fail upload yang mengandungi data sejarah tidak disimpan dalam repository dan tidak diimport ke database.

## Edit dan hubungan antara fail

1. Ekstrak semua fail ke folder yang sama. Kekalkan nama fail supaya pautan relatif terus sah.
2. Buka keempat-empat fail dalam Excel dan benarkan kemas kini pautan bagi pakej ini. Data dikira semula melalui formula.
3. Edit amaun bertanda, nama, butiran dan rujukan pada helaian **Data** dalam fail 1. Amaun positif bermaksud pertambahan baki; amaun negatif bermaksud pengurangan baki.
4. Nama kategori tunjang pada Data boleh dipadankan kepada label dalam rumusan tunjang. Kategori asal yang tidak sepadan dimasukkan dalam **Lain-lain** semasa penjanaan.
5. Jika angka diubah dalam Excel, kemas kini ruangan **Ringgit Malaysia** juga. Terbilang dijana semula secara automatik apabila dokumen diubah melalui aplikasi dan dieksport semula.
6. Untuk tambah/padam catatan atau menukar bulan, jenis akaun, jenis catatan dan dana: ubah melalui aplikasi dan jana semula. Struktur baris laporan ditentukan ketika eksport; ia bukan pengganti editor transaksi aplikasi.

Edit Excel tidak menyegerakkan database aplikasi. Pakej ialah snapshot boleh edit. Formula menyimpan nilai cache supaya angka asal boleh dilihat tanpa fail sumber dibuka; pembaca Excel berbeza mungkin memerlukan kemas kini pautan atau pengiraan semula. Setiap pakej tahunan mempunyai baki awalnya sendiri, bukan pautan langsung kepada pakej tahun lain yang dimuat turun sebelumnya.

## Cetak dan PDF

Pilih bulan dan jenis laporan, kemudian klik **PDF format asal**. Penjana mengambil nilai daripada workbook Excel yang sama dan menggunakan **LibreOffice Calc** untuk mencetak kepada PDF A4. Tiada reka bentuk HTML berasingan. PDF ialah nilai pada masa dijana; perubahan Excel selepas muat turun tidak mengubah PDF terdahulu. Cetak Excel yang diedit menggunakan Excel, atau ubah rekod aplikasi dan jana PDF baharu.

Pada halaman resit/baucer terdapat butang **Excel format asal** dan **PDF format asal** untuk dokumen individu. Excel individu menggunakan sel isi boleh edit tanpa kebergantungan kepada fail lain. Draf, dokumen belum dibayar dan dokumen dibatalkan mempunyai penanda status. Dokumen yang diluluskan menggunakan profil organisasi yang dibekukan ketika kelulusan.

## Pengiraan

- Satu transaksi database `RepeatableRead` membekalkan data kepada keempat-empat workbook.
- Dokumen tanpa posting tidak dimasukkan dalam buku kewangan.
- Buku kewangan dan laporan bulanan memaparkan pergerakan baki sebenar, termasuk catatan bertanda `OPENING`, `TRANSFER_IN`, `TRANSFER_OUT` dan `REVERSAL`. Pindahan hanya mengubah kolum bank/tunai dan tidak dianggap kutipan dana.
- Rumusan tahunan memaparkan penerimaan/perbelanjaan bersih. Pembalikan menjadi nilai negatif dalam jenis asal pada bulan pembalikan. Pindahan dikecualikan; pembukaan sepanjang tahun ditunjukkan pada baris **Pelarasan** yang menggunakan ruang kosong selepas baki bulanan. Baki akhir termasuk pelarasan tersebut.
- Akaun `OTHER` disertakan bersama bank; tajuk bertukar kepada **Bank/lain** apabila perlu.
- Rumusan yuran membaca tuntutan tahun dipilih dan status bayaran semasa eksport. Ia tidak menganggap bilangan ahli atau kadar RM1,000 daripada contoh asal. Setiap tuntutan mempunyai baris supaya bayaran berganda dengan tarikh/rujukan berlainan tidak hilang. Ini bukan laporan status yuran pada suatu tarikh sejarah sebelum pembatalan.
- Nilai wang dikira dengan `Decimal` ketika eksport, berasal daripada integer sen. Formula menggunakan `ROUND(..., 2)`. Nilai yang melebihi ketepatan angka Excel ditolak.

## Persediaan server

Python 3.10+, sokongan `venv` dan LibreOffice Calc diperlukan. Contoh Debian/Ubuntu:

```bash
sudo apt-get install python3-venv libreoffice-calc fonts-liberation
npm run setup:reports
```

`setup:local` turut menjalankan `setup:reports`. Dependencies Python dipin dalam `scripts/excel/requirements.txt` dan dipasang dalam `.venv` yang tidak dicommit. Untuk lokasi Python tersuai, tetapkan `EXCEL_PYTHON` kepada executable yang mempunyai `openpyxl`. Jangan salin virtualenv antara mesin; jalankan setup semula.

Jalankan aplikasi dari root repo. Direktori `templates/excel` dan `scripts/excel` diperlukan pada server; konfigurasi tracing Next turut menyertakannya. LibreOffice mesti berada dalam PATH pengguna PM2. Gunakan satu instance aplikasi seperti konfigurasi PM2 sedia ada. Had dua penjanaan serentak dilaksanakan bagi setiap proses; bagi banyak instance, tambah had concurrency pada infrastruktur.

Permintaan eksport memerlukan sesi aktif dan jawapan menggunakan `Cache-Control: private, no-store`. Tiada macro atau formula daripada upload asal dijalankan. Teks rekod dimasukkan sebagai nilai literal, termasuk teks bermula dengan `=`. Fail sementara berada dalam direktori peribadi dan dibersihkan selepas penjanaan. Ralat worker tidak mendedahkan rekod atau laluan tempatan kepada pengguna.

Had pakej: 5,000 catatan ledger, 500 dokumen dan 5,000 tuntutan yuran bagi satu tahun. Had masa penjanaan 110 saat; keperluan melebihi had ini memerlukan eksport arkib melalui proses latar. Untuk nginx, gunakan `proxy_read_timeout 120s` bagi endpoint penjanaan jika timeout lalai lebih pendek.

## Semakan

```bash
npm run test:reports
npm run build
npm run test:e2e
```

Ujian laporan menyemak baki untuk 12 bulan, pembalikan, pindahan, dana tambahan, baki pembukaan, baris dinamik, data kosong, formula injection, cache dan pautan workbook, gaya asal serta PDF. Ujian pengiraan semula menyelesaikan hubungan workbook yang dijana menjadi helaian dalam workbook ujian, mengubah amaun sumber, kemudian meminta LibreOffice mengira formula secara bebas. Pengiraan semula dalam Microsoft Excel desktop tidak diautomasi dalam environment Linux ini.
