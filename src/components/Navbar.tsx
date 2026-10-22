import React, { useState, useEffect } from 'react';
import { ViewType } from '../types';
import { Icon } from './icons';

export interface NavbarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  onLogout: () => void;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  menuIconUrl?: string | null;
  signoutIconUrl?: string | null;
  isAdmin?: boolean;
  onOpenWhatsNew?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onAddToast,
  onLogout,
  userEmail,
  userName,
  avatarUrl,
  logoUrl,
  isAdmin: isAdminProp,
  onOpenWhatsNew,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('laporanwee_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('laporanwee_theme', theme);
    } catch (_) {}
  }, [theme]);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const navItems: { view: ViewType; label: string; icon: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: 'home' },
    { view: 'projects', label: 'Proyek', icon: 'folder' },
    { view: 'reports', label: 'Laporan', icon: 'doc' },
    { view: 'tasks', label: 'Tugas', icon: 'checksq' },
    { view: 'social-media', label: 'Sosial Media', icon: 'share' },
    { view: 'team', label: 'Tim', icon: 'users' },
    { view: 'calendar', label: 'Kalender', icon: 'calendar' },
    { view: 'analytics', label: 'Analitik', icon: 'chart' },
    { view: 'profil', label: 'Pengaturan Profil', icon: 'user' },
    { view: 'ui_settings', label: 'UI Setting', icon: 'sliders' },
  ];

  // Compute active nav index for the sliding pill
  const activeNavIndex = navItems.findIndex((item) => {
    if (currentView === item.view) return true;
    if (item.view === 'projects' && currentView === 'project-detail') return true;
    if (item.view === 'reports' && (currentView === 'report-detail' || currentView === 'create-report')) return true;
    if (item.view === 'profil' && (currentView === 'profile' || currentView === 'profil')) return true;
    if (item.view === 'ui_settings' && (currentView === 'ui-settings' || currentView === 'ui_settings')) return true;
    return false;
  });

  // Current active view label for topbar breadcrumb
  const currentNav = navItems.find((item) => {
    if (currentView === item.view) return true;
    if (item.view === 'projects' && currentView === 'project-detail') return true;
    if (item.view === 'reports' && (currentView === 'report-detail' || currentView === 'create-report')) return true;
    if (item.view === 'profil' && (currentView === 'profile' || currentView === 'profil')) return true;
    if (item.view === 'ui_settings' && (currentView === 'ui-settings' || currentView === 'ui_settings')) return true;
    return false;
  });
  const breadcrumbTitle =
    currentView === 'create-report'
      ? 'Buat Laporan Harian'
      : currentView === 'report-detail'
      ? 'Detail Laporan'
      : currentView === 'project-detail'
      ? 'Detail Proyek'
      : currentView === 'profil' || currentView === 'profile'
      ? 'Pengaturan Profil'
      : currentView === 'ui_settings' || currentView === 'ui-settings'
      ? 'UI Setting'
      : currentNav?.label || 'Dashboard';

  // Compute User Initials
  const userInitials = (userName || userEmail || 'AD')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      {/* Floating Rail Navigation (Desktop) & Bottom Dock Pill (Mobile) */}
      <aside className="rail" aria-label="Navigasi Utama">
        <button
          type="button"
          className="logo"
          onClick={() => onNavigate('dashboard')}
          title="Ke Dashboard"
        >
          <b>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
              />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13c3-6 11-6 14 0M8 17c2-3 6-3 8 0" />
              </svg>
            )}
          </b>
          <em>
            Laporan<span>Wee</span>
          </em>
        </button>

        <nav className="nav" id="nav-rail">
          {activeNavIndex >= 0 && (
            <div
              className="pill"
              style={{ transform: `translateY(${activeNavIndex * 54}px)` }}
            />
          )}

          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'projects' && currentView === 'project-detail') ||
              (item.view === 'reports' && (currentView === 'report-detail' || currentView === 'create-report'));

            return (
              <button
                key={item.view}
                type="button"
                className={isActive ? 'on' : ''}
                onClick={() => onNavigate(item.view)}
                title={item.label}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="rail-foot">
          <button
            type="button"
            onClick={onLogout}
            title="Keluar dari akun"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Top Bar Header with Breadcrumb, Theme Toggle, Quick Search, User Profile */}
      <header className="top-bar-shell">
        <div className="crumb">{breadcrumbTitle}</div>

        <div className="top-actions">
          {/* Theme Switcher Sliding Pill */}
          <div className="theme" role="group" aria-label="Tema Tampilan">
            <div className="knob" />
            <button
              type="button"
              data-t="light"
              onClick={() => toggleTheme('light')}
              aria-label="Mode Terang"
              title="Mode Terang"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            </button>
            <button
              type="button"
              data-t="dark"
              onClick={() => toggleTheme('dark')}
              aria-label="Mode Gelap"
              title="Mode Gelap"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
              </svg>
            </button>
          </div>

          {/* Quick Search Round Button */}
          <button
            type="button"
            className="round"
            onClick={() => onNavigate('tasks')}
            aria-label="Cari Tugas & Proyek"
            title="Cari Cepat"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          {/* User Profile Avatar with Gradient Ring */}
          <div
            className="avatar"
            onClick={() => onNavigate('profile')}
            title={`Pengaturan Profil: ${userName || userEmail || 'Pengguna'}`}
            role="button"
            tabIndex={0}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName || 'Avatar'}
                className="avatar-img"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = parent.querySelector('.avatar-initial') as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <span
              className="avatar-initial"
              style={{
                display: avatarUrl ? 'none' : 'flex',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
                color: '#2a2440',
                lineHeight: 1,
              }}
            >
              {(userName || userEmail || 'AD').trim().charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>
    </>
  );
};
