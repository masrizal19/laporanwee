# Implementation Plan - Main Domain Report Export & Edit Views

## User Requirements & Architecture
1. **Export/Preview Route (`/analitik/exporlaporan`)**:
   - Component: `src/views/ExportLaporanView.tsx`
   - Fullscreen dark UI with seamless iframe embedding `https://api-laporanwe.mkverse.my.id/api/analytics/export/index.php?month=${month}&year=${year}`.
   - Query parameters `month` and `year` parsed from URL search params (defaulting to current month/year if omitted).

2. **Admin Edit Design Route (`/analitik/editlaporan`)**:
   - Component: `src/views/EditLaporanView.tsx`
   - Admin-only protection: Checks authentication and admin role (`user.role === 'admin'` or `isAdmin`).
   - If unauthorized, displays an access denied message with a button back to `/analitik`.
   - If authorized, embeds backend editor iframe with active token: `https://api-laporanwe.mkverse.my.id/api/analytics/export/edit-export/index.php?month=${month}&year=${year}&token=${token}`.

3. **App Router (`src/App.tsx`)**:
   - Register route handlers for `currentView === 'export-laporan'` (matching `/analitik/exporlaporan`) and `currentView === 'edit-laporan'` (matching `/analitik/editlaporan`), as well as supporting URL hash / history pathname parsing so direct URL access works seamlessly.

4. **AnalyticsView Navigation**:
   - Update "Cetak / Export PDF" button to open `window.open('/analitik/exporlaporan', '_blank')`.
   - Update "🎨 Edit Desain Laporan" (admin only) button to open `window.open('/analitik/editlaporan', '_blank')`.

## Step-by-Step Implementation Steps
1. Create `src/views/ExportLaporanView.tsx`.
2. Create `src/views/EditLaporanView.tsx`.
3. Update `src/App.tsx` to handle route matching for `/analitik/exporlaporan` and `/analitik/editlaporan`.
4. Update `src/views/AnalyticsView.tsx` dropdown actions.
5. Compile and lint test.
