import React, { useState, useEffect, useMemo, useRef } from 'react';

export interface FileItem {
  n: string;          // file name
  s: string;          // formatted file size
  t: 'Gambar' | 'Video' | 'Dokumen'; // category
  src: string;        // full file URL
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
          const fileName = f.n || f.name || 'Berkas';
          const ext = (fileName.split('.').pop() || '').toLowerCase();
          let type: 'Gambar' | 'Video' | 'Dokumen' = 'Dokumen';
          if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) {
            type = 'Gambar';
          } else if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
            type = 'Video';
          } else if (f.t === 'Gambar' || f.t === 'Video' || f.t === 'Dokumen') {
            type = f.t;
          }

          return {
            n: fileName,
            s: f.s || f.size_formatted || (f.size ? (f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`) : '1.0 MB'),
            t: type,
            src: f.src || f.url || '',
            c: f.c && Array.isArray(f.c) ? f.c : PALETTE[idx % PALETTE.length]
          };
        });
        setFiles(formatted);
      }
    } catch (err) {
      console.warn('Menggunakan data fallback:', err);
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
      alert('Terjadi kesalahan jaringan saat mengunggah.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const featItem = filteredList[0];
  const gridItems = filteredList.slice(1);

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
            {isUploading ? '⏳ Mengunggah...' : '+ Tambah File'}
          </button>
        </div>

        {/* MAIN CONTENT AREA */}
        <main>
          {filteredList.length === 0 ? (
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
                      <img src={featItem.src} alt={featItem.n} loading="lazy" />
                    )}
                    {featItem.src && featItem.t === 'Video' && (
                      <>
                        <video src={`${featItem.src}#t=0.5`} muted playsInline />
                        <div className="absolute inset-0 grid place-items-center bg-black/25">
                          <span className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center font-bold">
                            ▶
                          </span>
                        </div>
                      </>
                    )}
                    {!featItem.src && featItem.t === 'Video' && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="M10 9l5 3-5 3z" />
                      </svg>
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
                      <h2>{featItem.n}</h2>
                      <p>File terbaru di galeri proyek. Klik untuk melihat, mengunduh, atau menambahkannya ke laporan.</p>
                    </div>

                    <div className="gb-foot">
                      <span className="gb-dot">{featItem.s}</span>
                      <em>Berkas terbaru</em>
                    </div>
                  </div>
                </article>
              )}

              {/* GRID CARDS (RESPONSIF 1-4 KOLOM) */}
              {gridItems.length > 0 && (
                <section className="gb-grid">
                  {gridItems.map((item, idx) => (
                    <article
                      key={idx}
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
                          <img src={item.src} alt={item.n} loading="lazy" />
                        )}
                        {item.src && item.t === 'Video' && (
                          <>
                            <video src={`${item.src}#t=0.5`} muted playsInline />
                            <div className="absolute inset-0 grid place-items-center bg-black/25">
                              <span className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center font-bold text-xs">
                                ▶
                              </span>
                            </div>
                          </>
                        )}
                        {!item.src && item.t === 'Video' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="14" rx="3" />
                            <path d="M10 9l5 3-5 3z" />
                          </svg>
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
                        <h3>{item.n}</h3>
                        <p>{item.s} • {item.t}</p>
                      </div>
                    </article>
                  ))}
                </section>
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
                alt={selectedFile.n}
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
                  {selectedFile.n}
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
                    download={selectedFile.n}
                    className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-full text-xs backdrop-blur-md transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Unduh</span>
                    <span>↓</span>
                  </a>
                </>
              ) : (
                <span className="text-xs text-white/70">{selectedFile.n} ({selectedFile.s})</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriBerkasView;
