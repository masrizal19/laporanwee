import React, { useState } from 'react';
import { ViewType } from '../types';

export interface ChatViewProps {
  onNavigate?: (view: ViewType) => void;
  onAddToast?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Token Bearer akun yang sedang login disinkronkan secara otomatis dari localStorage ke URL iframe
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('laporanwee_token') ||
        localStorage.getItem('access_token') ||
        ''
      : '';

  const iframeSrc = `https://api-laporanwe.mkverse.my.id/api/chat/index.php?token=${encodeURIComponent(token)}`;

  return (
    <div className="flex-1 h-[calc(100vh-24px)] flex flex-col min-w-0">
      <div className="w-full h-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#181622]/90 backdrop-blur-2xl shadow-xl relative">
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

        {/* Iframe resmi PHP */}
        <iframe
          src={iframeSrc}
          title="Pesan Tim"
          className="w-full h-full border-none block"
          allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; display-capture; geolocation"
          loading="eager"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

export default ChatView;
