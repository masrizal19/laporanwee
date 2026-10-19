import React, { useState, useRef, useEffect } from 'react';
import { ViewType } from '../types';
import { Icon } from './icons';
import { getAbsoluteAvatarUrl } from '../utils/api';

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
  menuIconUrl,
  signoutIconUrl,
  isAdmin: isAdminProp,
  onOpenWhatsNew,
}) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAdmin =
    isAdminProp !== undefined
      ? isAdminProp
      : Boolean(
          userEmail &&
            (userEmail.trim().toLowerCase() === 'rizalsaragih498@gmail.com' ||
              userEmail.toLowerCase().includes('rizal') ||
              userEmail.toLowerCase().includes('rizqy'))
        );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { view: ViewType; label: string; icon: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: 'home' },
    { view: 'projects', label: 'Proyek', icon: 'folder' },
    { view: 'reports', label: 'Laporan', icon: 'doc' },
    { view: 'tasks', label: 'Tugas', icon: 'checksq' },
    { view: 'social-media', label: 'Sosial Media', icon: 'share' },
    { view: 'team', label: 'Tim', icon: 'users' },
    { view: 'calendar', label: 'Kalender', icon: 'calendar' },
    { view: 'analytics', label: 'Analitik', icon: 'chart' },
  ];

  const activeIndex = navItems.findIndex(
    (item) =>
      currentView === item.view ||
      (item.view === 'projects' && currentView === 'project-detail') ||
      (item.view === 'reports' &&
        (currentView === 'report-detail' || currentView === 'create-report'))
  );

  const activeViewLabel =
    activeIndex >= 0 ? navItems[activeIndex].label : 'Dashboard';

  const userInitial = (userName || userEmail || 'U').trim().charAt(0).toUpperCase();
  const finalAvatar = getAbsoluteAvatarUrl(avatarUrl, userName || userEmail);

  return (
    <>
      {/* ========================================================
          LEFT GLASS SIDEBAR RAIL (Desktop) & BOTTOM DOCK (Mobile)
          ======================================================== */}
      <aside className="lw-rail" aria-label="Navigasi Utama">
        <button
          type="button"
          className="lw-rail-logo"
          onClick={() => onNavigate('dashboard')}
          title="LaporanWee - Dashboard"
        >
          <b>
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M5 13c3-6 11-6 14 0M8 17c2-3 6-3 8 0" />
              </svg>
            )}
          </b>
          <em>
            Laporan<span>Wee</span>
          </em>
        </button>

        <nav className="lw-rail-nav">
          {activeIndex >= 0 && (
            <div
              className="lw-pill"
              style={{ transform: `translateY(${activeIndex * 53}px)` }}
            />
          )}

          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'projects' && currentView === 'project-detail') ||
              (item.view === 'reports' &&
                (currentView === 'report-detail' || currentView === 'create-report'));

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

        <div className="lw-rail-foot">
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('ui-settings')}
              title="Pengaturan Tampilan UI (Admin)"
            >
              <Icon name="palette" />
              <span>Tema &amp; UI</span>
            </button>
          )}

          <button
            type="button"
            className="danger"
            onClick={onLogout}
            title="Keluar dari Akun"
          >
            <Icon name="logout" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          TOPBAR INSIDE MAIN (Breadcrumb, Notif & Profile Dropdowns)
          ======================================================== */}
      <header className="lw-topbar">
        <div className="lw-crumb">
          <span>Halaman</span>
          <span>/</span>
          <strong>{activeViewLabel}</strong>
        </div>

        <div className="lw-top-actions">
          {/* Notifications Dropdown */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="lw-round-btn"
              onClick={() => {
                setShowNotifs(!showNotifs);
                setShowProfile(false);
                if (!showNotifs) setUnreadCount(0);
              }}
              title="Notifikasi"
              aria-label="Notifikasi"
            >
              <Icon name="bell" />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '9px',
                    right: '9px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--bad, #d9534f)',
                    boxShadow: '0 0 0 2px #fff',
                  }}
                />
              )}
            </button>

            {showNotifs && (
              <div
                className="dropdown-panel notif-panel show"
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: '0',
                  zIndex: 80,
                  width: '320px',
                  background: 'var(--glass-solid, #ffffff)',
                  border: '1px solid var(--line)',
                  borderRadius: '24px',
                  boxShadow: 'var(--shadow)',
                  padding: '16px',
                  animation: 'modalPop 0.25s var(--ease)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Notifikasi Tim</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Terbaru</span>
                </div>
                <div
                  className="notif-row"
                  style={{ padding: '8px', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => {
                    setShowNotifs(false);
                    onNavigate('reports');
                  }}
                >
                  <b style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>Laporan Disetujui</b>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                    Laporan kerja harian kamu telah direview oleh tim.
                  </p>
                </div>
                <div
                  className="notif-row"
                  style={{ padding: '8px', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onClick={() => {
                    setShowNotifs(false);
                    onNavigate('tasks');
                  }}
                >
                  <b style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>Tugas Baru Ditugaskan</b>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                    Kamu ditugaskan pada deliverable sprint kreatif hari ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill & Dropdown */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="lw-avatar-badge"
              onClick={() => {
                setShowProfile(!showProfile);
                setShowNotifs(false);
              }}
              aria-label="Menu Pengguna"
              title={userName || userEmail || 'Profil'}
            >
              {finalAvatar ? (
                <img
                  src={finalAvatar}
                  alt="Avatar"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                userInitial
              )}
            </button>

            {showProfile && (
              <div
                className="dropdown-panel show"
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: '0',
                  zIndex: 80,
                  width: '240px',
                  background: 'var(--glass-solid, #ffffff)',
                  border: '1px solid var(--line)',
                  borderRadius: '24px',
                  boxShadow: 'var(--shadow)',
                  padding: '12px',
                  animation: 'modalPop 0.25s var(--ease)',
                }}
              >
                <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                    {userName || userEmail?.split('@')[0] || 'Anggota Tim'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    {userEmail || 'user@laporanwee.agency'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => {
                      setShowProfile(false);
                      onNavigate('profile');
                    }}
                  >
                    <Icon name="palette" style={{ width: 16, height: 16 }} />
                    <span>Lihat Profil Saya</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => {
                      setShowProfile(false);
                      onNavigate('analytics');
                    }}
                  >
                    <Icon name="chart" style={{ width: 16, height: 16 }} />
                    <span>Analitik &amp; Statistik</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--ink)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => {
                        setShowProfile(false);
                        onNavigate('ui-settings');
                      }}
                    >
                      <Icon name="sliders" style={{ width: 16, height: 16 }} />
                      <span>Pengaturan UI Admin</span>
                    </button>
                  )}

                  {onOpenWhatsNew && (
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--ink)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => {
                        setShowProfile(false);
                        onOpenWhatsNew();
                      }}
                    >
                      <Icon name="checksq" style={{ width: 16, height: 16 }} />
                      <span>Apa yang Baru di v3.0</span>
                    </button>
                  )}

                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--bad, #d9534f)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                      marginTop: '4px',
                      borderTop: '1px solid var(--line)',
                    }}
                    onClick={() => {
                      setShowProfile(false);
                      onLogout();
                    }}
                  >
                    <Icon name="logout" style={{ width: 16, height: 16 }} />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
