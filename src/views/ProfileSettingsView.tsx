import React, { useState, useEffect, useRef } from 'react';
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
const JOB_OPTIONS = ['Fotografer', 'Desainer Grafis', 'Editor', 'Videografer', 'Copywriter', 'Social Media Specialist'];

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

  // Modal Crop State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [imgDim, setImgDim] = useState({ w: 480, h: 480, base: 1 });
  const [isUploading, setIsUploading] = useState(false);

  const cropBoxRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Generate fallback avatar canvas
  const getInitialAvatar = (char: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 480;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    const gr = ctx.createLinearGradient(0, 0, 480, 480);
    gr.addColorStop(0, '#cfc6f4');
    gr.addColorStop(0.55, '#e3ddfa');
    gr.addColorStop(1, '#d4ee6b');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 480, 480);
    ctx.fillStyle = '#2a2440';
    ctx.font = 'bold 200px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((char || 'A').toUpperCase(), 240, 250);
    return c.toDataURL('image/jpeg');
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
        console.warn('Gagal memuat profil backend, menggunakan data lokal:', err);
        setInitialProfile({ name, email, job, status });
      }
    };
    fetchProfile();
  }, []);

  // Hitung persentase kelengkapan profil (5 parameter = @20%)
  const completeness = [avatarUrl ? 1 : 0, name.trim() ? 1 : 0, email.trim() ? 1 : 0, job.trim() ? 1 : 0, status ? 1 : 0].filter(Boolean).length * 20;
  const strokeOffset = 553 - (553 * (completeness / 100));

  useEffect(() => {
    setIsDirty(name !== initialProfile.name || email !== initialProfile.email || job !== initialProfile.job || status !== initialProfile.status);
  }, [name, email, job, status, initialProfile]);

  // Modal buka & hitung rasio crop
  const handleOpenModal = () => {
    const src = avatarUrl || getInitialAvatar(name[0]);
    setCropSrc(src);
    setIsModalOpen(true);
  };

  const onCropImgLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth || 480;
    const nh = img.naturalHeight || 480;
    const cs = 240;
    const base = cs / Math.min(nw, nh);

    setImgDim({ w: nw, h: nh, base });
    setZoom(1);
    setPosX((cs - nw * base) / 2);
    setPosY((cs - nh * base) / 2);
  };

  // Clamp pergeseran agar tidak keluar dari lingkaran
  const clamp = (x: number, y: number, currentZoom: number) => {
    const cs = 240;
    const rw = imgDim.w * imgDim.base * currentZoom;
    const rh = imgDim.h * imgDim.base * currentZoom;
    const cx = Math.min(0, Math.max(cs - rw, x));
    const cy = Math.min(0, Math.max(cs - rh, y));
    return { cx, cy };
  };

  const updateZoom = (newZoom: number) => {
    const targetZoom = Math.min(3, Math.max(1, newZoom));
    const { cx, cy } = clamp(posX, posY, targetZoom);
    setZoom(targetZoom);
    setPosX(cx);
    setPosY(cy);
  };

  // Drag Interaksi Kursor / Touch
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - posX, y: e.clientY - posY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const { cx, cy } = clamp(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y, zoom);
    setPosX(cx);
    setPosY(cy);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Putar & Balik Canvas
  const handleRotate = () => {
    const img = cropImgRef.current;
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
    const img = cropImgRef.current;
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

  // Upload file baru dari lokal
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar');
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setCropSrc(r.result as string);
    };
    r.readAsDataURL(f);
  };

  // Simpan hasil crop ke backend
  const handleSaveCrop = async () => {
    const img = cropImgRef.current;
    if (!img) return;
    setIsUploading(true);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 480;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const factor = 480 / 240;
    ctx.drawImage(
      img,
      0, 0, imgDim.w, imgDim.h,
      posX * factor, posY * factor,
      imgDim.w * imgDim.base * zoom * factor,
      imgDim.h * imgDim.base * zoom * factor
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
          headers: { 'Authorization': 'Bearer ' + token },
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
        console.warn('API upload offline, simpan data URL:', err);
        setAvatarUrl(croppedBase64);
        onAddToast('Foto profil diperbarui secara lokal');
      } finally {
        setIsUploading(false);
        setIsModalOpen(false);
      }
    }, 'image/jpeg', 0.92);
  };

  // Simpan data teks profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onAddToast('Nama lengkap wajib diisi.');
      return;
    }
    setIsSaving(true);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

    try {
      const res = await fetch(`${API_BASE}/save.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
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

  // Hitung persentase slider X dan Y
  const renderW = imgDim.w * imgDim.base * zoom;
  const renderH = imgDim.h * imgDim.base * zoom;
  const maxPanX = renderW - 240;
  const maxPanY = renderH - 240;
  const sliderXVal = maxPanX > 1 ? Math.round((-posX / maxPanX) * 100) : 50;
  const sliderYVal = maxPanY > 1 ? Math.round((-posY / maxPanY) * 100) : 50;

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

            <div className="pimg" onClick={handleOpenModal} role="button" tabIndex={0}>
              <img src={avatarUrl || getInitialAvatar(name[0])} alt="Foto Profil" />
            </div>

            <button type="button" className="pen" onClick={handleOpenModal} aria-label="Edit foto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          <div className="eyebrow">Foto Profil</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '6px 0' }}>{name || 'Pengguna'}</h1>
          <p className="sub" style={{ margin: '0 auto 16px' }}>
            Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.
          </p>

          <div className="chips">
            <span className="chip lime">Profil {completeness}% lengkap</span>
            <span className="chip">{job || 'Pekerjaan belum diatur'}</span>
            <span className="chip lav">{status || 'Status belum dipilih'}</span>
          </div>

          <button type="button" className="btn dark" onClick={handleOpenModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
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

            <div className="gl">Pilih Pekerjaan</div>
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

            <div className="gl">Status</div>
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

      {/* MODAL CROP EDIT FOTO */}
      {isModalOpen && (
        <div className="ov" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="mh">
              <h2>Edit Foto Profil</h2>
              <button type="button" className="x" onClick={() => setIsModalOpen(false)} aria-label="Tutup">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="sub" style={{ fontSize: 13, marginTop: 4 }}>
              Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
            </p>

            <div className="stagewrap">
              <div
                className="crop"
                ref={cropBoxRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  ref={cropImgRef}
                  src={cropSrc}
                  alt="Crop"
                  draggable={false}
                  onLoad={onCropImgLoaded}
                  style={{
                    transform: `translate(${posX}px, ${posY}px) scale(${imgDim.base * zoom})`,
                    width: `${imgDim.w}px`,
                    height: `${imgDim.h}px`,
                  }}
                />
                <div className="ring" />
              </div>

              {/* 3 LINGKARAN PRATINJAU */}
              <div className="prevs">
                <div className="pv l">
                  <img
                    src={cropSrc}
                    alt="L"
                    style={{
                      width: `${imgDim.w}px`,
                      height: `${imgDim.h}px`,
                      transform: `translate(${posX * (64 / 240)}px, ${posY * (64 / 240)}px) scale(${imgDim.base * zoom * (64 / 240)})`,
                    }}
                  />
                </div>
                <div className="pv m">
                  <img
                    src={cropSrc}
                    alt="M"
                    style={{
                      width: `${imgDim.w}px`,
                      height: `${imgDim.h}px`,
                      transform: `translate(${posX * (42 / 240)}px, ${posY * (42 / 240)}px) scale(${imgDim.base * zoom * (42 / 240)})`,
                    }}
                  />
                </div>
                <div className="pv s">
                  <img
                    src={cropSrc}
                    alt="S"
                    style={{
                      width: `${imgDim.w}px`,
                      height: `${imgDim.h}px`,
                      transform: `translate(${posX * (26 / 240)}px, ${posY * (26 / 240)}px) scale(${imgDim.base * zoom * (26 / 240)})`,
                    }}
                  />
                </div>
                <span>Pratinjau</span>
              </div>
            </div>

            {/* ALAT PUTAR & BALIK */}
            <div className="tools">
              <button type="button" className="tl" onClick={handleRotate}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Putar
              </button>
              <button type="button" className="tl" onClick={handleFlip}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M8 6l-5 6 5 6V6zM16 6l5 6-5 6V6z" />
                </svg>
                Balik
              </button>
            </div>

            {/* KONTROL SLIDER */}
            <div className="ctl">
              <span>Zoom</span>
              <button type="button" className="z" onClick={() => updateZoom(zoom - 0.15)}>-</button>
              <input
                type="range"
                min="100"
                max="300"
                value={Math.round(zoom * 100)}
                onChange={(e) => updateZoom(Number(e.target.value) / 100)}
              />
              <button type="button" className="z" onClick={() => updateZoom(zoom + 0.15)}>+</button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>

            <div className="ctl">
              <span>Kiri–Kanan</span>
              <button type="button" className="z" onClick={() => setPosX(clamp(posX + 20, posY, zoom).cx)}>&lt;</button>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderXVal}
                disabled={maxPanX <= 1}
                onChange={(e) => {
                  const x = -(Number(e.target.value) / 100) * maxPanX;
                  setPosX(x);
                }}
              />
              <button type="button" className="z" onClick={() => setPosX(clamp(posX - 20, posY, zoom).cx)}>&gt;</button>
              <output>{sliderXVal}%</output>
            </div>

            <div className="ctl">
              <span>Atas–Bawah</span>
              <button type="button" className="z" onClick={() => setPosY(clamp(posX, posY + 20, zoom).cy)}>^</button>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderYVal}
                disabled={maxPanY <= 1}
                onChange={(e) => {
                  const y = -(Number(e.target.value) / 100) * maxPanY;
                  setPosY(y);
                }}
              />
              <button type="button" className="z" onClick={() => setPosY(clamp(posX, posY - 20, zoom).cy)}>v</button>
              <output>{sliderYVal}%</output>
            </div>

            {/* AKSI BAWAH */}
            <div className="mact">
              <label className="btn soft" htmlFor="uploadModalFile" style={{ cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Pilih Foto Baru
              </label>
              <input type="file" id="uploadModalFile" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />

              <div className="mact-row">
                <button
                  type="button"
                  className="btn soft"
                  onClick={() => {
                    setZoom(1);
                    setPosX((240 - imgDim.w * imgDim.base) / 2);
                    setPosY((240 - imgDim.h * imgDim.base) / 2);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn dark"
                  onClick={handleSaveCrop}
                  disabled={isUploading}
                >
                  <span>{isUploading ? 'Menyimpan...' : 'Simpan Foto'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};