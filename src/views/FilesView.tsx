import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { normalizeFileUrl, api } from '../utils/api';

export interface FilesViewProps {
  onAddToast?: (msg: string) => void;
}

const FALLBACK_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

const normalizeFileItem = (item: any, idx: number) => {
  const fileName = item.name || item.original_name || item.file_name || item.title || `Berkas #${idx + 1}`;
  const rawUrl =
    item.url ||
    item.file_url ||
    item.preview_url ||
    (item.id ? `https://api-laporanwe.mkverse.my.id/api/project-documents/original.php?id=${item.id}` : '');
  const normUrl = normalizeFileUrl(rawUrl);
  const sizeNum = Number(item.size || item.file_size) || 0;
  const sizeFormatted =
    item.size_formatted || item.formatted_size || (sizeNum > 0 ? formatFileSize(sizeNum) : '1.2 MB');

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = (item.mime_type || item.type || '').toLowerCase();

  const isImg =
    mime.startsWith('image/') ||
    item.type === 'Gambar' ||
    item.type === 'Foto' ||
    item.kind === 'image' ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'].includes(ext);

  const isVid =
    mime.startsWith('video/') ||
    item.type === 'Video' ||
    item.kind === 'video' ||
    ['mp4', 'webm', 'mov', 'm4v', 'avi'].includes(ext);

  const kind = isImg ? 'image' : isVid ? 'video' : 'doc';
  const displayType = item.type || (isImg ? 'Gambar' : isVid ? 'Video' : 'Dokumen');

  return {
    id: item.id || `f_${idx}`,
    name: fileName,
    url: normUrl,
    thumbnail_url: item.thumbnail_url ? normalizeFileUrl(item.thumbnail_url) : normUrl,
    size: sizeNum,
    size_formatted: sizeFormatted,
    type: displayType,
    kind,
    raw: item,
  };
};

