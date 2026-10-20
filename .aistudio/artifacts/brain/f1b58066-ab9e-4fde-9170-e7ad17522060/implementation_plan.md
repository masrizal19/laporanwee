# Implementation Plan - LaporanWee SPA Layout Refinement

Refine and polish the Single Page Application (SPA) layout of LaporanWee to precisely match the reference HTML prototypes (`Dashboard_4eab7aa7.html`, `LOGIN_067ba398.html`) and screenshots (`image_02bb39eb.png`, `image_63e08bbe.png`).

## Proposed Changes

### 1. Design System & CSS Refinement (`src/redesign.css`, `src/index.css`)
- Ensure exact CSS variables (`--bg1`, `--bg2`, `--ink`, `--muted`, `--glass`, `--glass-solid`, `--line`, `--dark`, `--lime`, `--lav`, `--lav-deep`, `--shadow`).
- Precise positioning of the floating glass sidebar rail (`.rail`) with sliding pill indicator (`.pill`), expanded text labels on hover, and responsive bottom dock on mobile.
- Perfect 12-column bento grid for the Dashboard matching the reference proportions, spacing, and border radii (`30px` cards, `22px` inner containers).
- Smooth ambient background drifting blur blobs.

### 2. Dashboard View Polish (`src/views/DashboardView.tsx`)
- Match the exact header greeting ("Selamat pagi, Admin!"), KPI blocks (Proyek Aktif, Tugas Berjalan, Tingkat Selesai %), and "Buat Laporan" button.
- Bento cards:
  - "Tugas Berjalan" with interactive checkbox items and assignee avatar stack.
  - "Aktivitas Hari Ini" timeline bar chart with hourly columns (07:00 - 14:00) and vertical pulsating now-line.
  - "Tingkat Selesai" radial progress SVG circle.
  - "Kemajuan Divisi" interactive spline chart with tooltip and hover points.
  - "Pekerjaan & Proyek Terkini" grid with filter tabs ("Semua", "On-Track", "Berisiko").
- Quick report creation modal matching reference design.

### 3. Authentication & Profile Views Alignment
- Align Login/Register screen card with reference layout, input styling, password strength meter, and demo auto-fill box.
- Ensure zero regression on all backend integrations (MySQL API endpoints, dual-network fallback to localStorage cache).

## Verification Plan
- Run `compile_applet` and `lint_applet` to ensure zero build errors or TypeScript issues.
- Visually verify that the layout, sidebar rail, bento cards, and typography match the reference screenshots and HTML prototypes.
