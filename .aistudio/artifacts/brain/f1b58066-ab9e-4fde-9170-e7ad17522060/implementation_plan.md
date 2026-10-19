# Implementation Plan - Perbaikan Tata Letak Header & Aksi Profil (LaporanWee v5.0)

Memperbaiki tata letak header bagian atas (`Navbar.tsx` & `index.css`) agar teks breadcrumb tidak tertutup sidebar rail, elemen kanan tidak menempel tepi layar, serta mengoptimalkan aksi klik profil agar instan, bebas lag/freeze, dan terlindung dari unhandled promise rejection.

---

## 1. Rencana Perbaikan

1. **Tata Letak & Spacing Header (`Navbar.tsx` & `index.css`)**:
   - Memastikan kontainer utama `.app-shell-main` atau `.main` menggunakan padding kiri: `calc(var(--rail, 84px) + 32px)` dan padding kanan `36px`.
   - Mengatur struktur `.top-bar-shell` (atau `.top`) menjadi flexbox: `display: flex; align-items: center; justify-content: space-between; gap: 20px; width: 100%;`.
   - Menambahkan margin kiri (`10px`) pada teks breadcrumb (`.crumb`) agar tidak menabrak lengkungan sidebar.
   - Mengelompokkan utilitas kanan (Theme switcher, Quick search, Avatar) ke dalam `<div className="top-actions">` dengan margin kanan `8px`.
   - Menjaga avatar tetap berukuran 44px x 44px dengan `flex-shrink: 0` dan `object-fit: cover`.

2. **Aksi Klik Profil Anti-Freeze & Zero-Lag (`Navbar.tsx`)**:
   - Memastikan klik pada avatar profil mengarah ke view internal SPA `'user-profile'` dengan aman.
   - Mengambil ID pengguna aktif dari `localStorage` (`laporanwee_user` atau default ID `1`), mencegah string `'me'` atau `'user'` diteruskan ke backend.
   - Menerapkan guard state dan fallback cache lokal agar transisi profil terjadi secara instan tanpa freeze atau pemanggilan fetch berulang (*render-loop*).

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/components/Navbar.tsx` untuk menyempurnakan struktur top bar dan klik avatar profil yang aman.
2. **Langkah 2**: Perbarui `src/index.css` untuk memastikan aturan `.app-shell-main`, `.top-bar-shell`, `.crumb`, dan `.top-actions` selaras dengan spesifikasi di atas.
3. **Langkah 3**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build sukses 100%.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Layout Header**: Pastikan teks breadcrumb di kiri memiliki jarak aman dari sidebar rail dan elemen utilitas kanan tidak menempel tepi layar.
- **Uji Klik Profil**: Klik avatar profil dan pastikan navigasi ke halaman `'user-profile'` merespons instan tanpa error atau freeze halaman.
- **Uji Kompilasi**: `compile_applet` dan `lint_applet` berhasil tanpa error.
