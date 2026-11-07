import React, { useEffect, useState, useRef } from 'react';
import { render, fit, downloadJPEG, downloadPDF } from '../utils/pbDoc';
import { getStoredToken } from '../utils/api';
import './pengajuan-pratinjau.css';

export const PengajuanBarangPratinjauView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'jpeg' | 'pdf' | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (!toastRef.current) return;
    toastRef.current.textContent = msg;
    toastRef.current.classList.add('on');
    setTimeout(() => {
      if (toastRef.current) toastRef.current.classList.remove('on');
    }, 2800);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const token = getStoredToken();

    const loadData = async () => {
      setLoading(true);
      setErrorMessage(null);

      // 1. Jika ID disediakan di URL, ambil data asli dari MySQL melalui backend API
      if (id) {
        if (!token) {
          setLoading(false);
          setErrorMessage('Autentikasi diperlukan. Silakan login terlebih dahulu untuk mengakses dokumen ini.');
          return;
        }

        try {
          const res = await fetch(`https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php?id=${encodeURIComponent(id)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });

          if (res.status === 401) {
            setLoading(false);
            setErrorMessage('Sesi autentikasi telah berakhir atau token tidak valid. Silakan login kembali.');
            return;
          }

          if (!res.ok) {
            setLoading(false);
            setErrorMessage(`Pengajuan barang ID #${id} tidak dapat dimuat (Status server: ${res.status}).`);
            return;
          }

          const json = await res.json();
          if (json.success && json.data) {
            dataRef.current = json.data;
          } else {
            setLoading(false);
            setErrorMessage(json.message || `Data pengajuan barang ID #${id} tidak ditemukan di database.`);
            return;
          }
        } catch (e: any) {
          setLoading(false);
          setErrorMessage('Gagal menghubungi server database. Periksa koneksi internet Anda.');
          return;
        }
      } else {
        // 2. Jika tidak ada ID di URL, gunakan draf lokal aktif pengguna jika tersedia
        try {
          const draft = localStorage.getItem('pb.v1');
          if (draft) {
            const parsed = JSON.parse(draft);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
              dataRef.current = parsed;
            }
          }
        } catch (_) {}

        if (!dataRef.current) {
          setLoading(false);
          setErrorMessage('Tidak ada data pengajuan yang dipilih atau tersimpan di formulir.');
          return;
        }
      }

      setLoading(false);

      // Render ke DOM setelah data tersedia
      setTimeout(() => {
        if (hostRef.current && wrapRef.current && dataRef.current) {
          try {
            const host = hostRef.current;
            const wrap = wrapRef.current;
            const currentData = dataRef.current;
            currentData.meta = currentData.meta || {};

            const draw = () => {
              const r = render(currentData, host);
              fit(wrap, host);
              const infoEl = document.getElementById('info');
              if (infoEl) {
                infoEl.textContent = `${r.pages} halaman · ${r.land ? 'Landscape' : 'Portrait'} · Database Asli`;
              }
              const seg = segRef.current;
              if (seg) {
                const b = seg.querySelector('button.on');
                const i = seg.querySelector('i');
                if (b && i && (b as HTMLElement).offsetLeft !== undefined) {
                  (i as HTMLElement).style.width = (b as HTMLElement).offsetWidth + 'px';
                  (i as HTMLElement).style.transform = `translateX(${((b as HTMLElement).offsetLeft - 4)}px)`;
                }
              }
            };

            if (segRef.current) {
              segRef.current.onclick = (e: any) => {
                const b = e.target.closest('button');
                if (!b) return;
                currentData.meta.orient = b.dataset.o;
                segRef.current?.querySelectorAll('button').forEach((btn: any) => {
                  const on = currentData.meta.orient === btn.dataset.o;
                  btn.classList.toggle('on', on);
                  btn.setAttribute('aria-checked', on ? 'true' : 'false');
                });
                draw();
              };
            }

            const fileInput = document.getElementById('file-input-custom') as HTMLInputElement;
            if (fileInput) {
              fileInput.onchange = (e: any) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                  try {
                    const d = JSON.parse(r.result as string);
                    if (!d || !Array.isArray(d.items)) throw new Error();
                    dataRef.current = d;
                    draw();
                    showToast('Data dimuat');
                  } catch (_) {
                    showToast('File JSON tidak valid');
                  }
                };
                r.readAsText(f);
              };
            }

            const bPrn = document.getElementById('bPrn');
            if (bPrn) bPrn.onclick = () => { draw(); setTimeout(() => window.print(), 60); };

            window.addEventListener('resize', () => fit(wrap, host));
            draw();
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(draw);
            }
          } catch (e) {
            console.error('Render error:', e);
          }
        }
      }, 100);
    };

    loadData();
  }, []);

  const handleExportJPEG = async () => {
    if (!hostRef.current || isExporting) return;
    setIsExporting('jpeg');
    try {
      const pemohon = dataRef.current?.sign?.pemohon?.name || 'dokumen';
      const cleanName = `Pengajuan-Barang-${pemohon.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await downloadJPEG(hostRef.current, { name: cleanName });
      showToast('JPEG berhasil diunduh');
    } catch (e: any) {
      showToast(e.message || 'Gagal mengunduh JPEG');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!hostRef.current || isExporting) return;
    setIsExporting('pdf');
    try {
      const pemohon = dataRef.current?.sign?.pemohon?.name || 'dokumen';
      const cleanName = `Pengajuan-Barang-${pemohon.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await downloadPDF(hostRef.current, { name: cleanName });
      showToast('PDF berhasil diunduh');
    } catch (e: any) {
      showToast(e.message || 'Gagal mengunduh PDF');
    } finally {
      setIsExporting(null);
    }
  };

  if (errorMessage) {
    return (
      <div className="pengajuan-barang-pratinjau-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#fff', borderRadius: '24px', padding: '36px 28px', textAlign: 'center', boxShadow: '0 20px 45px -15px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', margin: '0 auto 18px', fontSize: '24px' }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#1f2937' }}>
            Gagal Memuat Dokumen
          </h2>
          <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.55, margin: '0 0 24px' }}>
            {errorMessage}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { window.location.href = '/pengajuan-barang'; }}
              style={{ padding: '12px 24px', borderRadius: '999px', background: '#2f3b6b', color: '#fff', fontWeight: 600, fontSize: '14px', border: 0, cursor: 'pointer' }}
            >
              Kembali ke Formulir
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '12px 20px', borderRadius: '999px', background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '14px', border: '1px solid #d1d5db', cursor: 'pointer' }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pengajuan-barang-pratinjau-container">
      <header className="sa-bar">
        <div className="sa-ttl">
          <b>Dokumen Pengajuan Barang</b>
          <small id="info">{loading ? 'Memuat dari Database...' : 'Siap'}</small>
        </div>

        <div className="sa-seg" ref={segRef} id="seg" role="radiogroup" aria-label="Orientasi kertas">
          <i></i>
          <button type="button" role="radio" data-o="landscape" className="on">Landscape</button>
          <button type="button" role="radio" data-o="portrait">Portrait</button>
        </div>

        <label className="sa-btn" htmlFor="file-input-custom" style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
          <span>Muat data</span>
        </label>
        <input id="file-input-custom" className="sa-sr" type="file" accept="application/json,.json" />

        <button
          type="button"
          className={`sa-btn ${isExporting === 'jpeg' ? 'load' : ''}`}
          id="bJpg"
          onClick={handleExportJPEG}
          disabled={loading || !!isExporting}
        >
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/></svg>
          <span>Unduh JPEG</span>
          <i className="sp"></i>
        </button>

        <button
          type="button"
          className={`sa-btn dk ${isExporting === 'pdf' ? 'load' : ''}`}
          id="bPdf"
          onClick={handleExportPDF}
          disabled={loading || !!isExporting}
        >
          <svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 14h6M10 18h4"/></svg>
          <span>Unduh PDF</span>
          <i className="sp"></i>
        </button>

        <button type="button" className="sa-btn" id="bPrn" disabled={loading}>
          <svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>
          <span>Cetak</span>
        </button>
      </header>

      <main className="sa-stage">
        <div className="pd-wrap" ref={wrapRef} id="wrap">
          <div className="pd-paper" ref={hostRef} id="doc"></div>
        </div>
      </main>

      <div className="sa-toast" ref={toastRef} id="toast" role="status"></div>
    </div>
  );
};
