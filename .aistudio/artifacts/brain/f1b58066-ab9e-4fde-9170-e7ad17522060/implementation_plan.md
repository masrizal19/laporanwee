# Unlocking Profile Crop Save Button & Backend Integration Plan

Implementation plan to unlock the "Simpan Foto" button in the crop modal, connect canvas export to `https://api-laporanwe.mkverse.my.id/api/profile/upload.php`, apply timestamp cache-busting, and synchronize React state across `ProfileCropModal.tsx`, `ProfileSettingsView.tsx`, and `profile-edit.css`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed during Phase 1 interactive clarification:

- **Confirmed Error Handling**: Upon backend error or network issue, display an informative Toast notification and unlock the "Simpan Foto" button so the user can re-try immediately without stuck loading spinners.
- **Confirmed File Naming**: Retain the original filename from the user's selected file or construct a file string based on the user's uploaded filename (`avatar_${Date.now()}.jpg` / selected file name) for FormData upload.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves the issue where clicking "Simpan Foto" (#pc-save) in the profile crop modal gets stuck in a loading state or uses mock timers. Replaces mock logic with a real asynchronous flow: renders 512x512 JPEG canvas blob, posts via FormData with Bearer authentication to `upload.php`, appends `?t=${Date.now()}` cache-buster to the returned URL, updates profile avatar state instantly, closes the modal, and resets the URL path to `/profil`.
- **Target Audience / Persona**: Application users and administrators managing their profile pictures.
- **Key Value**: Instant real-time profile picture update without browser image stale-cache lockups or button freezing.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. User opens crop modal (`/profil/ubahfoto`) by clicking "Ubah Foto" or avatar icon in `ProfileSettingsView.tsx`.
  2. User adjusts pan/zoom/rotation using D-pad or gestures.
  3. User clicks "Simpan Foto":
     - Button displays loading indicator while `.pc-b.pc-load` CSS permits pointer interaction (`pointer-events: auto`).
     - Canvas renders 512x512 JPEG (0.92 quality) and extracts Blob.
     - Async `fetch` POST sends FormData (`avatar` blob & Bearer token) to `https://api-laporanwe.mkverse.my.id/api/profile/upload.php`.
     - On success: `avatar_url` is updated with `?t=${Date.now()}` query string, DOM `#mainAvatarImg` and `.pimg img` are updated, global event `laporanwee-profile-updated` is dispatched, modal closes, and browser URL updates to `/profil`.
     - On error: Toast message notifies the user and `finally` block turns off loading state (`setIsUploading(false)`), allowing re-submission.

- **Visual Identity & Theme**:
  - Unlocked button interactions: `.pc-b.pc-load` CSS changed from `pointer-events: none` to `pointer-events: auto` to prevent permanent UI lockups on network timeouts.
  - Smooth 200ms transitions and pop animation (`.pf-pop`) on avatar updating.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Fetch in `ProfileCropModal.tsx` & `handleSaveCrop`**
  - *Chosen Approach*: `ProfileCropModal.tsx` converts canvas to Blob and posts to `upload.php`, passing the resulting cache-busted URL to `onSaved`.
  - *Why*: Ensures a single source of truth for canvas export and direct HTTP communication without duplicate mock timers.

- **Decision 2: CSS `pointer-events: auto` on `.pc-b.pc-load`**
  - *Chosen Approach*: Replace `pointer-events: none` in `profile-edit.css` with `pointer-events: auto`.
  - *Why*: Prevents the browser button element from becoming permanently unresponsive if network fetches fail or hang.

---

## 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌─────────────────────────────────────────────────────────┐
│                  ProfileSettingsView                    │
│  - Receives/fetches user data from get.php              │
│  - Stores avatarUrl with ?t=${Date.now()} cache-buster │
│  - Listens to window popstate & URL route /profil       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   ProfileCropModal                      │
│  1. HTMLCanvasElement render 512x512 JPEG (0.92 quality)│
│  2. canvas.toBlob() -> FormData ('avatar', blob)        │
│  3. fetch POST upload.php with Bearer Authorization     │
│  4. resJson.success -> avatar_url + ?t=${Date.now()}    │
│  5. onSaved(finalUrl) -> onClose() -> pushState /profil │
│  6. try-catch-finally -> setIsUploading(false)          │
└─────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  1. `src/profile-edit.css`:
     - Update `.pc-b.pc-load` selector: change `pointer-events: none;` to `pointer-events: auto;`.
  2. `src/components/ProfileCropModal.tsx`:
     - `handleSave`: 512x512 canvas drawing, `toBlob`, POST to `https://api-laporanwe.mkverse.my.id/api/profile/upload.php`.
     - `try-catch-finally` guarantees `setIsUploading(false)` executes.
     - `onSaved(newAvatarWithTimestamp)` called; `window.history.pushState({}, '', '/profil')` restored.
  3. `src/views/ProfileSettingsView.tsx`:
     - Reactive state update for `avatarUrl` with timestamp.
     - Direct update to DOM `#mainAvatarImg` / `.pimg img` if rendered.
     - Event listener for `laporanwee-profile-updated` keeps header/sidebar synced.
