import { getStoredUser } from './api';
import {
  fetchWithTimeout,
  DEFAULT_REQUEST_TIMEOUT_MS,
  UPLOAD_REQUEST_TIMEOUT_MS,
} from './apiCache';
import { getActiveToken } from './fotoweApi';

export const MUSIKWE_API_BASE = 'https://api-laporanwe.mkverse.my.id/api/musikwe';
export const MUSIKWE_ADMIN_EMAIL = 'rizalsaragih498@gmail.com';

export interface MusikweUser {
  id: number;
  name: string;
  email?: string;
  is_admin?: boolean;
}

export interface MusikweTrack {
  id: number;
  t: string; // title
  a: string; // artist
  album_id?: number;
  album_name?: string;
  d: number; // duration in seconds
  h: number; // cover gradient hue
  url: string; // direct audio URL
  youtube_id?: string;
  ly: string; // lyrics ([mm:ss] ...)
  img: string; // cover image URL
}

export interface MusikweAlbum {
  id: number;
  title: string;
  artist: string;
  release_year?: string;
  cover_url?: string;
}

export interface MusikwePlaylist {
  id: number;
  n: string;
  ids: number[];
}

export interface MusikweRequest {
  id: number;
  tid: number;
  by: string;
  ts: number; // unix ms
  v: string[]; // voter names
}

export interface MusikweComment {
  id?: number;
  by: string;
  tx: string;
  ts: number; // unix ms
}

export interface MusikweReadResponse {
  user: MusikweUser;
  logo_url: string;
  has_youtube_key?: boolean;
  tracks: MusikweTrack[];
  albums: MusikweAlbum[];
  playlists: MusikwePlaylist[];
  requests: MusikweRequest[];
  comments: Record<string, MusikweComment[]>;
}

export interface ExternalItunesItem {
  source: 'itunes';
  trackId?: number | string;
  title: string;
  artist: string;
  album: string;
  duration_sec: number;
  cover_url: string;
  preview_url: string;
  release_date?: string;
}

export interface ExternalYoutubeItem {
  source: 'youtube';
  youtube_id: string;
  title: string;
  artist: string;
  album?: string;
  duration_sec: number;
  cover_url: string;
}

export interface ExternalSearchResponse {
  itunes: ExternalItunesItem[];
  youtube: ExternalYoutubeItem[];
  has_youtube_key: boolean;
}

export function isAutoAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === MUSIKWE_ADMIN_EMAIL;
}

export function extractYoutubeId(input?: string | null): string {
  if (!input) return '';
  const raw = input.trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const re of patterns) {
    const match = raw.match(re);
    if (match && match[1]) return match[1];
  }
  return '';
}

function resolveUserEmail(overrideEmail?: string): string {
  if (overrideEmail && overrideEmail.trim()) return overrideEmail.trim();
  try {
    const stored = getStoredUser();
    if (stored?.email) return String(stored.email).trim();
  } catch {
    // ignore storage errors
  }
  return '';
}

function buildHeaders(
  isJson: boolean,
  options?: { userEmail?: string }
): Record<string, string> {
  const token = getActiveToken();
  const email = resolveUserEmail(options?.userEmail);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Admin-Email': email || '',
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function normalizeTimestamp(raw: any): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return Date.now();
  return num < 1_000_000_000_000 ? num * 1000 : num;
}

