# Implementation Plan - PDF & JPG Export with Portrait/Landscape A4 Template Preview

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Strictly PDF and JPG Options**: The export dropdown in AnalyticsView will feature two options:
     1. Export PDF (Cetak / Save PDF with orientation toggle)
     2. Export JPG (Download Image)
- **Portrait & Landscape A4 Support**: The preview modal toolbar will include an orientation toggle (`Portrait` vs `Landscape`), allowing users to switch the A4 sheet layout dynamically before printing or exporting.
- **Official HTML A4 Template**: The preview modal renders the exact high-fidelity Wee Laporan template structure provided by the user.
- **Hardware-Accelerated CSS & Motion**: Smooth dropdown animation, backdrop blur, and GPU-accelerated preview container (`will-change: transform, opacity`).

---

## 1. Overview & Core Concept

- **What It Does**: Streamlines the report export options to specifically PDF and JPG, adds an orientation switcher (Portrait / Landscape), and displays the official A4 document template in the preview modal.
- **Key Value**: Provides precise control over document export format and orientation while preserving all existing analytics cards and charts.

---

## 2. Technical Design & Changes in `AnalyticsView.tsx`

- **Export Dropdown**:
  - Options:
    - `"Cetak / Export PDF"` (opens modal in print preview mode)
    - `"Export Gambar (.jpg)"` (triggers JPG export URL or canvas capture)
- **Preview Modal Updates**:
  - Orientation Toggle State: `orientation: 'portrait' | 'landscape'` (default `'portrait'`).
  - Toolbar includes Portrait/Landscape toggle pill/buttons.
  - A4 Preview Sheet applies `@page` / CSS dimensions dynamically (`width: 210mm, height: 297mm` for portrait vs `width: 297mm, height: 210mm` for landscape).
  - Embeds the user's provided HTML template structure precisely.

---

## 3. Verification Plan

- Compile with `compile_applet` and test PDF/JPG export options and orientation switching.
