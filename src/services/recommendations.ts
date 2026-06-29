import { categoryById } from '../data/categories';
import type { Coordinates, Place, PlaceWithScore, SearchState } from '../types';

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(origin: Coordinates, destination: Coordinates) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(destination.lat - origin.lat);
  const lngDistance = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const haversine =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function getSearchText(place: Place) {
  const categories = place.categoryIds
    .map((categoryId) => categoryById[categoryId])
    .filter(Boolean)
    .flatMap((category) => [category.label, category.description, ...category.searchHints]);

  const items = place.items.flatMap((item) => [item.name, ...item.tags]);

  return normalize(
    [place.name, place.address, place.area, place.notes, ...categories, ...items].join(' '),
  );
}

function calculateMatchScore(place: Place, query: string) {
  const cleanedQuery = normalize(query);

  if (!cleanedQuery) {
    return 0.65;
  }

  const tokens = cleanedQuery.split(/\s+/).filter(Boolean);
  const searchText = getSearchText(place);
  const hits = tokens.filter((token) => searchText.includes(token)).length;

  return hits / tokens.length;
}

function placeMatchesCategory(place: Place, categoryId: SearchState['categoryId']) {
  return categoryId === 'all' || place.categoryIds.includes(categoryId);
}

export function rankPlaces(places: Place[], search: SearchState): PlaceWithScore[] {
  const hasCategoryFilter = search.categoryId !== 'all';

  const ranked = places
    .filter((place) => placeMatchesCategory(place, search.categoryId))
    .map((place) => {
      const distanceKm = calculateDistanceKm(search.origin, place.coordinates);
      const matchScore = calculateMatchScore(place, search.query);
      const affordability = (5 - place.priceLevel) / 4;
      const distanceScore = Math.max(0, 1 - distanceKm / 7);
      const trustScore = place.verified ? 1 : 0.7;
      const recommendationScore =
        matchScore * 0.4 + affordability * 0.25 + distanceScore * 0.25 + trustScore * 0.1;

      return {
        ...place,
        distanceKm,
        matchScore,
        recommendationScore,
      };
    })
    .filter((place) => hasCategoryFilter || !search.query || place.matchScore > 0);

  return ranked.sort((a, b) => {
    if (search.sortBy === 'distance') {
      return a.distanceKm - b.distanceKm;
    }

    if (search.sortBy === 'price') {
      return a.priceLevel - b.priceLevel || a.distanceKm - b.distanceKm;
    }

    return b.recommendationScore - a.recommendationScore;
  });
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
