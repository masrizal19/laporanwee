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

  // Cropper states & high-performance pointer tracking refs
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [imageDims, setImageDims] = useState<{ width: number; height: number; baseScale: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const CONTAINER_SIZE = 240;

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const imageDimsRef = useRef<{ width: number; height: number; baseScale: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    panRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    imageDimsRef.current = imageDims;
  }, [imageDims]);

  // Global window listeners while dragging to guarantee smooth dragging even outside container
  useEffect(() => {
    if (!isDragging) return;

    const onGlobalPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const nextX = dragStartRef.current.initialPanX + dx;
      const nextY = dragStartRef.current.initialPanY + dy;

      const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
        baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
      } : null);

      if (dims) {
        const currentZoom = zoomRef.current;
        const scaledW = dims.width * dims.baseScale * currentZoom;
        const scaledH = dims.height * dims.baseScale * currentZoom;
        const maxX = Math.max(0, (scaledW - CONTAINER_SIZE) / 2);
        const maxY = Math.max(0, (scaledH - CONTAINER_SIZE) / 2);
        const clampedX = Math.max(-maxX, Math.min(maxX, nextX));
        const clampedY = Math.max(-maxY, Math.min(maxY, nextY));

        setPanX(clampedX);
        setPanY(clampedY);
        panRef.current = { x: clampedX, y: clampedY };
      } else {
        setPanX(nextX);
        setPanY(nextY);
        panRef.current = { x: nextX, y: nextY };
      }
    };

    const onGlobalPointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onGlobalPointerMove);
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
    };
  }, [isDragging]);

  const loadImageIntoCropper = (src: string) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width <= 0 || height <= 0) return;

      const scaleX = CONTAINER_SIZE / width;
      const scaleY = CONTAINER_SIZE / height;
      const baseScale = Math.max(scaleX, scaleY);

      const newDims = { width, height, baseScale };
      setImageDims(newDims);
      imageDimsRef.current = newDims;
      setZoom(1);
      zoomRef.current = 1;
      setPanX(0);
      setPanY(0);
      panRef.current = { x: 0, y: 0 };
      isDraggingRef.current = false;
      setIsDragging(false);
      setRawImageSrc(src);
    };
    img.onerror = (e) => {
      console.error('[LOAD CROPPER ERROR] Gagal memuat foto profil:', e);
      onAddToast('Gagal memuat foto profil untuk diatur.');
    };
    img.src = src;
  };

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
      loadImageIntoCropper(src);
      e.target.value = '';
    }
  };

  // Zoom control (Target 6, 7, 8, 9)
  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, Math.round(nextZoom * 100) / 100));
    setZoom(clampedZoom);
    zoomRef.current = clampedZoom;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    if (dims) {
      const scaledW = dims.width * dims.baseScale * clampedZoom;
      const scaledH = dims.height * dims.baseScale * clampedZoom;
      const maxX = Math.max(0, (scaledW - CONTAINER_SIZE) / 2);
      const maxY = Math.max(0, (scaledH - CONTAINER_SIZE) / 2);

      setPanX((prevX) => {
        const nextX = Math.max(-maxX, Math.min(maxX, prevX));
        panRef.current.x = nextX;
        return nextX;
      });
      setPanY((prevY) => {
        const nextY = Math.max(-maxY, Math.min(maxY, prevY));
        panRef.current.y = nextY;
        return nextY;
      });
    }
  };

  // Pointer Events for smooth drag across desktop mouse and touch (Target 4, 5, 9)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panRef.current.x,
      initialPanY: panRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const nextX = dragStartRef.current.initialPanX + dx;
    const nextY = dragStartRef.current.initialPanY + dy;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    if (dims) {
      const scaledW = dims.width * dims.baseScale * zoomRef.current;
      const scaledH = dims.height * dims.baseScale * zoomRef.current;
      const maxX = Math.max(0, (scaledW - CONTAINER_SIZE) / 2);
      const maxY = Math.max(0, (scaledH - CONTAINER_SIZE) / 2);
      const clampedX = Math.max(-maxX, Math.min(maxX, nextX));
      const clampedY = Math.max(-maxY, Math.min(maxY, nextY));

      setPanX(clampedX);
      setPanY(clampedY);
      panRef.current = { x: clampedX, y: clampedY };
    } else {
      setPanX(nextX);
      setPanY(nextY);
      panRef.current = { x: nextX, y: nextY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(zoomRef.current + delta);
  };

  // Reset to initial valid state (Target 5)
  const handleResetCrop = () => {
    setZoom(1);
    zoomRef.current = 1;
    setPanX(0);
    setPanY(0);
    panRef.current = { x: 0, y: 0 };
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Generate 1:1 Pixel-Perfect Crop based on final position and zoom, then directly upload to /api/profile.php
  const handleGenerateCrop = async () => {
    if (!rawImageSrc) {
      console.warn('[CROP] rawImageSrc tidak tersedia');
      return;
    }

    try {
      const activeImg = imgRef.current;
      const naturalW = activeImg?.naturalWidth || imageDimsRef.current?.width || CONTAINER_SIZE;
      const naturalH = activeImg?.naturalHeight || imageDimsRef.current?.height || CONTAINER_SIZE;

      if (naturalW <= 0 || naturalH <= 0) {
        throw new Error('Dimensi gambar tidak valid untuk crop');
      }

      const outputSize = 400; // Resolusi tinggi avatar (1:1)
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context tidak tersedia');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const dims = imageDimsRef.current || {
        width: naturalW,
        height: naturalH,
        baseScale: Math.max(CONTAINER_SIZE / naturalW, CONTAINER_SIZE / naturalH),
      };

      const canvasScale = outputSize / CONTAINER_SIZE;
      const currentZoom = zoomRef.current;
      const currentPanX = panRef.current.x;
      const currentPanY = panRef.current.y;

      const displayedW = dims.width * dims.baseScale * currentZoom;
      const displayedH = dims.height * dims.baseScale * currentZoom;

      const centerX = CONTAINER_SIZE / 2 + currentPanX;
      const centerY = CONTAINER_SIZE / 2 + currentPanY;

      const drawX = (centerX - displayedW / 2) * canvasScale;
      const drawY = (centerY - displayedH / 2) * canvasScale;
      const drawW = displayedW * canvasScale;
      const drawH = displayedH * canvasScale;

      // Draw the image onto canvas
      if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        ctx.drawImage(
          activeImg,
          0,
          0,
          naturalW,
          naturalH,
          drawX,
          drawY,
          drawW,
          drawH
        );
      } else {
        // Fallback using new Image instance
        const fallbackImg = new Image();
        await new Promise<void>((resolve, reject) => {
          fallbackImg.onload = () => resolve();
          fallbackImg.onerror = (e) => reject(e);
          fallbackImg.src = rawImageSrc;
        });
        ctx.drawImage(
          fallbackImg,
          0,
          0,
          fallbackImg.naturalWidth,
          fallbackImg.naturalHeight,
          drawX,
          drawY,
          drawW,
          drawH
        );
      }

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            console.error('[CROP ERROR] canvas.toBlob menghasilkan null');
            onAddToast('Gagal memproses crop foto.');
            return;
          }

          if (blob.size === 0) {
            console.error('[CROP ERROR] Blob hasil crop berukuran 0 bytes');
            onAddToast('Gagal memproses crop foto.');
            return;
          }

          // Validasi MIME & file
          const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
          console.log('[CROP GENERATED]', {
            name: croppedFile.name,
            size: croppedFile.size,
            type: croppedFile.type,
          });

          await uploadCroppedProfile(croppedFile, blob);
        },
        'image/jpeg',
        0.95
      );
    } catch (err: any) {
      console.error('[CROP ERROR] Gagal memproses canvas crop:', err);
      onAddToast('Gagal memproses crop foto.');
    }
  };

  const uploadCroppedProfile = async (file: File, blob: Blob) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      // Field wajib avatar sesuai backend PHP $_FILES['avatar']
      formData.append('avatar', file, 'profile.jpg');
      if (name && name.trim()) {
        formData.append('full_name', name.trim());
      }

      console.log('[API REQUEST] POST /api/profile.php upload avatar:', {
        fieldName: 'avatar',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fullName: name,
      });

      const res = await api.upload('/profile.php', formData);
      console.log('[API RESPONSE] POST /api/profile.php:', res);

      if (res && res.success) {
        onAddToast('Profil berhasil diperbarui!');
        const returnedUrl = res.data?.avatar_url || res.data?.avatar;
        const finalAvatar = returnedUrl ? `${returnedUrl}?v=${Date.now()}` : URL.createObjectURL(blob);

        setAvatarUrl(finalAvatar);
        setCroppedBlob(blob);
        setCroppedPreviewUrl(finalAvatar);
        setRawImageSrc(null);
        setIsEditOpen(false);

        if (res.data?.full_name) {
          setName(res.data.full_name);
        }

        if (onUpdateUser) {
          onUpdateUser({
            email: email,
            name: res.data?.full_name || name,
            avatar_url: finalAvatar,
          });
        }

        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.avatar_url = finalAvatar;
            if (res.data?.full_name) parsed.name = res.data.full_name;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }
      } else {
        const errorMsg = res?.message || 'Gagal memperbarui profil.';
        console.error('[API ERROR] Response upload tidak sukses:', res);
        onAddToast(errorMsg);
      }
    } catch (err: any) {
      console.error('[API ERROR] Exception upload profil:', err);
      onAddToast(err?.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSubmitting(false);
    }
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

      console.log('[API REQUEST] POST /api/profile.php (form save):', { name, hasBlob: !!croppedBlob });

      const res = await api.upload('/profile.php', formData);

      if (res && res.success) {
        onAddToast('Profil berhasil diperbarui!');
        const finalAvatar = res.data?.avatar_url ? `${res.data.avatar_url}?v=${Date.now()}` : null;
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
            {(() => {
              const activeDims = imageDims || imageDimsRef.current || (imgRef.current?.naturalWidth ? {
                width: imgRef.current.naturalWidth,
                height: imgRef.current.naturalHeight,
                baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
              } : null);

              const baseWidth = activeDims ? activeDims.width * activeDims.baseScale : CONTAINER_SIZE;
              const baseHeight = activeDims ? activeDims.height * activeDims.baseScale : CONTAINER_SIZE;
              const left = (CONTAINER_SIZE - baseWidth) / 2;
              const top = (CONTAINER_SIZE - baseHeight) / 2;

              return (
                <div
                  style={{
                    width: `${CONTAINER_SIZE}px`,
                    height: `${CONTAINER_SIZE}px`,
                    margin: '0 auto 16px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#111',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    border: '3px solid var(--primary-color, #4A55FF)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onWheel={handleWheel}
                >
                  <img
                    ref={imgRef}
                    src={rawImageSrc}
                    alt="Crop preview"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      const width = el.naturalWidth || el.width;
                      const height = el.naturalHeight || el.height;
                      if (width > 0 && height > 0) {
                        const scaleX = CONTAINER_SIZE / width;
                        const scaleY = CONTAINER_SIZE / height;
                        const baseScale = Math.max(scaleX, scaleY);
                        const newDims = { width, height, baseScale };
                        setImageDims(newDims);
                        imageDimsRef.current = newDims;
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${baseWidth}px`,
                      height: `${baseHeight}px`,
                      transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                      willChange: isDragging ? 'transform' : 'auto',
                    }}
                  />
                </div>
              );
            })()}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleZoomChange(zoom - 0.1)}
                title="Perkecil (-)"
                aria-label="Perkecil zoom"
                style={{ minWidth: '32px', fontWeight: 700 }}
              >
                -
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.02"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                style={{ width: '130px', accentColor: 'var(--primary-color, #4A55FF)', cursor: 'pointer' }}
                aria-label="Zoom slider"
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleZoomChange(zoom + 0.1)}
                title="Perbesar (+)"
                aria-label="Perbesar zoom"
                style={{ minWidth: '32px', fontWeight: 700 }}
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
                disabled={isSubmitting}
              >
                Batal / Pilih Ulang
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleGenerateCrop}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Menyimpan...' : 'Terapkan Crop'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile}>
            <div className="field" style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  margin: '0 auto 10px',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: '#eee',
                  cursor: (croppedPreviewUrl || avatarUrl) ? 'pointer' : 'default',
                  border: '2px solid rgba(0,0,0,0.08)'
                }}
                title={croppedPreviewUrl || avatarUrl ? 'Klik untuk atur / sesuaikan crop foto saat ini' : undefined}
                onClick={() => {
                  const currentImg = croppedPreviewUrl || avatarUrl;
                  if (currentImg) {
                    loadImageIntoCropper(currentImg);
                  }
                }}
              >
                <img
                  src={croppedPreviewUrl || avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label htmlFor="avatar-file-input" className="btn btn-outline btn-sm" style={{ display: 'inline-block', cursor: 'pointer' }}>
                  Pilih &amp; Crop Foto Baru
                </label>
                {(croppedPreviewUrl || avatarUrl) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      const currentImg = croppedPreviewUrl || avatarUrl;
                      if (currentImg) {
                        loadImageIntoCropper(currentImg);
                      }
                    }}
                  >
                    Atur Crop Foto
                  </button>
                )}
              </div>
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
