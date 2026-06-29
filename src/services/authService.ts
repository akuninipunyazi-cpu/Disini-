import { createClerkSupabaseClient, isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import type { AppRole, AuthAccount } from '../types';

/**
 * Daftar role yang dianggap sebagai admin.
 * super_admin: Akses penuh.
 * location_admin: Admin khusus lokasi.
 * verifier/moderator: Role pendukung lainnya.
 */
export const adminRoleIds = ['super_admin', 'location_admin', 'verifier', 'moderator'] as const;

/**
 * Data akun demo untuk testing lokal jika Supabase tidak aktif.
 */
const localDemoAccounts: AuthAccount[] = [
  {
    id: 'local-admin',
    username: 'admin',
    email: 'admin@disini.local',
    role: 'location_admin',
  },
  {
    id: 'local-user',
    username: 'user',
    email: 'user@disini.local',
    role: 'user',
  },
];

/**
 * Mengecek apakah sebuah role memiliki akses admin.
 * @param role Role yang akan dicek.
 * @returns boolean true jika admin.
 */
export function isAdminRole(role?: AppRole | null) {
  return Boolean(role && adminRoleIds.includes(role as (typeof adminRoleIds)[number]));
}

/**
 * Mengonversi nilai mentah menjadi tipe AppRole yang valid.
 * Default ke 'user' jika tidak cocok.
 */
function toAppRole(value: unknown): AppRole {
  return value === 'super_admin' ||
    value === 'location_admin' ||
    value === 'verifier' ||
    value === 'moderator'
    ? value
    : 'user';
}

/**
 * Handler untuk login demo lokal (tanpa server).
 */
function signInWithLocalAccount(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const account = localDemoAccounts.find(
    (demoAccount) =>
      demoAccount.username === normalizedIdentifier ||
      demoAccount.email.toLowerCase() === normalizedIdentifier,
  );

  if (!account || password !== 'demo123') {
    throw new Error('USN atau password salah. Demo: admin/demo123 atau user/demo123.');
  }

  return account;
}

/**
 * Fungsi utama untuk mengambil profil user dari Supabase.
 * Jika profil belum ada, fungsi ini akan membuatnya secara otomatis (Auto-sync).
 * 
 * @param userId ID unik dari Clerk.
 * @param email Email user dari Clerk.
 * @param username Username atau nama tampilan dari Clerk.
 * @param clerkToken Token JWT Clerk (Opsional, untuk menembus RLS Supabase).
 */
export async function getAccountForUser(
  userId: string, 
  email?: string | null, 
  username?: string | null,
  clerkToken?: string
): Promise<AuthAccount> {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  // Gunakan client khusus Clerk jika token tersedia, jika tidak pakai client anonim biasa
  const client = clerkToken ? createClerkSupabaseClient(clerkToken) : supabase;

  // Cari data profile berdasarkan ID unik
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  // LOGIKA AUTO-SYNC: Jika profile belum ada di database, kita buatkan record baru
  if (!data) {
    console.log('Profile belum ada, mencoba membuat profile baru untuk ID:', userId);
    
    // Tentukan username: Prioritas Username Clerk > Awalan Email > user_ID
    const newUsername = username || email?.split('@')[0] || 'user_' + userId.slice(-4);
    
    const { data: newProfile, error: insertError } = await client
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        username: newUsername,
        role: 'user' // Default user baru adalah 'user'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Gagal membuat profile di Supabase:', insertError.message, insertError.details);
      // Fallback: kembalikan data minimal agar UI tidak error (meski gagal simpan ke DB)
      return {
        id: userId,
        username: newUsername,
        email: email || '',
        role: 'user',
      };
    }
    
    console.log('Profile berhasil disinkronkan ke Supabase:', newProfile);
    return {
      id: newProfile.id,
      username: newProfile.username,
      email: newProfile.email,
      role: toAppRole(newProfile.role),
    };
  }

  // Jika profile sudah ada, kembalikan data dari database
  return {
    id: userId,
    username: data.username || email?.split('@')[0] || '',
    email: data.email || email || '',
    role: toAppRole(data.role),
  };
}

/**
 * Mencari email berdasarkan username (untuk login tradisional).
 */
async function resolveEmailForIdentifier(identifier: string) {
  const cleanedIdentifier = identifier.trim();

  // Jika sudah format email, langsung kembalikan
  if (cleanedIdentifier.includes('@')) {
    return cleanedIdentifier;
  }

  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  // Cari email di tabel profiles berdasarkan username
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', cleanedIdentifier)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.email) {
    throw new Error('USN tidak ditemukan.');
  }

  return data.email;
}

/**
 * Handler login manual menggunakan Supabase Auth (Email & Password).
 * Digunakan jika user tidak menggunakan Clerk.
 */
export async function signInWithPassword(identifier: string, password: string) {
  if (!isSupabaseConfigured || !supabase) {
    return signInWithLocalAccount(identifier, password);
  }

  const email = await resolveEmailForIdentifier(identifier);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Login berhasil tapi user tidak ditemukan.');
  }

  return getAccountForUser(data.user.id, data.user.email);
}

/**
 * Registrasi user baru secara manual (Supabase Auth).
 */
export async function signUpWithPassword(email: string, password: string, username: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Pendaftaran hanya tersedia saat Supabase terkonfigurasi.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Pendaftaran berhasil tapi user tidak dibuat.');
  }

  // Update username secara eksplisit (redundansi untuk memastikan data tersimpan)
  await supabase
    .from('profiles')
    .update({ username })
    .eq('id', data.user.id);

  return getAccountForUser(data.user.id, data.user.email);
}

/**
 * Mengirim email reset password.
 */
export async function resetPasswordForEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Fitur ini hanya tersedia saat Supabase terkonfigurasi.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Mengupdate password user yang sedang login.
 */
export async function updatePassword(password: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Fitur ini hanya tersedia saat Supabase terkonfigurasi.');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Logout dari sesi Supabase.
 */
export async function signOut() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Mengambil semua daftar profil user dari Supabase (Khusus Super Admin).
 */
export async function getAllProfiles(clerkToken: string): Promise<AuthAccount[]> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');

  const client = createClerkSupabaseClient(clerkToken);
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .order('username', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map(row => ({
    id: row.id,
    username: row.username,
    email: row.email || '',
    role: toAppRole(row.role)
  }));
}

/**
 * Mengupdate role seorang user (Khusus Super Admin).
 */
export async function updateUserRole(userId: string, newRole: AppRole, clerkToken: string) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');

  const client = createClerkSupabaseClient(clerkToken);
  const { error } = await client
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  return true;
}
