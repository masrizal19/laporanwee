import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
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
  Repeat,
  RotateCcw,
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
  MusikwePlaylist,
  MusikweTrack,
  extractYoutubeId,
  musikweApi,
  parseSyncedLyrics,
} from '../utils/musikweApi';
import { getStoredUser } from '../utils/api';
import { useMusikWe } from '../context/MusikWeContext';
import '../styles/musikwe.css';

export interface MusikweFullscreenViewProps {
  userId?: string | number;
  userEmail?: string;
  userName?: string;
  onBackToLaporanWe: () => void;
}

type MusikweNavView = 'home' | 'lib' | 'req' | 'lyr' | 'adm' | 'alb';

interface BulkUploadItem {
  uid: string;
  file: File;
  title: string;
  artist: string;
  duration: number;
  status: 'pending' | 'uploading' | 'saving' | 'done' | 'error';
  errorMsg?: string;
}

const parseAudioFilenameMeta = (
  filename: string,
  defaultArtist: string
): { title: string; artist: string } => {
  const base = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!defaultArtist.trim()) {
    const dashParts = base.split(/\s+[-–—]\s+/);
    if (dashParts.length >= 2 && dashParts[0].trim() && dashParts[1].trim()) {
      return {
        artist: dashParts[0].trim(),
        title: dashParts.slice(1).join(' - ').trim(),
      };
    }
  }
  return {
    title: base || 'Tanpa Judul',
    artist: defaultArtist.trim() || 'Artis Tidak Diketahui',
  };
};

const readAudioFileDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (sec: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(sec);
    };
    const timer = window.setTimeout(() => finish(200), 3500);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const d = Number(audio.duration);
      finish(Number.isFinite(d) && d > 5 ? Math.round(d) : 200);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(200);
    };
    audio.src = url;
  });

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

