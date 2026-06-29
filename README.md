# DiSini! Surabaya

DiSini! Surabaya adalah aplikasi direktori lokasi untuk membantu perantau, mahasiswa, dan penghuni kos di Surabaya menemukan kebutuhan harian di sekitar mereka. Aplikasi ini menggabungkan pencarian berbasis lokasi, rekomendasi tempat, peta interaktif, dashboard admin, import data OpenStreetMap, serta klasifikasi foto barang berbasis AI.

Project ini dibangun sebagai aplikasi frontend modern dengan pendekatan AI-assisted development: struktur kode dipisah per domain, logic data diletakkan di service layer, dan UI dipisah antara mode user, mode admin, dan komponen reusable.

## Fitur Utama

### Untuk User

- Login wajib menggunakan Clerk sebelum masuk ke aplikasi.
- Kalibrasi lokasi otomatis dari browser geolocation.
- Pencarian kebutuhan berdasarkan kata kunci, kategori, jarak, harga, dan kecocokan rekomendasi.
- Upload foto barang untuk mengenali kebutuhan secara otomatis lewat OpenRouter Vision.
- Fallback deteksi foto berbasis keyword ketika OpenRouter tidak tersedia.
- Peta interaktif Surabaya berbasis Leaflet dan OpenStreetMap.
- Marker toko/tempat hanya muncul setelah user melakukan pencarian atau memilih kategori.
- Detail tempat berisi alamat, jarak, status verifikasi, item utama, estimasi harga, dan tombol rute.

### Untuk Admin

- Dashboard admin dengan tab tambah titik, import OSM, kelola titik, dan manajemen user.
- Tambah tempat manual lengkap dengan kategori, area, alamat, koordinat, item utama, dan harga.
- Klik peta untuk mengisi koordinat tempat baru.
- Gunakan GPS admin untuk mengisi latitude dan longitude.
- Import sampai 50 titik dari OpenStreetMap/Overpass API.
- Edit, verifikasi, dan hapus tempat.
- Multi-kategori untuk satu tempat, misalnya toko yang menjual kebutuhan harian sekaligus peralatan kos.
- Manajemen user khusus `super_admin`, termasuk sync user Clerk ke Supabase dan update role.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | CSS custom di `src/styles.css` |
| Authentication | Clerk |
| Database | Supabase PostgreSQL + Row Level Security |
| Maps | Leaflet + OpenStreetMap tile layer |
| AI Vision | OpenRouter Chat Completions dengan image input |
| Icons | lucide-react |
| Deployment config | Netlify (`netlify.toml`) |

## Cara Menjalankan Project

Pastikan Node.js dan npm sudah tersedia.

```bash
npm install
npm run dev
```

Default Vite dev server berjalan di:

```text
http://localhost:5173
```

Command lain:

```bash
npm run build
npm run lint
npm run preview
```

## Environment Variables

Buat file `.env` berdasarkan `.env.example`.

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_OPENROUTER_VISION_MODEL=google/gemini-2.5-flash-lite
```

Catatan:

- `VITE_CLERK_PUBLISHABLE_KEY` wajib ada. Aplikasi akan berhenti di `src/main.tsx` jika key kosong.
- `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` diperlukan untuk membaca dan menulis data Supabase.
- Write request ke Supabase memakai Clerk JWT template bernama `supabase`.
- `VITE_OPENROUTER_API_KEY` opsional. Jika kosong atau request AI gagal, aplikasi tetap berjalan memakai fallback classifier lokal.
- Jangan commit file `.env` yang berisi secret atau key asli.

## Struktur Folder

```text
src/
  App.tsx
  main.tsx
  styles.css
  types.ts

  components/
    SurabayaMap.tsx
    admin/
      AdminConsole.tsx
      AdminPlaceCard.tsx
    auth/
      AuthScreen.tsx
    common/
      LocationCalibration.tsx
      PlaceDetail.tsx
      PlaceResultCard.tsx
    layout/
      Header.tsx
      Footer.tsx
    user/
      UserDiscovery.tsx

  data/
    categories.ts
    places.ts

  lib/
    supabaseClient.ts

  services/
    aiItemRecognition.ts
    authService.ts
    maps.ts
    osmService.ts
    placeRepository.ts
    recommendations.ts

  utils/
    location.ts
