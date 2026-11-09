import React, { useState, useEffect, useMemo, useRef } from 'react';

export interface FileItem {
  n: string;          // file name
  s: string;          // size formatted
  t: 'Gambar' | 'Video' | 'Dokumen'; // category type
  src: string;        // full file url
  c: [string, string]; // gradient colors fallback
}

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

const DEFAULT_FILES: FileItem[] = [
  { n: "FEED POST OLIMPIADE copy.jpg", s: "1.0 MB", t: "Gambar", src: "", c: ["#14502e", "#0a2a1a"] },
  { n: "Screenshot 2026-10-17 080003.png", s: "1.2 MB", t: "Gambar", src: "", c: ["#1f6b3f", "#103a24"] },
  { n: "Poster Pakai Masker.png", s: "0.9 MB", t: "Gambar", src: "", c: ["#2b6fa8", "#143a5e"] },
  { n: "Dokumentasi Lomba Perkantoran 01.jpg", s: "2.1 MB", t: "Gambar", src: "", c: ["#6b5b3a", "#2e2616"] },
  { n: "Dokumentasi Lomba Perkantoran 02.jpg", s: "1.8 MB", t: "Gambar", src: "", c: ["#4a5a6a", "#1d2630"] },
  { n: "Kegiatan Porsenik.mp4", s: "84 MB", t: "Video", src: "", c: ["#5a3a6b", "#241630"] },
  { n: "Foto Tim Panitia.jpg", s: "1.4 MB", t: "Gambar", src: "", c: ["#7a4a2a", "#331c0e"] },
  { n: "Banner Olimpiade.png", s: "1.1 MB", t: "Gambar", src: "", c: ["#1d5a5a", "#0c2a2a"] },
  { n: "Suasana Pembukaan.jpg", s: "2.4 MB", t: "Gambar", src: "", c: ["#5a6b2a", "#262e0e"] }
];

