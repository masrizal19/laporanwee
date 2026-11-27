import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ExternalItunesItem,
  ExternalYoutubeItem,
  MusikweAlbum,
  MusikweComment,
  MusikwePlaylist,
  MusikweRadioState,
  MusikweRequest,
  MusikweRequestHistory,
  MusikweTodayHistory,
  MusikweTrack,
  MusikweUser,
  extractYoutubeId,
  isAutoAdminEmail,
  musikweApi,
} from '../utils/musikweApi';
import { getStoredToken, getStoredUser } from '../utils/api';

const MUSIKWE_PERSIST_KEY = 'musikwe_persist_v1';

declare global {
  interface Window {
    YT?: {
      Player: any;
      PlayerState?: {
        UNSTARTED?: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING?: number;
        CUED?: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface PersistedMusikweSnapshot {
  tracks?: MusikweTrack[];
  catalogTracks?: MusikweTrack[];
  albums?: MusikweAlbum[];
  playlists?: MusikwePlaylist[];
  requests?: MusikweRequest[];
  requestHistory?: MusikweRequestHistory[];
  todayHistory?: MusikweTodayHistory[];
  logoUrl?: string;
  currentTrackId?: number;
  adHocTrack?: MusikweTrack | null;
  currentTrack?: MusikweTrack | null;
  progress?: number;
  volume?: number;
  shuffle?: boolean;
  playerActivated?: boolean;
  miniPlayerDismissed?: boolean;
  autoPlayQueue?: boolean;
  savedAt?: number;
}

function isSameTrackIdentity(
  a?: { id?: number; t?: string; a?: string; youtube_id?: string } | null,
  b?: { id?: number; t?: string; a?: string; youtube_id?: string } | null
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.youtube_id && b.youtube_id && a.youtube_id === b.youtube_id) return true;
  const aTitle = String(a.t || '').trim().toLowerCase();
  const aArtist = String(a.a || '').trim().toLowerCase();
  const bTitle = String(b.t || '').trim().toLowerCase();
  const bArtist = String(b.a || '').trim().toLowerCase();
  return Boolean(
    aTitle && aArtist && bTitle && bArtist && aTitle === bTitle && aArtist === bArtist
  );
}

function isTrackPlayedInTodayHistory(
  track: { id?: number; tid?: number; t?: string; title?: string; a?: string; artist?: string } | null | undefined,
  history: MusikweTodayHistory[]
): boolean {
  if (!track || !Array.isArray(history) || history.length === 0) return false;
  const trackId = Number(track.id ?? track.tid ?? 0);
  const titleNorm = String(track.t ?? track.title ?? '').trim().toLowerCase();
  const artistNorm = String(track.a ?? track.artist ?? '').trim().toLowerCase();
  return history.some((h) => {
    if (!h || typeof h !== 'object') return false;
    if (trackId > 0 && Number(h.track_id) > 0 && Number(h.track_id) === trackId) return true;
    if (titleNorm && artistNorm) {
      return (
        String(h.title || '').trim().toLowerCase() === titleNorm &&
        String(h.artist || '').trim().toLowerCase() === artistNorm
      );
    }
    return false;
  });
}

function hashSeedId(seed: string): number {
  let h = 0;
  const safeSeed = String(seed || '');
  for (let i = 0; i < safeSeed.length; i += 1) {
    h = (h * 31 + safeSeed.charCodeAt(i)) | 0;
  }
  return -Math.max(1000, Math.abs(h));
}

function sanitizeTrackItem(raw: any): MusikweTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id || 0);
  return {
    id: Number.isFinite(id) ? id : 0,
    t: String(raw.t ?? raw.title ?? 'Tanpa Judul'),
    a: String(raw.a ?? raw.artist ?? 'Artis Tidak Diketahui'),
    album_id: raw.album_id !== undefined ? Number(raw.album_id || 0) : undefined,
    album_name: raw.album_name !== undefined ? String(raw.album_name || '') : undefined,
    d: Math.max(15, Number(raw.d ?? raw.duration) || 200),
    h: Number(raw.h) || 210,
    url: String(raw.url ?? raw.audio_url ?? ''),
    youtube_id: raw.youtube_id ? String(raw.youtube_id) : undefined,
    ly: String(raw.ly ?? raw.lyrics ?? ''),
    img: String(raw.img ?? raw.cover_url ?? ''),
  };
}

function sanitizeAlbumItem(raw: any): MusikweAlbum | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: Number(raw.id || 0),
    title: String(raw.title || 'Album'),
    artist: String(raw.artist || 'Artis'),
    cover_url: String(raw.cover_url || ''),
    release_year: raw.release_year ? String(raw.release_year) : undefined,
  };
}

function sanitizePlaylistItem(raw: any): MusikwePlaylist | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: Number(raw.id || 0),
    n: String(raw.n ?? raw.name ?? 'Playlist'),
    ids: Array.isArray(raw.ids)
      ? raw.ids.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
      : [],
  };
}

function sanitizeRequestItem(raw: any): MusikweRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id || 0);
  if (!id) return null;
  return {
    id,
    tid: Number(raw.tid ?? raw.track_id ?? 0),
    title: raw.title ? String(raw.title) : undefined,
    artist: raw.artist ? String(raw.artist) : undefined,
    cover_url: raw.cover_url ? String(raw.cover_url) : undefined,
    youtube_id: raw.youtube_id ? String(raw.youtube_id) : undefined,
    duration: raw.duration ? Number(raw.duration) : undefined,
    by: String(raw.by ?? raw.requested_by ?? 'Pendengar'),
    user_email: raw.user_email ? String(raw.user_email) : undefined,
    v: Array.isArray(raw.v)
      ? raw.v.map((name: any) => String(name || '')).filter(Boolean)
      : [],
    ts: Number(raw.ts || Date.now()),
  };
}

function sanitizeRequestHistoryItem(raw: any): MusikweRequestHistory | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id || 0);
  if (!id) return null;
  return {
    id,
    tid: Number(raw.tid ?? raw.track_id ?? 0),
    title: String(raw.title || 'Tanpa Judul'),
    artist: String(raw.artist || 'Artis'),
    cover_url: raw.cover_url ? String(raw.cover_url) : undefined,
    youtube_id: raw.youtube_id ? String(raw.youtube_id) : undefined,
    duration: raw.duration ? Number(raw.duration) : undefined,
    by: String(raw.by ?? raw.requested_by ?? 'Pendengar'),
    user_email: raw.user_email ? String(raw.user_email) : undefined,
    status: String(raw.status || 'played'),
    ts: Number(raw.ts || Date.now()),
  };
}

function sanitizeTodayHistoryItem(raw: any): MusikweTodayHistory | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  if (!title) return null;
  return {
    id: Number(raw.id || Date.now()),
    track_id: Number(raw.track_id ?? raw.tid ?? 0),
    title,
    artist: String(raw.artist || 'Artis Tidak Diketahui'),
    cover_url: raw.cover_url ? String(raw.cover_url) : undefined,
    youtube_id: raw.youtube_id ? String(raw.youtube_id) : undefined,
    audio_url: raw.audio_url ? String(raw.audio_url) : undefined,
    duration: Number(raw.duration || 200),
    requested_by: raw.requested_by ? String(raw.requested_by) : undefined,
    played_at: Number(raw.played_at || Date.now()),
  };
}

function sanitizeArray<T>(raw: unknown, mapper: (item: any) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const clean = mapper(item);
    if (clean) out.push(clean);
  }
  return out;
}

function readPersistedSnapshot(): PersistedMusikweSnapshot {
  try {
    const raw = localStorage.getItem(MUSIKWE_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.removeItem(MUSIKWE_PERSIST_KEY);
      return {};
    }
    const obj = parsed as Record<string, any>;
    const cleanAdHoc = sanitizeTrackItem(obj.adHocTrack);
    const cleanCurrent = sanitizeTrackItem(obj.currentTrack);
    return {
      tracks: sanitizeArray(obj.tracks, sanitizeTrackItem),
      catalogTracks: sanitizeArray(obj.catalogTracks, sanitizeTrackItem),
      albums: sanitizeArray(obj.albums, sanitizeAlbumItem),
      playlists: sanitizeArray(obj.playlists, sanitizePlaylistItem),
      requests: sanitizeArray(obj.requests, sanitizeRequestItem),
      requestHistory: sanitizeArray(obj.requestHistory, sanitizeRequestHistoryItem),
      todayHistory: sanitizeArray(obj.todayHistory, sanitizeTodayHistoryItem),
      logoUrl: typeof obj.logoUrl === 'string' ? obj.logoUrl : '',
      currentTrackId: Number.isFinite(Number(obj.currentTrackId)) ? Number(obj.currentTrackId) : 0,
      adHocTrack: cleanAdHoc && cleanAdHoc.id !== 0 ? cleanAdHoc : null,
      currentTrack: cleanCurrent && cleanCurrent.id !== 0 ? cleanCurrent : null,
      progress: Number.isFinite(Number(obj.progress)) ? Number(obj.progress) : 0,
      volume: Number.isFinite(Number(obj.volume)) ? Number(obj.volume) : 80,
      shuffle: Boolean(obj.shuffle),
      playerActivated: Boolean(obj.playerActivated),
      miniPlayerDismissed: Boolean(obj.miniPlayerDismissed),
      autoPlayQueue: typeof obj.autoPlayQueue === 'boolean' ? obj.autoPlayQueue : true,
      savedAt: Number.isFinite(Number(obj.savedAt)) ? Number(obj.savedAt) : undefined,
    };
  } catch {
    try {
      localStorage.removeItem(MUSIKWE_PERSIST_KEY);
    } catch {
      // ignore storage errors
    }
    return {};
  }
}

