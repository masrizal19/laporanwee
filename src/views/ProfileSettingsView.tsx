import React, { useState, useEffect, useCallback } from 'react';
import '../profile-edit.css';
import { ProfileCropModal } from '../components/ProfileCropModal';
import { getStoredToken, getStoredUser, setStoredUser } from '../utils/api';

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
const SETTING_PICTURE_API = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';
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
  const [profileId, setProfileId] = useState<number | string>(1);
  const [name, setName] = useState(userName || 'RIZAL FADHILAH');
  const [email, setEmail] = useState(userEmail || 'rizalsaragih498@gmail.com');
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState(userStatus || 'KARYAWAN');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(propAvatarUrl || null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const [initialProfile, setInitialProfile] = useState({
    name: userName || 'RIZAL FADHILAH',
    email: userEmail || 'rizalsaragih498@gmail.com',
    job: 'VIDEO EDITOR',
    status: userStatus || 'KARYAWAN',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize URL route /profil/setting-profile-picture
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const full = window.location.href;
      if (path.includes('/setting-profile-picture') || hash.includes('/setting-profile-picture') || full.includes('/setting-profile-picture')) {
        setIsCropModalOpen(true);
      } else if (path.endsWith('/profil') || hash.endsWith('/profil') || path.endsWith('/profile')) {
        setIsCropModalOpen(false);
      }
    };
    checkRoute();

    const handlePopState = () => {
      checkRoute();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch initial profile data from backend PHP REST endpoint
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

  // Open crop modal and pushState to /profil/setting-profile-picture
  const handleOpenCropModal = () => {
    setIsCropModalOpen(true);
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({ modal: 'crop' }, '', '/profil/setting-profile-picture');
      }
    } catch (_) {}
  };

  // Close crop modal and pushState back to /profil
  const handleCloseCropModal = () => {
    setIsCropModalOpen(false);
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
  };

  // Handle saved avatar callback from modal
  const handleSavedAvatar = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);

    // Update stored user in session/localStorage
    const stored = getStoredUser();
    if (stored) {
      const updatedUser = {
        ...stored,
        avatar_url: newAvatarUrl,
      };
      setStoredUser(updatedUser);
    }

    if (onUpdateUser) {
      onUpdateUser({
        email: email.trim(),
        name: name.trim(),
        role: userRole || 'Administrator',
        status: status.trim(),
        avatar_url: newAvatarUrl,
      });
    }

    window.dispatchEvent(
      new CustomEvent('laporanwee-profile-updated', {
        detail: {
          id: profileId,
          name: name.trim(),
          avatar_url: newAvatarUrl,
        },
      })
    );

    onAddToast('Foto profil berhasil diperbarui');
    handleCloseCropModal();
  };

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

  return (
    <div className="wrap" style={{ gridTemplateColumns: '1fr', maxWidth: '800px' }}>
      {/* KARTU FORM INFORMASI PROFIL */}
      <section className="card">
        <div className="inner">
          <div className="fh" style={{ marginBottom: 20 }}>
            <div>
              <div className="eyebrow">Pengaturan</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>Informasi Profil</h2>
              <p className="sub">Ubah data yang tampil di akun Anda.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                className="btn soft"
                onClick={handleOpenCropModal}
                style={{ width: 'auto', padding: '0 20px', height: '42px', fontSize: '13.5px' }}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="m21 16-5-5-8 8" />
                </svg>
                <span>Ubah Foto Profil</span>
              </button>
              <span className={`dirty ${isDirty ? 'on' : ''}`}>
                <i /> Perubahan belum disimpan
              </span>
            </div>
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

      {/* MODAL CROP SETTING PROFILE PICTURE */}
      <ProfileCropModal
        isOpen={isCropModalOpen}
        initialSrc={avatarUrl || ''}
        profileId={profileId}
        onClose={handleCloseCropModal}
        onSaved={handleSavedAvatar}
        onError={(msg) => onAddToast(msg)}
      />
    </div>
  );
};