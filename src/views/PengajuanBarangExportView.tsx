import React, { useEffect, useMemo } from 'react';

export interface PengajuanBarangExportViewProps {
  onBack?: () => void;
}

export const PengajuanBarangExportView: React.FC<PengajuanBarangExportViewProps> = ({ onBack }) => {
  // 1. Proteksi Autentikasi: Jika token di localStorage kosong, arahkan ke /login
  useEffect(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('laporanwee_token');

    if (!token) {
      console.warn('[PengajuanBarangExportView] Token tidak ditemukan, mengalihkan ke /login');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  }, []);

  const id = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('id');
  }, []);

  const token = useMemo(() => {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('laporanwee_token') ||
      ''
    );
  }, []);

  const iframeSrc = useMemo(() => {
    const base = 'https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/index.php';
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    if (token) params.set('token', token);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [id, token]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.pushState({}, '', '/pengajuan-barang');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#eceef3] flex flex-col m-0 p-0 font-sans">
      {/* Floating Header Bar */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1c2340]/90 hover:bg-[#1c2340] active:scale-95 text-white text-xs font-semibold shadow-xl backdrop-blur-md transition-all cursor-pointer border border-white/20 select-none"
          title="Kembali ke formulir pengajuan barang"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Kembali ke Pengajuan Barang</span>
        </button>
      </div>

      {/* Official A4 Document Iframe */}
      <iframe
        src={iframeSrc}
        title="Dokumen Resmi Pengajuan Barang"
        className="w-full h-full border-0 block flex-1"
        style={{ width: '100%', height: '100vh', border: 'none' }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default PengajuanBarangExportView;
