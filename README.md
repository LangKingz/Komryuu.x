# Komryuu.x

Proyek Next.js sederhana untuk [isi tujuan proyek di sini, misal: Dashboard, Website, dsb.].

## Fitur Utama
- Next.js (React)
- Mendukung hot reload
- Siap deploy di Vercel
- Dashboard admin dengan metrik Firestore realtime dan CRUD ekstensi
- API manajemen pengguna yang dilindungi `ADMIN_API_KEY`

## Cara Instalasi
1. Clone repository:
   ```
   git clone https://github.com/username/komryuu.x.git
   cd komryuu.x
   ```
2. Install dependensi:
   ```
   npm install
   ```

## Menjalankan Secara Lokal
```
npm run dev
```
Akses di [http://localhost:3000](http://localhost:3000).

## Data Firebase dan API Admin

Panel admin menggunakan Firestore Client SDK melalui instance `db` di `src/lib/firebase.tsx`. Endpoint eksternal menggunakan Firestore REST API dengan timeout 5 detik per request; tidak ada Firebase Admin SDK atau service-account key di repo. Firestore Security Rules tetap berlaku untuk akses Client SDK dan REST.

Asumsi struktur koleksi Firestore:

- `EXTENSION`: satu dokumen per ekstensi, berisi `name`, `description`, `logo`, `type` (`komik`, `anime`, atau `cinema`), `location`, `BaseUrl`, `UrlSearch`, `api`, `status` (`active`/`inactive`), `nsfw`, dan waktu pembuatan/perubahan.
- `users`: satu dokumen per pengguna, berisi `email`, `name`, `status`, `createdAt`, `salt`, `passwordHash`, serta `passwordAlgorithm`/`passwordIterations` untuk hash PBKDF2. Endpoint tidak mengirim hash atau salt ke client.
- `SETTINGS/app_config`: `maintenanceMode`, `maintenanceMessage`, `announcement`, `externalApiKeyHash`, `rateLimitPerMinute`, `extensionCacheTtlSeconds`, `allowRegistration`, `showNsfw`, `defaultCategory`, dan `minimumAppVersion`. API key dibuat acak di halaman Pengaturan; hanya hash SHA-256 yang disimpan.
- `ACTIVITY`: satu dokumen per event dengan `action`, `detail`, `userId` opsional, dan `createdAt`. Dashboard memakai waktu pembuatan pengguna/ekstensi sebagai fallback saat log kosong atau tak dapat diakses.

Rute eksternal `/api/v1/extensi`, `/api/v1/users`, dan `/api/v1/auth` memerlukan header `x-api-key` yang dibuat di Pengaturan. API ekstensi mendukung `type` dan `limit` (1–100), menerapkan status maintenance, filter NSFW, rate limit, serta cache TTL. API pengguna mendukung `GET` daftar/detail dan `POST` registrasi yang mengikuti `allowRegistration`; `PUT`/`DELETE` juga memerlukan `x-admin-api-key`. Tulis ekstensi melalui API memerlukan `x-admin-api-key`. Atur `ADMIN_API_KEY` sebagai environment variable server-only, jangan memakai prefix `NEXT_PUBLIC_`. Rute eksternal `/api/v1/extensi` dan `/api/v1/users` tidak dicocokkan oleh middleware. Rate limit berada di memori proses Next.js dan bukan penyimpanan terdistribusi.

Koleksi pengaturan harus dapat dibaca oleh endpoint REST agar status maintenance dan hash API key bisa diverifikasi; batasi hak tulis dokumen settings ke administrator lewat Firestore Security Rules. Akses langsung panel admin juga harus dibatasi oleh Security Rules. `.env*` dan `serviceAccountKey.json` diabaikan Git.

## Struktur File Penting
- `app/page.tsx` — halaman utama.
- `public/` — aset publik (gambar, ikon, dsb.).
- `README.md` — dokumentasi singkat project.

## Kontribusi
Kontribusi sangat terbuka! Fork, ubah, dan kirim Pull Request.

## Lisensi
[Tuliskan lisensi jika ada, contoh: MIT License]
