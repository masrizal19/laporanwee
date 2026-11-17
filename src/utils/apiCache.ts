/**
 * In-Memory & Local Persistent Fast-Page-Load Caching + Request Deduplication & Timeout
 * Mendukung Stale-While-Revalidate yang tahan browser reload (F5), in-flight promise
 * deduplication agar request URL yang sama tidak terkirim ganda, dan timeout AbortController.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const TTL = 120000; // 2 menit cache aktif
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const UPLOAD_REQUEST_TIMEOUT_MS = 60000;

/**
 * Fetch wrapper with AbortController timeout support + external signal forwarding
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  let timedOut = false;

  const timerId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = options.signal;
  const onExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timerId);
      const abortErr = new Error('Permintaan dibatalkan.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (timedOut) {
      const timeoutErr: any = new Error(
        'Permintaan ke server melebihi batas waktu. Periksa koneksi internet Anda lalu coba lagi.'
      );
      timeoutErr.name = 'TimeoutError';
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timerId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};

/**
 * Fetch data dengan in-memory cache, in-flight request deduplication,
 * timeout protection, dan backup persistent storage.
 */
export const fetchWithCache = async <T = any>(
  url: string,
  optionsOrHeaders: RequestInit | HeadersInit = {},
  storageKey?: string,
  ttlMs: number = TTL
): Promise<T> => {
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
  if (mem && now - mem.timestamp < ttlMs) {
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

  // 3. Deduplikasi request identik yang sedang berjalan (in-flight)
  const existingFlight = inFlightRequests.get(url);
  if (existingFlight) {
    return existingFlight;
  }

  // 4. Fetch data terbaru dengan timeout
  const flightPromise = (async () => {
    try {
      const res = await fetchWithTimeout(url, reqOptions, DEFAULT_REQUEST_TIMEOUT_MS);
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
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      console.warn(`[apiCache] Network fetch fallback to cached/backup for ${url}:`, err);
    } finally {
      inFlightRequests.delete(url);
    }

    return (memoryCache.get(url)?.data as T) || (mem?.data as T) || (null as any);
  })();

  inFlightRequests.set(url, flightPromise);
  return flightPromise;
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
 * Invalidate cache di memori dan storage secara aman (mendukung pola/prefix)
 */
export const invalidateCache = (pattern?: string): void => {
  if (!pattern) {
    memoryCache.clear();
    return;
  }

  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_') && key.includes(pattern)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
};

export const fetchWithFastCache = fetchWithCache;

export default {
  fetchWithCache,
  fetchWithFastCache,
  fetchWithTimeout,
  getCachedData,
  setCachedData,
  invalidateCache,
};
