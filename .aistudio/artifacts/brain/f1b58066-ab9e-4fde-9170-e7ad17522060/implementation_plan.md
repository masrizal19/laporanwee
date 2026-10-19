# Implementation Plan - Audit Total & Refaktor: Modul Profil, Edit Profil, UI Settings, dan Safe-Area Header v5.0

Melakukan audit dan refaktor menyeluruh pada antarmuka frontend LaporanWee untuk modul profil pengguna, modal edit profil dengan unggah avatar real-time, sinkronisasi global UI settings & tema, serta perbaikan safe-area header topbar.

---

## 1. Rencana Perbaikan Per Modul

1. **Modul Profil Pengguna (`UserProfileView.tsx` / `user-profile`)**:
   - Resolusi parameter user ID fleksibel (`useParams` / `window.location`). Mencegah string `'user'`, `'me'`, atau kosong diteruskan ke SQL backend dengan fallback aman ke `currentUser.id` || `localStorage` || `1`.
   - Menggunakan `hasFetchedRef.current` guard untuk memastikan request API ke `https://api-laporanwe.mkverse.my.id/api/profile/get.php?id=${resolvedId}` berjalan tepat **1 kali**, mencegah infinite render, render-loop, dan toast spam.
   - Menyediakan data cache instan dari `localStorage` agar halaman langsung menampilkan identitas dasar saat network memuat data.

2. **Formulir Edit Profil & Unggah Avatar (Modal)**:
   - Modal popup mengapung dengan transisi glassmorphism (`.ov.show`, `.modal`).
   - Field: Nama Lengkap, Gelar/Profile Title, Email, dan Ubah Password.
   - State tombol "Menyimpan..." dengan spinner loading dan disabled button.
   - Endpoint Simpan: `POST https://api-laporanwe.mkverse.my.id/api/profile/save.php` dengan header otorisasi lengkap (`Authorization: Bearer <token>` dan `X-Admin-Email`).
   - Unggah Avatar: Pilihan file gambar dengan preview instan (`Object URL`), dikirim via `FormData` ke `https://api-laporanwe.mkverse.my.id/api/profile/upload.php`, lalu memperbarui state global dan `localStorage` secara real-time tanpa refresh browser.

3. **Sinkronisasi Global UI Settings & Tema**:
   - Mengambil konfigurasi visual dari `GET https://api-laporanwe.mkverse.my.id/api/ui-settings.php`.
   - Menyimpan preferensi tema ke `POST https://api-laporanwe.mkverse.my.id/api/profile/settings.php` dan `localStorage('laporanwee_theme')`.
   - Transisi CSS bezier pada knob theme switcher di header dan penyesuaian atribut `document.documentElement.dataset.theme`.

4. **Perbaikan Safe-Area Header (`Navbar.tsx` & `index.css`)**:
   - Padding kiri kontainer `.app-shell-main` / `.main`: `calc(var(--rail, 84px) + 32px)`, kanan `36px`.
   - Header `.top-bar-shell` flexbox dengan `justify-content: space-between`.
   - Margin kiri `12px` pada `.crumb` dan container kanan `.top-actions` dengan `gap: 12px` dan `margin-right: 10px`.
   - Avatar dikunci `width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; object-fit: cover`.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/index.css` untuk memastikan aturan layout header `.app-shell-main`, `.top-bar-shell`, `.crumb`, dan `.top-actions` sudah sempurna.
2. **Langkah 2**: Perbarui `src/components/Navbar.tsx` untuk sinkronisasi tema UI settings dan klik profil yang responsif.
3. **Langkah 3**: Periksa dan sempurnakan `src/views/UserProfileView.tsx` (atau komponen profil terkait) dengan guard fetch 1 kali dan modal edit profil/upload avatar.
4. **Langkah 4**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build sukses 100%.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Safe-Area Header**: Pastikan breadcrumb tidak tertutup sidebar rail dan utilitas kanan tidak menempel tepi layar.
- **Uji Profil & Upload Avatar**: Buka profil pengguna, buka modal edit profil, unggah foto baru, dan verifikasi avatar di Top Bar langsung berganti secara real-time.
- **Uji UI Settings & Tema**: Toggle tema light/dark dan verifikasi preferensi tersimpan ke backend & localStorage tanpa kedip.
- **Uji Kompilasi**: `compile_applet` dan `lint_applet` lulus tanpa error.