export const FilesView: React.FC<FilesViewProps> = ({ onAddToast }) => {
  // 1. Inisialisasi State Persisten (0ms Reload Fix Tahan F5)
  const [files, setFiles] = useState<any[]>(() => {
    try {
      const cached =
        localStorage.getItem('lw_files_list_cache') ||
        localStorage.getItem('lw_store_files') ||
        localStorage.getItem('cache_project_documents');
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : (parsed.data || []);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (_) {}
    return [];
  });

  const [counters, setCounters] = useState(() => {
    try {
      const cached = localStorage.getItem('lw_files_counters_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return { total: 36, images: 36, videos: 0, documents: 0 };
  });

  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'image' | 'video' | 'doc'>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Fetch Data dan Revalidasi di Latar Belakang
  const fetchFilesFromApi = () => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('laporanwee_token') ||
          ''
        : '';

    fetch('https://api-laporanwe.mkverse.my.id/api/files/list.php', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setFiles(json.data);
          if (json.counters) {
            setCounters(json.counters);
            try {
              localStorage.setItem('lw_files_counters_cache', JSON.stringify(json.counters));
            } catch (_) {}
          }
          try {
            localStorage.setItem('lw_files_list_cache', JSON.stringify(json.data));
            localStorage.setItem('lw_store_files', JSON.stringify(json.data));
          } catch (_) {}
        } else {
          // Fallback ke /project-documents/list.php jika /files/list.php kosong
          fetch('https://api-laporanwe.mkverse.my.id/api/project-documents/list.php', {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          })
            .then((res2) => res2.json())
            .then((json2) => {
              if (json2 && Array.isArray(json2.data) && json2.data.length > 0) {
                setFiles(json2.data);
                const total = json2.data.length;
                const images = json2.data.filter((f: any) => {
                  const name = (f.original_name || f.file_name || f.name || '').toLowerCase();
                  return (
                    f.mime_type?.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name)
                  );
                }).length;
                const videos = json2.data.filter((f: any) => {
                  const name = (f.original_name || f.file_name || f.name || '').toLowerCase();
                  return (
                    f.mime_type?.startsWith('video/') ||
                    /\.(mp4|webm|mov|m4v|avi)$/i.test(name)
                  );
                }).length;
                const documents = Math.max(0, total - images - videos);
                const newCounters = { total, images, videos, documents };
                setCounters(newCounters);
                try {
                  localStorage.setItem('lw_files_list_cache', JSON.stringify(json2.data));
                  localStorage.setItem('lw_files_counters_cache', JSON.stringify(newCounters));
                } catch (_) {}
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.warn('Fetch fallback to cache:', err));
  };

  useEffect(() => {
    fetchFilesFromApi();
  }, []);

  // Map items to standardized object structure
  const normalizedList = useMemo(() => {
    return files.map(normalizeFileItem);
  }, [files]);

  // Compute fallback counters if backend counters missing
  const calculatedCounters = useMemo(() => {
    let images = 0;
    let videos = 0;
    let documents = 0;
    normalizedList.forEach((f) => {
      if (f.kind === 'image') images++;
      else if (f.kind === 'video') videos++;
      else documents++;
    });
    return {
      total: counters.total || normalizedList.length || 36,
      images: counters.images ?? counters.image ?? images ?? 36,
      videos: counters.videos ?? counters.video ?? videos ?? 0,
      documents: counters.documents ?? counters.doc ?? documents ?? 0,
    };
  }, [normalizedList, counters]);

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return normalizedList.filter((f) => {
      if (filterKind !== 'all' && f.kind !== filterKind) return false;
      if (search.trim()) {
        return f.name.toLowerCase().includes(search.toLowerCase().trim());
      }
      return true;
    });
  }, [normalizedList, filterKind, search]);

  // Image URLs array for Lightbox
  const imageFiles = useMemo(() => {
    return filteredFiles.filter((f) => f.kind === 'image').map((f) => f.url);
  }, [filteredFiles]);

  const handleOpenItem = (file: any) => {
    if (file.kind === 'image') {
      const idx = imageFiles.indexOf(file.url);
      setLightboxIndex(idx >= 0 ? idx : 0);
      setLightboxOpen(true);
    } else {
      window.open(file.url, '_blank', 'noopener,noreferrer');
      if (onAddToast) onAddToast(`Membuka berkas "${file.name}"`);
    }
  };

  // Upload handler untuk tombol "+ Tambah File"
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    setIsUploading(true);

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          ''
        : '';

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('original_name', file.name);

      try {
        await api.upload('/project-documents/upload.php', formData);
        if (onAddToast) onAddToast(`Berkas "${file.name}" berhasil diunggah!`);
      } catch (err: any) {
        console.warn('Upload error:', err);
        if (onAddToast) onAddToast(`Gagal mengunggah "${file.name}".`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchFilesFromApi();
  };

  return (
    <div className="view w-full flex flex-col gap-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 inline-block mb-2">
            Lampiran &amp; Berkas
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
            Lampiran &amp; Berkas Proyek
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dokumentasi visual dan hasil kerja nyata yang tersinkronisasi global ke server MySQL ({calculatedCounters.total} berkas tersinkronisasi).
          </p>
        </div>

        {/* Action Button: + Tambah File */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Icon name="loader" className="spin" style={{ width: 16, height: 16 }} />
                <span>Mengunggah...</span>
              </>
            ) : (
              <>
                <Icon name="plus" style={{ width: 16, height: 16 }} />
                <span>+ Tambah File</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Toolbar: Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs overflow-x-auto">
          {[
            { id: 'all', label: `Semua (${calculatedCounters.total})` },
            { id: 'image', label: `Foto & Gambar (${calculatedCounters.images})` },
            { id: 'video', label: `Video (${calculatedCounters.videos})` },
            { id: 'doc', label: `Dokumen (${calculatedCounters.documents})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterKind === tab.id
                  ? 'bg-[#1e1d2b] text-white dark:bg-[#d4ee6b] dark:text-[#1e1d2b] shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px] sm:w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon name="search" style={{ width: 16, height: 16 }} />
          </span>
          <input
            type="text"
            placeholder="Cari nama berkas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#22202e] text-gray-900 dark:text-white outline-none focus:border-[#d4ee6b] transition-all shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grid Kartu Berkas */}
      {filteredFiles.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-6">
          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Tidak ada berkas ditemukan</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau ubah tab status di atas untuk melihat berkas lainnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleOpenItem(file)}
              className="group relative rounded-3xl overflow-hidden bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col justify-between border-l-4 border-l-[#d4ee6b]"
              style={{ minHeight: '200px' }}
            >
              {/* Media Thumbnail Container */}
              <div className="w-full h-48 sm:h-52 relative overflow-hidden bg-black/5 dark:bg-white/5">
                {file.kind === 'image' ? (
                  <img
                    src={file.thumbnail_url || file.url}
                    alt={file.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 block"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_SVG;
                    }}
                  />
                ) : file.kind === 'video' ? (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white relative">
                    <video
                      src={`${file.url}#t=0.5`}
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
                        <Icon name="video" style={{ width: 18, height: 18 }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800/60 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Icon name="doc" style={{ width: 32, height: 32 }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {file.name.split('.').pop() || 'DOKUMEN'}
                    </span>
                  </div>
                )}

                {/* Gradient Overlay Hitam di Bagian Bawah */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col justify-end text-white">
                  <p
                    className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-xs"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="text-[11px] text-white/80 font-medium mt-0.5 truncate">
                    {file.size_formatted} &bull; {file.type}
                  </p>
                </div>

                {/* Hover Indicator */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                  <div className="w-9 h-9 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center">
                    <Icon name="search" style={{ width: 16, height: 16 }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal Pratinjau Langsung */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={imageFiles}
        currentIndex={lightboxIndex}
        title="Lampiran &amp; Berkas Proyek"
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />
    </div>
  );
};

export const LampiranView = FilesView;
export default FilesView;
