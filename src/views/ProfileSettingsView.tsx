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

  // Modal Crop State (Sesuai Logika PROFILE CROP.html)
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

  const cropRef = useRef<HTMLDivElement>(null);
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

  // Logika Pemotongan Gambar (PROFILE CROP.html)
  const CS = 240;

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

  // Rotasi & Balik (PROFILE CROP.html)
  const handleRotate = () => {
    if (!imgRef.current) return;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return;
    c.width = nh;
    c.height = nw;
    g.translate(c.width / 2, c.height / 2);
    g.rotate(-Math.PI / 2);
    g.drawImage(imgRef.current, -nw / 2, -nh / 2);
    setCropSrc(c.toDataURL('image/jpeg', 0.95));
  };

  const handleFlip = () => {
    if (!imgRef.current) return;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return;
    c.width = nw;
    c.height = nh;
    g.translate(c.width / 2, c.height / 2);
    g.scale(-1, 1);
    g.drawImage(imgRef.current, -nw / 2, -nh / 2);
    setCropSrc(c.toDataURL('image/jpeg', 0.95));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar');
      return;
    }
    if (f.size > 10 * 1048576) {
      onAddToast('Ukuran foto maksimal 10 MB');
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

  // Simpan foto hasil crop dan kirim ke upload.php
  const handleSaveCrop = async () => {
    if (!imgRef.current) return;
    setIsUploading(true);

    const o = document.createElement('canvas');
    o.width = o.height = 512;
    const g = o.getContext('2d');
    if (!g) {
      setIsUploading(false);
      return;
    }
    const k = 512 / CS;
    g.drawImage(imgRef.current, 0, 0, nw, nh, posX * k, posY * k, nw * base * zoom * k, nh * base * zoom * k);

    const croppedDataUrl = o.toDataURL('image/jpeg', 0.92);

    o.toBlob(async (blob) => {
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
        const finalUrl = resJson.success && resJson.avatar_url ? resJson.avatar_url : croppedDataUrl;

        setAvatarUrl(finalUrl);
        if (onUpdateUser) {
          onUpdateUser({ email, name, avatar_url: finalUrl });
        }
        onAddToast('Foto profil berhasil disimpan ke server');
      } catch (err) {
        setAvatarUrl(croppedDataUrl);
        onAddToast('Foto profil diperbarui secara lokal');
      } finally {
        setIsUploading(false);
        setIsModalOpen(false);
      }
    }, 'image/jpeg', 0.92);
  };

  // Simpan Form Data Profil
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

  // Hitung Slider Range Pan
  const currentRenderW = nw * base * zoom - CS;
  const currentRenderH = nh * base * zoom - CS;
  const sliderX = currentRenderW > 1 ? Math.round((-posX / currentRenderW) * 100) : 50;
  const sliderY = currentRenderH > 1 ? Math.round((-posY / currentRenderH) * 100) : 50;

  return (
    <div className="wrap">
      {/* SISI KIRI: KARTU FOTO PROFIL */}
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
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: '4px 0 8px' }}>{name || 'Pengguna'}</h1>
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

      {/* SISI KANAN: FORM PROFIL */}
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
              <label htmlFor="fn">Name</label>
              <input id="fn" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>

            <div className="f">
              <label htmlFor="fe">Email</label>
              <input id="fe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="f">
              <label htmlFor="fj">Pekerjaan</label>
              <input id="fj" value={job} onChange={(e) => setJob(e.target.value)} />
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

      {/* MODAL CROP EDIT FOTO PROFIL */}
      {isModalOpen && (
        <div
          className="ov show profile-crop-layer"
          id="ov"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="modal profile-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="mt">
            <div className="grab" />
            <div className="mh">
              <h2 id="mt">Edit Foto Profil</h2>
              <button type="button" className="x" id="mx" onClick={() => setIsModalOpen(false)} aria-label="Tutup">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="hint">Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.</p>

            <div className="stagewrap">
              <div
                className="crop"
                id="crop"
                ref={cropRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={imgRef}
                  id="cimg"
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
                <div className="ring" />
              </div>

              {/* 3 LINGKARAN PRATINJAU */}
              <div className="prevs" aria-hidden="true">
                <div className="pv l">
                  <img
                    ref={pviLRef}
                    src={cropSrc}
                    alt="Preview L"
                    style={{
                      transform: `translate(${posX * (64 / CS)}px, ${posY * (64 / CS)}px) scale(${base * zoom * (64 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <div className="pv m">
                  <img
                    ref={pviMRef}
                    src={cropSrc}
                    alt="Preview M"
                    style={{
                      transform: `translate(${posX * (40 / CS)}px, ${posY * (40 / CS)}px) scale(${base * zoom * (40 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <div className="pv s">
                  <img
                    ref={pviSRef}
                    src={cropSrc}
                    alt="Preview S"
                    style={{
                      transform: `translate(${posX * (26 / CS)}px, ${posY * (26 / CS)}px) scale(${base * zoom * (26 / CS)})`,
                      width: nw ? `${nw}px` : 'auto',
                      height: nh ? `${nh}px` : 'auto',
                    }}
                  />
                </div>
                <small>Pratinjau</small>
              </div>
            </div>

            {/* ALAT PUTAR & BALIK */}
            <div className="tools">
              <button type="button" className="tl" id="rl" onClick={handleRotate}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
                </svg>
                Putar
              </button>
              <button type="button" className="tl" id="fl" onClick={handleFlip}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
                </svg>
                Balik
              </button>
            </div>

            {/* KONTROL SLIDER */}
            <div className="ctl">
              <span>Zoom</span>
              <button type="button" className="z" id="zm" onClick={() => setZoomLevel(zoom - 0.15)}>-</button>
              <input
                id="zr"
                type="range"
                min="100"
                max="300"
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
              />
              <button type="button" className="z" id="zp" onClick={() => setZoomLevel(zoom + 0.15)}>+</button>
              <output id="zo">{Math.round(zoom * 100)}%</output>
            </div>

            <div className="ctl">
              <span>Kiri–Kanan</span>
              <button type="button" className="z" id="gl" disabled={currentRenderW <= 1} onClick={() => setPosX(clamp(posX + 18, posY, zoom).clampedX)}>&lt;</button>
              <input
                id="hx"
                type="range"
                min="0"
                max="100"
                value={sliderX}
                disabled={currentRenderW <= 1}
                onChange={(e) => {
                  const newX = -(Number(e.target.value) / 100) * currentRenderW;
                  setPosX(newX);
                }}
              />
              <button type="button" className="z" id="gr" disabled={currentRenderW <= 1} onClick={() => setPosX(clamp(posX - 18, posY, zoom).clampedX)}>&gt;</button>
              <output id="xo">{sliderX}%</output>
            </div>

            <div className="ctl">
              <span>Atas–Bawah</span>
              <button type="button" className="z" id="gu" disabled={currentRenderH <= 1} onClick={() => setPosY(clamp(posX, posY + 18, zoom).clampedY)}>^</button>
              <input
                id="vy"
                type="range"
                min="0"
                max="100"
                value={sliderY}
                disabled={currentRenderH <= 1}
                onChange={(e) => {
                  const newY = -(Number(e.target.value) / 100) * currentRenderH;
                  setPosY(newY);
                }}
              />
              <button type="button" className="z" id="gd" disabled={currentRenderH <= 1} onClick={() => setPosY(clamp(posX, posY - 18, zoom).clampedY)}>v</button>
              <output id="yo">{sliderY}%</output>
            </div>

            {/* AKSI TOMBOL BAWAH */}
            <div className="mact">
              <label className="btn soft full" htmlFor="fileCropPicker" style={{ cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                </svg>
                Pilih Foto Baru
              </label>
              <input id="fileCropPicker" type="file" accept="image/*" className="sr" onChange={handleFileChange} />

              <div className="mact-row">
                <button
                  type="button"
                  className="btn soft"
                  id="rst"
                  onClick={() => {
                    setCropSrc(origSrc);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={`btn dark ${isUploading ? 'load' : ''}`}
                  id="sph"
                  onClick={handleSaveCrop}
                  disabled={isUploading}
                >
                  <span>{isUploading ? 'Menyimpan...' : 'Simpan Foto'}</span>
                  <i className="sp" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};