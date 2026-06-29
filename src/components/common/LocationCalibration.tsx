import { Crosshair, MapPinned, LocateFixed, Navigation } from 'lucide-react';
import { SearchState } from '../../types';

interface LocationCalibrationProps {
  locationStatus: string;
  onSearchChange: (nextSearch: Partial<SearchState>) => void;
  onUseBrowserLocation: () => void;
  search: SearchState;
}

export function LocationCalibration({
  locationStatus,
  onSearchChange,
  onUseBrowserLocation,
  search,
}: LocationCalibrationProps) {
  return (
    <section className="calibration-panel">
      <div className="calibration-head">
        <div className="section-title compact">
          <Crosshair size={18} aria-hidden="true" />
          <h2>Kalibrasi lokasi</h2>
        </div>
        <span>Surabaya</span>
      </div>

      <div className="current-location">
        <MapPinned size={19} aria-hidden="true" />
        <div>
          <strong>{search.originLabel}</strong>
          <p>
            {search.origin.lat.toFixed(5)}, {search.origin.lng.toFixed(5)}
          </p>
        </div>
      </div>

      <div className="calibration-divider">
        <span>Opsi Kalibrasi</span>
      </div>

      <div className="calibration-methods">
        <button className="secondary-action browser-btn" type="button" onClick={onUseBrowserLocation}>
          <LocateFixed size={17} aria-hidden="true" />
          Gunakan Ulang Lokasi Browser
        </button>
      </div>

      <p className="calibration-status">{locationStatus}</p>

      <div className="main-search-action">
        <button
          className="primary-action"
          type="button"
          onClick={() => onSearchChange({ sortBy: 'distance' })}
        >
          <Navigation size={18} aria-hidden="true" />
          Cari Lokasi Terdekat Saya
        </button>
      </div>
    </section>
  );
}
