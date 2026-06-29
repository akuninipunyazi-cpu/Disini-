import { categoryById } from '../data/categories';
import { seedPlaces } from '../data/places';
import { isSupabaseConfigured, supabase, createClerkSupabaseClient } from '../lib/supabaseClient';
import type {
  AuthAccount,
  CategoryId,
  ManualPlaceInput,
  Place,
  PlaceItem,
  PlaceSource,
  PriceLevel,
} from '../types';

/** 
 * Representasi baris data barang (items) di database Supabase.
 */
interface PlaceItemRow {
  id: string;
  name: string;
  estimated_price: number;
  unit: string;
  tags: string[];
}

/** 
 * Representasi baris data tempat (places) di database Supabase.
 */
interface PlaceRow {
  id: string;
  name: string;
  source: PlaceSource;
  category_ids: Place['categoryIds'];
  address: string;
  area: string;
  lat: number;
  lng: number;
  price_level: PriceLevel;
  rating: number;
  open_status: Place['openStatus'];
  verified: boolean;
  notes: string;
  google_place_id: string | null;
  created_by: string | null;
  place_items?: PlaceItemRow[];
}

/** Payload untuk update data tempat */
type PlaceUpdatePayload = Partial<{
  name: string;
  address: string;
  area: string;
  category_ids: Place['categoryIds'];
  lat: number;
  lng: number;
  price_level: PriceLevel;
  notes: string;
  verified: boolean;
}>;

/** Payload untuk update data barang */
type ItemUpdatePayload = Partial<{
  name: string;
  estimated_price: number;
  unit: string;
  tags: string[];
}>;

export interface PlaceLoadResult {
  places: Place[];
  source: 'supabase' | 'seed';
  message: string;
}

/**
 * Mapper: Mengubah format data barang dari Database (snake_case) ke format App (camelCase).
 */
function mapPlaceItem(row: PlaceItemRow): PlaceItem {
  return {
    name: row.name,
    estimatedPrice: Number(row.estimated_price),
    unit: row.unit,
    tags: row.tags ?? [],
  };
}

/**
 * Mapper: Mengubah format data tempat dari Database ke format App.
 */
function mapPlaceRow(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    categoryIds: row.category_ids,
    address: row.address,
    area: row.area,
    coordinates: {
      lat: Number(row.lat),
      lng: Number(row.lng),
    },
    priceLevel: row.price_level,
    rating: Number(row.rating),
    openStatus: row.open_status,
    verified: row.verified,
    notes: row.notes,
    googlePlaceId: row.google_place_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    items: (row.place_items ?? []).map(mapPlaceItem),
  };
}

/**
 * Mengambil semua daftar tempat dari Supabase.
 * Jika Supabase tidak aktif, akan mengembalikan data simulasi (seed).
 */
export async function loadPlaces(): Promise<PlaceLoadResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      places: seedPlaces,
      source: 'seed',
      message: 'Mode demo: Supabase belum dikonfigurasi, memakai seed lokal.',
    };
  }

  // Mengambil data tempat beserta relasi barangnya (items)
  const { data, error } = await supabase
    .from('places')
    .select('*, items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return {
      places: seedPlaces,
      source: 'seed',
      message: `Supabase gagal dibaca (${error.message}), memakai seed lokal.`,
    };
  }

  return {
    places: (data ?? []).map((row) => mapPlaceRow({
      ...row,
      place_items: row.items
    } as PlaceRow)),
    source: 'supabase',
    message: 'Data tempat aktif dari Supabase.',
  };
}

/**
 * Membuat satu titik/tempat baru secara manual (Admin Only).
 */
export async function createManualPlace(input: ManualPlaceInput, account: AuthAccount, clerkToken?: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  // Gunakan client khusus dengan token Clerk agar Row Level Security (RLS) mengizinkan penulisan data
  const client = clerkToken ? createClerkSupabaseClient(clerkToken) : supabase;

  const notes = input.notes || 'Titik manual baru, perlu verifikasi lapangan.';
  const fallbackItemName = categoryById[input.categoryId].label;

  // 1. Simpan data tempat (Header)
  const { data: place, error: placeError } = await client
    .from('places')
    .insert({
      name: input.name,
      source: 'disini_manual',
      category_ids: [input.categoryId],
      address: input.address,
      area: input.area,
      lat: input.lat,
      lng: input.lng,
      price_level: input.priceLevel,
      rating: 4.1,
      open_status: 'unknown',
      verified: true, // Titik yang dibuat admin otomatis dianggap terverifikasi
      notes,
      created_by: account.id,
    })
    .select('*')
    .single();

  if (placeError) {
    throw new Error(placeError.message);
  }

  // 2. Simpan data barang utama (Detail)
  const { data: item, error: itemError } = await client
    .from('items')
    .insert({
      place_id: place.id,
      name: input.itemName || fallbackItemName,
      estimated_price: input.estimatedPrice || 0,
      unit: input.estimatedPrice > 0 ? 'estimasi' : 'belum diisi',
      tags: [categoryById[input.categoryId].label.toLowerCase()],
    })
    .select('*')
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  // Gabungkan hasil dan kembalikan dalam format TypeScript object
  return mapPlaceRow({
    ...(place as PlaceRow),
    place_items: [item as PlaceItemRow],
  });
}

/**
 * Membuat tempat dalam jumlah banyak sekaligus (Batch Import).
 */
