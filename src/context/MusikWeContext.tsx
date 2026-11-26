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
  MusikweRequest,
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
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
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
  logoUrl?: string;
  currentTrackId?: number;
  adHocTrack?: MusikweTrack | null;
  currentTrack?: MusikweTrack | null;
  progress?: number;
  volume?: number;
  shuffle?: boolean;
  playerActivated?: boolean;
  miniPlayerDismissed?: boolean;
  savedAt?: number;
}

function readPersistedSnapshot(): PersistedMusikweSnapshot {
  try {
    const raw = localStorage.getItem(MUSIKWE_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PersistedMusikweSnapshot;
  } catch {
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
  sortedRequests: MusikweRequest[];
  queue: MusikweRequest[];
  commentsMap: Record<string, MusikweComment[]>;
  serverUser: MusikweUser;
  logoUrl: string;
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
  findMatchingLocalTrack: (
    item: ExternalItunesItem | ExternalYoutubeItem
  ) => MusikweTrack | undefined;
  playResolvedTrack: (target: MusikweTrack, autoPlay?: boolean) => void;
  loadAndPlayTrack: (id: number, autoPlay?: boolean) => void;
  playExternalItem: (
    item: ExternalItunesItem | ExternalYoutubeItem,
    key?: string
  ) => Promise<void>;
  togglePlayPause: () => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => void;
  seekTo: (sec: number) => void;
  stopPlayback: () => void;
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

  const findTrack = useCallback(
    (id?: number | null): MusikweTrack => {
      if (adHocTrack && id === adHocTrack.id) return adHocTrack;
      const hit =
        tracks.find((t) => t.id === id) || catalogTracks.find((t) => t.id === id);
      if (hit) return hit;
      if (tracks.length > 0) return tracks[0];
      if (catalogTracks.length > 0) return catalogTracks[0];
      return adHocTrack || fallbackTrack;
    },
    [adHocTrack, tracks, catalogTracks, fallbackTrack]
  );

  const currentTrack = useMemo(
    () => (adHocTrack && currentTrackId === adHocTrack.id ? adHocTrack : findTrack(currentTrackId)),
    [adHocTrack, findTrack, currentTrackId]
  );

  const hasActiveTrack = Boolean(currentTrack && currentTrack.id !== 0);
  const duration = currentTrack.d || 200;

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => b.v.length - a.v.length || a.ts - b.ts);
  }, [requests]);

  // Refs for audio & YouTube engine (persisted at root level across all route switches)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const activeYtIdRef = useRef<string>('');
  const pendingYtPlayRef = useRef<{ videoId: string; shouldPlay: boolean } | null>(null);

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
        const d = res.data;
        setServerUser(d.user);

        // Never wipe track catalog to empty if API temporarily returns empty while cache exists
        if (d.tracks.length > 0) {
          setTracks(d.tracks);
          if (!q.trim()) {
            setCatalogTracks((prev) => {
              const byId = new Map(d.tracks.map((t) => [t.id, t]));
              // Preserve any newly saved items if not yet visible in read
              prev.forEach((t) => {
                if (t.id > 0 && !byId.has(t.id)) {
                  // Only keep if read returned fewer than prev? Wait: trust DB when non-empty
                }
              });
              return d.tracks;
            });
          } else {
            setCatalogTracks((prev) => {
              const byId = new Map(prev.map((t) => [t.id, t]));
              d.tracks.forEach((t) => byId.set(t.id, t));
              return Array.from(byId.values());
            });
          }
        }

        if (d.albums.length > 0) {
          setAlbums(d.albums);
        }
        if (d.playlists.length > 0) {
          setPlaylists(d.playlists);
        }

        // Preserve queue if temporarily failed, otherwise sync latest requests
        setRequests((prev) => (Array.isArray(d.requests) ? d.requests : prev));
        setCommentsMap((prev) =>
          d.comments && Object.keys(d.comments).length > 0 ? d.comments : prev
        );

        if (d.logo_url) setLogoUrl(d.logo_url);
        if (typeof d.has_youtube_key === 'boolean') {
          setHasYoutubeKey((prev) => prev || Boolean(d.has_youtube_key));
        }
        if (!displayName.trim() && d.user.name && d.user.name !== 'Tamu') {
          setDisplayName(d.user.name);
        }
        if (!q.trim() && d.tracks.length > 0) {
          setCurrentTrackId((prev) => {
            if (prev < 0) return prev;
            if (prev > 0 && d.tracks.some((x) => x.id === prev)) return prev;
            return d.tracks[0].id;
          });
          setViewTrackId((prev) => {
            if (prev < 0) return prev;
            if (prev > 0 && d.tracks.some((x) => x.id === prev)) return prev;
            return d.tracks[0].id;
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

  // Sync from backend whenever app loads or user logs in / email changes
  useEffect(() => {
    if (!isAuthenticated) {
      // Stop playback when logged out, keep catalog snapshot in localStorage
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
      logoUrl,
      currentTrackId,
      adHocTrack,
      currentTrack: hasActiveTrack ? currentTrack : null,
      progress,
      volume,
      shuffle,
      playerActivated,
      miniPlayerDismissed,
      savedAt: Date.now(),
    });
  }, [
    tracks,
    catalogTracks,
    albums,
    playlists,
    requests,
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
  ]);

  // Initialize persistent HTML5 Audio element once at root level
  useEffect(() => {
    const aud = new Audio();
    aud.preload = 'none';
    aud.volume = volume / 100;
    audioRef.current = aud;
    return () => {
      aud.pause();
      aud.removeAttribute('src');
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextTrackRef = useRef<() => Promise<void>>(async () => {});

  const ensureYoutubePlayer = useCallback(
    (videoId: string, shouldPlay: boolean) => {
      pendingYtPlayRef.current = { videoId, shouldPlay };

      const mountPlayer = () => {
        if (!window.YT?.Player || !ytContainerRef.current) return;
        if (ytPlayerRef.current && ytReadyRef.current) {
          if (activeYtIdRef.current !== videoId) {
            activeYtIdRef.current = videoId;
            ytPlayerRef.current.loadVideoById(videoId);
            if (!shouldPlay) {
              ytPlayerRef.current.pauseVideo();
            }
          } else if (shouldPlay) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
          ytPlayerRef.current.setVolume(volume);
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
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev: any) => {
              ytReadyRef.current = true;
              ev.target.setVolume(volume);
              const pending = pendingYtPlayRef.current;
              if (pending) {
                if (pending.videoId !== activeYtIdRef.current) {
                  activeYtIdRef.current = pending.videoId;
                  ev.target.loadVideoById(pending.videoId);
                }
                if (pending.shouldPlay) {
                  ev.target.playVideo();
                } else {
                  ev.target.pauseVideo();
                }
              } else if (shouldPlay) {
                ev.target.playVideo();
              }
            },
            onStateChange: (ev: any) => {
              const endedState = window.YT?.PlayerState?.ENDED ?? 0;
              const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
              if (ev.data === playingState) {
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
                nextTrackRef.current();
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
    [volume]
  );

  // Clean up YT player only when entire app root unmounts
  useEffect(() => {
    return () => {
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
    };
  }, []);

  const playResolvedTrack = useCallback(
    (target: MusikweTrack, autoPlay: boolean = true) => {
      if (!target || target.id === 0) return;

      setPlayerActivated(true);
      setMiniPlayerDismissed(false);
      if (target.id < 0) {
        setAdHocTrack(target);
      } else {
        setAdHocTrack(null);
      }

      setCurrentTrackId(target.id);
      setViewTrackId(target.id);
      setProgress(0);
      setIsPlaying(autoPlay);

      const aud = audioRef.current;
      const ytId = target.youtube_id || extractYoutubeId(target.url);

      if (ytId) {
        if (aud) {
          aud.pause();
          aud.removeAttribute('src');
        }
        ensureYoutubePlayer(ytId, autoPlay);
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
            aud.src = target.url;
            aud.currentTime = 0;
            if (autoPlay) {
              aud.play().catch(() => {});
            }
          } else {
            aud.pause();
            aud.removeAttribute('src');
          }
        }
      }
    },
    [ensureYoutubePlayer]
  );

  const loadAndPlayTrack = useCallback(
    (id: number, autoPlay: boolean = true) => {
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
      const pool = catalogTracks.length > 0 ? catalogTracks : tracks;
      if (item.source === 'youtube') {
        const byYt = pool.find((t) => t.youtube_id === item.youtube_id);
        if (byYt) return byYt;
      }
      const normTitle = item.title.trim().toLowerCase();
      const normArtist = item.artist.trim().toLowerCase();
      return pool.find(
        (t) =>
          t.t.trim().toLowerCase() === normTitle &&
          t.a.trim().toLowerCase() === normArtist
      );
    },
    [catalogTracks, tracks]
  );

  const playExternalItem = useCallback(
    async (item: ExternalItunesItem | ExternalYoutubeItem, key?: string) => {
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
    [findMatchingLocalTrack, playResolvedTrack, authOpts, showToast]
  );

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(currentTrack.d || 200, sec));
      setProgress(clamped);
      const ytId = currentTrack.youtube_id || extractYoutubeId(currentTrack.url);
      if (ytId && ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(clamped, true);
        } catch {
          // ignore
        }
      } else if (audioRef.current && currentTrack.url) {
        audioRef.current.currentTime = clamped;
      }
    },
    [currentTrack]
  );

  const nextTrack = useCallback(async () => {
    if (sortedRequests.length > 0) {
      const topReq = sortedRequests[0];
      showToast(`Memutar request ${topReq.by}`);
      musikweApi
        .postAction('update.php', { action: 'mark_played', id: topReq.id }, authOpts)
        .catch(() => {});
      setRequests((prev) => prev.filter((x) => x.id !== topReq.id));
      loadAndPlayTrack(topReq.tid, true);
      return;
    }

    const pool = catalogTracks.length > 0 ? catalogTracks : tracks;
    if (pool.length > 0) {
      const idx = pool.findIndex((t) => t.id === currentTrackId);
      const nextIdx = shuffle
        ? Math.floor(Math.random() * pool.length)
        : (idx + 1) % pool.length;
      loadAndPlayTrack(pool[nextIdx].id, true);
      return;
    }

    setIsPlaying(false);
    setProgress(0);
  }, [
    sortedRequests,
    catalogTracks,
    tracks,
    currentTrackId,
    shuffle,
    authOpts,
    loadAndPlayTrack,
    showToast,
  ]);

  nextTrackRef.current = nextTrack;

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
    if (ytId) {
      ensureYoutubePlayer(ytId, nextState);
    } else if (audioRef.current && currentTrack.url) {
      if (nextState) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, ensureYoutubePlayer]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setPlayerActivated(false);
    setMiniPlayerDismissed(true);
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
  }, []);

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
      nextTrackRef.current();
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

      if (ytId && ytPlayerRef.current && ytReadyRef.current) {
        try {
          const ytTime = ytPlayerRef.current.getCurrentTime?.();
          if (typeof ytTime === 'number' && !Number.isNaN(ytTime)) {
            nextPos = ytTime;
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
      }

      setProgress((prev) => {
        const updated = nextPos !== null && nextPos > 0 ? nextPos : prev + 0.25;
        if (updated >= (currentTrack.d || 200)) {
          window.setTimeout(() => nextTrackRef.current(), 0);
          return 0;
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

    tracks,
    setTracks,
    catalogTracks,
    setCatalogTracks,
    albums,
    setAlbums,
    playlists,
    setPlaylists,
    requests,
    setRequests,
    sortedRequests,
    queue: sortedRequests,
    commentsMap,
    serverUser,
    logoUrl,
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
    findMatchingLocalTrack,
    playResolvedTrack,
    loadAndPlayTrack,
    playExternalItem,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    stopPlayback,
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
