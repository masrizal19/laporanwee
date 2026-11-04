/**
 * In-Memory Fast-Page-Load Caching with Stale-While-Revalidate (0ms Transition)
 * Digunakan untuk mempercepat navigasi halaman (Dashboard, Laporan, Tim, dll.)
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 detik validitas data segar (fresh)

/**
 * Mengambil data dari cache memori jika tersedia secara instan (0ms),
 * atau melakukan network fetch dan menyimpan respons sukses ke dalam cache.
 */
export const fetchWithCache = async <T = any>(
  url: string,
  options: RequestInit = {},
  customTtl: number = CACHE_TTL
): Promise<T> => {
  const cached = cache.get(url);
  const now = Date.now();

  // Kembalikan data cache langsung jika masih segar
  if (cached && now - cached.timestamp < customTtl) {
    return cached.data;
  }

  try {
    const response = await fetch(url, options);
    const json = await response.json();
    if (json && json.success !== false) {
      cache.set(url, { data: json, timestamp: now });
    }
    return json;
  } catch (error) {
    // Jika fetch gagal (misal koneksi lambat) namun ada data cache lama, kembalikan data cache (offline resilient)
    if (cached) {
      console.warn(`[apiCache] Network request failed for ${url}, fallback ke stale cache.`);
      return cached.data;
    }
    throw error;
  }
};

/**
 * Mengambil data cache secara sinkron untuk inisialisasi state seketika (0ms transition)
 */
export const getCachedData = <T = any>(url: string): T | null => {
  const entry = cache.get(url);
  if (entry) {
    return entry.data;
  }
  return null;
};

/**
 * Menyimpan data ke dalam cache secara manual
 */
export const setCachedData = <T = any>(url: string, data: T): void => {
  if (data !== undefined && data !== null) {
    cache.set(url, { data, timestamp: Date.now() });
  }
};

/**
 * Menghapus cache berdasarkan pola URL atau mengosongkan seluruh cache.
 * Dipanggil saat ada mutasi data (tambah/edit/hapus laporan, user baru, dll.)
 */
export const invalidateCache = (pattern?: string): void => {
  if (!pattern) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  }
};

export default {
  fetchWithCache,
  getCachedData,
  setCachedData,
  invalidateCache,
};
