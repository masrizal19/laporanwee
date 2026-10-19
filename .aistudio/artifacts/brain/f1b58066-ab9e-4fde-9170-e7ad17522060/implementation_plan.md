# Implementation Plan - Refaktor Layout Laporan Kerja Harian ke Bento Grid (Anti-Gepeng & Full-Width)

Merekonstruksi layout halaman Laporan Kerja Harian (`ReportsView.tsx`) dari list vertikal 1 kolom yang sempit di sebelah kiri menjadi Bento Grid responsif 3-kolom penuh (`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5`) dengan sticky sidebar kanan berlebar 320px untuk widget pendukung.

---

## 1. Rencana Perubahan pada `src/views/ReportsView.tsx` & CSS

1. **Struktur Grid Utama**:
   - Membungkus kontainer laporan dalam grid induk: `grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start`.
   - Kolom kiri berisi kontainer kartu laporan dengan layout Bento Grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5`.
   - Kolom kanan berisi widget sidebar (*Pedoman Laporan* & *Review Cepat*) dengan `sticky top-24`.

2. **Desain Kartu Laporan Bento (`.report-card`)**:
   - Radius sudut 24px, border glassmorphism tipis, padding 18px, dengan efek hover lembut `translateY(-4px)`.
   - Header kartu: Thumbnail gambar dengan ukuran terkunci `w-[52px] h-[52px] rounded-2xl flex-shrink-0 object-cover` (anti-gepeng). Judul menggunakan `-webkit-line-clamp: 2` dan `min-width: 0` agar teks panjang terpotong rapi dengan ellipsis.
   - Footer kartu: Badge status di kiri dan tombol hapus di kanan.

3. **Integritas Fungsi**:
   - Mempertahankan 100% data, props, fungsi pencarian (`searchQuery`), tab filter (`activeTab`), `onSelectReport`, `onDeleteReport`, dan navigasi pembuatan laporan.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/views/ReportsView.tsx` untuk menerapkan struktur grid 3-kolom bento dan sticky sidebar 320px.
2. **Langkah 2**: Tambahkan kelas CSS kustom atau Tailwind utility classes di `src/index.css` atau file styling terkait jika diperlukan.
3. **Langkah 3**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build berjalan sukses 100%.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Grid Responsif**: Pastikan di layar lebar (XL) kartu laporan tampil dalam 3 kolom penuh, berubah menjadi 2 kolom di tablet (MD), dan 1 kolom di mobile.
- **Uji Anti-Gepeng Thumbnail**: Pastikan thumbnail laporan berukuran tetap 52x52px dengan `object-fit: cover` tanpa tertekan saat judul laporan panjang.
- **Uji Sticky Sidebar**: Pastikan widget sidebar di sebelah kanan tetap menempel rapi saat halaman digulir (scrolling).
