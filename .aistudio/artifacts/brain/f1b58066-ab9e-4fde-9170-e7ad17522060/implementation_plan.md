# Implementation Plan - Integrasi Halaman Pengaturan Profil (code.html) & Backend Sync v5.0

Mengintegrasikan secara utuh desain antarmuka Pengaturan Profil (*Profile Settings*) dari file `code.html` yang diberikan pengguna ke dalam komponen React `ProfileView.tsx` dan `src/profile-edit.css`. Memastikan klik avatar pada Top Bar header langsung mengarahkan pengguna ke halaman ini, serta menghubungkan seluruh aksi ubah data dan unggah foto dengan backend API `https://api-laporanwe.mkverse.my.id/api/profile/`.

---

## 1. Rencana Perubahan dan Komponen

1. **Navigasi Avatar Top Bar (`Navbar.tsx` & `App.tsx`)**:
   - Memastikan event `onClick` pada elemen avatar top bar (`.avatar`) mengarahkan tampilan langsung ke view `'user-profile'` / `ProfileView.tsx` (Pengaturan Profil).

2. **Styling & CSS (`src/profile-edit.css`)**:
   - Memasukkan seluruh aturan CSS dari `code.html` secara utuh:
     - Hero card dengan circular progress ring SVG dan persentase kelengkapan profil.
     - Penulisan baris informasi interaktif (`.prow`, `.ph`, `.pe`) yang dapat di-expand/collapse untuk mengedit Nama, Email, Pekerjaan (*Art Director, Desainer Grafis, Videografer, Copywriter, Social Media*), dan Status (*Tersedia, Sedang bekerja, Dalam rapat, Cuti*).
     - Modal Crop / Edit foto profil dengan kontrol zoom, drag/pan canvas, reset, dan pilihan berkas baru.
     - Indikator perubahan (*dirty status indicator*).

3. **Komponen `ProfileView.tsx` (React Engine)**:
   - Menyerap struktur JSX dan interaktivitas dari `code.html`.
   - Mengisi data profil dari backend `GET https://api-laporanwe.mkverse.my.id/api/profile/get.php`.
   - Mengirim perubahan teks (Name, Email, Pekerjaan, Status) ke `POST https://api-laporanwe.mkverse.my.id/api/profile/save.php` atau `update.php`.
   - Mengirim foto profil yang dipotong/diunggah ke `POST https://api-laporanwe.mkverse.my.id/api/profile/upload.php` via `FormData`.
   - Memperbarui state avatar global dan `localStorage` secara real-time saat foto profil berhasil disimpan.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/profile-edit.css` dengan styling presisi dari `code.html`.
2. **Langkah 2**: Refaktor `src/views/ProfileView.tsx` untuk mereplikasi penuh antarmuka `code.html` dan menghubungkannya dengan API backend `api-laporanwe.mkverse.my.id`.
3. **Langkah 3**: Pastikan `Navbar.tsx` dan `App.tsx` merender `ProfileView` saat avatar top bar diklik.
4. **Langkah 4**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build lulus 100% tanpa error TypeScript.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Klik Avatar**: Klik avatar foto di Top Bar header dan pastikan halaman langsung berpindah ke "Pengaturan Profil" ber-desain `code.html`.
- **Uji Expand Baris Profil**: Klik baris Nama, Pekerjaan, atau Status dan pastikan editor muncul dengan smooth height animation.
- **Uji Unggah & Crop Foto**: Buka modal edit foto, atur zoom dan posisi, simpan foto, dan pastikan foto avatar di Top Bar langsung terupdate secara real-time.
- **Uji Kompilasi**: `compile_applet` dan `lint_applet` berhasil.
