import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchWithTimeout, DEFAULT_REQUEST_TIMEOUT_MS } from '../utils/apiCache';
import { getStoredToken } from '../utils/api';

export interface FileItem {
  n: string;                  // resolved display name
  original_name?: string;     // original uploaded filename
  title?: string;             // optional title from API
  name?: string;              // optional name from API
  s: string;                  // formatted file size
  t: 'Gambar' | 'Video' | 'Dokumen'; // category
  src: string;                // full file URL
  c: [string, string];        // gradient colors fallback
}

interface UploadProgressState {
  fileName: string;
  sizeBytes: number;
  percent: number;
  chunkIndex?: number;
  totalChunks?: number;
  isChunked: boolean;
}

const GALERI_UPLOAD_ENDPOINT =
  'https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?action=upload';
const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

const PALETTE: [string, string][] = [
  ["#14502e", "#0a2a1a"],
  ["#1f6b3f", "#103a24"],
  ["#2b6fa8", "#143a5e"],
  ["#6b5b3a", "#2e2616"],
  ["#4a5a6a", "#1d2630"],
  ["#5a3a6b", "#241630"],
  ["#7a4a2a", "#331c0e"],
  ["#1d5a5a", "#0c2a2a"],
  ["#5a6b2a", "#262e0e"]
];

const INITIAL_GRID_PAGE_SIZE = 24;

function formatFileSizeMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.00 MB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getDisplayFileName(item: Partial<FileItem>): string {
  return String(item.original_name || item.title || item.name || item.n || 'Berkas').trim() || 'Berkas';
}

function sendUploadXhr(
  url: string,
  formData: FormData,
  token: string | null,
  onProgress: (loaded: number, total: number) => void,
  registerXhr: (xhr: XMLHttpRequest | null) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(ev.loaded, ev.total);
      }
    };

    xhr.onload = () => {
      registerXhr(null);
      const rawText = (xhr.responseText || '').trim();
      let parsed: any = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const serverDetail =
          parsed?.message ||
          parsed?.error ||
          (rawText && !rawText.startsWith('<') ? rawText.slice(0, 220) : '') ||
          xhr.statusText ||
          'Server menolak unggahan.';
        reject(new Error(`Error HTTP ${xhr.status}: ${serverDetail}`));
        return;
      }

      if (parsed && parsed.success === false) {
        reject(new Error(parsed.message || parsed.error || 'Gagal mengunggah berkas ke server.'));
        return;
      }

      resolve(parsed || { success: true });
    };

    xhr.onerror = () => {
      registerXhr(null);
      reject(new Error('Terjadi kesalahan jaringan saat mengunggah berkas.'));
    };

    xhr.onabort = () => {
      registerXhr(null);
      reject(new Error('Unggahan berkas dibatalkan.'));
    };

    xhr.send(formData);
  });
}

