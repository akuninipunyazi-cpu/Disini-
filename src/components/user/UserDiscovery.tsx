import { ChangeEvent } from 'react';
import { SlidersHorizontal, Search, Sparkles, Camera, CheckCircle2, Store } from 'lucide-react';
import { PlaceWithScore, SearchState, ItemRecognition, CategoryId } from '../../types';
import { categories, categoryById } from '../../data/categories';
import { LocationCalibration } from '../common/LocationCalibration';
import { PlaceResultCard } from '../common/PlaceResultCard';
import { SurabayaMap } from '../SurabayaMap';
import { PlaceDetail } from '../common/PlaceDetail';

interface UserDiscoveryProps {
  isScanning: boolean;
  locationStatus: string;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearchChange: (nextSearch: Partial<SearchState>) => void;
  onUseBrowserLocation: () => void;
  places: PlaceWithScore[];
  recognition: ItemRecognition | null;
  search: SearchState;
  selectedPlace?: PlaceWithScore;
  selectedPlaceId: string;
  setSelectedPlaceId: (placeId: string) => void;
}

export function UserDiscovery({
  isScanning,
  locationStatus,
  onImageUpload,
  onSearchChange,
  onUseBrowserLocation,
  places,
  recognition,
  search,
  selectedPlace,
  selectedPlaceId,
  setSelectedPlaceId,
}: UserDiscoveryProps) {
  const isSearching = search.query.trim().length > 0 || search.categoryId !== 'all';
  const visiblePlaces = isSearching ? places : [];
  const visibleSelectedPlace = isSearching ? selectedPlace : undefined;

  return (
    <section className="workspace-grid">
      <div className="search-column">
        <LocationCalibration
          locationStatus={locationStatus}
          onSearchChange={onSearchChange}
          onUseBrowserLocation={onUseBrowserLocation}
          search={search}
        />

        <section className="search-panel">
          <div className="section-title">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>Cari kebutuhan</h2>
          </div>

          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Cari barang atau jasa"
              placeholder="Contoh: meja lipat, ATK, galon, print tugas"
              value={search.query}
              onChange={(event) => onSearchChange({ query: event.target.value })}
            />
          </label>

          <div className="filter-row">
            <label>
              Kategori
              <select
                value={search.categoryId}
                onChange={(event) =>
                  onSearchChange({ categoryId: event.target.value as CategoryId | 'all' })
                }
              >
                <option value="all">Semua kebutuhan</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Urutkan
              <select
                value={search.sortBy}
                onChange={(event) =>
                  onSearchChange({ sortBy: event.target.value as SearchState['sortBy'] })
                }
              >
                <option value="recommended">Paling cocok</option>
                <option value="distance">Terdekat dari saya</option>
                <option value="price">Termurah</option>
              </select>
            </label>
          </div>

          <div className="ai-panel">
            <div>
              <div className="section-title compact">
                <Sparkles size={17} aria-hidden="true" />
                <h3>Foto barang</h3>
              </div>
              <p>
                Upload foto barang, DiSini! akan mengenali barang dan mencarikan kategori toko
                terdekat yang sesuai.
              </p>
            </div>
            <label className="upload-button">
              <Camera size={17} aria-hidden="true" />
              {isScanning ? 'Membaca...' : 'Upload'}
              <input type="file" accept="image/*" onChange={onImageUpload} />
            </label>
          </div>

          {recognition ? (
            <div className="recognition-result">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                <strong>DiSini! AI mendeteksi barang {recognition.itemName}</strong> dan termasuk ke kategori <strong>{categoryById[recognition.categoryId].label}</strong>.
              </span>
            </div>
          ) : null}
        </section>

        {!isSearching ? (
          <section className="welcome-hero">
            <Sparkles size={32} className="sparkle-icon" />
            <h2>Halo, Mau cari apa hari ini?</h2>
            <p>Masukkan kata kunci atau pilih kategori di atas untuk melihat rekomendasi tempat terdekat di Surabaya.</p>
            <div className="quick-categories">
              {categories.slice(0, 4).map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => onSearchChange({ categoryId: cat.id })}
                  className="quick-cat-btn"
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="result-list" aria-label="Rekomendasi tempat">
            <div className="result-count-info">
              Ditemukan {places.length} tempat yang cocok
            </div>
            {places.length > 0 ? (
              places.map((place, index) => (
                <PlaceResultCard
                  index={index}
                  key={place.id}
                  onSelect={() => setSelectedPlaceId(place.id)}
                  place={place}
                  selected={place.id === selectedPlaceId}
                />
              ))
            ) : (
              <div className="empty-state">
                <Store size={24} aria-hidden="true" />
                <p>Belum ada tempat yang cocok. Coba kata kunci lain atau tambah titik dari admin.</p>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="map-column">
        <SurabayaMap
          origin={search.origin}
          originLabel={search.originLabel}
          places={visiblePlaces}
          selectedPlaceId={visibleSelectedPlace?.id}
          onSelectPlace={setSelectedPlaceId}
        />
        {visibleSelectedPlace ? <PlaceDetail place={visibleSelectedPlace} origin={search.origin} /> : null}
      </div>
    </section>
  );
}
