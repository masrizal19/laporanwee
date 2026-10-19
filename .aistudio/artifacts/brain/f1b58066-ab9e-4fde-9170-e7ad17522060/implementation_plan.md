# Implementation Plan - Galeri Bento Lampiran & Berkas Proyek

Integrasi tata letak editorial Bento Grid untuk Lampiran & Berkas Proyek pada halaman **Detail Laporan (ReportDetailView)** dan **Formulir Edit Laporan (DailyReportForm)**, mempertahankan seluruh spesifikasi CSS dan interaktivitas yang diberikan dalam referensi HTML/CSS tanpa mengubah data yang sudah ada.

---

## 1. Overview & Architecture

### User Alignment & Requirements Summary:
- **Lokasi Penerapan**: Diterapkan pada **Detail Laporan (`ReportDetailView.tsx`)** dan **Formulir Edit Laporan (`DailyReportForm.tsx`)**.
- **Mekanisme Upload & Drag-Drop**: Berkas yang diunggah langsung dikirimkan ke endpoint backend MySQL (`/api/daily-reports/upload.php` dan `/api/project-documents/upload.php`) dengan indikator progress bar animasi.
- **Tampilan Awal**: Area dropzone interaktif (`.tile-add`) siap pakai dengan filter tab kategori dinamis (Semua, Gambar, Video, Dokumen).
- **Prinsip Utama**: Mempertahankan seluruh struktur data, endpoint API, dan desain sistem yang telah ada, hanya meningkatkan antarmuka (UI) dan fitur interaktif galeri lampiran.

---

## 2. Design System & CSS Styling Integration

Memasukkan seluruh rule CSS yang telah disempurnakan dari file HTML referensi ke dalam `src/index.css` atau modul gaya terkait:

1. **Bento Grid Layout (6 Kolom Desktop / 2 Kolom Mobile)**:
   - Pola 7-slot berulang (`data-slot="0"` s/d `"6"`):
     - Slot 0: `col-span 4, row-span 3`
     - Slot 1: `col-span 2, row-span 3`
     - Slot 2, 3, 4, 5: `col-span 2, row-span 3`
     - Slot 6: `col-span 4, row-span 3`
     - Tile Add: `col-span 2, row-span 2` (atau responsif di layar sempit).
2. **Karakter Visual Kartu Berkas (Document Face)**:
   - Dukungan warna gradien khusus berdasarkan ekstensi:
     - `.k-pdf`: merah soft (`--doc-bg: #fde6e6`, `--doc-fg: #c0392b`)
     - `.k-doc`: biru soft (`--doc-bg: #e4ecff`, `--doc-fg: #2f5bd0`)
     - `.k-xls`: hijau soft (`--doc-bg: #e1f5e8`, `--doc-fg: #177a3c`)
     - `.k-ppt`: jingga soft (`--doc-bg: #ffe8da`, `--doc-fg: #c2562a`)
     - `.k-zip`: amber soft (`--doc-bg: #fff0d4`, `--doc-fg: #a8710f`)
     - `.k-file`: ungu soft (`--doc-bg: #ece9ff`, `--doc-fg: #5b4bd0`)
   - Tipografi ekstensi besar yang elegan (`.doc-ext`) dan ikon berkas.
3. **Animasi & Interaksi Visual**:
   - Hover zoom pada media gambar dan video (`scale(1.06)`).
   - Video hover-preview otomatis dan indikator tombol play.
   - Tindakan cepat mengambang di pojok kanan atas (`.act-open` dan `.act-del`).
   - State upload interaktif (`.tile-state`) dengan progress bar kilau (`shine` animation), spinner memproses di server (`sweep` animation), dan penanganan status gagal dengan tombol ulangi/batal.
4. **Komponen Lightbox Modern**:
   - Pratinjau gambar, video, dan kartu dokumen beresolusi penuh.
   - Tombol navigasi (sebelumnya / berikutnya), shortcut keyboard (`Esc`, `ArrowLeft`, `ArrowRight`), dan tombol unduh/buka tab baru.

---

## 3. Komponen Baru: `ProjectAttachmentsGallery.tsx`

