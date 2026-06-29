import { FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  DatabaseZap, 
  Search, 
  MapPin, 
  UserCog, 
  LayoutGrid,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AuthAccount, ManualPlaceInput, Place, CategoryId, AdminRole, Coordinates, AppRole } from '../../types';
import { categories } from '../../data/categories';
import { SurabayaMap } from '../SurabayaMap';
import { rankPlaces } from '../../services/recommendations';
import { fetchSurabayaStoresFromOSM } from '../../services/osmService';
import { createBulkPlaces, deletePlace, updatePlace, verifyPlace } from '../../services/placeRepository';
import { getAccountForUser, getAllProfiles, updateUserRole } from '../../services/authService';
import { useAuth } from '@clerk/clerk-react';
import { AdminPlaceCard } from './AdminPlaceCard';

interface AdminConsoleProps {
  currentAccount: AuthAccount | null;
  formStatus: string;
  isSavingPlace: boolean;
  manualInput: ManualPlaceInput;
  onAddManualPlace: (event: FormEvent<HTMLFormElement>) => void;
  onManualInputChange: <Key extends keyof ManualPlaceInput>(
    key: Key,
    value: ManualPlaceInput[Key],
  ) => void;
  places: Place[];
  origin: Coordinates;
}

type AdminTab = 'manual' | 'osm' | 'manage' | 'users';

const OSM_IMPORT_LIMIT = 50;

const adminRoles: Array<{ id: AdminRole; label: string; description: string }> = [
  { id: 'super_admin', label: 'Super Admin', description: 'Mengatur role, data, verifikasi, dan konfigurasi platform.' },
  { id: 'location_admin', label: 'Location Admin', description: 'Menambahkan titik manual dan memperbaiki detail lokasi.' },
  { id: 'verifier', label: 'Verifier', description: 'Memastikan titik, harga, dan catatan lapangan valid.' },
  { id: 'moderator', label: 'Moderator', description: 'Menjaga review dan laporan user tetap bersih.' },
];

