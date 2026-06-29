import { useState } from 'react';
import { CheckCircle, Edit3, Save, Trash2, X } from 'lucide-react';
import { categories, categoryById } from '../../data/categories';
import { CategoryId, Place } from '../../types';

interface AdminPlaceCardProps {
  place: Place;
  onUpdate: (placeId: string, updates: Partial<Place>) => Promise<void>;
  onDelete: (placeId: string) => Promise<void>;
  onVerify: (placeId: string) => Promise<void>;
}

export function AdminPlaceCard({ place, onUpdate, onDelete, onVerify }: AdminPlaceCardProps) {
  const primaryItem = place.items[0];
  const initialCategoryIds = place.categoryIds.length > 0 ? place.categoryIds : ['daily_needs'];
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [editData, setEditData] = useState({
    name: place.name,
    address: place.address,
    area: place.area,
    categoryIds: initialCategoryIds as CategoryId[],
    lat: place.coordinates.lat,
    lng: place.coordinates.lng,
    itemName: primaryItem?.name || '',
    estimatedPrice: primaryItem?.estimatedPrice || 0,
  });

  function toggleCategory(categoryId: CategoryId) {
    setEditData((current) => {
      const isSelected = current.categoryIds.includes(categoryId);
      const nextCategoryIds = isSelected
        ? current.categoryIds.filter((selectedCategoryId) => selectedCategoryId !== categoryId)
        : [...current.categoryIds, categoryId];

      return {
        ...current,
        categoryIds: nextCategoryIds.length > 0 ? nextCategoryIds : current.categoryIds,
      };
    });
  }

  async function handleSave() {
    setIsBusy(true);
    try {
      await onUpdate(place.id, {
        name: editData.name,
        address: editData.address,
        area: editData.area,
        categoryIds: editData.categoryIds,
        coordinates: {
          lat: editData.lat,
          lng: editData.lng,
        },
        items: [
          {
            name: editData.itemName,
            estimatedPrice: editData.estimatedPrice,
            unit: editData.estimatedPrice > 0 ? 'estimasi' : 'belum diisi',
            tags: editData.categoryIds.map((categoryId) => categoryById[categoryId].label.toLowerCase()),
          },
        ],
      });
      setIsEditing(false);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className={`admin-place-card ${place.verified ? 'verified' : 'pending'}`}>
      <div className="card-header">
        <h3>
          {place.name}
          {place.verified && <CheckCircle size={14} className="icon-verified" />}
        </h3>

        <div className="card-actions">
          {!place.verified && !isEditing && (
            <button onClick={() => onVerify(place.id)} title="Verifikasi" type="button">
              <CheckCircle size={18} />
            </button>
          )}
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} title="Edit" type="button">
              <Edit3 size={18} />
            </button>
          )}
          <button
            onClick={() => onDelete(place.id)}
            className="btn-delete"
            title="Hapus"
            type="button"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="card-body">
        {isEditing ? (
          <form
            className="admin-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="form-grid">
              <label className="full-span">
                Nama tempat
                <input
                  required
                  value={editData.name}
                  onChange={(event) => setEditData({ ...editData, name: event.target.value })}
                  placeholder="Contoh: Toko Rak Keputih"
                />
              </label>

              <fieldset className="category-checklist full-span">
                <legend>Kategori</legend>
                <div>
                  {categories.map((category) => (
                    <label className="category-option" key={category.id}>
                      <input
                        checked={editData.categoryIds.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        type="checkbox"
                      />
                      <span>{category.label}</span>
                    </label>
                  ))}
                </div>
                <p>Pilih lebih dari satu jika tempat ini melayani beberapa kebutuhan.</p>
              </fieldset>

              <label>
                Area
                <input
                  required
                  value={editData.area}
                  onChange={(event) => setEditData({ ...editData, area: event.target.value })}
                  placeholder="Contoh: Keputih"
                />
              </label>

              <label className="full-span">
                Alamat singkat
                <input
                  required
                  value={editData.address}
                  onChange={(event) => setEditData({ ...editData, address: event.target.value })}
                  placeholder="Gang, patokan, atau nama jalan"
                />
              </label>

              <label>
                Latitude
                <input
                  required
                  type="number"
                  step="0.000001"
                  value={editData.lat}
                  onChange={(event) => setEditData({ ...editData, lat: Number(event.target.value) })}
                />
              </label>

              <label>
                Longitude
                <input
                  required
                  type="number"
                  step="0.000001"
                  value={editData.lng}
                  onChange={(event) => setEditData({ ...editData, lng: Number(event.target.value) })}
                />
              </label>

              <label>
                Item utama
                <input
                  value={editData.itemName}
                  onChange={(event) => setEditData({ ...editData, itemName: event.target.value })}
                  placeholder="Contoh: Meja kecil kayu"
                />
              </label>

              <label>
                Harga (Rp)
                <input
                  min="0"
                  type="number"
                  value={editData.estimatedPrice}
                  onChange={(event) =>
                    setEditData({ ...editData, estimatedPrice: Number(event.target.value) })
                  }
                />
              </label>
            </div>

            <div className="admin-edit-actions">
              <button className="submit-button" disabled={isBusy} type="submit">
                <Save size={18} />
                {isBusy ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <button
                className="secondary-action"
                disabled={isBusy}
                type="button"
                onClick={() => setIsEditing(false)}
              >
                <X size={18} />
                Batal
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="area">Lokasi: {place.area}</p>
            <p className="address">{place.address}</p>
            <div className="admin-card-badges">
              {place.categoryIds.map((categoryId) => (
                <span className="badge-category" key={categoryId}>
                  {categoryById[categoryId]?.label ?? categoryId}
                </span>
              ))}
              <span>{place.coordinates.lat.toFixed(5)}, {place.coordinates.lng.toFixed(5)}</span>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
