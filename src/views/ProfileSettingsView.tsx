import React, { useState, useEffect } from 'react';
import '../profile-edit.css';
import {
  profileService,
  getStoredToken,
  getStoredUser,
  syncAuthenticatedUser,
  formatApiErrorMessage,
  extractAvatarFromResponse,
  withAvatarCacheBust,
} from '../utils/api';
import { validateStatusOption } from './ProfileView';
import { SettingProfilePictureModal } from '../components/SettingProfilePictureModal';

interface ProfileSettingsViewProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userStatus?: string;
  avatarUrl?: string | null;
  onAddToast: (text: string) => void;
  onUpdateUser?: (updated: {
    email: string;
    name: string;
    role?: string;
    status?: string;
    profile_title?: string;
    profile_location?: string;
    avatar_url?: string | null;
  }) => void;
}

const STAT_OPTIONS = ['Karyawan', 'Anak Magang', 'Anak PKL'];
const JOB_OPTIONS = ['EDITOR', 'VIDEO EDITOR', 'Desainer Grafis', 'Art Director', 'Copywriter', 'Social Media'];

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  userName,
  userEmail,
  userRole,
  userStatus,
  avatarUrl: propAvatarUrl,
  onAddToast,
  onUpdateUser,
}) => {
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState(validateStatusOption(userStatus) || 'Karyawan');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(propAvatarUrl || null);

  const [isCropOpen, setIsCropOpen] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      (window.location.pathname.includes('/setting-profile-picture') ||
        window.location.hash.includes('/setting-profile-picture'))
    );
  });

  const [initialProfile, setInitialProfile] = useState({
    name: userName || '',
    email: userEmail || '',
    job: 'VIDEO EDITOR',
    status: validateStatusOption(userStatus) || 'Karyawan',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync route URL for /profil/setting-profile-picture
  useEffect(() => {
    const checkPath = () => {
      const isCropRoute =
        window.location.pathname.includes('/setting-profile-picture') ||
        window.location.hash.includes('/setting-profile-picture');
      if (isCropRoute && !isCropOpen) {
        setIsCropOpen(true);
      }
    };
    checkPath();
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, [isCropOpen]);

  // Real-time GET sync directly from MySQL backend on mount/load
  useEffect(() => {
    const fetchLatestProfile = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || getStoredToken() || '';
      try {
        const res = await fetch('https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'application/json',
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        if (u) {
          const rawAvatar = u.avatar_url || u.avatar || u.file_url;
          const freshAvatar = rawAvatar
            ? (rawAvatar.startsWith('data:') ? rawAvatar : `${rawAvatar.split('?')[0]}?t=${Date.now()}`)
            : null;

          const freshName = u.name || u.full_name || userName || '';
          const freshEmail = u.email || userEmail || '';
          const freshJob = u.profile_title || u.title || 'VIDEO EDITOR';
          const freshStatus = validateStatusOption(u.profile_location || u.status) || 'Karyawan';

          if (freshName) setName(freshName);
          if (freshEmail) setEmail(freshEmail);
          setJob(freshJob);
          setStatus(freshStatus);
          setAvatarUrl(freshAvatar);

          const storedUser = JSON.parse(
            localStorage.getItem('laporanwee_user') || localStorage.getItem('user') || '{}'
          );
          storedUser.avatar_url = freshAvatar;
          if (freshName) {
            storedUser.name = freshName;
            storedUser.full_name = freshName;
          }
          localStorage.setItem('laporanwee_user', JSON.stringify(storedUser));
          localStorage.setItem('user', JSON.stringify(storedUser));

          onUpdateUser?.({
            email: freshEmail,
            name: freshName,
            role: userRole,
            status: freshStatus,
            profile_title: freshJob,
            profile_location: freshStatus,
            avatar_url: freshAvatar,
          });

          setInitialProfile({ name: freshName, email: freshEmail, job: freshJob, status: freshStatus });
        }
      } catch (err) {
        console.warn('Gagal memuat profil real-time:', err);
        const stored = getStoredUser();
        if (stored) {
          if (stored.full_name || stored.name) setName(stored.full_name || stored.name || '');
          if (stored.email) setEmail(stored.email);
          if (stored.profile_title) setJob(stored.profile_title);
          if (stored.profile_location) setStatus(validateStatusOption(stored.profile_location) || 'Karyawan');
          if (stored.avatar_url) setAvatarUrl(stored.avatar_url);
        }
      }
    };

    fetchLatestProfile();
  }, [userName, userEmail, userStatus, propAvatarUrl]);

  // Track dirty status
  useEffect(() => {
    setIsDirty(
      name.trim() !== initialProfile.name.trim() ||
      email.trim() !== initialProfile.email.trim() ||
      job.trim() !== initialProfile.job.trim() ||
      status.trim() !== initialProfile.status.trim()
    );
  }, [name, email, job, status, initialProfile]);

  // Save profile info via single POST /profile/save.php
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onAddToast('Nama lengkap wajib diisi');
      return;
    }

    const cleanStatus = validateStatusOption(status) || 'Karyawan';

    setIsSaving(true);
    try {
      const res = await profileService.saveProfile({
        full_name: name.trim(),
        profile_title: job.trim(),
        profile_location: cleanStatus,
      });

      if (res && (res.success || res.status === 'success')) {
        const d = res.data || res.user || res;
        const freshName = d.full_name || d.name || name.trim();
        const freshJob = d.profile_title !== undefined ? d.profile_title : job.trim();
        const freshStatus = validateStatusOption(d.profile_location) || cleanStatus;
        const freshAvatar = d.avatar_url
          ? (d.avatar_url.startsWith('data:') ? d.avatar_url : `${d.avatar_url.split('?')[0]}?t=${Date.now()}`)
          : avatarUrl;

        setName(freshName);
        setJob(freshJob);
        setStatus(freshStatus);
        setInitialProfile({
          name: freshName,
          email: email.trim(),
          job: freshJob,
          status: freshStatus,
        });
        setIsDirty(false);

        syncAuthenticatedUser({
          full_name: freshName,
          name: freshName,
          email: email.trim(),
          profile_title: freshJob,
          profile_location: freshStatus,
          avatar_url: freshAvatar,
        });

        if (onUpdateUser) {
          onUpdateUser({
            email: email.trim(),
            name: freshName,
            role: userRole || 'Administrator',
            status: freshStatus,
            profile_title: freshJob,
            profile_location: freshStatus,
            avatar_url: freshAvatar,
          });
        }

        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              full_name: freshName,
              name: freshName,
              profile_title: freshJob,
              profile_location: freshStatus,
              avatar_url: freshAvatar,
            },
          })
        );

        onAddToast('Profil berhasil disimpan');
      } else {
        onAddToast(res?.message || 'Gagal menyimpan profil');
      }
    } catch (err: any) {
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const openCropModal = () => {
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil/setting-profile-picture');
      }
    } catch (_) {}
    setIsCropOpen(true);
  };

  const closeCropModal = () => {
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
    setIsCropOpen(false);
  };

  return (
    <div className="wrap" style={{ gridTemplateColumns: '1fr', maxWidth: '800px' }}>
      {/* KARTU FORM INFORMASI PROFIL */}
      <section className="card">
        <div className="inner">
          {/* HEADER AVATAR PREVIEW + TOMBOL UBAH FOTO */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '18px 20px',
              marginBottom: '24px',
              background: 'var(--glass)',
              borderRadius: '20px',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--lav)',
                  flexShrink: 0,
                  boxShadow: '0 8px 20px -6px rgba(0,0,0,0.25)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {avatarUrl ? (
                  <img
                    id="mainAvatarImg"
                    src={avatarUrl.includes('?') ? avatarUrl : `${avatarUrl}?t=${Date.now()}`}
                    alt={name || 'Avatar'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '26px', fontWeight: 700, color: '#2a2440' }}>
                    {(name[0] || 'P').toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                  {name || 'Pengguna'}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>
                  {email || 'Belum ada email'} • <span style={{ fontWeight: 600 }}>{job}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn soft"
              style={{ width: 'auto', padding: '0 18px', height: '42px', fontSize: '13.5px' }}
              onClick={openCropModal}
            >
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Ubah Foto</span>
            </button>
          </div>

          <div className="fh">
            <div>
              <div className="eyebrow">Pengaturan</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>Informasi Profil</h2>
              <p className="sub">Ubah data yang tampil di akun Anda.</p>
            </div>
            <span className={`dirty ${isDirty ? 'on' : ''}`}>
              <i /> Perubahan belum disimpan
            </span>
          </div>

          <form onSubmit={handleSaveProfile} noValidate>
            <div className="f">
              <input
                id="nameInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder=" "
              />
              <label htmlFor="nameInput">Nama Lengkap</label>
            </div>

            <div className="f">
              <input
                id="emailInput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder=" "
              />
              <label htmlFor="emailInput">Email</label>
            </div>

            <div className="f">
              <input
                id="jobInput"
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder=" "
              />
              <label htmlFor="jobInput">Pekerjaan</label>
            </div>

            <div className="gl">PILIH PEKERJAAN</div>
            <div className="opts">
              {JOB_OPTIONS.map((j) => (
                <button
                  key={j}
                  type="button"
                  className={`opt ${job.toLowerCase() === j.toLowerCase() ? 'on' : ''}`}
                  onClick={() => setJob(j)}
                >
                  {j}
                </button>
              ))}
            </div>

            <div className="gl">STATUS</div>
            <div className="opts">
              {STAT_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`opt ${status === s ? 'on' : ''}`}
                  onClick={() => setStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="fa">
              <button
                type="button"
                className="btn soft"
                style={{ width: 'auto', padding: '0 24px' }}
                onClick={() => {
                  setName(initialProfile.name);
                  setEmail(initialProfile.email);
                  setJob(initialProfile.job);
                  setStatus(initialProfile.status);
                  onAddToast('Perubahan dibatalkan');
                }}
              >
                Batalkan
              </button>
              <button
                type="submit"
                className="btn dark"
                style={{ width: 'auto', padding: '0 28px' }}
                disabled={isSaving}
              >
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* MODAL CROP SETTING FOTO PROFIL */}
      <SettingProfilePictureModal
        isOpen={isCropOpen}
        initialSrc={avatarUrl}
        userName={name}
        userEmail={email}
        onClose={closeCropModal}
        onSaved={(newAvatar) => {
          const freshAvatar = newAvatar.includes('?') ? newAvatar : `${newAvatar}?t=${Date.now()}`;
          setAvatarUrl(freshAvatar);

          const storedUser = JSON.parse(
            localStorage.getItem('laporanwee_user') || localStorage.getItem('user') || '{}'
          );
          storedUser.avatar_url = freshAvatar;
          storedUser.name = name.trim();
          storedUser.full_name = name.trim();
          localStorage.setItem('laporanwee_user', JSON.stringify(storedUser));
          localStorage.setItem('user', JSON.stringify(storedUser));

          if (onUpdateUser) {
            onUpdateUser({
              email: email.trim(),
              name: name.trim(),
              role: userRole || 'Administrator',
              status: status.trim(),
              profile_title: job.trim(),
              profile_location: status.trim(),
              avatar_url: freshAvatar,
            });
          }

          window.dispatchEvent(
            new CustomEvent('laporanwee-profile-updated', {
              detail: {
                id: name,
                name: name.trim(),
                avatar_url: freshAvatar,
              },
            })
          );

          onAddToast('Foto profil berhasil diperbarui');
        }}
        onError={(msg) => onAddToast(msg)}
      />
    </div>
  );
};