export const GaleriBerkasView: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>(DEFAULT_FILES);
  const [activeTab, setActiveTab] = useState<string>('Semua');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch data berkas asli dari endpoint JSON LaporanWe
  const loadFiles = async () => {
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?format=json');
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const formatted: FileItem[] = json.data.map((f: any, idx: number) => {
          const ext = (f.name?.split('.').pop() || '').toLowerCase();
          let type: 'Gambar' | 'Video' | 'Dokumen' = 'Dokumen';
          if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) {
            type = 'Gambar';
          } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
            type = 'Video';
          }

          return {
            n: f.name || f.n || 'Berkas Proyek',
            s: f.size_formatted || f.s || (f.size ? (f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`) : '1.0 MB'),
            t: type,
            src: f.url || f.src || '',
            c: f.c || PALETTE[idx % PALETTE.length]
          };
        });
        setFiles(formatted);
      }
    } catch (err) {
      console.warn('Menggunakan fallback data berkas:', err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // 2. Tab Filter & Hitung Counter Dinamis
  const tabs = ['Semua', 'Gambar', 'Video', 'Dokumen'];
  const counts = useMemo(() => {
    const c: Record<string, number> = { Semua: files.length, Gambar: 0, Video: 0, Dokumen: 0 };
    files.forEach(f => {
      if (c[f.t] !== undefined) c[f.t]++;
    });
    return c;
  }, [files]);

  const filteredList = useMemo(() => {
    if (activeTab === 'Semua') return files;
    return files.filter(f => f.t === activeTab);
  }, [files, activeTab]);

  // 3. Upload Berkas Baru
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?action=upload', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        await loadFiles();
      } else {
        alert(data.message || 'Gagal mengunggah berkas.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat mengunggah berkas.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const featItem = filteredList[0];
  const gridItems = filteredList.slice(1);

  return (
    <div className="w-full overflow-x-hidden min-h-screen bg-transparent px-4 md:px-8 py-6">
      <div className="max-w-[1100px] mx-auto pb-20">
        
        {/* HERO TITLE RESMI */}
        <header className="text-center pt-8 pb-4">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase select-none"
            style={{ letterSpacing: '-0.04em' }}
          >
            GALERI BERKAS
          </h1>
        </header>

        {/* TOOLBAR: TABS FILTER & BUTTON + TAMBAH FILE */}
        <div className="flex items-center justify-between gap-4 flex-wrap my-6">
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-0 font-medium text-sm px-4 py-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-black text-white dark:bg-white dark:text-black rounded-full shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full bg-transparent'
                  }`}
                >
                  <span>{tab}</span>
                  <span className="opacity-70 text-xs">{counts[tab] ?? 0}</span>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="border-0 bg-white dark:bg-[#1a1824] text-gray-900 dark:text-white font-medium text-sm px-5 py-2.5 rounded-full cursor-pointer shadow-sm hover:shadow active:scale-95 transition-all border border-gray-200/80 dark:border-white/10"
          >
            {isUploading ? '⏳ Mengunggah...' : '+ Tambah File'}
          </button>
        </div>

        {/* EMPTY STATE */}
        {filteredList.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            Belum ada {activeTab.toLowerCase()}. Klik &ldquo;+ Tambah File&rdquo; untuk mengunggah.
          </div>
        )}

        {/* FEATURED CARD (BERKAS TERBARU) */}
        {featItem && (
          <article
            onClick={() => setSelectedFile(featItem)}
            className="bg-white dark:bg-[#1a1824] rounded-[28px] p-4 md:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer border border-black/5 dark:border-white/10 overflow-hidden mb-6 flex flex-col md:flex-row gap-6 items-stretch"
          >
            {/* Thumbnail Sisi Kiri */}
            <div
              className="w-full md:w-[420px] h-[260px] flex-shrink-0 bg-[#0f3d26] rounded-2xl relative overflow-hidden flex items-center justify-center"
              style={{
                background: featItem.c
                  ? `linear-gradient(145deg, ${featItem.c[0]}, ${featItem.c[1]})`
                  : '#0f3d26',
              }}
            >
              {featItem.src && featItem.t === 'Gambar' && (
                <img
                  src={featItem.src}
                  alt={featItem.n}
                  loading="lazy"
                  className="w-full h-full object-cover absolute inset-0"
                />
              )}
              {featItem.src && featItem.t === 'Video' && (
                <>
                  <video
                    src={`${featItem.src}#t=0.5`}
                    className="w-full h-full object-cover absolute inset-0"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 grid place-items-center bg-black/25">
                    <span className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center font-bold">
                      ▶
                    </span>
                  </div>
                </>
              )}
              {(!featItem.src || featItem.t === 'Dokumen') && (
                <div className="text-white text-5xl font-extrabold uppercase">📄</div>
              )}
              {!featItem.src && featItem.t === 'Gambar' && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-12 h-12 opacity-90"
                >
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="M21 16l-5-5-8 8" />
                </svg>
              )}
            </div>

            {/* Area Info Kanan */}
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                {/* Badge Abu-Abu */}
                <span className="inline-block bg-[#f1f1f1] dark:bg-white/10 text-[#0d0d0d] dark:text-gray-200 text-xs font-medium px-3.5 py-1 rounded-full mb-3">
                  {featItem.t}
                </span>

                {/* Judul File Tebal */}
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white break-words line-clamp-2 mb-2">
                  {featItem.n}
                </h2>

                {/* Deskripsi */}
                <p className="text-[#7a7a7a] dark:text-gray-400 text-sm md:text-base leading-relaxed max-w-[42ch]">
                  File terbaru di galeri proyek. Klik untuk melihat, mengunduh, atau menambahkannya ke laporan.
                </p>
              </div>

              {/* Bawah: Kiri ukuran file, Kanan serif miring 'Berkas terbaru' */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/5 mt-4 text-xs font-medium text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-black dark:bg-white inline-block"></span>
                  {featItem.s}
                </span>
                <em className="font-serif italic text-base md:text-lg text-gray-800 dark:text-gray-200 font-normal">
                  Berkas terbaru
                </em>
              </div>
            </div>
          </article>
        )}

        {/* RESPONSIVE CSS GRID 1-4 KOLOM */}
        {gridItems.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {gridItems.map((item, idx) => (
              <article
                key={idx}
                onClick={() => setSelectedFile(item)}
                className="bg-white dark:bg-[#1a1824] rounded-[24px] p-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden border border-black/5 dark:border-white/10 flex flex-col"
              >
                {/* Thumbnail Rounded */}
                <div
                  className="relative rounded-[18px] overflow-hidden aspect-[4/3] flex items-center justify-center"
                  style={{
                    background: item.c
                      ? `linear-gradient(145deg, ${item.c[0]}, ${item.c[1]})`
                      : '#14502e',
                  }}
                >
                  {item.src && item.t === 'Gambar' && (
                    <img
                      src={item.src}
                      alt={item.n}
                      loading="lazy"
                      className="w-full h-full object-cover absolute inset-0"
                    />
                  )}
                  {item.src && item.t === 'Video' && (
                    <>
                      <video
                        src={`${item.src}#t=0.5`}
                        className="w-full h-full object-cover absolute inset-0"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 grid place-items-center bg-black/25">
                        <span className="w-8 h-8 rounded-full bg-white/90 text-black flex items-center justify-center font-bold text-xs">
                          ▶
                        </span>
                      </div>
                    </>
                  )}
                  {item.t === 'Dokumen' && (
                    <div className="text-white text-3xl font-extrabold uppercase">📄</div>
                  )}
                  {!item.src && item.t === 'Gambar' && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-10 h-10 opacity-90"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <circle cx="9" cy="10" r="1.6" />
                      <path d="M21 16l-5-5-8 8" />
                    </svg>
                  )}
                  {!item.src && item.t === 'Video' && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-10 h-10 opacity-90"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="M10 9l5 3-5 3z" />
                    </svg>
                  )}

                  {/* Badge Kategori Putih di Pojok Kanan Atas */}
                  <span className="absolute top-2.5 right-2.5 bg-white text-gray-900 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
                    {item.t}
                  </span>
                </div>

                {/* Card Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white break-words line-clamp-1 mb-1">
                    {item.n}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.s} • {item.t}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}

      </div>

      {/* LIGHTBOX MODAL NATIVE */}
      {selectedFile && (
        <div
          onClick={() => setSelectedFile(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3 relative"
          >
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="absolute -top-12 right-0 w-9 h-9 rounded-full bg-white/20 text-white font-bold flex items-center justify-center hover:bg-white/30 cursor-pointer"
            >
              ✕
            </button>

            {selectedFile.src && selectedFile.t === 'Gambar' ? (
              <img
                src={selectedFile.src}
                alt={selectedFile.n}
                className="max-w-full max-h-[78vh] rounded-2xl object-contain shadow-2xl"
              />
            ) : selectedFile.t === 'Gambar' ? (
              <div
                className="w-[360px] h-[260px] rounded-2xl flex items-center justify-center text-white"
                style={{ background: `linear-gradient(145deg, ${selectedFile.c[0]}, ${selectedFile.c[1]})` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" className="w-16 h-16 opacity-90">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="M21 16l-5-5-8 8" />
                </svg>
              </div>
            ) : null}

            {selectedFile.src && selectedFile.t === 'Video' ? (
              <video
                src={selectedFile.src}
                controls
                autoPlay
                className="max-w-full max-h-[78vh] rounded-2xl shadow-2xl"
              />
            ) : selectedFile.t === 'Video' ? (
              <div
                className="w-[360px] h-[260px] rounded-2xl flex items-center justify-center text-white"
                style={{ background: `linear-gradient(145deg, ${selectedFile.c[0]}, ${selectedFile.c[1]})` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" className="w-16 h-16 opacity-90">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M10 9l5 3-5 3z" />
                </svg>
              </div>
            ) : null}

            {selectedFile.t === 'Dokumen' && (
              <div className="p-8 bg-white dark:bg-[#1f1d2b] rounded-2xl text-center flex flex-col items-center gap-3">
                <span className="text-5xl">📄</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedFile.n}</p>
                {selectedFile.src ? (
                  <a
                    href={selectedFile.src}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black rounded-full text-xs font-bold"
                  >
                    Buka / Unduh Berkas ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Berkas lokal</span>
                )}
              </div>
            )}

            <p className="text-white text-xs font-semibold">{selectedFile.n} ({selectedFile.s})</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriBerkasView;