```

## Alur Aplikasi

### 1. Bootstrap

`src/main.tsx` membaca `VITE_CLERK_PUBLISHABLE_KEY`, memasang `ClerkProvider`, lalu merender `App`.

### 2. Session dan Role

`src/App.tsx` membaca user Clerk lewat `useUser` dan token lewat `useAuth`. Setelah user login, aplikasi memanggil `getAccountForUser` dari `src/services/authService.ts` untuk membaca atau membuat profile di tabel `profiles`.

Role yang dikenali:

- `user`
- `super_admin`
- `location_admin`
- `verifier`
- `moderator`

Role admin dicek lewat `isAdminRole`. Switch mode user/admin di header hanya tampil untuk `super_admin`.

### 3. Data Tempat

Data tempat dimuat lewat `loadPlaces` di `src/services/placeRepository.ts`.

- Jika Supabase aktif dan query berhasil, data berasal dari tabel `places` dan relasi `items`.
- Jika Supabase belum dikonfigurasi atau gagal dibaca, aplikasi memakai seed lokal dari `src/data/places.ts`.

### 4. Rekomendasi

Ranking tempat dihitung oleh `rankPlaces` di `src/services/recommendations.ts`.

Skor rekomendasi mempertimbangkan:

- kecocokan query,
- kategori,
- jarak dari origin user,
- level harga,
- status verifikasi.

Jarak dihitung dengan Haversine formula.

### 5. User Discovery

`src/components/user/UserDiscovery.tsx` menampilkan flow user:

- panel kalibrasi lokasi,
- input pencarian,
- filter kategori,
- upload foto barang,
- list hasil,
- peta,
- detail tempat terpilih.

Saat belum ada query atau kategori aktif, peta hanya menampilkan marker lokasi user. Marker tempat baru tampil setelah user mulai mencari.

### 6. AI Image Recognition

`src/services/aiItemRecognition.ts` mengirim gambar ke OpenRouter Vision bila API key tersedia. Model default:

```text
google/gemini-2.5-flash-lite
```

Jika model utama gagal, service mencoba fallback model yang tersedia di kode. Hasil AI dinormalisasi menjadi:

```ts
{
  itemName: string;
  categoryId: CategoryId;
  confidence: number;
  searchQuery: string;
}
```

Jika OpenRouter tidak tersedia, fallback lokal membaca nama file dan keyword kategori seperti `bantal`, `pulpen`, `galon`, `laundry`, atau `print`.

### 7. Admin Console

`src/components/admin/AdminConsole.tsx` menangani operasi admin:

- tambah titik manual,
- import data OSM,
- kelola titik,
- verifikasi tempat,
- hapus tempat,
- manajemen role user.

Operasi create, update, delete, dan verify dikirim ke `src/services/placeRepository.ts`. Untuk request yang membutuhkan izin, service memakai `createClerkSupabaseClient(token)` agar request membawa identitas Clerk ke Supabase RLS.

## Integrasi Supabase

Client Supabase berada di `src/lib/supabaseClient.ts`.

Ada dua mode client:

- `supabase`: client public untuk read/fallback umum.
- `createClerkSupabaseClient(token)`: client dengan header `Authorization: Bearer <clerkToken>` untuk operasi yang dilindungi RLS.

Tabel yang digunakan oleh aplikasi:

- `profiles`: menyimpan profile dan role user.
- `places`: menyimpan data tempat.
- `items`: menyimpan item atau layanan utama yang terkait dengan tempat.

Kolom penting `places`:

- `id`
- `name`
- `source`
- `category_ids`
- `address`
- `area`
- `lat`
- `lng`
- `price_level`
- `rating`
- `open_status`
- `verified`
- `notes`
- `google_place_id`
- `created_by`

Kolom penting `items`:

- `id`
- `place_id`
- `name`
- `estimated_price`
- `unit`
- `tags`

## Integrasi OpenStreetMap

Import data toko dilakukan lewat `src/services/osmService.ts` menggunakan Overpass API. Query saat ini difokuskan pada area sekitar UPN Veteran Jawa Timur, Gunung Anyar, Rungkut, Wonorejo, dan sekitarnya.

Data OSM dipetakan ke kategori aplikasi, lalu dikirim sebagai `ManualPlaceInput[]` ke `createBulkPlaces`.

## Kategori Data

Kategori utama didefinisikan di `src/data/categories.ts`:

- `kos_kit`: Peralatan kos
- `atk`: ATK & kuliah
- `food`: Makan murah
- `laundry`: Laundry
- `print_copy`: Print & fotokopi
- `daily_needs`: Kebutuhan harian
- `service`: Servis & darurat
- `housing`: Kos & hunian

Jika menambah kategori baru, update file berikut secara konsisten:

- `src/types.ts`
- `src/data/categories.ts`
- `src/services/aiItemRecognition.ts`
- logic UI atau seed data yang membutuhkan kategori tersebut

## Konvensi Pengembangan

- Jaga `App.tsx` sebagai koordinator state, bukan tempat menumpuk business logic besar.
- Taruh operasi database di `src/services/placeRepository.ts`.
- Taruh perubahan ranking dan scoring di `src/services/recommendations.ts`.
- Taruh perubahan auth, role, dan profile di `src/services/authService.ts`.
- Gunakan `createClerkSupabaseClient(token)` untuk write request Supabase.
- Pertahankan `categoryIds` sebagai array agar satu tempat bisa masuk beberapa kategori.
- Jangan mengubah file `.env` atau konfigurasi auth/database tanpa alasan jelas.
- Untuk perubahan UI user, prioritaskan `src/components/user/` dan `src/components/common/`.
- Untuk perubahan UI admin, prioritaskan `src/components/admin/`.

## Validasi

Sebelum commit atau deploy, jalankan:

```bash
npm run lint
npm run build
```

Build production akan menghasilkan output ke folder `dist/`.

Vite dapat memberi warning jika bundle JavaScript lebih besar dari 500 kB. Warning ini tidak selalu berarti build gagal, tetapi code splitting bisa dipertimbangkan jika ukuran bundle mulai mengganggu performa.

## Deployment

Project memiliki konfigurasi Netlify di `netlify.toml`. Untuk deploy frontend:

1. Pastikan environment variables sudah diatur di dashboard hosting.
2. Jalankan build command:

```bash
npm run build
```

3. Publish folder:

```text
dist
```

## Roadmap

- Review dan rating user untuk setiap tempat.
- Saran tempat dari user biasa dengan kurasi admin.
- Upload foto asli tempat.
- Favorit atau history pencarian user.
- Refresh state admin tanpa `window.location.reload()`.
- Code splitting untuk memecah bundle besar.
- Dokumentasi SQL/RLS Supabase yang lebih lengkap.
