import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../components/icons';
import { useFastData, FastFileItem } from '../context/FastDataContext';
import { ImageLightbox } from '../components/ImageLightbox';

export interface FilesViewProps {
  onAddToast?: (msg: string) => void;
}

const FALLBACK_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

/**
 * Lazy Image with IntersectionObserver to only load assets when entering viewport
 */
export const LazyFileImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer.unobserve(el);
            }
          });
        },
        { rootMargin: '100px' }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setIsInView(true);
    }
  }, []);

  return (
    <div ref={imgRef} className="w-full h-full relative overflow-hidden bg-black/5 dark:bg-white/5">
      {isInView ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${className}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_SVG;
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 animate-pulse">
          <Icon name="image" style={{ width: 22, height: 22 }} />
        </div>
      )}
    </div>
  );
};

export const FilesView: React.FC<FilesViewProps> = ({ onAddToast }) => {
  const { files: storeFiles, refreshFiles } = useFastData();
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'image' | 'video' | 'doc'>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Silent background revalidation
  useEffect(() => {
    refreshFiles(undefined, true).catch(() => {});
  }, [refreshFiles]);

  const filteredFiles = useMemo(() => {
    return storeFiles.filter((f) => {
      if (filterKind !== 'all' && f.kind !== filterKind) return false;
      if (search.trim()) {
        return f.name.toLowerCase().includes(search.toLowerCase().trim());
      }
      return true;
    });
  }, [storeFiles, filterKind, search]);

  const imageFiles = useMemo(() => {
    return filteredFiles
      .filter((f) => f.kind === 'image')
      .map((f) => f.url);
  }, [filteredFiles]);

  const handleOpenItem = (item: FastFileItem) => {
    if (item.kind === 'image') {
      const idx = imageFiles.indexOf(item.url);
      setLightboxIndex(idx >= 0 ? idx : 0);
      setLightboxOpen(true);
    } else {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      if (onAddToast) onAddToast(`Membuka ${item.name}`);
    }
  };

  return (
    <div className="view w-full flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 inline-block mb-2">
            Lampiran &amp; Berkas
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
            Lampiran &amp; Berkas Proyek
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Galeri visual bukti pekerjaan dan dokumen pendukung proyek ({storeFiles.length} berkas tersinkronisasi).
          </p>
        </div>
      </div>

      {/* Toolbar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs overflow-x-auto">
          {[
            { id: 'all', label: `Semua (${storeFiles.length})` },
            { id: 'image', label: 'Foto & Gambar' },
            { id: 'video', label: 'Video' },
            { id: 'doc', label: 'Dokumen' },
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

        <div className="relative min-w-[260px] sm:w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon name="search" style={{ width: 16, height: 16 }} />
          </span>
          <input
            type="text"
            placeholder="Cari berkas atau dokumen..."
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

      {/* Grid of Files with Lazy Loading */}
      {filteredFiles.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-6">
          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Tidak ada berkas ditemukan</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau ubah filter di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleOpenItem(file)}
              className="group relative rounded-2xl overflow-hidden bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card hover:shadow-xl hover:border-black/15 dark:hover:border-white/25 transition-all duration-300 flex flex-col justify-between cursor-pointer"
            >
              <div className="w-full aspect-square relative overflow-hidden">
                {file.kind === 'image' ? (
                  <LazyFileImage src={file.thumbnail_url || file.url} alt={file.name} />
                ) : file.kind === 'video' ? (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white relative">
                    <Icon name="video" style={{ width: 28, height: 28 }} />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-semibold">
                      VIDEO
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-white/5 flex flex-col items-center justify-center text-slate-500 gap-1">
                    <Icon name="doc" style={{ width: 28, height: 28 }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {file.name.split('.').pop() || 'DOC'}
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Icon name="search" style={{ width: 18, height: 18 }} />
                </div>
              </div>

              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={file.name}>
                  {file.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={imageFiles}
        currentIndex={lightboxIndex}
        title="Lampiran & Berkas Proyek"
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />
    </div>
  );
};

export default FilesView;
