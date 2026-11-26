import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Disc3,
  Heart,
  Home,
  ListMusic,
  ListPlus,
  Loader2,
  Menu,
  Mic2,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Sun,
  ThumbsUp,
  Trash2,
  Upload,
  Youtube,
  X,
} from 'lucide-react';
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
  parseSyncedLyrics,
} from '../utils/musikweApi';
import { getStoredUser } from '../utils/api';
import '../styles/musikwe.css';

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

export interface MusikweFullscreenViewProps {
  userId?: string | number;
  userEmail?: string;
  userName?: string;
  onBackToLaporanWe: () => void;
}

type MusikweNavView = 'home' | 'lib' | 'req' | 'lyr' | 'adm' | 'alb';

const fmtTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
};

const fmtAgo = (tsMs: number): string => {
  const diffMin = Math.floor((Date.now() - tsMs) / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam lalu`;
  return `${Math.floor(diffMin / 1440)} hari lalu`;
};

const CoverThumb: React.FC<{
  track: Partial<MusikweTrack>;
  sizeClass?: '' | 'big' | 'xl';
}> = ({ track, sizeClass = '' }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = !imgError && track.img ? track.img : '';

  useEffect(() => {
    setImgError(false);
  }, [track.img]);

  return (
    <div
      className={`mw-cv ${sizeClass}`}
      style={{ '--mw-h': track.h || 210 } as React.CSSProperties}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={track.t || 'Cover'}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{(track.t || 'M').trim().charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
};

export const MusikweFullscreenView: React.FC<MusikweFullscreenViewProps> = ({
  userId,
  userEmail,
  userName,
  onBackToLaporanWe,
}) => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('mw_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [loadingCount, setLoadingCount] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

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

  const [view, setView] = useState<MusikweNavView>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<MusikweTrack[]>([]);
  const [catalogTracks, setCatalogTracks] = useState<MusikweTrack[]>([]);
  const [albums, setAlbums] = useState<MusikweAlbum[]>([]);
  const [playlists, setPlaylists] = useState<MusikwePlaylist[]>([]);
  const [requests, setRequests] = useState<MusikweRequest[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, MusikweComment[]>>({});
  const [serverUser, setServerUser] = useState<MusikweUser>({
    id: Number(userId || 0),
    name: userName || 'Tamu',
    email: userEmail,
    is_admin: isAutoAdminEmail(userEmail),
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [hasYoutubeKey, setHasYoutubeKey] = useState(false);

  const [displayName, setDisplayName] = useState<string>(userName || '');

  const storedEmail = useMemo(() => {
    try {
      return getStoredUser()?.email || '';
    } catch {
      return '';
    }
  }, []);
  const activeEmail = (userEmail || storedEmail || serverUser.email || '').trim().toLowerCase();
  const isSuperAdmin = activeEmail === 'rizalsaragih498@gmail.com';
  const isAdmin = isSuperAdmin;

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number>(0);
  const [viewTrackId, setViewTrackId] = useState<number>(0);
  const [currentTrackId, setCurrentTrackId] = useState<number>(0);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);

  // Player state
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(80);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<'v' | 'k'>('v');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sub-forms state
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [commentText, setCommentText] = useState('');

  // External search state (for live search view & admin)
  const [extItunes, setExtItunes] = useState<ExternalItunesItem[]>([]);
  const [extYoutube, setExtYoutube] = useState<ExternalYoutubeItem[]>([]);
  const [extSearching, setExtSearching] = useState(false);
  const [admExtQuery, setAdmExtQuery] = useState('');
  const [adHocTrack, setAdHocTrack] = useState<MusikweTrack | null>(null);
  const [resolvingExtKey, setResolvingExtKey] = useState<string | null>(null);

  // Admin forms state
  const [ytApiKeyInput, setYtApiKeyInput] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [albumYear, setAlbumYear] = useState(String(new Date().getFullYear()));
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackAlbumId, setTrackAlbumId] = useState<string>('0');
  const [trackDuration, setTrackDuration] = useState<string>('200');
  const [trackAudioUrl, setTrackAudioUrl] = useState('');
  const [trackYoutubeInput, setTrackYoutubeInput] = useState('');
  const [trackCoverUrl, setTrackCoverUrl] = useState('');
  const [trackLyrics, setTrackLyrics] = useState('');
  const [trackAudioFile, setTrackAudioFile] = useState<File | null>(null);
  const [trackCoverFile, setTrackCoverFile] = useState<File | null>(null);

  // Refs for audio, YouTube player, synced lyric scrolling, touch gestures
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const activeYtIdRef = useRef<string>('');
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lastActiveLyricIdxRef = useRef<number>(-1);
  const touchStartYRef = useRef<number>(0);

  // Block Admin tab/view for non-super-admin accounts
  useEffect(() => {
    if (!isSuperAdmin && view === 'adm') {
      setView('home');
    }
  }, [isSuperAdmin, view]);

  const authOpts = useMemo(
    () => ({
      userEmail: userEmail || storedEmail || serverUser.email || '',
    }),
    [userEmail, storedEmail, serverUser.email]
  );

  const who = useCallback((): string => {
    return displayName.trim() || userName?.trim() || serverUser.name || 'Tamu';
  }, [displayName, userName, serverUser.name]);

  const fallbackTrack: MusikweTrack = useMemo(
    () => ({
      id: 0,
      t: 'Belum ada lagu',
      a: isAdmin ? 'Tambahkan lewat panel Admin' : 'Menunggu lagu dari Admin',
      d: 200,
      h: 210,
      url: '',
      ly: '',
      img: '',
    }),
    [isAdmin]
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
  const detailTrack = useMemo(() => {
    const id = viewTrackId || currentTrackId;
    return adHocTrack && id === adHocTrack.id ? adHocTrack : findTrack(id);
  }, [adHocTrack, findTrack, viewTrackId, currentTrackId]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => b.v.length - a.v.length || a.ts - b.ts);
  }, [requests]);

  const syncFromBackend = useCallback(
    async (q: string = '', silent: boolean = false) => {
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
        setTracks(d.tracks);
        if (!q.trim()) {
          setCatalogTracks(d.tracks);
        } else if (d.tracks.length > 0) {
          setCatalogTracks((prev) => {
            const byId = new Map(prev.map((t) => [t.id, t]));
            d.tracks.forEach((t) => byId.set(t.id, t));
            return Array.from(byId.values());
          });
        }
        setAlbums(d.albums);
        setPlaylists(d.playlists);
        setRequests(d.requests);
        setCommentsMap(d.comments);
        if (d.logo_url) setLogoUrl(d.logo_url);
        if (typeof d.has_youtube_key === 'boolean') {
          setHasYoutubeKey(d.has_youtube_key);
        }
        if (!displayName.trim() && d.user.name && d.user.name !== 'Tamu') {
          setDisplayName(d.user.name);
        }
        if (!q.trim()) {
          if (d.tracks.length > 0) {
            setCurrentTrackId((prev) => {
              if (prev < 0) return prev; // Keep active ad-hoc external playback
              return d.tracks.some((x) => x.id === prev) ? prev : d.tracks[0].id;
            });
            setViewTrackId((prev) => {
              if (prev < 0) return prev;
              return d.tracks.some((x) => x.id === prev) ? prev : d.tracks[0].id;
            });
          } else {
            setCurrentTrackId((prev) => (prev < 0 ? prev : 0));
            setViewTrackId((prev) => (prev < 0 ? prev : 0));
          }
        }
        if (d.playlists.length > 0) {
          setSelectedPlaylistId((prev) =>
            d.playlists.some((p) => p.id === prev) ? prev : d.playlists[0].id
          );
        } else {
          setSelectedPlaylistId(0);
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

  // Initial sync on mount
  useEffect(() => {
    syncFromBackend('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic background sync so shared request queue stays live across accounts
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromBackend('', true);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [syncFromBackend]);

  // Debounced live search: local memory filter + iTunes Search API only (no YouTube API on keystroke)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setExtItunes([]);
      setExtYoutube([]);
      setExtSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setExtSearching(true);
      setExtYoutube([]);
      musikweApi
        .searchItunes(trimmed)
        .then((results) => {
          if (!cancelled) {
            setExtItunes(results);
          }
        })
        .catch((err: any) => {
          if (!cancelled) {
            setExtItunes([]);
            showToast(err?.message || 'Gagal mencari lagu di iTunes.');
          }
        })
        .finally(() => {
          if (!cancelled) setExtSearching(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, showToast]);

  // Persist theme
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('mw_theme', next);
    } catch {
      // ignore
    }
  };

  // HTML5 Audio instance setup
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

  // Keep YouTube Player ready if track has youtube_id
  const ensureYoutubePlayer = useCallback(
    (videoId: string, shouldPlay: boolean) => {
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
              if (shouldPlay) {
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
                      prev && prev.youtube_id === activeYtIdRef.current && Math.abs(prev.d - ytDur) > 2
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

  // Clean up YT player on unmount
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

      if (target.id < 0) {
        setAdHocTrack(target);
      } else {
        setAdHocTrack(null);
      }

      setCurrentTrackId(target.id);
      setViewTrackId(target.id);
      setPosition(0);
      setPlaying(autoPlay);

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
              aud.play().catch(() => {
                // ignore autoplay rejection
              });
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

  const handlePlayExternalItem = useCallback(
    async (item: ExternalItunesItem | ExternalYoutubeItem, key: string) => {
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
        return;
      }

      setResolvingExtKey(key);
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
      } catch (err: any) {
        showToast(err?.message || `Gagal mencocokkan video YouTube untuk "${item.title}".`);
      } finally {
        setResolvingExtKey(null);
        setLoadingCount((c) => Math.max(0, c - 1));
      }
    },
    [findMatchingLocalTrack, playResolvedTrack, authOpts, showToast]
  );

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(currentTrack.d || 200, sec));
      setPosition(clamped);
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

    setPlaying(false);
    setPosition(0);
  }, [sortedRequests, catalogTracks, tracks, currentTrackId, shuffle, authOpts, loadAndPlayTrack, showToast]);

  const nextTrackRef = useRef(nextTrack);
  nextTrackRef.current = nextTrack;

  const prevTrack = useCallback(() => {
    const pool = catalogTracks.length > 0 ? catalogTracks : tracks;
    if (position > 5 || pool.length === 0) {
      seekTo(0);
      return;
    }
    const idx = pool.findIndex((t) => t.id === currentTrackId);
    const prevIdx = (idx - 1 + pool.length) % pool.length;
    loadAndPlayTrack(pool[prevIdx].id, true);
  }, [position, catalogTracks, tracks, currentTrackId, loadAndPlayTrack, seekTo]);

  const togglePlayPause = useCallback(() => {
    if (currentTrack.id === 0) return;
    const nextState = !playing;
    setPlaying(nextState);
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
  }, [playing, currentTrack, ensureYoutubePlayer]);

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

  // Audio ended listener + playback timer
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

  useEffect(() => {
    if (!playing || currentTrack.id === 0) return;
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
      } else if (audioRef.current && currentTrack.url && !Number.isNaN(audioRef.current.currentTime)) {
        nextPos = audioRef.current.currentTime;
      }

      setPosition((prev) => {
        const updated = nextPos !== null && nextPos > 0 ? nextPos : prev + 0.25;
        if (updated >= (currentTrack.d || 200)) {
          window.setTimeout(() => nextTrackRef.current(), 0);
          return 0;
        }
        return updated;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [playing, currentTrack]);

  // Keyboard shortcuts (Escape closes fullscreen overlay or queue drawer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlayOpen) setOverlayOpen(false);
        else if (queueDrawerOpen) setQueueDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen, queueDrawerOpen]);

  // Synced lyrics lines & auto-scroll
  const currentLyricsLines = useMemo(
    () => parseSyncedLyrics(currentTrack.ly, currentTrack.d),
    [currentTrack.ly, currentTrack.d]
  );

  const detailLyricsLines = useMemo(
    () => parseSyncedLyrics(detailTrack.ly, detailTrack.d),
    [detailTrack.ly, detailTrack.d]
  );

  const activeCurrentLyricIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < currentLyricsLines.length; i += 1) {
      if (currentLyricsLines[i].time <= position) idx = i;
    }
    return idx;
  }, [currentLyricsLines, position]);

  const activeDetailLyricIdx = useMemo(() => {
    if (detailTrack.id !== currentTrack.id) return -1;
    let idx = -1;
    for (let i = 0; i < detailLyricsLines.length; i += 1) {
      if (detailLyricsLines[i].time <= position) idx = i;
    }
    return idx;
  }, [detailTrack.id, currentTrack.id, detailLyricsLines, position]);

  useEffect(() => {
    if (view !== 'lyr' || detailTrack.id !== currentTrack.id) return;
    const container = lyricsContainerRef.current;
    if (!container || activeDetailLyricIdx < 0) return;
    if (lastActiveLyricIdxRef.current === activeDetailLyricIdx) return;
    lastActiveLyricIdxRef.current = activeDetailLyricIdx;
    const el = container.children[activeDetailLyricIdx] as HTMLElement | undefined;
    if (el) {
      container.scrollTo({
        top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [view, detailTrack.id, currentTrack.id, activeDetailLyricIdx]);

  // Actions
  const runMutation = async (fn: () => Promise<void>) => {
    setLoadingCount((c) => c + 1);
    try {
      await fn();
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  };

  const handleRequestTrack = async (track: MusikweTrack) => {
    if (!track || track.id === 0) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'request_track',
          track_id: track.id > 0 ? track.id : 0,
          title: track.t,
          artist: track.a,
          cover_url: track.img || '',
          duration: track.d || 200,
          youtube_id: track.youtube_id || '',
          audio_url: track.url || '',
          requested_by: who(),
        },
        authOpts
      );
      showToast(res.message || 'Lagu ditambahkan ke antrean request.');
      if (res.success) {
        console.log('[SONG REQUEST CREATED]', {
          title: track.t,
          artist: track.a,
          youtube_id: track.youtube_id || '',
          requested_by: who(),
          response: res,
        });
        await syncFromBackend('');
      }
    });
  };

  const handleRequestExternalItem = async (
    item: ExternalItunesItem | ExternalYoutubeItem,
    key: string
  ) => {
    if (item.source === 'itunes') {
      console.log('[iTUNES SELECT]', {
        action: 'request',
        title: item.title,
        artist: item.artist,
        cover_url: item.cover_url,
        duration: item.duration_sec,
      });
    }

    setResolvingExtKey(key);
    try {
      await runMutation(async () => {
        const existing = findMatchingLocalTrack(item);
        let ytId = item.source === 'youtube' ? item.youtube_id : existing?.youtube_id || '';
        const durationSec = item.duration_sec || existing?.d || 200;

        if (!ytId && item.source === 'itunes') {
          const ytMatch = await musikweApi.searchYoutubeBestMatch(
            item.title,
            item.artist,
            authOpts
          );
          ytId = ytMatch.youtube_id;
        }

        if (!ytId) {
          throw new Error(`Video YouTube tidak ditemukan untuk "${item.title}".`);
        }

        const coverUrl =
          item.cover_url || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        const payload: Record<string, any> = {
          action: 'request_track',
          ...(existing?.id ? { track_id: existing.id } : {}),
          title: item.title,
          artist: item.artist,
          cover_url: coverUrl,
          duration: durationSec,
          youtube_id: ytId,
          requested_by: who(),
        };

        const res = await musikweApi.postAction('create.php', payload, authOpts);
        if (!res.success) {
          throw new Error(res.message || 'Gagal menyimpan request ke database.');
        }

        console.log('[SONG REQUEST CREATED]', {
          title: item.title,
          artist: item.artist,
          cover_url: coverUrl,
          duration: durationSec,
          youtube_id: ytId,
          requested_by: who(),
          response: res,
        });
        showToast(res.message || `"${item.title}" masuk ke antrean bersama!`);
        await syncFromBackend('');
      });
    } finally {
      setResolvingExtKey(null);
    }
  };

  const handleToggleVote = async (requestId: number) => {
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'update.php',
        { action: 'toggle_vote', id: requestId, voter: who() },
        authOpts
      );
      showToast(res.message || 'Suara diperbarui.');
      if (res.success) await syncFromBackend(searchQuery);
    });
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!isSuperAdmin) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'delete_request', id: requestId },
        authOpts
      );
      showToast(res.message || 'Request dihapus.');
      if (res.success) await syncFromBackend(searchQuery);
    });
  };

  const handleAddToPlaylist = async (trackId: number) => {
    const targetPl = playlists.find((p) => p.id === selectedPlaylistId) || playlists[0];
    if (!targetPl) {
      showToast('Buat playlist dulu di menu Playlist.');
      setView('lib');
      return;
    }
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'update.php',
        {
          action: 'playlist_toggle_track',
          playlist_id: targetPl.id,
          track_id: trackId,
          mode: 'add',
        },
        authOpts
      );
      showToast(res.message || `Ditambahkan ke ${targetPl.n}`);
      if (res.success) await syncFromBackend(searchQuery);
    });
  };

  const handleRemoveFromPlaylist = async (playlistId: number, trackId: number) => {
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'update.php',
        {
          action: 'playlist_toggle_track',
          playlist_id: playlistId,
          track_id: trackId,
          mode: 'remove',
        },
        authOpts
      );
      showToast(res.message || 'Dihapus dari playlist.');
      if (res.success) await syncFromBackend(searchQuery);
    });
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'create.php',
        { action: 'create_playlist', name },
        authOpts
      );
      showToast(res.message || 'Playlist dibuat.');
      if (res.success) {
        setNewPlaylistName('');
        if (res.data?.id) setSelectedPlaylistId(Number(res.data.id));
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handleDeletePlaylist = async (playlistId: number) => {
    const confirmKey = `pl_${playlistId}`;
    if (confirmDeleteId !== confirmKey) {
      setConfirmDeleteId(confirmKey);
      return;
    }
    setConfirmDeleteId(null);
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'delete_playlist', id: playlistId },
        authOpts
      );
      showToast(res.message || 'Playlist dihapus.');
      if (res.success) {
        setSelectedPlaylistId(0);
        setView('lib');
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handlePlayAllPlaylist = async (pl: MusikwePlaylist) => {
    if (!pl.ids.length) {
      showToast('Playlist masih kosong.');
      return;
    }
    await runMutation(async () => {
      for (const tid of pl.ids.slice(1)) {
        await musikweApi
          .postAction(
            'create.php',
            { action: 'request_track', track_id: tid, requested_by: `Playlist ${pl.n}` },
            authOpts
          )
          .catch(() => {});
      }
      await syncFromBackend(searchQuery);
      loadAndPlayTrack(pl.ids[0], true);
      showToast(`Memutar playlist ${pl.n}`);
    });
  };

  const handleRequestAllPlaylist = async (pl: MusikwePlaylist) => {
    if (!pl.ids.length) return;
    await runMutation(async () => {
      for (const tid of pl.ids) {
        await musikweApi
          .postAction(
            'create.php',
            { action: 'request_track', track_id: tid, requested_by: who() },
            authOpts
          )
          .catch(() => {});
      }
      await syncFromBackend(searchQuery);
      showToast(`Semua lagu dari ${pl.n} ditambahkan ke antrean.`);
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const tx = commentText.trim();
    if (!tx || !detailTrack.id) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'add_comment',
          track_id: detailTrack.id,
          author: who(),
          comment: tx,
        },
        authOpts
      );
      showToast(res.message || 'Komentar terkirim.');
      if (res.success) {
        setCommentText('');
        await syncFromBackend(searchQuery);
      }
    });
  };

  // Admin Handlers (Super Admin Exclusive)
  const handleSaveYoutubeKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const key = ytApiKeyInput.trim();
    if (!key) {
      showToast('Masukkan YouTube Data API v3 Key terlebih dahulu.');
      return;
    }
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'save_youtube_key',
          youtube_api_key: key,
          api_key: key,
        },
        authOpts
      );
      showToast(res.message || 'YouTube API Key disimpan.');
      if (res.success) {
        setHasYoutubeKey(true);
        setYtApiKeyInput('');
      }
    });
  };

  const handleAdminExternalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const q = admExtQuery.trim();
    if (!q) return;
    setExtSearching(true);
    try {
      const res = await musikweApi.searchExternal(q, authOpts);
      setExtItunes(res.itunes);
      setExtYoutube(res.youtube);
      if (res.has_youtube_key) setHasYoutubeKey(true);
      if (!res.itunes.length && !res.youtube.length) {
        showToast('Tidak ditemukan hasil di iTunes maupun YouTube.');
      }
    } finally {
      setExtSearching(false);
    }
  };

  const applyExternalResultToForm = (item: ExternalItunesItem | ExternalYoutubeItem) => {
    if (!isSuperAdmin) return;
    setEditingTrackId(null);
    setTrackTitle(item.title);
    setTrackArtist(item.artist);
    setTrackDuration(String(item.duration_sec || 200));
    setTrackCoverUrl(item.cover_url || '');
    if (item.source === 'youtube') {
      setTrackYoutubeInput(item.youtube_id);
      setTrackAudioUrl('');
    } else {
      setTrackAudioUrl(item.preview_url || '');
      setTrackYoutubeInput('');
    }
    showToast(`Data "${item.title}" disalin ke form lagu.`);
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!albumTitle.trim() || !albumArtist.trim()) return;
    await runMutation(async () => {
      let coverUrl = '';
      if (albumCoverFile) {
        showToast('Mengunggah cover album...');
        const up = await musikweApi.uploadFile(albumCoverFile, authOpts);
        if (!up.success || !up.url) {
          showToast(up.message || 'Gagal mengunggah cover album.');
          return;
        }
        coverUrl = up.url;
      }
      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'create_album',
          title: albumTitle.trim(),
          artist: albumArtist.trim(),
          release_year: albumYear.trim() || String(new Date().getFullYear()),
          cover_url: coverUrl,
        },
        authOpts
      );
      showToast(res.message || 'Album berhasil dibuat.');
      if (res.success) {
        setAlbumTitle('');
        setAlbumArtist('');
        setAlbumCoverFile(null);
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handleUpdateLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!logoFile) {
      showToast('Pilih file logo terlebih dahulu.');
      return;
    }
    await runMutation(async () => {
      showToast('Mengunggah logo .MUSIKWE...');
      const up = await musikweApi.uploadFile(logoFile, authOpts);
      if (!up.success || !up.url) {
        showToast(up.message || 'Gagal upload logo.');
        return;
      }
      const res = await musikweApi.postAction(
        'update.php',
        { action: 'update_logo', logo_url: up.url },
        authOpts
      );
      showToast(res.message || 'Logo diperbarui.');
      if (res.success) {
        setLogoFile(null);
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!trackTitle.trim() || !trackArtist.trim()) return;
    await runMutation(async () => {
      let finalAudioUrl = trackAudioUrl.trim();
      let finalCoverUrl = trackCoverUrl.trim();
      const ytId =
        extractYoutubeId(trackYoutubeInput) || extractYoutubeId(finalAudioUrl);

      if (trackAudioFile) {
        showToast('Mengunggah file audio...');
        const upAudio = await musikweApi.uploadFile(trackAudioFile, authOpts);
        if (!upAudio.success || !upAudio.url) {
          showToast(upAudio.message || 'Gagal mengunggah file audio.');
          return;
        }
        finalAudioUrl = upAudio.url;
      }

      if (trackCoverFile) {
        showToast('Mengunggah cover lagu...');
        const upCover = await musikweApi.uploadFile(trackCoverFile, authOpts);
        if (upCover.success && upCover.url) {
          finalCoverUrl = upCover.url;
        }
      }

      if (!finalCoverUrl && ytId) {
        finalCoverUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      }

      const alObj = albums.find((al) => String(al.id) === String(trackAlbumId));
      const payload: Record<string, any> = {
        action: editingTrackId ? 'update_track' : 'create_track',
        title: trackTitle.trim(),
        artist: trackArtist.trim(),
        album_id: Number(trackAlbumId || 0),
        album_name: alObj ? alObj.title : '',
        duration: Math.max(15, Number(trackDuration) || 200),
        audio_url: ytId ? '' : finalAudioUrl,
        youtube_id: ytId || '',
        cover_url: finalCoverUrl,
        lyrics: trackLyrics,
      };
      if (editingTrackId) {
        payload.id = editingTrackId;
      }

      const endpoint = editingTrackId ? 'update.php' : 'create.php';
      const res = await musikweApi.postAction(endpoint, payload, authOpts);
      showToast(res.message || (editingTrackId ? 'Lagu diperbarui.' : 'Lagu disimpan.'));
      if (res.success) {
        setEditingTrackId(null);
        setTrackTitle('');
        setTrackArtist('');
        setTrackAlbumId('0');
        setTrackDuration('200');
        setTrackAudioUrl('');
        setTrackYoutubeInput('');
        setTrackCoverUrl('');
        setTrackLyrics('');
        setTrackAudioFile(null);
        setTrackCoverFile(null);
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handleEditTrackFill = (t: MusikweTrack) => {
    if (!isSuperAdmin) return;
    setEditingTrackId(t.id);
    setTrackTitle(t.t);
    setTrackArtist(t.a);
    setTrackAlbumId(String(t.album_id || 0));
    setTrackDuration(String(t.d || 200));
    setTrackAudioUrl(t.url || '');
    setTrackYoutubeInput(t.youtube_id || '');
    setTrackCoverUrl(t.img || '');
    setTrackLyrics(t.ly || '');
    setTrackAudioFile(null);
    setTrackCoverFile(null);
    showToast(`Mengedit "${t.t}".`);
  };

  const handleDeleteTrack = async (trackId: number) => {
    if (!isSuperAdmin) return;
    const confirmKey = `tr_${trackId}`;
    if (confirmDeleteId !== confirmKey) {
      setConfirmDeleteId(confirmKey);
      return;
    }
    setConfirmDeleteId(null);
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'delete_track', id: trackId },
        authOpts
      );
      showToast(res.message || 'Lagu dihapus dari database.');
      if (res.success) {
        setCatalogTracks((prev) => prev.filter((t) => t.id !== trackId));
        await syncFromBackend(searchQuery);
      }
    });
  };

  const localSearchTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = catalogTracks.length > 0 ? catalogTracks : tracks;
    if (!q) return source;
    return source.filter(
      (t) =>
        t.t.toLowerCase().includes(q) ||
        t.a.toLowerCase().includes(q) ||
        (t.album_name || '').toLowerCase().includes(q) ||
        (t.ly || '').toLowerCase().includes(q)
    );
  }, [searchQuery, catalogTracks, tracks]);

  const hotTracks = useMemo(() => {
    return [...tracks].sort(
      (a, b) =>
        requests.filter((r) => r.tid === b.id).length -
        requests.filter((r) => r.tid === a.id).length
    );
  }, [tracks, requests]);

  const autoNextTracks = useMemo(() => {
    const source = catalogTracks.length > 0 ? catalogTracks : tracks;
    return source
      .filter((t) => t.id !== currentTrack.id && !requests.some((r) => r.tid === t.id))
      .slice(0, 4);
  }, [catalogTracks, tracks, currentTrack.id, requests]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId]
  );

  const renderTrackRow = (t: MusikweTrack, extraAction?: React.ReactNode) => {
    const isCurrent = currentTrack.id === t.id && t.id > 0;
    const ytId = t.youtube_id || extractYoutubeId(t.url);
    return (
      <div
        key={t.id}
        className={`mw-row ${isCurrent ? 'on' : ''} ${isCurrent && playing ? 'pl' : ''}`}
        onClick={() => loadAndPlayTrack(t.id, true)}
      >
        <CoverThumb track={t} />
        <div className="mw-i">
          <div className="mw-tt">
            {isCurrent && playing && (
              <span className="mw-eq" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            {t.t}
          </div>
          <div className="mw-mu mw-small mw-num">
            {t.a}
            {t.album_name ? ` · ${t.album_name}` : ''}
            {ytId ? ' · YouTube' : ''} · {fmtTime(t.d)}
          </div>
        </div>
        <div className="mw-ac" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="mw-ib"
            title="Putar"
            aria-label="Putar"
            onClick={() => loadAndPlayTrack(t.id, true)}
          >
            <Play size={16} />
          </button>
          <button
            type="button"
            className="mw-ib"
            title="Request lagu"
            aria-label="Request"
            onClick={() => handleRequestTrack(t)}
          >
            <Heart size={16} />
          </button>
          <button
            type="button"
            className="mw-ib"
            title="Tambah ke playlist aktif"
            aria-label="Tambah ke playlist"
            onClick={() => handleAddToPlaylist(t.id)}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="mw-ib"
            title="Lirik & komentar"
            aria-label="Lirik dan komentar"
            onClick={() => {
              setViewTrackId(t.id);
              setView('lyr');
              setSearchQuery('');
            }}
          >
            <Mic2 size={16} />
          </button>
          {extraAction}
        </div>
      </div>
    );
  };

  const progressPct = Math.min(100, (position / (currentTrack.d || 200)) * 100);
  const effectiveView = searchQuery.trim() ? 'search' : view;
  const activeLyricText =
    activeCurrentLyricIdx >= 0 && currentLyricsLines[activeCurrentLyricIdx]
      ? currentLyricsLines[activeCurrentLyricIdx].text
      : currentTrack.ly
      ? '♪'
      : 'Lirik belum tersedia';

  return (
    <div className="musikwe-shell" data-theme={theme}>
      {/* Hidden 1x1 YouTube Audio Engine */}
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

      {/* Top Indeterminate Loading Bar */}
      <div className={`mw-ldr-bar ${loadingCount > 0 ? 'on' : ''}`} />

      <div className="mw-app">
        {/* LEFT NAVIGATION SIDEBAR */}
        <aside className="mw-side">
          <button
            type="button"
            className="mw-logo-btn"
            onClick={() => {
              setView('home');
              setSearchQuery('');
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=".MUSIKWE"
                className="mw-logo-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="mw-brand-mark">
                <Disc3 size={22} className="mw-brand-dot" />
                <span>
                  <span className="mw-brand-dot">.</span>MUSIKWE
                </span>
              </span>
            )}
          </button>

          <button
            type="button"
            className={`mw-nav ${effectiveView === 'home' ? 'on' : ''}`}
            onClick={() => {
              setView('home');
              setSearchQuery('');
              setQueueDrawerOpen(false);
            }}
          >
            <Home size={18} />
            <span>Beranda</span>
          </button>

          <button
            type="button"
            className={`mw-nav ${effectiveView === 'lib' || effectiveView === 'alb' ? 'on' : ''}`}
            onClick={() => {
              setView('lib');
              setSearchQuery('');
              setQueueDrawerOpen(false);
            }}
          >
            <ListMusic size={18} />
            <span>Playlist</span>
          </button>

          <button
            type="button"
            className={`mw-nav ${effectiveView === 'req' ? 'on' : ''}`}
            onClick={() => {
              setView('req');
              setSearchQuery('');
              setQueueDrawerOpen(false);
            }}
          >
            <Radio size={18} />
            <span>Request &amp; antrean</span>
          </button>

          <button
            type="button"
            className={`mw-nav ${effectiveView === 'lyr' ? 'on' : ''}`}
            onClick={() => {
              setView('lyr');
              setSearchQuery('');
              setQueueDrawerOpen(false);
            }}
          >
            <Mic2 size={18} />
            <span>Lirik &amp; komentar</span>
          </button>

          <div className="mw-side-sp" />

          {isSuperAdmin && (
            <button
              type="button"
              className={`mw-nav ${effectiveView === 'adm' ? 'on' : ''}`}
              onClick={() => {
                setView('adm');
                setSearchQuery('');
                setQueueDrawerOpen(false);
              }}
            >
              <ShieldCheck size={18} />
              <span>Admin (Aktif)</span>
            </button>
          )}
        </aside>

        {/* TOP BAR HEADER */}
        <header className="mw-top">
          <button
            type="button"
            className="mw-back-btn"
            onClick={onBackToLaporanWe}
            title="Kembali ke LaporanWe"
            aria-label="Kembali ke LaporanWe"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke LaporanWe</span>
          </button>

          <label className="mw-srch">
            <Search size={17} className="mw-mu" style={{ flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, artis, atau potongan lirik"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="mw-ib"
                style={{ width: 28, height: 28 }}
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <input
            className="mw-nm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nama kamu"
            maxLength={28}
            aria-label="Nama kamu"
          />

          <button
            type="button"
            className="mw-ib"
            onClick={toggleTheme}
            aria-label="Ganti tema terang atau gelap"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="mw-ib mw-qb"
            onClick={() => setQueueDrawerOpen((o) => !o)}
            aria-label="Antrean"
            title="Buka panel antrean"
          >
            <Menu size={19} />
          </button>
        </header>

        {/* MAIN CENTER CONTENT */}
        <main className="mw-main">
          {effectiveView === 'home' && (
            <div className="mw-v">
              <section className="mw-hero">
                <div className="mw-hero-content">
                  <h1>Putar bersama, antrean ditentukan kalian.</h1>
                  <p>
                    Request lagu, beri suara, dan lihat siapa yang meminta. Lagu dengan suara
                    terbanyak diputar lebih dulu.
                  </p>
                  <button
                    type="button"
                    className="mw-btn w"
                    onClick={() => setView('req')}
                  >
                    <Heart size={15} />
                    <span>Request lagu</span>
                  </button>
                </div>
                <div className="mw-tri" aria-hidden="true" />
              </section>

              <h2 className="mw-h2">Playlist untuk kamu</h2>
              {playlists.length > 0 ? (
                <div className="mw-grid">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mw-pc"
                      onClick={() => {
                        setSelectedPlaylistId(p.id);
                        setView('alb');
                      }}
                    >
                      <b>{p.n}</b>
                      <small className="mw-num">{p.ids.length} lagu</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mw-empty-box">
                  Belum ada playlist tersimpan di database. Buat playlist baru di menu Playlist.
                </div>
              )}

              {albums.length > 0 && (
                <>
                  <h2 className="mw-h2">Album &amp; Rilisan</h2>
                  <div className="mw-album-grid">
                    {albums.map((al) => {
                      const albumTracks = tracks.filter((t) => t.album_id === al.id);
                      return (
                        <button
                          key={al.id}
                          type="button"
                          className="mw-album-card"
                          onClick={() => {
                            if (albumTracks[0]) {
                              loadAndPlayTrack(albumTracks[0].id, true);
                            } else {
                              showToast(`Album "${al.title}" belum memiliki lagu.`);
                            }
                          }}
                        >
                          <CoverThumb
                            track={{ t: al.title, img: al.cover_url || '', h: 220 }}
                            sizeClass="big"
                          />
                          <div className="mw-tt" style={{ marginTop: 10 }}>
                            {al.title}
                          </div>
                          <div className="mw-mu mw-small">
                            {al.artist}
                            {al.release_year ? ` · ${al.release_year}` : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <h2 className="mw-h2">Daftar lagu &amp; single</h2>
              {hotTracks.length > 0 ? (
                <div className="mw-two">{hotTracks.map((t) => renderTrackRow(t))}</div>
              ) : (
                <div className="mw-empty-box">
                  Belum ada lagu di database.{' '}
                  {isAdmin
                    ? 'Buka menu Admin di sidebar kiri untuk menambahkan lagu pertama.'
                    : 'Hubungi admin untuk menambahkan lagu pertama.'}
                </div>
              )}
            </div>
          )}

          {effectiveView === 'search' && (
            <div className="mw-v">
              <h2 className="mw-h2">Hasil di katalog untuk &ldquo;{searchQuery.trim()}&rdquo;</h2>
              {localSearchTracks.length > 0 ? (
                <div>{localSearchTracks.map((t) => renderTrackRow(t))}</div>
              ) : (
                <p className="mw-mu">
                  Tidak ada lagu yang cocok di database lokal untuk kata kunci tersebut.
                </p>
              )}

              <h2 className="mw-h2" style={{ marginTop: 28 }}>
                Pencarian Katalog iTunes
                {extSearching && <Loader2 size={16} className="animate-spin" />}
              </h2>

              {extYoutube.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="mw-mu mw-small" style={{ marginBottom: 8, fontWeight: 700 }}>
                    YOUTUBE
                  </div>
                  {extYoutube.map((yt) => {
                    const rowKey = `yt_${yt.youtube_id}`;
                    const isActiveExt = currentTrack.youtube_id === yt.youtube_id;
                    const isResolving = resolvingExtKey === rowKey;
                    return (
                      <div
                        key={yt.youtube_id}
                        className={`mw-row ${isActiveExt ? 'on' : ''} ${isActiveExt && playing ? 'pl' : ''}`}
                        onClick={() => handlePlayExternalItem(yt, rowKey)}
                      >
                        <CoverThumb track={{ t: yt.title, img: yt.cover_url, h: 10 }} />
                        <div className="mw-i">
                          <div className="mw-tt">
                            {isActiveExt && playing && (
                              <span className="mw-eq" aria-hidden="true">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                            {yt.title}
                          </div>
                          <div className="mw-mu mw-small mw-num">
                            {yt.artist} · YouTube · {fmtTime(yt.duration_sec)}
                          </div>
                        </div>
                        <div className="mw-ac" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="mw-btn sm"
                            disabled={isResolving}
                            onClick={() => handlePlayExternalItem(yt, rowKey)}
                            aria-label="Putar"
                          >
                            {isResolving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Play size={13} />
                            )}
                            <span>Putar</span>
                          </button>
                          <button
                            type="button"
                            className="mw-btn sm g"
                            disabled={isResolving}
                            onClick={() => handleRequestExternalItem(yt, rowKey)}
                            aria-label="Request ke antrean"
                          >
                            <Heart size={13} />
                            <span>Request</span>
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="mw-ib"
                              title="Salin ke Panel Admin"
                              aria-label="Salin ke Panel Admin"
                              onClick={() => {
                                applyExternalResultToForm(yt);
                                setView('adm');
                                setSearchQuery('');
                              }}
                            >
                              <Plus size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {extItunes.length > 0 ? (
                <div>
                  <div className="mw-mu mw-small" style={{ marginBottom: 8, fontWeight: 700 }}>
                    ITUNES MUSIC (KLIK UNTUK PUTAR VIA YOUTUBE / REQUEST KE ANTREAN)
                  </div>
                  {extItunes.map((it, idx) => {
                    const rowKey = `it_${it.trackId || idx}`;
                    const isActiveExt =
                      (adHocTrack?.t === it.title && adHocTrack?.a === it.artist) ||
                      (currentTrack.t === it.title && currentTrack.a === it.artist);
                    const isResolving = resolvingExtKey === rowKey;
                    return (
                      <div
                        key={rowKey}
                        className={`mw-row ${isActiveExt ? 'on' : ''} ${isActiveExt && playing ? 'pl' : ''}`}
                        onClick={() => handlePlayExternalItem(it, rowKey)}
                      >
                        <CoverThumb track={{ t: it.title, img: it.cover_url, h: 210 }} />
                        <div className="mw-i">
                          <div className="mw-tt">
                            {isActiveExt && playing && (
                              <span className="mw-eq" aria-hidden="true">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                            {it.title}
                          </div>
                          <div className="mw-mu mw-small mw-num">
                            {it.artist}
                            {it.album ? ` · ${it.album}` : ''} · {fmtTime(it.duration_sec)}
                          </div>
                        </div>
                        <div className="mw-ac" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="mw-btn sm"
                            disabled={isResolving}
                            onClick={() => handlePlayExternalItem(it, rowKey)}
                            aria-label="Putar lagu"
                          >
                            {isResolving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Play size={13} />
                            )}
                            <span>Putar</span>
                          </button>
                          <button
                            type="button"
                            className="mw-btn sm g"
                            disabled={isResolving}
                            onClick={() => handleRequestExternalItem(it, rowKey)}
                            aria-label="Request ke antrean"
                          >
                            <Heart size={13} />
                            <span>Request</span>
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="mw-ib"
                              title="Salin ke Panel Admin"
                              aria-label="Salin ke Panel Admin"
                              onClick={() => {
                                applyExternalResultToForm(it);
                                setView('adm');
                                setSearchQuery('');
                              }}
                            >
                              <Plus size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !extSearching && (
                  <p className="mw-mu mw-small">
                    {searchQuery.trim().length < 2
                      ? 'Ketik minimal 2 karakter untuk mencari lagu di iTunes.'
                      : 'Tidak ada lagu yang ditemukan di iTunes untuk kata kunci tersebut.'}
                  </p>
                )
              )}
            </div>
          )}

          {effectiveView === 'lib' && (
            <div className="mw-v">
              <h2 className="mw-h2">Playlist</h2>
              {playlists.length > 0 && (
                <div className="mw-grid">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`mw-pc ${activePlaylist?.id === p.id ? 'sel' : ''}`}
                      onClick={() => {
                        setSelectedPlaylistId(p.id);
                        setView('alb');
                      }}
                    >
                      <b>{p.n}</b>
                      <small className="mw-num">{p.ids.length} lagu</small>
                    </button>
                  ))}
                </div>
              )}

              <form className="mw-fm" onSubmit={handleCreatePlaylist} style={{ marginTop: 16 }}>
                <input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Nama playlist baru"
                  required
                  maxLength={40}
                />
                <button type="submit" className="mw-btn">
                  <ListPlus size={15} />
                  <span>Buat playlist</span>
                </button>
              </form>

              {activePlaylist ? (
                <>
                  <h2 className="mw-h2">
                    <span>{activePlaylist.n}</span>
                    <button
                      type="button"
                      className="mw-btn sm"
                      onClick={() => handlePlayAllPlaylist(activePlaylist)}
                    >
                      <Play size={13} /> Putar semua
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="mw-btn sm g"
                        onClick={() => handleDeletePlaylist(activePlaylist.id)}
                      >
                        <Trash2 size={13} />
                        <span>
                          {confirmDeleteId === `pl_${activePlaylist.id}`
                            ? 'Konfirmasi Hapus'
                            : 'Hapus playlist'}
                        </span>
                      </button>
                    )}
                  </h2>

                  {activePlaylist.ids.length > 0 ? (
                    activePlaylist.ids.map((tid) => {
                      const tr = findTrack(tid);
                      return renderTrackRow(
                        tr,
                        isSuperAdmin ? (
                          <button
                            type="button"
                            className="mw-ib"
                            title="Hapus dari playlist"
                            aria-label="Hapus dari playlist"
                            onClick={() => handleRemoveFromPlaylist(activePlaylist.id, tr.id)}
                          >
                            <X size={16} />
                          </button>
                        ) : undefined
                      );
                    })
                  ) : (
                    <p className="mw-mu">
                      Playlist masih kosong. Tekan tombol + pada lagu untuk menambahkan.
                    </p>
                  )}
                </>
              ) : (
                <p className="mw-mu" style={{ marginTop: 16 }}>
                  Buat playlist baru untuk mulai menyusun daftar putar.
                </p>
              )}
            </div>
          )}

          {effectiveView === 'alb' && (
            <div className="mw-v">
              {activePlaylist ? (
                <>
                  <div className="mw-ah">
                    <CoverThumb
                      track={findTrack(activePlaylist.ids[0] || 0)}
                      sizeClass="xl"
                    />
                    <div>
                      <small className="mw-mu" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                        PLAYLIST
                      </small>
                      <h1 className="mw-at">{activePlaylist.n}</h1>
                      <p className="mw-mu mw-num">
                        {activePlaylist.ids.length} lagu ·{' '}
                        {fmtTime(
                          activePlaylist.ids.reduce((acc, tid) => acc + findTrack(tid).d, 0)
                        )}
                      </p>
                      <div className="mw-bt">
                        <button
                          type="button"
                          className="mw-btn"
                          onClick={() => handlePlayAllPlaylist(activePlaylist)}
                        >
                          <Play size={15} /> Putar semua
                        </button>
                        <button
                          type="button"
                          className="mw-btn o"
                          onClick={() => handleRequestAllPlaylist(activePlaylist)}
                        >
                          Request semua
                        </button>
                        <button
                          type="button"
                          className="mw-ib o"
                          onClick={() => setView('lib')}
                          title="Kelola playlist"
                          aria-label="Kelola playlist"
                        >
                          <ListMusic size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {activePlaylist.ids.length > 0 ? (
                    activePlaylist.ids.map((tid, idx) => {
                      const tr = findTrack(tid);
                      const isCur = currentTrack.id === tr.id;
                      return (
                        <div
                          key={`${tr.id}-${idx}`}
                          className={`mw-row ${isCur ? 'on' : ''} ${isCur && playing ? 'pl' : ''}`}
                          onClick={() => loadAndPlayTrack(tr.id, true)}
                        >
                          <b className="mw-num" style={{ width: 24 }}>
                            {idx + 1}
                          </b>
                          <div className="mw-i mw-tt">
                            {isCur && playing && (
                              <span className="mw-eq" aria-hidden="true">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                            {tr.t} <span className="mw-mu mw-small">{tr.a}</span>
                          </div>
                          <span className="mw-mu mw-small mw-num">{fmtTime(tr.d)}</span>
                          <div className="mw-ac" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="mw-ib"
                              aria-label="Request"
                              onClick={() => handleRequestTrack(tr)}
                            >
                              <Heart size={15} />
                            </button>
                            <button
                              type="button"
                              className="mw-ib"
                              aria-label="Lirik"
                              onClick={() => {
                                setViewTrackId(tr.id);
                                setView('lyr');
                              }}
                            >
                              <Mic2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="mw-empty-box">
                      Playlist ini masih kosong. Tambahkan lagu dengan tombol + pada daftar lagu.
                    </div>
                  )}
                </>
              ) : (
                <div className="mw-empty-box">Playlist tidak ditemukan.</div>
              )}
            </div>
          )}

          {effectiveView === 'req' && (
            <div className="mw-v">
              <h2 className="mw-h2">Antrean request</h2>
              {sortedRequests.length > 0 ? (
                <table className="mw-table">
                  <thead>
                    <tr>
                      <th>Lagu</th>
                      <th>Diminta oleh</th>
                      <th>Waktu</th>
                      <th>Suara</th>
                      {isSuperAdmin && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRequests.map((rq, idx) => {
                      const t = findTrack(rq.tid);
                      const hasVoted = rq.v.includes(who());
                      return (
                        <tr key={rq.id}>
                          <td>
                            <b className="mw-num">
                              {idx + 1}. {t.t}
                            </b>
                            <div className="mw-mu mw-small">{t.a}</div>
                          </td>
                          <td>{rq.by}</td>
                          <td className="mw-mu mw-num">{fmtAgo(rq.ts)}</td>
                          <td>
                            <button
                              type="button"
                              className={`mw-vote mw-num ${hasVoted ? 'me' : ''}`}
                              onClick={() => handleToggleVote(rq.id)}
                            >
                              <ThumbsUp size={13} />
                              <span>{rq.v.length}</span>
                            </button>
                          </td>
                          {isSuperAdmin && (
                            <td>
                              <button
                                type="button"
                                className="mw-ib"
                                aria-label="Hapus request"
                                onClick={() => handleDeleteRequest(rq.id)}
                              >
                                <X size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="mw-mu">
                  Belum ada request di antrean database. Pilih lagu di bawah untuk memulai.
                </p>
              )}

              <h2 className="mw-h2">Pilih lagu untuk direquest</h2>
              {tracks.length > 0 ? (
                <div>{tracks.map((t) => renderTrackRow(t))}</div>
              ) : (
                <div className="mw-empty-box">Belum ada lagu tersedia di database.</div>
              )}
            </div>
          )}

          {effectiveView === 'lyr' && (
            <div className="mw-v">
              <div className="mw-ly">
                <div>
                  <CoverThumb track={detailTrack} sizeClass="xl" />
                  <h2 className="mw-h2" style={{ marginTop: 16, marginBottom: 4 }}>
                    {detailTrack.t}
                  </h2>
                  <p className="mw-mu" style={{ margin: 0 }}>
                    {detailTrack.a}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="mw-btn sm"
                      onClick={() => loadAndPlayTrack(detailTrack.id, true)}
                    >
                      <Play size={14} /> Putar
                    </button>
                    <button
                      type="button"
                      className="mw-btn sm g"
                      onClick={() => handleRequestTrack(detailTrack)}
                    >
                      <Heart size={14} /> Request
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mw-lyr" ref={lyricsContainerRef}>
                    {detailLyricsLines.length > 0 ? (
                      detailLyricsLines.map((line, idx) => (
                        <p
                          key={`${detailTrack.id}-l-${idx}`}
                          className={idx === activeDetailLyricIdx ? 'on' : ''}
                          onClick={() => {
                            if (detailTrack.id !== currentTrack.id) {
                              loadAndPlayTrack(detailTrack.id, true);
                            }
                            seekTo(line.time);
                          }}
                          title={`Klik untuk melompat ke ${fmtTime(line.time)}`}
                        >
                          {line.text}
                        </p>
                      ))
                    ) : (
                      <p className="on">
                        Lirik belum ditambahkan. Admin bisa menambahkannya lewat menu Admin.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mw-cm">
                <h2 className="mw-h2">
                  Komentar ({(commentsMap[String(detailTrack.id)] || []).length})
                </h2>
                <form className="mw-fm" onSubmit={handleAddComment}>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={`Tulis komentar sebagai ${who()}`}
                    required
                    maxLength={300}
                  />
                  <button type="submit" className="mw-btn">
                    Kirim
                  </button>
                </form>
                <div style={{ marginTop: 10 }}>
                  {(commentsMap[String(detailTrack.id)] || []).map((cm, idx) => (
                    <div key={`${cm.id || idx}`} className="mw-cc">
                      <div className="mw-av">{(cm.by || 'P').charAt(0).toUpperCase()}</div>
                      <div>
                        <b>{cm.by}</b>{' '}
                        <span className="mw-mu mw-small mw-num">{fmtAgo(cm.ts)}</span>
                        <div>{cm.tx}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {effectiveView === 'adm' && isSuperAdmin && (
            <div className="mw-v">
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <h2 className="mw-h2" style={{ margin: 0 }}>
                    Panel Admin (.MUSIKWE CRUD)
                  </h2>
                </div>

                  {/* YouTube API Key & External iTunes/YouTube Search */}
                  <div className="mw-adm-grid">
                    <div className="mw-adm-card">
                      <h3>1. Integrasi YouTube Data API v3</h3>
                      <p className="mw-mu mw-small" style={{ marginBottom: 10 }}>
                        Status Key: {hasYoutubeKey ? 'Tersimpan di server' : 'Belum dikonfigurasi'}
                      </p>
                      <form className="mw-fm" onSubmit={handleSaveYoutubeKey}>
                        <input
                          type="password"
                          value={ytApiKeyInput}
                          onChange={(e) => setYtApiKeyInput(e.target.value)}
                          placeholder="Masukkan YouTube Data API v3 Key"
                          required
                        />
                        <button type="submit" className="mw-btn sm">
                          <Youtube size={14} /> Simpan API Key
                        </button>
                      </form>
                    </div>

                    <div className="mw-adm-card">
                      <h3>2. Pencarian Cepat iTunes &amp; YouTube</h3>
                      <form className="mw-fm" onSubmit={handleAdminExternalSearch}>
                        <input
                          value={admExtQuery}
                          onChange={(e) => setAdmExtQuery(e.target.value)}
                          placeholder="Cari lagu di iTunes / YouTube..."
                          required
                        />
                        <button type="submit" className="mw-btn sm" disabled={extSearching}>
                          <Search size={14} /> Cari
                        </button>
                      </form>
                      {(extYoutube.length > 0 || extItunes.length > 0) && (
                        <div
                          style={{
                            maxHeight: 200,
                            overflowY: 'auto',
                            marginTop: 10,
                            borderTop: '1px solid var(--mw-ln)',
                            paddingTop: 8,
                          }}
                        >
                          {extYoutube.slice(0, 6).map((yt) => (
                            <div
                              key={yt.youtube_id}
                              className="mw-row"
                              style={{ padding: '6px 8px' }}
                            >
                              <CoverThumb track={{ t: yt.title, img: yt.cover_url, h: 0 }} />
                              <div className="mw-i">
                                <div className="mw-tt" style={{ fontSize: 12.5 }}>
                                  {yt.title}
                                </div>
                                <div className="mw-mu mw-small">
                                  YouTube · {yt.artist}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="mw-btn sm"
                                onClick={() => applyExternalResultToForm(yt)}
                              >
                                Gunakan
                              </button>
                            </div>
                          ))}
                          {extItunes.slice(0, 6).map((it, idx) => (
                            <div
                              key={`${it.trackId || idx}`}
                              className="mw-row"
                              style={{ padding: '6px 8px' }}
                            >
                              <CoverThumb track={{ t: it.title, img: it.cover_url, h: 200 }} />
                              <div className="mw-i">
                                <div className="mw-tt" style={{ fontSize: 12.5 }}>
                                  {it.title}
                                </div>
                                <div className="mw-mu mw-small">
                                  iTunes · {it.artist}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="mw-btn sm"
                                onClick={() => applyExternalResultToForm(it)}
                              >
                                Gunakan
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Album & Logo Cards */}
                  <div className="mw-adm-grid">
                    <div className="mw-adm-card">
                      <h3>3. Buat Album Baru</h3>
                      <form className="mw-fm" onSubmit={handleCreateAlbum}>
                        <input
                          value={albumTitle}
                          onChange={(e) => setAlbumTitle(e.target.value)}
                          placeholder="Judul album"
                          required
                        />
                        <input
                          value={albumArtist}
                          onChange={(e) => setAlbumArtist(e.target.value)}
                          placeholder="Nama artis"
                          required
                        />
                        <input
                          value={albumYear}
                          onChange={(e) => setAlbumYear(e.target.value)}
                          placeholder="Tahun rilis"
                          style={{ maxWidth: 100 }}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setAlbumCoverFile(e.target.files?.[0] || null)}
                        />
                        <button type="submit" className="mw-btn sm">
                          <Plus size={14} /> Simpan Album
                        </button>
                      </form>
                    </div>

                    <div className="mw-adm-card">
                      <h3>4. Upload &amp; Perbarui Logo .MUSIKWE</h3>
                      <form className="mw-fm" onSubmit={handleUpdateLogo}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          required
                        />
                        <button type="submit" className="mw-btn sm">
                          <Upload size={14} /> Upload &amp; Simpan Logo
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Add / Edit Track Card */}
                  <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>
                        {editingTrackId
                          ? '5. Edit Lagu Terpilih'
                          : '5. Tambah Lagu / Single (Audio, YouTube, Cover & Lirik Sinkron)'}
                      </h3>
                      {editingTrackId && (
                        <button
                          type="button"
                          className="mw-btn sm g"
                          onClick={() => {
                            setEditingTrackId(null);
                            setTrackTitle('');
                            setTrackArtist('');
                            setTrackAudioUrl('');
                            setTrackYoutubeInput('');
                            setTrackCoverUrl('');
                            setTrackLyrics('');
                          }}
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>

                    <form className="mw-fm" onSubmit={handleSaveTrack}>
                      <input
                        value={trackTitle}
                        onChange={(e) => setTrackTitle(e.target.value)}
                        placeholder="Judul lagu"
                        required
                      />
                      <input
                        value={trackArtist}
                        onChange={(e) => setTrackArtist(e.target.value)}
                        placeholder="Artis"
                        required
                      />
                      <select
                        value={trackAlbumId}
                        onChange={(e) => setTrackAlbumId(e.target.value)}
                      >
                        <option value="0">Single (Tanpa Album)</option>
                        {albums.map((al) => (
                          <option key={al.id} value={al.id}>
                            Album: {al.title} ({al.artist})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={15}
                        max={3600}
                        value={trackDuration}
                        onChange={(e) => setTrackDuration(e.target.value)}
                        placeholder="Durasi (detik)"
                        style={{ maxWidth: 130 }}
                      />
                      <input
                        value={trackYoutubeInput}
                        onChange={(e) => setTrackYoutubeInput(e.target.value)}
                        placeholder="Link / ID YouTube (opsional, mis. dQw4w9WgXcQ)"
                      />
                      <input
                        value={trackAudioUrl}
                        onChange={(e) => setTrackAudioUrl(e.target.value)}
                        placeholder="Link audio langsung (.mp3/.m4a) atau upload di bawah"
                      />
                      <input
                        value={trackCoverUrl}
                        onChange={(e) => setTrackCoverUrl(e.target.value)}
                        placeholder="Link cover gambar (opsional)"
                      />
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a"
                        title="Upload file audio (.mp3/.wav/.m4a)"
                        onChange={(e) => setTrackAudioFile(e.target.files?.[0] || null)}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        title="Upload cover gambar"
                        onChange={(e) => setTrackCoverFile(e.target.files?.[0] || null)}
                      />
                      <textarea
                        value={trackLyrics}
                        onChange={(e) => setTrackLyrics(e.target.value)}
                        placeholder={
                          'Lirik satu baris per kalimat. Untuk lirik sinkron tulis [mm:ss] di awal baris, contoh:\n[00:08] Pasir hangat di bawah kaki\n[00:14] Kita tertawa menunggu senja'
                        }
                      />
                      <button type="submit" className="mw-btn">
                        <Plus size={15} />
                        <span>
                          {editingTrackId ? 'Simpan Perubahan Lagu' : 'Simpan Lagu ke Database'}
                        </span>
                      </button>
                    </form>
                  </div>

                  <h2 className="mw-h2">Kelola Lagu di Database ({tracks.length})</h2>
                  {tracks.length > 0 ? (
                    <div>
                      {tracks.map((t) =>
                        renderTrackRow(
                          t,
                          <>
                            <button
                              type="button"
                              className="mw-ib"
                              title="Edit lagu"
                              aria-label="Edit lagu"
                              onClick={() => handleEditTrackFill(t)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="mw-ib"
                              title={
                                confirmDeleteId === `tr_${t.id}`
                                  ? 'Klik lagi untuk konfirmasi hapus'
                                  : 'Hapus lagu'
                              }
                              style={
                                confirmDeleteId === `tr_${t.id}`
                                  ? { color: '#ef4444' }
                                  : undefined
                              }
                              aria-label="Hapus lagu"
                              onClick={() => handleDeleteTrack(t.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mw-empty-box">Belum ada lagu tersimpan di database.</div>
                  )}
                </div>
            </div>
          )}
        </main>

        {/* RIGHT QUEUE PANEL (DRAWER ON MOBILE) */}
        <aside className={`mw-queue ${queueDrawerOpen ? 'open' : ''}`}>
          <div className="mw-np">
            <CoverThumb track={currentTrack} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mw-small mw-mu">Sedang diputar</div>
              <div className="mw-tt">{currentTrack.t}</div>
              <div className="mw-small mw-mu">{currentTrack.a}</div>
            </div>
          </div>

          <h3>
            <span>Antrean request</span>
            <span className="mw-mu mw-small mw-num">{sortedRequests.length} lagu</span>
          </h3>

          {sortedRequests.length > 0 ? (
            sortedRequests.map((rq) => {
              const tr = findTrack(rq.tid);
              const voted = rq.v.includes(who());
              return (
                <div
                  key={rq.id}
                  className="mw-row"
                  onClick={() => loadAndPlayTrack(tr.id, true)}
                >
                  <CoverThumb track={tr} />
                  <div className="mw-i">
                    <div className="mw-tt">{tr.t}</div>
                    <div className="mw-mu mw-small mw-num">
                      oleh {rq.by} · {fmtAgo(rq.ts)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`mw-vote mw-num ${voted ? 'me' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVote(rq.id);
                    }}
                    aria-label="Beri suara"
                  >
                    <ThumbsUp size={12} />
                    <span>{rq.v.length}</span>
                  </button>
                </div>
              );
            })
          ) : (
            <p className="mw-mu mw-small">Belum ada request. Jadilah yang pertama.</p>
          )}

          <h3>Berikutnya otomatis</h3>
          {autoNextTracks.length > 0 ? (
            autoNextTracks.map((t) => (
              <div
                key={t.id}
                className="mw-row"
                onClick={() => loadAndPlayTrack(t.id, true)}
              >
                <CoverThumb track={t} />
                <div className="mw-i">
                  <div className="mw-tt">{t.t}</div>
                  <div className="mw-mu mw-small">{t.a}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="mw-mu mw-small">Katalog berikutnya kosong.</p>
          )}
        </aside>

        {/* BOTTOM PLAYER BAR */}
        <footer
          className="mw-player"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, input, .mw-pb')) return;
            setOverlayOpen(true);
          }}
          onWheel={(e) => {
            if (e.deltaY < -4) setOverlayOpen(true);
          }}
          onTouchStart={(e) => {
            touchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchStartYRef.current - e.changedTouches[0].clientY > 40) {
              setOverlayOpen(true);
            }
          }}
        >
          <div
            className="mw-pb"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seekTo(ratio * (currentTrack.d || 200));
            }}
          >
            <i style={{ width: `${progressPct}%` }} />
          </div>

          <div className="mw-pi">
            <CoverThumb track={currentTrack} />
            <div style={{ minWidth: 0 }}>
              <div className="mw-tt">{currentTrack.t}</div>
              <div className="mw-mu mw-small">{currentTrack.a}</div>
            </div>
          </div>

          <div className="mw-ct">
            <div className="mw-cb">
              <button
                type="button"
                className={`mw-ib ${shuffle ? 'on' : ''}`}
                onClick={() => setShuffle((s) => !s)}
                aria-label="Acak"
                title="Acak"
              >
                <Shuffle size={17} />
              </button>
              <button
                type="button"
                className="mw-ib"
                onClick={prevTrack}
                aria-label="Sebelumnya"
                title="Sebelumnya"
              >
                <SkipBack size={18} />
              </button>
              <button
                type="button"
                className="mw-pp"
                onClick={togglePlayPause}
                aria-label="Putar atau jeda"
                title="Putar atau jeda"
              >
                {playing ? <Pause size={19} /> : <Play size={19} />}
              </button>
              <button
                type="button"
                className="mw-ib"
                onClick={() => nextTrack()}
                aria-label="Berikutnya"
                title="Berikutnya"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>

          <div className="mw-pr">
            <span className="mw-mu mw-small mw-num" style={{ marginRight: 6 }}>
              {fmtTime(position)} / {fmtTime(currentTrack.d)}
            </span>
            <button
              type="button"
              className={`mw-ib ${view === 'lyr' ? 'on' : ''}`}
              onClick={() => {
                setViewTrackId(currentTrack.id);
                setView('lyr');
                setSearchQuery('');
              }}
              aria-label="Lirik"
              title="Lirik"
            >
              <Mic2 size={17} />
            </button>
            <button
              type="button"
              className={`mw-ib ${likedIds.has(currentTrack.id) ? 'on' : ''}`}
              onClick={() => {
                setLikedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(currentTrack.id)) {
                    next.delete(currentTrack.id);
                    showToast('Suka dibatalkan');
                  } else {
                    next.add(currentTrack.id);
                    showToast('Disukai');
                  }
                  return next;
                });
              }}
              aria-label="Suka"
              title="Suka"
            >
              <Heart size={17} />
            </button>
            <input
              type="range"
              className="mw-vol"
              min={0}
              max={100}
              value={volume}
              style={{ '--mw-v': `${volume}%` } as React.CSSProperties}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>
        </footer>
      </div>

      {/* FULLSCREEN VINYL / CASSETTE OVERLAY */}
      <div
        className={`mw-npo ${overlayOpen ? 'open' : ''} ${playing ? 'play' : ''}`}
        style={{ '--mw-h': currentTrack.h || 210 } as React.CSSProperties}
        onTouchStart={(e) => {
          touchStartYRef.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (e.changedTouches[0].clientY - touchStartYRef.current > 90) {
            setOverlayOpen(false);
          }
        }}
      >
        {currentTrack.img && (
          <div
            className="mw-nbg"
            style={{ backgroundImage: `url(${currentTrack.img})` }}
          />
        )}

        <div className="mw-nh">
          <button
            type="button"
            className="mw-ib"
            onClick={() => setOverlayOpen(false)}
            aria-label="Tutup tampilan putar"
          >
            <ChevronDown size={22} />
          </button>
          <b>Sedang diputar</b>
          <div className="mw-seg">
            <button
              type="button"
              className={overlayMode === 'v' ? 'active' : ''}
              onClick={() => setOverlayMode('v')}
            >
              Vinyl
            </button>
            <button
              type="button"
              className={overlayMode === 'k' ? 'active' : ''}
              onClick={() => setOverlayMode('k')}
            >
              Kaset
            </button>
          </div>
        </div>

        <div className="mw-nbody">
          <div className="mw-stg">
            {overlayMode === 'v' ? (
              <div className="mw-vin">
                <div className="mw-disc">
                  <div
                    className="mw-lab"
                    style={
                      currentTrack.img
                        ? { backgroundImage: `url(${currentTrack.img})` }
                        : undefined
                    }
                  >
                    {!currentTrack.img &&
                      (currentTrack.t || 'M').trim().charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="mw-arm" />
              </div>
            ) : (
              <div className="mw-cas">
                <div className="mw-cl">
                  <b>{currentTrack.t}</b>
                  <span>{currentTrack.a}</span>
                </div>
                <div className="mw-cw">
                  <i className="mw-rl" />
                  <i className="mw-rl" />
                </div>
                <div className="mw-cf" />
              </div>
            )}
          </div>

          <div className="mw-inf">
            <h1>{currentTrack.t}</h1>
            <p className="mw-mu" style={{ fontSize: 16 }}>
              {currentTrack.a}
            </p>
            <div className="mw-nl">{activeLyricText}</div>

            <div className="mw-nbar mw-num">
              <span>{fmtTime(position)}</span>
              <div
                className="mw-pb"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width)
                  );
                  seekTo(ratio * (currentTrack.d || 200));
                }}
              >
                <i style={{ width: `${progressPct}%` }} />
              </div>
              <span>{fmtTime(currentTrack.d)}</span>
            </div>

            <div className="mw-cb">
              <button
                type="button"
                className="mw-ib"
                onClick={prevTrack}
                aria-label="Sebelumnya"
              >
                <SkipBack size={20} />
              </button>
              <button
                type="button"
                className="mw-pp"
                onClick={togglePlayPause}
                aria-label="Putar atau jeda"
              >
                {playing ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button
                type="button"
                className="mw-ib"
                onClick={() => nextTrack()}
                aria-label="Berikutnya"
              >
                <SkipForward size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SINGLE TOAST NOTIFICATION */}
      <div className={`mw-toast ${toastOpen ? 's' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
};

export default MusikweFullscreenView;
