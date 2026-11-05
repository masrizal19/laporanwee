# Implementasi Navigation Menu & View 'Galeri Berkas' (/galeri-berkas)

Menambahkan menu navigasi **Galeri Berkas** di Sidebar, menghubungkan ke rute `/galeri-berkas` yang merender antarmuka Bento Grid lengkap dari `https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php` via iframe glassmorphism responsif, serta mengatur *redirect* otomatis dari rute lama `/galeri-lampiran` dan `/lampiran`.

## User Review & Decisions

> [!IMPORTANT] Keputusan yang telah dikonfirmasi pengguna:
- **Tampilan Container Galeri Berkas**: Floating glassmorphism card dengan sudut rounded (`rounded-3xl`) dan bayangan halus (`shadow-xl`) berukuran terkunci pas 1 layar penuh (`calc(100vh-24px)`).
- **Penanganan Rute Galeri Lama**: Mengalihkan secara otomatis (*redirect*) rute `/galeri-lampiran` dan `/lampiran` menuju rute resmi `/galeri-berkas`.

---

## 1. Overview & Core Concept

- **Tujuan Utama**: Menyediakan akses terpusat ke galeri bukti berkas, foto, video, dan dokumen proyek melalui menu samping yang bersih dan menyatu secara visual dengan tema LaporanWee.
- **Urutan Sidebar**: Menu "Galeri Berkas" dipasang presisi di antara menu **Proyek** (`/proyek`) dan **Laporan** (`/laporan`).
- **Integrasi Backend**: Memuat antarmuka `galeri-berkas.php` melalui iframe aman dengan dukungan penuh *clipboard*, *camera*, dan *microphone* untuk pengunggahan berkas.

---

## 2. User Experience & Visual Design

### Key User Flows
1. Pengguna mengklik menu **"Galeri Berkas"** di Sidebar.
2. Browser berpindah ke rute `/galeri-berkas`.
3. Tampilan merender kontainer floating glassmorphism berisi `iframe` yang memuat antarmuka Bento Grid Galeri Berkas lengkap.
4. Indikator menu aktif pada Sidebar menempel rapi pada item "Galeri Berkas".
5. Jika pengguna mengakses URL lama `/galeri-lampiran` atau `/lampiran`, sistem langsung mengalihkan ke `/galeri-berkas`.

### Visual Identity & Theme
- **Styling Container**: `bg-white/40 dark:bg-[#181622]/40 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-xl`.
- **Indikator Aktif Sidebar**: Warna kontras `#1e1d2b` (Light) / `#d4ee6b` (Dark) menempel presisi saat rute `/galeri-berkas` aktif.

---

## 3. Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App Routing (/App.tsx)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
  /proyek (Projects)      /galeri-berkas (Galeri)    /laporan (Reports)
                                    │
                                    ▼
                      ┌───────────────────────────┐
                      │    GaleriBerkasView.tsx   │
                      │  ┌─────────────────────┐  │
                      │  │  iframe (Bento Grid)│  │
                      │  │  galeri-berkas.php  │  │
                      │  └─────────────────────┘  │
                      └───────────────────────────┘
```

### Component & File Mapping

1. **`src/types.ts`**:
   - Menambahkan `'galeri-berkas'` ke dalam union type `ViewType`.

2. **`src/views/GaleriBerkasView.tsx`**:
   - Komponen view anyar berisi iframe responsif yang terkunci 1 layar penuh (`h-[calc(100vh-24px)]`).

3. **`src/components/Sidebar.tsx`**:
   - Menambahkan item `galeri-berkas` di dalam array `NAV_MENU_ITEMS` tepat di antara item `proyek` dan `laporan`.
   - Menggunakan ikon SVG galeri foto (`rect` + `circle` + `path`).

4. **`src/App.tsx`**:
   - Menambahkan `/galeri-berkas` ke `validPaths`, `pathToViewMap`, dan `viewToPathMap`.
   - Mengarahkan rute lama `/galeri-lampiran`, `/lampiran`, dan `/berkas` ke view `galeri-berkas`.
   - Mengimpor dan merender `<GaleriBerkasView />` saat `currentView === 'galeri-berkas'`.

5. **`src/views/LaporanView.tsx` & `src/views/ReportsView.tsx`**:
   - Memastikan tombol lime bekas `"FILE BERKAS LAPORAN"` bersih tanpa sisa.

---

## 4. Verification Plan

1. **Pengujian Kompilasi**:
   - Menjalankan `compile_applet` dan `lint_applet` (`tsc --noEmit`) untuk memastikan 0 error TypeScript.
2. **Pengujian Visual & Navigasi**:
   - Memeriksa Sidebar untuk urutan menu: Dashboard ➔ Proyek ➔ Galeri Berkas ➔ Laporan ➔ Tugas ➔ ...
   - Verifikasi iframe memuat `https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php` dengan mulus.
   - Verifikasi pengalihan otomatis dari URL `/galeri-lampiran` menuju `/galeri-berkas`.
