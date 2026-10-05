import React, { useState, useEffect, useRef } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { API_BASE_URL, api } from '../utils/api';
import { ReportCoverThumbnail } from '../components/ReportCoverThumbnail';

interface ProfileViewProps {
  projects: Project[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: { email: string; name: string; avatar_url?: string }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  projects,
  reports,
  onNavigate,
  onSelectProject,
  onSelectReport,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna LaporanWee');
  const [role, setRole] = useState('Anggota Tim Kreatif');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cropper states
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [imageDims, setImageDims] = useState<{ width: number; height: number; baseScale: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fetch profile from backend on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileUrl = `${API_BASE_URL}/profile.php`;
        console.log('[API REQUEST]', { method: 'GET', url: profileUrl });
        const res = await api.get('/profile.php');
        if (res && res.success && res.data) {
          if (res.data.full_name) setName(res.data.full_name);
          if (res.data.email) setEmail(res.data.email);
          if (res.data.role) setRole(res.data.role);
          if (res.data.avatar_url) {
            const avatarWithCache = `${res.data.avatar_url}?t=${Date.now()}`;
            setAvatarUrl(avatarWithCache);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat profil dari API:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
        onAddToast('Format file foto harus JPG, PNG, atau WEBP.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        onAddToast('Ukuran file foto maksimal 10 MB.');
        return;
      }

      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const containerSize = 240;
        const scaleX = containerSize / img.width;
        const scaleY = containerSize / img.height;
        const baseScale = Math.min(scaleX, scaleY);
        setImageDims({ width: img.width, height: img.height, baseScale });
        setZoom(1); // 1 = fit contain, entire image visible
        setPanX(0);
        setPanY(0);
        setRawImageSrc(src);
      };
      img.src = src;
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX - panX, y: clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPanX(clientX - dragStartRef.current.x);
    setPanY(clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetCrop = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleGenerateCrop = () => {
    if (!rawImageSrc || !imageDims) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      const previewContainerSize = 240;
      const canvasScale = size / previewContainerSize;

      const displayedWidth = imageDims.width * imageDims.baseScale * zoom * canvasScale;
      const displayedHeight = imageDims.height * imageDims.baseScale * zoom * canvasScale;

      const centerX = size / 2 + panX * canvasScale;
      const centerY = size / 2 + panY * canvasScale;

      const drawX = centerX - displayedWidth / 2;
      const drawY = centerY - displayedHeight / 2;

      ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, displayedWidth, displayedHeight);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          setCroppedBlob(blob);
          setCroppedPreviewUrl(URL.createObjectURL(blob));
          setRawImageSrc(null);
          onAddToast('Crop foto berhasil diatur!');
        }
      }, 'image/jpeg', 0.92);
    };
    img.src = rawImageSrc;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('full_name', name);
      if (croppedBlob) {
        formData.append('avatar', croppedBlob, 'profile_cropped.jpg');
      }

      const uploadUrl = `${API_BASE_URL}/profile.php`;
      console.log('[API REQUEST]', { method: 'POST (UPLOAD)', url: uploadUrl });

      const res = await api.upload('/profile.php', formData);

