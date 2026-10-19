# Implementation Plan - Pembaruan LaporanWee Versi 3.0 & Tagline Baru

Meningkatkan versi aplikasi web LaporanWee menjadi **Versi 3.0 (v3.0)**, memperbarui tagline resmi menjadi **"JANGAN LUPA KERJA HARI INI"**, dan menghadirkan **Pop-up Modal Interaktif Pengumuman Pembaruan 3.0** untuk seluruh pengguna.

---

## 1. Overview & Lokasi Penerapan

Sesuai konfirmasi pengguna:
1. **Perubahan Versi**: Mengubah versi dari `v2.4` menjadi `v3.0` pada footer, metadata, navbar, dan pengumuman sistem.
2. **Tagline Baru ("JANGAN LUPA KERJA HARI INI")**:
   - **Footer Web**: Menggantikan teks lama menjadi `LaporanWee v3.0 • JANGAN LUPA KERJA HARI INI`
   - **Navbar Atas**: Menampilkan badge `v3.0` dan teks tagline `JANGAN LUPA KERJA HARI INI` yang estetik dan selaras dengan tema modern.
   - **Halaman Login**: Menampilkan tagline tebal dan bersemangat `JANGAN LUPA KERJA HARI INI` beserta badge versi 3.0 pada kartu login tim kreatif.
3. **Pengumuman Pembaruan Versi 3.0 ke Seluruh Pengguna**:
   - Menghadirkan **Pop-up Modal Interaktif "Apa yang Baru di Versi 3.0"** yang otomatis muncul saat pengguna membuka aplikasi/login pertama kali.
   - Menyediakan fitur *Remember State* via `localStorage` (`laporanwee_v3_0_seen`) agar tidak mengganggu pengguna berulang kali, serta tombol akses manual (klik badge versi di footer atau navbar) kapan pun pengguna ingin membacanya kembali.

---

## 2. Rincian Fitur Pembaruan Versi 3.0 yang Diumumkan

Modal pengumuman akan menyajikan ringkasan fitur unggulan yang telah disempurnakan:
1. **Galeri Bento Lampiran & Berkas Proyek**:
   - Tampilan editorial Bento Grid 6-kolom desktop & 2-kolom mobile untuk dokumen, foto, dan video.
   - Filter instan kategori (Semua, Gambar, Video, Dokumen) dengan live counter.
   - Lightbox interaktif resolusi penuh dengan navigasi keyboard.
2. **Real-Time CSS Loader & Upload Tracker**:
   - Indikator loader animasi (*sweep shimmer bar*, *pulse ring*) saat berkas diunggah.
   - Pelacak status unggah ganda: berkas tampil di panel antrean status dan secara bersamaan langsung muncul di galeri.
   - Animasi loader dinamis pada tombol Simpan Perubahan / Kirim Laporan dengan penanda tahapan.
3. **Dukungan Berkas Hingga 2 GB & Endpoint MySQL Cepat**:
   - Peningkatan efisiensi pengiriman data langsung ke database server.
4. **Pembaruan Hak Akses & Keamanan Akun**:
   - Penguatan otorisasi multi-role dan pengelolaan laporan harian yang lebih andal.

---

## 3. Komponen Baru & Modifikasi Berkas

### A. Komponen Baru: `src/components/VersionUpdateModal.tsx`
- Modal dialog responsif berdesain modern (glassmorphism/dark overlay, kartu bergradien halus).
- Elemen isi:
  - Header: Badge `Versi 3.0 Dirilis!`, judul `Pembaruan Akbar LaporanWee v3.0`, dan tagline `JANGAN LUPA KERJA HARI INI`.
  - Kartu sorotan (*feature cards*) dengan ikon, deskripsi singkat, dan badge "Baru".
  - Tombol aksi utama: `[Mengerti & Mulai Bekerja]` yang menutup modal dan menandai status `localStorage`.

### B. Pembaruan `src/components/Navbar.tsx`:
- Menambahkan badge versi `v3.0` yang dapat diklik untuk membuka modal rilis.
- Menyematkan tagline `"JANGAN LUPA KERJA HARI INI"` di bagian header / sub-branding navbar.

### C. Pembaruan `src/views/LoginView.tsx`:
- Menampilkan tagline resmi `"JANGAN LUPA KERJA HARI INI"` dan badge `v3.0` pada welcome card login.

### D. Pembaruan `src/App.tsx`:
- Memperbarui teks footer: `LaporanWee v3.0 • JANGAN LUPA KERJA HARI INI`.
- Mengintegrasikan state modal `showUpdateModal` dan auto-popup bagi pengguna yang baru pertama kali membuka versi 3.0.
- Memberikan interaktivitas: klik pada teks footer versi 3.0 membuka kembali modal changelog.

---

## 4. Rencana Langkah Kerja (Implementation Steps)

1. **Langkah 1**: Buat komponen `VersionUpdateModal.tsx` dengan daftar pembaruan lengkap dan desain modern.
2. **Langkah 2**: Tambahkan badge versi dan tagline `"JANGAN LUPA KERJA HARI INI"` di `Navbar.tsx`.
3. **Langkah 3**: Terapkan tagline `"JANGAN LUPA KERJA HARI INI"` dan penanda versi 3.0 di `LoginView.tsx`.
4. **Langkah 4**: Perbarui footer di `App.tsx` dan integrasikan logika pop-up modal interaktif otomatis serta pemicu manualnya.
5. **Langkah 5**: Jalankan `compile_applet` dan uji build untuk memastikan seluruh perubahan bebas galat.

---

## 5. Rencana Pengujian (Verification Plan)

- **Uji Footer & Navbar**:
  - Pastikan teks footer menampilkan `LaporanWee v3.0 • JANGAN LUPA KERJA HARI INI`.
  - Pastikan navbar menampilkan badge versi `v3.0` dan tagline dengan rapi tanpa merusak tata letak responsif.
- **Uji Halaman Login**:
  - Pastikan halaman login menampilkan tagline baru `"JANGAN LUPA KERJA HARI INI"`.
- **Uji Pop-up Modal 3.0**:
  - Verifikasi modal muncul otomatis saat pertama kali masuk aplikasi.
  - Verifikasi modal dapat ditutup dengan tombol "Mengerti & Mulai Bekerja" atau tombol silang.
  - Verifikasi klik badge versi di footer/navbar memunculkan kembali modal changelog.
- **Uji Kompilasi TypeScript**:
  - Menjalankan `compile_applet` hingga sukses 100%.
