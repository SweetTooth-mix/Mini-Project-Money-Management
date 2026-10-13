# Reka bentuk UI/UX Kira Rapi

Arah visual: korporat moden dengan warna hijau jade, tipografi DM Sans dan paparan kewangan yang mendahulukan baki serta tindakan harian. Antara muka menyediakan Bahasa Melayu dan English.

## Aliran kerja

- **Dashboard:** ringkasan kewangan, pintasan dokumen menunggu semakan, yuran belum selesai dan penjana laporan. Carta enam bulan turut menyediakan data dalam bentuk jadual.
- **Navigasi:** modul kewangan dan pengurusan dipisahkan dalam sidebar. Halaman semasa ditandakan dan butang rekod baharu tersedia pada dashboard.
- **Laporan Excel:** gambaran empat workbook, pilihan tempoh/jenis laporan, dana akaun tunjang dan pemetaan kolum. Pemetaan lanjut boleh dibuka apabila diperlukan. Panduan penggunaan fail berada bersebelahan pilihan penjanaan.
- **Borang dan status:** label, penerangan ringkas, mesej kejayaan/ralat berikon dan keadaan loading menggunakan komponen bersama.

## Mod siang dan malam

Butang bulan/matahari tersedia pada ruang kerja, login dan pendaftaran. Pilihan disimpan pada browser tersebut menggunakan `kira-rapi-theme`. Tanpa pilihan tersimpan, aplikasi mengikuti tetapan tema peranti, termasuk apabila tetapan itu berubah. Perubahan pilihan dalam tab lain turut digunakan.

Tema ditetapkan sebelum kandungan pertama dipaparkan untuk mengurangkan kilatan tema yang salah. Warna latar, teks, borang, jadual dan status menggunakan pemboleh ubah CSS yang sama di seluruh aplikasi.

Peraturan tema terhad kepada paparan skrin. Pratonton dokumen kekal seperti kertas putih; cetakan rumusan dan output Excel/PDF mengekalkan format asal. Pengiraan kewangan, schema database dan empat fail template tidak diubah oleh redesign.

## Telefon dan papan kekunci

Butang BM/EN tersedia pada desktop dan telefon, termasuk halaman login dan pendaftaran. Bahasa asal ialah BM. Pilihan disimpan dalam cookie `kira-rapi-lang` dan dibaca pada server; pertukaran bahasa mengekalkan URL/penapis, tema dan input borang yang belum dihantar. Kandungan laporan, nilai kategori tersimpan serta rekod pengguna tidak diterjemahkan.

Sidebar menjadi menu boleh buka pada skrin sehingga 1100px. Apabila menu dibuka, fokus masuk ke dalam menu, Tab/Shift+Tab kekal di dalamnya dan kandungan latar tidak boleh diaktifkan. Escape menutup menu dan memulangkan fokus ke butang pembuka. Menu ditutup apabila pautan dipilih atau saiz skrin kembali ke desktop.

Kad dan borang disusun semula mengikut lebar skrin. Jadual panjang boleh ditatal dalam bekasnya. Penanda fokus kelihatan, pautan langkau ke kandungan dan tetapan peranti untuk mengurangkan animasi turut disokong.

## Penyelenggaraan dan pengesahan

- Token warna dan peraturan responsif: `app/globals.css`.
- Tema awal: `app/layout.tsx`; kawalan tema: `components/theme-toggle.tsx`.
- Bahasa: `lib/i18n.ts` untuk kamus; `lib/i18n-server.ts` membaca cookie; `components/language-toggle.tsx` dan `app/language-actions.ts` menukar pilihan bahasa.
- Navigasi dan pengurusan fokus: `components/shell.tsx`.
- Senario tema, desktop/telefon, fokus menu dan cetakan dari mod malam: `tests/e2e/design.spec.ts`.
- Aliran dokumen serta muat turun Excel/PDF: `tests/e2e/app.spec.ts`.
- Bahasa pada server tanpa JavaScript, cookie, penapis, borang, telefon dan output BM: `tests/e2e/i18n.spec.ts`. Ujian membandingkan kandungan XML empat workbook antara pilihan bahasa UI, termasuk formula, gaya dan pautan. Hanya metadata masa penjanaan dikecualikan daripada perbandingan.

Jalankan `npm run build` diikuti `npm run test:e2e`. Ujian menggunakan database fixture berasingan dan menghasilkan screenshot serta PDF dalam `.data/screenshots`. Keputusan semakan terdapat dalam [panduan operasi](OPERATIONS.md).

| Mod siang                                         | Mod malam                                               |
| ------------------------------------------------- | ------------------------------------------------------- |
| ![Dashboard mod siang](screenshots/dashboard.png) | ![Dashboard mod malam](screenshots/dashboard-night.png) |
