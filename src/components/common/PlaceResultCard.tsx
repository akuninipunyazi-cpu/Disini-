import { MapPin, Star } from 'lucide-react';
import { PlaceWithScore, Place } from '../../types';
import { formatDistance } from '../../services/maps';
import { formatRupiah } from '../../services/recommendations';

interface PlaceResultCardProps {
  index: number;
  onSelect: () => void;
  place: PlaceWithScore;
  selected: boolean;
}

export function SourcePill({ source, verified }: { source: Place['source']; verified?: boolean }) {
  if (verified) return <span className="verify-badge verified">Terverifikasi</span>;
  return (
    <span className={`source-pill ${source}`}>
      {source === 'external' ? 'Eksternal' : 'Manual'}
    </span>
  );
}

export function PlaceResultCard({ onSelect, place, selected }: PlaceResultCardProps) {
  const cheapestItem = place.items.reduce((lowest, item) => {
    if (!lowest || item.estimatedPrice < lowest.estimatedPrice) return item;
    return lowest;
  }, place.items[0]);

  return (
    <button className={`place-card ${selected ? 'selected' : ''}`} type="button" onClick={onSelect}>
      <div className="place-card-head">
        <div>
          <h3>{place.name}</h3>
          <p>{place.area}</p>
        </div>
        <SourcePill source={place.source} verified={place.verified} />
      </div>

      <div className="place-meta">
        <span className="meta-item">
          <MapPin size={14} strokeWidth={2.5} />
          {formatDistance(place.distanceKm)}
        </span>
        <span className="meta-item">
          <Star size={14} strokeWidth={2.5} />
          {place.rating.toFixed(1)}
        </span>
        <span className="meta-item">Rp{place.priceLevel}</span>
      </div>

      {cheapestItem && (
        <p className="price-line">
          {cheapestItem.name} - <strong>{formatRupiah(cheapestItem.estimatedPrice)}</strong>
        </p>
      )}
    </button>
  );
}
