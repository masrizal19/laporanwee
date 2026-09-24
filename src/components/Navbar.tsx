import React, { useState, useEffect, useRef } from 'react';
import { ViewType } from '../types';
import { Icon } from './icons';

interface NavbarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onAddToast }) => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    { view: 'team', label: 'Tim', icon: 'users' },
    { view: 'calendar', label: 'Kalender', icon: 'calendar' },
    { view: 'analytics', label: 'Analitik', icon: 'chart' },
  ];

  return (
    <>
      <header className="topnav">
        <button
          className="brand"
          onClick={() => onNavigate('dashboard')}
          title="Kembali ke Dashboard"
        >
          <span>Laporan</span>
          <span className="wee">
            Wee
            <svg
              width="28"
              height="8"
              viewBox="0 0 28 8"
              fill="none"
              style={{ position: 'absolute', bottom: '-4px', left: '0' }}
            >
              <path
                d="M1 5.5C8 1.5 20 1.5 27 6.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>

        <nav className="nav-links" aria-label="Navigasi Utama">
          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'projects' && currentView === 'project-detail') ||
              (item.view === 'reports' && (currentView === 'report-detail' || currentView === 'create-report'));

            return (
              <button
                key={item.view}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.view)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="nav-right">
          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className={`icon-btn ${showNotifs ? 'open' : ''}`}
              onClick={() => {
                setShowNotifs(!showNotifs);
                setShowProfile(false);
                if (!showNotifs) setUnreadCount(0);
              }}
              title="Notifikasi"
              aria-label="Notifikasi"
            >
              <Icon name="bell" />
              {unreadCount > 0 && <span className="dot-badge" />}
            </button>

            <div className={`dropdown-panel notif-panel ${showNotifs ? 'show' : ''}`}>
              <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifikasi</span>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>Terbaru</span>
              </div>
              <div
                className="notif-row"
                onClick={() => {
                  setShowNotifs(false);
                  onNavigate('reports');
                }}
              >
                <span className="n-dot" />
                <div>
                  <b>Laporan Disetujui</b>
                  <p>Laporan mockup homepage kamu telah disetujui Pak Budi.</p>
                </div>
              </div>
              <div
                className="notif-row"
                onClick={() => {
                  setShowNotifs(false);
                  onNavigate('tasks');
                }}
              >
                <span className="n-dot" />
                <div>
                  <b>Tugas Baru Diberikan</b>
                  <p>Dimas menugaskan kamu di &ldquo;Website Redesign Wee&rdquo;.</p>
                </div>
              </div>
              <div
                className="notif-row"
                onClick={() => {
                  setShowNotifs(false);
                  onNavigate('team');
                }}
              >
                <span className="n-dot" style={{ background: 'var(--lime-deep)' }} />
                <div>
                  <b>Alvaro mengunggah video</b>
                  <p>4 b-roll footage take sunset telah selesai di-render.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile pill */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              className={`profile-pill ${showProfile ? 'open' : ''}`}
              onClick={() => {
                setShowProfile(!showProfile);
                setShowNotifs(false);
              }}
              aria-label="Menu Pengguna"
            >
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Rangga Arya"
                className="avatar"
              />
              <div className="meta">
                <div className="hi">Rangga Arya</div>
                <div className="mail">rangga@wee.agency</div>
              </div>
              <span className="chev">
                <Icon name="chevdown" />
              </span>
            </button>

            <div className={`dropdown-panel ${showProfile ? 'show' : ''}`}>
              <div
                className="dropdown-item"
                onClick={() => {
                  setShowProfile(false);
                  onNavigate('profile');
                }}
              >
                <Icon name="palette" />
                <span>Lihat Profil Saya</span>
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setShowProfile(false);
                  onNavigate('analytics');
                }}
              >
                <Icon name="chart" />
                <span>Statistik & Analitik</span>
              </div>
              <div
                className="dropdown-item"
                onClick={() => {
                  setShowProfile(false);
                  onAddToast('Tautan workspace disalin!');
                }}
              >
                <Icon name="laptop" />
                <span>Salin Tautan Tim</span>
              </div>
              <div
                className="dropdown-item"
                style={{ color: 'var(--danger)', borderTop: '1px solid var(--line-soft)', marginTop: '4px', paddingTop: '10px' }}
                onClick={() => {
                  setShowProfile(false);
                  onAddToast('Berhasil keluar dari sesi.');
                }}
              >
                <Icon name="x" />
                <span>Keluar (Sign Out)</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" aria-label="Navigasi Bawah Mobile">
        <button
          className={currentView === 'dashboard' ? 'active' : ''}
          onClick={() => onNavigate('dashboard')}
        >
          <Icon name="home" />
          <span>Dashboard</span>
        </button>
        <button
          className={currentView === 'projects' || currentView === 'project-detail' ? 'active' : ''}
          onClick={() => onNavigate('projects')}
        >
          <Icon name="folder" />
          <span>Proyek</span>
        </button>
        <button
          className={currentView === 'reports' || currentView === 'report-detail' || currentView === 'create-report' ? 'active' : ''}
          onClick={() => onNavigate('reports')}
        >
          <Icon name="doc" />
          <span>Laporan</span>
        </button>
        <button
          className={currentView === 'tasks' ? 'active' : ''}
          onClick={() => onNavigate('tasks')}
        >
          <Icon name="checksq" />
          <span>Tugas</span>
        </button>
        <button
          className={currentView === 'calendar' ? 'active' : ''}
          onClick={() => onNavigate('calendar')}
        >
          <Icon name="calendar" />
          <span>Kalender</span>
        </button>
        <button
          className={currentView === 'profile' ? 'active' : ''}
          onClick={() => onNavigate('profile')}
        >
          <Icon name="palette" />
          <span>Profil</span>
        </button>
      </nav>
    </>
  );
};
