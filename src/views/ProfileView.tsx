import React, { useState, useEffect, useMemo } from 'react';
import { ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  getAbsoluteAvatarUrl,
  withAvatarCacheBust,
  syncAuthenticatedUser,
  formatApiErrorMessage,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileViewProps {
  onNavigate: (view: ViewType) => void;
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

const VALID_STATUS_OPTIONS = ['Karyawan', 'Anak Magang', 'Anak PKL'] as const;

export const validateStatusOption = (val?: string | null): string => {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'karyawan') return 'Karyawan';
  if (lower === 'anak magang' || lower === 'magang') return 'Anak Magang';
  if (lower === 'anak pkl' || lower === 'pkl' || lower.includes('pkl')) return 'Anak PKL';
  return '';
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // Committed State from Backend
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || '');
  const [email, setEmail] = useState(userEmail || '');
  const [job, setJob] = useState('');
  const [status, setStatus] = useState('');
  const [avatar, setAvatar] = useState<string | null>(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null);

  // Active Expandable Row State
  const [openRow, setOpenRow] = useState<'name' | 'email' | 'job' | 'status' | null>(null);

  // Draft Form Inputs (Draft State ONLY — NO auto-save on change)
  const [inputName, setInputName] = useState(name);
  const [inputEmail, setInputEmail] = useState(email);
  const [inputJob, setInputJob] = useState(job);
  const [inputStatus, setInputStatus] = useState(status);

  // Loading States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Quick Job Suggestions
  const JOB_OPTIONS = ['EDITOR', 'VIDEO EDITOR', 'Desainer Grafis', 'Art Director', 'Copywriter', 'Social Media'];

  // Track if there are unsaved changes
  const isDirty = useMemo(() => {
    return (
      inputName.trim() !== name.trim() ||
      inputEmail.trim() !== email.trim() ||
      inputJob.trim() !== job.trim() ||
      inputStatus.trim() !== status.trim()
    );
  }, [inputName, inputEmail, inputJob, inputStatus, name, email, job, status]);

  // Sync prop changes
  useEffect(() => {
    if (initialAvatarUrl) {
      setAvatar(withAvatarCacheBust(initialAvatarUrl));
    }
  }, [initialAvatarUrl]);

  // Load initial profile data from GET /profile/get.php
  useEffect(() => {
    let isMounted = true;
    const fetchProfileData = async () => {
      setIsRefreshing(true);
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (res && (res.success || res.status === 'success' || res.data)) {
          const d = res.data || res.user || res;
          const freshName = d.full_name || d.name || userName || '';
          const freshEmail = d.email || userEmail || '';
          const freshJob = d.profile_title || d.title || '';
          const rawStatus = d.profile_location || d.status || d.location || '';
          const freshStatus = validateStatusOption(rawStatus);

          setName(freshName);
          setInputName(freshName);
          setEmail(freshEmail);
          setInputEmail(freshEmail);
          setJob(freshJob);
          setInputJob(freshJob);
          setStatus(freshStatus);
          setInputStatus(freshStatus);

          const rawAvatar = extractAvatarFromResponse(res);
          let freshAvatarUrl: string | null = null;
          if (rawAvatar) {
            freshAvatarUrl = withAvatarCacheBust(rawAvatar, d.updated_at || Date.now());
            setAvatar(freshAvatarUrl);
          } else if (rawAvatar === null) {
            setAvatar(null);
          }

          syncAuthenticatedUser({
            full_name: freshName,
            name: freshName,
            email: freshEmail,
            profile_title: freshJob,
            profile_location: freshStatus,
            avatar_url: freshAvatarUrl,
          });

          if (onUpdateUser) {
            onUpdateUser({
              name: freshName,
              email: freshEmail,
              profile_title: freshJob,
              profile_location: freshStatus,
              avatar_url: freshAvatarUrl,
            });
          }
        }
      } catch (err: any) {
        console.warn('[ProfileView] Could not load from backend, using local session:', err);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    };

    fetchProfileData();
    return () => {
      isMounted = false;
    };
  }, [userName, userEmail]);

  // SATU SAVE METADATA (handleSaveProfile) via POST /profile/save.php
  const handleSaveProfile = async () => {
    if (!inputName.trim()) {
      onAddToast('Nama lengkap wajib diisi.');
      return;
    }

    const cleanStatus = validateStatusOption(inputStatus);

    setIsSaving(true);
    try {
      const payload = {
        full_name: inputName.trim(),
        profile_title: inputJob.trim(),
        profile_location: cleanStatus,
      };

      const res = await profileService.saveProfile(payload);

      if (res && (res.success || res.status === 'success')) {
        const d = res.data || res.user || res;

        // Server is SOURCE OF TRUTH
        const serverName = d.full_name || d.name || inputName.trim();
        const serverJob = d.profile_title !== undefined ? d.profile_title : inputJob.trim();
        const rawServerLoc = d.profile_location !== undefined ? d.profile_location : cleanStatus;
        const serverStatus = validateStatusOption(rawServerLoc);
        const serverAvatar = d.avatar_url !== undefined ? d.avatar_url : avatar;

        setName(serverName);
        setInputName(serverName);
        setJob(serverJob);
        setInputJob(serverJob);
        setStatus(serverStatus);
        setInputStatus(serverStatus);

        if (d.avatar_url !== undefined) {
          setAvatar(d.avatar_url ? withAvatarCacheBust(d.avatar_url, d.updated_at || Date.now()) : null);
        }

        setOpenRow(null);

        syncAuthenticatedUser({
          full_name: serverName,
          name: serverName,
          email: email,
          profile_title: serverJob,
          profile_location: serverStatus,
          avatar_url: serverAvatar,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: serverName,
            email: email,
            profile_title: serverJob,
            profile_location: serverStatus,
            avatar_url: serverAvatar,
          });
        }

        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              full_name: serverName,
              name: serverName,
              profile_title: serverJob,
              profile_location: serverStatus,
              avatar_url: serverAvatar,
            },
          })
        );

        onAddToast('Profil berhasil disimpan');
      } else {
        onAddToast(res?.message || 'Gagal menyimpan profil');
      }
    } catch (err: any) {
      console.error('[ProfileView] Save error:', err);
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const openCropPage = () => {
    onNavigate('profile-crop');
  };

  return (
    <div className="view">
      {/* Top Bar Navigation & Actions */}
      <div className="top">
        <div className="crumb">
          Pengaturan / <b>Profil</b>
        </div>

        <span className={`dirty ${isDirty ? 'on' : ''}`}>
          <i /> Perubahan belum disimpan
        </span>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn soft ${isRefreshing ? 'load' : ''}`}
            onClick={async () => {
              setIsRefreshing(true);
              try {
                const res = await profileService.getProfile();
                if (res && (res.data || res.user)) {
                  const d = res.data || res.user;
                  const freshName = d.full_name || d.name || name;
                  const freshJob = d.profile_title || job;
                  const freshStatus = validateStatusOption(d.profile_location || status);

                  setName(freshName);
                  setInputName(freshName);
                  setJob(freshJob);
                  setInputJob(freshJob);
                  setStatus(freshStatus);
                  setInputStatus(freshStatus);
                }
                onAddToast('Data profil dimuat ulang');
              } catch (err) {
                onAddToast('Gagal memuat ulang data profil');
              } finally {
                setIsRefreshing(false);
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />
            </svg>
            <span>Refresh</span>
            <i className="sp" />
          </button>

          <button
            type="button"
            className={`btn dark ${isSaving ? 'load' : ''}`}
            onClick={handleSaveProfile}
            disabled={isSaving}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5 10 17.5 19 7" />
            </svg>
            <span>Simpan</span>
            <i className="sp" />
          </button>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="grid">
        {/* Avatar Card Section */}
        <section className="card c12">
          <div className="hero">
            <div className="txt">
              <div className="eyebrow">Foto Profil</div>
              <h1>{name || 'Pengguna'}</h1>
              <p>Klik icon pensil untuk mengedit posisi dan zoom foto profil Anda.</p>

              <div className="chips">
                <span className="chip lime">{name}</span>
                <span className="chip">{job || 'Pekerjaan belum diatur'}</span>
                <span className="chip lav">{status || 'Belum dipilih'}</span>
              </div>
            </div>

            <div className="pwrap">
              <svg className="pr" viewBox="0 0 176 176">
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c2e04a" />
                    <stop offset="100%" stopColor="#8f7fe0" />
                  </linearGradient>
                </defs>
                <circle className="a" cx="88" cy="88" r="82" />
                <circle className="b" cx="88" cy="88" r="82" style={{ strokeDashoffset: 0 }} />
              </svg>

              <div
                className="pimg"
                onClick={openCropPage}
                role="button"
                tabIndex={0}
                aria-label="Ubah foto profil"
                title="Klik untuk mengedit foto profil"
              >
                {avatar ? (
                  <img src={getAbsoluteAvatarUrl(avatar, name)} alt={name} />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--lav)',
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#2a2440',
                    }}
                  >
                    {(name[0] || 'P').toUpperCase()}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="pen"
                onClick={openCropPage}
                aria-label="Edit foto profil"
                title="Edit foto profil"
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Form Information Section */}
        <section className="card c12">
          <div className="card-h">
            <h3>Informasi Profil</h3>
            <div className="sub">Klik baris di bawah untuk mengedit, lalu tekan Simpan</div>
          </div>

          <div className="inner">
            {/* ROW 1: NAME */}
            <div className={`prow ${openRow === 'name' ? 'open' : ''}`}>
              <button
                type="button"
                className="ph"
                onClick={() => setOpenRow(openRow === 'name' ? null : 'name')}
                aria-expanded={openRow === 'name'}
              >
                <span className="l">NAME</span>
                <span className={`v ${inputName ? '' : 'empty'}`}>{inputName || '—'}</span>
                <svg className="ch" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div className="pe">
                <div>
                  <div className="box">
                    <div className="fld">
                      <div className="inp">
                        <input
                          type="text"
                          value={inputName}
                          onChange={(e) => setInputName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setOpenRow(null);
                            } else if (e.key === 'Escape') {
                              setInputName(name);
                              setOpenRow(null);
                            }
                          }}
                          placeholder="Nama Lengkap"
                        />
                      </div>
                    </div>
                    <div className="acts">
                      <button type="button" className="btn soft sm" onClick={() => setOpenRow(null)}>
                        Selesai
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: EMAIL */}
            <div className={`prow ${openRow === 'email' ? 'open' : ''}`}>
              <button
                type="button"
                className="ph"
                onClick={() => setOpenRow(openRow === 'email' ? null : 'email')}
                aria-expanded={openRow === 'email'}
              >
                <span className="l">EMAIL</span>
                <span className={`v ${inputEmail ? '' : 'empty'}`}>{inputEmail || '—'}</span>
                <svg className="ch" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div className="pe">
                <div>
                  <div className="box">
                    <div className="fld">
                      <div className="inp">
                        <input
                          type="email"
                          value={inputEmail}
                          onChange={(e) => setInputEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setOpenRow(null);
                            } else if (e.key === 'Escape') {
                              setInputEmail(email);
                              setOpenRow(null);
                            }
                          }}
                          placeholder="Alamat Email"
                        />
                      </div>
                    </div>
                    <div className="acts">
                      <button type="button" className="btn soft sm" onClick={() => setOpenRow(null)}>
                        Selesai
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: PEKERJAAN (profile_title) */}
            <div className={`prow ${openRow === 'job' ? 'open' : ''}`}>
              <button
                type="button"
                className="ph"
                onClick={() => setOpenRow(openRow === 'job' ? null : 'job')}
                aria-expanded={openRow === 'job'}
              >
                <span className="l">PEKERJAAN</span>
                <span className={`v ${inputJob ? '' : 'empty'}`}>{inputJob || 'Belum diatur'}</span>
                <svg className="ch" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div className="pe">
                <div>
                  <div className="box">
                    <div className="fld">
                      <div className="inp">
                        <input
                          type="text"
                          value={inputJob}
                          onChange={(e) => setInputJob(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              setOpenRow(null);
                            } else if (e.key === 'Escape') {
                              setInputJob(job);
                              setOpenRow(null);
                            }
                          }}
                          placeholder="Contoh: EDITOR / VIDEO EDITOR"
                        />
                      </div>
                    </div>
                    <div className="opts" style={{ marginTop: '10px' }}>
                      {JOB_OPTIONS.map((j) => (
                        <button
                          key={j}
                          type="button"
                          className={`opt ${inputJob.toLowerCase() === j.toLowerCase() ? 'on' : ''}`}
                          onClick={() => setInputJob(j)}
                        >
                          {j}
                        </button>
                      ))}
                    </div>
                    <div className="acts">
                      <button type="button" className="btn soft sm" onClick={() => setOpenRow(null)}>
                        Selesai
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 4: STATUS (profile_location: Karyawan | Anak Magang | Anak PKL) */}
            <div className={`prow ${openRow === 'status' ? 'open' : ''}`}>
              <button
                type="button"
                className="ph"
                onClick={() => setOpenRow(openRow === 'status' ? null : 'status')}
                aria-expanded={openRow === 'status'}
              >
                <span className="l">STATUS</span>
                <span className={`v ${inputStatus ? '' : 'empty'}`}>{inputStatus || 'Belum dipilih'}</span>
                <svg className="ch" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              <div className="pe">
                <div>
                  <div className="box">
                    <div className="fld">
                      <div className="inp">
                        <select
                          value={inputStatus}
                          onChange={(e) => setInputStatus(e.target.value)}
                          style={{
                            width: '100%',
                            height: '46px',
                            borderRadius: '12px',
                            border: '1px solid var(--line)',
                            background: 'var(--glass)',
                            padding: '0 14px',
                            fontSize: '14.5px',
                            color: 'var(--ink)',
                            outline: 0,
                          }}
                        >
                          <option value="">Belum dipilih</option>
                          {VALID_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="opts" style={{ marginTop: '12px' }}>
                      {VALID_STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`opt ${inputStatus === s ? 'on' : ''}`}
                          onClick={() => setInputStatus(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="acts">
                      <button type="button" className="btn soft sm" onClick={() => setOpenRow(null)}>
                        Selesai
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
