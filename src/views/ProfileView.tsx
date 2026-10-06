import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Report, ViewType } from '../types';
import { profileService, setStoredUser, getStoredUser } from '../utils/api';
import '../profile-edit.css';

interface ProfileViewProps {
  projects: Project[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: { email: string; name: string; avatar_url?: string }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // User Profile State
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna');
  const [role, setRole] = useState('Profile User');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [location, setLocation] = useState('LaporanWee Web');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTempName(name);
  }, [name]);

  // Apply Theme from Profile API to CSS Variables
  const applyTheme = useCallback((themeObj?: any) => {
    if (!themeObj || typeof themeObj !== 'object') return;
    const targetEl = rootRef.current || document.documentElement;

    if (themeObj.accent_color) targetEl.style.setProperty('--profile-accent', themeObj.accent_color);
    if (themeObj.primary_color) targetEl.style.setProperty('--profile-primary', themeObj.primary_color);
    if (themeObj.text_color) targetEl.style.setProperty('--profile-text', themeObj.text_color);
    if (themeObj.muted_color) targetEl.style.setProperty('--profile-muted', themeObj.muted_color);
    if (themeObj.background_color) targetEl.style.setProperty('--profile-bg', themeObj.background_color);
    if (themeObj.surface_color) targetEl.style.setProperty('--profile-surface', themeObj.surface_color);
  }, []);

  // Primary: Load Profile data from modular /api/profile/get.php
  const loadProfile = useCallback(async (quiet = false) => {
    try {
      const res = await profileService.getProfile();
      if (res && res.success && res.data) {
        const d = res.data;
        if (d.full_name) setName(d.full_name);
        if (d.email) setEmail(d.email);
        if (d.role) setRole(d.role);
        if (d.location) setLocation(d.location);
        if (d.avatar_url) {
          const avatarWithBust = `${d.avatar_url}${d.avatar_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
          setAvatarUrl(avatarWithBust);
        } else if (d.avatar === null || d.avatar_url === null) {
          setAvatarUrl(null);
        }

        if (d.theme) {
          applyTheme(d.theme);
        }
      }
    } catch (err: any) {
      if (!quiet) {
        console.warn('[PROFILE] loadProfile error:', err);
      }
    }
  }, [applyTheme]);

  useEffect(() => {
    loadProfile(true);
  }, [loadProfile]);

  // Save Full Profile via /api/profile/update.php
  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const res = await profileService.updateName(trimmedName);
      if (res && res.success) {
        onAddToast('Profil berhasil disimpan!');
        if (onUpdateUser) {
          onUpdateUser({
            name: trimmedName,
            email,
            avatar_url: avatarUrl || undefined,
          });
        }
        const stored = getStoredUser();
        if (stored) {
          setStoredUser({
            ...stored,
            name: trimmedName,
            full_name: trimmedName,
          });
        }
      } else {
        onAddToast(res?.message || 'Gagal menyimpan profil.');
      }
    } catch (err: any) {
      onAddToast('Gagal menyimpan profil: ' + (err.message || 'Kesalahan server'));
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate to dedicated crop page
  const handleGoToCrop = () => {
    onNavigate('profile-crop');
  };

  // Generate SVG avatar placeholder with initials
  const getInitialsAvatar = () => {
    const initials = (name || email || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="%23222222"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="bold" fill="%23ffffff">${initials}</text></svg>`;
  };

  return (
    <div className="profile-page-root" ref={rootRef}>
      {/* Top Bar Header */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('dashboard')}
            aria-label="Kembali ke dashboard"
            title="Kembali ke Dashboard"
          >
            ←
          </button>
          <span className="profile-brand-title">Edit Profile</span>
        </div>
        <div>
          <button
            type="button"
            className="profile-top-save-btn"
            id="topSaveBtn"
            onClick={handleSaveProfile}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="profile-shell-main">
        <h1 className="profile-main-title">Profile</h1>

        {/* Hero Section: Photo and Intro */}
        <section className="profile-hero-section">
          <div className="profile-hero-copy">
            <div className="profile-hero-kicker">PROFILE PHOTO</div>
            <h2>Foto Akun &amp; Identitas</h2>
            <p>
              Sesuaikan foto profil Anda. Klik tombol edit pada foto untuk membuka halaman pemotongan foto (crop).
            </p>
          </div>

          <div className="profile-avatar-stage">
            <div className="profile-avatar-wrap-box">
              <img
                id="avatar"
                src={avatarUrl || getInitialsAvatar()}
                alt="Profile Avatar"
                className="profile-avatar-element"
                onError={() => {
                  setAvatarUrl(null);
                }}
              />
              <button
                type="button"
                className="profile-avatar-edit-button"
                id="openPhotoCropBtn"
                onClick={handleGoToCrop}
                title="Atur Crop Foto"
                aria-label="Atur Crop Foto"
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="m14.5 7.5 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Rows Information List */}
        <section className="profile-rows-list">
          {/* Row 1: Name */}
          <div
            className={`profile-detail-row ${isEditingName ? 'is-active-edit' : 'is-clickable'}`}
            id="nameRow"
            onClick={() => {
              if (!isEditingName) setIsEditingName(true);
            }}
          >
            <div className="profile-row-label-text">Name</div>
            {isEditingName ? (
              <input
                id="nameEdit"
                type="text"
                className="profile-name-edit-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  const trimmed = tempName.trim();
                  if (trimmed) {
                    setName(trimmed);
                  } else {
                    setTempName(name);
                  }
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTempName(name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="profile-row-value-text" id="name">
                {name || '—'}
              </div>
            )}
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 2: Email */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Email</div>
            <div className="profile-row-value-text is-muted" id="email">
              {email || '—'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 3: Title */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Title</div>
            <div className="profile-row-value-text is-muted" id="role">
              {role || 'Profile User'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 4: Location */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Location</div>
            <div className="profile-row-value-text is-muted">
              {location || 'Not set'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>
        </section>
      </main>
    </div>
  );
};
