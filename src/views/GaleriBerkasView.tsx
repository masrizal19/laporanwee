import React, { useState, useEffect, useMemo, useRef } from 'react';

interface FileItem {
  n: string;          // file name
  s: string;          // size formatted
  t: 'Gambar' | 'Video' | 'Dokumen'; // type
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

export const GaleriBerkasView: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('Semua');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch data berkas asli dari endpoint JSON (bukan iframe)
  const loadFiles = async () => {
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?format=json');
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const formatted: FileItem[] = json.data.map((f: any, idx: number) => {
          const ext = (f.name?.split('.').pop() || '').toLowerCase();
          let type: 'Gambar' | 'Video' | 'Dokumen' = 'Dokumen';
          if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) type = 'Gambar';
          else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) type = 'Video';

          return {
            n: f.name || 'Berkas Proyek',
            s: f.size_formatted || (f.size ? (f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`) : '500 KB'),
            t: type,
            src: f.url,
            c: PALETTE[idx % PALETTE.length]
          };
        });
        setFiles(formatted);
      }
    } catch (err) {
      console.warn('Fallback to local cache:', err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // 2. Tab Filter & Hitung Counter Dinamis
  const tabs = ['Semua', 'Gambar', 'Video', 'Dokumen'];
  const counts = useMemo(() => {
    const c: Record<string, number> = { Semua: files.length, Gambar: 0, Video: 0, Dokumen: 0 };
    files.forEach(f => { if (c[f.t] !== undefined) c[f.t]++; });
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
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const featItem = filteredList[0];
  const gridItems = filteredList.slice(1);

  return (
    <div className="flex-1 w-full min-w-0 h-screen overflow-y-auto bg-transparent px-4 md:px-8 py-6">
      <div className="max-w-[1100px] mx-auto pb-20">
        
        {/* HERO TITLE RESMI */}
        <header className="text-center pt-8 pb-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
            GALERI BERKAS
          </h1>
        </header>

        {/* TOOLBAR: TABS FILTER & BUTTON + TAMBAH FILE */}
        <div className="flex items-center justify-between gap-3 flex-wrap my-6">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-0 font-semibold text-sm px-5 py-2.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-md'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20'
                  }`}
                >
                  <span>{tab}</span>
                  <span className="opacity-70 text-xs">({counts[tab] || 0})</span>
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
            className="border-0 bg-white dark:bg-[#201d2d] text-gray-900 dark:text-white font-bold text-sm px-6 py-2.5 rounded-full cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {isUploading ? '⏳ Mengunggah...' : '+ Tambah File'}
          </button>
        </div>

        {/* EMPTY STATE */}
        {filteredList.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">
            Belum ada berkas {activeTab.toLowerCase()}. Klik "+ Tambah File" untuk mengunggah.
          </div>
        )}

        {/* FEATURED CARD ATAS (Jika ada data) */}
        {featItem && (
          <article
            onClick={() => setSelectedFile(featItem)}
            className="bg-white dark:bg-[#1f1d2b] rounded-[28px] p-2 shadow-lg hover:shadow-xl transition-all cursor-pointer grid grid-cols-1 md:grid-cols-[1.05fr_1fr] mb-6 overflow-hidden border border-black/5 dark:border-white/10"
          >
            <div
              className="relative rounded-[22px] overflow-hidden aspect-[4/3] md:aspect-auto md:min-h-[380px] flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, ${featItem.c[0]}, ${featItem.c[1]})` }}
            >
              {featItem.src && featItem.t === 'Gambar' && (
                <img src={featItem.src} alt={featItem.n} loading="lazy" className="w-full h-full object-cover absolute inset-0" />
              )}
              {featItem.src && featItem.t === 'Video' && (
                <>
                  <video src={`${featItem.src}#t=0.5`} className="w-full h-full object-cover absolute inset-0" muted playsInline />
                  <div className="absolute inset-0 grid place-items-center bg-black/25">
                    <span className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center font-bold">▶</span>
                  </div>
                </>
              )}
              {featItem.t === 'Dokumen' && (
                <div className="text-white text-5xl font-extrabold uppercase">📄</div>
              )}
            </div>

            <div className="p-6 md:p-8 flex flex-col justify-between">
              <div>
                <span className="inline-block bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-200 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  {featItem.t}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white break-words mb-3">
                  {featItem.n}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-[42ch]">
                  File terbaru di galeri berkas. Klik untuk melihat pratinjau penuh atau mengunduh berkas.
                </p>
              </div>

              <div className="flex justify-between items-center pt-6 text-xs font-semibold text-gray-500 dark:text-gray-400 border-t border-black/5 dark:border-white/5 mt-6">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-black dark:bg-white inline-block"></span>
                  {featItem.s}
                </span>
                <em className="font-serif italic text-base text-gray-700 dark:text-gray-300">Berkas terbaru</em>
              </div>
            </div>
          </article>
        )}

        {/* 3-COLUMN GRID KARTU */}
        {gridItems.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {gridItems.map((item, idx) => (
              <article
                key={idx}
                onClick={() => setSelectedFile(item)}
                className="bg-white dark:bg-[#1f1d2b] rounded-[24px] p-2 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden border border-black/5 dark:border-white/10 flex flex-col"
              >
                <div
                  className="relative rounded-[18px] overflow-hidden aspect-[4/3] flex items-center justify-center"
                  style={{ background: `linear-gradient(145deg, ${item.c[0]}, ${item.c[1]})` }}
                >
                  {item.src && item.t === 'Gambar' && (
                    <img src={item.src} alt={item.n} loading="lazy" className="w-full h-full object-cover absolute inset-0" />
                  )}
                  {item.src && item.t === 'Video' && (
                    <>
                      <video src={`${item.src}#t=0.5`} className="w-full h-full object-cover absolute inset-0" muted playsInline />
                      <div className="absolute inset-0 grid place-items-center bg-black/25">
                        <span className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center font-bold text-xs">▶</span>
                      </div>
                    </>
                  )}
                  {item.t === 'Dokumen' && (
                    <div className="text-white text-3xl font-extrabold uppercase">📄</div>
                  )}

                  <span className="absolute top-2.5 right-2.5 bg-white/90 dark:bg-black/90 text-gray-900 dark:text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                    {item.t}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white break-words line-clamp-1 mb-1">
                    {item.n}
                  </h3>
                  <p className="text-xs text-gray-400">
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

            {selectedFile.t === 'Gambar' && (
              <img
                src={selectedFile.src}
                alt={selectedFile.n}
                className="max-w-full max-h-[78vh] rounded-2xl object-contain shadow-2xl"
              />
            )}

            {selectedFile.t === 'Video' && (
              <video
                src={selectedFile.src}
                controls
                autoPlay
                className="max-w-full max-h-[78vh] rounded-2xl shadow-2xl"
              />
            )}

            {selectedFile.t === 'Dokumen' && (
              <div className="p-8 bg-white dark:bg-[#1f1d2b] rounded-2xl text-center flex flex-col items-center gap-3">
                <span className="text-5xl">📄</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedFile.n}</p>
                <a
                  href={selectedFile.src}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 bg-black text-white dark:bg-white dark:text-black rounded-full text-xs font-bold"
                >
                  Buka / Unduh Berkas ↗
                </a>
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
