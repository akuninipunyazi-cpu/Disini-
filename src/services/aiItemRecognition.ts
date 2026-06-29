import { categories, categoryById } from '../data/categories';
import type { CategoryId, ItemRecognition } from '../types';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const DEFAULT_VISION_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
];
const configuredVisionModel = import.meta.env.VITE_OPENROUTER_VISION_MODEL?.trim();
const OPENROUTER_VISION_MODELS = [
  ...(configuredVisionModel ? [configuredVisionModel] : []),
  ...DEFAULT_VISION_MODELS,
].filter((model, index, models) => models.indexOf(model) === index);

const categoryIds = new Set<CategoryId>(categories.map((category) => category.id));

const keywordCategoryRules: Array<{ categoryId: CategoryId; keywords: string[] }> = [
  {
    categoryId: 'atk',
    keywords: [
      'alat tulis',
      'ballpoint',
      'binder',
      'buku',
      'drawing pen',
      'kertas',
      'marker',
      'pensil',
      'pen',
      'pulpen',
      'spidol',
      'stationery',
    ],
  },
  {
    categoryId: 'print_copy',
    keywords: ['fotokopi', 'jilid', 'laminating', 'print', 'scan'],
  },
  {
    categoryId: 'kos_kit',
    keywords: [
      'bantal',
      'ember',
      'gantungan',
      'guling',
      'kasur',
      'kabel roll',
      'kipas',
      'meja',
      'rak',
      'selimut',
      'sprei',
    ],
  },
  {
    categoryId: 'food',
    keywords: ['ayam', 'lauk', 'makanan', 'minuman', 'nasi', 'roti'],
  },
  {
    categoryId: 'laundry',
    keywords: ['baju', 'deterjen', 'laundry', 'pakaian'],
  },
  {
    categoryId: 'daily_needs',
    keywords: ['galon', 'gas', 'sabun', 'sampo', 'shampoo', 'tisu', 'toothpaste'],
  },
  {
    categoryId: 'service',
    keywords: ['baterai', 'charger', 'elektronik', 'obeng', 'servis'],
  },
  {
    categoryId: 'housing',
    keywords: ['kontrakan', 'kos', 'kunci kamar'],
  },
];

function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && categoryIds.has(value as CategoryId);
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function categoryFromText(value: string): CategoryId | null {
  const normalizedValue = normalizeText(value);

  for (const rule of keywordCategoryRules) {
    if (rule.keywords.some((keyword) => normalizedValue.includes(keyword))) {
      return rule.categoryId;
    }
  }

  for (const category of categories) {
    const categoryTerms = [category.label, category.description, ...category.searchHints];
    if (categoryTerms.some((term) => normalizedValue.includes(normalizeText(term)))) {
      return category.id;
    }
  }

  return null;
}

function extractJsonObject(value: string) {
  const cleanedValue = value.replace(/```json|```/gi, '').trim();
  const jsonMatch = cleanedValue.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('AI tidak mengembalikan JSON yang valid.');
  }

  return JSON.parse(jsonMatch[0]) as {
    itemName?: unknown;
    categoryId?: unknown;
    confidence?: unknown;
  };
}

function buildRecognition(itemName: string, categoryId: CategoryId, confidence: number): ItemRecognition {
  return {
    itemName,
    categoryId,
    confidence,
    searchQuery: itemName,
  };
}

function normalizeRecognitionResult(result: {
  itemName?: unknown;
  categoryId?: unknown;
  confidence?: unknown;
}): ItemRecognition {
  const itemName =
    typeof result.itemName === 'string' && result.itemName.trim()
      ? result.itemName.trim()
      : 'barang dari foto';
  const categoryId = isCategoryId(result.categoryId)
    ? result.categoryId
    : categoryFromText(itemName) ?? 'daily_needs';
  const confidence =
    typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1
      ? result.confidence
      : 0.9;

  return buildRecognition(itemName, categoryId, confidence);
}

/**
 * Konversi file gambar ke string Base64 agar bisa dikirim ke AI
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

async function requestVisionRecognition(
  model: string,
  base64Image: string,
  file: File,
  categoryOptions: string,
): Promise<ItemRecognition> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'DiSini Surabaya',
    },
    body: JSON.stringify({
      model,
      max_tokens: 180,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Anda adalah mesin klasifikasi foto barang untuk aplikasi DiSini! Surabaya.
              Kenali barang utama di foto dalam bahasa Indonesia yang umum dipakai user.
              Pilih tepat satu categoryId dari daftar kategori aplikasi.

              Berikan JSON murni tanpa markdown:
              {
                "itemName": "nama barang spesifik, contoh: Pulpen, Buku Tulis, Sabun Mandi",
                "categoryId": "salah_satu_id_kategori",
                "confidence": 0.0 sampai 1.0
              }

              Daftar kategori:
              ${categoryOptions}

              Contoh:
              - Foto pulpen, pena, pensil, buku, binder, spidol => categoryId "atk"
              - Foto meja, rak, kipas, ember, kabel roll, bantal, guling, sprei, selimut => categoryId "kos_kit"
              - Foto sabun, galon, gas, tisu, sampo => categoryId "daily_needs"
              - Foto makanan atau minuman siap makan => categoryId "food"
              - Foto dokumen yang perlu print/fotokopi/jilid => categoryId "print_copy"`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${file.type || 'image/jpeg'};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Model ${model} failed (${response.status}): ${errorBody.slice(0, 240)}`);
  }

  const data = await response.json();
  const aiText = data.choices?.[0]?.message?.content?.trim();

  if (!aiText) {
    throw new Error(`Model ${model} tidak mengembalikan konten.`);
  }

  return normalizeRecognitionResult(extractJsonObject(aiText));
}

export async function identifyItemFromImage(file: File): Promise<ItemRecognition> {
  if (!OPENROUTER_API_KEY) {
    console.warn('OpenRouter API Key belum diset di .env. Menggunakan pendeteksi sederhana.');
    return fallbackIdentify(file);
  }

  try {
    const base64Image = await fileToBase64(file);
    const categoryOptions = categories
      .map((category) => `- ${category.id}: ${category.label} (${category.description})`)
      .join('\n');
    const failures: Error[] = [];

    for (const model of OPENROUTER_VISION_MODELS) {
      try {
        console.info(`[DiSini AI] Mencoba model vision: ${model}`);
        return await requestVisionRecognition(model, base64Image, file, categoryOptions);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error('Unknown AI recognition error');
        failures.push(failure);
        console.warn(`[DiSini AI] Model vision gagal: ${model}`, failure);
      }
    }

    throw new Error(failures.map((failure) => failure.message).join(' | '));
  } catch (error) {
    console.error('AI Recognition Error:', error);
    return fallbackIdentify(file);
  }
}

/**
 * Fallback jika API Key tidak ada atau error
 */
async function fallbackIdentify(file: File): Promise<ItemRecognition> {
  const filename = normalizeText(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
  const categoryId = categoryFromText(filename);

  if (categoryId) {
    const matchedKeyword = keywordCategoryRules
      .find((rule) => rule.categoryId === categoryId)
      ?.keywords.find((keyword) => filename.includes(keyword));

    return buildRecognition(
      matchedKeyword ?? categoryById[categoryId].label,
      categoryId,
      0.55,
    );
  }
  
  return buildRecognition('barang dari foto', 'daily_needs', 0.35);
}
