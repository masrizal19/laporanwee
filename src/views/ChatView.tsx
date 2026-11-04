import React, { useEffect, useState } from 'react';
import { AuthUser } from '../types';

interface ChatViewProps {
  currentUser?: AuthUser | null;
  onAddToast?: (text: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ currentUser }) => {
  const [token, setToken] = useState<string>('');
  const [theme, setTheme] = useState<string>('light');

  useEffect(() => {
    const savedToken =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      '';
    setToken(savedToken);

    const savedTheme = localStorage.getItem('laporanwee_theme') || 'light';
    setTheme(savedTheme);

    try {
      localStorage.setItem('lw-th', savedTheme);
    } catch (_) {}

    // Listen for theme changes on root HTML
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.dataset.theme || 'light';
      setTheme(currentTheme);
      try {
        localStorage.setItem('lw-th', currentTheme);
      } catch (_) {}
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const chatUrl = `/chat.html?token=${encodeURIComponent(token)}&theme=${encodeURIComponent(theme)}${
    currentUser?.name ? `&name=${encodeURIComponent(currentUser.name)}` : ''
  }`;

  return (
    <div
      className="w-full h-full flex-1 rounded-2xl md:rounded-3xl overflow-hidden border border-white/40 dark:border-white/10 bg-white/60 dark:bg-[#1a1829]/80 backdrop-blur-2xl shadow-xl relative z-10 flex flex-col min-w-0"
      style={{
        width: '100%',
        height: 'calc(100vh - 24px)',
        maxHeight: 'calc(100vh - 24px)',
        boxShadow: '0 20px 50px -15px rgba(60, 50, 110, 0.18)',
      }}
    >
      <iframe
        src={chatUrl}
        title="Pesan Tim"
        className="w-full h-full border-none block flex-1"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          borderRadius: '20px',
          background: 'transparent',
        }}
        allow="camera; microphone; clipboard-write"
      />
    </div>
  );
};

export default ChatView;
