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
- **Universal Proportional Transform (`getSharedTransform`)**: Computed `scaleVal = zoom * scaleMultiplier`, `tx = (offsetX * scaleMultiplier) / zoom`, and `ty = (offsetY * scaleMultiplier) / zoom` with CSS `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scaleVal}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`.
- **Proportional Scaling for 3 Previews**: Passed `scaleMultiplier = size / STAGE_SIZE` (where STAGE_SIZE = 280) to the 72px, 44px, and 28px preview containers so the crop framing is 100% identical and moves in absolute real-time lockstep with the main stage.
- **Stage & Preview Absolute Centering**: Implemented `position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', objectFit: 'cover'` inside circular `overflow: 'hidden'` containers.
- **Matched 512x512 Canvas Export**: Applied exact matching affine matrix transformations in `handleSave` (`translate(256 + offsetX * (512 / STAGE_SIZE), 256 + offsetY * (512 / STAGE_SIZE))`, `scale(zoom, zoom)`, `rotate`, `scaleX(-1)`) with `coverScale = Math.max(512 / natW, 512 / natH)`.
- **Active Profile Photo Binding**: Linked `currentAvatarUrl` directly on modal open and reset, ensuring the active MySQL profile picture appears immediately upon opening.
- **Verification**: Verified with `tsc --noEmit` (0 lint/type errors) and `npm run build` (successful compilation).

