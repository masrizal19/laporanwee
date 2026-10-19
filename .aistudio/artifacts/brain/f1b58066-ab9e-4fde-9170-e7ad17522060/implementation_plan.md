# Implementation Plan - Audit & Desain Ulang Total LaporanWee UI 5.0 (Zero-Distortion & Neo-Glass Bento)

Mentransformasikan seluruh antarmuka web LaporanWee ke standar visual modern **v5.0 (Neo-Glass Bento & Zero-Distortion)** dari halaman autentikasi (Login/Register/Verify) hingga ke seluruh modul kerja harian, dengan sistem tema dinamis (Light & Dark Mode), floating rail navigation, visual hierarchy terstruktur, dan kepatuhan mutlak terhadap aturan anti-gepeng/anti-distorsi tanpa mengubah payload API atau relasi database.

---

## 1. Arsitektur Desain & Token Sistem UI 5.0

### A. Font & Tipografi
- Memuat Google Font **Outfit** (bobot 300, 400, 500, 600, 700) pada `index.html`.
- Tipografi hirarki jelas: Sapaan Headline (Outfit 500, clamp 28px - 46px), Subjudul bersih (13px - 15px), Angka KPI tabular (Outfit 400, 40px - 44px).

### B. Color Tokens & Surface Glass (Light & Dark)
```css
:root {
  --bg1: #e6e5ec; --bg2: #f1f0f5; --ink: #1f1d2b; --muted: #8b8898;
  --glass: rgba(255, 255, 255, 0.62); --glass-solid: rgba(255, 255, 255, 0.92);
  --line: rgba(31, 29, 43, 0.08); --dark: #23212e; --on-dark: #ffffff;
  --lime: #d4ee6b; --lime-soft: #e9f5b8; --lav: #d9d3f5; --lav-deep: #8f7fe0;
  --peach: #f6e6cf; --mint: #d6ecdf; --pink: #f1d8e4;
  --blob1: rgba(176, 160, 240, 0.55); --blob2: rgba(244, 214, 170, 0.6);
  --shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 24px 48px -28px rgba(60, 50, 110, 0.35);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --rail: 84px; --rail-open: 236px;
}
[data-theme="dark"] {
  --bg1: #14131b; --bg2: #1b1a24; --ink: #f2f0fa; --muted: #8d8aa0;
  --glass: rgba(40, 38, 54, 0.65); --glass-solid: rgba(46, 44, 62, 0.94);
  --line: rgba(255, 255, 255, 0.08); --dark: #f2f0fa; --on-dark: #1f1d2b;
  --lime-soft: rgba(212, 238, 107, 0.18); --lav: #3b3560;
  --peach: #4a3d33; --mint: #2f4a3e; --pink: #4a3342;
  --blob1: rgba(110, 90, 200, 0.4); --blob2: rgba(200, 140, 80, 0.22);
  --shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 24px 50px -30px rgba(0, 0, 0, 0.7);
}
```

### C. Efek Latar Belakang Ambient Glow
- Menambahkan kontainer `.ambient` dengan 3 elemen blob gradien yang berotasi dan bergerak melayang halus di seluruh aplikasi (auth, dashboard, dan modul dalam).

---

## 2. Aturan Baku Anti-Gepeng & Anti-Distorsi (Zero-Distortion)

1. **Avatar & Thumbnail**:
   - Seluruh avatar, icon box, dan gambar berformat thumbnail (`.thumb`, `.avatar`, `.stack i`) wajib menggunakan `flex-shrink: 0`, `object-fit: cover`, dan dimensi proporsional yang terkunci (`aspect-ratio: 1/1`).
2. **Text Ellipsis & Flex Child Overflow**:
   - Seluruh kontainer teks di dalam flexbox (`.tx`, `.card-body`, text wrappers) wajib memiliki `min-width: 0` dan pemotongan rapi agar judul tugas atau deskripsi panjang tidak mendorong layout keluar batas layar.
3. **SVG & Ikon Vektor**:
   - Seluruh elemen ikon SVG memiliki atribut `viewBox`, `preserveAspectRatio="xMidYMid meet"`, dan ukuran terkunci (18px-24px).
4. **Grafik & Visualisasi**:
   - Wave line chart membungkus container dengan rasio aspek terkunci (`preserveAspectRatio="none"` pada svg dinamis ber-viewBox), serta ring progress radial berdimensi `180px x 180px` (`viewBox="0 0 180 180"`).

