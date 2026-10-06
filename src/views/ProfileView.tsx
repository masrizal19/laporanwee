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
  onUpdateUser?: (updated: {
    email: string;
    name: string;
    avatar_url?: string | null;
    profile_title?: string;
    profile_location?: string;
  }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // Profile State (Committed State)
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null);
  const [imageError, setImageError] = useState(false);

  // Active editing state: 'name' | 'job' | 'status' | null
  const [editingField, setEditingField] = useState<'name' | 'job' | 'status' | null>(null);
  const [tempName, setTempName] = useState(name);
  const [tempJob, setTempJob] = useState(profileTitle);
  const [tempStatus, setTempStatus] = useState(profileStatus);

  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Ref to hold current props & state for event listeners without triggering useEffect re-runs
  const stateRef = useRef({ name, email, profileTitle, profileStatus, avatarUrl });
  useEffect(() => {
    stateRef.current = { name, email, profileTitle, profileStatus, avatarUrl };
  }, [name, email, profileTitle, profileStatus, avatarUrl]);

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

  // Load Profile once on mount (no dependency loop!)
  useEffect(() => {
    let isMounted = true;
    const requestInitiatedAt = Date.now();

    const fetchInitialProfile = async () => {
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

        if (res && res.success && res.data) {
          const d = res.data;
          const freshName = d.full_name || d.name || userName;
          const freshEmail = d.email || userEmail;
          const freshTitle = d.profile_title !== undefined ? d.profile_title : (d.title || '');
          const rawStatus = d.profile_location !== undefined ? d.profile_location : (d.status || d.location || '');
          const freshStatus = ['Karyawan', 'Anak Magang', 'Anak PKL'].includes(rawStatus) ? rawStatus : '';

          setName(freshName);
          setTempName(freshName);
          setEmail(freshEmail);
          setProfileTitle(freshTitle);
          setTempJob(freshTitle);
          setProfileStatus(freshStatus);
          setTempStatus(freshStatus);

          const rawAvatar = extractAvatarFromResponse(res);
          let freshAvatar: string | null = null;
          if (rawAvatar !== undefined) {
            freshAvatar = rawAvatar ? withAvatarCacheBust(rawAvatar, d.updated_at || Date.now()) : null;
            setAvatarUrl(freshAvatar);
          }

          syncAuthenticatedUser({
            name: freshName,
            email: freshEmail,
            profile_title: freshTitle,
            profile_location: freshStatus,
            avatar_url: freshAvatar,
          });

          if (onUpdateUser) {
            onUpdateUser({
              name: freshName,
              email: freshEmail,
              profile_title: freshTitle,
              profile_location: freshStatus,
              avatar_url: freshAvatar,
            });
          }

          if (d.theme) {
            applyTheme(d.theme);
          }
        }
      } catch (err) {
        console.warn('[PROFILE] Initial load notice:', err);
      }
    };

    fetchInitialProfile();

    // Listen to custom profile update event
    const handleProfileUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.name || detail.full_name) {
        const n = detail.name || detail.full_name;
        setName(n);
        setTempName(n);
      }
      if (detail.profile_title !== undefined) {
        setProfileTitle(detail.profile_title);
        setTempJob(detail.profile_title);
      }
      if (detail.profile_location !== undefined) {
        const validStatus = ['Karyawan', 'Anak Magang', 'Anak PKL'].includes(detail.profile_location) ? detail.profile_location : '';
        setProfileStatus(validStatus);
        setTempStatus(validStatus);
      }
      if (detail.avatar_url !== undefined) {
        setAvatarUrl(detail.avatar_url ? withAvatarCacheBust(detail.avatar_url) : null);
      }
    };

    window.addEventListener('laporanwee-profile-updated', handleProfileUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('laporanwee-profile-updated', handleProfileUpdated);
    };
  }, []); // Run only on mount!

  // Commit any active inline edit before saving or switching fields
  const commitActiveEdit = () => {
    if (editingField === 'name') {
      const trimmed = tempName.trim();
      if (trimmed) setName(trimmed);
      else setTempName(name);
    } else if (editingField === 'job') {
      const trimmed = tempJob.trim();
      setProfileTitle(trimmed);
    } else if (editingField === 'status') {
      if (['Karyawan', 'Anak Magang', 'Anak PKL'].includes(tempStatus)) {
        setProfileStatus(tempStatus);
      }
    }
    setEditingField(null);
  };

  // Save Full Profile via POST /profile/save.php (Single Request)
  const handleSaveProfile = async () => {
    if (isSaving) return;
    commitActiveEdit();

    const finalName = (editingField === 'name' ? tempName : name).trim();
    if (!finalName) {
      onAddToast('Nama profil tidak boleh kosong.');
      return;
    }

    const finalJob = (editingField === 'job' ? tempJob : profileTitle).trim();
    const finalStatus = (editingField === 'status' ? tempStatus : profileStatus).trim();

    if (finalStatus && !['Karyawan', 'Anak Magang', 'Anak PKL'].includes(finalStatus)) {
      onAddToast('Status harus bernilai: Karyawan, Anak Magang, atau Anak PKL.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await profileService.saveProfile({
        full_name: finalName,
        profile_title: finalJob,
        profile_location: finalStatus,
      });
      recordProfileSaveTimestamp();

      if (res && res.success) {
        onAddToast('Profil berhasil disimpan.');
        const d = res.data || res;
        const freshName = d.full_name || d.name || finalName;
        const freshJob = d.profile_title !== undefined ? d.profile_title : finalJob;
        const rawStatus = d.profile_location !== undefined ? d.profile_location : finalStatus;
        const freshStatus = ['Karyawan', 'Anak Magang', 'Anak PKL'].includes(rawStatus) ? rawStatus : '';

        setName(freshName);
        setTempName(freshName);
        setProfileTitle(freshJob);
        setTempJob(freshJob);
        setProfileStatus(freshStatus);
        setTempStatus(freshStatus);

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
            profile_title: freshJob,
            profile_location: freshStatus,
            avatar_url: freshAvatar,
          });
        }
      } else {
        const errorMsg = res?.message || 'Gagal menyimpan profil.';
        onAddToast(`Profil gagal disimpan: ${errorMsg}`);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Kesalahan server';
      onAddToast(`Profil gagal disimpan: ${errorMsg}`);
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
                if (editingField) commitActiveEdit();
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
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  const trimmed = tempName.trim();
                  if (trimmed) {
                    setName(trimmed);
                  } else {
                    setTempName(name);
                  }
                  if (editingField === 'name') setEditingField(null);
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
                if (editingField) commitActiveEdit();
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
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTempJob(e.target.value)}
                onBlur={() => {
                  const trimmed = tempJob.trim();
                  setProfileTitle(trimmed);
                  if (editingField === 'job') setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTempJob(profileTitle);
                    setEditingField(null);
                  }
                }}
                placeholder="Contoh: EDITOR, Designer..."
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
                if (editingField) commitActiveEdit();
                const initialChoice = profileStatus || 'Karyawan';
                setTempStatus(initialChoice);
                setProfileStatus(initialChoice);
                setEditingField('status');
              }
            }}
          >
            <div className="profile-row-label-text">STATUS</div>
            {editingField === 'status' ? (
              <div
                style={{ width: '100%', maxWidth: '420px' }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <select
                  id="statusSelect"
                  className="profile-name-edit-input"
                  value={tempStatus || profileStatus || 'Karyawan'}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (['Karyawan', 'Anak Magang', 'Anak PKL'].includes(val)) {
                      setTempStatus(val);
                      setProfileStatus(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitActiveEdit();
                    } else if (e.key === 'Escape') {
                      setTempStatus(profileStatus);
                      setEditingField(null);
                    }
                  }}
                  autoFocus
                >
                  <option value="Karyawan">Karyawan</option>
                  <option value="Anak Magang">Anak Magang</option>
                  <option value="Anak PKL">Anak PKL</option>
                </select>
              </div>
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
