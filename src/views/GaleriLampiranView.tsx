import React, { useState, useEffect, useMemo } from 'react';

interface FileItem {
  id: string;
  name: string;
  url: string;
  kind: 'image' | 'video' | 'doc';
  ext: string;
  size: number;
  size_formatted: string;
  report_title?: string;
}

export const GaleriLampiranView: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'doc'>('all');
  const [lbActive, setLbActive] = useState<FileItem | null>(null);
  const [lbIndex, setLbIndex] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);

  // Ambil data berkas historis dari galeri-berkas.php
  const fetchFiles = async () => {
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/daily-reports/galeri-berkas.php');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (e) {
      console.error('Gagal mengambil galeri berkas:', e);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/daily-reports/galeri-berkas.php', {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (json.success) {
        fetchFiles();
      } else {
        alert(json.message || 'Gagal mengunggah berkas.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(it => it.kind === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c = { all: items.length, image: 0, video: 0, doc: 0 };
    items.forEach(it => {
      if (it.kind === 'image') c.image++;
      else if (it.kind === 'video') c.video++;
      else c.doc++;
    });
    return c;
  }, [items]);

  const openLightbox = (item: FileItem, idx: number) => {
    if (item.kind === 'doc') {
      window.open(item.url, '_blank');
      return;
    }
    setLbIndex(idx);
    setLbActive(item);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
      <div className="max-w-[1040px] mx-auto p-6 md:p-9 bg-white/80 dark:bg-[#1a1824]/80 backdrop-blur-2xl rounded-[28px] border border-white/60 dark:border-white/10 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold bg-black/5 dark:bg-white/10 rounded-full text-gray-700 dark:text-gray-300">
              Laporan harian
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              Lampiran &amp; Berkas Proyek
            </h1>
          </div>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 max-w-[260px] text-right">
            Foto, video, dan dokumen pendukung laporan kerja. Ukuran maksimal 2 GB per file.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap my-7">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#1f1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1f1d2b]'
                  : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              Semua <small className="opacity-70">({counts.all})</small>
            </button>
            <button
              onClick={() => setFilter('image')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'image'
                  ? 'bg-[#1f1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1f1d2b]'
                  : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              Gambar <small className="opacity-70">({counts.image})</small>
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'video'
                  ? 'bg-[#1f1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1f1d2b]'
                  : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              Video <small className="opacity-70">({counts.video})</small>
            </button>
            <button
              onClick={() => setFilter('doc')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'doc'
                  ? 'bg-[#1f1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1f1d2b]'
                  : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              Dokumen <small className="opacity-70">({counts.doc})</small>
            </button>
          </div>

          <label className="px-4 py-2.5 rounded-full border border-black/10 dark:border-white/10 text-xs font-bold cursor-pointer hover:border-[#6c5ce7] hover:bg-[#6c5ce7]/10 transition-all flex items-center gap-2 text-gray-800 dark:text-white">
            <span>{uploading ? '⏳ Mengunggah...' : '+ Tambah File'}</span>
            <input type="file" onChange={handleUpload} disabled={uploading} hidden />
          </label>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 auto-rows-[96px] gap-2.5">
          {filteredItems.map((item, idx) => {
            const slot = idx % 7;
            const spanClass =
              slot === 0 || slot === 6
                ? 'col-span-2 md:col-span-4 row-span-3'
                : 'col-span-1 md:col-span-2 row-span-3';

            return (
              <div
                key={item.id}
                onClick={() => openLightbox(item, idx)}
                className={`relative rounded-2xl overflow-hidden group cursor-pointer bg-black/5 dark:bg-white/5 transition-transform hover:scale-[1.01] ${spanClass}`}
              >
                {item.kind === 'image' && (
                  <img
                    src={item.url}
                    alt={item.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                {item.kind === 'video' && (
                  <div className="w-full h-full relative">
                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-10 h-10 rounded-full bg-white/80 text-black flex items-center justify-center font-bold">▶</span>
                    </div>
                  </div>
                )}
                {item.kind === 'doc' && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#ece9ff] dark:bg-[#2b2742] text-[#6c5ce7] dark:text-[#b9a9f0]">
                    <span className="text-3xl mb-1">📄</span>
                    <span className="text-lg font-bold uppercase">{item.ext}</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs md:text-sm font-bold truncate">{item.name}</p>
                  <p className="text-[10px] opacity-80">{item.size_formatted} • {item.kind === 'image' ? 'Gambar' : item.kind === 'video' ? 'Video' : item.ext.toUpperCase()}</p>
                </div>
              </div>
            );
          })}

          {/* Kartu Tambah Berkas */}
          <label className="col-span-2 row-span-2 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer hover:border-[#6c5ce7] hover:bg-[#6c5ce7]/5 transition-all text-center">
            <span className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-lg font-bold mb-2 shadow-sm text-gray-800 dark:text-white">+</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Seret berkas ke sini<br/>atau klik untuk memilih</span>
            <input type="file" onChange={handleUpload} disabled={uploading} hidden />
          </label>
        </div>

      </div>

      {/* Lightbox Preview */}
      {lbActive && (
        <div
          onClick={() => setLbActive(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div onClick={e => e.stopPropagation()} className="max-w-4xl w-full flex flex-col gap-3">
            <div className="flex justify-between items-center text-white">
              <div>
                <p className="text-sm font-bold">{lbActive.name}</p>
                <p className="text-xs opacity-70">{lbActive.size_formatted}</p>
              </div>
              <button
                onClick={() => setLbActive(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            {lbActive.kind === 'image' && (
              <img src={lbActive.url} alt={lbActive.name} className="max-h-[75vh] w-auto mx-auto object-contain rounded-2xl" />
            )}
            {lbActive.kind === 'video' && (
              <video src={lbActive.url} controls autoPlay className="max-h-[75vh] w-full rounded-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriLampiranView;
