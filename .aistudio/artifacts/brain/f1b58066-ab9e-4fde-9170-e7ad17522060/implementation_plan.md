# Implementation Plan - Print Preview & Document Recap Modal in AnalyticsView

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Print Preview Modal ("PREVIEW CETAK & DOKUMEN REKAP")**: When the user clicks "Ekspor Laporan (PDF)" in the Analytics menu, a modal opens displaying an A4 portrait preview sheet with a top action toolbar.
> - **Modal Toolbar (Header)**:
>   - Left: Green dot + bold text: `"PREVIEW CETAK & DOKUMEN REKAP"` + Pill badge (`"A4 • PORTRAIT • [Jumlah] Laporan"`).
>   - Right: Month selector (Jan-Des), Year selector (2025-2027), and action buttons:
     - 🖨️ Cetak / Save PDF (triggers print)
     - 🖼️ Export JPEG (downloads JPG or triggers backend export)
     - 📊 Excel (downloads .xls)
     - 📄 Word (downloads .doc)
     - ✕ (close modal)
- **Modal Body**: Dark/neutral background with smooth scroll, centering a high-fidelity A4 white paper sheet rendering the official Wee Laporan HTML template (blue header, brand dots, period info, 4-week tables, item rows with evidence shots, social media recap, and sign-off).
- **Zero Disruption to Existing Metrics**: All statistics cards, efficiency charts, and weekly summaries on the main Analytics page remain intact.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a polished, professional print preview dialog matching the user's reference design when exporting reports from the Analytics menu.
- **Key Value**: Allows users to preview the exact document layout before printing or exporting to PDF, Excel, Word, or JPEG.

---

## 2. Technical Design & Components

- **State in `AnalyticsView.tsx`**:
  - `isPreviewModalOpen: boolean`
  - `selectedMonth: number` (default 10)
  - `selectedYear: number` (default 2026)
- **Modal Structure**:
  - Backdrop with blur (`bg-black/60 backdrop-blur-sm`, `will-change: opacity`).
  - Container box (`max-w-4xl w-full bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`).
  - Top Toolbar matching the reference screenshot.
  - Scrollable preview area (`bg-slate-800 p-6 flex justify-center overflow-y-auto`).
  - A4 Paper Sheet rendering the provided HTML template with dynamic month/year binding.
- **Action Handlers**:
  - Print / Save PDF: `window.print()` or printing the preview container.
  - Excel / Word / JPEG: Triggers backend `export.php` download URL.

---

## 3. Verification Plan

- Compile with `compile_applet` and test modal opening, toolbar actions, and print preview rendering.
