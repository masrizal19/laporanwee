import React, { useState, useEffect } from 'react';
import '../profile-edit.css';
import { getStoredToken, getStoredUser, setStoredUser } from '../utils/api';
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
    avatar_url?: string | null;
  }) => void;
}

const API_BASE = 'https://api-laporanwe.mkverse.my.id/api/profile';
const STAT_OPTIONS = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];
const JOB_OPTIONS = [
  'Art Director',
  'Desainer Grafis',
  'VIDEO EDITOR',
  'Videografer',
  'Copywriter',
  'Social Media',
];

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  userName,
  userEmail,
  userRole,
  userStatus,
  avatarUrl: propAvatarUrl,
  onAddToast,
  onUpdateUser,
}) => {
  const [profileId, setProfileId] = useState<number | string>('');
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState(userStatus || 'KARYAWAN');
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
    status: userStatus || 'KARYAWAN',
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

  // Fetch initial profile data from backend PHP REST endpoint (get.php)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || getStoredToken() || '';
        const res = await fetch(`${API_BASE}/get.php`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        if (u) {
          const n = u.full_name || u.name || userName || '';
          const e = u.email || userEmail || '';
          const j = u.pekerjaan || u.title || 'VIDEO EDITOR';
          const s = (u.status_karyawan || u.employment_status || u.status || userStatus || 'KARYAWAN').toUpperCase();

          if (u.id) setProfileId(u.id);
          if (n) setName(n);
          if (e) setEmail(e);
          setJob(j);
          setStatus(s);

          const fetchedAvatar = u.avatar_url || u.avatar || null;
          if (fetchedAvatar) {
            setAvatarUrl(fetchedAvatar);
          }
          setInitialProfile({ name: n, email: e, job: j, status: s });
        }
      } catch (err) {
        const stored = getStoredUser();
        if (stored) {
          if (stored.full_name || stored.name) setName(stored.full_name || stored.name || '');
          if (stored.email) setEmail(stored.email);
          if (stored.avatar_url) setAvatarUrl(stored.avatar_url);
        }
      }
    };
    fetchProfile();
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

  // Save textual profile info to save.php
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onAddToast('Nama lengkap wajib diisi');
      return;
    }

    setIsSaving(true);
    const token = getStoredToken() || '';

    try {
      const res = await fetch(`${API_BASE}/save.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          id: profileId,
          name: name.trim(),
          full_name: name.trim(),
          pekerjaan: job.trim(),
          status: status,
        }),
      });

      const data = await res.json();
      if (data && (data.success || data.status === 'success')) {
        setInitialProfile({
          name: name.trim(),
          email: email.trim(),
          job: job.trim(),
          status: status.trim(),
        });
        setIsDirty(false);

        const stored = getStoredUser();
        if (stored) {
          const updatedUser = {
            ...stored,
            name: name.trim(),
            full_name: name.trim(),
            status: status.trim(),
          };
          setStoredUser(updatedUser);
        }

        if (onUpdateUser) {
          onUpdateUser({
            email: email.trim(),
            name: name.trim(),
            role: userRole || 'Administrator',
            status: status.trim(),
            avatar_url: avatarUrl,
          });
        }

        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              id: profileId,
              name: name.trim(),
              avatar_url: avatarUrl,
            },
          })
        );

        onAddToast('Profil berhasil disimpan');
      } else {
        onAddToast(data.message || 'Gagal menyimpan profil');
      }
    } catch (err) {
      setInitialProfile({
        name: name.trim(),
        email: email.trim(),
        job: job.trim(),
        status: status.trim(),
      });
      setIsDirty(false);
      onAddToast('Profil disimpan secara lokal');
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
                    src={avatarUrl}
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
                  className={`opt ${status.toUpperCase() === s.toUpperCase() ? 'on' : ''}`}
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
          setAvatarUrl(newAvatar);
          onAddToast('Foto profil berhasil diperbarui');
          if (onUpdateUser) {
            onUpdateUser({
              email: email.trim(),
              name: name.trim(),
              role: userRole || 'Administrator',
              status: status.trim(),
              avatar_url: newAvatar,
            });
          }
          window.dispatchEvent(
            new CustomEvent('laporanwee-profile-updated', {
              detail: {
                id: profileId,
                name: name.trim(),
                avatar_url: newAvatar,
              },
            })
          );
        }}
        onError={(msg) => onAddToast(msg)}
      />
    </div>
  );
};