function hashHue(seed: string): number {
  let h = 210;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

function normalizeTrack(raw: any): MusikweTrack {
  const title = String(raw?.t ?? raw?.title ?? 'Tanpa Judul');
  const artist = String(raw?.a ?? raw?.artist ?? 'Artis Tidak Diketahui');
  const audioUrl = String(raw?.url ?? raw?.audio_url ?? '').trim();
  const directYt = String(raw?.youtube_id ?? raw?.youtube_url ?? '').trim();
  const ytId = extractYoutubeId(directYt) || extractYoutubeId(audioUrl);
  const cover = String(raw?.img ?? raw?.cover_url ?? '').trim();
  const durationNum = Number(raw?.d ?? raw?.duration_sec ?? raw?.duration ?? 200);
  const duration = Number.isFinite(durationNum) && durationNum > 0 ? Math.round(durationNum) : 200;

  return {
    id: Number(raw?.id ?? 0),
    t: title,
    a: artist,
    album_id: raw?.album_id ? Number(raw.album_id) : 0,
    album_name: String(raw?.album_name ?? raw?.album ?? '').trim(),
    d: duration,
    h: Number.isFinite(Number(raw?.h)) ? Number(raw.h) : hashHue(title + artist),
    url: ytId && audioUrl.includes(ytId) ? '' : audioUrl,
    youtube_id: ytId || undefined,
    ly: String(raw?.ly ?? raw?.lyrics ?? ''),
    img: cover,
  };
}

function normalizeReadPayload(data: any): MusikweReadResponse {
  const tracks: MusikweTrack[] = Array.isArray(data?.tracks)
    ? data.tracks.map(normalizeTrack).filter((t: MusikweTrack) => t.id > 0)
    : [];

  const albums: MusikweAlbum[] = Array.isArray(data?.albums)
    ? data.albums.map((al: any) => ({
        id: Number(al?.id ?? 0),
        title: String(al?.title ?? al?.name ?? ''),
        artist: String(al?.artist ?? ''),
        release_year: String(al?.release_year ?? ''),
        cover_url: String(al?.cover_url ?? ''),
      }))
    : [];

  const playlists: MusikwePlaylist[] = Array.isArray(data?.playlists)
    ? data.playlists.map((pl: any) => ({
        id: Number(pl?.id ?? 0),
        n: String(pl?.n ?? pl?.name ?? 'Playlist'),
        ids: Array.isArray(pl?.ids)
          ? pl.ids.map((id: any) => Number(id)).filter((id: number) => id > 0)
          : Array.isArray(pl?.track_ids)
          ? pl.track_ids.map((id: any) => Number(id)).filter((id: number) => id > 0)
          : [],
      }))
    : [];

  const requests: MusikweRequest[] = Array.isArray(data?.requests)
    ? data.requests.map((rq: any) => ({
        id: Number(rq?.id ?? 0),
        tid: Number(rq?.tid ?? rq?.track_id ?? 0),
        by: String(rq?.by ?? rq?.requested_by ?? 'Tamu'),
        ts: normalizeTimestamp(rq?.ts ?? rq?.created_at),
        v: Array.isArray(rq?.v)
          ? rq.v.map((x: any) => String(x))
          : Array.isArray(rq?.voters)
          ? rq.voters.map((x: any) => String(x))
          : [],
      }))
    : [];

  const comments: Record<string, MusikweComment[]> = {};
  if (data?.comments && typeof data.comments === 'object') {
    for (const [k, list] of Object.entries(data.comments)) {
      if (Array.isArray(list)) {
        comments[String(k)] = list.map((cm: any) => ({
          id: cm?.id ? Number(cm.id) : undefined,
          by: String(cm?.by ?? cm?.author ?? 'Pendengar'),
          tx: String(cm?.tx ?? cm?.comment ?? ''),
          ts: normalizeTimestamp(cm?.ts ?? cm?.created_at),
        }));
      }
    }
  }

  return {
    user: {
      id: Number(data?.user?.id ?? 0),
      name: String(data?.user?.name ?? 'Tamu'),
      email: data?.user?.email ? String(data.user.email) : undefined,
      is_admin: Boolean(data?.user?.is_admin),
    },
    logo_url: String(data?.logo_url ?? ''),
    has_youtube_key: Boolean(data?.has_youtube_key),
    tracks,
    albums,
    playlists,
    requests,
    comments,
  };
}

async function parseApiJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok ? 'Respons server bukan JSON yang valid.' : `Server error (${res.status}).`
    );
  }
}

export interface SyncedLyricLine {
  time: number;
  text: string;
}

