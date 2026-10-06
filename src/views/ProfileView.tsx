import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Report, ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  getAbsoluteAvatarUrl,
  withAvatarCacheBust,
  getLatestProfileSaveTimestamp,
  recordProfileSaveTimestamp,
  syncAuthenticatedUser,
} from '../utils/api';
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
  onUpdateUser?: (updated: { email: string; name: string; avatar_url?: string | null }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // Profile State
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null);
  const [imageError, setImageError] = useState(false);

  // Inline editing state: 'name' | 'job' | 'status' | null
  const [editingField, setEditingField] = useState<'name' | 'job' | 'status' | null>(null);
  const [tempName, setTempName] = useState(name);
  const [tempJob, setTempJob] = useState(profileTitle);
  const [tempStatus, setTempStatus] = useState(profileStatus);

  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTempName(name);
  }, [name]);

  useEffect(() => {
    setTempJob(profileTitle);
  }, [profileTitle]);

  useEffect(() => {
    setTempStatus(profileStatus);
  }, [profileStatus]);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (initialAvatarUrl !== undefined) {
      setAvatarUrl(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null);
    }
  }, [initialAvatarUrl]);

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

  // Load Profile from modular /api/profile/get.php
  const loadProfile = useCallback(async (quiet = false) => {
    const requestInitiatedAt = Date.now();
    try {
      const res = await profileService.getProfile();
      if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

      if (res && res.success && res.data) {
        const d = res.data;
        const freshName = d.full_name || d.name;
        if (freshName) setName(freshName);
        if (d.email) setEmail(d.email);

        const freshTitle = d.profile_title !== undefined ? d.profile_title : (d.title || '');
        setProfileTitle(freshTitle);

        const freshStatus = d.profile_location !== undefined ? d.profile_location : (d.status || d.location || '');
        setProfileStatus(freshStatus);

        const rawAvatar = extractAvatarFromResponse(res);
        let freshAvatar = avatarUrl;
        if (rawAvatar !== undefined) {
          freshAvatar = rawAvatar ? withAvatarCacheBust(rawAvatar, d.updated_at || Date.now()) : null;
          setAvatarUrl(freshAvatar);
        }

        syncAuthenticatedUser({
          name: freshName || userName,
          email: d.email || userEmail,
          profile_title: freshTitle,
          profile_location: freshStatus,
          avatar_url: freshAvatar,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: freshName || userName,
            email: d.email || userEmail,
            avatar_url: freshAvatar,
          });
        }

        if (d.theme) {
          applyTheme(d.theme);
        }
      }
    } catch (err: any) {
      if (!quiet) {
        console.warn('[PROFILE] loadProfile notice:', err);
      }
    }
  }, [applyTheme, onUpdateUser, userEmail, userName, avatarUrl]);

  useEffect(() => {
    loadProfile(true);

    const handleProfileUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.name || detail.full_name) {
        setName(detail.name || detail.full_name);
      }
      if (detail.profile_title !== undefined) {
        setProfileTitle(detail.profile_title);
      }
      if (detail.profile_location !== undefined) {
        setProfileStatus(detail.profile_location);
      }
      if (detail.avatar_url !== undefined) {
        setAvatarUrl(detail.avatar_url ? withAvatarCacheBust(detail.avatar_url) : null);
      }
    };

    window.addEventListener('laporanwee-profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('laporanwee-profile-updated', handleProfileUpdated);
    };
  }, [loadProfile]);

  // Save Full Profile via POST /profile/save.php
  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedJob = profileTitle.trim();
      const trimmedStatus = profileStatus.trim();

      const res = await profileService.saveProfile({
        full_name: trimmedName,
        profile_title: trimmedJob,
        profile_location: trimmedStatus,
      });
      recordProfileSaveTimestamp();

      if (res && res.success) {
        onAddToast('Profil berhasil disimpan!');
        const d = res.data || res;
        const freshName = d.full_name || d.name || trimmedName;
        const freshJob = d.profile_title !== undefined ? d.profile_title : trimmedJob;
        const freshStatus = d.profile_location !== undefined ? d.profile_location : trimmedStatus;

        setName(freshName);
        setProfileTitle(freshJob);
        setProfileStatus(freshStatus);

        let freshAvatar = avatarUrl;
        if (d.avatar_url !== undefined) {
          freshAvatar = d.avatar_url ? withAvatarCacheBust(d.avatar_url, d.updated_at || Date.now()) : null;
          setAvatarUrl(freshAvatar);
        }

        syncAuthenticatedUser({
          name: freshName,
          email,
          profile_title: freshJob,
          profile_location: freshStatus,
          avatar_url: freshAvatar,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: freshName,
            email,
            avatar_url: freshAvatar,
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

  const handleGoToCrop = () => {
    onNavigate('profile-crop');
  };

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
            {isSaving ? 'Menyimpan...' : 'Simpan'}
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
                src={!imageError && avatarUrl ? getAbsoluteAvatarUrl(avatarUrl) : getInitialsAvatar()}
                alt="Profile Avatar"
                className="profile-avatar-element"
                onError={() => {
                  setImageError(true);
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
            className={`profile-detail-row ${editingField === 'name' ? 'is-active-edit' : 'is-clickable'}`}
            id="nameRow"
            onClick={() => {
              if (editingField !== 'name') {
                setTempName(name);
                setEditingField('name');
              }
            }}
          >
            <div className="profile-row-label-text">NAME</div>
            {editingField === 'name' ? (
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
                  setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTempName(name);
                    setEditingField(null);
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

          {/* Row 2: Email (Readonly) */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">EMAIL</div>
            <div className="profile-row-value-text is-muted" id="email">
              {email || '—'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 3: PEKERJAAN */}
          <div
            className={`profile-detail-row ${editingField === 'job' ? 'is-active-edit' : 'is-clickable'}`}
            id="jobRow"
            onClick={() => {
              if (editingField !== 'job') {
                setTempJob(profileTitle);
                setEditingField('job');
              }
            }}
          >
            <div className="profile-row-label-text">PEKERJAAN</div>
            {editingField === 'job' ? (
              <input
                id="jobEdit"
                type="text"
                className="profile-name-edit-input"
                value={tempJob}
                onChange={(e) => setTempJob(e.target.value)}
                onBlur={() => {
                  const trimmed = tempJob.trim();
                  setProfileTitle(trimmed);
                  setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTempJob(profileTitle);
                    setEditingField(null);
                  }
                }}
                placeholder="Contoh: Editor, Designer..."
                autoFocus
              />
            ) : (
              <div className="profile-row-value-text" id="profileTitle">
                {profileTitle ? profileTitle : <span className="is-muted">Belum diatur</span>}
              </div>
            )}
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 4: STATUS */}
          <div
            className={`profile-detail-row ${editingField === 'status' ? 'is-active-edit' : 'is-clickable'}`}
            id="statusRow"
            onClick={() => {
              if (editingField !== 'status') {
                setTempStatus(profileStatus || 'Karyawan');
                setEditingField('status');
              }
            }}
          >
            <div className="profile-row-label-text">STATUS</div>
            {editingField === 'status' ? (
              <select
                id="statusSelect"
                className="profile-name-edit-input"
                value={tempStatus}
                onChange={(e) => {
                  setTempStatus(e.target.value);
                  setProfileStatus(e.target.value);
                  setEditingField(null);
                }}
                onBlur={() => {
                  setEditingField(null);
                }}
                autoFocus
              >
                <option value="Karyawan">Karyawan</option>
                <option value="Anak Magang">Anak Magang</option>
                <option value="Anak PKL">Anak PKL</option>
              </select>
            ) : (
              <div className="profile-row-value-text" id="profileStatus">
                {profileStatus ? profileStatus : <span className="is-muted">Belum dipilih</span>}
              </div>
            )}
            <div className="profile-row-arrow-icon">›</div>
          </div>
        </section>
      </main>
    </div>
  );
};
