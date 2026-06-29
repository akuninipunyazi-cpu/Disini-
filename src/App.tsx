import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useUser, useAuth, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { baseOrigin, baseOriginLabel, seedPlaces } from './data/places';
import { identifyItemFromImage } from './services/aiItemRecognition';
import { isAdminRole, getAccountForUser } from './services/authService';
import { createManualPlace, loadPlaces } from './services/placeRepository';
import { rankPlaces } from './services/recommendations';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AdminConsole } from './components/admin/AdminConsole';
import { UserDiscovery } from './components/user/UserDiscovery';

import type {
  AuthAccount,
  ItemRecognition,
  ManualPlaceInput,
  Place,
  SearchState,
} from './types';

/**
 * Nilai awal untuk form penambahan tempat baru secara manual.
 */
const initialManualInput: ManualPlaceInput = {
  name: '',
  categoryId: 'kos_kit',
  address: '',
  area: '',
  lat: baseOrigin.lat,
  lng: baseOrigin.lng,
  priceLevel: 1,
  itemName: '',
  estimatedPrice: 0,
  notes: '',
};

function App() {
  // Hooks dari Clerk untuk mendapatkan data user dan token autentikasi
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  
  // --- STATE UTAMA ---
  const [places, setPlaces] = useState<Place[]>(seedPlaces); // Daftar semua tempat
  const [, setDataStatus] = useState('Memuat data tempat...'); // Status loading data (opsional digunakan di UI)
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null); // Data profile user dari Supabase
  const [viewMode, setViewMode] = useState<'user' | 'admin'>('user'); // Mode tampilan (User vs Admin)
  
  // State pencarian dan filter
  const [search, setSearch] = useState<SearchState>({
    query: '',
    categoryId: 'all',
    sortBy: 'recommended',
    origin: baseOrigin,
    originLabel: baseOriginLabel,
  });

  // State UI lainnya
  const [selectedPlaceId, setSelectedPlaceId] = useState(seedPlaces[0].id);
  const [manualInput, setManualInput] = useState<ManualPlaceInput>(initialManualInput);
  const [recognition, setRecognition] = useState<ItemRecognition | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [placeFormStatus, setPlaceFormStatus] = useState('');
  const [locationStatus, setLocationStatus] = useState(
    'DiSini! akan meminta izin lokasi untuk mengkalibrasi posisi kamu otomatis.',
  );

  // Cek apakah user memiliki akses admin
  const canUseAdmin = isAdminRole(authAccount?.role);

  // Mengurutkan tempat berdasarkan filter dan lokasi user secara efisien (Memoized)
  const rankedPlaces = useMemo(() => rankPlaces(places, search), [places, search]);

  // Mendapatkan data tempat yang sedang terpilih
  const selectedPlace = useMemo(() => {
    return rankedPlaces.find((place) => place.id === selectedPlaceId) ?? rankedPlaces[0];
  }, [rankedPlaces, selectedPlaceId]);

  /**
   * Fungsi untuk mengupdate titik pusat (origin) pencarian user.
   */
  const updateUserOrigin = useCallback((origin: SearchState['origin'], originLabel: string) => {
    setSearch((current) => ({ ...current, origin, originLabel }));
    setLocationStatus(`Lokasi dikalibrasi ke ${originLabel}.`);
  }, []);

  /**
   * EFFECT: Sinkronisasi data user Clerk dengan tabel profiles di Supabase.
   * Dipanggil setiap kali status 'user' dari Clerk berubah.
   */
  useEffect(() => {
    async function syncUser() {
      if (user) {
        try {
          // AMBIL TOKEN JWT khusus Supabase dari Clerk
          const token = await getToken({ template: 'supabase' });

          const account = await getAccountForUser(
            user.id, 
            user.primaryEmailAddress?.emailAddress,
            user.username || user.firstName || user.fullName,
            token || undefined // Kirim token agar bisa tembus RLS Supabase
          );

          // Update account hanya jika ada perubahan data
          setAuthAccount(prev => {
            if (prev && prev.id === account.id && prev.role === account.role && prev.username === account.username) {
              return prev;
            }
            // Jika ini pertama kali login (authAccount masih null), set viewMode default
            if (!prev) {
              setViewMode(isAdminRole(account.role) ? 'admin' : 'user');
            }
            return account;
          });
        } catch (error) {
          console.error('Gagal sinkronisasi profile ke Supabase:', error);
          // Fallback jika database gagal diakses
          setAuthAccount({
            id: user.id,
            username: user.username || user.firstName || 'User',
            email: user.primaryEmailAddress?.emailAddress || '',
            role: 'user',
          });
          setViewMode('user');
        }
      } else {
        setAuthAccount(null);
      }
    }
    syncUser();
  }, [user, getToken]);

  /**
   * EFFECT: Memuat data tempat dari API/Database saat aplikasi pertama kali dijalankan.
   */
  useEffect(() => {
    async function initData() {
      const { places: loaded, message } = await loadPlaces();
      setPlaces(loaded);
      setDataStatus(message);
    }
    initData();
  }, []);

  /**
   * EFFECT: Auto-Geolocation.
   * Meminta izin lokasi browser satu kali per sesi saat user login.
   */
  useEffect(() => {
    if (!user || !isUserLoaded || !isAuthLoaded) {
      return;
    }

    const locationRequestKey = `disini-location-requested-${user.id}`;
    if (window.sessionStorage.getItem(locationRequestKey)) {
      return;
    }

    window.sessionStorage.setItem(locationRequestKey, 'true');

    if (!navigator.geolocation) {
      setLocationStatus('Browser ini belum mendukung geolocation.');
      return;
    }

    setLocationStatus('Meminta izin lokasi browser...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateUserOrigin(
          {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          },
          'Lokasi saya saat ini',
        );
      },
      () => {
        setLocationStatus('Izin lokasi belum diberikan. Gunakan tombol lokasi browser untuk mencoba lagi.');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }, [user, isUserLoaded, isAuthLoaded, updateUserOrigin]);

  /**
   * EFFECT: Reset pilihan tempat ke urutan pertama setiap kali filter berubah.
   */
  useEffect(() => {
    if (rankedPlaces[0]) {
      setSelectedPlaceId(rankedPlaces[0].id);
    }
  }, [rankedPlaces, search.categoryId, search.origin.lat, search.origin.lng, search.query, search.sortBy]);

  /**
   * Helper untuk memperbarui state pencarian.
   */
  function updateSearch(nextSearch: Partial<SearchState>) {
    setSearch((current) => ({ ...current, ...nextSearch }));
  }

  /**
   * Handler untuk tombol kalibrasi lokasi manual.
   */
  function handleUseBrowserLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Browser ini belum mendukung geolocation.');
      return;
    }

    setLocationStatus('Meminta izin lokasi browser...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateUserOrigin(
          {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          },
          'Lokasi saya saat ini',
        );
      },
      () => {
        setLocationStatus('Lokasi tidak diizinkan. Aktifkan permission lokasi lalu coba lagi.');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }

  /**
   * Handler untuk fitur AI: Upload gambar untuk mendeteksi barang secara otomatis.
   */
  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const result = await identifyItemFromImage(file);
      setRecognition(result);
      // Auto-filter berdasarkan hasil deteksi AI
      setSearch((current) => ({
        ...current,
        query: result.searchQuery,
        categoryId: result.categoryId,
        sortBy: 'recommended',
      }));
    } finally {
      event.target.value = '';
      setIsScanning(false);
    }
  }

  /**
   * Helper untuk mengisi form input manual (Admin).
   */
  function handleManualInputChange<Key extends keyof ManualPlaceInput>(
    key: Key,
    value: ManualPlaceInput[Key],
  ) {
    setManualInput((current) => ({ ...current, [key]: value }));
  }

  /**
   * Handler untuk menyimpan titik/tempat baru ke database (Admin Only).
   */
  async function handleAddManualPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authAccount || !canUseAdmin) {
      setPlaceFormStatus('Akses ditolak. Anda bukan admin.');
      return;
    }

    setIsSavingPlace(true);
    setPlaceFormStatus('Menyimpan titik...');

    try {
      // Ambil token JWT Clerk khusus untuk Supabase agar bisa menembus RLS
      const token = await getToken({ template: 'supabase' });
      
      if (!token) {
        throw new Error('Gagal mendapatkan token autentikasi dari Clerk.');
      }

      // Kirim data ke repository untuk disimpan
      const newPlace = await createManualPlace(manualInput, authAccount, token);
      
      // Update state lokal agar UI langsung sinkron tanpa refresh
      setPlaces((current) => [newPlace, ...current]);
      setSelectedPlaceId(newPlace.id);
      setSearch((current) => ({
        ...current,
        query: newPlace.items[0].name,
        categoryId: manualInput.categoryId,
      }));
      setManualInput(initialManualInput);
      setPlaceFormStatus('Titik berhasil tersimpan di peta.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menyimpan titik.';
      setPlaceFormStatus(`Gagal: ${msg}`);
      console.error('Save Error:', error);
    } finally {
      setIsSavingPlace(false);
    }
  }

  // Tampilan loading saat inisialisasi sesi auth
  if (!isUserLoaded || !isAuthLoaded) {
    return (
      <div className="login-shell">
        <p>Memulihkan sesi...</p>
      </div>
    );
  }

  return (
    <>
      {/* Jika user sudah login, tampilkan aplikasi utama */}
      <SignedIn>
        <main className="app-shell">
          {/* Header dengan tombol toggle view Admin/User */}
          <Header 
            account={authAccount} 
            viewMode={viewMode} 
            onToggleView={setViewMode} 
          />

          {/* Render Admin Console atau User Discovery berdasarkan viewMode */}
          {viewMode === 'admin' ? (
            <AdminConsole
              currentAccount={authAccount}
              formStatus={placeFormStatus}
              isSavingPlace={isSavingPlace}
              manualInput={manualInput}
              onAddManualPlace={handleAddManualPlace}
              onManualInputChange={handleManualInputChange}
              places={places}
              origin={search.origin}
            />
          ) : (
            <UserDiscovery
              isScanning={isScanning}
              locationStatus={locationStatus}
              onImageUpload={handleImageUpload}
              onSearchChange={updateSearch}
              onUseBrowserLocation={handleUseBrowserLocation}
              places={rankedPlaces}
              recognition={recognition}
              search={search}
              selectedPlace={selectedPlace}
              selectedPlaceId={selectedPlaceId}
              setSelectedPlaceId={setSelectedPlaceId}
            />
          )}

          <Footer />
        </main>
      </SignedIn>
      
      {/* Jika belum login, redirect paksa ke halaman login Clerk */}
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default App;
