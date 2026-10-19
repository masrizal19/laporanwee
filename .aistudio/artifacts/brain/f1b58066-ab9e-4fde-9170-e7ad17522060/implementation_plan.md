# Implementation Plan - CSS Loader & Visual Upload Progress pada Edit Laporan Harian

Menerapkan indikator loader CSS modern dan panel status progres upload data yang interaktif pada halaman **Edit Laporan Harian (`DailyReportForm.tsx`)** dan **Galeri Lampiran Berkas (`ProjectAttachmentsGallery.tsx`)**, sesuai dengan preferensi pengguna:
1. **Lokasi Loader**: Tampil di seluruh area unggahan (Dropzone Bento & Area Bukti Pekerjaan) serta pada tombol Simpan/Kirim.
2. **Sinkronisasi Berkas**: Kartu berkas yang berhasil diunggah tetap ditampilkan di daftar loader (dengan status sukses/selesai) dan sekaligus muncul langsung di galeri berkas.
3. **Integritas Desain & Data**: Mempertahankan seluruh styling CSS yang sudah ada, tanpa merubah skema data, endpoint backend, atau fungsionalitas inti.

---

## 1. Analisis Kebutuhan & Arsitektur Loader

Berdasarkan jawaban klarifikasi pengguna:
- **Area Unggahan Bukti & Lampiran**:
  - Saat berkas (foto/video/dokumen) ditarik atau dipilih, loader CSS interaktif aktif menampilkan progres unggah (0-100%), kecepatan transfer, dan status pemrosesan di server.
  - Overlay loader semi-transparan dengan animasi `sweep` dan `shine` (memanfaatkan CSS bento yang sudah terintegrasi di `src/index.css`) saat proses pengiriman data sedang berlangsung.
- **Tombol Simpan Perubahan / Kirim**:
  - Tombol simpan menampilkan CSS spinner halus, animasi denyut (*pulse/glow*), dan status teks dinamis (`Mengunggah Berkas...`, `Menyimpan Data ke Server...`).
  - Mencegah klik ganda (*prevent double submit*) dan mengunci input formulir selama proses upload data belum selesai.
- **Tampilan Berkas Sinkron (Loader & Galeri)**:
  - Kartu upload yang berhasil tidak langsung menghilang begitu saja; berkas tetap tercantum dalam list status upload aktif dengan penanda hijau centang `Selesai`, dan secara bersamaan berkas langsung terdaftar dalam grid galeri bento sehingga pengguna yakin data telah masuk ke server.

---

## 2. Rincian Modifikasi Antarmuka & CSS Loader

### A. Komponen CSS Loader di `src/index.css`:
- Mengoptimalkan kelas `.bento-tile-state`, `.bento-progress`, `.bento-progress-bar`, dan animasi `@keyframes bentoSweep`.
- Menambahkan kelas loader khusus untuk area formulir edit laporan:
  - `.upload-loader-overlay`: Lapisan backdrop blur dengan kartu status pemrosesan upload data.
  - `.upload-status-card`: Kartu floating berdesain selaras dengan bento card (border halus, badge status, bar persentase).
  - `.btn-save-loading`: Animasi shimmer pada tombol simpan saat proses transfer payload sedang berjalan.

### B. Penyempurnaan `ProjectAttachmentsGallery.tsx`:
- Mengubah alur penghapusan item dari `activeUploads`:
  - Mengubah logika `setTimeout(() => setActiveUploads(...), 1200)` menjadi state persisten atau transisi halus di mana berkas yang statusnya `'success'` tetap terlihat dengan badge `✓ Berhasil Diunggah` di panel upload dan langsung muncul di koleksi `serverItems` secara real-time.
- Menampilkan panel ringkasan status upload (*Upload Queue & Progress List*) di atas grid ketika ada proses upload aktif maupun yang baru saja selesai.

### C. Penyempurnaan `DailyReportForm.tsx`:
- Menambahkan visual upload loader state pada:
  1. **Bagian Bukti Pekerjaan (Evidence Upload)**: Progress bar animasi dan spinner saat kompresi/upload gambar bukti ke server.
  2. **Bagian Galeri Lampiran & Berkas Proyek**: Indikator upload langsung ke endpoint `/api/daily-reports/upload.php` atau `/api/project-documents/upload.php`.
  3. **Tombol Submit (Simpan Perubahan)**:
     - Tampilan status real-time: `isSubmitting` dengan spinner loader CSS yang diperkaya label status tahapan (misal: "Mengunggah Lampiran..." dilanjutkan "Menyimpan Laporan...").
  4. **Banner / Overlay Progres Global Formulir**: Notifikasi proses upload yang jelas di bagian atas formulir saat proses simpan berjalan sehingga pengguna tahu persis statusnya.

---

## 3. Langkah Implementasi (Implementation Steps)

1. **Langkah 1: Penambahan Gaya CSS Loader (`src/index.css`)**
   - Menambahkan rule CSS untuk floating upload queue loader, progress bar kilau, dan indikator status berhasil/gagal.
   - Memastikan tidak ada gaya yang bertabrakan dengan styling form laporan yang sudah ada.

2. **Langkah 2: Pembaruan `ProjectAttachmentsGallery.tsx`**
   - Sinkronisasi state berkas terunggah: berkas berstatus `'success'` tetap ditampilkan pada antrean upload dengan tanda centang dan secara bersamaan direfleksikan di grid galeri.
   - Memberikan tombol tutup manual (*dismiss*) atau riwayat ringkas upload berkas.

3. **Langkah 3: Pembaruan `DailyReportForm.tsx`**
   - Menghubungkan feedback upload langsung ke antarmuka formulir edit.
   - Menambahkan visual loader pada tombol simpan dan area picker bukti pekerjaan saat proses pengunggahan berlangsung.

4. **Langkah 4: Verifikasi & Build Testing**
   - Menjalankan `compile_applet` untuk memastikan seluruh tipe data TypeScript valid dan build berhasil 100%.

---

## 4. Rencana Pengujian (Verification Plan)

- **Uji Visual Loader Dropzone & Bento**:
  - Drag atau pilih file ke area lampiran, periksa apakah progress bar animasi dan status kecepatan/tahapan muncul dengan jelas.
- **Uji Sinkronisasi Galeri**:
  - Pastikan kartu berkas muncul di daftar upload sukses dan langsung terlihat di galeri bento lampiran.
- **Uji Tombol Simpan**:
  - Tekan tombol "SIMPAN PERUBAHAN", pastikan spinner loader aktif, tombol nonaktif selama proses, dan status tersimpan kembali normal setelah berhasil.
- **Uji Kompilasi**:
  - Eksekusi `compile_applet` tanpa error.
