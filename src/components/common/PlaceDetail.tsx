import { Navigation, ExternalLink } from 'lucide-react';
import { PlaceWithScore, SearchState } from '../../types';
import { formatDistance, toExternalMapUrl } from '../../services/maps';
import { formatRupiah } from '../../services/recommendations';
import { SourcePill } from './PlaceResultCard';

interface PlaceDetailProps {
  place: PlaceWithScore;
  origin: SearchState['origin'];
}

export function PlaceDetail({ place, origin }: PlaceDetailProps) {
  return (
    <section className="detail-panel">
      <div className="detail-head">
        <div>
          <SourcePill source={place.source} />
          <h2>{place.name}</h2>
          <p>{place.address}</p>
        </div>
        <span className={`verify-badge ${place.verified ? 'verified' : ''}`}>
          {place.verified ? 'Terverifikasi' : 'Perlu cek'}
        </span>
      </div>

      <div className="detail-grid">
        <span>{formatDistance(place.distanceKm)}</span>
        <span>Level harga {place.priceLevel}</span>
        <span>{place.openStatus === 'open' ? 'Buka' : place.openStatus === 'busy' ? 'Ramai' : 'Cek jam'}</span>
      </div>

      <p className="notes">{place.notes}</p>

      <div className="item-list">
        {place.items.map((item) => (
          <div className="item-row" key={`${place.id}-${item.name}`}>
            <span>{item.name}</span>
            <strong>
              {item.estimatedPrice > 0 ? formatRupiah(item.estimatedPrice) : 'Belum ada harga'}
            </strong>
          </div>
        ))}
      </div>

      <div className="action-row">
        <a
          className="primary-action"
          href={toExternalMapUrl(place, origin)}
          rel="noreferrer"
          target="_blank"
        >
          <Navigation size={17} aria-hidden="true" />
          Buka rute
        </a>
        <a className="secondary-action" href={toExternalMapUrl(place)} rel="noreferrer" target="_blank">
          <ExternalLink size={17} aria-hidden="true" />
          Lihat di Peta
        </a>
      </div>
    </section>
  );
}
