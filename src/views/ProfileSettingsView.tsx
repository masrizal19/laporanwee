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
const CROP_SETTING_ROUTE = '/profil/setting-profile-picture';

const STAT_OPTIONS = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];
const JOB_OPTIONS = [
  'Art Director',
  'Desainer Grafis',
  'VIDEO EDITOR',
  'Videografer',
  'Copywriter',
  'Social Media',
];

// Helper to create starter initial avatar
const createInitialsAvatar = (initialChar: string) => {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = c.height = 480;
  const g = c.getContext('2d');
  if (!g) return '';
  const gr = g.createLinearGradient(0, 0, 480, 480);
  gr.addColorStop(0, '#cfc6f4');
  gr.addColorStop(0.55, '#e3ddfa');
  gr.addColorStop(1, '#d4ee6b');
  g.fillStyle = gr;
  g.fillRect(0, 0, 480, 480);
  g.fillStyle = 'rgba(255, 255, 255, 0.45)';
  g.beginPath();
  g.arc(360, 120, 140, 0, 7);
  g.fill();
  g.fillStyle = 'rgba(143, 127, 224, 0.35)';
  g.beginPath();
  g.arc(90, 420, 170, 0, 7);
  g.fill();
  g.fillStyle = '#2a2440';
  g.font = '500 190px Outfit, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((initialChar || 'P').toUpperCase(), 240, 262);
  return c.toDataURL();
};

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
  const [avatarUrl, setAvatarUrl] = useState<string>(
    propAvatarUrl
      ? (propAvatarUrl.startsWith('data:image') ? propAvatarUrl : `${propAvatarUrl}?t=${Date.now()}`)
      : createInitialsAvatar(userName?.[0] || 'R')
  );

  const [initialProfile, setInitialProfile] = useState({
    name: userName || 'RIZAL FADHILAH',
    email: userEmail || 'rizalsaragih498@gmail.com',
    job: 'VIDEO EDITOR',
    status: userStatus || 'KARYAWAN',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Synchronize route URL with crop modal state
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const full = window.location.href;
      if (
        path.includes('/setting-profile-picture') ||
        hash.includes('/setting-profile-picture') ||
        full.includes('/setting-profile-picture')
      ) {
        setIsModalOpen(true);
      } else if (path.endsWith('/profil') || hash.endsWith('/profil') || path.endsWith('/profile')) {
        setIsModalOpen(false);
      }
    };
    checkRoute();

    const handlePopState = () => {
      checkRoute();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch initial profile data from backend PHP REST endpoint (setting-profil-picture/index.php & get.php)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || getStoredToken() || '';
        
        // 1. Fetch from new setting-profil-picture endpoint
        try {
          const pictureRes = await fetch(SETTING_PICTURE_API, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer ' + token,
            },
          });
          const picJson = await pictureRes.json();
          const pictureAvatar = picJson?.data?.avatar_url || picJson?.avatar_url;
          if (pictureAvatar && typeof pictureAvatar === 'string') {
            const cleanUrl = pictureAvatar.startsWith('data:') ? pictureAvatar : `${pictureAvatar.split('?')[0]}?t=${Date.now()}`;
            setAvatarUrl(cleanUrl);
          }
        } catch (_) {}

        // 2. Fetch full profile data
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
          if (fetchedAvatar && typeof fetchedAvatar === 'string' && !fetchedAvatar.startsWith('data:image')) {
            const cleanUrl = fetchedAvatar.includes('?') ? fetchedAvatar.split('?')[0] : fetchedAvatar;
            setAvatarUrl(`${cleanUrl}?t=${Date.now()}`);
          } else if (fetchedAvatar && typeof fetchedAvatar === 'string') {
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

  // Handle open crop modal with window.history.pushState to /profil/setting-profile-picture
  const handleOpenCrop = () => {
    setIsModalOpen(true);
    try {
      window.history.pushState({ modal: 'crop' }, '', CROP_SETTING_ROUTE);
    } catch (_) {}
  };

  // Handle close crop modal and restore URL back to /profil
  const handleCloseCrop = () => {
    setIsModalOpen(false);
    try {
      window.history.pushState({}, '', '/profil');
    } catch (_) {}
  };

  // Handle save crop success callback
  const handleSaveCrop = (newAvatarUrl: string) => {
    const finalUrl = newAvatarUrl.includes('?') ? newAvatarUrl : `${newAvatarUrl}?t=${Date.now()}`;
    setAvatarUrl(finalUrl);

    // Update stored session user
    const savedUser = getStoredUser();
    if (savedUser) {
      setStoredUser({
        ...savedUser,
        avatar_url: finalUrl,
      });
    }

    if (onUpdateUser) {
      onUpdateUser({
        email,
        name,
        role: userRole || 'Administrator',
        status,
        avatar_url: finalUrl,
      });
    }

    // Dispatch global event for instant header / sidebar avatar update
    window.dispatchEvent(
      new CustomEvent('laporanwee-profile-updated', {
        detail: {
          id: profileId,
          avatar_url: finalUrl,
          name,
          email,
        },
      })
    );

    onAddToast('Foto profil berhasil diperbarui');
    handleCloseCrop();
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
    <div className="wrap" style={{ gridTemplateColumns: '1fr', maxWidth: '840px' }}>
      {/* KARTU FORM INFORMASI PROFIL */}
      <section className="card">
        <div className="inner">
          {/* Header Bar dengan Tombol Ubah Foto Profil Samping Header */}
          <div className="fh" style={{ alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                className="pimg"
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  inset: 'auto',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onClick={handleOpenCrop}
                title="Klik untuk ubah foto profil"
              >
                <img
                  src={avatarUrl}
                  alt="Foto Profil"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = createInitialsAvatar(name[0]);
                  }}
                />
              </div>

              <div>
                <div className="eyebrow">Pengaturan</div>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>Informasi Profil</h2>
                <p className="sub" style={{ marginTop: 2 }}>Ubah data dan foto profil akun Anda.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn soft"
                style={{ height: '42px', padding: '0 18px', fontSize: '13.5px' }}
                onClick={handleOpenCrop}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
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

      {/* MODAL CROP EDIT FOTO (createPortal ke document.body) */}
      <ProfileCropModal
        isOpen={isModalOpen}
        initialSrc={avatarUrl || createInitialsAvatar(name[0])}
        profileId={profileId}
        onClose={handleCloseCrop}
        onSaved={handleSaveCrop}
        onError={(err) => onAddToast(err)}
      />
    </div>
  );
};