function writePersistedSnapshot(snapshot: PersistedMusikweSnapshot): void {
  try {
    localStorage.setItem(MUSIKWE_PERSIST_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage quota errors
  }
}

export interface MusikweAuthSyncPayload {
  email?: string;
  name?: string;
  isAuthenticated: boolean;
}

export interface MusikWeContextValue {
  // User & auth identity
  authEmail: string;
  authName: string;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  setAuthContextUser: (payload: MusikweAuthSyncPayload) => void;
  displayName: string;
  setDisplayName: React.Dispatch<React.SetStateAction<string>>;
  who: () => string;
  authOpts: { userEmail: string };

  // Catalog & shared state
  tracks: MusikweTrack[];
  setTracks: React.Dispatch<React.SetStateAction<MusikweTrack[]>>;
  catalogTracks: MusikweTrack[];
  setCatalogTracks: React.Dispatch<React.SetStateAction<MusikweTrack[]>>;
  albums: MusikweAlbum[];
  setAlbums: React.Dispatch<React.SetStateAction<MusikweAlbum[]>>;
  playlists: MusikwePlaylist[];
  setPlaylists: React.Dispatch<React.SetStateAction<MusikwePlaylist[]>>;
  requests: MusikweRequest[];
  setRequests: React.Dispatch<React.SetStateAction<MusikweRequest[]>>;
  requestHistory: MusikweRequestHistory[];
  setRequestHistory: React.Dispatch<React.SetStateAction<MusikweRequestHistory[]>>;
  todayHistory: MusikweTodayHistory[];
  setTodayHistory: React.Dispatch<React.SetStateAction<MusikweTodayHistory[]>>;
  sortedRequests: MusikweRequest[];
  queue: MusikweRequest[];
  autoNextCandidate: {
    track: MusikweTrack;
    request?: MusikweRequest;
    source: 'request' | 'catalog';
  } | null;
  commentsMap: Record<string, MusikweComment[]>;
  serverUser: MusikweUser;
  logoUrl: string;
  setLogoUrl: React.Dispatch<React.SetStateAction<string>>;
  hasYoutubeKey: boolean;
  setHasYoutubeKey: React.Dispatch<React.SetStateAction<boolean>>;

  // Player state
  currentTrackId: number;
  setCurrentTrackId: React.Dispatch<React.SetStateAction<number>>;
  viewTrackId: number;
  setViewTrackId: React.Dispatch<React.SetStateAction<number>>;
  adHocTrack: MusikweTrack | null;
  currentTrack: MusikweTrack;
  hasActiveTrack: boolean;
  playerActivated: boolean;
  isPlaying: boolean;
  progress: number;
  duration: number;
  shuffle: boolean;
  setShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  likedIds: Set<number>;
  toggleLike: (id: number) => void;
  miniPlayerDismissed: boolean;
  setMiniPlayerDismissed: React.Dispatch<React.SetStateAction<boolean>>;

  // Live broadcast & auto-play queue state
  radioState: MusikweRadioState | null;
  isLiveBroadcastActive: boolean;
  isMuted: boolean;
  autoplayBlocked: boolean;
  autoPlayQueue: boolean;
  activeRequestId: number | null;
  toggleMute: () => void;
  toggleAutoPlayQueue: () => Promise<void>;
  joinLiveAudio: () => void;
  dismissMiniPlayer: () => void;

  // UI feedback
  loadingCount: number;
  beginLoading: () => void;
  endLoading: () => void;
  toastMsg: string;
  toastOpen: boolean;
  showToast: (msg: string) => void;
  resolvingExtKey: string | null;
  setResolvingExtKey: React.Dispatch<React.SetStateAction<string | null>>;

  // Playback & sync actions
  syncFromBackend: (q?: string, silent?: boolean) => Promise<void>;
  findTrack: (id?: number | null) => MusikweTrack;
  resolveRequestTrack: (rq: MusikweRequest) => MusikweTrack;
  findMatchingLocalTrack: (
    item: ExternalItunesItem | ExternalYoutubeItem
  ) => MusikweTrack | undefined;
  playResolvedTrack: (target: MusikweTrack, autoPlay?: boolean) => void;
  loadAndPlayTrack: (id: number, autoPlay?: boolean) => void;
  playExternalItem: (
    item: ExternalItunesItem | ExternalYoutubeItem,
    key?: string
  ) => Promise<void>;
  playHistoryTrack: (item: MusikweTodayHistory) => void;
  clearTodayHistory: () => Promise<void>;
  skipToRequest: (rq: MusikweRequest) => Promise<void>;
  togglePlayPause: () => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => void;
  seekTo: (sec: number) => void;
  stopPlayback: () => void;
  purgeTrackLocally: (trackId: number) => void;
}

const MusikWeContext = createContext<MusikWeContextValue | null>(null);

export const MusikWeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSnapshot = useMemo(() => readPersistedSnapshot(), []);
  const storedUser = useMemo(() => {
    try {
      return getStoredUser();
    } catch {
      return null;
    }
  }, []);

  const [authEmailState, setAuthEmailState] = useState<string>(() =>
    String(storedUser?.email || '').trim()
  );
  const [authNameState, setAuthNameState] = useState<string>(() =>
    String(storedUser?.full_name || storedUser?.name || '').trim()
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(getStoredToken() && storedUser);
    } catch {
      return false;
    }
  });

  const setAuthContextUser = useCallback((payload: MusikweAuthSyncPayload) => {
    setAuthEmailState((prev) => {
      const next = String(payload.email || '').trim();
      return prev === next ? prev : next;
    });
    setAuthNameState((prev) => {
      const next = String(payload.name || '').trim();
      return prev === next ? prev : next;
    });
    setIsAuthenticated((prev) =>
      prev === Boolean(payload.isAuthenticated) ? prev : Boolean(payload.isAuthenticated)
    );
  }, []);

  const [tracks, setTracks] = useState<MusikweTrack[]>(() =>
    Array.isArray(initialSnapshot.tracks) ? initialSnapshot.tracks : []
  );
  const [catalogTracks, setCatalogTracks] = useState<MusikweTrack[]>(() => {
    if (Array.isArray(initialSnapshot.catalogTracks) && initialSnapshot.catalogTracks.length > 0) {
      return initialSnapshot.catalogTracks;
    }
    return Array.isArray(initialSnapshot.tracks) ? initialSnapshot.tracks : [];
  });
  const [albums, setAlbums] = useState<MusikweAlbum[]>(() =>
    Array.isArray(initialSnapshot.albums) ? initialSnapshot.albums : []
  );
  const [playlists, setPlaylists] = useState<MusikwePlaylist[]>(() =>
    Array.isArray(initialSnapshot.playlists) ? initialSnapshot.playlists : []
  );
  const [requests, setRequests] = useState<MusikweRequest[]>(() =>
    Array.isArray(initialSnapshot.requests) ? initialSnapshot.requests : []
  );
  const [requestHistory, setRequestHistory] = useState<MusikweRequestHistory[]>(() =>
    Array.isArray(initialSnapshot.requestHistory) ? initialSnapshot.requestHistory : []
  );
  const [todayHistory, setTodayHistory] = useState<MusikweTodayHistory[]>(() =>
    Array.isArray(initialSnapshot.todayHistory) ? initialSnapshot.todayHistory : []
  );
  const [commentsMap, setCommentsMap] = useState<Record<string, MusikweComment[]>>({});
  const [serverUser, setServerUser] = useState<MusikweUser>({
    id: Number(storedUser?.id || 0),
    name: authNameState || 'Tamu',
    email: authEmailState || undefined,
    is_admin: isAutoAdminEmail(authEmailState),
  });
  const [logoUrl, setLogoUrl] = useState<string>(() => initialSnapshot.logoUrl || '');
  const [hasYoutubeKey, setHasYoutubeKey] = useState<boolean>(() =>
    Boolean(String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim())
  );

  const [displayName, setDisplayName] = useState<string>(() => authNameState || '');
  useEffect(() => {
    if (authNameState && !displayName.trim()) {
      setDisplayName(authNameState);
    }
  }, [authNameState, displayName]);

  const activeEmail = (authEmailState || serverUser.email || '').trim().toLowerCase();
  const isSuperAdmin = activeEmail === 'rizalsaragih498@gmail.com';

  const [adHocTrack, setAdHocTrack] = useState<MusikweTrack | null>(() => {
    if (initialSnapshot.adHocTrack && initialSnapshot.adHocTrack.id) {
      return initialSnapshot.adHocTrack;
    }
    if (initialSnapshot.currentTrack && initialSnapshot.currentTrack.id < 0) {
      return initialSnapshot.currentTrack;
    }
    return null;
  });

  const [currentTrackId, setCurrentTrackId] = useState<number>(() => {
    if (typeof initialSnapshot.currentTrackId === 'number' && initialSnapshot.currentTrackId !== 0) {
      return initialSnapshot.currentTrackId;
    }
    if (initialSnapshot.currentTrack?.id) {
      return initialSnapshot.currentTrack.id;
    }
    return initialSnapshot.tracks?.[0]?.id || 0;
  });

  const [viewTrackId, setViewTrackId] = useState<number>(() => currentTrackId);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(() =>
    typeof initialSnapshot.progress === 'number' && initialSnapshot.progress > 0
      ? initialSnapshot.progress
      : 0
  );
  const [shuffle, setShuffle] = useState<boolean>(() => Boolean(initialSnapshot.shuffle));
  const [volume, setVolume] = useState<number>(() =>
    typeof initialSnapshot.volume === 'number' ? initialSnapshot.volume : 80
  );
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [playerActivated, setPlayerActivated] = useState<boolean>(() =>
    Boolean(initialSnapshot.playerActivated && initialSnapshot.currentTrack?.id)
  );
  const [miniPlayerDismissed, setMiniPlayerDismissed] = useState<boolean>(() =>
    Boolean(initialSnapshot.miniPlayerDismissed)
  );

  // Live broadcast & auto-play queue states
  const [radioState, setRadioState] = useState<MusikweRadioState | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [autoPlayQueue, setAutoPlayQueue] = useState<boolean>(() =>
    typeof initialSnapshot.autoPlayQueue === 'boolean'
      ? initialSnapshot.autoPlayQueue
      : true
  );
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);

  const [loadingCount, setLoadingCount] = useState<number>(0);
  const [resolvingExtKey, setResolvingExtKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

  const beginLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const endLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);

  const showToast = useCallback((msg: string) => {
    if (!msg) return;
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const authOpts = useMemo(
    () => ({
      userEmail: authEmailState || serverUser.email || '',
    }),
    [authEmailState, serverUser.email]
  );

  const who = useCallback((): string => {
    return displayName.trim() || authNameState.trim() || serverUser.name || 'Tamu';
  }, [displayName, authNameState, serverUser.name]);

  const fallbackTrack: MusikweTrack = useMemo(
    () => ({
      id: 0,
      t: 'Belum ada lagu',
      a: isSuperAdmin ? 'Tambahkan lewat panel Admin' : 'Menunggu lagu dari Admin',
      d: 200,
      h: 210,
      url: '',
      ly: '',
      img: '',
    }),
    [isSuperAdmin]
  );

  const safeTracks = useMemo(() => (Array.isArray(tracks) ? tracks.filter(Boolean) : []), [tracks]);
  const safeCatalogTracks = useMemo(
    () => (Array.isArray(catalogTracks) ? catalogTracks.filter(Boolean) : []),
    [catalogTracks]
  );
  const safeAlbums = useMemo(() => (Array.isArray(albums) ? albums.filter(Boolean) : []), [albums]);
  const safePlaylists = useMemo(
    () => (Array.isArray(playlists) ? playlists.filter(Boolean) : []),
    [playlists]
  );
  const safeRequests = useMemo(
    () => (Array.isArray(requests) ? requests.filter(Boolean) : []),
    [requests]
  );
  const safeRequestHistory = useMemo(
    () => (Array.isArray(requestHistory) ? requestHistory.filter(Boolean) : []),
    [requestHistory]
  );
  const safeTodayHistory = useMemo(
    () => (Array.isArray(todayHistory) ? todayHistory.filter(Boolean) : []),
    [todayHistory]
  );

  const liveRadioTrack: MusikweTrack | null = useMemo(() => {
    const rTitle = String(radioState?.title || '').trim();
    const rArtist = String(radioState?.artist || '').trim();
    if (isSuperAdmin || !radioState || !rTitle) return null;
    const incomingYt = radioState.youtube_id || extractYoutubeId(radioState.audio_url);
    const pool = safeCatalogTracks.length > 0 ? safeCatalogTracks : safeTracks;
    const matchedLocal = pool.find(
      (t) =>
        (radioState.track_id > 0 && t.id === radioState.track_id) ||
        (Boolean(incomingYt) && t.youtube_id === incomingYt) ||
        (String(t.t || '').trim().toLowerCase() === rTitle.toLowerCase() &&
          String(t.a || '').trim().toLowerCase() === rArtist.toLowerCase())
    );
    const stableId =
      matchedLocal?.id ||
      hashSeedId(
        `${radioState.track_id || 0}|${incomingYt || radioState.audio_url || rTitle}|${rArtist}`
      );
    return {
      id: stableId,
      t: rTitle,
      a: rArtist || 'Admin .MUSIKWE',
      album_name: matchedLocal?.album_name || '',
      d: radioState.duration || matchedLocal?.d || 200,
      h: matchedLocal?.h || 210,
      url: incomingYt ? '' : radioState.audio_url || matchedLocal?.url || '',
      youtube_id: incomingYt || matchedLocal?.youtube_id || undefined,
      ly: matchedLocal?.ly || '',
      img:
        radioState.cover_url ||
        matchedLocal?.img ||
        (incomingYt ? `https://i.ytimg.com/vi/${incomingYt}/hqdefault.jpg` : ''),
    };
  }, [isSuperAdmin, radioState, safeCatalogTracks, safeTracks]);

  const findTrack = useCallback(
    (id?: number | null): MusikweTrack => {
      if (
        liveRadioTrack &&
        (id === undefined ||
          id === null ||
          id === 0 ||
          id === liveRadioTrack.id ||
          id === radioState?.track_id ||
          id === currentTrackId)
      ) {
        return liveRadioTrack;
      }
      if (adHocTrack && id === adHocTrack.id) return adHocTrack;
      const hit =
        safeTracks.find((t) => t.id === id) || safeCatalogTracks.find((t) => t.id === id);
      if (hit) return hit;
      if (safeTracks.length > 0) return safeTracks[0];
      if (safeCatalogTracks.length > 0) return safeCatalogTracks[0];
      return liveRadioTrack || adHocTrack || fallbackTrack;
    },
    [
      liveRadioTrack,
      radioState?.track_id,
      currentTrackId,
      adHocTrack,
      safeTracks,
      safeCatalogTracks,
      fallbackTrack,
    ]
  );

  const resolveRequestTrack = useCallback(
    (rq: MusikweRequest): MusikweTrack => {
      if (!rq || typeof rq !== 'object') return fallbackTrack;
      const hit =
        (rq.tid > 0 &&
          (safeTracks.find((t) => t.id === rq.tid) ||
            safeCatalogTracks.find((t) => t.id === rq.tid))) ||
        (rq.youtube_id
          ? safeTracks.find((t) => t.youtube_id === rq.youtube_id) ||
            safeCatalogTracks.find((t) => t.youtube_id === rq.youtube_id)
          : undefined);
      if (hit) return hit;
      if (rq.title) {
        return {
          id: rq.tid > 0 ? rq.tid : hashSeedId(`req_${rq.id}_${rq.title}`),
          t: String(rq.title || 'Tanpa Judul'),
          a: String(rq.artist || 'Artis Tidak Diketahui'),
          d: Number(rq.duration) || 200,
          h: 210,
          url: '',
          youtube_id: rq.youtube_id || undefined,
          ly: '',
          img:
            rq.cover_url ||
            (rq.youtube_id ? `https://i.ytimg.com/vi/${rq.youtube_id}/hqdefault.jpg` : ''),
        };
      }
      return findTrack(rq.tid);
    },
    [safeTracks, safeCatalogTracks, findTrack, fallbackTrack]
  );

  const currentTrack = useMemo(() => {
    if (liveRadioTrack) return liveRadioTrack;
    return adHocTrack && currentTrackId === adHocTrack.id
      ? adHocTrack
      : findTrack(currentTrackId);
  }, [liveRadioTrack, adHocTrack, findTrack, currentTrackId]);

  const hasActiveTrack = Boolean(currentTrack && currentTrack.id !== 0);
  const duration = currentTrack.d || 200;
  const isLiveBroadcastActive = Boolean(
    !isSuperAdmin && radioState && String(radioState.title || '').trim()
  );

  const sortedRequests = useMemo(() => {
    return [...safeRequests].sort(
      (a, b) =>
        (Array.isArray(b?.v) ? b.v.length : 0) - (Array.isArray(a?.v) ? a.v.length : 0) ||
        (Number(a?.ts) || 0) - (Number(b?.ts) || 0)
    );
  }, [safeRequests]);

  const autoNextCandidate = useMemo(() => {
    const eligibleReqs = sortedRequests.filter((rq) => {
      if (!rq || !rq.id) return false;
      if (playedRequestIdsRef.current.has(rq.id)) return false;
      if (activeRequestId && rq.id === activeRequestId) return false;
      const resolved = resolveRequestTrack(rq);
      return !isSameTrackIdentity(resolved, currentTrack);
    });
    if (eligibleReqs.length > 0) {
      const top = eligibleReqs[0];
      return {
        track: resolveRequestTrack(top),
        request: top,
        source: 'request' as const,
      };
    }

    const pool = safeCatalogTracks.length > 0 ? safeCatalogTracks : safeTracks;
    const curIdx = pool.findIndex((t) => isSameTrackIdentity(t, currentTrack));
    const orderedPool =
      curIdx >= 0 ? [...pool.slice(curIdx + 1), ...pool.slice(0, curIdx)] : pool;
    const nextCatalog = orderedPool.find(
      (t) =>
        !isSameTrackIdentity(t, currentTrack) &&
        !isTrackPlayedInTodayHistory(t, safeTodayHistory)
    );
    if (!nextCatalog) return null;
    return {
      track: nextCatalog,
      source: 'catalog' as const,
    };
  }, [
    sortedRequests,
    activeRequestId,
    resolveRequestTrack,
    currentTrack,
    safeCatalogTracks,
    safeTracks,
    safeTodayHistory,
  ]);

  // Persistent audio & YouTube engine refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const activeYtIdRef = useRef<string>('');
  const pendingYtPlayRef = useRef<{
    videoId: string;
    shouldPlay: boolean;
    startSeconds: number;
  } | null>(null);
  const ytAutoplayCheckRef = useRef<number | null>(null);
  const hasUserInteractedRef = useRef<boolean>(false);

  // Latest state refs for timers & callbacks
  const isSuperAdminRef = useRef<boolean>(isSuperAdmin);
  isSuperAdminRef.current = isSuperAdmin;
  const authOptsRef = useRef(authOpts);
  authOptsRef.current = authOpts;
  const currentTrackRef = useRef<MusikweTrack>(currentTrack);
  currentTrackRef.current = currentTrack;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const progressRef = useRef<number>(progress);
  progressRef.current = progress;
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;
  const shuffleRef = useRef<boolean>(shuffle);
  shuffleRef.current = shuffle;
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const autoplayBlockedRef = useRef<boolean>(autoplayBlocked);
  autoplayBlockedRef.current = autoplayBlocked;
  const radioStateRef = useRef<MusikweRadioState | null>(radioState);
  radioStateRef.current = radioState;
  const miniPlayerDismissedRef = useRef<boolean>(miniPlayerDismissed);
  miniPlayerDismissedRef.current = miniPlayerDismissed;
  const catalogTracksRef = useRef<MusikweTrack[]>(catalogTracks);
  catalogTracksRef.current = catalogTracks;
  const tracksRef = useRef<MusikweTrack[]>(tracks);
  tracksRef.current = tracks;
  const autoPlayQueueRef = useRef<boolean>(autoPlayQueue);
  autoPlayQueueRef.current = autoPlayQueue;
  const activeRequestIdRef = useRef<number | null>(activeRequestId);
  activeRequestIdRef.current = activeRequestId;
  const activeRequestedByRef = useRef<string>('');
  const sortedRequestsRef = useRef<MusikweRequest[]>(sortedRequests);
  sortedRequestsRef.current = sortedRequests;
  const todayHistoryRef = useRef<MusikweTodayHistory[]>(todayHistory);
  todayHistoryRef.current = todayHistory;
  const recentLocalHistoryRef = useRef<MusikweTodayHistory[]>([]);
  const clearedTodayAtRef = useRef<number>(0);
  const trackEndHandledRef = useRef<boolean>(false);
  const playedRequestIdsRef = useRef<Set<number>>(new Set());
  const joinLiveAudioRef = useRef<() => void>(() => {});

  // Detect any user gesture; if live broadcast was waiting for autoplay permission, unlock & play immediately
  useEffect(() => {
    const handleFirstOrUnlockInteraction = (ev: Event) => {
      hasUserInteractedRef.current = true;
      const target = ev.target as HTMLElement | null;
      if (target && target.closest('[data-musikwe-no-autounlock]')) {
        return;
      }
      if (
        !isSuperAdminRef.current &&
        autoplayBlockedRef.current &&
        radioStateRef.current?.is_playing &&
        !miniPlayerDismissedRef.current
      ) {
        joinLiveAudioRef.current();
      }
    };
    window.addEventListener('pointerdown', handleFirstOrUnlockInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstOrUnlockInteraction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstOrUnlockInteraction);
      window.removeEventListener('keydown', handleFirstOrUnlockInteraction);
    };
  }, []);

  const getAccuratePlaybackSeconds = useCallback((): number => {
    const tr = currentTrackRef.current;
    const ytId = tr.youtube_id || extractYoutubeId(tr.url);
    if (ytId && ytPlayerRef.current && ytReadyRef.current) {
      try {
        const ytTime = ytPlayerRef.current.getCurrentTime?.();
        if (typeof ytTime === 'number' && Number.isFinite(ytTime) && ytTime >= 0) {
          return ytTime;
        }
      } catch {
        // fallback below
      }
    } else if (audioRef.current && tr.url && Number.isFinite(audioRef.current.currentTime)) {
      return audioRef.current.currentTime;
    }
    return progressRef.current;
  }, []);

  // Broadcast Admin playback state to radio-state.php
  const broadcastRadioState = useCallback(
    (track: MusikweTrack, playingState: boolean, positionSec: number) => {
      if (!isSuperAdminRef.current) return;
      if (!getStoredToken()) return;
      if (!track || (track.id === 0 && playingState)) return;

      const ytId = track.youtube_id || extractYoutubeId(track.url) || '';
      musikweApi
        .updateRadioState(
          {
            track_id: track.id > 0 ? track.id : 0,
            title: track.t || '',
            artist: track.a || '',
            cover_url: track.img || '',
            audio_url: ytId ? '' : track.url || '',
            youtube_id: ytId,
            duration: track.d || 200,
            is_playing: playingState,
            position_sec: Math.max(0, positionSec),
            auto_play_queue: autoPlayQueueRef.current,
          },
          authOptsRef.current
        )
        .catch(() => {
          // Keep Admin playback uninterrupted on transient network errors
        });
    },
    []
  );

  const syncFromBackend = useCallback(
    async (q: string = '', silent: boolean = false) => {
      const token = getStoredToken();
      if (!token) return;

      if (!silent) {
        setLoadingCount((c) => c + 1);
      }
      try {
        const res = await musikweApi.read(q, authOpts);
        if (!res.success) {
          if (!silent) showToast(res.message || 'Gagal memuat data .MUSIKWE.');
          return;
        }
        const d = res.data || ({} as any);
        if (d.user && typeof d.user === 'object') {
          setServerUser(d.user);
        }

        const nextTracksList = sanitizeArray(d.tracks, sanitizeTrackItem);
        if (Array.isArray(d.tracks)) {
          setTracks(nextTracksList);
          if (!q.trim()) {
            setCatalogTracks(nextTracksList);
          } else if (nextTracksList.length > 0) {
            setCatalogTracks((prev) => {
              const safePrev = Array.isArray(prev) ? prev : [];
              const byId = new Map(safePrev.map((t) => [t.id, t]));
              nextTracksList.forEach((t) => byId.set(t.id, t));
              return Array.from(byId.values());
            });
          }
        }

        if (Array.isArray(d.albums)) {
          setAlbums(sanitizeArray(d.albums, sanitizeAlbumItem));
        }
        if (Array.isArray(d.playlists)) {
          setPlaylists(sanitizeArray(d.playlists, sanitizePlaylistItem));
        }

        if (Array.isArray(d.requests)) {
          const cleanReqs = sanitizeArray(d.requests, sanitizeRequestItem);
          setRequests(cleanReqs.filter((r) => !playedRequestIdsRef.current.has(r.id)));
        }
        if (Array.isArray(d.request_history)) {
          const cleanHist = sanitizeArray(d.request_history, sanitizeRequestHistoryItem);
          setRequestHistory((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            const serverIds = new Set(cleanHist.map((h) => h.id));
            const pendingLocalPlayed = safePrev.filter(
              (h) => playedRequestIdsRef.current.has(h.id) && !serverIds.has(h.id)
            );
            return [...pendingLocalPlayed, ...cleanHist];
          });
        }
        if (Array.isArray(d.today_history)) {
          const cleanToday = sanitizeArray(d.today_history, sanitizeTodayHistoryItem);
          const now = Date.now();
          const recentLocal = (Array.isArray(recentLocalHistoryRef.current)
            ? recentLocalHistoryRef.current
            : []
          ).filter(
            (loc) =>
              loc.played_at > clearedTodayAtRef.current &&
              now - loc.played_at < 8000 &&
              !cleanToday.some(
                (srv) =>
                  (loc.track_id > 0 && srv.track_id === loc.track_id) ||
                  (String(srv.title || '').trim().toLowerCase() ===
                    String(loc.title || '').trim().toLowerCase() &&
                    String(srv.artist || '').trim().toLowerCase() ===
                      String(loc.artist || '').trim().toLowerCase())
              )
          );
          recentLocalHistoryRef.current = recentLocal;
          const mergedToday = [...recentLocal, ...cleanToday].sort(
            (a, b) => b.played_at - a.played_at
          );
          todayHistoryRef.current = mergedToday;
          setTodayHistory(mergedToday);
        }
        setCommentsMap((prev) =>
          d.comments && typeof d.comments === 'object' && Object.keys(d.comments).length > 0
            ? d.comments
            : prev || {}
        );

        if (typeof d.logo_url === 'string') setLogoUrl(d.logo_url.trim());
        if (typeof d.has_youtube_key === 'boolean') {
          setHasYoutubeKey((prev) => prev || Boolean(d.has_youtube_key));
        }
        if (!displayName.trim() && d.user?.name && d.user.name !== 'Tamu') {
          setDisplayName(d.user.name);
        }
        if (!q.trim() && (isSuperAdminRef.current || !radioStateRef.current?.title)) {
          setCurrentTrackId((prev) => {
            if (prev < 0) return prev;
            if (nextTracksList.length === 0) return 0;
            if (prev > 0 && nextTracksList.some((x) => x.id === prev)) return prev;
            return nextTracksList[0].id;
          });
          setViewTrackId((prev) => {
            if (prev < 0) return prev;
            if (nextTracksList.length === 0) return 0;
            if (prev > 0 && nextTracksList.some((x) => x.id === prev)) return prev;
            return nextTracksList[0].id;
          });
        }
      } catch (err: any) {
        if (!silent) {
          showToast(err?.message || 'Gagal terhubung ke server .MUSIKWE.');
        }
      } finally {
        if (!silent) {
          setLoadingCount((c) => Math.max(0, c - 1));
        }
      }
    },
    [authOpts, displayName, showToast]
  );

  // Sync catalog/requests from backend on login/mount & 15s polling
  useEffect(() => {
    if (!isAuthenticated) {
      setIsPlaying(false);
      setRadioState(null);
      setAutoplayBlocked(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {
          // ignore
        }
      }
      return;
    }

    syncFromBackend('', true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromBackend('', true);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, authEmailState, syncFromBackend]);

  // Persist snapshot of tracks, currentTrack, and queue to localStorage ('musikwe_persist_v1')
  useEffect(() => {
    writePersistedSnapshot({
      tracks,
      catalogTracks,
      albums,
      playlists,
      requests,
      requestHistory,
      todayHistory,
      logoUrl,
      currentTrackId,
      adHocTrack,
      currentTrack: hasActiveTrack ? currentTrack : null,
      progress,
      volume,
      shuffle,
      playerActivated,
      miniPlayerDismissed,
      autoPlayQueue,
      savedAt: Date.now(),
    });
  }, [
    tracks,
    catalogTracks,
    albums,
    playlists,
    requests,
    requestHistory,
    todayHistory,
    logoUrl,
    currentTrackId,
    adHocTrack,
    hasActiveTrack,
    currentTrack,
    progress,
    volume,
    shuffle,
    playerActivated,
    miniPlayerDismissed,
    autoPlayQueue,
  ]);

  // Initialize persistent HTML5 Audio element once at root level
  useEffect(() => {
    const aud = new Audio();
    aud.preload = 'none';
    aud.volume = volume / 100;
    aud.muted = isMuted;
    audioRef.current = aud;
    return () => {
      aud.pause();
      aud.removeAttribute('src');
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextTrackRef = useRef<() => Promise<void>>(async () => {});
  const handleTrackEndedRef = useRef<() => void>(() => {});

  const scheduleYtAutoplayCheck = useCallback(() => {
    if (ytAutoplayCheckRef.current !== null) {
      window.clearTimeout(ytAutoplayCheckRef.current);
      ytAutoplayCheckRef.current = null;
    }
    if (isSuperAdminRef.current || isMutedRef.current) return;

    ytAutoplayCheckRef.current = window.setTimeout(() => {
      ytAutoplayCheckRef.current = null;
      if (isSuperAdminRef.current || miniPlayerDismissedRef.current) return;
      if (!radioStateRef.current?.is_playing) return;
      const yt = ytPlayerRef.current;
      if (!yt || !ytReadyRef.current) return;
      try {
        const state = yt.getPlayerState?.();
        const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
        const bufferingState = window.YT?.PlayerState?.BUFFERING ?? 3;
        if (state !== playingState && state !== bufferingState) {
          setAutoplayBlocked(true);
        }
      } catch {
        // ignore
      }
    }, 1300);
  }, []);

  const ensureYoutubePlayer = useCallback(
    (videoId: string, shouldPlay: boolean, startSeconds: number = 0) => {
      const safeStart = Math.max(0, startSeconds);
      pendingYtPlayRef.current = { videoId, shouldPlay, startSeconds: safeStart };

      const mountPlayer = () => {
        if (!window.YT?.Player || !ytContainerRef.current) return;
        if (ytPlayerRef.current && ytReadyRef.current) {
          if (activeYtIdRef.current !== videoId) {
            activeYtIdRef.current = videoId;
            ytPlayerRef.current.loadVideoById({
              videoId,
              startSeconds: safeStart,
            });
            if (!shouldPlay) {
              ytPlayerRef.current.pauseVideo();
            } else {
              scheduleYtAutoplayCheck();
            }
          } else {
            if (safeStart > 0) {
              try {
                const cur = ytPlayerRef.current.getCurrentTime?.() ?? 0;
                if (Math.abs(cur - safeStart) > 2.5) {
                  ytPlayerRef.current.seekTo(safeStart, true);
                }
              } catch {
                // ignore
              }
            }
            if (shouldPlay) {
              ytPlayerRef.current.playVideo();
              scheduleYtAutoplayCheck();
            } else {
              ytPlayerRef.current.pauseVideo();
            }
          }
          if (isMutedRef.current) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.setVolume(volumeRef.current);
          }
          return;
        }

        if (ytPlayerRef.current) return;
        activeYtIdRef.current = videoId;
        ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
          height: '1',
          width: '1',
          videoId,
          playerVars: {
            autoplay: shouldPlay ? 1 : 0,
            start: Math.floor(safeStart),
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev: any) => {
              ytReadyRef.current = true;
              if (isMutedRef.current) {
                ev.target.mute();
              } else {
                ev.target.unMute();
                ev.target.setVolume(volumeRef.current);
              }
              const pending = pendingYtPlayRef.current;
              if (pending) {
                if (pending.videoId !== activeYtIdRef.current) {
                  activeYtIdRef.current = pending.videoId;
                  ev.target.loadVideoById({
                    videoId: pending.videoId,
                    startSeconds: pending.startSeconds,
                  });
                } else if (pending.startSeconds > 1) {
                  ev.target.seekTo(pending.startSeconds, true);
                }
                if (pending.shouldPlay) {
                  ev.target.playVideo();
                  scheduleYtAutoplayCheck();
                } else {
                  ev.target.pauseVideo();
                }
              } else if (shouldPlay) {
                ev.target.playVideo();
                scheduleYtAutoplayCheck();
              }
            },
            onStateChange: (ev: any) => {
              const endedState = window.YT?.PlayerState?.ENDED ?? 0;
              const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
              if (ev.data === playingState) {
                if (!isMutedRef.current) {
                  setAutoplayBlocked(false);
                }
                if (ytAutoplayCheckRef.current !== null) {
                  window.clearTimeout(ytAutoplayCheckRef.current);
                  ytAutoplayCheckRef.current = null;
                }
                try {
                  const ytDur = ev.target?.getDuration?.();
                  if (typeof ytDur === 'number' && ytDur > 5) {
                    setAdHocTrack((prev) =>
                      prev &&
                      prev.youtube_id === activeYtIdRef.current &&
                      Math.abs(prev.d - ytDur) > 2
                        ? { ...prev, d: Math.round(ytDur) }
                        : prev
                    );
                  }
                } catch {
                  // ignore
                }
              }
              if (ev.data === endedState) {
                handleTrackEndedRef.current();
              }
            },
          },
        });
      };

      if (window.YT?.Player) {
        mountPlayer();
        return;
      }

      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCb?.();
        mountPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    },
    [scheduleYtAutoplayCheck]
  );

  // Clean up YT player only when entire app root unmounts
  useEffect(() => {
    return () => {
      if (ytAutoplayCheckRef.current !== null) {
        window.clearTimeout(ytAutoplayCheckRef.current);
      }
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
    };
  }, []);

  // Internal loader shared by local/Admin playback and Listener live sync
  const applyTrackToPlayer = useCallback(
    (
      target: MusikweTrack,
      autoPlay: boolean,
      startSec: number = 0,
      options?: { broadcast?: boolean; unDismiss?: boolean }
    ) => {
      if (!target || target.id === 0) return;
      const shouldBroadcast = options?.broadcast ?? isSuperAdminRef.current;
      const shouldUnDismiss = options?.unDismiss ?? true;
      const safeStart = Math.max(0, startSec);

      trackEndHandledRef.current = false;
      setPlayerActivated(true);
      if (shouldUnDismiss) {
        setMiniPlayerDismissed(false);
      }
      if (target.id < 0) {
        setAdHocTrack(target);
      } else {
        setAdHocTrack(null);
      }

      setCurrentTrackId(target.id);
      setViewTrackId(target.id);
      setProgress(safeStart);
      setIsPlaying(autoPlay);

      const aud = audioRef.current;
      const ytId = target.youtube_id || extractYoutubeId(target.url);

      if (ytId) {
        if (aud) {
          aud.pause();
          aud.removeAttribute('src');
        }
        ensureYoutubePlayer(ytId, autoPlay, safeStart);
      } else {
        if (ytPlayerRef.current && ytReadyRef.current) {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {
            // ignore
          }
        }
        if (aud) {
          if (target.url) {
            if (aud.src !== target.url) {
              aud.src = target.url;
            }
            aud.muted = isMutedRef.current;
            aud.volume = volumeRef.current / 100;
            try {
              aud.currentTime = safeStart;
            } catch {
              // ignore before metadata load
            }
            if (autoPlay) {
              aud
                .play()
                .then(() => {
                  if (!isMutedRef.current) setAutoplayBlocked(false);
                })
                .catch(() => {
                  if (!isSuperAdminRef.current) {
                    setAutoplayBlocked(true);
                  }
                });
            } else {
              aud.pause();
            }
          } else {
            aud.pause();
            aud.removeAttribute('src');
          }
        }
      }

      if (shouldBroadcast && isSuperAdminRef.current) {
        broadcastRadioState(target, autoPlay, safeStart);
      }
    },
    [ensureYoutubePlayer, broadcastRadioState]
  );

  const playResolvedTrack = useCallback(
    (target: MusikweTrack, autoPlay: boolean = true) => {
      applyTrackToPlayer(target, autoPlay, 0, {
        broadcast: isSuperAdminRef.current,
        unDismiss: true,
      });
    },
    [applyTrackToPlayer]
  );

  const loadAndPlayTrack = useCallback(
    (id: number, autoPlay: boolean = true) => {
      activeRequestIdRef.current = null;
      activeRequestedByRef.current = '';
      setActiveRequestId(null);
      if (adHocTrack && id === adHocTrack.id) {
        playResolvedTrack(adHocTrack, autoPlay);
        return;
      }
      const target =
        tracks.find((t) => t.id === id) ||
        catalogTracks.find((t) => t.id === id) ||
        tracks[0] ||
        catalogTracks[0];
      if (!target) return;
      playResolvedTrack(target, autoPlay);
    },
    [adHocTrack, tracks, catalogTracks, playResolvedTrack]
  );

  const findMatchingLocalTrack = useCallback(
    (item: ExternalItunesItem | ExternalYoutubeItem): MusikweTrack | undefined => {
      if (!item) return undefined;
      const pool = safeCatalogTracks.length > 0 ? safeCatalogTracks : safeTracks;
      if (item.source === 'youtube') {
        const byYt = pool.find((t) => t.youtube_id === item.youtube_id);
        if (byYt) return byYt;
      }
      const normTitle = String(item.title || '').trim().toLowerCase();
      const normArtist = String(item.artist || '').trim().toLowerCase();
      return pool.find(
        (t) =>
          String(t.t || '').trim().toLowerCase() === normTitle &&
          String(t.a || '').trim().toLowerCase() === normArtist
      );
    },
    [safeCatalogTracks, safeTracks]
  );

  const playExternalItem = useCallback(
    async (item: ExternalItunesItem | ExternalYoutubeItem, key?: string) => {
      activeRequestIdRef.current = null;
      activeRequestedByRef.current = '';
      setActiveRequestId(null);
      if (item.source === 'itunes') {
        console.log('[iTUNES SELECT]', {
          action: 'play',
          title: item.title,
          artist: item.artist,
          cover_url: item.cover_url,
          duration: item.duration_sec,
        });
      }

      const existing = findMatchingLocalTrack(item);
      if (existing && (existing.youtube_id || existing.url)) {
        playResolvedTrack(existing, true);
        return;
      }

      const persistPlayedTrack = (resolvedTrack: MusikweTrack) => {
        musikweApi
          .postAction(
            'create.php',
            {
              action: 'save_played_track',
              title: resolvedTrack.t,
              artist: resolvedTrack.a,
              youtube_id: resolvedTrack.youtube_id || '',
              audio_url: resolvedTrack.url || '',
              cover_url: resolvedTrack.img || '',
              duration: resolvedTrack.d || 200,
            },
            authOpts
          )
          .then((saved) => {
            const savedId = Number(saved?.data?.id || 0);
            if (saved?.success && savedId > 0) {
              const persistedTrack: MusikweTrack = { ...resolvedTrack, id: savedId };
              setCatalogTracks((prev) =>
                prev.some((x) => x.id === savedId) ? prev : [persistedTrack, ...prev]
              );
              setTracks((prev) =>
                prev.some((x) => x.id === savedId) ? prev : [persistedTrack, ...prev]
              );
              setCurrentTrackId((prev) => (prev === resolvedTrack.id ? savedId : prev));
              setViewTrackId((prev) => (prev === resolvedTrack.id ? savedId : prev));
              setAdHocTrack((prev) => (prev && prev.id === resolvedTrack.id ? null : prev));
              if (isSuperAdminRef.current && currentTrackRef.current.t === persistedTrack.t) {
                broadcastRadioState(
                  persistedTrack,
                  isPlayingRef.current,
                  getAccuratePlaybackSeconds()
                );
              }
            }
          })
          .catch(() => {
            // Keep playback uninterrupted if backend rejects save
          });
      };

      if (item.source === 'youtube') {
        const tempTrack: MusikweTrack = {
          id: -Math.abs(Date.now()),
          t: item.title,
          a: item.artist,
          album_name: item.album || '',
          d: item.duration_sec || 200,
          h: 205,
          url: '',
          youtube_id: item.youtube_id,
          ly: '',
          img: item.cover_url || `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`,
        };
        playResolvedTrack(tempTrack, true);
        persistPlayedTrack(tempTrack);
        return;
      }

      if (key) setResolvingExtKey(key);
      setLoadingCount((c) => c + 1);
      try {
        const ytMatch = await musikweApi.searchYoutubeBestMatch(
          item.title,
          item.artist,
          authOpts
        );
        const videoId = ytMatch.youtube_id;
        if (!videoId) {
          showToast(`Video YouTube tidak ditemukan untuk "${item.title}".`);
          return;
        }

        const tempId = -Math.abs(Number(item.trackId) || Date.now());
        const ytTrack: MusikweTrack = {
          id: tempId,
          t: item.title,
          a: item.artist,
          album_name: item.album || '',
          d: item.duration_sec || ytMatch.duration_sec || 200,
          h: 210,
          url: '',
          youtube_id: videoId,
          ly: '',
          img: item.cover_url || ytMatch.cover_url,
        };
        playResolvedTrack(ytTrack, true);
        persistPlayedTrack(ytTrack);
      } catch (err: any) {
        showToast(err?.message || `Gagal mencocokkan video YouTube untuk "${item.title}".`);
      } finally {
        if (key) setResolvingExtKey(null);
        setLoadingCount((c) => Math.max(0, c - 1));
      }
    },
    [
      findMatchingLocalTrack,
      playResolvedTrack,
      authOpts,
      showToast,
      broadcastRadioState,
      getAccuratePlaybackSeconds,
    ]
  );

  const seekInternal = useCallback((sec: number, broadcast: boolean) => {
    const tr = currentTrackRef.current;
    const clamped = Math.max(0, Math.min(tr.d || 200, sec));
    if (clamped < Math.max(1, (tr.d || 200) - 3)) {
      trackEndHandledRef.current = false;
    }
    setProgress(clamped);
    const ytId = tr.youtube_id || extractYoutubeId(tr.url);
    if (ytId && ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(clamped, true);
      } catch {
        // ignore
      }
    } else if (audioRef.current && tr.url) {
      try {
        audioRef.current.currentTime = clamped;
      } catch {
        // ignore
      }
    }
    if (broadcast && isSuperAdminRef.current) {
      broadcastRadioState(tr, isPlayingRef.current, clamped);
    }
  }, [broadcastRadioState]);

  const seekTo = useCallback(
    (sec: number) => {
      seekInternal(sec, isSuperAdminRef.current);
    },
    [seekInternal]
  );

  const markRequestPlayed = useCallback(
    (reqItem: MusikweRequest, resolvedOverride?: MusikweTrack, skipServerCall: boolean = false) => {
      if (!reqItem || !reqItem.id) return;
      playedRequestIdsRef.current.add(reqItem.id);
      setRequests((prev) => prev.filter((x) => x.id !== reqItem.id));

      const resolved = resolvedOverride || resolveRequestTrack(reqItem);
      const ytId = reqItem.youtube_id || resolved.youtube_id || extractYoutubeId(resolved.url) || '';
      const histItem: MusikweRequestHistory = {
        id: reqItem.id,
        tid: reqItem.tid,
        title: reqItem.title || resolved.t,
        artist: reqItem.artist || resolved.a,
        cover_url: reqItem.cover_url || resolved.img,
        youtube_id: ytId || undefined,
        duration: reqItem.duration || resolved.d,
        by: reqItem.by,
        user_email: reqItem.user_email,
        status: 'played',
        ts: Date.now(),
      };
      setRequestHistory((prev) => [
        histItem,
        ...prev.filter((h) => h.id !== reqItem.id),
      ]);

      if (skipServerCall) return;

      musikweApi
        .postAction(
          'update.php',
          {
            action: 'mark_played',
            id: reqItem.id,
            track_id: reqItem.tid || 0,
            title: histItem.title,
            artist: histItem.artist,
            cover_url: histItem.cover_url || '',
            youtube_id: ytId,
            audio_url: ytId ? '' : resolved.url || '',
            duration: histItem.duration || 200,
            requested_by: reqItem.by || '',
          },
          authOptsRef.current
        )
        .then((res) => {
          if (res.success) {
            window.setTimeout(() => {
              syncFromBackend('', true);
            }, 450);
          }
        })
        .catch(() => {});
    },
    [resolveRequestTrack, syncFromBackend]
  );

  const playQueueRequestItem = useCallback(
    async (rq: MusikweRequest): Promise<boolean> => {
      let resolved = resolveRequestTrack(rq);

      // Immediately move this request out of active queue and into Riwayat Request
      markRequestPlayed(rq, resolved);
      activeRequestIdRef.current = rq.id;
      activeRequestedByRef.current = rq.by || '';
      setActiveRequestId(rq.id);

      if (!resolved.url && !resolved.youtube_id) {
        try {
          const ytMatch = await musikweApi.searchYoutubeBestMatch(
            resolved.t,
            resolved.a,
            authOptsRef.current
          );
          if (ytMatch.youtube_id) {
            resolved = {
              ...resolved,
              youtube_id: ytMatch.youtube_id,
              img: resolved.img || ytMatch.cover_url,
              d: resolved.d || ytMatch.duration_sec || 200,
            };
          }
        } catch {
          // Keep going if YT lookup fails
        }
      }

      if (!resolved.url && !resolved.youtube_id) {
        showToast(`Sumber audio tidak ditemukan untuk "${resolved.t}".`);
        return false;
      }

      playResolvedTrack(resolved, true);
      return true;
    },
    [resolveRequestTrack, markRequestPlayed, playResolvedTrack, showToast]
  );

  const findCurrentlyPlayingRequest = useCallback((): MusikweRequest | undefined => {
    const curList = Array.isArray(sortedRequestsRef.current) ? sortedRequestsRef.current : [];
    if (curList.length === 0) return undefined;
    if (activeRequestIdRef.current) {
      const byActive = curList.find((r) => r.id === activeRequestIdRef.current);
      if (byActive) return byActive;
    }
    const cur = currentTrackRef.current;
    if (!cur || cur.id === 0) return undefined;
    const curYt = cur.youtube_id || extractYoutubeId(cur.url);
    return curList.find((rq) => {
      const resolved = resolveRequestTrack(rq);
      if (cur.id > 0 && resolved.id === cur.id) return true;
      if (curYt && resolved.youtube_id && resolved.youtube_id === curYt) return true;
      return (
        String(resolved.t || '').trim().toLowerCase() === String(cur.t || '').trim().toLowerCase() &&
        String(resolved.a || '').trim().toLowerCase() === String(cur.a || '').trim().toLowerCase()
      );
    });
  }, [resolveRequestTrack]);

  const pickNextCandidate = useCallback(
    (
      reqList: MusikweRequest[],
      historyList: MusikweTodayHistory[],
      curTrack: MusikweTrack,
      useRandomShuffle: boolean
    ): { track: MusikweTrack; request?: MusikweRequest; source: 'request' | 'catalog' } | null => {
      const eligibleReqs = reqList.filter((rq) => {
        if (playedRequestIdsRef.current.has(rq.id)) return false;
        if (activeRequestIdRef.current && rq.id === activeRequestIdRef.current) return false;
        const resolved = resolveRequestTrack(rq);
        return !isSameTrackIdentity(resolved, curTrack);
      });
      if (eligibleReqs.length > 0) {
        const topReq = eligibleReqs[0];
        return {
          track: resolveRequestTrack(topReq),
          request: topReq,
          source: 'request',
        };
      }

      const pool = catalogTracksRef.current.length > 0 ? catalogTracksRef.current : tracksRef.current;
      const eligibleCatalog = pool.filter(
        (t) =>
          !isSameTrackIdentity(t, curTrack) &&
          !isTrackPlayedInTodayHistory(t, historyList)
      );
      if (eligibleCatalog.length === 0) {
        return null;
      }

      let chosen: MusikweTrack;
      if (useRandomShuffle) {
        chosen = eligibleCatalog[Math.floor(Math.random() * eligibleCatalog.length)];
      } else {
        const curIdx = pool.findIndex((t) => isSameTrackIdentity(t, curTrack));
        if (curIdx >= 0) {
          const orderedAfter = [...pool.slice(curIdx + 1), ...pool.slice(0, curIdx)];
          chosen =
            orderedAfter.find(
              (t) =>
                !isSameTrackIdentity(t, curTrack) &&
                !isTrackPlayedInTodayHistory(t, historyList)
            ) || eligibleCatalog[0];
        } else {
          chosen = eligibleCatalog[0];
        }
      }
      return {
        track: chosen,
        source: 'catalog',
      };
    },
    [resolveRequestTrack]
  );

  const pauseAllEngines = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // ignore
      }
    }
  }, []);

  const skipToRequest = useCallback(
    async (rq: MusikweRequest) => {
      const tr = resolveRequestTrack(rq);
      showToast(`Memutar sekarang: ${tr.t}`);
      await playQueueRequestItem(rq);
    },
    [resolveRequestTrack, playQueueRequestItem, showToast]
  );

  const nextTrack = useCallback(async () => {
    const prevActiveId = activeRequestIdRef.current;
    const finishedReq = findCurrentlyPlayingRequest();
    let remainingRequests = sortedRequestsRef.current.filter(
      (x) => !playedRequestIdsRef.current.has(x.id) && x.id !== prevActiveId
    );
    if (finishedReq) {
      markRequestPlayed(finishedReq);
      remainingRequests = remainingRequests.filter((x) => x.id !== finishedReq.id);
    }

    activeRequestIdRef.current = null;
    activeRequestedByRef.current = '';
    setActiveRequestId(null);

    const candidate = pickNextCandidate(
      remainingRequests,
      todayHistoryRef.current,
      currentTrackRef.current,
      shuffleRef.current
    );

    if (candidate?.request) {
      const ok = await playQueueRequestItem(candidate.request);
      if (ok) {
        showToast(`Memutar request ${candidate.request.by}: ${candidate.track.t}`);
        return;
      }
    } else if (candidate?.track) {
      loadAndPlayTrack(candidate.track.id, true);
      return;
    }

    pauseAllEngines();
    if (isSuperAdminRef.current && currentTrackRef.current.id !== 0) {
      broadcastRadioState(currentTrackRef.current, false, 0);
    }
    showToast('Semua lagu hari ini sudah diputar · Menunggu request baru');
  }, [
    findCurrentlyPlayingRequest,
    markRequestPlayed,
    pickNextCandidate,
    playQueueRequestItem,
    loadAndPlayTrack,
    pauseAllEngines,
    showToast,
    broadcastRadioState,
  ]);

  nextTrackRef.current = nextTrack;

  const handleTrackEnded = useCallback(async () => {
    if (trackEndHandledRef.current) return;
    if (!isSuperAdminRef.current && radioStateRef.current) return;
    trackEndHandledRef.current = true;

    const finishedReq = findCurrentlyPlayingRequest();
    const finishedReqId = finishedReq?.id || activeRequestIdRef.current || 0;
    const finishedRequestedBy = finishedReq?.by || activeRequestedByRef.current || '';
    const finishedTrack = currentTrackRef.current;

    if (finishedReq) {
      markRequestPlayed(finishedReq, finishedTrack, true);
    } else if (finishedReqId > 0) {
      playedRequestIdsRef.current.add(finishedReqId);
      setRequests((prev) => prev.filter((x) => x.id !== finishedReqId));
    }

    const remainingRequests = sortedRequestsRef.current.filter(
      (x) =>
        !playedRequestIdsRef.current.has(x.id) &&
        x.id !== finishedReqId &&
        x.id !== finishedReq?.id
    );

    let updatedTodayHistory = todayHistoryRef.current;
    if (finishedTrack.id !== 0 && finishedTrack.t.trim()) {
      const ytId = finishedTrack.youtube_id || extractYoutubeId(finishedTrack.url) || '';
      const todayEntry: MusikweTodayHistory = {
        id: Date.now(),
        track_id: finishedTrack.id > 0 ? finishedTrack.id : 0,
        title: finishedTrack.t,
        artist: finishedTrack.a,
        cover_url:
          finishedTrack.img ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined),
        youtube_id: ytId || undefined,
        audio_url: ytId ? undefined : finishedTrack.url || undefined,
        duration: finishedTrack.d || 200,
        requested_by: finishedRequestedBy || undefined,
        played_at: Date.now(),
      };
      recentLocalHistoryRef.current = [todayEntry, ...recentLocalHistoryRef.current];
      updatedTodayHistory = [todayEntry, ...todayHistoryRef.current];
      todayHistoryRef.current = updatedTodayHistory;
      setTodayHistory(updatedTodayHistory);

      musikweApi
        .postAction(
          'update.php',
          {
            action: 'mark_played',
            id: finishedReqId,
            track_id: finishedTrack.id > 0 ? finishedTrack.id : 0,
            title: finishedTrack.t,
            artist: finishedTrack.a,
            cover_url: finishedTrack.img || '',
            youtube_id: ytId,
            audio_url: ytId ? '' : finishedTrack.url || '',
            duration: finishedTrack.d || 200,
            requested_by: finishedRequestedBy,
          },
          authOptsRef.current
        )
        .then((res) => {
          if (res.success) {
            window.setTimeout(() => {
              syncFromBackend('', true);
            }, 450);
          }
        })
        .catch(() => {});
    }

    activeRequestIdRef.current = null;
    activeRequestedByRef.current = '';
    setActiveRequestId(null);

    if (!autoPlayQueueRef.current) {
      pauseAllEngines();
      if (isSuperAdminRef.current && finishedTrack.id !== 0) {
        broadcastRadioState(finishedTrack, false, 0);
        showToast('Auto-Play OFF: menunggu Admin putar lagu berikutnya.');
      }
      return;
    }

    const nextCandidate = pickNextCandidate(
      remainingRequests,
      updatedTodayHistory,
      finishedTrack,
      shuffleRef.current
    );

    if (!nextCandidate) {
      pauseAllEngines();
      if (isSuperAdminRef.current && finishedTrack.id !== 0) {
        broadcastRadioState(finishedTrack, false, 0);
      }
      showToast('Semua lagu hari ini sudah diputar · Menunggu request baru');
      return;
    }

    if (nextCandidate.request) {
      const ok = await playQueueRequestItem(nextCandidate.request);
      if (ok) {
        showToast(`Memutar request ${nextCandidate.request.by}: ${nextCandidate.track.t}`);
        return;
      }
    } else {
      loadAndPlayTrack(nextCandidate.track.id, true);
      return;
    }

    pauseAllEngines();
    if (isSuperAdminRef.current && finishedTrack.id !== 0) {
      broadcastRadioState(finishedTrack, false, 0);
    }
  }, [
    findCurrentlyPlayingRequest,
    markRequestPlayed,
    syncFromBackend,
    pauseAllEngines,
    broadcastRadioState,
    showToast,
    pickNextCandidate,
    playQueueRequestItem,
    loadAndPlayTrack,
  ]);

  handleTrackEndedRef.current = () => {
    void handleTrackEnded();
  };

  const playHistoryTrack = useCallback(
    (item: MusikweTodayHistory) => {
      if (item.track_id > 0) {
        const pool = catalogTracksRef.current.length > 0 ? catalogTracksRef.current : tracksRef.current;
        if (pool.some((t) => t.id === item.track_id)) {
          loadAndPlayTrack(item.track_id, true);
          return;
        }
      }
      activeRequestIdRef.current = null;
      activeRequestedByRef.current = '';
      setActiveRequestId(null);
      const ytId = item.youtube_id || extractYoutubeId(item.audio_url);
      const adHoc: MusikweTrack = {
        id: item.track_id > 0 ? item.track_id : hashSeedId(`hist_${item.id}_${item.title}`),
        t: item.title,
        a: item.artist,
        d: item.duration || 200,
        h: 210,
        url: ytId ? '' : item.audio_url || '',
        youtube_id: ytId || undefined,
        ly: '',
        img:
          item.cover_url ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ''),
      };
      playResolvedTrack(adHoc, true);
    },
    [loadAndPlayTrack, playResolvedTrack]
  );

  const clearTodayHistory = useCallback(async () => {
    if (!isSuperAdminRef.current) return;
    clearedTodayAtRef.current = Date.now();
    recentLocalHistoryRef.current = [];
    todayHistoryRef.current = [];
    setTodayHistory([]);

    try {
      const res = await musikweApi.postAction(
        'update.php',
        { action: 'clear_today_history' },
        authOptsRef.current
      );
      showToast(res.message || 'History pendengaran hari ini dibersihkan.');
      if (res.success) {
        await syncFromBackend('', true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal membersihkan history hari ini.');
    }
  }, [syncFromBackend, showToast]);

  const toggleAutoPlayQueue = useCallback(async () => {
    const next = !autoPlayQueueRef.current;
    setAutoPlayQueue(next);
    autoPlayQueueRef.current = next;
    showToast(`Auto-Play Antrean: ${next ? 'ON' : 'OFF'}`);
    try {
      const res = await musikweApi.toggleAutoplayQueue(next, authOptsRef.current);
      if (typeof res.auto_play_queue === 'boolean') {
        setAutoPlayQueue(res.auto_play_queue);
        autoPlayQueueRef.current = res.auto_play_queue;
      }
    } catch {
      // Keep local toggle state if network is temporarily unreachable
    }
  }, [showToast]);

  const prevTrack = useCallback(() => {
    const pool = catalogTracks.length > 0 ? catalogTracks : tracks;
    if (progress > 5 || pool.length === 0) {
      seekTo(0);
      return;
    }
    const idx = pool.findIndex((t) => t.id === currentTrackId);
    const prevIdx = (idx - 1 + pool.length) % pool.length;
    loadAndPlayTrack(pool[prevIdx].id, true);
  }, [progress, catalogTracks, tracks, currentTrackId, loadAndPlayTrack, seekTo]);

  const togglePlayPause = useCallback(() => {
    if (currentTrack.id === 0) return;
    setPlayerActivated(true);
    setMiniPlayerDismissed(false);
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    const ytId = currentTrack.youtube_id || extractYoutubeId(currentTrack.url);
    const curSec = getAccuratePlaybackSeconds();

    if (ytId) {
      ensureYoutubePlayer(ytId, nextState, curSec);
    } else if (audioRef.current && currentTrack.url) {
      if (nextState) {
        audioRef.current.play().catch(() => {
          if (!isSuperAdminRef.current) setAutoplayBlocked(true);
        });
      } else {
        audioRef.current.pause();
      }
    }

    if (isSuperAdminRef.current) {
      broadcastRadioState(currentTrack, nextState, curSec);
    }
  }, [
    isPlaying,
    currentTrack,
    ensureYoutubePlayer,
    getAccuratePlaybackSeconds,
    broadcastRadioState,
  ]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setPlayerActivated(false);
    setMiniPlayerDismissed(true);
    setAutoplayBlocked(false);
    if (audioRef.current) {
      audioRef.current.pause();
      try {
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // ignore
      }
    }
    if (isSuperAdminRef.current && currentTrackRef.current.id !== 0) {
      broadcastRadioState(currentTrackRef.current, false, 0);
    }
  }, [broadcastRadioState]);

  const purgeTrackLocally = useCallback(
    (trackId: number) => {
      if (!trackId) return;
      const curTracks = Array.isArray(tracksRef.current) ? tracksRef.current : [];
      const curCatalog = Array.isArray(catalogTracksRef.current) ? catalogTracksRef.current : [];
      const nextTracks = curTracks.filter((t) => t && t.id !== trackId);
      const nextCatalog = curCatalog.filter((t) => t && t.id !== trackId);
      const nextRequests = safeRequests.filter((r) => r && r.tid !== trackId);
      const nextHistory = safeRequestHistory.filter((h) => h && h.tid !== trackId);

      setTracks(nextTracks);
      setCatalogTracks(nextCatalog);
      setRequests(nextRequests);
      setRequestHistory(nextHistory);

      const wasCurrent = currentTrackRef.current.id === trackId;
      if (wasCurrent) {
        stopPlayback();
        setAdHocTrack((prev) => (prev && prev.id === trackId ? null : prev));
        const fallbackId = nextCatalog[0]?.id || nextTracks[0]?.id || 0;
        setCurrentTrackId(fallbackId);
        setViewTrackId((prev) => (prev === trackId ? fallbackId : prev));
        if (isSuperAdminRef.current) {
          broadcastRadioState(
            {
              id: 0,
              t: '',
              a: '',
              d: 200,
              h: 210,
              url: '',
              ly: '',
              img: '',
            },
            false,
            0
          );
        }
      }

      const existingSnap = readPersistedSnapshot();
      writePersistedSnapshot({
        ...existingSnap,
        tracks: nextTracks,
        catalogTracks: nextCatalog,
        requests: nextRequests,
        requestHistory: nextHistory,
        currentTrackId: wasCurrent
          ? nextCatalog[0]?.id || nextTracks[0]?.id || 0
          : existingSnap.currentTrackId,
        currentTrack: wasCurrent ? null : existingSnap.currentTrack,
        adHocTrack:
          existingSnap.adHocTrack?.id === trackId ? null : existingSnap.adHocTrack,
        playerActivated: wasCurrent ? false : existingSnap.playerActivated,
        savedAt: Date.now(),
      });
    },
    [safeRequests, safeRequestHistory, stopPlayback, broadcastRadioState]
  );

  const dismissMiniPlayer = useCallback(() => {
    setMiniPlayerDismissed(true);
    if (isSuperAdminRef.current) {
      stopPlayback();
      return;
    }
    // For listeners: mute/pause local audio cleanly without erasing remote radioState
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // ignore
      }
    }
  }, [stopPlayback]);

  const joinLiveAudio = useCallback(() => {
    hasUserInteractedRef.current = true;
    setAutoplayBlocked(false);
    setIsMuted(false);
    isMutedRef.current = false;
    setMiniPlayerDismissed(false);
    setPlayerActivated(true);

    const live = radioStateRef.current;
    const seekSec = live ? live.position_sec : progressRef.current;
    const shouldPlay = live ? live.is_playing : true;
    const tr = currentTrackRef.current;
    const ytId = tr.youtube_id || extractYoutubeId(tr.url);

    if (ytId) {
      if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volumeRef.current);
          const cur = ytPlayerRef.current.getCurrentTime?.() ?? 0;
          if (Math.abs(cur - seekSec) > 2.5) {
            ytPlayerRef.current.seekTo(seekSec, true);
          }
          if (shouldPlay) {
            ytPlayerRef.current.playVideo();
          }
        } catch {
          // ignore
        }
      } else {
        ensureYoutubePlayer(ytId, shouldPlay, seekSec);
      }
    } else if (audioRef.current && tr.url) {
      audioRef.current.muted = false;
      audioRef.current.volume = volumeRef.current / 100;
      try {
        if (Math.abs(audioRef.current.currentTime - seekSec) > 2.5) {
          audioRef.current.currentTime = seekSec;
        }
      } catch {
        // ignore
      }
      if (shouldPlay) {
        audioRef.current.play().catch(() => {
          setAutoplayBlocked(true);
        });
      }
    }

    setProgress(seekSec);
    if (shouldPlay) {
      setIsPlaying(true);
    }
    showToast('Terhubung ke siaran live .MUSIKWE');
  }, [ensureYoutubePlayer, showToast]);

  joinLiveAudioRef.current = joinLiveAudio;

  const toggleMute = useCallback(() => {
    hasUserInteractedRef.current = true;
    const nextMuted = !isMutedRef.current;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (!nextMuted && (autoplayBlocked || (radioStateRef.current?.is_playing && !isPlayingRef.current))) {
      joinLiveAudio();
      return;
    }

    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        if (nextMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volumeRef.current);
        }
      } catch {
        // ignore
      }
    }
  }, [autoplayBlocked, joinLiveAudio]);

  // Admin 5s heartbeat to keep radio-state.php position_sec fresh while broadcasting
  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin || !isPlaying || currentTrack.id === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      broadcastRadioState(currentTrackRef.current, true, getAccuratePlaybackSeconds());
    }, 5000);
    return () => window.clearInterval(timer);
  }, [
    isAuthenticated,
    isSuperAdmin,
    isPlaying,
    currentTrack.id,
    broadcastRadioState,
    getAccuratePlaybackSeconds,
  ]);

  // Fetch initial auto_play_queue state from radio-state.php for Admin on login/mount
  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    let cancelled = false;
    musikweApi
      .getRadioState(authOptsRef.current)
      .then((remote) => {
        if (!cancelled && remote && typeof remote.auto_play_queue === 'boolean') {
          setAutoPlayQueue(remote.auto_play_queue);
          autoPlayQueueRef.current = remote.auto_play_queue;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSuperAdmin]);

  // Listener live polling every 2 seconds (2000ms) against GET .../radio-state.php?t=...
  const radioPollInFlightRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isAuthenticated || isSuperAdmin) {
      if (isSuperAdmin) {
        setRadioState(null);
        setAutoplayBlocked(false);
      }
      return;
    }

    let cancelled = false;

    const pollRadio = async () => {
      if (cancelled || radioPollInFlightRef.current) return;
      if (!getStoredToken()) return;
      radioPollInFlightRef.current = true;

      try {
        const remote = await musikweApi.getRadioState(authOptsRef.current);
        if (cancelled) return;

        if (remote && typeof remote.auto_play_queue === 'boolean') {
          setAutoPlayQueue(remote.auto_play_queue);
          autoPlayQueueRef.current = remote.auto_play_queue;
        }

        const remoteTitle = String(remote?.title || '').trim();
        const remoteArtist = String(remote?.artist || '').trim();
        if (!remote || !remoteTitle) {
          setRadioState(null);
          radioStateRef.current = null;
          return;
        }

        const prevRemote = radioStateRef.current;
        setRadioState(remote);
        radioStateRef.current = remote;

        const remoteChangedSong =
          Boolean(prevRemote) &&
          (remote.youtube_id !== prevRemote?.youtube_id ||
            remote.audio_url !== prevRemote?.audio_url ||
            remoteTitle.toLowerCase() !== String(prevRemote?.title || '').trim().toLowerCase());

        if (remoteChangedSong && remote.is_playing && miniPlayerDismissedRef.current) {
          setMiniPlayerDismissed(false);
          miniPlayerDismissedRef.current = false;
        }

        const cur = currentTrackRef.current;
        const incomingYt = remote.youtube_id || extractYoutubeId(remote.audio_url);
        const currentYt = cur.youtube_id || extractYoutubeId(cur.url);

        const trackChanged =
          cur.id === 0 ||
          (Boolean(incomingYt) && incomingYt !== currentYt) ||
          (!incomingYt &&
            (remote.audio_url !== (cur.url || '') ||
              remoteTitle.toLowerCase() !== String(cur.t || '').trim().toLowerCase()));

        const shouldPlay = remote.is_playing && !miniPlayerDismissedRef.current;

        if (trackChanged) {
          const curCatalog = Array.isArray(catalogTracksRef.current) ? catalogTracksRef.current : [];
          const curTracks = Array.isArray(tracksRef.current) ? tracksRef.current : [];
          const pool = curCatalog.length > 0 ? curCatalog : curTracks;
          const matchedLocal = pool.find(
            (t) =>
              (remote.track_id > 0 && t.id === remote.track_id) ||
              (Boolean(incomingYt) && t.youtube_id === incomingYt) ||
              (String(t.t || '').trim().toLowerCase() === remoteTitle.toLowerCase() &&
                String(t.a || '').trim().toLowerCase() === remoteArtist.toLowerCase())
          );

          const stableId =
            matchedLocal?.id ||
            hashSeedId(
              `${remote.track_id || 0}|${incomingYt || remote.audio_url || remote.title}|${remote.artist}`
            );

          const targetTrack: MusikweTrack = {
            id: stableId,
            t: remote.title,
            a: remote.artist || 'Admin .MUSIKWE',
            album_name: matchedLocal?.album_name || '',
            d: remote.duration || matchedLocal?.d || 200,
            h: matchedLocal?.h || 210,
            url: incomingYt ? '' : remote.audio_url || matchedLocal?.url || '',
            youtube_id: incomingYt || matchedLocal?.youtube_id || undefined,
            ly: matchedLocal?.ly || '',
            img:
              remote.cover_url ||
              matchedLocal?.img ||
              (incomingYt ? `https://i.ytimg.com/vi/${incomingYt}/hqdefault.jpg` : ''),
          };

          if (shouldPlay && !hasUserInteractedRef.current) {
            setAutoplayBlocked(true);
          }

          applyTrackToPlayer(targetTrack, shouldPlay, remote.position_sec, {
            broadcast: false,
            unDismiss: false,
          });
          return;
        }

        // Sync is_playing status
        if (shouldPlay && !isPlayingRef.current) {
          setIsPlaying(true);
          setPlayerActivated(true);
          if (!hasUserInteractedRef.current) {
            setAutoplayBlocked(true);
          }
          const ytId = cur.youtube_id || extractYoutubeId(cur.url);
          if (ytId) {
            ensureYoutubePlayer(ytId, true, remote.position_sec);
          } else if (audioRef.current && cur.url) {
            audioRef.current.muted = isMutedRef.current;
            audioRef.current.play().catch(() => {
              setAutoplayBlocked(true);
            });
          }
        } else if (shouldPlay && isPlayingRef.current) {
          // Ensure browser didn't silently stay paused while shouldPlay is true
          const ytId = cur.youtube_id || extractYoutubeId(cur.url);
          if (ytId && ytPlayerRef.current && ytReadyRef.current) {
            try {
              const ytState = ytPlayerRef.current.getPlayerState?.();
              const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
              const bufferingState = window.YT?.PlayerState?.BUFFERING ?? 3;
              if (ytState !== playingState && ytState !== bufferingState) {
                if (hasUserInteractedRef.current) {
                  ytPlayerRef.current.playVideo();
                } else {
                  setAutoplayBlocked(true);
                }
              }
            } catch {
              // ignore
            }
          } else if (audioRef.current && cur.url && audioRef.current.paused) {
            audioRef.current.play().catch(() => {
              setAutoplayBlocked(true);
            });
          }
        } else if (!shouldPlay && isPlayingRef.current) {
          setIsPlaying(false);
          setAutoplayBlocked(false);
          const ytId = cur.youtube_id || extractYoutubeId(cur.url);
          if (ytId && ytPlayerRef.current && ytReadyRef.current) {
            try {
              ytPlayerRef.current.pauseVideo();
            } catch {
              // ignore
            }
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
        }

        // Sync playback position if drift exceeds 2.5 seconds
        const localPos = getAccuratePlaybackSeconds();
        if (Math.abs(localPos - remote.position_sec) > 2.5) {
          seekInternal(remote.position_sec, false);
        }
      } catch {
        // Ignore transient polling failures
      } finally {
        radioPollInFlightRef.current = false;
      }
    };

    pollRadio();
    const timer = window.setInterval(pollRadio, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    isAuthenticated,
    isSuperAdmin,
    applyTrackToPlayer,
    ensureYoutubePlayer,
    getAccuratePlaybackSeconds,
    seekInternal,
  ]);

  const toggleLike = useCallback(
    (id: number) => {
      if (!id) return;
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          showToast('Suka dibatalkan');
        } else {
          next.add(id);
          showToast('Disukai');
        }
        return next;
      });
    },
    [showToast]
  );

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(volume);
      } catch {
        // ignore
      }
    }
  }, [volume]);

  // Audio ended listener
  useEffect(() => {
    const aud = audioRef.current;
    const onEnded = () => {
      handleTrackEndedRef.current();
    };
    aud?.addEventListener('ended', onEnded);
    return () => {
      aud?.removeEventListener('ended', onEnded);
    };
  }, []);

  // Playback progress ticker
  useEffect(() => {
    if (!isPlaying || currentTrack.id === 0) return;
    const timer = window.setInterval(() => {
      const ytId = currentTrack.youtube_id || extractYoutubeId(currentTrack.url);
      let nextPos: number | null = null;
      let effectiveDur = currentTrack.d || 200;

      if (ytId && ytPlayerRef.current && ytReadyRef.current) {
        try {
          const ytTime = ytPlayerRef.current.getCurrentTime?.();
          if (typeof ytTime === 'number' && !Number.isNaN(ytTime)) {
            nextPos = ytTime;
          }
          const ytDur = ytPlayerRef.current.getDuration?.();
          if (typeof ytDur === 'number' && Number.isFinite(ytDur) && ytDur > 5) {
            effectiveDur = ytDur;
          }
        } catch {
          // fallback below
        }
      } else if (
        audioRef.current &&
        currentTrack.url &&
        !Number.isNaN(audioRef.current.currentTime)
      ) {
        nextPos = audioRef.current.currentTime;
        if (Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 5) {
          effectiveDur = audioRef.current.duration;
        }
      }

      setProgress((prev) => {
        const updated = nextPos !== null && nextPos > 0 ? nextPos : prev + 0.25;
        if (updated >= Math.max(5, effectiveDur - 1)) {
          if (isSuperAdminRef.current || !radioStateRef.current) {
            window.setTimeout(() => handleTrackEndedRef.current(), 0);
            return 0;
          }
          return effectiveDur;
        }
        return updated;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [isPlaying, currentTrack]);

  const value: MusikWeContextValue = {
    authEmail: authEmailState,
    authName: authNameState,
    isAuthenticated,
    isSuperAdmin,
    setAuthContextUser,
    displayName,
    setDisplayName,
    who,
    authOpts,

    tracks: safeTracks,
    setTracks,
    catalogTracks: safeCatalogTracks,
    setCatalogTracks,
    albums: safeAlbums,
    setAlbums,
    playlists: safePlaylists,
    setPlaylists,
    requests: safeRequests,
    setRequests,
    requestHistory: safeRequestHistory,
    setRequestHistory,
    todayHistory: safeTodayHistory,
    setTodayHistory,
    sortedRequests,
    queue: sortedRequests,
    autoNextCandidate,
    commentsMap: commentsMap && typeof commentsMap === 'object' ? commentsMap : {},
    serverUser,
    logoUrl,
    setLogoUrl,
    hasYoutubeKey,
    setHasYoutubeKey,

    currentTrackId,
    setCurrentTrackId,
    viewTrackId,
    setViewTrackId,
    adHocTrack,
    currentTrack,
    hasActiveTrack,
    playerActivated,
    isPlaying,
    progress,
    duration,
    shuffle,
    setShuffle,
    volume,
    setVolume,
    likedIds,
    toggleLike,
    miniPlayerDismissed,
    setMiniPlayerDismissed,

    radioState,
    isLiveBroadcastActive,
    isMuted,
    autoplayBlocked,
    autoPlayQueue,
    activeRequestId,
    toggleMute,
    toggleAutoPlayQueue,
    joinLiveAudio,
    dismissMiniPlayer,

    loadingCount,
    beginLoading,
    endLoading,
    toastMsg,
    toastOpen,
    showToast,
    resolvingExtKey,
    setResolvingExtKey,

    syncFromBackend,
    findTrack,
    resolveRequestTrack,
    findMatchingLocalTrack,
    playResolvedTrack,
    loadAndPlayTrack,
    playExternalItem,
    playHistoryTrack,
    clearTodayHistory,
    skipToRequest,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    stopPlayback,
    purgeTrackLocally,
  };

  return (
    <MusikWeContext.Provider value={value}>
      {/* Persistent Root-Level 1x1 YouTube Audio Engine (never unmounted on route change) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0.001,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div ref={ytContainerRef} />
      </div>
      {children}
    </MusikWeContext.Provider>
  );
};

export function useMusikWe(): MusikWeContextValue {
  const ctx = useContext(MusikWeContext);
  if (!ctx) {
    throw new Error('useMusikWe must be used inside MusikWeProvider');
  }
  return ctx;
}
