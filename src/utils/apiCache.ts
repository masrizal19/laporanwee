/**
 * In-Memory Fast-Page-Load Caching with Stale-While-Revalidate (0ms Transition)
 * Digunakan untuk mempercepat navigasi halaman (Dashboard, Laporan, Tim, dll.)
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 60000; // 1 menit cache segar (60 detik)
const CACHE_TTL = 30000; // 30 detik validitas cache instan

/**
 * Fast Cache Fetcher untuk Endpoint Berperforma Tinggi (Laporan, Dashboard, dsb.)
 */
export const fetchWithFastCache = async <T = any>(
  url: string,
  headers: HeadersInit = {}
): Promise<T> => {
  const cached = cache.get(url);
  const now = Date.now();

  // Kembalikan data cache langsung jika masih segar (< 1 menit)
  if (cached && now - cached.timestamp < TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (json && json.success !== false) {
      cache.set(url, { data: json, timestamp: now });
    }
    return json;
  } catch (err) {
    // Jika fetch gagal (koneksi lambat), gunakan stale cache jika tersedia
    if (cached) {
      console.warn(`[apiCache] Network request failed for ${url}, fallback to cache.`);
      return cached.data;
    }
    throw err;
  }
};

/**
 * Mengosongkan seluruh cache data laporan dan sistem
 */
export const clearReportCache = (): void => {
  cache.clear();
};

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
    if (cached) {
      console.warn(`[apiCache] Network request failed for ${url}, fallback to stale cache.`);
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
  fetchWithFastCache,
  clearReportCache,
  fetchWithCache,
  getCachedData,
  setCachedData,
  invalidateCache,
};