Untuk menjaga kebersihan kode dan modularitas tinggi tanpa menduplikasi logika antara `ReportDetailView` dan `DailyReportForm`, kita akan membuat komponen reusable:
`src/components/ProjectAttachmentsGallery.tsx`

### Fitur & Props Komponen:
- **Props**:
  - `documents: ProjectDocument[]`: Berkas yang sudah tersimpan di server.
  - `reportId?: string | number`: ID laporan untuk keperluan upload langsung.
  - `projectId?: string | number`: ID proyek terkait.
  - `editable?: boolean`: Mengaktifkan tombol upload dan hapus (default `true`).
  - `onUploadFile?: (file: File) => Promise<void>`: Handler proses upload berkas baru.
  - `onDeleteFile?: (fileItem: { id: string | number; name: string; filename?: string }) => Promise<void>`: Handler hapus berkas.
  - `onAddToast: (text: string) => void`: Pemberitahuan notifikasi.
- **State Internal**:
  - `activeFilter`: `'all' | 'image' | 'video' | 'doc'` lengkap dengan live counter badge.
  - `uploadingItems`: Antrian berkas yang sedang diunggah lengkap dengan persentase upload, kecepatan, dan status pemrosesan.
  - `lightboxItem`: Berkas yang sedang aktif dipratinjau di modal lightbox.
  - `isDragOver`: Indikator visual saat file ditarik ke dalam area galeri.

---

## 4. Step-by-Step Implementation Plan

### Langkah 1: Tambahkan CSS Lengkap Galeri Bento ke `src/index.css`
- Menempelkan seluruh kelas CSS galeri (`.board`, `.grid`, `.tile`, `.tile-media`, `.tile-shade`, `.tile-actions`, `.act`, `.doc-face`, `.k-pdf`, `.tile-state`, `.progress-bar`, `.tile-add`, `.lb`, dll.) secara terisolasi tanpa mengganggu styling global yang sudah ada.

### Langkah 2: Buat Komponen Reusable `ProjectAttachmentsGallery.tsx`
- Implementasikan pembagian slot 0-6 bento grid.
- Buat parser ekstensi dokumen (`describe(filename, mime)`).
- Implementasikan filter tab dinamis (`Semua`, `Gambar`, `Video`, `Dokumen`) dengan perhitungan jumlah item seketika.
- Implementasikan penanganan drag-and-drop dan input file (hingga 2 GB per berkas).
- Implementasikan modal lightbox responsif dengan kendali keyboard dan tombol unduh.

### Langkah 3: Integrasikan ke `ReportDetailView.tsx`
- Gantikan blok daftar lampiran lama dengan `<ProjectAttachmentsGallery />`.
- Hubungkan data berkas proyek (`allDocs`) ke dalam galeri.
- Hubungkan aksi buka berkas asli (`original.php?id=...`) dan hapus berkas ke backend API yang telah diaudit.
- Hubungkan upload file instan langsung ke backend laporan (`dailyReportService.uploadReportFile`).

### Langkah 4: Integrasikan ke `DailyReportForm.tsx`
- Perbarui bagian "Lampiran & Berkas Proyek" pada formulir pembuatan dan edit laporan agar menggunakan antarmuka galeri bento yang sama.
- Sinkronkan daftar berkas yang baru dipilih (pending) dan berkas yang sudah tersimpan di database server.

---

## 5. Verification Plan

1. **Uji Tampilan & Responsivitas**:
   - Verifikasi tampilan desktop 6 kolom dengan pola bento 7-slot.
   - Verifikasi tampilan mobile (breakpoint 700px) agar beralih ke 2 kolom yang rapi.
2. **Uji Filter Tab**:
   - Klik filter "Semua", "Gambar", "Video", dan "Dokumen", pastikan angka counter akurat dan item difilter secara instan.
3. **Uji Buka & Unduh Lampiran**:
   - Pastikan hover overlay menampilkan tombol Buka dan Hapus.
   - Klik kartu berkas untuk membuka Lightbox pratinjau penuh.
   - Verifikasi tombol unduh dan buka di tab baru berfungsi mengarah ke endpoint berkas asli.
4. **Uji Kompilasi TypeScript**:
   - Jalankan `compile_applet` untuk memastikan tidak ada kesalahan tipe atau kompilasi build.