export async function createBulkPlaces(inputs: ManualPlaceInput[], account: AuthAccount, clerkToken?: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const client = clerkToken ? createClerkSupabaseClient(clerkToken) : supabase;
  const results: Place[] = [];

  // Proses per batch (misal 10 data sekali jalan) untuk menghindari timeout
  const batchSize = 10;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    
    // Simpan banyak tempat sekaligus
    const { data: places, error: placesError } = await client
      .from('places')
      .insert(batch.map(input => ({
        name: input.name,
        source: 'disini_manual',
        category_ids: [input.categoryId],
        address: input.address,
        area: input.area,
        lat: input.lat,
        lng: input.lng,
        price_level: input.priceLevel,
        rating: 4.0,
        open_status: 'unknown',
        verified: false,
        notes: input.notes,
        created_by: account.id,
      })))
      .select('*');

    if (placesError) {
      console.error('Batch Place Error:', placesError);
      continue;
    }

    // Simpan item-item terkait tempat tersebut
    const itemsToInsert = (places || []).map((place, idx) => {
      const input = batch[idx];
      return {
        place_id: place.id,
        name: input.itemName || categoryById[input.categoryId].label,
        estimated_price: input.estimatedPrice || 0,
        unit: 'estimasi',
        tags: [categoryById[input.categoryId].label.toLowerCase()],
      };
    });

    const { data: items, error: itemsError } = await client
      .from('items')
      .insert(itemsToInsert)
      .select('*');

    if (itemsError) {
      console.error('Batch Item Error:', itemsError);
    }

    if (places) {
      places.forEach(p => {
        const placeItems = (items || []).filter(item => item.place_id === p.id);
        results.push(mapPlaceRow({
          ...p,
          place_items: placeItems
        } as PlaceRow));
      });
    }
  }

  return results;
}

/**
 * Mengupdate data tempat dan barang utamanya.
 */
export async function updatePlace(placeId: string, updates: Partial<Place>, clerkToken?: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const client = clerkToken ? createClerkSupabaseClient(clerkToken) : supabase;

  // Mapping data update dari App ke format DB
  const dbUpdates: PlaceUpdatePayload = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.address) dbUpdates.address = updates.address;
  if (updates.area) dbUpdates.area = updates.area;
  
  if (updates.categoryIds) {
    dbUpdates.category_ids = Array.isArray(updates.categoryIds) 
      ? updates.categoryIds 
      : [updates.categoryIds];
  }

  if (updates.coordinates) {
    dbUpdates.lat = updates.coordinates.lat;
    dbUpdates.lng = updates.coordinates.lng;
  }
  
  if (updates.priceLevel) dbUpdates.price_level = updates.priceLevel;
  if (updates.notes) dbUpdates.notes = updates.notes;
  if (typeof updates.verified === 'boolean') dbUpdates.verified = updates.verified;

  // Eksekusi update tempat
  const { data: updatedData, error: updateError } = await client
    .from('places')
    .update(dbUpdates)
    .filter('id', 'eq', placeId.toString())
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updatedData) {
    throw new Error('Titik tidak ditemukan atau Anda tidak memiliki izin untuk mengupdate.');
  }

  // Update data barang jika ada perubahan pada items
  const primaryItem = updates.items?.[0];
  if (primaryItem) {
    const categoryId = (updates.categoryIds?.[0] ?? updatedData.category_ids?.[0]) as
      | CategoryId
      | undefined;
    const fallbackItemName = categoryId ? categoryById[categoryId]?.label : 'Data tempat';
    
    const itemPayload: ItemUpdatePayload = {
      name: primaryItem.name || fallbackItemName,
      estimated_price: primaryItem.estimatedPrice || 0,
      unit: primaryItem.estimatedPrice > 0 ? primaryItem.unit || 'estimasi' : 'belum diisi',
      tags: primaryItem.tags?.length
        ? primaryItem.tags
        : categoryId && categoryById[categoryId]
          ? [categoryById[categoryId].label.toLowerCase()]
          : [],
    };

    // Cek apakah item sudah ada atau perlu insert baru
    const { data: existingItem } = await client
      .from('items')
      .select('id')
      .eq('place_id', placeId)
      .limit(1)
      .maybeSingle();

    if (existingItem?.id) {
      await client.from('items').update(itemPayload).eq('id', existingItem.id);
    } else {
      await client.from('items').insert({ ...itemPayload, place_id: placeId });
    }
  }

  // Ambil data terbaru setelah diupdate untuk dikembalikan ke UI
  const { data: refreshedPlace } = await client
    .from('places')
    .select('*, items(*)')
    .eq('id', placeId)
    .maybeSingle();

  return mapPlaceRow({ ...refreshedPlace, place_items: refreshedPlace.items } as PlaceRow);
}

/**
 * Menghapus tempat dan semua barang terkait secara permanen.
 */
export async function deletePlace(placeId: string, clerkToken?: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const client = clerkToken ? createClerkSupabaseClient(clerkToken) : supabase;

  // Hapus detail barang dulu untuk menghindari error Foreign Key
  await client.from('items').delete().eq('place_id', placeId);

  // Hapus data tempat
  const { error } = await client
    .from('places')
    .delete()
    .eq('id', placeId);

  if (error) {
    throw new Error(error.message);
  }
  return true;
}

/**
 * Menandai tempat sebagai terverifikasi.
 */
export async function verifyPlace(placeId: string, clerkToken?: string) {
  return updatePlace(placeId, { verified: true }, clerkToken);
}