export function AdminConsole({
  currentAccount,
  formStatus,
  isSavingPlace,
  manualInput,
  onAddManualPlace,
  onManualInputChange,
  places,
  origin,
}: AdminConsoleProps) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('manual');
  const [isImporting, setIsImporting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  // State untuk fitur Sync User Manual
  const [syncForm, setSyncForm] = useState({ userId: '', username: '', email: '' });
  const [isSyncingUser, setIsSyncingUser] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isForcingSelfSync, setIsForcingSelfSync] = useState(false);
  const syncFormRef = useRef<HTMLFormElement>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [allUsers, setAllUsers] = useState<AuthAccount[]>([]);
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);

  const isSuperAdmin = currentAccount?.role === 'super_admin';

  useEffect(() => {
    async function fetchUsers() {
      if (isSuperAdmin && activeTab === 'users') {
        try {
          const token = await getToken({ template: 'supabase' });
          if (token) {
            const users = await getAllProfiles(token);
            setAllUsers(users);
          }
        } catch (error) {
          console.error('Failed to fetch users:', error);
        }
      }
    }
    fetchUsers();
  }, [isSuperAdmin, getToken, activeTab]);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setIsUpdatingUser(userId);
    try {
      const token = await getToken({ template: 'supabase' });
      if (token) {
        await updateUserRole(userId, newRole, token);
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (error) {
      console.error('Update role error:', error);
      alert('Gagal mengubah role user.');
    } finally {
      setIsUpdatingUser(null);
    }
  };

  /**
   * Sync user manual: Insert satu user Clerk ke tabel profiles Supabase.
   * Berguna untuk user yang mendaftar saat Supabase sedang pause.
   */
  const handleManualUserSync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!syncForm.userId.trim() || !syncForm.email.trim()) {
      setSyncMessage({ text: 'User ID dan Email wajib diisi.', type: 'error' });
      return;
    }

    setIsSyncingUser(true);
    setSyncMessage({ text: 'Menyinkronkan user ke Supabase...', type: 'info' });

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Gagal mendapatkan token Clerk.');

      // Gunakan getAccountForUser — sudah ada logika auto-create jika belum ada
      const synced = await getAccountForUser(
        syncForm.userId.trim(),
        syncForm.email.trim(),
        syncForm.username.trim() || syncForm.email.split('@')[0],
        token
      );

      setSyncMessage({ 
        text: `Berhasil! User "${synced.username}" (${synced.email}) kini ada di Supabase dengan role "${synced.role}".`, 
        type: 'success' 
      });
      setSyncForm({ userId: '', username: '', email: '' });
      syncFormRef.current?.reset();

      // Refresh daftar user
      const updatedUsers = await getAllProfiles(token);
      setAllUsers(updatedUsers);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal sync.';
      setSyncMessage({ text: `Gagal: ${msg}`, type: 'error' });
    } finally {
      setIsSyncingUser(false);
    }
  };

  /**
   * Force re-sync akun admin yang sedang login untuk memastikan profilnya ada di Supabase.
   */
  const handleForceSelfSync = async () => {
    if (!currentAccount) return;
    setIsForcingSelfSync(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Gagal mendapatkan token.');
      await getAccountForUser(currentAccount.id, currentAccount.email, currentAccount.username, token);
      setSyncMessage({ text: `Akun Anda (${currentAccount.username}) berhasil disinkronkan ulang ke Supabase.`, type: 'success' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal.';
      setSyncMessage({ text: `Gagal: ${msg}`, type: 'error' });
    } finally {
      setIsForcingSelfSync(false);
    }
  };

  const manualCount = places.filter((place) => place.source === 'disini_manual').length;
  const pendingCount = places.filter((place) => !place.verified).length;

  const rankedPlaces = useMemo(
    () => rankPlaces(places, { query: '', categoryId: 'all', sortBy: 'recommended', origin, originLabel: 'Admin Center' }),
    [places, origin],
  );

  function handleMapClick(lat: number, lng: number) {
    onManualInputChange('lat', Number(lat.toFixed(6)));
    onManualInputChange('lng', Number(lng.toFixed(6)));
    if (activeTab !== 'manual') setActiveTab('manual');
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) return alert('Browser tidak mendukung Geolocation.');
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onManualInputChange('lat', Number(pos.coords.latitude.toFixed(6)));
        onManualInputChange('lng', Number(pos.coords.longitude.toFixed(6)));
        setIsGettingLocation(false);
      },
      () => {
        alert('Gagal mengambil lokasi.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  }

  async function handleOSMImport() {
    if (!currentAccount) return;
    setIsImporting(true);
    setImportMessage('Mengambil data dari OpenStreetMap...');
    try {
      const osmData = await fetchSurabayaStoresFromOSM();
      if (osmData.length === 0) return setImportMessage('Tidak ada data ditemukan.');
      const limitedData = osmData.slice(0, OSM_IMPORT_LIMIT);
      setImportMessage(`Mengimpor ${limitedData.length} titik...`);
      const token = await getToken({ template: 'supabase' });
      await createBulkPlaces(limitedData, currentAccount, token || undefined);
      setImportMessage(`Berhasil impor. Memperbarui halaman...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setImportMessage('Gagal impor.');
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleUpdatePlace(id: string, updates: Partial<Place>) {
    try {
      const token = await getToken({ template: 'supabase' });
      await updatePlace(id, updates, token || undefined);
      window.location.reload();
    } catch (error) {
      console.error('Update place error:', error);
      alert('Gagal update.');
    }
  }

  async function handleDeletePlace(id: string) {
    if (!window.confirm('Hapus selamanya?')) return;
    try {
      const token = await getToken({ template: 'supabase' });
      await deletePlace(id, token || undefined);
      window.location.reload();
    } catch (error) {
      console.error('Delete place error:', error);
      alert('Gagal hapus.');
    }
  }

  async function handleVerifyPlace(id: string) {
    try {
      const token = await getToken({ template: 'supabase' });
      await verifyPlace(id, token || undefined);
      window.location.reload();
    } catch (error) {
      console.error('Verify place error:', error);
      alert('Gagal verifikasi.');
    }
  }

  const filteredPlaces = places.filter(p => 
    p.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
    p.area.toLowerCase().includes(adminSearch.toLowerCase())
  );

  return (
    <div className="admin-layout-wrapper">
      {/* NAVIGATION TABS */}
      <nav className="admin-nav">
        <button 
          className={`admin-nav-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <Plus size={18} /> Tambah Titik
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === 'osm' ? 'active' : ''}`}
          onClick={() => setActiveTab('osm')}
        >
          <DatabaseZap size={18} /> Impor OSM
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          <LayoutGrid size={18} /> Kelola Titik ({places.length})
        </button>
        {isSuperAdmin && (
          <button 
            className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <UserCog size={18} /> Manajemen User
          </button>
        )}
      </nav>

      <div className="admin-grid">
        {/* KOLOM KIRI (Content Area) */}
        <div className="admin-column admin-content-area">
          
          {/* TAB 1: MANUAL ADD */}
          {activeTab === 'manual' && (
            <section className="manual-form-panel">
              <div className="section-title">
                <Plus size={18} />
                <h2>Tambah titik manual</h2>
              </div>
              <p className="list-hint" style={{ marginBottom: '1.5rem' }}>
                Klik pada peta atau gunakan GPS untuk koordinat otomatis.
              </p>
              <form onSubmit={onAddManualPlace}>
                <div className="form-grid">
                  <label className="full-span">Nama tempat <input required value={manualInput.name} onChange={e => onManualInputChange('name', e.target.value)} /></label>
                  <label>Kategori 
                    <select value={manualInput.categoryId} onChange={e => onManualInputChange('categoryId', e.target.value as CategoryId)}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label>Area <input required value={manualInput.area} onChange={e => onManualInputChange('area', e.target.value)} /></label>
                  <label className="full-span">Alamat singkat <input required value={manualInput.address} onChange={e => onManualInputChange('address', e.target.value)} /></label>
                  <div className="full-span"><button type="button" className="gps-button" onClick={handleUseCurrentLocation} disabled={isGettingLocation}><MapPin size={16} /> {isGettingLocation ? 'Mencari...' : 'Gunakan GPS Saya'}</button></div>
                  <label>Latitude <input required type="number" step="0.000001" value={manualInput.lat} onChange={e => onManualInputChange('lat', Number(e.target.value))} /></label>
                  <label>Longitude <input required type="number" step="0.000001" value={manualInput.lng} onChange={e => onManualInputChange('lng', Number(e.target.value))} /></label>
                  <label>Item utama <input value={manualInput.itemName} onChange={e => onManualInputChange('itemName', e.target.value)} /></label>
                  <label>Harga (Rp) <input type="number" value={manualInput.estimatedPrice} onChange={e => onManualInputChange('estimatedPrice', Number(e.target.value))} /></label>
                </div>
                <button className="submit-button" disabled={isSavingPlace} type="submit"><Plus size={18} /> {isSavingPlace ? 'Menyimpan...' : 'Simpan ke Peta'}</button>
                {formStatus && <p className={`form-status ${formStatus.includes('Gagal') ? 'error' : ''}`}>{formStatus}</p>}
              </form>
            </section>
          )}

          {/* TAB 2: OSM IMPORT */}
          {activeTab === 'osm' && (
            <section className="manual-form-panel">
              <div className="section-title">
                <DatabaseZap size={18} />
                <h2>Impor Data OpenStreetMap</h2>
              </div>
              <div className="admin-tools">
                <p className="admin-hint">Ambil data publik dari OSM secara massal (50 titik per impor).</p>
                <button className="submit-button secondary" onClick={handleOSMImport} disabled={isImporting}>
                  <DatabaseZap size={18} /> {isImporting ? 'Proses...' : 'Jalankan Impor Surabaya'}
                </button>
                {importMessage && <p className="import-status">{importMessage}</p>}
              </div>
            </section>
          )}

          {/* TAB 3: MANAGE PLACES */}
          {activeTab === 'manage' && (
            <section className="admin-manage-section">
              <div className="section-title">
                <Search size={18} />
                <h2>Cari & Edit Titik</h2>
              </div>
              <div className="admin-search-bar">
                <Search size={16} />
                <input placeholder="Cari nama atau area..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} />
              </div>
              <div className="admin-place-list">
                {filteredPlaces.slice(0, 10).map(p => (
                  <AdminPlaceCard key={p.id} place={p} onDelete={handleDeletePlace} onUpdate={handleUpdatePlace} onVerify={handleVerifyPlace} />
                ))}
                {filteredPlaces.length > 10 && <p className="list-hint">Menampilkan 10 dari {filteredPlaces.length} hasil.</p>}
              </div>
            </section>
          )}

          {/* TAB 4: USER MANAGEMENT */}
          {activeTab === 'users' && isSuperAdmin && (
            <section className="user-mgmt-panel">
              <div className="section-title"><UserCog size={18} /> <h2>Kelola Akun Admin</h2></div>

              {/* --- SYNC MANUAL SECTION --- */}
              <div className="sync-user-box">
                <div className="sync-user-header">
                  <div>
                    <h3><UserPlus size={16} /> Sync User dari Clerk</h3>
                    <p>Masukkan data user Clerk yang belum ada di Supabase (misalnya mendaftar saat DB pause).</p>
                  </div>
                  <button 
                    className="sync-self-btn" 
                    onClick={handleForceSelfSync}
                    disabled={isForcingSelfSync}
                    type="button"
                    title="Re-sync akun Anda sendiri ke Supabase"
                  >
                    <RefreshCw size={14} className={isForcingSelfSync ? 'spinning' : ''} />
                    {isForcingSelfSync ? 'Syncing...' : 'Sync Akun Saya'}
                  </button>
                </div>

                <form ref={syncFormRef} className="sync-user-form" onSubmit={handleManualUserSync}>
                  <label>
                    User ID Clerk <span className="required-mark">*</span>
                    <input 
                      required
                      placeholder="user_2xxxxxxxxxxxxxxxxxxx"
                      value={syncForm.userId}
                      onChange={e => setSyncForm(f => ({ ...f, userId: e.target.value }))}
                    />
                  </label>
                  <label>
                    Email <span className="required-mark">*</span>
                    <input 
                      required
                      type="email"
                      placeholder="user@email.com"
                      value={syncForm.email}
                      onChange={e => setSyncForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </label>
                  <div className="sync-form-full">
                    <label>
                      Username <span className="optional-mark">(opsional)</span>
                      <input 
                        placeholder="Akan otomatis dari email jika kosong"
                        value={syncForm.username}
                        onChange={e => setSyncForm(f => ({ ...f, username: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="sync-form-full">
                    <button className="submit-button" type="submit" disabled={isSyncingUser}>
                      <UserPlus size={16} />
                      {isSyncingUser ? 'Menyinkronkan...' : 'Sync ke Supabase'}
                    </button>
                  </div>
                </form>

                {syncMessage && (
                  <div className={`sync-message ${syncMessage.type}`}>
                    {syncMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{syncMessage.text}</span>
                  </div>
                )}
              </div>

              {/* --- DAFTAR USER SUPABASE --- */}
              <div className="user-list-header">
                <h3>User di Supabase ({allUsers.length})</h3>
                <button 
                  className="sync-self-btn" 
                  type="button"
                  onClick={async () => {
                    const token = await getToken({ template: 'supabase' });
                    if (token) setAllUsers(await getAllProfiles(token));
                  }}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <div className="user-table-wrapper">
                <table className="user-table">
                  <thead><tr><th>User</th><th>Role</th></tr></thead>
                  <tbody>
                    {allUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-info-cell">
                            <span>{u.username}</span>
                            <small>{u.email}</small>
                            <code style={{ fontSize: '0.65rem', color: 'var(--ink-400)', fontFamily: 'monospace' }}>{u.id.slice(0, 26)}...</code>
                          </div>
                        </td>
                        <td>
                          {u.id === currentAccount?.id ? <span className="status-badge admin">Anda</span> : (
                            <select className="role-select" value={u.role} disabled={isUpdatingUser === u.id} onChange={e => handleRoleChange(u.id, e.target.value as AppRole)}>
                              <option value="user">User Biasa</option>
                              <option value="location_admin">Location Admin</option>
                              <option value="verifier">Verifier</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SUMMARY INFO (Selalu tampil di bawah konten tab) */}
          <section className="admin-summary" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <div className="metric"><span>{places.length}</span><p>Total Titik</p></div>
            <div className="metric"><span>{pendingCount}</span><p>Belum Verif</p></div>
            <div className="metric"><span>{manualCount}</span><p>Manual</p></div>
          </section>
        </div>

        {/* KOLOM KANAN (PETA) */}
        <div className="admin-map-column">
          <SurabayaMap 
            origin={origin} 
            originLabel="Admin Center" 
            places={rankedPlaces} 
            onSelectPlace={() => {}} 
            onMapClick={handleMapClick} 
            clickedLocation={{ lat: manualInput.lat, lng: manualInput.lng }} 
          />
          <section className="roles-panel">
            <div className="section-title"><ShieldCheck size={18} /> <h2>Status Akses</h2></div>
            <p className="role-row" style={{ fontSize: '0.85rem' }}>
              <strong>{currentAccount?.role}</strong>: {adminRoles.find(r => r.id === currentAccount?.role)?.description}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