      if (res && res.success) {
        onAddToast('Profil berhasil diperbarui!');
        const finalAvatar = res.data?.avatar_url ? `${res.data.avatar_url}?t=${Date.now()}` : null;
        if (finalAvatar) {
          setAvatarUrl(finalAvatar);
        }
        if (res.data?.full_name) {
          setName(res.data.full_name);
        }
        if (onUpdateUser) {
          onUpdateUser({
            email: email,
            name: res.data?.full_name || name,
            avatar_url: finalAvatar || undefined,
          });
        }
        setIsEditOpen(false);
        setCroppedBlob(null);
        setCroppedPreviewUrl(null);
      } else {
        throw new Error(res?.message || 'Gagal memperbarui profil.');
      }
    } catch (err: any) {
      console.error('[API ERROR] Update profile error:', err);
      onAddToast(err?.message || 'Terjadi kesalahan saat memperbarui profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myReports = reports.filter(
    (r) =>
      (userEmail && r.person.toLowerCase().includes(userEmail.split('@')[0].toLowerCase())) ||
      (userName && r.person.toLowerCase().includes(userName.toLowerCase()))
  );

  return (
    <div className="view">
      {/* Profile Hero Card */}
      <div className="card profile-hero" style={{ marginBottom: '22px' }}>
        <div className="profile-avatar-lg">
          <img
            src={croppedPreviewUrl || avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"}
            alt={name}
          />
        </div>

        <div className="profile-name">
          <h2>{name}</h2>
          <p>{role} &bull; {email}</p>
          <button className="edit-link" onClick={() => setIsEditOpen(true)}>
            <Icon name="pencil" />
            <span>Edit Profil</span>
          </button>
        </div>

        <div className="profile-mini-stats">
          <div className="stat-chip c-mint">
            <div className="ic">
              <Icon name="doc" />
            </div>
            <div>
              <div className="num">28</div>
              <div className="lbl">Laporan Terkirim</div>
            </div>
          </div>
          <div className="stat-chip c-lav">
            <div className="ic">
              <Icon name="checksq" />
            </div>
            <div>
              <div className="num">14</div>
              <div className="lbl">Proyek Selesai</div>
            </div>
          </div>
          <div className="stat-chip c-pink">
            <div className="ic">
              <Icon name="target" />
            </div>
            <div>
              <div className="num">98.4%</div>
              <div className="lbl">Tepat Waktu</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Left: Active work & reports */}
        <div>
          <div>
            <h3 className="section-title">Proyek Yang Saya Tangani</h3>
            <p className="section-sub">Tugas desain &amp; prototyping aktif saat ini</p>

            <div className="card-grid-2">
              {projects.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  className="work-card"
                  onClick={() => {
                    onSelectProject(p.id);
                    onNavigate('project-detail');
                  }}
                >
                  <div className="cat">
                    <Icon name={p.cat} />
                    <span>{p.catLabel}</span>
                  </div>
                  <h4>{p.name}</h4>
                  <div className="wc-footer">
                    <div className="mini-track">
                      <div className="mini-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="pct">{p.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                Riwayat Laporan Saya
              </h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate('create-report')}
              >
                + Buat Baru
              </button>
            </div>

            {myReports.map((r) => (
              <div
                key={r.id}
                className="report-row"
                onClick={() => {
                  onSelectReport(r.id);
                  onNavigate('report-detail');
                }}
              >
                <ReportCoverThumbnail report={r} />
                <div className="rmid">
                  <b>{r.task}</b>
                  <span>{r.project} &bull; {r.date}</span>
                </div>
                <span className={`rstat ${r.status.replace(/\s+/g, '')}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Productivity & Mini calendar */}
        <div className="right-col">
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Produktivitas Mingguan
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Persentase deliverable 5 hari kerja
            </p>

            <div className="mini-week">
              <div className="mw-row">
                <div className="mw-day">Sen</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '85%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">85%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Sel</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '92%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">92%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Rab</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '96%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">96%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Kam</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '70%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">70%</div>
              </div>
              <div className="mw-row">
                <div className="mw-day">Jum</div>
                <div className="mw-track">
                  <div className="mw-fill" style={{ width: '80%', background: 'var(--violet)' }} />
                </div>
                <div className="mw-val">80%</div>
              </div>
            </div>

            <div className="tip-box">
              <Icon name="target" />
              <span>Hebat! Konsistensi kamu berada di level Top 5% tim Wee.</span>
            </div>
          </div>

          <div className="card summary-card">
            <div className="mini-cal-head">
              <b style={{ fontSize: '14px' }}>Oktober 2026</b>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('calendar')}
              >
                Buka Kalender &rarr;
              </button>
            </div>
            <table className="mini-cal-table">
              <thead>
                <tr>
                  <th>S</th>
                  <th>S</th>
                  <th>R</th>
                  <th>K</th>
                  <th>J</th>
                  <th>S</th>
                  <th>M</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="muted2">28</td>
                  <td className="muted2">29</td>
                  <td className="muted2">30</td>
                  <td>1</td>
                  <td>2</td>
                  <td>3</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>6<div className="evdot" /></td>
                  <td>7</td>
                  <td>8</td>
                  <td>9</td>
                  <td>10<div className="evdot" /></td>
                  <td>11</td>
                </tr>
                <tr>
                  <td>12</td>
                  <td>13</td>
                  <td className="today">14<div className="evdot" /></td>
                  <td>15</td>
                  <td>16<div className="evdot" /></td>
                  <td>17</td>
                  <td>18</td>
                </tr>
                <tr>
                  <td>19</td>
                  <td>20</td>
                  <td>21<div className="evdot" /></td>
                  <td>22</td>
                  <td>23</td>
                  <td>24</td>
                  <td>25</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setRawImageSrc(null);
        }}
        title="Ubah Profil Pengguna"
      >
        {rawImageSrc ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', marginBottom: '12px' }}>
              Geser (drag) foto dan atur zoom untuk menyesuaikan crop melingkar:
            </p>
            <div
              style={{
                width: '240px',
                height: '240px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                background: '#111',
                cursor: isDragging ? 'grabbing' : 'grab',
                border: '3px solid var(--primary-color, #4A55FF)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              <img
                src={rawImageSrc}
                alt="Crop preview"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: imageDims ? `${imageDims.width * imageDims.baseScale}px` : 'auto',
                  height: imageDims ? `${imageDims.height * imageDims.baseScale}px` : 'auto',
                  transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
              >
                -
              </button>
              <input
                type="range"
                min="0.2"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ width: '120px', accentColor: 'var(--primary-color)' }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              >
                +
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetCrop}
                style={{ fontSize: '12px', marginLeft: '6px' }}
              >
                Reset
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRawImageSrc(null)}
              >
                Batal / Pilih Ulang
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleGenerateCrop}
              >
                Terapkan Crop
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile}>
            <div className="field" style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ margin: '0 auto 10px', width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', background: '#eee' }}>
                <img
                  src={croppedPreviewUrl || avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <label htmlFor="avatar-file-input" className="btn btn-outline btn-sm" style={{ display: 'inline-block', cursor: 'pointer' }}>
                Pilih &amp; Crop Foto Baru
              </label>
              <input
                id="avatar-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className="field">
              <label htmlFor="user-name-input">Nama Lengkap</label>
              <input
                id="user-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="user-role-input">Jabatan &amp; Peran</label>
              <input
                id="user-role-input"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="user-email-input">Alamat Email Perusahaan</label>
              <input
                id="user-email-input"
                type="email"
                value={email}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-dark" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
