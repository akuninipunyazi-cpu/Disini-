export type AdminRole = 'super_admin' | 'location_admin' | 'verifier' | 'moderator';

export type AppRole = 'user' | AdminRole;

export type PlaceSource = 'external' | 'disini_manual';

export type CategoryId =
  | 'kos_kit'
  | 'atk'
  | 'food'
  | 'laundry'
  | 'print_copy'
  | 'daily_needs'
  | 'service'
  | 'housing';

export type PriceLevel = 1 | 2 | 3 | 4;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Category {
  id: CategoryId;
  label: string;
  description: string;
  searchHints: string[];
}

export interface PlaceItem {
  name: string;
  estimatedPrice: number;
  unit: string;
  tags: string[];
}

export interface Place {
  id: string;
  name: string;
  source: PlaceSource;
  categoryIds: CategoryId[];
  address: string;
  area: string;
  coordinates: Coordinates;
  priceLevel: PriceLevel;
  rating: number;
  openStatus: 'open' | 'busy' | 'unknown';
  verified: boolean;
  notes: string;
  items: PlaceItem[];
  googlePlaceId?: string;
  createdBy?: string;
}

export interface PlaceWithScore extends Place {
  distanceKm: number;
  matchScore: number;
  recommendationScore: number;
}

export interface SearchState {
  query: string;
  categoryId: CategoryId | 'all';
  sortBy: 'recommended' | 'distance' | 'price';
  origin: Coordinates;
  originLabel: string;
}


export interface ManualPlaceInput {
  name: string;
  categoryId: CategoryId;
  address: string;
  area: string;
  lat: number;
  lng: number;
  priceLevel: PriceLevel;
  itemName: string;
  estimatedPrice: number;
  notes: string;
}

export interface ItemRecognition {
  itemName: string;
  categoryId: CategoryId;
  confidence: number;
  searchQuery: string;
}

export interface AuthAccount {
  id: string;
  username: string;
  email: string;
  role: AppRole;
}
