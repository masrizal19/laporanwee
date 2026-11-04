import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';

export interface ChatViewProps {
  onNavigate?: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Kunci scroll body selama berada di rute /chat agar pas 1 layar penuh
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Kirim perintah tutup pratinjau ke dalam iframe
  const sendClosePreviewToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    const payloads = [
      { type: 'CHAT_FILE_PREVIEW_CLOSE', action: 'close' },
      { type: 'CHAT_FILE_PREVIEW', action: 'close', open: false },
      { action: 'close_preview' },
      'CHAT_FILE_PREVIEW_CLOSE',
    ];
    payloads.forEach((p) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(p, '*');
      } catch (_) {}
    });
  }, []);

  // Tangkap sinyal postMessage CHAT_FILE_PREVIEW dari iframe chat
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      const isPreviewOpen =
        data === 'CHAT_FILE_PREVIEW' ||
        data === 'CHAT_FILE_PREVIEW_OPEN' ||
        data?.type === 'CHAT_FILE_PREVIEW_OPEN' ||
        (data?.type === 'CHAT_FILE_PREVIEW' && data?.action !== 'close' && data?.status !== 'close' && data?.open !== false && data?.isOpen !== false) ||
        (data?.action === 'CHAT_FILE_PREVIEW' && data?.status !== 'close');

      const isPreviewClose =
        data === 'CHAT_FILE_PREVIEW_CLOSE' ||
        data?.type === 'CHAT_FILE_PREVIEW_CLOSE' ||
        data?.action === 'close_preview' ||
        (data?.type === 'CHAT_FILE_PREVIEW' && (data?.action === 'close' || data?.status === 'close' || data?.open === false || data?.isOpen === false)) ||
        (data?.action === 'CHAT_FILE_PREVIEW' && (data?.status === 'close' || data?.action === 'close'));

      if (isPreviewOpen && !isPreviewClose) {
        if (!window.location.pathname.includes('/chat/preview-file')) {
          window.history.pushState({ isChatPreview: true }, '', '/chat/preview-file');
        }
      } else if (isPreviewClose) {
        if (window.location.pathname.includes('/chat/preview-file')) {
          window.history.pushState({}, '', '/chat');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Event popstate aktif sehingga tombol 'Back' di browser menutup pratinjau berkas secara mulus tanpa keluar dari chat
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('preview-file')) {
        sendClosePreviewToIframe();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [sendClosePreviewToIframe]);

  // Pertahankan penyaluran token otomatis dari localStorage ke URL iframe
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('laporanwee_token') ||
        localStorage.getItem('access_token') ||
        ''
      : '';

  const iframeUrl = `https://api-laporanwe.mkverse.my.id/api/chat/index.php?token=${encodeURIComponent(token)}`;

  return (
    <div className="w-full h-[calc(100vh-76px)] max-h-[calc(100vh-76px)] flex flex-col min-h-0 overflow-hidden pr-4 pb-3">
      <div className="w-full h-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#181622]/40 backdrop-blur-2xl shadow-xl flex-1 flex flex-col min-h-0 relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-[#181622]/80 backdrop-blur-sm pointer-events-none transition-opacity duration-300">
            <div className="w-10 h-10 rounded-2xl bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] flex items-center justify-center shadow-md animate-pulse mb-3">
              <svg
                className="w-5 h-5 animate-spin"
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
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Memuat Pesan Tim...</p>
          </div>
        )}

        {/* Iframe Chat PHP Resmi */}
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          title="Pesan Tim"
          className="w-full h-full border-none block flex-1"
          allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; display-capture; geolocation"
          loading="eager"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

export default ChatView;