const fmtClockTime = (tsMs: number): string => {
  const safeMs = Number(tsMs || 0);
  if (!Number.isFinite(safeMs) || safeMs <= 0) return '--:--';
  try {
    return new Date(safeMs).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
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
  userEmail,
  userName,
  onBackToLaporanWe,
}) => {
  const {
    authEmail,
    isSuperAdmin: ctxIsSuperAdmin,
    displayName,
    setDisplayName,
    who: ctxWho,
    authOpts: ctxAuthOpts,
    tracks: rawTracks,
    setTracks,
    catalogTracks: rawCatalogTracks,
    setCatalogTracks,
    albums: rawAlbums,
    setAlbums,
    playlists: rawPlaylists,
    setPlaylists,
    requests: rawRequests,
    setRequests,
    requestHistory: rawRequestHistory,
    setRequestHistory,
    todayHistory: rawTodayHistory,
    sortedRequests: rawSortedRequests,
    autoNextCandidate,
    commentsMap: rawCommentsMap,
    serverUser,
    logoUrl,
    setLogoUrl,
    hasYoutubeKey,
    setHasYoutubeKey,
    currentTrackId,
    viewTrackId,
    setViewTrackId,
    adHocTrack,
    currentTrack: rawCurrentTrack,
    isPlaying: playing,
    progress: position,
    shuffle,
    setShuffle,
    volume,
    setVolume,
    likedIds,
    toggleLike,
    setMiniPlayerDismissed,
    isLiveBroadcastActive,
    autoplayBlocked,
    autoPlayQueue,
    activeRequestId,
    toggleAutoPlayQueue,
    joinLiveAudio,
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
    loadAndPlayTrack,
    playExternalItem: handlePlayExternalItem,
    playHistoryTrack,
    clearTodayHistory,
    skipToRequest,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    purgeTrackLocally,
  } = useMusikWe();

  const tracks = useMemo(() => (Array.isArray(rawTracks) ? rawTracks.filter(Boolean) : []), [rawTracks]);
  const catalogTracks = useMemo(
    () => (Array.isArray(rawCatalogTracks) ? rawCatalogTracks.filter(Boolean) : []),
    [rawCatalogTracks]
  );
  const albums = useMemo(() => (Array.isArray(rawAlbums) ? rawAlbums.filter(Boolean) : []), [rawAlbums]);
  const playlists = useMemo(
    () => (Array.isArray(rawPlaylists) ? rawPlaylists.filter(Boolean) : []),
    [rawPlaylists]
  );
  const requests = useMemo(
    () => (Array.isArray(rawRequests) ? rawRequests.filter(Boolean) : []),
    [rawRequests]
  );
  const requestHistory = useMemo(
    () => (Array.isArray(rawRequestHistory) ? rawRequestHistory.filter(Boolean) : []),
    [rawRequestHistory]
  );
  const todayHistory = useMemo(
    () => (Array.isArray(rawTodayHistory) ? rawTodayHistory.filter(Boolean) : []),
    [rawTodayHistory]
  );
  const sortedRequests = useMemo(
    () => (Array.isArray(rawSortedRequests) ? rawSortedRequests.filter(Boolean) : []),
    [rawSortedRequests]
  );
  const commentsMap = useMemo(
    () => (rawCommentsMap && typeof rawCommentsMap === 'object' ? rawCommentsMap : {}),
    [rawCommentsMap]
  );
  const currentTrack: MusikweTrack = rawCurrentTrack || {
    id: 0,
    t: 'Belum ada lagu',
    a: 'Menunggu lagu',
    d: 200,
    h: 210,
    url: '',
    ly: '',
    img: '',
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('mw_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [view, setView] = useState<MusikweNavView>('home');
  const [searchQuery, setSearchQuery] = useState('');

  const storedEmail = useMemo(() => {
    try {
      return getStoredUser()?.email || '';
    } catch {
      return '';
    }
  }, []);
  const activeEmail = (userEmail || authEmail || storedEmail || serverUser.email || '')
    .trim()
    .toLowerCase();
  const isSuperAdmin = ctxIsSuperAdmin || activeEmail === 'rizalsaragih498@gmail.com';
  const isAdmin = isSuperAdmin;

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number>(0);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<'v' | 'k'>('v');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sub-forms state
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [commentText, setCommentText] = useState('');

  // Request & antrean form + quick iTunes search state
  const [reqFormTitle, setReqFormTitle] = useState('');
  const [reqFormArtist, setReqFormArtist] = useState('');
  const [reqFormYoutube, setReqFormYoutube] = useState('');
  const [reqItunesQuery, setReqItunesQuery] = useState('');
  const [reqItunesResults, setReqItunesResults] = useState<ExternalItunesItem[]>([]);
  const [reqItunesSearching, setReqItunesSearching] = useState(false);

  // External search state (for live search view & admin)
  const [extItunes, setExtItunes] = useState<ExternalItunesItem[]>([]);
  const [extYoutube, setExtYoutube] = useState<ExternalYoutubeItem[]>([]);
  const [extSearching, setExtSearching] = useState(false);
  const [admExtQuery, setAdmExtQuery] = useState('');

  // Admin forms state
  const [ytApiKeyInput, setYtApiKeyInput] = useState('');
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [albumYear, setAlbumYear] = useState(String(new Date().getFullYear()));
  const [albumCoverUrlInput, setAlbumCoverUrlInput] = useState('');
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoFilePreviewUrl, setLogoFilePreviewUrl] = useState('');
  const [logoImgError, setLogoImgError] = useState(false);

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

  // Admin bulk upload state
  const [bulkAlbumId, setBulkAlbumId] = useState<string>('0');
  const [bulkDefaultArtist, setBulkDefaultArtist] = useState('');
  const [bulkCoverUrl, setBulkCoverUrl] = useState('');
  const [bulkCoverFile, setBulkCoverFile] = useState<File | null>(null);
  const [bulkItems, setBulkItems] = useState<BulkUploadItem[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  // Refs for synced lyric scrolling, admin inputs & touch gestures
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lastActiveLyricIdxRef = useRef<number>(-1);
  const touchStartYRef = useRef<number>(0);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const albumCoverInputRef = useRef<HTMLInputElement | null>(null);
  const albumFormCardRef = useRef<HTMLDivElement | null>(null);
  const bulkAudioInputRef = useRef<HTMLInputElement | null>(null);
  const bulkCoverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLogoImgError(false);
  }, [logoUrl, logoUrlInput, logoFilePreviewUrl]);

  useEffect(() => {
    if (!logoFile) {
      setLogoFilePreviewUrl('');
      return;
    }
    const objUrl = URL.createObjectURL(logoFile);
    setLogoFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [logoFile]);

  // Block Admin tab/view for non-super-admin accounts
  useEffect(() => {
    if (!isSuperAdmin && view === 'adm') {
      setView('home');
    }
  }, [isSuperAdmin, view]);

  // Keep selectedPlaylistId synchronized with playlists from context
  useEffect(() => {
    if (playlists.length > 0) {
      setSelectedPlaylistId((prev) =>
        playlists.some((p) => p.id === prev) ? prev : playlists[0].id
      );
    } else {
      setSelectedPlaylistId(0);
    }
  }, [playlists]);

  const authOpts = useMemo(
    () => ({
      userEmail: userEmail || ctxAuthOpts.userEmail || storedEmail || serverUser.email || '',
    }),
    [userEmail, ctxAuthOpts.userEmail, storedEmail, serverUser.email]
  );

  const who = useCallback((): string => {
    return displayName.trim() || userName?.trim() || ctxWho();
  }, [displayName, userName, ctxWho]);

  const detailTrack = useMemo(() => {
    const id = viewTrackId || currentTrackId;
    return adHocTrack && id === adHocTrack.id ? adHocTrack : findTrack(id);
  }, [adHocTrack, findTrack, viewTrackId, currentTrackId]);

  // Refresh latest data silently when entering /Aplikasi/Musikwe without interrupting background audio
  useEffect(() => {
    setMiniPlayerDismissed(false);
    syncFromBackend('', catalogTracks.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Debounced quick iTunes search inside 'Request & antrean'
  useEffect(() => {
    const trimmed = reqItunesQuery.trim();
    if (trimmed.length < 2) {
      setReqItunesResults([]);
      setReqItunesSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setReqItunesSearching(true);
      musikweApi
        .searchItunes(trimmed)
        .then((results) => {
          if (!cancelled) setReqItunesResults(results);
        })
        .catch(() => {
          if (!cancelled) setReqItunesResults([]);
        })
        .finally(() => {
          if (!cancelled) setReqItunesSearching(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reqItunesQuery]);

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
    beginLoading();
    try {
      await fn();
    } catch (err: any) {
      showToast(err?.message || 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      endLoading();
    }
  };

  const isOwnRequest = useCallback(
    (requestedBy?: string, reqEmail?: string): boolean => {
      if (isSuperAdmin) return true;
      if (reqEmail && activeEmail && reqEmail.trim().toLowerCase() === activeEmail) {
        return true;
      }
      const meName = who().trim().toLowerCase();
      if (requestedBy && meName && requestedBy.trim().toLowerCase() === meName) {
        return true;
      }
      return false;
    },
    [isSuperAdmin, activeEmail, who]
  );

  const handleRequestTrack = async (track: MusikweTrack) => {
    if (!track || !String(track.t || '').trim()) return;
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
          requested_by: who(),
        },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal mengirim request lagu.');
        return;
      }
      await syncFromBackend('');
      showToast(res.message || `"${track.t}" ditambahkan ke antrean request.`);
    });
  };

  const handleRequestExternalItem = async (
    item: ExternalItunesItem | ExternalYoutubeItem,
    key: string
  ) => {
    setResolvingExtKey(key);
    try {
      await runMutation(async () => {
        const existing = findMatchingLocalTrack(item);
        let ytId = item.source === 'youtube' ? item.youtube_id : existing?.youtube_id || '';
        const durationSec = item.duration_sec || existing?.d || 200;

        if (!ytId && item.source === 'itunes') {
          try {
            const ytMatch = await musikweApi.searchYoutubeBestMatch(
              item.title,
              item.artist,
              authOpts
            );
            ytId = ytMatch.youtube_id || '';
          } catch {
            ytId = '';
          }
        }

        const coverUrl =
          item.cover_url ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '');
        const payload: Record<string, any> = {
          action: 'request_track',
          track_id: existing?.id || 0,
          title: item.title,
          artist: item.artist,
          cover_url: coverUrl,
          duration: durationSec,
          youtube_id: ytId || '',
          requested_by: who(),
        };

        const res = await musikweApi.postAction('create.php', payload, authOpts);
        if (!res.success) {
          showToast(res.message || 'Gagal menyimpan request ke database.');
          return;
        }

        await syncFromBackend('');
        showToast(res.message || `"${item.title}" masuk ke antrean bersama!`);
      });
    } finally {
      setResolvingExtKey(null);
    }
  };

  const handleSubmitManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = reqFormTitle.trim();
    const artist = reqFormArtist.trim();
    if (!title || !artist) {
      showToast('Judul lagu dan nama artis wajib diisi.');
      return;
    }

    const ytId = extractYoutubeId(reqFormYoutube);
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'request_track',
          track_id: 0,
          title,
          artist,
          cover_url: ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '',
          duration: 200,
          youtube_id: ytId || '',
          requested_by: who(),
        },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal mengirim request lagu.');
        return;
      }
      setReqFormTitle('');
      setReqFormArtist('');
      setReqFormYoutube('');
      await syncFromBackend('');
      showToast(res.message || `"${title}" berhasil dikirim ke Admin & antrean!`);
    });
  };

  const handleReqItunesSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = reqItunesQuery.trim();
    if (q.length < 2) {
      showToast('Ketik minimal 2 karakter untuk mencari lagu.');
      return;
    }
    setReqItunesSearching(true);
    try {
      const results = await musikweApi.searchItunes(q);
      setReqItunesResults(results);
      if (results.length === 0) {
        showToast('Lagu tidak ditemukan di iTunes.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal mencari lagu di iTunes.');
    } finally {
      setReqItunesSearching(false);
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

  const handleDeleteRequest = async (
    requestId: number,
    canDelete: boolean = isSuperAdmin,
    trackId?: number
  ) => {
    if (!isSuperAdmin && !canDelete) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        {
          action: 'delete_request',
          id: requestId,
          delete_track: isSuperAdmin,
        },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal menghapus request.');
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setRequestHistory((prev) => prev.filter((r) => r.id !== requestId));
      if (isSuperAdmin && trackId && trackId > 0) {
        purgeTrackLocally(trackId);
      }
      await syncFromBackend(searchQuery);
      showToast(res.message || 'Request dihapus.');
    });
  };

  const handleClearRequestHistory = async () => {
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'clear_request_history', requested_by: who() },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal menghapus riwayat request.');
        return;
      }
      if (isSuperAdmin) {
        setRequestHistory([]);
      } else {
        setRequestHistory((prev) =>
          prev.filter((item) => !isOwnRequest(item.by, item.user_email))
        );
      }
      await syncFromBackend(searchQuery);
      showToast(res.message || 'Riwayat request dibersihkan.');
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
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
        setSelectedPlaylistId(0);
        setView('lib');
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handlePlayAllPlaylist = async (pl: MusikwePlaylist) => {
    const ids = Array.isArray(pl?.ids) ? pl.ids : [];
    if (!ids.length) {
      showToast('Playlist masih kosong.');
      return;
    }
    await runMutation(async () => {
      for (const tid of ids.slice(1)) {
        await musikweApi
          .postAction(
            'create.php',
            { action: 'request_track', track_id: tid, requested_by: `Playlist ${pl.n}` },
            authOpts
          )
          .catch(() => {});
      }
      await syncFromBackend(searchQuery);
      loadAndPlayTrack(ids[0], true);
      showToast(`Memutar playlist ${pl.n}`);
    });
  };

  const handleRequestAllPlaylist = async (pl: MusikwePlaylist) => {
    const ids = Array.isArray(pl?.ids) ? pl.ids : [];
    if (!ids.length) return;
    await runMutation(async () => {
      for (const tid of ids) {
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

  const handleCancelEditAlbum = () => {
    setEditingAlbumId(null);
    setAlbumTitle('');
    setAlbumArtist('');
    setAlbumYear(String(new Date().getFullYear()));
    setAlbumCoverUrlInput('');
    setAlbumCoverFile(null);
    if (albumCoverInputRef.current) albumCoverInputRef.current.value = '';
  };

  const handleEditAlbumFill = (al: MusikweAlbum) => {
    if (!isSuperAdmin) return;
    setEditingAlbumId(al.id);
    setAlbumTitle(al.title);
    setAlbumArtist(al.artist);
    setAlbumYear(al.release_year || String(new Date().getFullYear()));
    setAlbumCoverUrlInput(al.cover_url || '');
    setAlbumCoverFile(null);
    if (albumCoverInputRef.current) albumCoverInputRef.current.value = '';
    albumFormCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`Mengedit album "${al.title}".`);
  };

  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!albumTitle.trim() || !albumArtist.trim()) return;
    await runMutation(async () => {
      let coverUrl = albumCoverUrlInput.trim();
      if (albumCoverFile) {
        showToast('Mengunggah cover album...');
        const up = await musikweApi.uploadFile(albumCoverFile, authOpts);
        if (!up.success || !up.url) {
          showToast(up.message || 'Gagal mengunggah cover album.');
          return;
        }
        coverUrl = up.url;
      }

      const nextTitle = albumTitle.trim();
      const nextArtist = albumArtist.trim();
      const nextYear = albumYear.trim() || String(new Date().getFullYear());

      if (editingAlbumId) {
        const res = await musikweApi.postAction(
          'update.php',
          {
            action: 'update_album',
            id: editingAlbumId,
            title: nextTitle,
            artist: nextArtist,
            release_year: nextYear,
            cover_url: coverUrl,
          },
          authOpts
        );
        showToast(res.message || 'Album berhasil diperbarui.');
        if (res.success) {
          const editedId = editingAlbumId;
          setAlbums((prev) =>
            prev.map((al) =>
              al.id === editedId
                ? {
                    ...al,
                    title: nextTitle,
                    artist: nextArtist,
                    release_year: nextYear,
                    cover_url: coverUrl,
                  }
                : al
            )
          );
          setTracks((prev) =>
            prev.map((t) => (t.album_id === editedId ? { ...t, album_name: nextTitle } : t))
          );
          setCatalogTracks((prev) =>
            prev.map((t) => (t.album_id === editedId ? { ...t, album_name: nextTitle } : t))
          );
          handleCancelEditAlbum();
          await syncFromBackend(searchQuery);
        }
        return;
      }

      const res = await musikweApi.postAction(
        'create.php',
        {
          action: 'create_album',
          title: nextTitle,
          artist: nextArtist,
          release_year: nextYear,
          cover_url: coverUrl,
        },
        authOpts
      );
      showToast(res.message || 'Album berhasil dibuat.');
      if (res.success) {
        handleCancelEditAlbum();
        await syncFromBackend(searchQuery);
      }
    });
  };

  const handleDeleteAlbum = async (al: MusikweAlbum) => {
    if (!isSuperAdmin || !al.id) return;
    const confirmKey = `alb_${al.id}`;
    if (confirmDeleteId !== confirmKey) {
      setConfirmDeleteId(confirmKey);
      return;
    }
    setConfirmDeleteId(null);
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'delete_album', id: al.id },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal menghapus album.');
        return;
      }
      setAlbums((prev) => prev.filter((item) => item.id !== al.id));
      if (editingAlbumId === al.id) {
        handleCancelEditAlbum();
      }
      showToast(res.message || `Album "${al.title}" dihapus.`);
      await syncFromBackend(searchQuery);
    });
  };

  const handleUpdateLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const manualUrl = logoUrlInput.trim();
    if (!logoFile && !manualUrl) {
      showToast('Pilih file logo atau masukkan URL logo terlebih dahulu.');
      return;
    }
    await runMutation(async () => {
      let finalLogoUrl = manualUrl;
      if (logoFile) {
        showToast('Mengunggah logo .MUSIKWE...');
        const up = await musikweApi.uploadFile(logoFile, authOpts);
        if (!up.success || !up.url) {
          showToast(up.message || 'Gagal upload logo.');
          return;
        }
        finalLogoUrl = up.url;
      }
      const res = await musikweApi.postAction(
        'update.php',
        { action: 'update_logo', logo_url: finalLogoUrl },
        authOpts
      );
      showToast(res.message || 'Logo .MUSIKWE berhasil diperbarui.');
      if (res.success) {
        setLogoUrl(finalLogoUrl);
        setLogoFile(null);
        setLogoUrlInput('');
        if (logoFileInputRef.current) logoFileInputRef.current.value = '';
        await syncFromBackend(searchQuery, true);
      }
    });
  };

  const handleResetLogo = async () => {
    if (!isSuperAdmin) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'update.php',
        { action: 'update_logo', logo_url: '' },
        authOpts
      );
      showToast(res.message || 'Logo dikembalikan ke default .MUSIKWE.');
      if (res.success) {
        setLogoUrl('');
        setLogoFile(null);
        setLogoUrlInput('');
        if (logoFileInputRef.current) logoFileInputRef.current.value = '';
        await syncFromBackend(searchQuery, true);
      }
    });
  };

  const handleBulkFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const batch: BulkUploadItem[] = files.map((file, idx) => {
      const meta = parseAudioFilenameMeta(file.name, bulkDefaultArtist);
      return {
        uid: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        title: meta.title,
        artist: meta.artist,
        duration: 200,
        status: 'pending',
      };
    });

    setBulkItems((prev) => [...prev, ...batch]);

    await Promise.all(
      batch.map(async (entry) => {
        const dur = await readAudioFileDuration(entry.file);
        setBulkItems((prev) =>
          prev.map((item) => (item.uid === entry.uid ? { ...item, duration: dur } : item))
        );
      })
    );
  };

  const handleApplyBulkDefaultArtist = () => {
    const nextArtist = bulkDefaultArtist.trim();
    if (!nextArtist) return;
    setBulkItems((prev) =>
      prev.map((item) => (item.status === 'done' ? item : { ...item, artist: nextArtist }))
    );
    showToast(`Artis "${nextArtist}" diterapkan ke semua baris.`);
  };

  const handleBulkUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin || bulkUploading) return;
    const pendingItems = bulkItems.filter((item) => item.status !== 'done');
    if (pendingItems.length === 0) {
      showToast('Pilih minimal 1 file audio untuk diunggah.');
      return;
    }

    setBulkUploading(true);
    beginLoading();
    try {
      const alObj = albums.find((al) => String(al.id) === String(bulkAlbumId));
      let sharedCoverUrl = bulkCoverUrl.trim() || alObj?.cover_url || '';

      if (bulkCoverFile) {
        showToast('Mengunggah cover default bulk upload...');
        const upCover = await musikweApi.uploadFile(bulkCoverFile, authOpts);
        if (!upCover.success || !upCover.url) {
          showToast(upCover.message || 'Gagal mengunggah cover default.');
          return;
        }
        sharedCoverUrl = upCover.url;
      }

      let successCount = 0;
      for (const entry of pendingItems) {
        setBulkItems((prev) =>
          prev.map((item) =>
            item.uid === entry.uid ? { ...item, status: 'uploading', errorMsg: undefined } : item
          )
        );

        let uploadedUrl = '';
        try {
          const upAudio = await musikweApi.uploadFile(entry.file, authOpts);
          if (!upAudio.success || !upAudio.url) {
            setBulkItems((prev) =>
              prev.map((item) =>
                item.uid === entry.uid
                  ? {
                      ...item,
                      status: 'error',
                      errorMsg: upAudio.message || 'Gagal upload file audio.',
                    }
                  : item
              )
            );
            continue;
          }
          uploadedUrl = upAudio.url;
        } catch (err: any) {
          setBulkItems((prev) =>
            prev.map((item) =>
              item.uid === entry.uid
                ? {
                    ...item,
                    status: 'error',
                    errorMsg: err?.message || 'Gagal upload file audio.',
                  }
                : item
            )
          );
          continue;
        }

        setBulkItems((prev) =>
          prev.map((item) => (item.uid === entry.uid ? { ...item, status: 'saving' } : item))
        );

        try {
          const res = await musikweApi.postAction(
            'create.php',
            {
              action: 'create_track',
              title: entry.title.trim() || 'Tanpa Judul',
              artist:
                entry.artist.trim() || bulkDefaultArtist.trim() || 'Artis Tidak Diketahui',
              album_id: Number(bulkAlbumId || 0),
              album_name: alObj ? alObj.title : '',
              audio_url: uploadedUrl,
              cover_url: sharedCoverUrl,
              duration: Math.max(15, Number(entry.duration) || 200),
              youtube_id: '',
              lyrics: '',
            },
            authOpts
          );
          if (!res.success) {
            setBulkItems((prev) =>
              prev.map((item) =>
                item.uid === entry.uid
                  ? {
                      ...item,
                      status: 'error',
                      errorMsg: res.message || 'Gagal menyimpan ke database.',
                    }
                  : item
              )
            );
            continue;
          }
          successCount += 1;
          setBulkItems((prev) =>
            prev.map((item) =>
              item.uid === entry.uid ? { ...item, status: 'done', errorMsg: undefined } : item
            )
          );
        } catch (err: any) {
          setBulkItems((prev) =>
            prev.map((item) =>
              item.uid === entry.uid
                ? {
                    ...item,
                    status: 'error',
                    errorMsg: err?.message || 'Gagal menyimpan metadata lagu.',
                  }
                : item
            )
          );
        }
      }

      if (successCount > 0) {
        if (bulkCoverFile) {
          setBulkCoverFile(null);
          if (bulkCoverInputRef.current) bulkCoverInputRef.current.value = '';
        }
        await syncFromBackend(searchQuery);
      }
      showToast(
        `${successCount} dari ${pendingItems.length} lagu berhasil diunggah dan disimpan.`
      );
    } finally {
      endLoading();
      setBulkUploading(false);
    }
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
    if (!isSuperAdmin || !trackId) return;
    await runMutation(async () => {
      const res = await musikweApi.postAction(
        'delete.php',
        { action: 'delete_track', id: trackId },
        authOpts
      );
      if (!res.success) {
        showToast(res.message || 'Gagal menghapus lagu dari database.');
        return;
      }
      purgeTrackLocally(trackId);
      await syncFromBackend(searchQuery);
      showToast(res.message || 'Lagu dihapus dari database.');
    });
  };

  const localSearchTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = catalogTracks.length > 0 ? catalogTracks : tracks;
    if (!q) return source;
    return source.filter(
      (t) =>
        String(t?.t || '').toLowerCase().includes(q) ||
        String(t?.a || '').toLowerCase().includes(q) ||
        String(t?.album_name || '').toLowerCase().includes(q) ||
        String(t?.ly || '').toLowerCase().includes(q)
    );
  }, [searchQuery, catalogTracks, tracks]);

  const hotTracks = useMemo(() => {
    return [...tracks].sort(
      (a, b) =>
        requests.filter((r) => r.tid === b.id).length -
        requests.filter((r) => r.tid === a.id).length
    );
  }, [tracks, requests]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId]
  );

  const safeExtYoutube = Array.isArray(extYoutube) ? extYoutube : [];
  const safeExtItunes = Array.isArray(extItunes) ? extItunes : [];
  const safeReqItunesResults = Array.isArray(reqItunesResults) ? reqItunesResults : [];
  const safeBulkItems = Array.isArray(bulkItems) ? bulkItems : [];
  const activePlaylistIds = Array.isArray(activePlaylist?.ids) ? activePlaylist.ids : [];
  const detailTrackComments = Array.isArray(commentsMap[String(detailTrack?.id ?? 0)])
    ? commentsMap[String(detailTrack?.id ?? 0)]
    : [];

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
          {isSuperAdmin && t.id > 0 && (
            <button
              type="button"
              className="mw-ib"
              title="Hapus lagu dari database"
              aria-label="Hapus lagu"
              style={{ color: '#f87171' }}
              onClick={() => handleDeleteTrack(t.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
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
            {logoUrl && !logoImgError ? (
              <img
                src={logoUrl}
                alt=".MUSIKWE"
                className="mw-logo-img"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgError(true)}
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
                      <small className="mw-num">{(Array.isArray(p.ids) ? p.ids : []).length} lagu</small>
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

              {safeExtYoutube.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="mw-mu mw-small" style={{ marginBottom: 8, fontWeight: 700 }}>
                    YOUTUBE
                  </div>
                  {safeExtYoutube.map((yt) => {
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

              {safeExtItunes.length > 0 ? (
                <div>
                  <div className="mw-mu mw-small" style={{ marginBottom: 8, fontWeight: 700 }}>
                    ITUNES MUSIC (KLIK UNTUK PUTAR VIA YOUTUBE / REQUEST KE ANTREAN)
                  </div>
                  {safeExtItunes.map((it, idx) => {
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
                      <small className="mw-num">{(Array.isArray(p.ids) ? p.ids : []).length} lagu</small>
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

                  {activePlaylistIds.length > 0 ? (
                    activePlaylistIds.map((tid) => {
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
                      track={findTrack(activePlaylistIds[0] || 0)}
                      sizeClass="xl"
                    />
                    <div>
                      <small className="mw-mu" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                        PLAYLIST
                      </small>
                      <h1 className="mw-at">{activePlaylist.n}</h1>
                      <p className="mw-mu mw-num">
                        {activePlaylistIds.length} lagu ·{' '}
                        {fmtTime(
                          activePlaylistIds.reduce((acc, tid) => acc + (findTrack(tid)?.d || 0), 0)
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

                  {activePlaylistIds.length > 0 ? (
                    activePlaylistIds.map((tid, idx) => {
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
              <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                <h3>Request Lagu ke Admin &amp; Antrean</h3>
                <form className="mw-fm" onSubmit={handleSubmitManualRequest}>
                  <input
                    value={reqFormTitle}
                    onChange={(e) => setReqFormTitle(e.target.value)}
                    placeholder="Judul lagu (wajib)"
                    required
                  />
                  <input
                    value={reqFormArtist}
                    onChange={(e) => setReqFormArtist(e.target.value)}
                    placeholder="Nama artis (wajib)"
                    required
                  />
                  <input
                    value={reqFormYoutube}
                    onChange={(e) => setReqFormYoutube(e.target.value)}
                    placeholder="Link YouTube (opsional)"
                  />
                  <button type="submit" className="mw-btn">
                    <Plus size={15} />
                    <span>Kirim Request Lagu</span>
                  </button>
                </form>

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid var(--mw-ln)',
                  }}
                >
                  <div className="mw-mu mw-small" style={{ marginBottom: 8, fontWeight: 700 }}>
                    Pencarian Cepat iTunes
                  </div>
                  <form className="mw-fm" onSubmit={handleReqItunesSearch}>
                    <input
                      value={reqItunesQuery}
                      onChange={(e) => setReqItunesQuery(e.target.value)}
                      placeholder="Cari judul lagu atau artis di iTunes..."
                    />
                    {reqItunesQuery && (
                      <button
                        type="button"
                        className="mw-btn sm g"
                        onClick={() => {
                          setReqItunesQuery('');
                          setReqItunesResults([]);
                        }}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      className="mw-btn sm"
                      disabled={reqItunesSearching}
                    >
                      {reqItunesSearching ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Search size={14} />
                      )}
                      <span>Cari iTunes</span>
                    </button>
                  </form>

                  {safeReqItunesResults.length > 0 && (
                    <div
                      style={{
                        maxHeight: 280,
                        overflowY: 'auto',
                        marginTop: 10,
                        borderTop: '1px solid var(--mw-ln)',
                        paddingTop: 8,
                      }}
                    >
                      {safeReqItunesResults.map((it, idx) => {
                        const rowKey = `req_it_${it.trackId || idx}`;
                        const isResolving = resolvingExtKey === rowKey;
                        return (
                          <div
                            key={rowKey}
                            className="mw-row"
                            style={{ padding: '6px 8px' }}
                          >
                            <CoverThumb
                              track={{ t: it.title, img: it.cover_url, h: 210 }}
                            />
                            <div className="mw-i">
                              <div className="mw-tt">{it.title}</div>
                              <div className="mw-mu mw-small mw-num">
                                {it.artist}
                                {it.album ? ` · ${it.album}` : ''} ·{' '}
                                {fmtTime(it.duration_sec)}
                              </div>
                            </div>
                            <div
                              className="mw-ac"
                              style={{ opacity: 1 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="mw-btn sm"
                                disabled={isResolving}
                                onClick={() => handleRequestExternalItem(it, rowKey)}
                              >
                                {isResolving ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Heart size={13} />
                                )}
                                <span>Request ke Antrean</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <h2 className="mw-h2" style={{ margin: 0 }}>
                  Antrean request
                </h2>
                <button
                  type="button"
                  className={`mw-btn sm ${autoPlayQueue ? '' : 'g'}`}
                  onClick={() => toggleAutoPlayQueue()}
                  title="Aktifkan/matikan pemutaran otomatis antrean berikutnya"
                >
                  <Repeat size={13} />
                  <span>Auto-Play: {autoPlayQueue ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              {sortedRequests.length > 0 ? (
                <table className="mw-table">
                  <thead>
                    <tr>
                      <th>Lagu</th>
                      <th>Diminta oleh</th>
                      <th>Waktu</th>
                      <th>Suara</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRequests.map((rq, idx) => {
                      const t = resolveRequestTrack(rq);
                      const votes = Array.isArray(rq.v) ? rq.v : [];
                      const hasVoted = votes.includes(who());
                      const canModerate = isOwnRequest(rq.by, rq.user_email);
                      const isActiveReq = activeRequestId === rq.id;
                      return (
                        <tr key={rq.id}>
                          <td>
                            <b className="mw-num">
                              {idx + 1}. {t.t}
                            </b>
                            {isActiveReq && (
                              <span
                                className="mw-small"
                                style={{
                                  marginLeft: 8,
                                  color: 'var(--mw-ac)',
                                  fontWeight: 700,
                                }}
                              >
                                Sedang diputar
                              </span>
                            )}
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
                              <span>{votes.length}</span>
                            </button>
                          </td>
                          <td>
                            {canModerate && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <button
                                  type="button"
                                  className="mw-ib"
                                  aria-label="Lompati / Putar Sekarang"
                                  title="Lompati / Putar Sekarang"
                                  onClick={() => skipToRequest(rq)}
                                >
                                  <Play size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="mw-ib"
                                  aria-label="Hapus request"
                                  title="Hapus request"
                                  style={{ color: '#f87171' }}
                                  onClick={() => handleDeleteRequest(rq.id, canModerate, rq.tid)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="mw-mu">
                  Belum ada request di antrean database. Kirim form di atas atau pilih lagu di
                  bawah.
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginTop: 26,
                  marginBottom: 12,
                }}
              >
                <h2 className="mw-h2" style={{ margin: 0 }}>
                  Riwayat Request
                </h2>
                {requestHistory.length > 0 && (
                  <button
                    type="button"
                    className="mw-btn sm g"
                    onClick={handleClearRequestHistory}
                  >
                    <Trash2 size={13} />
                    <span>Hapus Riwayat</span>
                  </button>
                )}
              </div>

              {requestHistory.length > 0 ? (
                <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                  {requestHistory.map((item) => {
                    const canDelete = isOwnRequest(item.by, item.user_email);
                    return (
                      <div
                        key={`hist_${item.id}`}
                        className="mw-row"
                        style={{ cursor: 'default' }}
                      >
                        <CoverThumb
                          track={{
                            t: item.title,
                            img:
                              item.cover_url ||
                              (item.youtube_id
                                ? `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`
                                : ''),
                            h: 210,
                          }}
                        />
                        <div className="mw-i">
                          <div className="mw-tt">{item.title}</div>
                          <div className="mw-mu mw-small mw-num">
                            {item.artist} · oleh {item.by} · {fmtAgo(item.ts)}
                            {item.status ? ` · ${item.status}` : ''}
                          </div>
                        </div>
                        {canDelete && (
                          <div className="mw-ac" style={{ opacity: 1 }}>
                            <button
                              type="button"
                              className="mw-ib"
                              aria-label="Hapus item riwayat"
                              title="Hapus item riwayat"
                              style={{ color: '#f87171' }}
                              onClick={() => handleDeleteRequest(item.id, canDelete, item.tid)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mw-mu mw-small" style={{ marginBottom: 22 }}>
                  Belum ada riwayat request.
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <h2 className="mw-h2" style={{ margin: 0 }}>
                  History Pendengaran Hari Ini ({todayHistory.length})
                </h2>
                {isSuperAdmin && todayHistory.length > 0 && (
                  <button
                    type="button"
                    className="mw-btn sm g"
                    onClick={() => clearTodayHistory()}
                  >
                    <Trash2 size={13} />
                    <span>Bersihkan History</span>
                  </button>
                )}
              </div>

              {todayHistory.length > 0 ? (
                <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                  {todayHistory.map((item) => (
                    <div
                      key={`today_req_${item.id}_${item.played_at}`}
                      className="mw-row"
                      onClick={() => playHistoryTrack(item)}
                    >
                      <CoverThumb
                        track={{
                          t: item.title,
                          img:
                            item.cover_url ||
                            (item.youtube_id
                              ? `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`
                              : ''),
                          h: 210,
                        }}
                      />
                      <div className="mw-i">
                        <div className="mw-tt">{item.title}</div>
                        <div className="mw-mu mw-small mw-num">
                          {item.artist}
                          {item.requested_by ? ` · Request: ${item.requested_by}` : ''}
                          {` · Diputar ${fmtClockTime(item.played_at)}`}
                        </div>
                      </div>
                      <span className="mw-mu mw-small mw-num" style={{ flexShrink: 0 }}>
                        {fmtClockTime(item.played_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mw-mu mw-small" style={{ marginBottom: 22 }}>
                  Belum ada lagu yang selesai diputar hari ini.
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
                  Komentar ({detailTrackComments.length})
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
                  {detailTrackComments.map((cm, idx) => (
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
                      {(safeExtYoutube.length > 0 || safeExtItunes.length > 0) && (
                        <div
                          style={{
                            maxHeight: 200,
                            overflowY: 'auto',
                            marginTop: 10,
                            borderTop: '1px solid var(--mw-ln)',
                            paddingTop: 8,
                          }}
                        >
                          {safeExtYoutube.slice(0, 6).map((yt) => (
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
                          {safeExtItunes.slice(0, 6).map((it, idx) => (
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
                    <div className="mw-adm-card" ref={albumFormCardRef}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <h3 style={{ margin: 0 }}>
                          {editingAlbumId ? '3. Edit Album Terpilih' : '3. Buat Album Baru'}
                        </h3>
                        {editingAlbumId && (
                          <button
                            type="button"
                            className="mw-btn sm g"
                            onClick={handleCancelEditAlbum}
                          >
                            Batal Edit
                          </button>
                        )}
                      </div>
                      <form className="mw-fm" onSubmit={handleSaveAlbum}>
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
                          value={albumCoverUrlInput}
                          onChange={(e) => setAlbumCoverUrlInput(e.target.value)}
                          placeholder="URL cover album (opsional)"
                        />
                        <input
                          ref={albumCoverInputRef}
                          type="file"
                          accept="image/*"
                          title="Upload file cover album"
                          onChange={(e) => setAlbumCoverFile(e.target.files?.[0] || null)}
                        />
                        <button type="submit" className="mw-btn sm">
                          <Plus size={14} />{' '}
                          {editingAlbumId ? 'Simpan Perubahan Album' : 'Simpan Album'}
                        </button>
                      </form>
                    </div>

                    <div className="mw-adm-card">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <h3 style={{ margin: 0 }}>4. Upload &amp; Perbarui Logo .MUSIKWE</h3>
                        {logoUrl && (
                          <button
                            type="button"
                            className="mw-btn sm g"
                            onClick={handleResetLogo}
                            title="Kembalikan ke logo teks default .MUSIKWE"
                          >
                            <RotateCcw size={13} /> Reset Default
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          marginBottom: 12,
                          borderRadius: 12,
                          border: '1px solid var(--mw-ln)',
                          background: 'var(--mw-pan)',
                        }}
                      >
                        {logoFilePreviewUrl || logoUrlInput.trim() || logoUrl ? (
                          <img
                            src={logoFilePreviewUrl || logoUrlInput.trim() || logoUrl}
                            alt="Preview Logo .MUSIKWE"
                            referrerPolicy="no-referrer"
                            style={{
                              height: 36,
                              maxWidth: 150,
                              objectFit: 'contain',
                              borderRadius: 6,
                            }}
                          />
                        ) : (
                          <span className="mw-brand-mark" style={{ fontSize: 16 }}>
                            <Disc3 size={18} className="mw-brand-dot" />
                            <span>
                              <span className="mw-brand-dot">.</span>MUSIKWE
                            </span>
                          </span>
                        )}
                        <span className="mw-mu mw-small">
                          {logoFile
                            ? `File siap diunggah: ${logoFile.name}`
                            : logoUrlInput.trim()
                            ? 'Preview dari URL baru'
                            : logoUrl
                            ? 'Logo aktif tersimpan di MySQL'
                            : 'Menggunakan logo default'}
                        </span>
                      </div>

                      <form className="mw-fm" onSubmit={handleUpdateLogo}>
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        />
                        <input
                          value={logoUrlInput}
                          onChange={(e) => setLogoUrlInput(e.target.value)}
                          placeholder="Atau tempel URL logo (PNG/JPG/WEBP/SVG)"
                        />
                        <button type="submit" className="mw-btn sm">
                          <Upload size={14} /> Simpan Logo Real-Time
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Album List Management */}
                  <div className="mw-adm-card" style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>
                        Daftar Album di Database ({albums.length})
                      </h3>
                      <span className="mw-mu mw-small">
                        Edit judul, artis, tahun, cover, atau hapus album
                      </span>
                    </div>

                    {albums.length > 0 ? (
                      <div className="mw-album-grid">
                        {albums.map((al) => {
                          const trackCount = tracks.filter((t) => t.album_id === al.id).length;
                          const isEditingThis = editingAlbumId === al.id;
                          const isConfirmDel = confirmDeleteId === `alb_${al.id}`;
                          return (
                            <div
                              key={`adm_alb_${al.id}`}
                              className="mw-album-card"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 10,
                                borderColor: isEditingThis ? 'var(--mw-ac)' : undefined,
                                cursor: 'default',
                              }}
                            >
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                                onClick={() => setView('alb')}
                              >
                                <CoverThumb
                                  track={{ t: al.title, img: al.cover_url || '', h: 260 }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="mw-tt" style={{ fontSize: 13.5 }}>
                                    {al.title}
                                  </div>
                                  <div className="mw-mu mw-small" style={{ marginTop: 2 }}>
                                    {al.artist} · {al.release_year || 'Baru'}
                                  </div>
                                  <div className="mw-mu mw-small mw-num" style={{ marginTop: 2 }}>
                                    {trackCount} lagu
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  type="button"
                                  className="mw-btn sm g"
                                  style={{ flex: 1, justifyContent: 'center' }}
                                  onClick={() => handleEditAlbumFill(al)}
                                >
                                  <Pencil size={13} /> Edit Album
                                </button>
                                <button
                                  type="button"
                                  className="mw-btn sm g"
                                  style={{
                                    color: '#f87171',
                                    borderColor: isConfirmDel
                                      ? 'rgba(248, 113, 113, 0.7)'
                                      : undefined,
                                    background: isConfirmDel
                                      ? 'rgba(248, 113, 113, 0.14)'
                                      : undefined,
                                  }}
                                  onClick={() => handleDeleteAlbum(al)}
                                >
                                  <Trash2 size={13} />{' '}
                                  {isConfirmDel ? 'Yakin Hapus?' : 'Hapus Album'}
                                </button>
                                {isConfirmDel && (
                                  <button
                                    type="button"
                                    className="mw-btn sm g"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Batal
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mw-empty-box">
                        Belum ada album tersimpan di database.
                      </div>
                    )}
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

                  {/* Bulk Upload Multi-Track Card */}
                  <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 12,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>
                        6. Upload Banyak Lagu Sekaligus (Bulk Upload)
                      </h3>
                      {bulkItems.length > 0 && (
                        <button
                          type="button"
                          className="mw-btn sm g"
                          disabled={bulkUploading}
                          onClick={() => setBulkItems([])}
                        >
                          Bersihkan Daftar ({bulkItems.length})
                        </button>
                      )}
                    </div>

                    <form className="mw-fm" onSubmit={handleBulkUploadSubmit}>
                      <select
                        value={bulkAlbumId}
                        onChange={(e) => setBulkAlbumId(e.target.value)}
                        disabled={bulkUploading}
                      >
                        <option value="0">Single (Tanpa Album)</option>
                        {albums.map((al) => (
                          <option key={`bulk_al_${al.id}`} value={al.id}>
                            Album: {al.title} ({al.artist})
                          </option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', gap: 6, flex: '1 1 220px' }}>
                        <input
                          value={bulkDefaultArtist}
                          onChange={(e) => setBulkDefaultArtist(e.target.value)}
                          placeholder="Artis default (opsional)"
                          disabled={bulkUploading}
                        />
                        {bulkItems.length > 0 && bulkDefaultArtist.trim() && (
                          <button
                            type="button"
                            className="mw-btn sm g"
                            disabled={bulkUploading}
                            onClick={handleApplyBulkDefaultArtist}
                          >
                            Terapkan
                          </button>
                        )}
                      </div>

                      <input
                        value={bulkCoverUrl}
                        onChange={(e) => setBulkCoverUrl(e.target.value)}
                        placeholder="URL cover default (opsional)"
                        disabled={bulkUploading}
                      />

                      <input
                        ref={bulkCoverInputRef}
                        type="file"
                        accept="image/*"
                        title="Upload cover gambar default untuk semua lagu"
                        disabled={bulkUploading}
                        onChange={(e) => setBulkCoverFile(e.target.files?.[0] || null)}
                      />

                      <input
                        ref={bulkAudioInputRef}
                        type="file"
                        multiple
                        accept="audio/*,.mp3,.wav,.m4a,.ogg"
                        title="Pilih banyak file audio sekaligus"
                        disabled={bulkUploading}
                        onChange={handleBulkFilesSelected}
                        style={{ flexBasis: '100%' }}
                      />

                      {safeBulkItems.length > 0 && (
                        <div
                          style={{
                            flexBasis: '100%',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            maxHeight: 340,
                            overflowY: 'auto',
                            padding: 10,
                            borderRadius: 12,
                            border: '1px solid var(--mw-ln)',
                            background: 'var(--mw-pan)',
                          }}
                        >
                          {safeBulkItems.map((item, idx) => (
                            <div
                              key={item.uid}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: '1px solid var(--mw-ln)',
                                background: 'var(--mw-pan2)',
                              }}
                            >
                              <span
                                className="mw-mu mw-small mw-num"
                                style={{ minWidth: 24, fontWeight: 700 }}
                              >
                                {idx + 1}.
                              </span>
                              <input
                                value={item.title}
                                disabled={bulkUploading || item.status === 'done'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkItems((prev) =>
                                    prev.map((x) =>
                                      x.uid === item.uid ? { ...x, title: val } : x
                                    )
                                  );
                                }}
                                placeholder="Judul lagu"
                                style={{ flex: '1 1 160px', padding: '7px 10px', fontSize: 12.5 }}
                              />
                              <input
                                value={item.artist}
                                disabled={bulkUploading || item.status === 'done'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkItems((prev) =>
                                    prev.map((x) =>
                                      x.uid === item.uid ? { ...x, artist: val } : x
                                    )
                                  );
                                }}
                                placeholder="Artis"
                                style={{ flex: '1 1 140px', padding: '7px 10px', fontSize: 12.5 }}
                              />
                              <span className="mw-mu mw-small mw-num">
                                {fmtTime(item.duration)} ·{' '}
                                {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              <span
                                className="mw-small"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontWeight: 600,
                                  minWidth: 115,
                                  color:
                                    item.status === 'done'
                                      ? '#4ade80'
                                      : item.status === 'error'
                                      ? '#f87171'
                                      : item.status === 'uploading' || item.status === 'saving'
                                      ? 'var(--mw-ac)'
                                      : 'var(--mw-mu)',
                                }}
                                title={item.errorMsg || ''}
                              >
                                {item.status === 'done' && <Check size={13} />}
                                {item.status === 'error' && <AlertCircle size={13} />}
                                {(item.status === 'uploading' || item.status === 'saving') && (
                                  <Loader2 size={13} className="animate-spin" />
                                )}
                                <span>
                                  {item.status === 'pending'
                                    ? 'Menunggu'
                                    : item.status === 'uploading'
                                    ? 'Upload audio...'
                                    : item.status === 'saving'
                                    ? 'Simpan DB...'
                                    : item.status === 'done'
                                    ? 'Tersimpan'
                                    : 'Gagal'}
                                </span>
                              </span>
                              <button
                                type="button"
                                className="mw-ib"
                                disabled={
                                  item.status === 'uploading' || item.status === 'saving'
                                }
                                title="Hapus dari daftar upload"
                                aria-label="Hapus dari daftar"
                                onClick={() =>
                                  setBulkItems((prev) =>
                                    prev.filter((x) => x.uid !== item.uid)
                                  )
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div
                        style={{
                          flexBasis: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="submit"
                          className="mw-btn"
                          disabled={
                            bulkUploading ||
                            bulkItems.filter((item) => item.status !== 'done').length === 0
                          }
                        >
                          {bulkUploading ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Upload size={15} />
                          )}
                          <span>
                            {bulkUploading
                              ? 'Mengunggah & Menyimpan Lagu...'
                              : `Upload & Simpan Semua Lagu (${
                                  bulkItems.filter((item) => item.status !== 'done').length
                                })`}
                          </span>
                        </button>

                        {bulkItems.length > 0 && (
                          <span className="mw-mu mw-small mw-num">
                            Selesai: {bulkItems.filter((i) => i.status === 'done').length}/
                            {bulkItems.length}
                          </span>
                        )}
                      </div>
                    </form>
                  </div>

                  <h2 className="mw-h2">
                    Antrean Request Masuk ({sortedRequests.length})
                  </h2>
                  {sortedRequests.length > 0 ? (
                    <div className="mw-adm-card" style={{ marginBottom: 22 }}>
                      {sortedRequests.map((rq, idx) => {
                        const tr = resolveRequestTrack(rq);
                        const votes = Array.isArray(rq.v) ? rq.v : [];
                        return (
                          <div
                            key={`adm_req_${rq.id}`}
                            className="mw-row"
                            onClick={() => skipToRequest(rq)}
                          >
                            <CoverThumb track={tr} />
                            <div className="mw-i">
                              <div className="mw-tt">
                                {idx + 1}. {tr.t}
                              </div>
                              <div className="mw-mu mw-small mw-num">
                                {tr.a} · oleh {rq.by} · {fmtAgo(rq.ts)} · {votes.length} suara
                              </div>
                            </div>
                            <div
                              className="mw-ac"
                              style={{ opacity: 1 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="mw-ib"
                                title="Putar request"
                                aria-label="Putar request"
                                onClick={() => skipToRequest(rq)}
                              >
                                <Play size={15} />
                              </button>
                              <button
                                type="button"
                                className="mw-ib"
                                title="Hapus request"
                                aria-label="Hapus request"
                                style={{ color: '#f87171' }}
                                onClick={() => handleDeleteRequest(rq.id, true, rq.tid)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mw-empty-box" style={{ marginBottom: 22 }}>
                      Belum ada request lagu masuk dari pengguna.
                    </div>
                  )}

                  <h2 className="mw-h2">Kelola Lagu di Database ({tracks.length})</h2>
                  {tracks.length > 0 ? (
                    <div>
                      {tracks.map((t) =>
                        renderTrackRow(
                          t,
                          <button
                            type="button"
                            className="mw-ib"
                            title="Edit lagu"
                            aria-label="Edit lagu"
                            onClick={() => handleEditTrackFill(t)}
                          >
                            <Pencil size={15} />
                          </button>
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              margin: '16px 0 10px',
              flexWrap: 'wrap',
            }}
          >
            <h3 style={{ margin: 0 }}>
              <span>Antrean request</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mw-mu mw-small mw-num">{sortedRequests.length} lagu</span>
              <button
                type="button"
                className={`mw-btn sm ${autoPlayQueue ? '' : 'g'}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => toggleAutoPlayQueue()}
                title="Sakelar Auto-Play Antrean"
              >
                <Repeat size={12} />
                <span>Auto-Play: {autoPlayQueue ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {sortedRequests.length > 0 ? (
            sortedRequests.map((rq) => {
              const tr = resolveRequestTrack(rq);
              const votes = Array.isArray(rq.v) ? rq.v : [];
              const voted = votes.includes(who());
              const canModerate = isOwnRequest(rq.by, rq.user_email);
              const isActiveReq = activeRequestId === rq.id;
              return (
                <div
                  key={rq.id}
                  className={`mw-row ${isActiveReq ? 'on' : ''}`}
                  onClick={() => skipToRequest(rq)}
                >
                  <CoverThumb track={tr} />
                  <div className="mw-i">
                    <div className="mw-tt">{tr.t}</div>
                    <div className="mw-mu mw-small mw-num">
                      oleh {rq.by} · {fmtAgo(rq.ts)}
                    </div>
                  </div>
                  <div
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`mw-vote mw-num ${voted ? 'me' : ''}`}
                      onClick={() => handleToggleVote(rq.id)}
                      aria-label="Beri suara"
                    >
                      <ThumbsUp size={12} />
                      <span>{votes.length}</span>
                    </button>
                    {canModerate && (
                      <>
                        <button
                          type="button"
                          className="mw-ib"
                          style={{ width: 26, height: 26 }}
                          aria-label="Lompati / Putar Sekarang"
                          title="Lompati / Putar Sekarang"
                          onClick={() => skipToRequest(rq)}
                        >
                          <Play size={13} />
                        </button>
                        <button
                          type="button"
                          className="mw-ib"
                          style={{ width: 26, height: 26, color: '#f87171' }}
                          aria-label="Hapus request"
                          title="Hapus request"
                          onClick={() => handleDeleteRequest(rq.id, canModerate, rq.tid)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="mw-mu mw-small">Belum ada request. Jadilah yang pertama.</p>
          )}

          <h3>Berikutnya otomatis</h3>
          {autoNextCandidate ? (
            <div
              key={`autonext_${autoNextCandidate.source}_${autoNextCandidate.track.id}`}
              className="mw-row"
              onClick={() => {
                if (autoNextCandidate.request) {
                  skipToRequest(autoNextCandidate.request);
                } else {
                  loadAndPlayTrack(autoNextCandidate.track.id, true);
                }
              }}
            >
              <CoverThumb track={autoNextCandidate.track} />
              <div className="mw-i">
                <div className="mw-tt">{autoNextCandidate.track.t}</div>
                <div className="mw-mu mw-small">
                  {autoNextCandidate.track.a} ·{' '}
                  {autoNextCandidate.source === 'request'
                    ? `Antrean Request${autoNextCandidate.request?.by ? ` (${autoNextCandidate.request.by})` : ''}`
                    : 'Katalog Berikutnya'}
                </div>
              </div>
            </div>
          ) : (
            <p className="mw-mu mw-small">
              Semua lagu hari ini sudah diputar · Menunggu request baru
            </p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              margin: '16px 0 8px',
              flexWrap: 'wrap',
            }}
          >
            <h3 style={{ margin: 0 }}>
              History Pendengaran Hari Ini ({todayHistory.length})
            </h3>
            {isSuperAdmin && todayHistory.length > 0 && (
              <button
                type="button"
                className="mw-btn sm g"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => clearTodayHistory()}
                title="Bersihkan History Hari Ini"
              >
                <Trash2 size={12} />
                <span>Bersihkan History</span>
              </button>
            )}
          </div>
          {todayHistory.length > 0 ? (
            todayHistory.map((item) => (
              <div
                key={`today_side_${item.id}_${item.played_at}`}
                className="mw-row"
                onClick={() => playHistoryTrack(item)}
              >
                <CoverThumb
                  track={{
                    t: item.title,
                    img:
                      item.cover_url ||
                      (item.youtube_id
                        ? `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`
                        : ''),
                    h: 210,
                  }}
                />
                <div className="mw-i">
                  <div className="mw-tt">{item.title}</div>
                  <div className="mw-mu mw-small mw-num">
                    {item.artist} · {fmtClockTime(item.played_at)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="mw-mu mw-small">Belum ada lagu yang selesai diputar hari ini.</p>
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
                onClick={() => {
                  if (isLiveBroadcastActive && autoplayBlocked) {
                    joinLiveAudio();
                  } else {
                    togglePlayPause();
                  }
                }}
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
              <button
                type="button"
                className={`mw-btn sm ${autoPlayQueue ? '' : 'g'}`}
                style={{ padding: '4px 10px', fontSize: 11, marginLeft: 4 }}
                onClick={() => toggleAutoPlayQueue()}
                aria-label="Sakelar Auto-Play Antrean"
                title="Auto-Play Antrean Request"
              >
                <Repeat size={12} />
                <span>Auto-Play: {autoPlayQueue ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          <div className="mw-pr">
            {isLiveBroadcastActive && autoplayBlocked && (
              <button
                type="button"
                className="mw-btn sm"
                onClick={joinLiveAudio}
                style={{ marginRight: 6 }}
              >
                <Radio size={13} />
                <span>Dengarkan Live</span>
              </button>
            )}
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
              onClick={() => toggleLike(currentTrack.id)}
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
                onClick={() => {
                  if (isLiveBroadcastActive && autoplayBlocked) {
                    joinLiveAudio();
                  } else {
                    togglePlayPause();
                  }
                }}
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
