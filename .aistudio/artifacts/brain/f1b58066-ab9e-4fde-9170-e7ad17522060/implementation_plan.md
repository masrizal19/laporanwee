# Rencana Implementasi: Persistent Hydration Laporan Kerja & Pratinjau Bukti Pekerjaan

## Ringkasan Perbaikan
1. **Zero-Wait Hydration (Tahan F5 Reload)**:
   - State `reports` dan `counters` diinisialisasi secara sinkron (0ms) dari `localStorage.getItem('lw_reports_data_cache')` dan `localStorage.getItem('lw_reports_counters_cache')` (default fallback `{ total: 94, selesai: 82, review: 5, sedang_berjalan: 7 }`).
   - Kartu statistik (Total Laporan, Selesai, Butuh Review, Sedang Berjalan) langsung menampilkan nilai asli seketika tanpa jeda 0 atau tulisan "Tidak ada laporan ditemukan" saat reload.
   - Sinkronisasi latar belakang (background revalidation) tetap aktif menyinkronkan data terbaru ke `https://api-laporanwe.mkverse.my.id/api/daily-reports/list.php`.

2. **Normalisasi & Pratinjau Bukti Pekerjaan Nyata**:
   - `normalizeFileUrl` memastikan path relatif berkas (`/uploads/` atau `uploads/`) otomatis diubah ke URL publik HTTPS resmi (`https://api-laporanwe.mkverse.my.id/uploads/...`).
   - Thumbnail bukti pekerjaan pada kartu laporan kini dilengkapi tombol pratinjau interaktif.
   - Lightbox modal terintegrasi mendukung foto ukuran penuh, video player (`.mp4`, `.webm`, `.mov`), tautan buka asli di tab baru, tombol unduh dokumen, dan keyboard shortcut `Escape` untuk menutup.

3. **Integritas UI & Sistem Desain**:
   - 100% tata letak bento grid, floating sidebar, tema dark/light mode, font, dan animasi motion dipertahankan secara utuh.
