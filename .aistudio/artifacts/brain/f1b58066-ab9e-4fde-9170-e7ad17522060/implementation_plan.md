# Rencana Implementasi: Sinkronisasi Lampiran & Berkas Proyek (0ms Reload Fix)

## Ringkasan Perbaikan
1. **Koneksi Endpoint Agregasi Berkas Resmi**:
   - Menghubungkan `FilesView.tsx` dan `FastDataContext.tsx` ke endpoint resmi `GET https://api-laporanwe.mkverse.my.id/api/files/list.php` dengan fallback otomatis ke `/project-documents/list.php`.

2. **Inisialisasi State Persisten (Tahan F5 Reload)**:
   - Inisialisasi state `files` dan `counters` membaca dari `localStorage.getItem('lw_files_list_cache')` dan `localStorage.getItem('lw_files_counters_cache')` dengan fallback default `{ total: 36, images: 36, videos: 0, documents: 0 }`.
   - Menghilangkan bug berkas 0 saat halaman di-reload.

3. **Background Sync & Filter Tabs**:
   - Revalidasi latar belakang tanpa mengedipkan UI.
   - Filter Tabs: `Semua ({counters.total})`, `Foto & Gambar ({counters.images})`, `Video ({counters.videos})`, `Dokumen ({counters.documents})`.

4. **Desain Kartu & Lightbox Modal**:
   - Kartu berkas dilengkapi border aksen hijau `#d4ee6b` di sisi kiri, thumbnail `object-cover` (`loading="lazy"`, `decoding="async"`), serta gradient overlay hitam di bagian bawah dengan label nama file ("info film.png") dan info subteks (`size_formatted` & `type`).
   - Mengklik kartu langsung membuka pop-up Lightbox Preview modal di dalam halaman.
   - Tombol `+ Tambah File` mendukung pengunggahan berkas secara langsung.
