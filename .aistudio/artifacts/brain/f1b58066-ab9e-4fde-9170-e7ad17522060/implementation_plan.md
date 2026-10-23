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

## 5. Completed Tasks: Real-time Preview Synchronization & Transform Topology
- **Single Reusable Transform**: Computed `sharedTransform` combining scale (`zoom`), pan translate (`offsetX`, `offsetY`), `rotate(${rotation}deg)`, and horizontal flip (`scaleX(-1)`).
- **Synchronous Rendering Across All Previews**: Applied `sharedTransform` and `transformOrigin: 'center center'` to both the main 280px circle and the 3 preview circles (72px, 44px, 28px).
- **State-driven Putar & Balik**: Eliminated DOMException tainted-canvas issues from in-memory rasterization by transitioning orientation to reactive state transforms.
- **Matched 512x512 Canvas Export**: Applied the matching affine transformations in `handleSave` so backend uploads (`avatar` JPEG blob 0.92) preserve exact pan, zoom, rotation, and flip.
- **Verification**: Verified with `tsc --noEmit` (0 lint/type errors) and `npm run build` (successful compilation).

