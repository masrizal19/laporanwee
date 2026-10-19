# Implementation Plan - Tahap 2 (Sistem Desain) & Tahap 3.1 (Fondasi Redesain)

Menerapkan sistem desain visual baru (*Design Tokens*) dan fondasi estetika pada aplikasi **LaporanWee** sesuai dengan prototipe `laporanwe-auth-prototype.html` tanpa merusak logika, API, routing, state, atau fungsionalitas admin UI settings.

---

## 1. Spesifikasi Desain & Token Visual Baru

1. **Palet Warna & Mode Gelap (`[data-theme="dark"]`)**:
   - **Latar Belakang**: Abu-lavender hangat (`--bg1: #e6e5ec`, `--bg2: #f1f0f5`) dengan gradasi 135deg.
   - **Ambient Drift Blobs**: Kabut hangat bergerak pelan di belakang antarmuka (`--blob1: rgba(176,160,240,.55)`, `--blob2: rgba(244,214,170,.6)`).
   - **Permukaan Kaca (*Glassmorphism*)**: Putih semi-transparan (`--glass: rgba(255,255,255,.62)`, `--glass-solid: rgba(255,255,255,.92)`) dengan border garis tipis (`--line: rgba(31,29,43,.09)`) dan `backdrop-filter: blur(26px) saturate(1.4)`.
   - **Warna Teks**: Teks primer `--ink: #1f1d2b`, teks sekunder `--muted: #8b8898`.
   - **Tombol Utama Gelap**: `--dark: #23212e`, teks `--on-dark: #ffffff`.
   - **Warna Aksen Pastel**:
     - Lime: `--lime: #d4ee6b`, `--lime-soft: #e9f5b8`
     - Lavender: `--lav: #d9d3f5`, `--lav-deep: #8f7fe0`
     - Mint: `--mint: #d6ecdf`
     - Peach: `--peach: #f6e6cf`
     - Pink: `--pink: #f1d8e4`
     - Status: Sukses `--ok: #4a9d6b`, Bahaya `--bad: #d9534f`
   - **Mode Gelap (`[data-theme="dark"]`)**:
     - Latar belakang gelap hangat (`--bg1: #14131b`, `--bg2: #1b1a24`), teks primer `--ink: #f2f0fa`, teks sekunder `--muted: #8d8aa0`, permukaan kaca gelap (`--glass: rgba(40,38,54,.6)`, `--glass-solid: rgba(46,44,62,.94)`), dan aksen pastel gelap yang nyaman untuk mata.

2. **Tipografi Berskala**:
   - Memuat font Google **Outfit (300, 400, 500, 600, 700)** di `index.html`.
   - Skala tipe: `11.5px / 12.5px / 13.5px / 15px / 17px / 22px / 26px / 34px / 46px`.
   - Judul besar: bobot 500 dengan letter-spacing `-0.035em` dan line-height `1.05 - 1.1`.
   - Label teks biasa (*sentence-case*), menghindari huruf kapital penuh yang berlebihan.

3. **Bentuk & Bayangan Terpadu**:
   - Radius sudut: Kartu utama `30px`, panel dalam `22px`, input form `19px`, tombol utama berbentuk pil penuh (`999px`), checkbox `7px`.
   - Bayangan tunggal: `--shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 40px 80px -40px rgba(60,50,110,.5)`.

4. **Gerak & Aksesibilitas**:
   - Kurva easing: `cubic-bezier(.22, 1, .36, 1)`.
   - Durasi: transisi 300–600ms, animasi masuk bertahap 700–900ms.
   - Kepatuhan `prefers-reduced-motion`: Menonaktifkan animasi gerak saat sistem operasi pengguna menyalakan reduced-motion.
   - Focus ring universal: `:focus-visible { outline: 2px solid var(--lav-deep); outline-offset: 3px; }`.

---

## 2. File yang Dikerjakan pada Tahap Ini

1. **`index.html`**:
   - Menambahkan import font Google **Outfit (300, 400, 500, 600, 700)**.
2. **`src/redesign.css` (Berkas Baru)**:
   - Menampung seluruh token CSS variabel, aturan ambient background kabut, scrollbar kustom ramping, focus ring universal, kelas utilitas kaca, dan aturan mode gelap `[data-theme="dark"]`.
3. **`src/main.tsx`**:
   - Mengimpor `src/redesign.css` paling akhir agar dapat melapiskan sistem desain baru dengan presisi tanpa merusak logika JavaScript.
4. **`src/App.tsx`**:
   - Menambahkan elemen latar kabut `<div className="ambient"><i></i><i></i><i></i></div>` yang mengambang lembut di balik aplikasi.
   - Menambahkan pengalih tema terang/gelap minimalis di sudut kanan atas untuk mengaktifkan `[data-theme="dark"]`.

---

## 3. Kompatibilitas dengan Aturan Mutlak

- **Admin UI Settings**: Variabel dinamis `--primary-color`, `--secondary-color`, `--text-color`, dll. tetap hidup di `:root` dan disinkronkan sehingga admin tetap bisa melakukan personalisasi.
- **Logika & API**: Nol modifikasi pada `src/utils/*`, PHP API, routing, state formulir, atau data.
- **Class & Event Handler**: Tidak ada class logika yang dihapus; styling baru dilapiskan secara aditif.

---

## 4. Rencana Verifikasi (Verification Plan)

- **Uji Visual**:
  - Font `Outfit` diterapkan rapi pada seluruh teks.
  - Efek kabut bergerak pelan tampak di latar belakang tanpa menyebabkan lag atau scrollbar ganda.
  - Mode terang dan mode gelap beralih dengan mulus melalui toggle tema.
  - Focus ring terlihat jelas saat menekan tombol `Tab` pada keyboard.
- **Uji Kompilasi**:
  - `npm run build` dan `npm run lint` lolos 100% tanpa error.
