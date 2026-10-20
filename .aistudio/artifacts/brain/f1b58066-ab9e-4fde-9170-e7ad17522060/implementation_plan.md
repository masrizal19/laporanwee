# Implementation Plan - Perbaikan Total Pengaturan Profil, Edit Profil, Crop Foto, & Simpan Data v5.0

Memperbaiki seluruh fungsi Pengaturan Profil di `ProfileView.tsx` dan `src/profile-edit.css` agar pengguna dapat mengedit field profil, memotong (crop) foto, mengunggah foto baru dengan dialog pratinjau tambahan sebelum simpan, serta menyediakan tombol "Simpan Profil" yang selalu terlihat di header atas DAN di bagian bawah kartu Informasi Profil.

---

## 1. Rencana Perbaikan pada `ProfileView.tsx` & `src/profile-edit.css`

1. **Tombol "Simpan Profil" Ganda (Header Atas & Bawah Kartu)**:
   - Menyediakan tombol "Simpan Profil" utama di baris header atas (`.top`).
   - Menambahkan tombol "Simpan Semua Perubahan Profil" sekunder di bagian bawah kartu Informasi Profil (`.card.c12`), sehingga pengguna tidak perlu menggulir ke atas untuk menyimpan.

2. **Pengeditan Baris Informasi Profil (`.prow`)**:
   - Menyempurnakan setiap baris expandable (Nama, Email, Pekerjaan, Status) dengan tombol "Terapkan" (`btn dark sm`) dan "Batal" (`btn soft sm`).
   - Ketika "Terapkan" diklik, nilai input otomatis tersimpan ke state lokal, menandai status *dirty* (`Perubahan belum disimpan`), dan menutup baris.

3. **Modal Crop Foto & Dialog Pratinjau Tambahan**:
   - **Modal Crop Utama**: Memperbaiki kanvas crop foto (drag/pan pointer events, slider zoom 100%–300%, tombol "Pilih Foto Baru", dan "Reset").
   - **Dialog Pratinjau Foto Tambahan**: Saat pengguna menekan "Simpan Foto" di modal crop, sistem akan menampilkan dialog pratinjau hasil potongan foto (*Cropped Preview Modal*) terlebih dahulu dengan tombol "Ganti / Edit Ulang" dan "Konfirmasi & Simpan ke Server".
   - Setelah dikonfirmasi, foto dikirim ke backend `POST /api/profile/upload.php` via `FormData` dan `profileService.uploadPhoto`, lalu avatar di Top Bar header dan kartu profil langsung ter-update secara real-time tanpa refresh browser.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/profile-edit.css` dengan gaya dialog pratinjau foto dan tombol simpan profil bawah.
2. **Langkah 2**: Refaktor `src/views/ProfileView.tsx` untuk menyematkan tombol simpan bawah, tombol Terapkan/Batal pada baris informasi, serta dialog pratinjau foto tambahan sebelum simpan.
3. **Langkah 3**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build lulus 100% tanpa error TypeScript.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Tombol Simpan Profil**: Pastikan tombol "Simpan Profil" ada di header atas DAN di bagian bawah kartu Informasi Profil, dan keduanya dapat menyimpan data ke backend.
- **Uji Edit Field Baris**: Buka baris Nama/Email/Pekerjaan/Status, ubah isi, klik "Terapkan", dan verifikasi teks langsung berubah serta indikator *dirty* aktif.
- **Uji Crop & Pratinjau Foto**: Klik ikon pensil foto, pilih foto baru, atur zoom & posisi, klik "Simpan Foto", verifikasi dialog pratinjau foto tambahan muncul, lalu klik "Konfirmasi & Simpan" untuk menyimpan foto.
- **Uji Kompilasi**: `compile_applet` dan `lint_applet` berhasil.