---

## 3. Rincian Pembaruan Per Modul

### A. Autentikasi (LoginView, RegisterView, VerifyEmailView)
- Format kartu melayang Bento stage (`.stage`) di tengah layar dengan radius 44px, efek blur 28px, dan ambient glow.
- **Desktop Grid 3-Kolom**:
  1. *Side Tab Mini* (lebar 96px) dengan logo dark icon, sliding pill indicator, dan tombol beralih Masuk/Daftar.
  2. *Art Panel Ilustrasi* (linear gradient lavender-peach halus) dengan floating mini-cards (Rebranding Kopi Nusa progress bar, avatar stack laporan terkirim, radial mini-ring 82% selesai).
  3. *Form Panel*: Input field tinggi 54px dengan border radius 19px, ikon eye show/hide password, live password strength meter (4 bar strip berwarna), checkbox Ingat Saya kustom, tombol submit beranimasi spinner, dan box akun demo auto-fill.
- **Mobile (<940px)**:
  - Art panel disembunyikan otomatis, side tab berubah menjadi pill atas yang ringkas, form panel memenuhi lebar layar tanpa scroll horizontal.

### B. Shell Aplikasi (Floating Rail Navigation & Top Bar)
- **Floating Rail Sidebar (Desktop)**:
  - `position: fixed; inset: 14px auto 14px 14px; width: 84px; border-radius: 32px;`
  - Membuka mulus ke `236px` saat kursor didekatkan (hover) menggunakan transisi `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Sliding pill indicator gelap yang mengikuti menu aktif secara halus.
  - Tombol logout di bagian bawah rail.
- **Mobile Navigation (<860px)**:
  - Otomatis bertransformasi menjadi floating bottom dock pill di bagian bawah layar (`inset: auto 12px 12px 12px`), glassmorphism, ramah sentuhan jari.
- **Top Bar**:
  - Breadcrumb halaman aktif di sisi kiri.
  - Sisi kanan: Theme Switcher pill (Light/Dark sliding toggle), Quick Search round button (44px), dan Avatar Pengguna bulat dengan ring border halus.

### C. Dashboard Utama (DashboardView)
- **Greeting Header**:
  - Sapaan hangat ("Selamat pagi, [Nama]!") dengan teks subjudul motivasi.
  - 3 Metrik KPI Mikro inline: Proyek Aktif, Tugas Berjalan, Tingkat Selesai (animasi counter angka besar 40px).
  - CTA "+ Buat Laporan" berbentuk pill gelap berbayang lembut.
- **Bento Grid 12-Kolom**:
  - **Row 1 Kiri (span 5)**: *Tugas Berjalan* — To-do checklist interaktif dengan checkbox lingkaran, animasi coret teks saat selesai, dan avatar assignees bertumpuk rapi di kanan.
  - **Row 1 Kanan (span 7)**: *Aktivitas Hari Ini* — Timeline horizontal 07:00 - 14:00 dengan blok event berwarna (lime, lav, neutral), stack avatar tim, dan nowline vertikal beranimasi denyut (*pulsing dot*).
  - **Row 2 Kiri (span 4)**: *Tingkat Selesai* — Radial progress ring SVG dengan gradien lime ke lavender dan persentase 82% di tengah.
  - **Row 2 Kanan (span 8)**: *Kemajuan Divisi* — Smooth wave spline chart (Cubic Bezier curve) dengan area gradient fill dan interactive hover tooltip yang mendeteksi posisi titik kursor secara presisi.
  - **Row 3 (span 12)**: *Pekerjaan & Proyek Terkini* — Grid kartu proyek bento 3-kolom dengan tag status berwarna, progress bar animasi, dan avatar tim.

### D. Modul Proyek (ProjectsView)
- Tab filter pill melayang dengan background slider yang bergeser mulus (*Semua, On-Track, Berisiko*).
- Grid kartu proyek bento auto-fit yang responsif dan anti-gepeng.
- Tombol "+ Buat Laporan / Tambah Proyek".

### E. Modul Tugas (TasksView)
- Kanban Board 4-kolom responsif: *To Do, Sedang Dikerjakan, Dalam Review, Selesai*.
- Kartu tugas bento dengan badge tanggal rapi, judul tebal, pemotongan teks tanpa overflow, dan avatar assignees.

### F. Modul Laporan (ReportsView & ReportDetailView)
- Tabel list row modern dengan thumbnail preview bergradien lembut di kiri (52px x 52px, radius 16px, `flex-shrink: 0`), judul deliverable tebal, tanggal pelaporan, dan status badge pill.
- Filter tanggal & status instan.

### G. Modul Sosial Media, Tim, Kalender & Analitik
- **Sosial Media**: Kartu bento 4 platform (Instagram, TikTok, YouTube, LinkedIn) dengan latar pastel halus, angka KPI tebal, dan persentase pertumbuhan.
- **Tim**: Grid kartu anggota tim dengan avatar 58px x 58px anti-gepeng, jabatan, dan progress bar beban kerja.
- **Kalender**: Grid 7-kolom terkunci (Sen - Min) dengan `min-height: 84px`, highlight hari ini, dan pill badges jadwal kerja.
- **Analitik**: Bar chart vertikal dengan rounded top (14px 14px 6px 6px), warna selang-seling lavender dan lime untuk minggu M1 - M8.

### H. Modal & Global Toast
- Modal dialog melayang dengan glassmorphism, backdrop blur 10px, input field ber-radius 16px, dan tombol aksi tegas.
- Global toast pill melayang di tengah bawah layar.

---

## 4. Rencana Langkah Kerja (Implementation Steps)

1. **Langkah 1: Setup Font & Token CSS Global v5.0**
   - Tambahkan link font Google **Outfit** di `index.html`.
   - Perbarui `src/index.css` dengan Design System Token v5.0, class `.ambient`, `.rail`, `.top`, `.theme`, `.bento`, `.grid`, dan aturan baku Zero-Distortion.
2. **Langkah 2: Transformasi Shell Navigasi & Header**
   - Perbarui `src/components/Navbar.tsx` menjadi Floating Rail Navigation (desktop auto-expand hover 84px $\rightarrow$ 236px) dan Bottom Dock Pill untuk mobile, lengkap dengan Theme Switcher dan Topbar breadcrumb.
3. **Langkah 3: Desain Ulang Halaman Autentikasi**
   - Refaktor `src/views/LoginView.tsx` dan `src/views/RegisterView.tsx` dengan stage bento card 3-kolom, Outfit font, password meter, dan responsivitas mobile tanpa glitch.
4. **Langkah 4: Desain Ulang Dashboard Utama (Bento v5.0)**
   - Perbarui `src/views/DashboardView.tsx` dengan greeting KPI, interactive to-do list, timeline horizontal, radial progress ring, dan wave chart interaktif.
5. **Langkah 5: Penyelarasan Modul Fitur (Proyek, Tugas, Laporan, Tim, Kalender, Sosial Media, Analitik)**
   - Sesuaikan tampilan kartu, filter slider, dan grid di modul terkait agar seragam dengan estetika Neo-Glass Bento v5.0.
6. **Langkah 6: Verifikasi & Kompilasi**
   - Jalankan `compile_applet` dan `lint_applet` untuk memastikan seluruh perubahan bebas error TypeScript, fungsionalitas API tetap berjalan 100%, dan tata letak responsif sempurna.

---

## 5. Rencana Pengujian (Verification Plan)

- **Uji Layout & Zero-Distortion**:
  - Periksa seluruh avatar (`.avatar`, `.thumb`, `.stack i`) pada layar desktop, tablet, dan mobile — pastikan rasio aspek 1:1 bulat sempurna tanpa gepeng.
  - Periksa judul-judul panjang pada kartu tugas dan proyek — pastikan terpotong dengan ellipsis rapi tanpa mendorong layout keluar layar.
- **Uji Tema Light/Dark**:
  - Ganti tema menggunakan Theme Switcher dan verifikasi seluruh kontras teks, surface glass, dan border lines terlihat jelas dan elegan.
- **Uji Interaktivitas**:
  - Hover rail sidebar untuk memastikan ekspansi halus ke 236px dan sliding pill indicator bergerak akurat.
  - Klik to-do list tugas berjalan untuk memeriksa animasi coret dan centang.
  - Hover titik-titik pada grafik Kemajuan Divisi untuk memastikan tooltip data muncul dinamis.
- **Uji Integritas API & Backend**:
  - Pastikan pengiriman laporan, pembaruan status, dan seluruh endpoint API backend MySQL tetap berjalan normal tanpa gangguan.
- **Uji Kompilasi**:
  - Verifikasi kelulusan `compile_applet` dan `lint_applet`.
