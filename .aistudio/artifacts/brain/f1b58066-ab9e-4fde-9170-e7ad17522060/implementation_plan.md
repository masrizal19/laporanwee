# Rencana Penyelarasan Pengaturan Profil Sesuai Gambar Referensi

Berdasarkan jawaban klarifikasi dan gambar referensi yang dilampirkan (`image_b1c16dc8.png`):
1. **Tampilan di Layout Utama**: Halaman profil tetap berada di dalam tata letak dashboard utama bersama navigasi rail/sidebar.
2. **Top Bar Header Profil**: Mengaktifkan toggle switch tema (Light/Dark dengan sliding knob) dan tombol *Simpan Profil* di bagian header atas profil persis seperti di gambar.

---

### Tahapan Pengerjaan

#### 1. Header Profil & Toggle Tema (Sesuai Gambar)
- Memperbarui komponen header pada `ProfileView.tsx` agar memiliki:
  - Brand logo `LaporanWee` dengan ikon dan aksen warna lavender.
  - Komponen switch tema `.theme` (tombol *Terang* dan *Gelap* dengan animasi geser `.knob`).
  - Tombol `.btn.dark` bertuliskan **Simpan Profil** dengan ikon centang dan status *loading spinner*.
- Menghubungkan switch tema dengan pengaturan tema sistem (`document.documentElement.dataset.theme`) dan penyimpanan `localStorage` (*zero-flash*).

#### 2. Penyelarasan Kartu Profil (Zero-Distortion)
- **Kartu Kiri (Foto Profil)**:
  - Lingkaran ring gradien SVG dengan label persentase (misal `40%`).
  - Inisial avatar bergradasi pastel (jika belum ada foto custom) atau foto custom tersimpan.
  - Tombol pena edit foto berwarna *lime green* (`.pen`).
  - Judul `Foto Profil`, nama pengguna, teks deskripsi sub, serta *chips* ringkasan (`Profil 40% lengkap`, pekerjaan, status).
  - Tombol `Ubah Foto` untuk membuka modal editor crop.
- **Kartu Kanan (Informasi Profil)**:
  - Header *Pengaturan*, judul *Informasi Profil*, subjudul, dan indikator *dirty state* jika ada perubahan.
  - Input field *Name* dan *Email* dengan floating label dan validasi error.
  - Input *Pekerjaan* beserta baris chip pilihan cepat: `Art Director`, `Desainer Grafis`, `Videografer`, `Copywriter`, `Social Media`.
  - Grup *STATUS* dengan radio chip pilihan: `KARYAWAN`, `MAGANG`, `PKL SISWA`, `PKL MAHASISWA`.
  - Tombol aksi bawah: `Batalkan` dan `Simpan Profil`.

#### 3. Sinkronisasi Data & Backend API
- Mengirim pembaruan nama, email, pekerjaan, dan status ke backend riil: `https://api-laporanwe.mkverse.my.id/api/profile/save.php` dan `update.php`.
- Sinkronisasi instan ke state pengguna di `App.tsx` dan `localStorage` (*zero visual lag*).
- Modal crop foto profil tetap berjalan penuh dengan dukungan geser/drag, zoom slider, tombol putar & balik, serta upload ke `upload.php`.

#### 4. Verifikasi & Pengujian
- Menjalankan `compile_applet` dan `lint_applet` untuk memastikan kode bebas dari kesalahan tipe data atau error sintaks.
- Memastikan transisi tema berjalan lancar (60 FPS) tanpa merusak tampilan halaman lainnya.
