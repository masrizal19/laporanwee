/**
 * In-Memory & Local Persistent Fast-Page-Load Caching (0ms Transition)
 * Mendukung Stale-While-Revalidate yang tahan browser reload (F5) dengan backup localStorage.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const TTL = 120000; // 2 menit cache aktif

/**
 * Fetch data dengan in-memory cache + persistent storage backup
 */
export const fetchWithCache = async <T = any>(
  url: string,
  optionsOrHeaders: RequestInit | HeadersInit = {},
  storageKey?: string
): Promise<T> => {
  // Dukung opsi RequestInit maupun pure HeadersInit
  let reqOptions: RequestInit = {};
  if (
    typeof optionsOrHeaders === 'object' &&
    optionsOrHeaders !== null &&
    ('headers' in optionsOrHeaders || 'method' in optionsOrHeaders || 'signal' in optionsOrHeaders)
  ) {
    reqOptions = optionsOrHeaders as RequestInit;
  } else {
    reqOptions = { headers: optionsOrHeaders as HeadersInit };
  }

  // 1. Cek memory cache
  const mem = memoryCache.get(url);
  const now = Date.now();
  if (mem && now - mem.timestamp < TTL) {
    return mem.data;
  }

  // 2. Cek local backup saat reload browser
  if (storageKey && !mem) {
    try {
      const backup = localStorage.getItem(`cache_${storageKey}`);
      if (backup) {
        const parsed = JSON.parse(backup);
        memoryCache.set(url, { data: parsed, timestamp: now });
      }
    } catch (e) {
      console.warn(`[apiCache] Gagal membaca backup cache_${storageKey}:`, e);
    }
  }

  // 3. Fetch data terbaru di background / network
  try {
    const res = await fetch(url, reqOptions);
    const json = await res.json();
    if (json && json.success !== false) {
      memoryCache.set(url, { data: json, timestamp: Date.now() });
      if (storageKey) {
        try {
          localStorage.setItem(`cache_${storageKey}`, JSON.stringify(json));
        } catch (e) {
          console.warn(`[apiCache] Gagal menyimpan backup cache_${storageKey}:`, e);
        }
      }
      return json;
    }
  } catch (err) {
    console.warn(`[apiCache] Network fetch fallback to cached/backup for ${url}:`, err);
  }

  return (memoryCache.get(url)?.data as T) || (mem?.data as T) || (null as any);
};

/**
 * Mengambil data cache secara sinkron untuk inisialisasi state seketika (0ms reload tahan F5)
 */
export const getCachedData = <T = any>(url: string, storageKey?: string): T | null => {
  const mem = memoryCache.get(url);
  if (mem) {
    return mem.data;
  }

  if (storageKey) {
    try {
      const backup = localStorage.getItem(`cache_${storageKey}`);
      if (backup) {
        const parsed = JSON.parse(backup);
        memoryCache.set(url, { data: parsed, timestamp: Date.now() });
        return parsed;
      }
    } catch (_) {}
  }

  return null;
};

/**
 * Menyimpan data ke dalam memoryCache dan backup localStorage
 */
export const setCachedData = <T = any>(url: string, data: T, storageKey?: string): void => {
  if (data !== undefined && data !== null) {
    memoryCache.set(url, { data, timestamp: Date.now() });
    if (storageKey) {
      try {
        localStorage.setItem(`cache_${storageKey}`, JSON.stringify(data));
      } catch (_) {}
    }
  }
};

/**
 * Invalidate cache di memori dan storage
 */
export const invalidateCache = (pattern?: string): void => {
  if (!pattern) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_') && key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
  }
};

export const fetchWithFastCache = fetchWithCache;

export default {
  fetchWithCache,
  fetchWithFastCache,
  getCachedData,
  setCachedData,
  invalidateCache,
};
