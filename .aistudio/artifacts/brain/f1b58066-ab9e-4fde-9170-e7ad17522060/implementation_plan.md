# Rangka Ulang Fitur Foto Profil ke Routing `/profil/setting-profile-picture`

Plan for connecting the profile picture crop cropper to the `/profil/setting-profile-picture` route, fetching initial avatar data, posting cropped 512x512 canvas Blobs to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`, applying cache-busting, and synchronizing state across `ProfileSettingsView.tsx`, `ProfileCropModal.tsx`, `App.tsx`, and `profile-edit.css`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed during Phase 1 interactive clarification:

- **Confirmed Trigger Placement**: Place a prominent "Ubah Foto Profil" button above the Profile Information Form in `ProfileSettingsView.tsx`.
- **Confirmed Default Avatar**: Generate a dynamic starter canvas with the user's name initial when no avatar URL exists on the server.

---

## 1. Overview & Core Concept

- **What It Does**: Re-architects the profile avatar edit feature to operate seamlessly via `/profil/setting-profile-picture`. Opens a crop modal with D-pad pan, zoom, rotate, and flip controls. Synchronizes URL navigation, fetches initial image from `index.php`, posts 512x512 cropped Blobs to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`, appends `?t=${Date.now()}` cache-busters, updates global avatar state, and restores URL path to `/profil`.
- **Target Audience / Persona**: Users updating their account avatars with real-time feedback and route bookmarking.
- **Key Value**: Direct API synchronization with zero stale browser image cache and seamless URL routing.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Trigger / Route Access**:
     - User clicks "Ubah Foto Profil" button above the form in `ProfileSettingsView.tsx` OR navigates directly to `https://laporanwe.mkverse.my.id/profil/setting-profile-picture`.
     - Route sync executes: `window.history.pushState({ modal: 'crop' }, '', '/profil/setting-profile-picture')`.
  2. **Initial Data Load (GET)**:
     - Component fetches `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php` with Bearer token.
     - If `res.data.avatar_url` exists, loads image onto cropper stage; otherwise initializes starter canvas with initial char.
  3. **Cropping & Saving (POST)**:
     - User adjusts zoom (100%–300%), D-pad panning, rotation, or file drag & drop.
     - User clicks "Simpan Foto" (#pc-save):
       - Canvas renders 512x512 JPEG (0.92 quality) and extracts Blob.
       - FormData sends `avatar` blob to `setting-profil-picture/index.php` with Bearer header.
       - On success: updates React state `avatarUrl` with `res.data.avatar_url + '?t=' + Date.now()`, updates DOM `#mainAvatarImg` / `.pimg img`, dispatches global update event, closes modal, restores route to `/profil`, and shows Toast "Foto profil berhasil diperbarui".
       - In `finally`: unlocks loading indicator (`setIsUploading(false)`).

- **Visual Identity & Theme**:
  - `profile-edit.css`: `.pc-b.pc-load` uses `pointer-events: auto` to prevent permanent UI lockup during network requests.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Route Sync in `ProfileSettingsView` and `App.tsx`**
  - *Chosen Approach*: `App.tsx` and `ProfileSettingsView.tsx` listen for `/profil/setting-profile-picture` in `window.location` and `popstate`, opening the crop modal and managing `pushState` transitions.
  - *Why*: Enables deep linking directly to `/profil/setting-profile-picture` while keeping clean modal overlay behavior.

- **Decision 2: Dedicated Endpoint `setting-profil-picture/index.php`**
  - *Chosen Approach*: Point GET and POST calls directly to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.
  - *Why*: Matches the updated backend API specification.

---

## 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App.tsx & Routing                               │
│  - Recognizes /profil/setting-profile-picture route                    │
│  - Maps route to ProfileSettingsView                                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ProfileSettingsView                              │
│  - Displays "Ubah Foto Profil" button above Profile Form               │
│  - Listens to route /profil/setting-profile-picture                     │
│  - Renders ProfileCropModal                                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ProfileCropModal                                │
│  1. GET setting-profil-picture/index.php -> loads initial avatar_url   │
│  2. Interactive Cropper (512x512 Canvas Export)                        │
│  3. POST setting-profil-picture/index.php via FormData ('avatar')       │
│  4. res.success -> avatar_url + ?t=${Date.now()} -> onSaved()          │
│  5. Restores URL to /profil & dispatches profile update event          │
└────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  1. `src/App.tsx`:
     - Register `/profil/setting-profile-picture` in `validPaths` and route maps (`pathToViewMap`, `viewToPathMap`).
  2. `src/components/ProfileCropModal.tsx`:
     - Update API endpoint to `https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php`.
     - Fetch GET on open to retrieve `res.data.avatar_url`.
     - Export 512x512 JPEG Blob, POST to `setting-profil-picture/index.php`.
     - Apply cache-buster `?t=${Date.now()}` on success, restore route to `/profil`.
  3. `src/views/ProfileSettingsView.tsx`:
     - Add "Ubah Foto Profil" button above form.
     - Render `ProfileCropModal` when route includes `/setting-profile-picture` or modal state is active.
     - Update React `avatarUrl` state and dispatch `laporanwee-profile-updated` event.
  4. `src/profile-edit.css`:
     - Ensure `.pc-b.pc-load` has `pointer-events: auto;`.
