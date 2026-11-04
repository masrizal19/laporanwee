# Standalone Crop Modal Topology (`SettingProfilePictureModal.tsx`) Implementation Plan

Implementation plan to build a clean standalone profile picture cropping modal (`SettingProfilePictureModal.tsx`) matching the user's reference design (`/public/assets/aistudio/image_74244e1b.png`), connect it to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php` via GET and POST, synchronize route URL `/profil/setting-profile-picture` to `/profil`, and connect it to `ProfileSettingsView.tsx`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed during Phase 1 interactive clarification:

- **Confirmed Modal Trigger**: Display a clean "Ubah Foto" button at the top of the profile settings form in `ProfileSettingsView.tsx` which opens `SettingProfilePictureModal.tsx` (`isCropOpen = true`) and pushes browser route `/profil/setting-profile-picture`.
- **Confirmed Initial Avatar Fallback**: If the server GET endpoint has no existing avatar image, fallback cleanly to a dynamic canvas initial placeholder (`createInitialsAvatar`).

---

## 1. Overview & Core Concept

- **What It Does**: Replaces all old cropper references with `SettingProfilePictureModal.tsx`—a standalone, portal-rendered crop modal. The modal features:
  - Header with title "Edit Foto Profil", description, and close button (`X`).
  - Large main circular cropping stage alongside 3 circular preview sizes (L: 72px, M: 44px, S: 28px) labeled "Pratinjau".
  - Quick action buttons: "Putar" (rotate 90°) and "Balik" (horizontal flip).
  - Three fine-tuning sliders: Zoom (100%–300%), Kiri-Kanan pan, and Atas-Bawah pan.
  - "Pilih Foto Baru" button + "Reset" and "Simpan Foto" action buttons.
  - Automatic URL route sync: URL updates to `/profil/setting-profile-picture` on modal open and restores to `/profil` on close or save.
  - Direct GET & POST integration with `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.
- **Target Audience / Persona**: Application users updating their profile pictures in real time.
- **Key Value**: Modular, isolated crop topology matching the user's reference mockup with zero legacy code or mock stubs.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. In `ProfileSettingsView.tsx`, user clicks the "Ubah Foto" button placed above the form fields.
  2. `isCropOpen` is set to `true`, `SettingProfilePictureModal` opens, and URL changes to `/profil/setting-profile-picture`.
  3. Modal issues GET request to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php` with `Authorization: Bearer <token>` to load existing avatar picture (or falls back to user initials).
  4. User adjusts crop via stage gestures, D-pad, orientation buttons (Putar / Balik), or pan/zoom sliders.
  5. User clicks "Simpan Foto":
     - Canvas exports 512x512 JPEG Blob (0.92 quality).
     - Asynchronous POST to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php` with `FormData` (`avatar` blob).
     - On success: returns `avatar_url`, appends `?t=${Date.now()}` cache-buster, updates `avatarUrl` state in `ProfileSettingsView`, dispatches `laporanwee-profile-updated`, closes modal, and restores URL to `/profil`.
     - On error: displays Toast message and unlocks "Simpan Foto" button.

- **Visual Identity & Theme**:
  - Modal container: rounded-3xl (`36px`) glass surface, backdrop blur (`10px`), clean dark action buttons (`#23212e`), lime accent buttons (`#d4ee6b`).
  - Strict adherence to reference layout (`/public/assets/aistudio/image_74244e1b.png`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: New Dedicated Component File `SettingProfilePictureModal.tsx`**
  - *Chosen Approach*: Create a new file `src/components/SettingProfilePictureModal.tsx` to completely isolate the standalone crop modal logic.
  - *Why*: Guarantees zero residual dependencies on legacy cropper files or obsolete mock states.

- **Decision 2: Direct REST Endpoint Integration**
  - *Chosen Approach*: `SettingProfilePictureModal.tsx` directly performs GET and POST requests against `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.
  - *Why*: Direct alignment with backend specification without proxy or intermediate mock layers.

---

## 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ProfileSettingsView                         │
│  - Form fields for name, email, job, status                     │
│  - "Ubah Foto" button triggers isCropOpen = true                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SettingProfilePictureModal                     │
│  1. GET https://api-laporanwe.mkverse.my.id/api/profile/        │
│     setting-profil-picture/index.php                            │
│  2. Interactive 512x512 Canvas Cropper (Zoom, Pan, Rotate, Flip)│
│  3. POST FormData to setting-profil-picture/index.php           │
│  4. Returns avatar_url -> cache-buster ?t=${Date.now()}         │
│  5. pushState('/profil') -> onClose()                           │
└─────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  1. `src/components/SettingProfilePictureModal.tsx` (New Component):
     - Props: `isOpen`, `initialSrc`, `userName`, `userEmail`, `onClose`, `onSaved`, `onError`.
     - Uses `createPortal` to mount onto `document.body`.
     - Handles route pushState to `/profil/setting-profile-picture` on open and `/profil` on close.
     - GET & POST handlers for `setting-profil-picture/index.php`.
  2. `src/views/ProfileSettingsView.tsx`:
     - Adds `isCropOpen` state.
     - Places an avatar preview header section with an "Ubah Foto" button above the form fields.
     - Mounts `<SettingProfilePictureModal isOpen={isCropOpen} ... />`.
  3. `src/App.tsx`:
     - Keeps `/profil/setting-profile-picture` recognized as a valid path pointing to `'profil'`.

---

## 5. Completed Tasks: Direct Route & Backend Profile Crop Setting Integration
- **Removed React Crop Modal**: Completely removed `<SettingProfilePictureModal />` / `<ProfileCropModal />` call and state from `ProfileSettingsView.tsx`.
- **Direct Navigation to Backend Crop Setting**:
  - In `ProfileSettingsView.tsx`: Button "Ubah Foto" and the avatar preview circle navigate directly via `window.location.href = 'https://api-laporanwe.mkverse.my.id/api/profile/profile-crop-setting.php'`.
  - In `ProfileView.tsx`: Avatar click and pencil edit icon (`.pen`) navigate directly via `window.location.href = 'https://api-laporanwe.mkverse.my.id/api/profile/profile-crop-setting.php'`.
- **Fullscreen Route at `/profil/setting-profile-picture`**:
  - In `App.tsx`: Route `/profil/setting-profile-picture` renders a dedicated fullscreen iframe view of `https://api-laporanwe.mkverse.my.id/api/profile/profile-crop-setting.php` with a top bar including a "Kembali ke Profil" navigation button and "Buka Langsung ↗" link.

## 6. Completed Tasks: Public Team Member Profile View Redesign (Glassmorphism Card)
- **Container Structure**:
  - Implemented glassmorphism card container (`width: min(680px, 94%)`, `background: var(--glass-solid, rgba(255, 255, 255, 0.95))`, `backdropFilter: blur(22px) saturate(1.3)`, `borderRadius: 32px`, `border: 1px solid var(--line)`, `boxShadow: 0 24px 60px -20px rgba(60, 50, 110, 0.15)`).
- **Top Header Widget**:
  - 68px circular avatar with `boxShadow: 0 0 0 4px rgba(255, 255, 255, 0.9)`.
  - Replaced legacy square black SVG (`<rect fill="%23222222"/>`) with dynamic `#cfc6f4` to `#d4ee6b` gradient background and bold uppercase initials.
  - Rendered uppercase full name (`19px`, `fontWeight: 700`), subtitle (`email • PEKERJAAN`), and role badge pill (`Anggota Tim`).
- **Profile Information Section**:
  - Eyebrow "INFORMASI", header "Informasi Profil", description "Identitas resmi anggota tim di LaporanWee Studio Creative."
- **Display Cards**:
  - 3 rounded modern read-only boxes (`height: 62px`, `borderRadius: 18px`) for "Nama Lengkap", "Email", and "Pekerjaan".
- **Pill Tags with Lime Highlight (`#d4ee6b`)**:
  - `PILIH PEKERJAAN` tags: `['EDITOR', 'VIDEO EDITOR', 'Desainer Grafis', 'Art Director', 'Copywriter', 'Social Media']` with active highlighted tag styled with `#d4ee6b` background, `#23212e` dark text, `fontWeight: 700`, and soft lime glow.
  - `STATUS TIM` tags: `['Karyawan', 'Anak Magang', 'Anak PKL']` with selected status highlighted with `#d4ee6b`.
- **Navigation Action**:
  - Top back arrow link and bottom dark pill button "Kembali ke Tim" with smooth navigation callback to `onNavigate('team')`.
- **Created Alias**:
  - `src/views/PublicProfileView.tsx` re-exporting `UserProfileView`.
- **Verification**:
  - `lint_applet` passed (`tsc --noEmit` zero errors).
  - `compile_applet` succeeded (`npm run build` clean output).

## 7. Completed Tasks: Team Attendance Compact 2-Column Grid & Minimize Feature (`TeamAttendanceWidget.tsx`)
- **Dedicated Component**:
  - Created `src/components/TeamAttendanceWidget.tsx` with collapsible header, quick status badge (`🟢 {onlineCount} Online · ⚪ {offlineCount} Offline`), and 2-column member grid layout.
- **Card Header & Minimize Toggle**:
  - Animated chevron button rotates 180° on toggle with smooth max-height/opacity transition.
  - When collapsed/minimized, displays compact status pill in header to maintain glanceable visibility without occupying vertical height.
- **Compact 2-Column Grid**:
  - Two distinct sections: "Sedang Bekerja Online" (emerald pulse dot) and "Offline" (slate gray dot).
  - 2-column grid (`grid grid-cols-2 gap-2.5`) with 36px mini avatars, online status indicator dots, truncated bold member names, uppercase job titles, and status types.
  - Scroll container capped at `max-h-[380px]` with slim scrollbar for long member rosters.
- **Integration**:
  - Replaced long 1-column list on the right column of `src/views/TeamView.tsx` with `<TeamAttendanceWidget />`, restoring visual balance to the team activity stream layout.
  - Also embedded `<TeamAttendanceWidget />` into the 12-column bento grid in `src/views/DashboardView.tsx` with `onSelectUserProfile` navigation callback.
- **Verification**:
  - `lint_applet` passed (`tsc --noEmit` clean).
  - `compile_applet` succeeded (`npm run build` zero errors).

## 8. Completed Tasks: Report Card Detail & Edit Navigation Bugfix (`ReportsView.tsx` / `App.tsx`)
- **Root Cause Analysis**:
  - `handleSelectReport` in `src/App.tsx` was only setting state `selectedReportId` without updating `currentView` to `'report-detail'` and without navigating to `/laporan/detail?id=...`.
  - In `src/views/ReportsView.tsx`, the card item only invoked `onSelectReport(r.id)` without a secondary `onNavigate('report-detail')` fallback.
- **Card Click & Accessibility Fix**:
  - Added dedicated `handleOpenDetail` handler in `ReportsView.tsx` executing `onSelectReport(String(report.id))` and `onNavigate('report-detail')`.
  - Applied `cursor-pointer`, `tabIndex={0}`, `role="button"`, `aria-label`, and keyboard support (`onKeyDown` for Enter & Space) on the `<article>` card wrapper.
  - Kept `e.stopPropagation()` strictly on the delete button to prevent triggering report detail view upon clicking delete.
- **Role Permission Validation**:
  - Confirmed viewing report details has zero role gating; both Administrator and regular Users can open and inspect report details smoothly.
- **Routing & State Synchronization**:
  - In `src/App.tsx`:
    - Updated `handleSelectReport` to set `currentView` to `'report-detail'` and navigate to `/laporan/detail?id=${cleanId}`.
    - Updated `handleNavigateToReportEdit` to navigate to `/laporan/detail/edit-laporan?id=${cleanId}`.
    - Added `/laporan/detail` to `validPaths`, `pathToViewMap`, and `viewToPathMap`.
    - Added URL search parameter `?id=...` extraction for deep linking and refreshing `/laporan/detail`.
  - In `src/views/ReportDetailView.tsx`:
    - Added fallback resolution for `effectiveReportId` checking query parameter `?id=...` and localStorage.
  - Created `src/views/LaporanView.tsx` as an alias re-exporting `ReportsView`.
- **Verification**:
  - `lint_applet` passed (`tsc --noEmit` 0 errors).
  - `compile_applet` passed clean build.

