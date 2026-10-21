import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../profile-edit.css';

interface ProfileSettingsViewProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userStatus?: string;
  avatarUrl?: string | null;
  onAddToast: (text: string) => void;
  onUpdateUser?: (updated: { email: string; name: string; role?: string; status?: string; avatar_url?: string | null }) => void;
}

const API_BASE = 'https://api-laporanwe.mkverse.my.id/api/profile';
const STAT_OPTIONS = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];
const JOB_OPTIONS = ['Art Director', 'Desainer Grafis', 'VIDEO EDITOR', 'Videografer', 'Copywriter', 'Social Media'];

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({ onAddToast, onUpdateUser }) => {
  const [profileId, setProfileId] = useState<number | string>(1);
  const [name, setName] = useState('RIZAL FADHILAH');
  const [email, setEmail] = useState('rizalsaragih498@gmail.com');
  const [job, setJob] = useState('VIDEO EDITOR');
  const [status, setStatus] = useState('KARYAWAN');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [initialProfile, setInitialProfile] = useState({ name: '', email: '', job: '', status: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Crop State (Sesuai Struktur PROFILE CROP.html)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>('');
  const [origSrc, setOrigSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [base, setBase] = useState(1);
  const [isUploading, setIsUploading] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pviLRef = useRef<HTMLImageElement>(null);
  const pviMRef = useRef<HTMLImageElement>(null);
  const pviSRef = useRef<HTMLImageElement>(null);

  const isDraggingRef = useRef(false);
  const dragLastRef = useRef<{ x: number; y: number } | null>(null);

  // Buat avatar inisial canvas jika belum ada foto
  const getInitialsAvatar = (initialChar: string) => {
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
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath();
    g.arc(360, 120, 140, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(143,127,224,.35)';
    g.beginPath();
    g.arc(90, 420, 170, 0, 7);
    g.fill();
    g.fillStyle = '#2a2440';
    g.font = '500 190px Outfit,system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText((initialChar || 'P').toUpperCase(), 240, 262);
    return c.toDataURL();
  };

  // Muat data profil dari backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        const res = await fetch(`${API_BASE}/get.php?id=1`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        if (u) {
          const n = u.full_name || u.name || 'RIZAL FADHILAH';
          const e = u.email || 'rizalsaragih498@gmail.com';
          const j = u.pekerjaan || u.title || 'VIDEO EDITOR';
          const s = (u.status_karyawan || u.employment_status || u.status || 'KARYAWAN').toUpperCase();
          const av = u.avatar_url || u.avatar || null;

          setProfileId(u.id || 1);
          setName(n);
          setEmail(e);
          setJob(j);
          setStatus(s);
          setAvatarUrl(av);
          setInitialProfile({ name: n, email: e, job: j, status: s });
        }
      } catch (err) {
        setInitialProfile({ name, email, job, status });
      }
    };
    fetchProfile();
  }, []);

  const completeness = [avatarUrl ? 1 : 0, name.trim() ? 1 : 0, email.trim() ? 1 : 0, job.trim() ? 1 : 0, status ? 1 : 0].filter(Boolean).length * 20;
  const strokeOffset = 553 * (1 - completeness / 100);

  useEffect(() => {
    setIsDirty(name !== initialProfile.name || email !== initialProfile.email || job !== initialProfile.job || status !== initialProfile.status);
  }, [name, email, job, status, initialProfile]);

  // Logika Pemotongan Gambar
  const CS = 280;

  const clamp = useCallback((currX: number, currY: number, currZ: number, b = base, w = nw, h = nh) => {
    const scaledW = w * b * currZ;
    const scaledH = h * b * currZ;
    const clampedX = Math.min(0, Math.max(CS - scaledW, currX));
    const clampedY = Math.min(0, Math.max(CS - scaledH, currY));
    return { clampedX, clampedY };
  }, [base, nw, nh]);

  const setZoomLevel = (newZ: number) => {
    const nz = Math.min(3, Math.max(1, newZ));
    const cx = (CS / 2 - posX) / (base * zoom);
    const cy = (CS / 2 - posY) / (base * zoom);
    const newX = CS / 2 - cx * base * nz;
    const newY = CS / 2 - cy * base * nz;
    const { clampedX, clampedY } = clamp(newX, newY, nz);
    setZoom(nz);
    setPosX(clampedX);
    setPosY(clampedY);
  };

  const handleOpenCrop = () => {
    const currentAvatar = avatarUrl || getInitialsAvatar(name[0]);
    setOrigSrc(currentAvatar);
    setCropSrc(currentAvatar);
    setIsModalOpen(true);
  };

  const onImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalW = img.naturalWidth || 480;
    const naturalH = img.naturalHeight || 480;
    const b = CS / Math.min(naturalW, naturalH);

    setNw(naturalW);
    setNh(naturalH);
    setBase(b);
    setZoom(1);

    const initX = (CS - naturalW * b) / 2;
    const initY = (CS - naturalH * b) / 2;
    setPosX(initX);
    setPosY(initY);
  };

  // Pointer Drag Event
  const onPointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragLastRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragLastRef.current) return;
    const dx = e.clientX - dragLastRef.current.x;
    const dy = e.clientY - dragLastRef.current.y;
    dragLastRef.current = { x: e.clientX, y: e.clientY };

    const { clampedX, clampedY } = clamp(posX + dx, posY + dy, zoom);
    setPosX(clampedX);
    setPosY(clampedY);
  };

  const onPointerUp = () => {
    isDraggingRef.current = false;
    dragLastRef.current = null;
  };

  // Rotasi & Balik
  const handleRotate = () => {
    const img = imgRef.current;
    if (!img) return;
    const cv = document.createElement('canvas');
    cv.width = img.naturalHeight;
    cv.height = img.naturalWidth;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    setCropSrc(cv.toDataURL('image/jpeg', 0.95));
  };

  const handleFlip = () => {
    const img = imgRef.current;
    if (!img) return;
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    setCropSrc(cv.toDataURL('image/jpeg', 0.95));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar');
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') {
        setCropSrc(r.result);
      }
    };
    r.readAsDataURL(f);
  };

  // Simpan hasil crop ke backend upload.php
  const handleSaveCrop = async () => {
    const img = imgRef.current;
    if (!img) return;
    setIsUploading(true);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const ctx = cv.getContext('2d');
    if (!ctx) {
      setIsUploading(false);
      return;
    }

    const factor = 512 / CS;
    ctx.drawImage(
      img,
      0, 0, nw, nh,
      posX * factor, posY * factor,
      nw * base * zoom * factor,
      nh * base * zoom * factor
    );

    const croppedBase64 = cv.toDataURL('image/jpeg', 0.92);

    cv.toBlob(async (blob) => {
      if (!blob) {
        setIsUploading(false);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        const fd = new FormData();
        fd.append('avatar', blob, `avatar_${profileId}_${Date.now()}.jpg`);
        fd.append('id', String(profileId));

        const res = await fetch(`${API_BASE}/upload.php`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: fd,
        });
        const resJson = await res.json();
        const finalUrl = resJson.success && resJson.avatar_url ? resJson.avatar_url : croppedBase64;
        setAvatarUrl(finalUrl);
        if (onUpdateUser) {
          onUpdateUser({ email, name, avatar_url: finalUrl });
        }
        onAddToast('Foto profil berhasil disimpan ke server');
      } catch (err) {
        setAvatarUrl(croppedBase64);
        onAddToast('Foto profil diperbarui secara lokal');
      } finally {
        setIsUploading(false);
        setIsModalOpen(false);
      }
    }, 'image/jpeg', 0.92);
  };

  // Simpan Data Profil (save.php)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onAddToast('Name wajib diisi.');
      return;
    }
    setIsSaving(true);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

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
      if (data.success) {
        setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
        setIsDirty(false);
        if (onUpdateUser) {
          onUpdateUser({ email, name: name.trim(), role: 'Administrator', status, avatar_url: avatarUrl });
        }
        onAddToast('Profil berhasil disimpan');
      } else {
        onAddToast(data.message || 'Gagal menyimpan profil');
      }
    } catch (err) {
      setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
      setIsDirty(false);
      onAddToast('Profil disimpan secara lokal');
    } finally {
      setIsSaving(false);
    }
  };

  const currentRenderW = nw * base * zoom - CS;
  const currentRenderH = nh * base * zoom - CS;
  const sliderX = currentRenderW > 1 ? Math.round((-posX / currentRenderW) * 100) : 50;
  const sliderY = currentRenderH > 1 ? Math.round((-posY / currentRenderH) * 100) : 50;

  return (
    <div className="wrap">
      {/* KARTU KIRI: FOTO PROFIL */}
      <aside className="card pc">
        <div className="inner" style={{ width: '100%' }}>
          <div className="pwrap">
            <svg className="pr" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#c2e04a" />
                  <stop offset="1" stopColor="#8f7fe0" />
                </linearGradient>
              </defs>
              <circle className="a" cx="100" cy="100" r="88" />
              <circle className="b" cx="100" cy="100" r="88" style={{ strokeDashoffset: strokeOffset }} />
            </svg>
            <span className="pct">{completeness}%</span>

            <div className="pimg" onClick={handleOpenCrop} role="button" tabIndex={0}>
              <img src={avatarUrl || getInitialsAvatar(name[0])} alt="Foto Profil" />
            </div>

            <button type="button" className="pen" onClick={handleOpenCrop} aria-label="Edit foto">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />
              </svg>
            </button>
          </div>

          <div className="eyebrow">Foto Profil</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: '4px 0 8px' }}>{name || 'Pengguna'}</h1>
          <p className="sub" style={{ margin: '0 auto 16px' }}>
            Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.
          </p>

          <div className="chips">
            <span className="chip lime">Profil {completeness}% lengkap</span>
            <span className="chip">{job || 'Pekerjaan belum diatur'}</span>
            <span className="chip lav">{status || 'Status belum dipilih'}</span>
          </div>

          <button type="button" className="btn dark" onClick={handleOpenCrop}>
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
              <label htmlFor="nameInput">Name</label>
              <input id="nameInput" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>

            <div className="f">
              <label htmlFor="emailInput">Email</label>
              <input id="emailInput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="f">
              <label htmlFor="jobInput">Pekerjaan</label>
              <input id="jobInput" value={job} onChange={(e) => setJob(e.target.value)} />
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

      {/* MODAL CROP EDIT FOTO (DESAIN BARU SESUAI REFERENSI CROP SETTING.HTML) */}
      {isModalOpen && (
        <div className="ov show pc-ov" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal pc-modal" role="dialog" aria-modal="true">
            <div className="pc-grab" />
            <div className="pc-head">
              <h2>Edit Foto Profil</h2>
              <button type="button" className="pc-x" onClick={() => setIsModalOpen(false)} aria-label="Tutup">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <p className="pc-hint-t">Seret foto atau pakai tombol arah untuk menggeser kanan, kiri, atas, dan bawah. Atur zoom, lalu klik Simpan Foto.</p>

            <div className="pc-main">
              <div
                className="pc-stage"
                ref={stageRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {cropSrc && (
                  <img
                    ref={imgRef}
                    src={cropSrc}
                    alt="Pratinjau Crop"
                    draggable={false}
                    onLoad={onImageLoaded}
                    style={{
                      transform: `translate(${posX}px, ${posY}px) scale(${base * zoom})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                )}
                <div className="pc-grid" />
                <div className="pc-ring" />
                <div className="pc-tip">Seret untuk menggeser</div>
              </div>

              {/* 3 LINGKARAN PRATINJAU (L, M, S) */}
              <div className="pc-prevs" aria-hidden="true">
                <div className="pc-pv l">
                  <img
                    ref={pviLRef}
                    src={cropSrc}
                    alt="Preview L"
                    style={{
                      transform: `translate(${posX * (72 / CS)}px, ${posY * (72 / CS)}px) scale(${base * zoom * (72 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <div className="pc-pv m">
                  <img
                    ref={pviMRef}
                    src={cropSrc}
                    alt="Preview M"
                    style={{
                      transform: `translate(${posX * (44 / CS)}px, ${posY * (44 / CS)}px) scale(${base * zoom * (44 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <div className="pc-pv s">
                  <img
                    ref={pviSRef}
                    src={cropSrc}
                    alt="Preview S"
                    style={{
                      transform: `translate(${posX * (28 / CS)}px, ${posY * (28 / CS)}px) scale(${base * zoom * (28 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <small>Pratinjau</small>
              </div>
            </div>

            {/* PANEL KONTROL ZOOM & ORIENTASI */}
            <div className="pc-panels">
              <section className="pc-panel" aria-label="Geser posisi foto">
                <h3>Geser</h3>
                <div className="pc-dpad">
                  <button type="button" className="pc-pad" data-d="up" onClick={() => setPosY(clamp(posX, posY + 18, zoom).clampedY)} aria-label="Atas">
                    <svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg>
                  </button>
                  <button type="button" className="pc-pad" data-d="left" onClick={() => setPosX(clamp(posX + 18, posY, zoom).clampedX)} aria-label="Kiri">
                    <svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>
                  </button>
                  <button type="button" className="pc-pad" data-d="center" onClick={() => { setPosX((CS - nw * base * zoom) / 2); setPosY((CS - nh * base * zoom) / 2); }} aria-label="Pusat">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
                  </button>
                  <button type="button" className="pc-pad" data-d="right" onClick={() => setPosX(clamp(posX - 18, posY, zoom).clampedX)} aria-label="Kanan">
                    <svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg>
                  </button>
                  <button type="button" className="pc-pad" data-d="down" onClick={() => setPosY(clamp(posX, posY - 18, zoom).clampedY)} aria-label="Bawah">
                    <svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6" /></svg>
                  </button>
                </div>
                <div className="pc-read" id="pc-read">Posisi <b>X {sliderX}%</b> · <b>Y {sliderY}%</b></div>
              </section>

              <section className="pc-panel">
                <h3>Zoom</h3>
                <div className="pc-zoom">
                  <button type="button" className="pc-ico" onClick={() => setZoomLevel(zoom - 0.15)} aria-label="Perkecil">
                    <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
                  </button>
                  <input
                    className="pc-range"
                    type="range"
                    min="100"
                    max="300"
                    value={Math.round(zoom * 100)}
                    onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
                    aria-label="Zoom"
                  />
                  <button type="button" className="pc-ico" onClick={() => setZoomLevel(zoom + 0.15)} aria-label="Perbesar">
                    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                  <output>{Math.round(zoom * 100)}%</output>
                </div>
                <h3>Orientasi</h3>
                <div className="pc-tools">
                  <button type="button" className="pc-tool" onClick={handleRotate}>
                    <svg viewBox="0 0 24 24"><path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" /></svg>Putar
                  </button>
                  <button type="button" className="pc-tool" onClick={handleFlip}>
                    <svg viewBox="0 0 24 24"><path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" /></svg>Balik
                  </button>
                </div>
              </section>
            </div>

            <div className="pc-actions">
              <label className="pc-b soft pc-full" htmlFor="pc-file" style={{ cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                Pilih Foto Baru
              </label>
              <input className="sr-only" id="pc-file" type="file" accept="image/*" onChange={handleFileChange} />
              <button type="button" className="pc-b soft" onClick={() => { setZoom(1); setPosX((CS - nw * base) / 2); setPosY((CS - nh * base) / 2); }}>Reset</button>
              <button type="button" className={`pc-b dark ${isUploading ? 'pc-load' : ''}`} onClick={handleSaveCrop} disabled={isUploading}>
                <span>Simpan Foto</span>
                <i className="pc-spn" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};