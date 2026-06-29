import { CategoryId, ManualPlaceInput } from '../types';

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:suburb'?: string;
    shop?: string;
    amenity?: string;
    [key: string]: string | undefined;
  };
}

export async function fetchSurabayaStoresFromOSM(): Promise<ManualPlaceInput[]> {
  // Bounding Box di sekitar UPN Veteran Jawa Timur (Gunung Anyar, Wonorejo, Kutisari)
  // Sekitar: -7.345, 112.770 (South West) ke -7.310, 112.805 (North East)
  const bbox = '-7.345,112.770,-7.310,112.805';
  
  const query = `
    [out:json][timeout:90];
    (
      // Toko Kelontong / Warung Madura
      nwr["shop"~"convenience|supermarket|grocery"](${bbox});
      // Warteg / Rumah Makan / Cafe
      nwr["amenity"~"restaurant|cafe|fast_food|food_court"](${bbox});
      // Laundry
      nwr["amenity"="laundry"](${bbox});
      // ATK / Fotocopy
      nwr["shop"~"stationery|books|copy_shop"](${bbox});
      // Galon / Air Minum / Water
      nwr["craft"="water_filter"](${bbox});
      nwr["amenity"="water_point"](${bbox});
      nwr["shop"="water"](${bbox});
      // Pasar Tradisional
      nwr["amenity"="marketplace"](${bbox});
      nwr["shop"="marketplace"](${bbox});
    );
    out center;
  `;

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    console.log('Fetching local stores near UPN Veteran...');
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Overpass Response Error:', errorText);
      throw new Error('Gagal mengambil data dari Overpass API');
    }
    
    const data = await response.json();
    const elements: OSMElement[] = data.elements || [];
    console.log(`Ditemukan ${elements.length} elemen di sekitar UPN.`);

    return elements
      .filter(el => el.tags?.name)
      .map((el): ManualPlaceInput | null => {
        const tags = el.tags!;
        const name = tags.name!;
        
        const lat = el.center?.lat ?? el.lat ?? 0;
        const lng = el.center?.lon ?? el.lon ?? 0;
        
        if (lat === 0 && lng === 0) return null;

        // Mapping kategori lebih detail
        let categoryId: CategoryId = 'daily_needs';
        const lowerName = name.toLowerCase();
        const shop = tags.shop || '';
        const amenity = tags.amenity || '';

        if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe' || lowerName.includes('warteg') || lowerName.includes('warung')) {
          categoryId = 'food';
        } else if (amenity === 'laundry') {
          categoryId = 'laundry';
        } else if (shop === 'stationery' || shop === 'copy_shop' || lowerName.includes('fotocopy') || lowerName.includes('atk')) {
          categoryId = 'atk';
        } else if (shop === 'convenience' || shop === 'supermarket' || lowerName.includes('madura') || lowerName.includes('toko')) {
          categoryId = 'daily_needs';
        } else if (amenity === 'marketplace' || lowerName.includes('pasar')) {
          categoryId = 'daily_needs';
        }
        
        const street = tags['addr:street'] || '';
        const suburb = tags['addr:suburb'] || '';
        const address = street ? street : 'Surabaya';
        const area = suburb || 'Gunung Anyar / Rungkut';

        return {
          name,
          categoryId,
          address,
          area,
          lat,
          lng,
          priceLevel: 1,
          itemName: 'Data dari OpenStreetMap',
          estimatedPrice: 0,
          notes: `Data lokal diimpor dari OSM (${el.type} ID: ${el.id})`,
        };
      })
      .filter((item): item is ManualPlaceInput => item !== null);
  } catch (error) {
    console.error('OSM Fetch Error:', error);
    return [];
  }
}
