import type { Category } from '../types';

export const categories: Category[] = [
  {
    id: 'kos_kit',
    label: 'Peralatan kos',
    description: 'Meja lipat, kasur, bantal, rak, kipas, kabel roll, ember, dan barang kamar.',
    searchHints: [
      'meja',
      'kasur',
      'bantal',
      'guling',
      'sprei',
      'selimut',
      'rak',
      'kipas',
      'kabel',
      'ember',
      'gantungan',
    ],
  },
  {
    id: 'atk',
    label: 'ATK & kuliah',
    description: 'Pulpen, buku, map, binder, alat gambar, dan kebutuhan tugas.',
    searchHints: ['atk', 'pulpen', 'buku', 'binder', 'map', 'alat tulis'],
  },
  {
    id: 'food',
    label: 'Makan murah',
    description: 'Warung hemat, lauk rumahan, nasi porsi besar, dan paket mahasiswa.',
    searchHints: ['makan', 'warung', 'nasi', 'ayam', 'hemat', 'murah'],
  },
  {
    id: 'laundry',
    label: 'Laundry',
    description: 'Laundry kiloan, satuan, express, setrika, dan antar jemput.',
    searchHints: ['laundry', 'cuci', 'setrika', 'kiloan'],
  },
  {
    id: 'print_copy',
    label: 'Print & fotokopi',
    description: 'Cetak tugas, jilid, laminating, scan, dan fotokopi.',
    searchHints: ['print', 'fotokopi', 'scan', 'jilid', 'laminating'],
  },
  {
    id: 'daily_needs',
    label: 'Kebutuhan harian',
    description: 'Galon, gas, minimarket, sabun, alat mandi, dan kebutuhan dapur.',
    searchHints: ['galon', 'gas', 'sabun', 'minimarket', 'mandi', 'dapur'],
  },
  {
    id: 'service',
    label: 'Servis & darurat',
    description: 'Bengkel, servis elektronik, klinik, apotek, dan bantuan mendadak.',
    searchHints: ['bengkel', 'servis', 'apotek', 'klinik', 'elektronik'],
  },
  {
    id: 'housing',
    label: 'Kos & hunian',
    description: 'Kos, kontrakan, area dekat kampus atau kantor, dan fasilitas sekitar.',
    searchHints: ['kos', 'kontrakan', 'hunian', 'kamar'],
  },
];

export const categoryById = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<Category['id'], Category>;
