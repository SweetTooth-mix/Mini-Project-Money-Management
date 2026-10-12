# Template cetakan asal

Empat workbook ini mengekalkan gaya dan susun atur fail rujukan pengguna. Data sejarah, formula asal, metadata organisasi/penandatangan dan external links telah dibuang. Jangan gantikan dengan workbook sejarah yang masih mengandungi data sebenar.

| Fail | Helaian template | Kawasan |
| --- | --- | --- |
| `1.xlsx` | `baucer`, `resit` | A1:H29 |
| `2.xlsx` | `Sheet1` | A1:X24; transaksi bermula baris 8, jumlah baris 17 |
| `3.xlsx` | `jan`, `rumusan` | Bulanan A1:L30; tahunan A1:O28 |
| `4.xlsx` | `jan2021`, `rumusan tahunan`, `rumusan yuran` | Tunjang A1:F32 (cetakan termasuk ruang tandatangan G:I), tahunan A1:O41, yuran A1:I60 |

`scripts/excel/generate.py` memetakan sel isi dan memanjangkan baris transaksi sambil memindahkan sel gabungan, jumlah dan tandatangan. Nama `jan2021` ialah pengecam template sahaja; tajuk output menggunakan tahun pilihan. Ujian format membandingkan fon, border, kolum dan sel gabungan dengan template ini.

Perubahan layout memerlukan semakan pemetaan sel dalam generator dan ujian laporan. Pemasangan server mesti menyertakan direktori ini. Lihat [panduan output](../../docs/EXCEL-REPORTS.md).
