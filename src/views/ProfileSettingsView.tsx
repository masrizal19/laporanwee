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
const JOB_OPTIONS = ['Art Director', 'Desainer Grafis', 'VIDEO EDITOR', 'Videografer', 'Copywriter', 'Social Media'];
const STATUS_OPTIONS = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({ onAddToast, onUpdateUser }) => {
  const [profileId, setProfileId] = useState<number | string>(1);
  const [name, setName] = useState('Admin');
  const [email, setEmail] = useState('');
  const [job, setJob] = useState('');
  const [status, setStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [initialProfile, setInitialProfile] = useState({ name: 'Admin', email: '', job: '', status: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Modal crop state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [scaleBase, setScaleBase] = useState(1);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);

  // Load user data from backend
  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const adminEmail = localStorage.getItem('admin_email') || '';
      const res = await fetch(`${API_BASE}/get.php?id=1`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Admin-Email': adminEmail,
        },
      });
      const json = await res.json();
      const u = json.data || json.user || json;
      if (u) {
        const id = u.id || 1;
        const n = u.full_name || u.name || 'RIZAL FADHILAH';
        const e = u.email || 'rizalsaragih498@gmail.com';
        const j = u.pekerjaan || u.title || 'VIDEO EDITOR';
        const s = (u.status_karyawan || u.employment_status || u.status || 'KARYAWAN').toUpperCase();
        const av = u.avatar_url || u.avatar || '';

        setProfileId(id);
        setName(n);
        setEmail(e);
        setJob(j);
        setStatus(s);
        setAvatarUrl(av || null);
        setInitialProfile({ name: n, email: e, job: j, status: s });
      }
    } catch (e) {
      console.warn('Backend get offline, using defaults:', e);
      const defName = 'RIZAL FADHILAH';
      const defEmail = 'rizalsaragih498@gmail.com';
      const defJob = 'VIDEO EDITOR';
      const defStatus = 'KARYAWAN';
      setName(defName);
      setEmail(defEmail);
      setJob(defJob);
      setStatus(defStatus);
      setInitialProfile({ name: defName, email: defEmail, job: defJob, status: defStatus });
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // Completeness percentage
  const filledCount = [
    Boolean(avatarUrl),
    Boolean(name.trim()),
    Boolean(email.trim()),
    Boolean(job.trim()),
    Boolean(status),
  ].filter(Boolean).length;
  const percent = filledCount * 20;
  const strokeDashoffset = 553 - (553 * (percent / 100));

  // Initials generator
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
    g.font = 'bold 200px Outfit,system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText((name.trim()[0] || 'A').toUpperCase(), 240, 250);
    return c.toDataURL('image/jpeg');
  };

  const displayAvatar = avatarUrl || '';

  const openCropModal = () => {
    const src = avatarUrl || getInitialsDataUrl();
    setCropImageSrc(src);
    setZoom(1);
    setPosX(0);
    setPosY(0);
    setIsModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

    try {
      const res = await fetch(`${API_BASE}/save.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: profileId,
          name: name.trim(),
          full_name: name.trim(),
          pekerjaan: job.trim(),
          status,
        }),
      });
      const resJson = await res.json().catch(() => ({ success: true }));
      if (resJson.success !== false) {
        setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
        if (onUpdateUser) {
          onUpdateUser({ email, name: name.trim(), role: 'Administrator', status, avatar_url: avatarUrl });
        }
        onAddToast('Profil berhasil disimpan');
      } else {
        onAddToast(resJson.message || 'Gagal menyimpan');
      }
    } catch (err) {
      console.error('Save error:', err);
      setInitialProfile({ name: name.trim(), email, job: job.trim(), status });
      onAddToast('Profil disimpan secara lokal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setCropImageSrc(ev.target.result as string);
        setZoom(1);
        setPosX(0);
        setPosY(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCropped = async () => {
    if (!cropRef.current || !imgRef.current) return;
    setIsUploading(true);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 480;
    const ctx = cv.getContext('2d');
    if (!ctx) {
      setIsUploading(false);
      return;
    }
    const cropSize = cropRef.current.clientWidth || 240;
    const factor = 480 / cropSize;

    ctx.drawImage(
      imgRef.current,
      0, 0, imgW, imgH,
      posX * factor, posY * factor,
      imgW * scaleBase * zoom * factor,
      imgH * scaleBase * zoom * factor
    );

    const croppedDataUrl = cv.toDataURL('image/jpeg', 0.92);

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
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json().catch(() => ({ success: false }));
        const finalUrl = (data.success && data.avatar_url) ? data.avatar_url : croppedDataUrl;
        setAvatarUrl(finalUrl);
        if (onUpdateUser) {
          onUpdateUser({ email, name, role: 'Administrator', status, avatar_url: finalUrl });
        }
        onAddToast('Foto profil berhasil diperbarui');
      } catch (err) {
        console.warn('Upload API offline:', err);
        setAvatarUrl(croppedDataUrl);
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
        {/* SISI KIRI: KARTU FOTO PROFIL */}
        <aside className="card pc">
          <div className="pwrap">
            <svg className="pr" viewBox="0 0 200 200">
              <circle className="a" cx="100" cy="100" r="88" fill="none" stroke="var(--line)" strokeWidth="5" />
              <circle className="b" id="ringProgress" cx="100" cy="100" r="88" fill="none" stroke="url(#pg)" strokeWidth="5" strokeLinecap="round" style={{ strokeDasharray: 553, strokeDashoffset, transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
            </svg>
            <span className="pct" id="pct">{percent}%</span>
            <div className="pimg" id="avatarBox" role="button" tabIndex={0} onClick={openCropModal} title="Klik untuk ubah foto">
              {displayAvatar ? (
                <img id="mainAvatarImg" src={displayAvatar} alt="Foto Profil" />
              ) : (
                <div id="mainAvatarInit" className="init-text">{(name[0] || 'A').toUpperCase()}</div>
              )}
            </div>
            <button className="pen" id="btnPenEdit" onClick={openCropModal} aria-label="Edit foto profil">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>

          <div className="eyebrow">Foto Profil</div>
          <h1 id="displayName">{name || 'Admin'}</h1>
          <p className="sub">Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.</p>

          <div className="chips">
            <span className="chip lime" id="chipPercent">Profil {percent}% lengkap</span>
            <span className="chip" id="chipJob">{job || 'Pekerjaan belum diatur'}</span>
            <span className="chip lav" id="chipStatus">{status || 'Status belum dipilih'}</span>
          </div>

          <button className="btn dark" id="btnOpenModal" onClick={openCropModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Ubah Foto</span>
          </button>
        </aside>

        {/* SISI KANAN: FORM EDIT INFORMASI PROFIL */}
        <section className="card">
          <div className="fh">
            <div className="eyebrow">Pengaturan</div>
            <h2>Informasi Profil</h2>
            <p className="sub">Ubah data yang tampil di akun Anda.</p>
          </div>

          <form id="profileForm" onSubmit={handleSaveForm} noValidate>
            <div className="f">
              <label htmlFor="inputName">Name</label>
              <input id="inputName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama lengkap" autoComplete="name" />
            </div>

            <div className="f">
              <label htmlFor="inputEmail">Email</label>
              <input id="inputEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@perusahaan.com" autoComplete="email" />
            </div>

            <div className="f">
              <label htmlFor="inputJob">Pekerjaan</label>
              <input id="inputJob" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Pilih atau ketik pekerjaan" />
            </div>

            <div className="eyebrow" style={{ marginTop: 20 }}>Pilih Pekerjaan</div>
            <div className="opts" id="jobChips">
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
            <div className="opts" id="statusChips">
              {STATUS_OPTIONS.map((s) => (
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

            <div className="fa">
              <button
                type="button"
                className="btn soft"
                id="btnCancel"
                onClick={() => {
                  setName(initialProfile.name);
                  setEmail(initialProfile.email);
                  setJob(initialProfile.job);
                  setStatus(initialProfile.status);
                  onAddToast('Perubahan dibatalkan');
                }}
                style={{ width: 'auto', padding: '0 24px' }}
              >
                Batalkan
              </button>
              <button type="submit" className="btn dark" id="btnSubmitForm" style={{ width: 'auto', padding: '0 28px' }}>
                Simpan Profil
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* MODAL CROP & EDIT FOTO */}
      {isModalOpen && (
        <div className="ov show" id="cropModalOverlay" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="mh">
              <h2>Edit Foto Profil</h2>
              <button className="x" id="btnCloseModal" onClick={() => setIsModalOpen(false)} aria-label="Tutup">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="sub" style={{ fontSize: 13, maxWidth: 'none' }}>Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.</p>

            <div className="stagewrap">
              <div
                className="crop-container"
                id="cropBox"
                ref={cropRef}
                onPointerDown={(e) => {
                  const box = e.currentTarget;
                  box.setPointerCapture(e.pointerId);
                  const startX = e.clientX - posX;
                  const startY = e.clientY - posY;
                  const onPointerMove = (ev: PointerEvent) => {
                    setPosX(ev.clientX - startX);
                    setPosY(ev.clientY - startY);
                  };
                  const onPointerUp = (ev: PointerEvent) => {
                    box.releasePointerCapture(ev.pointerId);
                    box.removeEventListener('pointermove', onPointerMove);
                    box.removeEventListener('pointerup', onPointerUp);
                  };
                  box.addEventListener('pointermove', onPointerMove);
                  box.addEventListener('pointerup', onPointerUp);
                }}
              >
                {cropImageSrc && (
                  <img
                    ref={imgRef}
                    id="cropImg"
                    src={cropImageSrc}
                    alt="Crop Target"
                    draggable="false"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const w = img.naturalWidth || 480;
                      const h = img.naturalHeight || 480;
                      setImgW(w);
                      setImgH(h);
                      const cs = cropRef.current?.clientWidth || 240;
                      const sb = cs / Math.min(w, h);
                      setScaleBase(sb);
                      setPosX((cs - w * sb) / 2);
                      setPosY((cs - h * sb) / 2);
                    }}
                    style={{
                      transform: `translate(${posX}px, ${posY}px) scale(${scaleBase * zoom})`,
                      width: `${imgW}px`,
                      height: `${imgH}px`,
                    }}
                  />
                )}
                <div className="grid-mask" />
              </div>
              <div className="prevs">
                <div className="pv l">
                  <img src={cropImageSrc} alt="" style={{ transform: `translate(${posX}px, ${posY}px) scale(${scaleBase * zoom * (64 / (cropRef.current?.clientWidth || 240))})`, width: `${imgW}px`, height: `${imgH}px` }} />
                </div>
                <div className="pv m">
                  <img src={cropImageSrc} alt="" style={{ transform: `translate(${posX}px, ${posY}px) scale(${scaleBase * zoom * (42 / (cropRef.current?.clientWidth || 240))})`, width: `${imgW}px`, height: `${imgH}px` }} />
                </div>
                <div className="pv s">
                  <img src={cropImageSrc} alt="" style={{ transform: `translate(${posX}px, ${posY}px) scale(${scaleBase * zoom * (26 / (cropRef.current?.clientWidth || 240))})`, width: `${imgW}px`, height: `${imgH}px` }} />
                </div>
                <span>Pratinjau</span>
              </div>
            </div>

            <div className="tools">
              <button
                type="button"
                className="tl"
                onClick={() => {
                  const cv = document.createElement('canvas');
                  cv.width = imgH;
                  cv.height = imgW;
                  const ctx = cv.getContext('2d');
                  if (ctx && imgRef.current) {
                    ctx.translate(cv.width / 2, cv.height / 2);
                    ctx.rotate(Math.PI / 2);
                    ctx.drawImage(imgRef.current, -imgW / 2, -imgH / 2);
                    setCropImageSrc(cv.toDataURL('image/jpeg', 0.95));
                  }
                }}
              >
                Putar
              </button>
              <button
                type="button"
                className="tl"
                onClick={() => {
                  const cv = document.createElement('canvas');
                  cv.width = imgW;
                  cv.height = imgH;
                  const ctx = cv.getContext('2d');
                  if (ctx && imgRef.current) {
                    ctx.translate(cv.width / 2, cv.height / 2);
                    ctx.scale(-1, 1);
                    ctx.drawImage(imgRef.current, -imgW / 2, -imgH / 2);
                    setCropImageSrc(cv.toDataURL('image/jpeg', 0.95));
                  }
                }}
              >
                Balik
              </button>
            </div>

            <div className="ctl">
              <span>Zoom</span>
              <button type="button" className="z" onClick={() => setZoom(Math.max(1, zoom - 0.15))}>-</button>
              <input type="range" min="100" max="300" value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} />
              <button type="button" className="z" onClick={() => setZoom(Math.min(3, zoom + 0.15))}>+</button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>

            <div className="ctl">
              <span>Kiri–Kanan</span>
              <button type="button" className="z" onClick={() => setPosX(posX + 20)}>&lt;</button>
              <input type="range" min="0" max="100" value={50} onChange={(e) => {
                const w = imgW * scaleBase * zoom - (cropRef.current?.clientWidth || 240);
                setPosX(- (Number(e.target.value) / 100) * w);
              }} />
              <button type="button" className="z" onClick={() => setPosX(posX - 20)}>&gt;</button>
              <output>50%</output>
            </div>

            <div className="ctl">
              <span>Atas–Bawah</span>
              <button type="button" className="z" onClick={() => setPosY(posY + 20)}>^</button>
              <input type="range" min="0" max="100" value={50} onChange={(e) => {
                const h = imgH * scaleBase * zoom - (cropRef.current?.clientHeight || 240);
                setPosY(- (Number(e.target.value) / 100) * h);
              }} />
              <button type="button" className="z" onClick={() => setPosY(posY - 20)}>v</button>
              <output>50%</output>
            </div>

            <div className="mact">
              <label className="btn soft" htmlFor="filePicker" style={{ cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Pilih Foto Baru
              </label>
              <input type="file" id="filePicker" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

              <div className="mact-row">
                <button type="button" className="btn soft" onClick={() => { setZoom(1); setPosX((240 - imgW * scaleBase) / 2); setPosY((240 - imgH * scaleBase) / 2); }}>Reset</button>
                <button type="button" className={`btn dark ${isUploading ? 'load' : ''}`} onClick={handleSaveCropped}>
                  <span>Simpan Foto</span>
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
