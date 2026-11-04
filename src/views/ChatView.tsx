import React, { useState, useRef, useEffect } from 'react';
import { ViewType } from '../types';

export interface ChatViewProps {
  onNavigate?: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onNavigate, onAddToast }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Ambil token login (Bearer Token) aktif dari localStorage secara otomatis
  const token =
    (typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('laporanwee_token') ||
        localStorage.getItem('access_token') ||
        ''
      : '');

  const chatUrl = `https://api-laporanwe.mkverse.my.id/api/chat/index.php?token=${encodeURIComponent(token)}`;

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((prev) => prev + 1);
    if (onAddToast) {
      onAddToast('Memuat ulang ruang Pesan Tim...');
    }
  };

  const handleOpenExternal = () => {
    if (typeof window !== 'undefined') {
      window.open(chatUrl, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    // Reset loading state on reload
    setIsLoading(true);
    setHasError(false);
  }, [reloadKey]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-2 pt-1 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1e1d2b] text-white flex items-center justify-center shadow-md">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 leading-tight">
                Pesan Tim
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Kolaborasi & diskusi langsung antar tim LaporanWee
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleReload}
            title="Muat ulang chat"
            className="p-2.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-gray-600 hover:text-gray-900 transition-colors shadow-xs"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>

          {/* Open in new tab */}
          <button
            type="button"
            onClick={handleOpenExternal}
            title="Buka di tab baru"
            className="p-2.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-gray-600 hover:text-gray-900 transition-colors shadow-xs"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Responsive Iframe Container */}
      <div className="w-full h-[calc(100vh-140px)] sm:h-[calc(100vh-130px)] md:h-[calc(100vh-120px)] lg:h-[calc(100vh-110px)] min-h-[520px] rounded-3xl overflow-hidden bg-white border border-black/10 shadow-card flex flex-col relative transition-all duration-200">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity duration-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1e1d2b] to-[#403b60] flex items-center justify-center text-white shadow-lg animate-pulse mb-3">
              <svg
                className="w-6 h-6 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Menghubungkan ke Pesan Tim...</p>
            <p className="text-xs text-gray-400 mt-1">Mengautentikasi sesi token aktif</p>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-800">Gagal memuat Pesan Tim</h3>
            <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
              Terjadi kendala saat menghubungkan ke server obrolan tim. Periksa koneksi internet Anda atau muat ulang halaman.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="px-4 py-2 rounded-xl bg-[#1e1d2b] text-white text-xs font-medium hover:bg-black transition-colors"
              >
                Coba Lagi
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Kembali ke Dashboard
                </button>
              )}
            </div>
          </div>
        )}

        {/* Iframe */}
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={chatUrl}
          title="Pesan Tim"
          className="w-full h-full flex-1 border-0 bg-white"
          allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; display-capture; geolocation"
          loading="eager"
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      </div>
    </div>
  );
};

export default ChatView;
