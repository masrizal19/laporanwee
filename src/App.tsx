import React, { useState, useEffect } from 'react';
import { LaporanWeeAuth } from './views/LaporanWeeAuth';
import { LaporanWeeDashboard } from './views/LaporanWeeDashboard';
import { API_CONFIG, UserProfileData } from './utils/apiConfig';
import './styles/laporanwee-ecosystem.css';

export function App() {
  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('laporanwee_theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Sync theme to document element
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('laporanwee_theme', theme);
    } catch (_) {}
  }, [theme]);

  // Auth session state
  const [token, setToken] = useState<string | null>(() => API_CONFIG.getAuthToken());
  const [user, setUser] = useState<UserProfileData>(() => API_CONFIG.getLocalUser());

  // Toast notifications
  const [toastText, setToastText] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const toastTimeoutRef = React.useRef<any>(null);

  const addToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2800);
  };

  // Re-verify and sync profile on start
  useEffect(() => {
    if (token) {
      API_CONFIG.profile
        .get()
        .then((fresh) => {
          if (fresh) setUser(fresh);
        })
        .catch(() => {});
    }
  }, [token]);

  // Listen to profile updates emitted across components
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setUser((prev) => ({
          ...prev,
          ...e.detail,
        }));
      }
    };
    window.addEventListener('laporanwee-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('laporanwee-profile-updated', handleProfileUpdate);
  }, []);

  // Login success handler
  const handleLoginSuccess = (authenticatedUser: UserProfileData, sessionToken: string) => {
    setUser(authenticatedUser);
    setToken(sessionToken);
  };

  // Logout handler
  const handleLogout = () => {
    API_CONFIG.clearAuth();
    setToken(null);
    addToast('Anda sudah keluar dari sesi');
  };

  const handleToggleTheme = (t: 'light' | 'dark') => {
    setTheme(t);
  };

  return (
    <div className="laporanwee-app">
      {token ? (
        <LaporanWeeDashboard
          user={user}
          onUpdateUser={(updated) => setUser(updated)}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onAddToast={addToast}
        />
      ) : (
        <LaporanWeeAuth
          onLoginSuccess={handleLoginSuccess}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onAddToast={addToast}
        />
      )}

      {/* Global Toast */}
      <div className={`lw-toast ${showToast ? 'show' : ''}`} role="status">
        {toastText}
      </div>
    </div>
  );
}

export default App;
