# Implementation Plan - Integrasi UISettings Engine & Verifikasi Audit Akhir (LaporanWee v5.0)

Menggabungkan skrip `UISettings` (Instant Render & Theme Engine) ke dalam `src/utils/uiSettings.ts` untuk mengelola sinkronisasi tema, warna kustom, dan pembacaan `localStorage` secara instan (*zero-flash rendering*), diikuti oleh verifikasi audit akhir sistem LaporanWee v5.0.

---

## 1. Rencana Perubahan pada `src/utils/uiSettings.ts`

1. **Penggabungan Engine `UISettings`**:
   - Menambahkan objek/utilitas `UISettingsEngine` ke dalam `src/utils/uiSettings.ts`.
   - Mengisi nilai default (`primary_color`, `secondary_color`, `text_color`, `background_color`, `card_bg`, `border_color`, `theme_mode`).
   - `applyCachedSettings()`: Membaca cache `app_ui_settings` atau `localStorage('theme')` secara instan sebelum network request selesai untuk mencegah *screen flash*.
   - `setTheme(theme)`: Mengubah `document.documentElement.dataset.theme`, memperbarui knob animasi theme switcher, dan mengirimkan update ke endpoint backend `/api/ui-settings.php` atau `/api/profile/settings.php` secara non-blocking di latar belakang.
   - `fetchSettings()`: Mengambil setelan visual terbaru dari API backend dan memperbarui `localStorage`.

2. **Integritas Komponen UI**:
   - Memastikan `Navbar.tsx` dan `App.tsx` memanggil dan memanfaatkan fungsi `UISettingsEngine` dengan mulus.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Perbarui `src/utils/uiSettings.ts` dengan menyematkan objek utilitas `UISettingsEngine` / `UISettings` instan.
2. **Langkah 2**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build sukses 100% tanpa error.

---

## 3. Rencana Pengujian (Verification Plan)

- **Uji Instant Render & Theme Toggle**: Klik tombol toggle tema di Top Bar dan verifikasi perubahan mode light/dark instan tanpa delay.
- **Uji Cache LocalStorage**: Muat ulang halaman dan pastikan tema langsung membaca dari `localStorage` tanpa kedip (*zero-flash*).
- **Uji Kompilasi**: `compile_applet` dan `lint_applet` lulus tanpa error.
