# Implementation Plan - Integrasi Sinkronisasi 2 Arah Dashboard & Backend API

Mengintegrasikan fungsi sinkronisasi 2 arah (`syncDashboardData` dan `attachTaskToggleEvents`) ke dalam komponen `DashboardView.tsx`, lengkap dengan polling otomatis setiap 30 detik, optimistic UI saat centang tugas, rollback otomatis serta toast error jika request gagal, dan pengambilan token autentikasi dari `localStorage`.

---

## 1. Rencana Perubahan pada `src/views/DashboardView.tsx`

1. **Fungsi `syncDashboardData` di React Hook (`useEffect`)**:
   - Memanggil endpoint `https://api-laporanwe.mkverse.my.id/api/dashboard/index.php` menggunakan header `Authorization: Bearer <token>` dan `X-Admin-Email`.
   - Mengambil token autentikasi dari `localStorage` (`auth_token` || `token`).
   - Menyinkronkan data tugas berjalan (`running_tasks`), label tanggal sub-header, dan nilai KPI (`active_projects`, `ongoing_tasks`, `completion_rate`), serta animasi radial progress ring.
   - Menjalankan interval polling otomatis setiap **30 detik** dengan pembersihan (*cleanup*) saat komponen unmount.

2. **Fungsi Toggle Tugas 2 Arah (`toggleTodo` / `attachTaskToggleEvents`)**:
   - Saat pengguna mencentang/membatalkan centang tugas:
     - Melakukan **Optimistic UI Update** seketika (mengubah status `done` pada state lokal).
     - Mengirim POST request ke `https://api-laporanwe.mkverse.my.id/api/tasks/toggle.php` dengan payload `{ id: taskId, completed: willBeDone }`.
     - Jika server mengembalikan `success: true` dan data `stats`, memperbarui angka KPI dan persentase selesai secara langsung.
     - Jika request gagal (network error / server 500), **melakukan rollback status centang** pada state lokal dan memunculkan toast error (`onAddToast`).

3. **Sinkronisasi State React & DOM**:
   - Menghubungkan state `todoList` dengan data yang diambil dari API secara real-time.
   - Memastikan seluruh komponen tetap responsif dan bebas lag sesuai standar UI 5.0.

---

## 2. Langkah Implementasi

1. **Langkah 1**: Edit `src/views/DashboardView.tsx` untuk menyematkan logika `syncDashboardData` dan `toggleTodo` dengan polling 30 detik dan penanganan error rollback.
2. **Langkah 2**: Jalankan `compile_applet` dan `lint_applet` untuk memverifikasi build berjalan sukses 100% tanpa error TypeScript.

---

## 3. Verifikasi & Pengujian

- **Uji Sinkronisasi API**: Pastikan saat Dashboard dimuat, data tugas dan KPI diambil dari `api-laporanwe.mkverse.my.id`.
- **Uji Polling 30 Detik**: Pastikan interval polling berjalan di latar belakang dan membersihkan interval saat keluar dari halaman.
- **Uji Toggle & Rollback**: Pastikan centang tugas langsung merespons secara instan dan mengembalikan state jika terjadi kegagalan jaringan.
