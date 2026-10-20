# Implementation Plan - Menghapus Badge Tagline di Navbar & Memulihkan Menu Analitik

Menghapus elemen tombol badge versi dan tagline (`nav-version-tagline-btn`) dari bilah atas (`header.topnav`) pada komponen `Navbar.tsx`, sehingga seluruh tautan navigasi (Dashboard, Proyek, Laporan, Tugas, Sosial Media, Tim, Kalender, dan **Analitik**) memiliki ruang horizontal yang lega dan tidak lagi terpotong atau tertutup.

---

## 1. Masalah yang Ditemukan

- Tombol `nav-version-tagline-btn` yang berisi badge `v3.0` dan teks panjang `JANGAN LUPA KERJA HARI INI` di sebelah logo LaporanWee memakan ruang horizontal yang signifikan pada `header.topnav`.
- Akibatnya, menu navigasi utama (`.nav-links`) terdesak ke kanan sehingga item menu terakhir seperti **Analitik** (`analytics`) menjadi hilang/tersembunyi dari layar pengguna pada berbagai ukuran viewport.

---

## 2. Rencana Solusi & Perubahan

1. **Komponen `src/components/Navbar.tsx`**:
   - Menghapus tombol `nav-version-tagline-btn` beserta wrapper pembungkusnya di sebelah tombol brand logo.
   - Mengembalikan tombol brand `<button className="brand" ...>` ke posisi semula yang ringkas.
   - Memastikan `header.topnav` memberikan ruang penuh bagi seluruh 8 menu navigasi:
     - Dashboard (`home`)
     - Proyek (`folder`)
     - Laporan (`doc`)
     - Tugas (`checksq`)
     - Sosial Media (`share`)
     - Tim (`users`)
     - Kalender (`calendar`)
     - **Analitik** (`chart`)

2. **Mempertahankan Keberadaan Tagline & Versi 3.0 di Area Lain**:
   - Tagline **"JANGAN LUPA KERJA HARI INI"** dan versi **v3.0** tetap aktif dan terlihat di:
     - **Footer Web**: `LaporanWee v3.0 • JANGAN LUPA KERJA HARI INI` (tetap dapat diklik untuk membuka modal changelog).
     - **Halaman Login**: Welcome card dengan tagline resmi dan badge `v3.0`.
     - **Modal Pembaruan Akbar Versi 3.0** (`VersionUpdateModal.tsx`): Menampilkan rincian fitur baru saat pengguna masuk atau mengklik footer.
     - **Meta tag HTML**: `<title>` dan deskripsi meta tetap mencantumkan v3.0 dan tagline.

3. **Pembersihan CSS di `src/index.css`**:
   - Menghapus/menonaktifkan class `.nav-version-tagline-btn` agar tidak menyisakan aturan CSS yang tidak digunakan.

---

## 3. Langkah Implementasi (Execution Steps)

1. **Langkah 1**: Edit `src/components/Navbar.tsx` untuk menghapus tombol `.nav-version-tagline-btn` dan menyederhanakan kontainer brand logo.
2. **Langkah 2**: Periksa `src/App.tsx` agar prop `onOpenWhatsNew` tetap aman (masih digunakan melalui footer tag).
3. **Langkah 3**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build berjalan sukses 100%.

---

## 4. Rencana Verifikasi (Verification Plan)

- **Uji Visual Navbar**:
  - Pastikan tombol logo LaporanWee kembali ringkas tanpa tombol tagline di sampingnya.
  - Pastikan menu **Analitik** dan seluruh 7 menu lainnya muncul dengan jelas dan tidak tertutup/terdesak.
- **Uji Fungsi Footer & Modal**:
  - Klik teks footer `LaporanWee v3.0 • JANGAN LUPA KERJA HARI INI` dan pastikan modal pengumuman fitur baru tetap terbuka dengan normal.
- **Uji Kompilasi**:
  - `compile_applet` berhasil tanpa error.
