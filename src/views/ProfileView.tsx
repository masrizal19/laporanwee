import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, Report, ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  getAbsoluteAvatarUrl,
  withAvatarCacheBust,
  syncAuthenticatedUser,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileViewProps {
  projects?: Project[];
  reports?: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectProject?: (projectId: string) => void;
  onSelectReport?: (reportId: string) => void;
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
  // Saved / Committed State
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Admin');
  const [email, setEmail] = useState(userEmail || 'admin@gmail.com');
  const [job, setJob] = useState('');
  const [status, setStatus] = useState('');
  const [avatar, setAvatar] = useState<string | null>(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null);

  // Active Expandable Row State
  const [openRow, setOpenRow] = useState<'name' | 'email' | 'job' | 'status' | null>(null);

  // Form Inputs
  const [inputName, setInputName] = useState(name);
  const [inputEmail, setInputEmail] = useState(email);
  const [inputJob, setInputJob] = useState(job);
  const [inputStatus, setInputStatus] = useState(status);
  const [formError, setFormError] = useState('');

  // Loading States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Crop / Edit Avatar Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [imgNaturalWidth, setImgNaturalWidth] = useState(0);
  const [imgNaturalHeight, setImgNaturalHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initPanX: number; initPanY: number } | null>(null);

  const CROP_SIZE = 260;

  // Options arrays
  const JOB_OPTIONS = ['Art Director', 'Desainer Grafis', 'Videografer', 'Copywriter', 'Social Media'];
  const STATUS_OPTIONS = ['Tersedia', 'Sedang bekerja', 'Dalam rapat', 'Cuti'];

  // Check if there are unsaved changes (Dirty status)
  const isDirty = useMemo(() => {
    return (
      inputName !== name ||
      inputEmail !== email ||
      inputJob !== job ||
      inputStatus !== status
    );
  }, [inputName, inputEmail, inputJob, inputStatus, name, email, job, status]);

  // Compute completion percentage
  const completionPercentage = useMemo(() => {
    let count = 0;
    if (avatar) count++;
    if (name.trim()) count++;
    if (email.trim()) count++;
    if (job.trim()) count++;
    if (status.trim()) count++;
    return count * 20;
  }, [avatar, name, email, job, status]);

  // Sync with initial props
  useEffect(() => {
    if (initialAvatarUrl) {
      setAvatar(withAvatarCacheBust(initialAvatarUrl));
    }
  }, [initialAvatarUrl]);

  // Load initial profile data from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchProfileData = async () => {
      setIsRefreshing(true);
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (res && res.success && res.data) {
          const d = res.data;
          const freshName = d.full_name || d.name || userName;
          const freshEmail = d.email || userEmail;
          const freshJob = d.profile_title || d.title || '';
          const freshStatus = d.profile_location || d.status || d.location || '';

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
          }

          syncAuthenticatedUser({
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
      } catch (err) {
        console.warn('[ProfileView] Could not load from backend, using local session:', err);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    };

    fetchProfileData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save profile text fields to backend API
  const handleSaveProfile = async () => {
    if (!inputName.trim()) {
      onAddToast('Nama lengkap wajib diisi.');
      return;
    }
    if (!inputEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail.trim())) {
      onAddToast('Masukkan alamat email yang valid.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        full_name: inputName.trim(),
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: avatar,
      };

      const res = await profileService.saveProfile(payload);
      if (res && res.success) {
        setName(inputName.trim());
        setEmail(inputEmail.trim());
        setJob(inputJob.trim());
        setStatus(inputStatus.trim());
        setOpenRow(null);

        localStorage.setItem('lw_user_profile', JSON.stringify(payload));

        syncAuthenticatedUser({
          name: inputName.trim(),
          email: inputEmail.trim(),
          profile_title: inputJob.trim(),
          profile_location: inputStatus.trim(),
          avatar_url: avatar,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: inputName.trim(),
            email: inputEmail.trim(),
            profile_title: inputJob.trim(),
            profile_location: inputStatus.trim(),
            avatar_url: avatar,
          });
        }

        const toastMsg =
          res.message === 'Tersimpan di preview lokal' ||
          res.message?.includes('preview') ||
          res.message?.includes('sandbox')
            ? 'Tersimpan di preview lokal'
            : res.message || 'Profil berhasil disimpan.';
        onAddToast(toastMsg);
      } else {
        throw new Error(res?.message || 'Gagal menyimpan profil');
      }
    } catch (err: any) {
      console.warn('[ProfileView] Save error fallback to local storage:', err);
      const payload = {
        full_name: inputName.trim(),
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: avatar,
      };
      localStorage.setItem('lw_user_profile', JSON.stringify(payload));
      setName(inputName.trim());
      setEmail(inputEmail.trim());
      setJob(inputJob.trim());
      setStatus(inputStatus.trim());
      setOpenRow(null);

      syncAuthenticatedUser(payload);
      if (onUpdateUser) onUpdateUser(payload);
      onAddToast('Tersimpan di preview lokal');
    } finally {
      setIsSaving(false);
    }
  };

  // Base scale calculation for image cropping
  const baseScale = useMemo(() => {
    if (!imgNaturalWidth || !imgNaturalHeight) return 1;
    return CROP_SIZE / Math.min(imgNaturalWidth, imgNaturalHeight);
  }, [imgNaturalWidth, imgNaturalHeight]);

  // Clamp crop pan position
  const clampPan = (x: number, y: number, currentZoom: number) => {
    const scaledW = imgNaturalWidth * baseScale * currentZoom;
    const scaledH = imgNaturalHeight * baseScale * currentZoom;
    const clampedX = Math.min(0, Math.max(CROP_SIZE - scaledW, x));
    const clampedY = Math.min(0, Math.max(CROP_SIZE - scaledH, y));
    return { clampedX, clampedY };
  };

  const handleOpenCropModal = () => {
    const currentPhoto = avatar || getAbsoluteAvatarUrl(avatar, name);
    setModalImageSrc(currentPhoto);
    setIsModalOpen(true);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth || CROP_SIZE;
    const nh = img.naturalHeight || CROP_SIZE;
    setImgNaturalWidth(nw);
    setImgNaturalHeight(nh);

    const bScale = CROP_SIZE / Math.min(nw, nh);
    setZoom(1);
    setPanX((CROP_SIZE - nw * bScale) / 2);
    setPanY((CROP_SIZE - nh * bScale) / 2);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: panX,
      initPanY: panY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = dragRef.current.initPanX + dx;
    const newY = dragRef.current.initPanY + dy;
    const { clampedX, clampedY } = clampPan(newX, newY, zoom);
    setPanX(clampedX);
    setPanY(clampedY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const newZoom = Math.min(3, Math.max(1, zoom + delta));
    setZoom(newZoom);
    const { clampedX, clampedY } = clampPan(panX, panY, newZoom);
    setPanX(clampedX);
    setPanY(clampedY);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setModalImageSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Crop canvas & upload photo to backend API
  const handleSavePhoto = async () => {
    setIsUploadingPhoto(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx && modalImageSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = modalImageSrc;
        });

        const scaleMultiplier = 480 / CROP_SIZE;
        ctx.drawImage(
          img,
          0,
          0,
          imgNaturalWidth,
          imgNaturalHeight,
          panX * scaleMultiplier,
          panY * scaleMultiplier,
          imgNaturalWidth * baseScale * zoom * scaleMultiplier,
          imgNaturalHeight * baseScale * zoom * scaleMultiplier
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        // Convert DataURL to Blob for FormData upload
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'profile-avatar.jpg', { type: 'image/jpeg' });

        let finalAvatarUrl = dataUrl;
        let isLocalPreview = false;

        try {
          const uploadRes = await profileService.uploadPhoto(file);
          if (uploadRes && uploadRes.success) {
            if (uploadRes.data?.url && !uploadRes.data.url.startsWith('data:')) {
              finalAvatarUrl = withAvatarCacheBust(uploadRes.data.url);
            }
            if (
              uploadRes.message === 'Tersimpan di preview lokal' ||
              uploadRes.message?.includes('preview') ||
              uploadRes.message?.includes('sandbox')
            ) {
              isLocalPreview = true;
            }
          }
        } catch (uploadErr) {
          console.warn('[ProfileView] Upload failed, falling back to local base64:', uploadErr);
          isLocalPreview = true;
        }

        // Simpan base64 foto langsung ke localStorage
        localStorage.setItem('lw_user_avatar', finalAvatarUrl);
        const existingProfile = localStorage.getItem('lw_user_profile');
        if (existingProfile) {
          try {
            const p = JSON.parse(existingProfile);
            p.avatar_url = finalAvatarUrl;
            localStorage.setItem('lw_user_profile', JSON.stringify(p));
          } catch (_) {}
        }

        // Perbarui tampilan UI seketika
        setAvatar(finalAvatarUrl);
        setIsModalOpen(false);

        syncAuthenticatedUser({
          name,
          email,
          profile_title: job,
          profile_location: status,
          avatar_url: finalAvatarUrl,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name,
            email,
            profile_title: job,
            profile_location: status,
            avatar_url: finalAvatarUrl,
          });
        }

        // Tampilkan notifikasi: 'Tersimpan di preview lokal'
        onAddToast(isLocalPreview ? 'Tersimpan di preview lokal' : 'Foto profil berhasil diperbarui.');
      }
    } catch (err: any) {
      console.error('[ProfileView] Photo save error:', err);
      if (modalImageSrc) {
        localStorage.setItem('lw_user_avatar', modalImageSrc);
        setAvatar(modalImageSrc);
        setIsModalOpen(false);
        onAddToast('Tersimpan di preview lokal');
      } else {
        onAddToast('Gagal memproses foto profil.');
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="view">
      {/* Top Controls Bar */}
      <div className="top">
        <div className="crumb">
          Pengaturan / <b>Profil</b>
        </div>

        <span className={`dirty ${isDirty ? 'on' : ''}`}>
          <i /> Perubahan belum disimpan
        </span>

        <button
          type="button"
          className={`btn soft ${isRefreshing ? 'load' : ''}`}
          onClick={async () => {
            setIsRefreshing(true);
            try {
              const res = await profileService.getProfile();
              if (res && res.data) {
                const d = res.data;
                setName(d.full_name || d.name || name);
                setInputName(d.full_name || d.name || name);
                setEmail(d.email || email);
                setInputEmail(d.email || email);
                setJob(d.profile_title || job);
                setInputJob(d.profile_title || job);
                setStatus(d.profile_location || status);
                setInputStatus(d.profile_location || status);
              }
              onAddToast('Data profil dimuat ulang dari backend.');
            } catch (_) {
              onAddToast('Menggunakan data cache profil.');
            } finally {
              setIsRefreshing(false);
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />
          </svg>
          <span>Refresh Backend</span>
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
          <span>Simpan Profil</span>
          <i className="sp" />
        </button>
      </div>

      {/* Main Grid Section */}
      <div className="grid">
        {/* Hero Card */}
        <section className="card c12">
          <div className="hero">
            <div className="txt">
              <div className="eyebrow">Foto Profil</div>
              <h1>{name}</h1>
              <p>
                Atur identitas Anda. Foto diedit langsung dari pratinjau utama, lalu disimpan ke backend tanpa kartu pratinjau tambahan.
              </p>
              <div className="chips">
                <span className="chip lime">Profil {completionPercentage}% lengkap</span>
                <span className="chip">{job || 'Pekerjaan belum diatur'}</span>
                <span className="chip lav">{status || 'Status belum dipilih'}</span>
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
                <circle
                  className="b"
                  cx="88"
                  cy="88"
                  r="82"
                  style={{ strokeDashoffset: 515 * (1 - completionPercentage / 100) }}
                />
              </svg>

              <div
                className="pimg"
                onClick={handleOpenCropModal}
                role="button"
                tabIndex={0}
                aria-label="Ubah foto profil"
              >
                <img src={getAbsoluteAvatarUrl(avatar, name)} alt={name} />
              </div>

              <button
                type="button"
                className="pen"
                onClick={handleOpenCropModal}
                aria-label="Edit foto profil"
                title="Edit foto profil"
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                </svg>
              </button>

              <span className="pct">{completionPercentage}%</span>
            </div>
          </div>
        </section>

        {/* Information List Rows Card */}
        <section className="card c12">
          <div className="card-h">
            <h3>Informasi Profil</h3>
            <div className="sub">Klik baris untuk mengubah isinya</div>
          </div>

          <div className="inner">
            {/* Row 1: Name */}
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

            {/* Row 2: Email */}
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

            {/* Row 3: Pekerjaan */}
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
                          placeholder="Pekerjaan / Profile Title"
                        />
                      </div>
                    </div>
                    <div className="opts">
                      {JOB_OPTIONS.map((j) => (
                        <button
                          key={j}
                          type="button"
                          className={`opt ${inputJob === j ? 'on' : ''}`}
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

            {/* Row 4: Status */}
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
                    <div className="opts">
                      {STATUS_OPTIONS.map((s) => (
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

      {/* Crop & Edit Avatar Modal */}
      <div className={`ov ${isModalOpen ? 'show' : ''}`} role="dialog" aria-modal="true">
        <div className="modal">
          <div className="mh">
            <h3>Edit Foto Profil</h3>
            <button
              type="button"
              className="x"
              onClick={() => setIsModalOpen(false)}
              aria-label="Tutup"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <p className="hint">
            Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
          </p>

          <div
            className={`crop ${isDragging ? 'drag' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheelZoom}
          >
            <img
              src={modalImageSrc}
              alt="Pratinjau Crop"
              onLoad={handleImageLoad}
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${baseScale * zoom})`,
              }}
            />
          </div>

          <div className="zoom">
            <button
              type="button"
              className="z"
              onClick={() => {
                const newZoom = Math.max(1, zoom - 0.15);
                setZoom(newZoom);
                const { clampedX, clampedY } = clampPan(panX, panY, newZoom);
                setPanX(clampedX);
                setPanY(clampedY);
              }}
              aria-label="Perkecil"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>

            <input
              type="range"
              min="100"
              max="300"
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                const newZoom = Number(e.target.value) / 100;
                setZoom(newZoom);
                const { clampedX, clampedY } = clampPan(panX, panY, newZoom);
                setPanX(clampedX);
                setPanY(clampedY);
              }}
              aria-label="Zoom"
            />

            <button
              type="button"
              className="z"
              onClick={() => {
                const newZoom = Math.min(3, zoom + 0.15);
                setZoom(newZoom);
                const { clampedX, clampedY } = clampPan(panX, panY, newZoom);
                setPanX(clampedX);
                setPanY(clampedY);
              }}
              aria-label="Perbesar"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <output>{Math.round(zoom * 100)}%</output>
          </div>

          <div className="mact">
            <label className="btn soft" htmlFor="file-upload-input" style={{ cursor: 'pointer' }}>
              Pilih Foto Baru
            </label>
            <input
              id="file-upload-input"
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btn soft"
              onClick={() => {
                setZoom(1);
                const bScale = CROP_SIZE / Math.min(imgNaturalWidth || CROP_SIZE, imgNaturalHeight || CROP_SIZE);
                setPanX((CROP_SIZE - (imgNaturalWidth || CROP_SIZE) * bScale) / 2);
                setPanY((CROP_SIZE - (imgNaturalHeight || CROP_SIZE) * bScale) / 2);
              }}
            >
              Reset
            </button>

            <button
              type="button"
              className={`btn dark ${isUploadingPhoto ? 'load' : ''}`}
              onClick={handleSavePhoto}
              disabled={isUploadingPhoto}
            >
              <span>Simpan Foto</span>
              <i className="sp" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