export const GaleriBerkasView: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Semua');
  const [visibleGridCount, setVisibleGridCount] = useState<number>(INITIAL_GRID_PAGE_SIZE);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadCancelledRef = useRef<boolean>(false);

  // 1. Fetch data berkas asli dari endpoint JSON LaporanWe dengan timeout & auth
  const loadFiles = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setLoadError(null);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetchWithTimeout(
        'https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?format=json',
        { headers, signal: controller.signal },
        DEFAULT_REQUEST_TIMEOUT_MS
      );
      if (!res.ok) {
        throw new Error(`Gagal memuat galeri berkas (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const formatted: FileItem[] = json.data.map((f: any, idx: number) => {
          const originalName = f.original_name ? String(f.original_name).trim() : undefined;
          const titleVal = f.title ? String(f.title).trim() : undefined;
          const nameVal = f.name ? String(f.name).trim() : undefined;
          const rawN = f.n ? String(f.n).trim() : undefined;
          const displayName = originalName || titleVal || nameVal || rawN || 'Berkas';

          const extSource = String(originalName || nameVal || rawN || f.src || f.url || displayName)
            .split('?')[0];
          const ext = (extSource.split('.').pop() || '').toLowerCase();
          let type: 'Gambar' | 'Video' | 'Dokumen' = 'Dokumen';
          if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) {
            type = 'Gambar';
          } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
            type = 'Video';
          } else if (f.t === 'Gambar' || f.t === 'Video' || f.t === 'Dokumen') {
            type = f.t;
          }

          return {
            n: displayName,
            original_name: originalName,
            title: titleVal,
            name: nameVal,
            s:
              f.s ||
              f.size_formatted ||
              (f.size
                ? f.size > 1048576
                  ? `${(f.size / 1048576).toFixed(1)} MB`
                  : `${Math.round(f.size / 1024)} KB`
                : '1.0 MB'),
            t: type,
            src: f.src || f.url || '',
            c: f.c && Array.isArray(f.c) ? f.c : PALETTE[idx % PALETTE.length]
          };
        });
        setFiles(formatted);
      } else {
        setFiles([]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setLoadError(err?.message || 'Tidak dapat memuat data galeri berkas dari server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    return () => {
      abortControllerRef.current?.abort();
      uploadCancelledRef.current = true;
      activeUploadXhrRef.current?.abort();
    };
  }, [loadFiles]);

  // Reset pagination when filter tab changes
  useEffect(() => {
    setVisibleGridCount(INITIAL_GRID_PAGE_SIZE);
  }, [activeTab]);

  // 2. Tab Filter & Hitung Counter Dinamis
  const tabs = ['Semua', 'Gambar', 'Video', 'Dokumen'];
  const counts = useMemo(() => {
    const c: Record<string, number> = { Semua: files.length, Gambar: 0, Video: 0, Dokumen: 0 };
    for (const f of files) {
      if (c[f.t] !== undefined) c[f.t]++;
    }
    return c;
  }, [files]);

  const filteredList = useMemo(() => {
    if (activeTab === 'Semua') return files;
    return files.filter(f => f.t === activeTab);
  }, [files, activeTab]);

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    activeUploadXhrRef.current?.abort();
  };

  // 3. Upload Berkas Baru (Direct XHR <= 2 MB, Chunked Upload 2 MB untuk > 2 MB)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getStoredToken();
    const isChunked = file.size > CHUNK_SIZE;
    const totalChunks = isChunked ? Math.ceil(file.size / CHUNK_SIZE) : 1;

    uploadCancelledRef.current = false;
    setIsUploading(true);
    setActionNotice(null);
    setUploadProgress({
      fileName: file.name,
      sizeBytes: file.size,
      percent: 0,
      chunkIndex: isChunked ? 0 : undefined,
      totalChunks: isChunked ? totalChunks : undefined,
      isChunked,
    });

    try {
      if (!isChunked) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        fd.append('original_name', file.name);

        await sendUploadXhr(
          GALERI_UPLOAD_ENDPOINT,
          fd,
          token,
          (loaded, total) => {
            const denom = total > 0 ? total : file.size || 1;
            const pct = Math.min(100, Math.max(0, Math.round((loaded / denom) * 100)));
            setUploadProgress((prev) => (prev ? { ...prev, percent: pct } : prev));
          },
          (xhr) => {
            activeUploadXhrRef.current = xhr;
          }
        );

        setUploadProgress((prev) => (prev ? { ...prev, percent: 100 } : prev));
      } else {
        const uploadId = `gb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          if (uploadCancelledRef.current) {
            throw new Error('Unggahan berkas dibatalkan.');
          }

          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunkBlob = file.slice(start, end);

          setUploadProgress((prev) =>
            prev ? { ...prev, chunkIndex, totalChunks } : prev
          );

          const fd = new FormData();
          fd.append('file', chunkBlob, file.name);
          fd.append('original_name', file.name);
          fd.append('upload_id', uploadId);
          fd.append('chunk_index', String(chunkIndex));
          fd.append('total_chunks', String(totalChunks));

          await sendUploadXhr(
            GALERI_UPLOAD_ENDPOINT,
            fd,
            token,
            (loaded, total) => {
              const chunkFraction = total > 0 ? Math.min(1, Math.max(0, loaded / total)) : 0;
              const bytesSent = Math.min(file.size, start + chunkFraction * chunkBlob.size);
              const pct = Math.min(100, Math.max(0, Math.round((bytesSent / file.size) * 100)));
              setUploadProgress((prev) =>
                prev ? { ...prev, percent: pct, chunkIndex, totalChunks } : prev
              );
            },
            (xhr) => {
              activeUploadXhrRef.current = xhr;
            }
          );

          const chunkDonePct = Math.min(100, Math.round((end / file.size) * 100));
          setUploadProgress((prev) =>
            prev ? { ...prev, percent: chunkDonePct, chunkIndex, totalChunks } : prev
          );
        }
      }

      await loadFiles();
    } catch (err: any) {
      setActionNotice(err?.message || 'Terjadi kesalahan saat mengunggah berkas.');
    } finally {
      activeUploadXhrRef.current = null;
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const featItem = filteredList[0];
  const gridItems = filteredList.slice(1);
  const visibleGridItems = useMemo(
    () => gridItems.slice(0, visibleGridCount),
    [gridItems, visibleGridCount]
  );
  const remainingCount = Math.max(0, gridItems.length - visibleGridItems.length);

  return (
    <div className="gb-container w-full min-w-0 min-h-screen overflow-x-hidden bg-transparent">
      {/* SCOPED CSS FROM ORIGINAL TEMPLATE (Exact Layout & Override Protection) */}
      <style>{`
        .gb-container {
          --bg: transparent;
          --card: #ffffff;
          --ink: #0d0d0d;
          --mute: #7a7a7a;
          --pill: #f1f1f1;
          --ring: rgba(255,255,255,.9);
          --sh: 0 6px 24px rgba(0,0,0,.07);
          --btn: #0d0d0d;
          --btnt: #ffffff;
          font-family: "Plus Jakarta Sans", "Inter", -apple-system, sans-serif;
          letter-spacing: -0.01em;
          color: var(--ink);
          box-sizing: border-box;
        }

        [data-theme="dark"] .gb-container,
        .dark .gb-container {
          --card: #1f1d2b;
          --ink: #f2f0fa;
          --mute: #9a97ad;
          --pill: rgba(255,255,255,.12);
          --ring: rgba(255,255,255,.05);
          --btn: #f2f0fa;
          --btnt: #0d0d0d;
          --sh: 0 6px 24px rgba(0,0,0,.45);
        }

        .gb-wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 10px 20px 80px;
          box-sizing: border-box;
          width: 100%;
        }

        .gb-hero {
          text-align: center;
          padding: 32px 0 16px;
        }

        .gb-hero h1 {
          font-size: clamp(34px, 6vw, 68px);
          line-height: 1;
          letter-spacing: -0.05em;
          margin: 0;
          font-weight: 800;
          color: var(--ink);
          text-transform: uppercase;
        }

        .gb-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin: 28px 0 24px;
        }

        .gb-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .gb-tab {
          border: 0;
          background: transparent;
          color: var(--mute);
          font: inherit;
          font-size: 15px;
          font-weight: 500;
          padding: 10px 18px;
          border-radius: 999px;
          cursor: pointer;
          transition: all .2s ease;
          display: inline-flex;
          align-items: center;
        }

        .gb-tab span {
          margin-left: 6px;
          opacity: 0.7;
          font-size: 13px;
        }

        .gb-tab.on {
          background: var(--btn);
          color: var(--btnt);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .gb-add {
          border: 0;
          background: var(--card);
          color: var(--ink);
          font: inherit;
          font-weight: 500;
          padding: 11px 22px;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: var(--sh);
          border: 1px solid rgba(0,0,0,0.06);
          transition: transform .15s ease, box-shadow .2s ease;
        }

        .gb-add:hover {
          transform: translateY(-1px);
        }

        .gb-add:active {
          transform: scale(0.97);
        }

        .gb-tile {
          background: var(--card);
          border-radius: 28px;
          padding: 6px;
          box-shadow: var(--sh), 0 0 0 4px var(--ring);
          overflow: hidden;
          box-sizing: border-box;
          transition: transform .2s ease, box-shadow .2s ease;
        }

        .gb-thumb {
          position: relative;
          border-radius: 22px;
          overflow: hidden;
          display: grid;
          place-items: center;
          aspect-ratio: 4/3;
        }

        .gb-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }

        .gb-thumb video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }

        .gb-thumb svg {
          width: 44px;
          height: 44px;
          opacity: 0.9;
        }

        .gb-tag {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--card);
          color: var(--ink);
          font-size: 13px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          z-index: 2;
        }

        /* FEATURED CARD */
        .gb-feat {
          display: grid !important;
          grid-template-columns: 1.05fr 1fr !important;
          margin-bottom: 24px !important;
          width: 100% !important;
          cursor: pointer;
        }

        .gb-feat .gb-thumb {
          aspect-ratio: auto !important;
          min-height: 380px !important;
          height: 100% !important;
        }

        .gb-feat .gb-body {
          padding: 34px 34px 28px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
        }

        .gb-feat .gb-tag {
          position: static;
          align-self: flex-start;
          background: var(--pill);
          box-shadow: none;
        }

        .gb-feat h2 {
          font-size: clamp(24px, 3.2vw, 36px);
          line-height: 1.15;
          letter-spacing: -0.035em;
          margin: 20px 0 12px;
          font-weight: 700;
          word-break: break-word;
          color: var(--ink);
        }

        .gb-feat p {
          color: var(--mute);
          font-size: 16px;
          line-height: 1.5;
          max-width: 42ch;
          margin: 0;
        }

        .gb-foot {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 24px;
          font-size: 13.5px;
          font-weight: 500;
          border-top: 1px solid rgba(0,0,0,0.05);
          color: var(--mute);
        }

        .gb-foot em {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 19px;
          font-style: italic;
          color: var(--ink);
          font-weight: normal;
        }

        .gb-dot::before {
          content: "";
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ink);
          margin-right: 8px;
        }

        /* GRID CARDS (Strict override against global .grid repeat-12) */
        .gb-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 22px !important;
          width: 100% !important;
        }

        @media (min-width: 1100px) {
          .gb-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        .gb-card {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          width: 100% !important;
          min-width: 0 !important;
        }

        .gb-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.11), 0 0 0 4px var(--ring);
        }

        .gb-card .gb-body {
          padding: 18px 16px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex: 1;
        }

        .gb-card h3 {
          font-size: 15.5px;
          line-height: 1.35;
          font-weight: 600;
          letter-spacing: -0.02em;
          word-break: break-word;
          margin: 0;
          color: var(--ink);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .gb-card p {
          color: var(--mute);
          font-size: 13.5px;
          margin: 8px 0 0;
          font-weight: 500;
        }

        .gb-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: var(--mute);
          padding: 70px 0;
          font-size: 15px;
        }

        @media (max-width: 900px) {
          .gb-feat {
            grid-template-columns: 1fr !important;
          }
          .gb-feat .gb-thumb {
            min-height: 250px !important;
          }
          .gb-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .gb-grid {
            grid-template-columns: 1fr !important;
          }
          .gb-feat .gb-body {
            padding: 24px 18px;
          }
        }
      `}</style>

      <div className="gb-wrap">
        {/* HERO TITLE */}
        <header className="gb-hero">
          <h1>GALERI BERKAS</h1>
        </header>

        {/* TOOLBAR */}
        <div className="gb-bar">
          <div className="gb-tabs">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`gb-tab ${active ? 'on' : ''}`}
                >
                  {tab}
                  <span>{counts[tab] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            hidden
          />

          <button
            type="button"
            className="gb-add"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading
              ? `Mengunggah... ${uploadProgress?.percent ?? 0}%`
              : '+ Tambah File'}
          </button>
        </div>

        {/* REAL-TIME UPLOAD PROGRESS PANEL */}
        {uploadProgress && (
          <section
            aria-label="Progres unggahan berkas"
            className="mb-5 p-4 md:p-5 rounded-3xl bg-[var(--card)] border border-black/10 dark:border-white/10 shadow-[var(--sh)]"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-sm md:text-base font-bold text-[var(--ink)] truncate">
                  Mengunggah {uploadProgress.fileName}...
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-[var(--mute)] font-medium">
                  <span>{formatFileSizeMb(uploadProgress.sizeBytes)}</span>
                  {uploadProgress.isChunked && uploadProgress.totalChunks ? (
                    <span>
                      • Chunked Upload (potongan {(uploadProgress.chunkIndex ?? 0) + 1} dari{' '}
                      {uploadProgress.totalChunks})
                    </span>
                  ) : (
                    <span>• Unggahan langsung</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight text-[var(--ink)]">
                  {uploadProgress.percent}%
                </div>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>

            <div className="mt-3 h-3 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0d0d0d] dark:bg-[#f2f0fa] transition-[width] duration-150 ease-out"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </section>
        )}

        {actionNotice && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs font-medium flex items-center justify-between gap-3">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main>
          {isLoading && files.length === 0 ? (
            <>
              <div className="gb-tile gb-feat animate-pulse">
                <div className="gb-thumb bg-black/10 dark:bg-white/10" />
                <div className="gb-body">
                  <div>
                    <div className="h-6 w-20 rounded-full bg-black/10 dark:bg-white/10" />
                    <div className="h-8 w-3/4 rounded-xl bg-black/10 dark:bg-white/10 mt-5" />
                    <div className="h-4 w-5/6 rounded-lg bg-black/10 dark:bg-white/10 mt-3" />
                  </div>
                  <div className="gb-foot">
                    <div className="h-4 w-24 rounded-lg bg-black/10 dark:bg-white/10" />
                  </div>
                </div>
              </div>
              <section className="gb-grid">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="gb-tile gb-card animate-pulse">
                    <div className="gb-thumb bg-black/10 dark:bg-white/10" />
                    <div className="gb-body">
                      <div className="h-4 w-3/4 rounded-lg bg-black/10 dark:bg-white/10" />
                      <div className="h-3 w-1/2 rounded-lg bg-black/10 dark:bg-white/10 mt-3" />
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : loadError && files.length === 0 ? (
            <div className="gb-empty flex flex-col items-center gap-3">
              <p className="m-0">{loadError}</p>
              <button
                type="button"
                onClick={loadFiles}
                className="gb-add"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="gb-empty">
              Belum ada berkas {activeTab.toLowerCase()}. Klik &ldquo;+ Tambah File&rdquo; untuk mengunggah.
            </div>
          ) : (
            <>
              {/* FEATURED CARD (BERKAS TERBARU) */}
              {featItem && (
                <article
                  className="gb-tile gb-feat"
                  onClick={() => setSelectedFile(featItem)}
                >
                  <div
                    className="gb-thumb"
                    style={{
                      background: featItem.c
                        ? `linear-gradient(145deg, ${featItem.c[0]}, ${featItem.c[1]})`
                        : '#0f3d26',
                    }}
                  >
                    {featItem.src && featItem.t === 'Gambar' && (
                      <img src={featItem.src} alt={featItem.n} loading="eager" decoding="async" />
                    )}
                    {featItem.t === 'Video' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                        <span className="w-14 h-14 rounded-full bg-white/90 text-black flex items-center justify-center font-bold shadow-lg">
                          ▶
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-85">Video</span>
                      </div>
                    )}
                    {!featItem.src && featItem.t === 'Gambar' && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="3" />
                        <circle cx="9" cy="10" r="1.6" />
                        <path d="M21 16l-5-5-8 8" />
                      </svg>
                    )}
                    {featItem.t === 'Dokumen' && (
                      <div className="text-white text-6xl font-extrabold select-none">📄</div>
                    )}
                  </div>

                  <div className="gb-body">
                    <div>
                      <span className="gb-tag">{featItem.t}</span>
                      <h2>{getDisplayFileName(featItem)}</h2>
                      <p>File terbaru di galeri proyek. Klik untuk melihat, mengunduh, atau menambahkannya ke laporan.</p>
                    </div>

                    <div className="gb-foot">
                      <span className="gb-dot">{featItem.s}</span>
                      <em>Berkas terbaru</em>
                    </div>
                  </div>
                </article>
              )}

              {/* GRID CARDS (RESPONSIF 1-4 KOLOM DENGAN PAGINATION PROGRESIF) */}
              {visibleGridItems.length > 0 && (
                <section className="gb-grid">
                  {visibleGridItems.map((item, idx) => {
                    const cardTitle = getDisplayFileName(item);
                    return (
                      <article
                        key={`${cardTitle}-${idx}`}
                        className="gb-tile gb-card"
                        onClick={() => setSelectedFile(item)}
                      >
                        <div
                          className="gb-thumb"
                          style={{
                            background: item.c
                              ? `linear-gradient(145deg, ${item.c[0]}, ${item.c[1]})`
                              : '#14502e',
                          }}
                        >
                          {item.src && item.t === 'Gambar' && (
                            <img src={item.src} alt={cardTitle} loading="lazy" decoding="async" />
                          )}
                          {item.t === 'Video' && (
                            <div className="absolute inset-0 grid place-items-center bg-black/15">
                              <span className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center font-bold text-xs shadow">
                                ▶
                              </span>
                            </div>
                          )}
                          {!item.src && item.t === 'Gambar' && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="16" rx="3" />
                              <circle cx="9" cy="10" r="1.6" />
                              <path d="M21 16l-5-5-8 8" />
                            </svg>
                          )}
                          {item.t === 'Dokumen' && (
                            <div className="text-white text-4xl font-extrabold select-none">📄</div>
                          )}

                          <span className="gb-tag">{item.t}</span>
                        </div>

                        <div className="gb-body">
                          <h3>{cardTitle}</h3>
                          <p>{item.s} • {item.t}</p>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}

              {remainingCount > 0 && (
                <div className="flex justify-center mt-7">
                  <button
                    type="button"
                    className="gb-add"
                    onClick={() => setVisibleGridCount((c) => c + INITIAL_GRID_PAGE_SIZE)}
                  >
                    Muat Lebih Banyak ({remainingCount} berkas tersisa)
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* LIGHTBOX / PREVIEW MODAL */}
      {selectedFile && (
        <div
          onClick={() => setSelectedFile(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          style={{ zIndex: 9999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[92vh] flex flex-col items-center gap-3 relative bg-transparent"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="absolute -top-12 right-0 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold flex items-center justify-center cursor-pointer transition-all border border-white/20"
            >
              ✕
            </button>

            {/* Image Preview */}
            {selectedFile.src && selectedFile.t === 'Gambar' && (
              <img
                src={selectedFile.src}
                alt={getDisplayFileName(selectedFile)}
                className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl"
              />
            )}
            {!selectedFile.src && selectedFile.t === 'Gambar' && (
              <div
                className="w-[380px] h-[280px] rounded-2xl flex items-center justify-center text-white"
                style={{ background: `linear-gradient(145deg, ${selectedFile.c[0]}, ${selectedFile.c[1]})` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" className="w-16 h-16 opacity-90">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="M21 16l-5-5-8 8" />
                </svg>
              </div>
            )}

            {/* Video Player Preview */}
            {selectedFile.src && selectedFile.t === 'Video' && (
              <video
                src={selectedFile.src}
                controls
                autoPlay
                className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl"
              />
            )}
            {!selectedFile.src && selectedFile.t === 'Video' && (
              <div
                className="w-[380px] h-[280px] rounded-2xl flex items-center justify-center text-white"
                style={{ background: `linear-gradient(145deg, ${selectedFile.c[0]}, ${selectedFile.c[1]})` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" className="w-16 h-16 opacity-90">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M10 9l5 3-5 3z" />
                </svg>
              </div>
            )}

            {/* Document Preview Card */}
            {selectedFile.t === 'Dokumen' && (
              <div className="p-8 bg-white dark:bg-[#1f1d2b] rounded-3xl text-center flex flex-col items-center gap-3 shadow-2xl max-w-md border border-black/10 dark:border-white/10">
                <span className="text-6xl">📄</span>
                <p className="text-base font-bold text-gray-900 dark:text-white break-words max-w-xs">
                  {getDisplayFileName(selectedFile)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile.s} • Dokumen
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-1">
              {selectedFile.src ? (
                <>
                  <a
                    href={selectedFile.src}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-white text-black font-semibold rounded-full text-xs shadow-lg hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Buka Penuh</span>
                    <span>↗</span>
                  </a>
                  <a
                    href={selectedFile.src}
                    download={getDisplayFileName(selectedFile)}
                    className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-full text-xs backdrop-blur-md transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Unduh</span>
                    <span>↓</span>
                  </a>
                </>
              ) : (
                <span className="text-xs text-white/70">
                  {getDisplayFileName(selectedFile)} ({selectedFile.s})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriBerkasView;
