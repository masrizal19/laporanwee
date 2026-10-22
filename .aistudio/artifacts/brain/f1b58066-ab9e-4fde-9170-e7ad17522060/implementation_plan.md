# Rebuilding Profile Picture Cropper with Route `/profil/setting-profile-picture`

Implementation plan to re-architect the profile picture cropping interface based on `CROP SETTING_3.html`, connect it to browser routing `/profil/setting-profile-picture`, and integrate with the new REST API endpoint `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed during Phase 1 interactive clarification:

- **Confirmed Button Placement**: Place an "Ubah Foto Profil" action button directly in the profile settings header bar alongside the profile information title.
- **Confirmed Routing Behavior**: Direct access to `https://laporanwe.mkverse.my.id/profil/setting-profile-picture` automatically opens the cropping modal directly on top of the profile settings view.

---

## 1. Overview & Core Concept

- **What It Does**: Re-integrates the full-featured photo cropper UI (D-pad controls, 100%-300% zoom slider, rotation/flip tools, and 3-ring circular previews) into React using `ProfileCropModal.tsx`. Connects the modal state to URL routing `/profil/setting-profile-picture`, fetches initial avatar data from `setting-profil-picture/index.php`, and posts cropped 512x512 JPEG blobs to the new PHP backend with instant cache-busting.
- **Target Audience / Persona**: Users managing their account profile picture.
- **Key Value**: Smooth, resilient cropper UX with complete URL synchronization and real-time backend updates.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Opening Cropper**:
     - User clicks "Ubah Foto Profil" button next to "Informasi Profil" title bar, OR navigates directly to `/profil/setting-profile-picture`.
     - Browser URL updates to `/profil/setting-profile-picture` via `window.history.pushState({ modal: 'crop' }, '', '/profil/setting-profile-picture')`.
     - Initial GET fetch to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php` retrieves current `avatar_url` or uses initial starter canvas.
  2. **Interacting with Cropper**:
     - User pans photo using touch drag, cursor drag, or D-pad hold/step buttons.
     - User adjusts zoom (100%-300%), rotates, or flips photo.
     - 3 preview circles (72px, 44px, 28px) update in real-time.
  3. **Saving Cropped Avatar**:
     - User clicks "Simpan Foto" (#pc-save).
     - Canvas exports 512x512 JPEG (0.92 quality) to Blob.
     - Asynchronous POST sends FormData (`avatar`, blob) with Bearer token header.
     - On success: `avatar_url` receives `?t=${Date.now()}` cache-buster, React state & DOM update, modal closes, route restores to `/profil`, and a toast notification confirms update.
     - On failure: Toast displays error message, and `finally` block unlocks button state.
  4. **Closing Cropper**:
     - Clicking close (X), Cancel, Esc, or backdrop restores browser URL to `/profil`.

- **Visual Identity & Theme**:
  - `profile-edit.css` uses `.pc-*` class namespace.
  - `.pc-b.pc-load` enforces `pointer-events: auto;` so network glitches never freeze button interactions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: React Portal Modal with `ProfileCropModal.tsx`**
  - *Chosen Approach*: Render cropper modal via `createPortal` to `document.body` while keeping logic state in sync with `ProfileSettingsView.tsx`.
  - *Why*: Prevents parent container CSS transforms/backdrop-filters from clipping `position: fixed` overlays.

- **Decision 2: Dual Endpoint Compatibility (`upload.php` & `setting-profil-picture/index.php`)**
  - *Chosen Approach*: Point profile picture operations directly to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.
  - *Why*: Complies strictly with the master prompt API requirement.

---

## 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌──────────────────────────────────────────────────────────────────┐
│                      ProfileSettingsView                         │
│  - Displays "Informasi Profil" header + "Ubah Foto Profil" button│
│  - Listens to URL /profil/setting-profile-picture & popstate     │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ProfileCropModal                            │
│  1. GET setting-profil-picture/index.php -> initial avatar_url   │
│  2. Interactive Stage: D-Pad, Zoom Slider, Rotate, Flip, 3 Previews│
│  3. Save (#pc-save) -> 512x512 JPEG Blob -> FormData             │
│  4. POST setting-profil-picture/index.php + Bearer token         │
│  5. res.success -> avatar_url + ?t=${Date.now()} -> update state │
│  6. pushState /profil & close modal                              │
└──────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  1. `src/App.tsx`:
     - Map `/profil/setting-profile-picture` route to `profil` view.
  2. `src/profile-edit.css`:
     - Ensure `.pc-b.pc-load` has `pointer-events: auto;`.
  3. `src/components/ProfileCropModal.tsx`:
     - Incorporate CROP SETTING_3 cropper logic, canvas export, and POST fetch to `setting-profil-picture/index.php`.
  4. `src/views/ProfileSettingsView.tsx`:
     - Add "Ubah Foto Profil" button next to "Informasi Profil" header.
     - Add URL path detection for `/profil/setting-profile-picture`.
     - Fetch GET from `setting-profil-picture/index.php` on mount.
     - Pass handlers and props to `ProfileCropModal`.
