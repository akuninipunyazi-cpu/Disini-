# DiSini! Project Instructions & Context

File ini adalah memori jangka panjang untuk asisten AI agar memahami status dan aturan proyek **DiSini! Surabaya**.

## 🏗️ Tech Stack & Architecture
- **Auth:** Clerk (Linked to App ID: `app_3F4LYGKyc8BjU5sWsDGt20quRNa`).
- **Database:** Supabase (HS256 JWT Secret synced with Clerk).
- **Frontend:** React + Vite + TypeScript.
- **Component Pattern:** Modular (Split into `auth/`, `admin/`, `user/`, `common/`, `layout/`).

## 🔐 Authentication Flow
- User **WAJIB** login sebelum bisa melihat konten apa pun (Forced Auth Screen).
- Profile otomatis sinkron ke tabel `profiles` Supabase saat login pertama kali (`getAccountForUser` di `authService.ts`).
- **Roles:** `super_admin`, `location_admin`, dan `user`.

## 🛠️ Admin Features (Verified & Working)
- **View Switcher:** Khusus `super_admin` bisa ganti tampilan antara Mode Admin dan Mode User via header.
- **Click-to-Add Map:** Klik pada peta di Admin Console otomatis mengisi koordinat di form.
- **OpenStreetMap Data Importer:** Mengambil data toko asli dari Overpass API (OSM) secara massal tanpa biaya API.

## 📋 Development Rules
- **Modular Components:** Jangan masukkan logic UI besar ke `App.tsx`. Gunakan folder `src/components/`.
- **Authenticated Supabase Requests:** Gunakan `createClerkSupabaseClient(token)` untuk operasi Write agar RLS tertembus dengan identitas user yang benar.
- **Maps:** Gunakan Leaflet dengan provider OpenStreetMap (Gratis).
- **Environment:** Selalu pastikan `VITE_CLERK_PUBLISHABLE_KEY` dan `VITE_SUPABASE_URL/KEY` ada di `.env`.

---
*Last Session Note: Proyek beralih sepenuhnya ke OpenStreetMap. Fitur terakhir adalah Data Importer dan Admin CRUD.*