export function parseSyncedLyrics(lyrics: string, durationSec: number): SyncedLyricLine[] {
  const raw = (lyrics || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!raw.length) return [];

  const re = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
  const hasAnyTimestamp = raw.some((line) => re.test(line));

  if (hasAnyTimestamp) {
    const parsed: SyncedLyricLine[] = [];
    let lastTime = 0;
    for (const line of raw) {
      const m = line.match(re);
      if (m) {
        const min = Number(m[1]);
        const sec = Number(m[2]);
        const msPart = m[3] ? Number(`0.${m[3]}`) : 0;
        const time = min * 60 + sec + msPart;
        lastTime = time;
        const text = (m[4] || '').trim() || '♪';
        parsed.push({ time, text });
      } else {
        lastTime += 3;
        parsed.push({ time: lastTime, text: line });
      }
    }
    return parsed.sort((a, b) => a.time - b.time);
  }

  const start = 4;
  const safeDuration = Math.max(20, durationSec || 200);
  const gap = Math.max(2, (safeDuration - start - 4) / Math.max(raw.length, 1));
  return raw.map((line, idx) => ({
    time: start + idx * gap,
    text: line,
  }));
}

export const musikweApi = {
  async read(
    q: string = '',
    auth?: { userEmail?: string }
  ): Promise<{ success: boolean; message?: string; data: MusikweReadResponse }> {
    const query = q.trim();
    const url = query
      ? `${MUSIKWE_API_BASE}/read.php?q=${encodeURIComponent(query)}`
      : `${MUSIKWE_API_BASE}/read.php`;
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: buildHeaders(false, auth) },
      DEFAULT_REQUEST_TIMEOUT_MS
    );
    const json = await parseApiJson(res);
    return {
      success: Boolean(json?.success),
      message: json?.message,
      data: normalizeReadPayload(json?.data || {}),
    };
  },

  async searchItunes(q: string): Promise<ExternalItunesItem[]> {
    const query = q.trim();
    if (!query) return [];

    const itRes = await fetchWithTimeout(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        query
      )}&media=music&entity=song&limit=15&country=ID`,
      { method: 'GET' },
      DEFAULT_REQUEST_TIMEOUT_MS
    );
    if (!itRes.ok) {
      throw new Error(`iTunes Search API gagal (${itRes.status}).`);
    }
    const itJson = await parseApiJson(itRes);
    const results: ExternalItunesItem[] = Array.isArray(itJson?.results)
      ? itJson.results
          .filter((r: any) => r?.trackName && r?.artistName)
          .map((r: any) => ({
            source: 'itunes' as const,
            trackId: r?.trackId,
            title: String(r?.trackName ?? ''),
            artist: String(r?.artistName ?? ''),
            album: String(r?.collectionName ?? ''),
            duration_sec: Math.max(
              15,
              Math.round((Number(r?.trackTimeMillis) || 200000) / 1000)
            ),
            cover_url: String(r?.artworkUrl100 ?? '')
              .replace('100x100bb', '600x600bb')
              .replace('100x100', '600x600'),
            preview_url: String(r?.previewUrl ?? ''),
            release_date: String(r?.releaseDate ?? ''),
          }))
      : [];

    console.log('[iTUNES SEARCH]', { query, count: results.length, results });
    return results;
  },

  async searchExternal(
    q: string,
    auth?: { userEmail?: string }
  ): Promise<ExternalSearchResponse> {
    const query = q.trim();
    if (!query) {
      return { itunes: [], youtube: [], has_youtube_key: false };
    }

    let itunes: ExternalItunesItem[] = [];
    let youtube: ExternalYoutubeItem[] = [];
    let hasYoutubeKey = Boolean(String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim());

    try {
      itunes = await this.searchItunes(query);
    } catch {
      // Optional backend fallback for Admin quick search if direct iTunes fails
      try {
        const res = await fetchWithTimeout(
          `${MUSIKWE_API_BASE}/search-external.php?q=${encodeURIComponent(query)}`,
          { method: 'GET', headers: buildHeaders(false, auth) },
          DEFAULT_REQUEST_TIMEOUT_MS
        );
        const json = await parseApiJson(res);
        const data = json?.data || {};
        if (data?.has_youtube_key) hasYoutubeKey = true;

        if (Array.isArray(data?.itunes)) {
          itunes = data.itunes.map((item: any) => ({
            source: 'itunes',
            trackId: item?.trackId ?? item?.id,
            title: String(item?.title ?? item?.trackName ?? ''),
            artist: String(item?.artist ?? item?.artistName ?? ''),
            album: String(item?.album ?? item?.collectionName ?? ''),
            duration_sec: Math.max(
              15,
              Math.round(
                Number(item?.duration_sec ?? (item?.trackTimeMillis ? item.trackTimeMillis / 1000 : 200))
              )
            ),
            cover_url: String(item?.cover_url ?? item?.artworkUrl100 ?? '')
              .replace('100x100bb', '600x600bb')
              .replace('100x100', '600x600'),
            preview_url: String(item?.preview_url ?? item?.previewUrl ?? ''),
            release_date: String(item?.release_date ?? item?.releaseDate ?? ''),
          }));
        }

        if (Array.isArray(data?.youtube)) {
          youtube = data.youtube
            .map((item: any) => {
              const ytId =
                extractYoutubeId(item?.youtube_id) ||
                extractYoutubeId(item?.videoId) ||
                extractYoutubeId(item?.id) ||
                extractYoutubeId(item?.url);
              return {
                source: 'youtube' as const,
                youtube_id: ytId,
                title: String(item?.title ?? 'Video YouTube'),
                artist: String(item?.artist ?? item?.channel ?? item?.channelTitle ?? 'YouTube'),
                album: String(item?.album ?? ''),
                duration_sec: Math.max(
                  15,
                  Math.round(Number(item?.duration_sec ?? item?.duration ?? 210))
                ),
                cover_url: String(
                  item?.cover_url ??
                    item?.thumbnail_url ??
                    item?.thumbnail ??
                    (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '')
                ),
              };
            })
            .filter((item: ExternalYoutubeItem) => Boolean(item.youtube_id));
        }
      } catch {
        // Ignore fallback failure cleanly
      }
    }

    return { itunes, youtube, has_youtube_key: hasYoutubeKey };
  },

  async searchYoutubeBestMatch(
    title: string,
    artist: string,
    auth?: { userEmail?: string }
  ): Promise<ExternalYoutubeItem> {
    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();
    const q = `${cleanTitle} ${cleanArtist}`.trim();
    if (!q) {
      throw new Error('Judul dan artis lagu tidak valid.');
    }

    const ytApiKey = String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim();
    let apiErrorReason = '';

    // 1. YouTube Data API v3 via import.meta.env.VITE_YOUTUBE_API_KEY
    if (ytApiKey) {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=3&q=${encodeURIComponent(
        `${cleanTitle} ${cleanArtist} official audio`
      )}&key=${encodeURIComponent(ytApiKey)}`;

      const res = await fetchWithTimeout(ytUrl, { method: 'GET' }, DEFAULT_REQUEST_TIMEOUT_MS);
      const json = await parseApiJson(res);

      if (!res.ok) {
        apiErrorReason =
          json?.error?.message || `YouTube Data API v3 gagal (${res.status}).`;
        console.log('[YOUTUBE MATCH]', {
          source: 'youtube_v3',
          error: apiErrorReason,
          title: cleanTitle,
          artist: cleanArtist,
        });
      } else {
        const first = Array.isArray(json?.items) ? json.items[0] : null;
        const videoId = extractYoutubeId(first?.id?.videoId);
        if (videoId) {
          const thumbs = first?.snippet?.thumbnails || {};
          const matched: ExternalYoutubeItem = {
            source: 'youtube',
            youtube_id: videoId,
            title: String(first?.snippet?.title ?? cleanTitle),
            artist: String(first?.snippet?.channelTitle ?? cleanArtist),
            album: '',
            duration_sec: 200,
            cover_url: String(
              thumbs?.high?.url ??
                thumbs?.medium?.url ??
                thumbs?.default?.url ??
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            ),
          };
          console.log('[YOUTUBE MATCH]', {
            source: 'youtube_v3',
            videoId,
            ytTitle: matched.title,
            title: cleanTitle,
            artist: cleanArtist,
          });
          return matched;
        }
        apiErrorReason = `Video YouTube tidak ditemukan untuk "${cleanTitle} - ${cleanArtist}".`;
      }
    }

    // 2. Fallback to POST /api/musikwe/youtube-match.php if VITE_YOUTUBE_API_KEY is empty or failed
    try {
      const res = await fetchWithTimeout(
        `${MUSIKWE_API_BASE}/youtube-match.php`,
        {
          method: 'POST',
          headers: buildHeaders(true, auth),
          body: JSON.stringify({
            title: cleanTitle,
            artist: cleanArtist,
            q: `${cleanTitle} ${cleanArtist} official audio`,
          }),
        },
        DEFAULT_REQUEST_TIMEOUT_MS
      );
      if (res.ok) {
        const json = await parseApiJson(res);
        const candidate =
          json?.data?.youtube?.[0] ?? json?.data ?? json?.youtube?.[0] ?? json;
        const videoId =
          extractYoutubeId(candidate?.youtube_id) ||
          extractYoutubeId(candidate?.videoId) ||
          extractYoutubeId(candidate?.video_id) ||
          extractYoutubeId(candidate?.id) ||
          extractYoutubeId(candidate?.url);
        if (videoId) {
          const matched: ExternalYoutubeItem = {
            source: 'youtube',
            youtube_id: videoId,
            title: String(candidate?.title ?? cleanTitle),
            artist: String(
              candidate?.artist ?? candidate?.channel ?? candidate?.channelTitle ?? cleanArtist
            ),
            album: String(candidate?.album ?? ''),
            duration_sec: Math.max(
              15,
              Math.round(Number(candidate?.duration_sec ?? candidate?.duration ?? 200))
            ),
            cover_url: String(
              candidate?.cover_url ??
                candidate?.thumbnail_url ??
                candidate?.thumbnail ??
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            ),
          };
          console.log('[YOUTUBE MATCH]', {
            source: 'youtube-match.php',
            videoId,
            ytTitle: matched.title,
            title: cleanTitle,
            artist: cleanArtist,
          });
          return matched;
        }
      } else if (!apiErrorReason) {
        apiErrorReason = `Server pencocokan YouTube gagal (${res.status}).`;
      }
    } catch (err: any) {
      if (!apiErrorReason) {
        apiErrorReason = err?.message || 'Gagal menghubungi server pencocokan YouTube.';
      }
    }

    throw new Error(
      apiErrorReason ||
        `Video YouTube untuk "${cleanTitle}" tidak ditemukan. Periksa VITE_YOUTUBE_API_KEY.`
    );
  },

  async postAction(
    endpoint: 'create.php' | 'update.php' | 'delete.php',
    payload: Record<string, any>,
    auth?: { userEmail?: string }
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    const res = await fetchWithTimeout(
      `${MUSIKWE_API_BASE}/${endpoint}`,
      {
        method: 'POST',
        headers: buildHeaders(true, auth),
        body: JSON.stringify(payload),
      },
      DEFAULT_REQUEST_TIMEOUT_MS
    );
    const json = await parseApiJson(res);
    return {
      success: Boolean(json?.success),
      message: json?.message,
      data: json?.data,
    };
  },

  async uploadFile(
    file: File,
    auth?: { userEmail?: string }
  ): Promise<{ success: boolean; message?: string; url?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetchWithTimeout(
      `${MUSIKWE_API_BASE}/upload.php`,
      {
        method: 'POST',
        headers: buildHeaders(false, auth),
        body: fd,
      },
      UPLOAD_REQUEST_TIMEOUT_MS
    );
    const json = await parseApiJson(res);
    return {
      success: Boolean(json?.success),
      message: json?.message,
      url: String(json?.data?.url ?? json?.url ?? ''),
    };
  },
};
