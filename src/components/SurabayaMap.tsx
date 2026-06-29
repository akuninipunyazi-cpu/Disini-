import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Coordinates, PlaceWithScore } from '../types';

interface SurabayaMapProps {
  origin: Coordinates; // Titik pusat (lokasi user saat ini)
  originLabel: string; // Label untuk titik pusat
  places: PlaceWithScore[]; // Daftar tempat yang akan ditampilkan di peta
  selectedPlaceId?: string; // ID tempat yang sedang dipilih/diklik
  onSelectPlace: (placeId: string) => void; // Callback saat marker tempat diklik
  onMapClick?: (lat: number, lng: number) => void; // Callback saat peta diklik (untuk admin)
  clickedLocation?: Coordinates | null; // Titik sementara saat admin klik peta
}

/**
 * Membuat icon marker untuk tempat/toko.
 * Membedakan warna berdasarkan sumber (Google vs Manual) dan status terpilih.
 */
function createPlaceIcon(place: PlaceWithScore, index: number, selectedPlaceId?: string) {
  const sourceClass = place.source === 'external' ? 'google' : 'manual';
  const selectedClass = place.id === selectedPlaceId ? 'selected' : '';

  return L.divIcon({
    className: 'real-map-icon',
    html: `<span class="real-map-marker ${sourceClass} ${selectedClass}">${index + 1}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/**
 * Membuat icon marker untuk lokasi user saat ini.
 */
function createOriginIcon() {
  return L.divIcon({
    className: 'real-map-icon',
    html: '<span class="real-map-origin">Saya</span>',
    iconSize: [58, 34],
    iconAnchor: [29, 17],
  });
}

/**
 * Membuat icon marker untuk titik yang diklik oleh admin.
 */
function createClickedIcon() {
  return L.divIcon({
    className: 'real-map-icon',
    html: '<span class="real-map-marker selected">!</span>',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

export function SurabayaMap({
  origin,
  originLabel,
  places,
  selectedPlaceId,
  onSelectPlace,
  onMapClick,
  clickedLocation,
}: SurabayaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null); // Referensi ke elemen DOM peta
  const mapRef = useRef<L.Map | null>(null); // Referensi ke instance Leaflet Map
  const layerRef = useRef<L.LayerGroup | null>(null); // Layer khusus untuk menampung marker agar mudah dihapus/update

  /**
   * EFFECT: Inisialisasi peta pertama kali.
   */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    // Inisialisasi peta Leaflet
    const map = L.map(containerRef.current, {
      center: [origin.lat, origin.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Menggunakan provider OpenStreetMap (Gratis)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    // Cleanup saat komponen dimatikan
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [origin.lat, origin.lng]);

  /**
   * EFFECT: Setup listener klik pada peta (khusus Admin).
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (onMapClick) {
      const clickHandler = (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      };
      map.on('click', clickHandler);
      return () => {
        map.off('click', clickHandler);
      };
    }
  }, [onMapClick]);

  /**
   * EFFECT: Merender marker (User, Klik Admin, dan Tempat) setiap ada perubahan data.
   */
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) {
      return;
    }

    // Bersihkan layer lama sebelum merender yang baru
    layer.clearLayers();

    // Render penanda lokasi "Saya"
    L.marker([origin.lat, origin.lng], { icon: createOriginIcon(), zIndexOffset: 1000 })
      .bindTooltip(originLabel)
      .addTo(layer);

    // Render penanda untuk lokasi yang baru saja diklik admin di peta
    if (clickedLocation) {
      L.marker([clickedLocation.lat, clickedLocation.lng], { 
        icon: createClickedIcon(),
        zIndexOffset: 1500 
      })
      .bindTooltip("Titik yang dipilih")
      .addTo(layer);
    }

    // Render semua marker tempat/toko
    places.forEach((place, index) => {
      L.marker([place.coordinates.lat, place.coordinates.lng], {
        icon: createPlaceIcon(place, index, selectedPlaceId),
      })
        .on('click', () => onSelectPlace(place.id)) // Aktifkan detail saat marker diklik
        .bindTooltip(`${place.name} - ${place.area}`)
        .addTo(layer);
    });
  }, [onSelectPlace, origin.lat, origin.lng, originLabel, places, selectedPlaceId, clickedLocation]);

  /**
   * EFFECT: Auto-Fit. Menyesuaikan area peta agar semua marker terlihat di layar.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const bounds = L.latLngBounds([[origin.lat, origin.lng]]);

    places.forEach((place) => {
      bounds.extend([place.coordinates.lat, place.coordinates.lng]);
    });

    // Pindah posisi peta agar mencakup semua titik dengan padding yang pas
    map.fitBounds(bounds, {
      animate: false,
      maxZoom: 15,
      padding: [34, 34],
    });
  }, [origin.lat, origin.lng, places]);

  /**
   * EFFECT: Fix ukuran peta jika terjadi perubahan layout mendadak.
   */
  useEffect(() => {
    window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, []);

  return (
    <section className="map-panel" aria-label="Peta rekomendasi DiSini">
      <div className="map-header">
        <div className="section-title compact">
          <Route size={18} aria-hidden="true" />
          <h2>Peta Surabaya</h2>
        </div>
        <p>{places.length} titik relevan</p>
      </div>
      {/* Container utama untuk Leaflet Map */}
      <div ref={containerRef} className="leaflet-map" />
    </section>
  );
}
