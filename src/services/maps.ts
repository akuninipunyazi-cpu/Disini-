import type { Coordinates, Place } from '../types';

/**
 * Membuat link navigasi ke aplikasi peta eksternal
 */
export function toExternalMapUrl(place: Place, origin?: Coordinates) {
  const lat = place.coordinates.lat;
  const lng = place.coordinates.lng;
  
  // URL universal yang bisa dibuka di Google Maps, Apple Maps, atau browser
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${lat},${lng}&travelmode=driving`;
  }
  
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${lat},${lng}`;
}

export function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}
