import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../profile-edit.css';
import { ProfileCropModal } from '../components/ProfileCropModal';
import { getStoredToken, getStoredUser, setStoredUser, withAvatarCacheBust } from '../utils/api';

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
  const [profileId, setProfileId] = useState<number | string>(1);
  const [name, setName] = useState(userName || 'RIZAL FADHILAH');
  const [email, setEmail] = useState(userEmail || 'rizalsaragih498@gmail.com');
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState(userStatus || 'KARYAWAN');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(propAvatarUrl || null);

  const [initialProfile, setInitialProfile] = useState({
    name: userName || 'RIZAL FADHILAH',
    email: userEmail || 'rizalsaragih498@gmail.com',
    job: 'VIDEO EDITOR',
    status: userStatus || 'KARYAWAN',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [avatarPop, setAvatarPop] = useState(false);

  const avatarContainerRef = useRef<HTMLDivElement>(null);

  // Generate dynamic canvas placeholder avatar
  const getInitialsAvatar = useCallback((initialChar: string) => {
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
  }, []);

  // Fetch initial profile data from backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getStoredToken() || '';
        const res = await fetch(`${API_BASE}/get.php?id=1`, {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer ' + token,
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        if (u) {
          const n = u.full_name || u.name || userName || 'RIZAL FADHILAH';
          const e = u.email || userEmail || 'rizalsaragih498@gmail.com';
          const j = u.pekerjaan || u.title || 'VIDEO EDITOR';
          const s = (u.status_karyawan || u.employment_status || u.status || userStatus || 'KARYAWAN').toUpperCase();
          const av = u.avatar_url || u.avatar || propAvatarUrl || null;

          setProfileId(u.id || 1);
          setName(n);
          setEmail(e);
          setJob(j);
          setStatus(s);
          if (av) {
            setAvatarUrl(withAvatarCacheBust(av));
          }
          setInitialProfile({ name: n, email: e, job: j, status: s });
        }
      } catch (err) {
        // Fallback to existing session
        const stored = getStoredUser();
        if (stored) {
          setName(stored.name || userName || 'RIZAL FADHILAH');
          setEmail(stored.email || userEmail || 'rizalsaragih498@gmail.com');
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

  // Compute completeness %
  const completeness =
    [
      avatarUrl ? 1 : 0,
      name.trim() ? 1 : 0,
      email.trim() ? 1 : 0,
      job.trim() ? 1 : 0,
      status ? 1 : 0,
    ].filter(Boolean).length * 20;

  const strokeOffset = 553 * (1 - completeness / 100);

  // Handle open crop modal
  const handleOpenCrop = () => {
    setIsModalOpen(true);
  };

  // Refaktor fungsi handleSaveCrop dengan dynamic cache-busting
  const handleSaveCrop = (cropResult: string | { avatar_url?: string; [key: string]: any }) => {
    let rawAvatar = typeof cropResult === 'string' ? cropResult : (cropResult?.avatar_url || (cropResult?.data?.avatar_url) || '');
    let finalUrl = rawAvatar;

    // Tambahkan parameter cache-busting URL dinamis jika bukan base64
    if (finalUrl && typeof finalUrl === 'string') {
      const isBase64 = finalUrl.startsWith('data:') || finalUrl.startsWith('blob:');
      if (!isBase64) {
        const cleanUrl = finalUrl.split('?')[0];
        finalUrl = `${cleanUrl}?t=${Date.now()}`;
      }
    }

    // Pastikan state avatarUrl langsung di-set dengan finalUrl yang memiliki timestamp
    setAvatarUrl(finalUrl);

    // Update session storage & user object
    const savedUser = getStoredUser();
    if (savedUser) {
      const updatedUser = {
        ...savedUser,
        avatar_url: finalUrl,
      };
      setStoredUser(updatedUser);
    }

    // Trigger pop effect
    setAvatarPop(true);
    setTimeout(() => setAvatarPop(false), 800);

    // Propagate to global state
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

    onAddToast('Foto profil berhasil disimpan ke server');
  };

  const handleCropSaved = handleSaveCrop;

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

        // Update local stored user
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
      // Local fallback
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
    <div className="wrap">
      {/* KARTU KIRI: FOTO PROFIL */}
      <aside className="card pc">
        <div className="inner" style={{ width: '100%' }}>
          <div className="pwrap">
            <svg className="pr" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#c2e04a" />
                  <stop offset="1" stopColor="#8f7fe0" />
                </linearGradient>
              </defs>
              <circle className="a" cx="100" cy="100" r="88" />
              <circle
                className="b"
                cx="100"
                cy="100"
                r="88"
                style={{ strokeDashoffset: strokeOffset }}
              />
            </svg>
            <span className="pct">{completeness}%</span>

            <div
              ref={avatarContainerRef}
              className={`pimg ${avatarPop ? 'pf-pop' : ''}`}
              onClick={handleOpenCrop}
              role="button"
              tabIndex={0}
              aria-label="Ubah foto profil"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenCrop();
                }
              }}
            >
              <img
                key={avatarUrl || 'initials'}
                src={avatarUrl || getInitialsAvatar(name[0])}
                alt="Foto Profil"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = getInitialsAvatar(name[0]);
                }}
              />
            </div>

            <button
              type="button"
              className="pen"
              onClick={handleOpenCrop}
              aria-label="Edit foto profil"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />
              </svg>
            </button>
          </div>

          <div className="eyebrow">Foto Profil</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: '4px 0 8px', wordBreak: 'break-word' }}>
            {name || 'Pengguna'}
          </h1>
          <p className="sub" style={{ margin: '0 auto 16px' }}>
            Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.
          </p>

          <div className="chips">
            <span className="chip lime">Profil {completeness}% lengkap</span>
            <span className="chip">{job || 'Pekerjaan belum diatur'}</span>
            <span className="chip lav">{status || 'Status belum dipilih'}</span>
          </div>

          <button
            type="button"
            className="btn dark"
            onClick={handleOpenCrop}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="9" cy="10" r="2" />
              <path d="m21 16-5-5-8 8" />
            </svg>
            <span>Ubah Foto</span>
          </button>
        </div>
      </aside>

      {/* KARTU KANAN: FORM INFORMASI PROFIL */}
      <section className="card">
        <div className="inner">
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

      {/* MODAL CROP EDIT FOTO (createPortal ke document.body) */}
      <ProfileCropModal
        isOpen={isModalOpen}
        initialSrc={avatarUrl || getInitialsAvatar(name[0])}
        profileId={profileId}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaveCrop}
        onError={(err) => onAddToast(err)}
      />
    </div>
  );
};