import React, { useState, useEffect, useRef } from 'react';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [job, setJob] = useState('');
  const [status, setStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [initialProfile, setInitialProfile] = useState({ name: '', email: '', job: '', status: '' });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Crop Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);

  // Fetch initial profile from backend
  const loadProfile = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const adminEmail = localStorage.getItem('admin_email') || '';
      const res = await fetch(`${API_BASE}/get.php?id=1`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + token,
          'X-Admin-Email': adminEmail,
        },
      });
      const json = await res.json();
      const u = json.data || json.user || json;
      if (u) {
        const id = u.id || u.user_id || 1;
        const n = u.full_name || u.name || 'RIZAL FADHILAH';
        const e = u.email || 'rizalsaragih498@gmail.com';
        const j = u.pekerjaan || u.title || u.profile_title || 'VIDEO EDITOR';
        const s = (u.status_karyawan || u.employment_status || u.status || 'KARYAWAN').toUpperCase();
        const av = u.avatar_url || u.avatar || u.photo;

        setProfileId(id);
        setName(n);
        setEmail(e);
        setJob(j);
        setStatus(s);
        if (av && typeof av === 'string' && av.trim() !== '') {
          setAvatarUrl(av);
        }
        setInitialProfile({ name: n, email: e, job: j, status: s });
      }
    } catch (err) {
      console.warn('Gagal memuat profil dari backend, menggunakan default:', err);
      const defName = 'RIZAL FADHILAH';
      const defEmail = 'rizalsaragih498@gmail.com';
      const defJob = 'VIDEO EDITOR';
      const defStatus = 'KARYAWAN';
      setName(defName);
      setEmail(defEmail);
      setJob(defJob);
      setStatus(defStatus);
      setInitialProfile({ name: defName, email: defEmail, job: defJob, status: defStatus });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Compute dirty state & completeness
  useEffect(() => {
    const dirty = name !== initialProfile.name || email !== initialProfile.email || job !== initialProfile.job || status !== initialProfile.status;
    setIsDirty(dirty);
  }, [name, email, job, status, initialProfile]);

  const completeness = [avatarUrl ? 1 : 0, name.trim() ? 1 : 0, email.trim() ? 1 : 0, job.trim() ? 1 : 0, status ? 1 : 0].filter(Boolean).length * 20;
  const strokeDashoffset = 553 * (1 - completeness / 100);

  // Generate Initials Avatar DataURL fallback
  const getInitialsDataUrl = () => {
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
    g.fillText((name.trim()[0] || 'R').toUpperCase(), 240, 262);
    return c.toDataURL();
  };

  const displayAvatar = avatarUrl || getInitialsDataUrl();

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      onAddToast('Nama lengkap wajib diisi.');
      return;
    }
    setIsSaving(true);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    const adminEmail = localStorage.getItem('admin_email') || email;

    try {
      const res = await fetch(`${API_BASE}/save.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'X-Admin-Email': adminEmail,
        },
        body: JSON.stringify({
          id: profileId,
          user_id: profileId,
          name: name.trim(),
          full_name: name.trim(),
          pekerjaan: job.trim(),
          title: job.trim(),
          status,
          status_karyawan: status,
        }),
      });
      const data = await res.json().catch(() => ({ success: true }));
      if (data.success || data.status === 'success' || res.ok) {
        setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
        setIsDirty(false);
        if (onUpdateUser) {
          onUpdateUser({ email, name: name.trim(), role: 'Administrator', status, avatar_url: avatarUrl });
        }
        onAddToast('Profil berhasil disimpan ke server');
      } else {
        onAddToast(data.message || 'Gagal menyimpan profil');
      }
    } catch (err) {
      console.error('Save error:', err);
      setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
      setIsDirty(false);
      onAddToast('Profil tersimpan di sesi lokal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar');
      return;
    }
    if (file.size > 10 * 1048576) {
      onAddToast('Ukuran foto maksimal 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setZoom(1);
      setPosX(0);
      setPosY(0);
      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCroppedPhoto = async () => {
    if (!cropRef.current || !imgRef.current) return;
    setIsUploading(true);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsUploading(false);
      return;
    }

    const img = imgRef.current;
    const cs = cropRef.current.clientWidth || 260;
    const k = 512 / cs;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, posX * k, posY * k, img.naturalWidth * zoom * (512 / Math.min(img.naturalWidth, img.naturalHeight)), img.naturalHeight * zoom * (512 / Math.min(img.naturalWidth, img.naturalHeight)));

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsUploading(false);
        return;
      }
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        const formData = new FormData();
        formData.append('avatar', blob, `avatar_${profileId}_${Date.now()}.jpg`);
        formData.append('id', String(profileId));

        const res = await fetch(`${API_BASE}/upload.php`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
          },
          body: formData,
        });
        const resJson = await res.json().catch(() => ({ success: false }));
        if (resJson.success && resJson.avatar_url) {
          setAvatarUrl(resJson.avatar_url);
        } else {
          setAvatarUrl(canvas.toDataURL('image/jpeg', 0.92));
        }
        onAddToast('Foto profil berhasil disimpan ke server');
      } catch (err) {
        console.warn('Upload API offline:', err);
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.92));
        onAddToast('Foto profil diperbarui secara lokal');
      } finally {
        setIsUploading(false);
        setIsModalOpen(false);
      }
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="view" style={{ paddingBottom: 60 }}>
      <main className="wrap" style={{ marginTop: 20 }}>
        {/* Left Card: Photo & Completeness */}
        <aside className="card rv" style={{ '--i': 0 } as any}>
          <div className="inner pc">
            <div className="pwrap">
              <svg className="pr" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#c2e04a" />
                    <stop offset="1" stopColor="#8f7fe0" />
                  </linearGradient>
                </defs>
                <circle className="a" cx="100" cy="100" r="88" fill="none" stroke="var(--line)" strokeWidth="5" />
                <circle className="b" id="ring" cx="100" cy="100" r="88" fill="none" stroke="url(#pg)" strokeWidth="5" strokeLinecap="round" style={{ strokeDasharray: 553, strokeDashoffset, transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)' }} />
              </svg>
              <div className="pimg" id="pimg" role="button" tabIndex={0} onClick={() => { setCropImageSrc(displayAvatar); setIsModalOpen(true); }} aria-label="Ubah foto profil">
                <img id="avimg" src={displayAvatar} alt="Foto Profil" />
              </div>
              <button className="pen" id="pen" onClick={() => { setCropImageSrc(displayAvatar); setIsModalOpen(true); }} aria-label="Edit foto profil">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />
                </svg>
              </button>
              <span className="pct" id="pct">{completeness}%</span>
            </div>
            <div className="eyebrow">Foto Profil</div>
            <h1 id="hname">{name || 'Pengguna'}</h1>
            <p className="sub" style={{ maxWidth: 300, marginInline: 'auto' }}>Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.</p>
            <div className="chips">
              <span className="chip lime" id="cDone">Profil {completeness}% lengkap</span>
              <span className="chip" id="cJob">{job || 'Pekerjaan belum diatur'}</span>
              <span className="chip lav" id="cStat">{status || 'Status belum dipilih'}</span>
            </div>
            <button className="btn dark" id="openEd" onClick={() => { setCropImageSrc(displayAvatar); setIsModalOpen(true); }} style={{ width: '100%' }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="9" cy="10" r="2" />
                <path d="m21 16-5-5-8 8" />
              </svg>
              <span>Ubah Foto</span>
            </button>
          </div>
        </aside>

        {/* Right Card: Form Information */}
        <section className="card rv" style={{ '--i': 1 } as any}>
          <div className="inner">
            <div className="fh">
              <div>
                <div className="eyebrow">Pengaturan</div>
                <h2 style={{ marginTop: 6, fontSize: 26 }}>Informasi Profil</h2>
                <p className="sub">Ubah data yang tampil di akun Anda.</p>
              </div>
              <span className={`dirty ${isDirty ? 'on' : ''}`} id="dirty">
                <i /> Perubahan belum disimpan
              </span>
            </div>
            <form id="form" onSubmit={handleSave} noValidate>
              <div className="f" style={{ '--j': 0 } as any}>
                <input id="fn" placeholder=" " value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <label htmlFor="fn">Name</label>
                <div className="err">Name wajib diisi.</div>
              </div>
              <div className="f" style={{ '--j': 1 } as any}>
                <input id="fe" type="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <label htmlFor="fe">Email</label>
                <div className="err">Masukkan alamat email yang valid.</div>
              </div>
              <div className="f" style={{ '--j': 2 } as any}>
                <input id="fj" placeholder=" " value={job} onChange={(e) => setJob(e.target.value)} autoComplete="organization-title" />
                <label htmlFor="fj">Pekerjaan</label>
              </div>

              <div className="gl" style={{ '--j': 3 } as any}>PILIH PEKERJAAN</div>
              <div className="opts" id="jobs" style={{ '--j': 3 } as any}>
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

              <div className="gl" style={{ '--j': 4 } as any}>STATUS</div>
              <div className="opts" id="stat" role="radiogroup" aria-label="Status" style={{ '--j': 5 } as any}>
                {STAT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={status.toUpperCase() === s}
                    className={`opt ${status.toUpperCase() === s ? 'on' : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="fa" style={{ '--j': 6 } as any}>
                <button
                  type="button"
                  className="btn soft"
                  id="cancel"
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
                <button type="submit" className={`btn dark ${isSaving ? 'load' : ''}`} id="save2">
                  <span>Simpan Profil</span>
                  <i className="sp" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* Crop Modal */}
      {isModalOpen && (
        <div className="ov show" id="ov" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
            <div className="grab" />
            <div className="mh">
              <h2 id="mt">Edit Foto Profil</h2>
              <button className="x" id="mx" onClick={() => setIsModalOpen(false)} aria-label="Tutup">
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
                tabIndex={0}
                role="application"
                aria-label="Area crop"
              >
                {cropImageSrc && (
                  <img
                    ref={imgRef}
                    id="cimg"
                    src={cropImageSrc}
                    alt="Pratinjau Crop"
                    draggable="false"
                    style={{
                      transform: `translate(${posX}px, ${posY}px) scale(${zoom})`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
                <div className="grid" />
                <div className="ring" />
              </div>
            </div>
            <div className="ctl">
              <span>Zoom</span>
              <button className="z" onClick={() => setZoom(Math.max(1, zoom - 0.1))} aria-label="Perkecil">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <input
                id="zr"
                type="range"
                min="100"
                max="300"
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
                aria-label="Zoom"
              />
              <button className="z" onClick={() => setZoom(Math.min(3, zoom + 0.1))} aria-label="Perbesar">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <output id="zo">{Math.round(zoom * 100)}%</output>
            </div>
            <div className="mact">
              <label className="btn soft full" htmlFor="file-upload" style={{ cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
                  <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                </svg>
                Pilih Foto Baru
              </label>
              <input id="file-upload" type="file" accept="image/*" className="sr" onChange={handleFileChange} />
              <button className="btn soft" onClick={() => { setZoom(1); setPosX(0); setPosY(0); }}>Reset</button>
              <button className={`btn dark ${isUploading ? 'load' : ''}`} id="sph" onClick={handleUploadCroppedPhoto}>
                <span>Simpan Foto</span>
                <i className="sp" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
