import React, { useState, useEffect, useRef } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { API_BASE_URL, api } from '../utils/api';
import '../profile-edit.css';

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
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna LaporanWee');
  const [role, setRole] = useState('Principal Product Designer');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [location, setLocation] = useState('San Francisco, CA');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);

  const [activeEditingField, setActiveEditingField] = useState<'name' | 'role' | 'location' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);

  // Photo Cropper States
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageDims, setImageDims] = useState<{ width: number; height: number; baseScale: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const CONTAINER_SIZE = 240;

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const imageDimsRef = useRef<{ width: number; height: number; baseScale: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    imageDimsRef.current = imageDims;
  }, [imageDims]);

  // Fetch Profile data from backend on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/profile.php');
        if (res && res.success && res.data) {
          if (res.data.full_name) setName(res.data.full_name);
          if (res.data.email) setEmail(res.data.email);
          if (res.data.role) setRole(res.data.role);
          if (res.data.location) setLocation(res.data.location);
          if (res.data.avatar_url) {
            const avatarWithCache = `${res.data.avatar_url}?v=${Date.now()}`;
            setAvatarUrl(avatarWithCache);
          }
        }
      } catch (err) {
        console.warn('[PROFILE] Memuat profil dari API:', err);
      }
    };
    fetchProfile();
  }, []);

  const computeMaxPan = (z: number, dims: { width: number; height: number; baseScale: number } | null) => {
    if (!dims) return { maxX: 0, maxY: 0 };
    const scaledW = dims.width * dims.baseScale * z;
    const scaledH = dims.height * dims.baseScale * z;
    const maxX = Math.max(0, (scaledW - CONTAINER_SIZE) / 2);
    const maxY = Math.max(0, (scaledH - CONTAINER_SIZE) / 2);
    return { maxX, maxY };
  };

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
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
      isDraggingRef.current = false;
      setIsDragging(false);
      setRawImageSrc(src);
      setIsPhotoModalOpen(true);
    };
    img.onerror = (e) => {
      console.error('[LOAD CROPPER ERROR] Gagal memuat foto profil:', e);
      onAddToast('Gagal memuat foto profil untuk diatur.');
    };
    img.src = src;
  };

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

  // Zoom control (1 to 4 with 0.01 step)
  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(4, Math.round(nextZoom * 100) / 100));
    setZoom(clampedZoom);
    zoomRef.current = clampedZoom;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    const { maxX, maxY } = computeMaxPan(clampedZoom, dims);
    setPosition((prev) => {
      const nextX = Math.max(-maxX, Math.min(maxX, prev.x));
      const nextY = Math.max(-maxY, Math.min(maxY, prev.y));
      positionRef.current = { x: nextX, y: nextY };
      return { x: nextX, y: nextY };
    });
  };

  // Pointer Events for drag with setPointerCapture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const rawX = dragStartRef.current.initialX + dx;
    const rawY = dragStartRef.current.initialY + dy;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    const { maxX, maxY } = computeMaxPan(zoomRef.current, dims);
    const clampedX = Math.max(-maxX, Math.min(maxX, rawX));
    const clampedY = Math.max(-maxY, Math.min(maxY, rawY));

    setPosition({ x: clampedX, y: clampedY });
    positionRef.current = { x: clampedX, y: clampedY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleZoomChange(zoomRef.current + delta);
  };

  const handleResetCrop = () => {
    setZoom(1);
    zoomRef.current = 1;
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Generate 1:1 High Quality Crop
  const handleGenerateCrop = async () => {
    if (!rawImageSrc) return;

    try {
      const activeImg = imgRef.current;
      const naturalW = activeImg?.naturalWidth || imageDimsRef.current?.width || CONTAINER_SIZE;
      const naturalH = activeImg?.naturalHeight || imageDimsRef.current?.height || CONTAINER_SIZE;

      if (naturalW <= 0 || naturalH <= 0) {
        throw new Error('Dimensi gambar tidak valid untuk crop');
      }

      const outputSize = 400;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context tidak tersedia');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const dims = imageDimsRef.current || {
        width: naturalW,
        height: naturalH,
        baseScale: Math.max(CONTAINER_SIZE / naturalW, CONTAINER_SIZE / naturalH),
      };

      const canvasScale = outputSize / CONTAINER_SIZE;
      const currentZoom = zoomRef.current;
      const currentX = positionRef.current.x;
      const currentY = positionRef.current.y;

      const displayedW = dims.width * dims.baseScale * currentZoom;
      const displayedH = dims.height * dims.baseScale * currentZoom;

      const centerX = CONTAINER_SIZE / 2 + currentX;
      const centerY = CONTAINER_SIZE / 2 + currentY;

      const drawX = (centerX - displayedW / 2) * canvasScale;
      const drawY = (centerY - displayedH / 2) * canvasScale;
      const drawW = displayedW * canvasScale;
      const drawH = displayedH * canvasScale;

      if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        ctx.drawImage(activeImg, 0, 0, naturalW, naturalH, drawX, drawY, drawW, drawH);
      }

      canvas.toBlob(
        async (blob) => {
          if (!blob || blob.size === 0) {
            onAddToast('Gagal memproses crop foto.');
            return;
          }

          const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
          await uploadCroppedProfile(croppedFile, blob);
        },
        'image/jpeg',
        0.95
      );
    } catch (err: any) {
      console.error('[CROP ERROR]', err);
      onAddToast('Gagal memproses crop foto.');
    }
  };

  const uploadCroppedProfile = async (file: File, blob: Blob) => {
    setIsSubmittingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file, 'profile.jpg');
      if (name && name.trim()) {
        formData.append('full_name', name.trim());
      }

      const res = await api.upload('/profile.php', formData);

      if (res && res.success) {
        onAddToast('Foto profil berhasil diperbarui!');
        const returnedUrl = res.data?.avatar_url || res.data?.avatar;
        const finalAvatar = returnedUrl ? `${returnedUrl}?v=${Date.now()}` : URL.createObjectURL(blob);

        setAvatarUrl(finalAvatar);
        setRawImageSrc(null);
        setIsPhotoModalOpen(false);

        if (onUpdateUser) {
          onUpdateUser({
            email,
            name,
            avatar_url: finalAvatar,
          });
        }

        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.avatar_url = finalAvatar;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }
      } else {
        onAddToast(res?.message || 'Gagal memperbarui foto profil.');
      }
    } catch (err: any) {
      onAddToast(err?.message || 'Gagal mengunggah foto profil.');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  // Remove Photo Action
  const handleRemovePhoto = async () => {
    if (!avatarUrl && !rawImageSrc) return;
    if (!window.confirm('Apakah Anda yakin ingin menghapus foto profil?')) return;

    setIsSubmittingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('full_name', name.trim());
      formData.append('remove_avatar', '1');

      const res = await api.upload('/profile.php', formData);
      if (res && res.success) {
        setAvatarUrl(null);
        setRawImageSrc(null);
        setIsPhotoModalOpen(false);
        onAddToast('Foto profil berhasil dihapus.');

        if (onUpdateUser) {
          onUpdateUser({
            email,
            name,
            avatar_url: undefined,
          });
        }

        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            delete parsed.avatar_url;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }
      } else {
        // Fallback local removal
        setAvatarUrl(null);
        setRawImageSrc(null);
        setIsPhotoModalOpen(false);
        onAddToast('Foto profil dihapus.');
      }
    } catch (_) {
      setAvatarUrl(null);
      setRawImageSrc(null);
      setIsPhotoModalOpen(false);
      onAddToast('Foto profil dihapus.');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  // Save All Profile Information (Name, Title, Location)
  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setActiveEditingField(null);

    try {
      const formData = new FormData();
      formData.append('full_name', name.trim());
      formData.append('role', role.trim());
      formData.append('location', location.trim());

      const res = await api.upload('/profile.php', formData);
      if (res && res.success) {
        onAddToast('Profil berhasil disimpan!');
        if (res.data?.full_name) setName(res.data.full_name);
        if (res.data?.role) setRole(res.data.role);

        if (onUpdateUser) {
          onUpdateUser({
            email,
            name: res.data?.full_name || name,
            avatar_url: avatarUrl || undefined,
          });
        }

        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.name = name.trim();
            if (avatarUrl) parsed.avatar_url = avatarUrl;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }
      } else {
        onAddToast(res?.message || 'Profil berhasil diperbarui!');
      }
    } catch (err: any) {
      console.error('[SAVE PROFILE ERROR]', err);
      onAddToast('Profil diperbarui di sesi ini.');
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";

  return (
    <div className="profile-edit-page">
      <div className="profile-edit-container">
        {/* Top Header Navigation */}
        <header className="profile-edit-header">
          <button
            type="button"
            className="profile-back-btn"
            onClick={() => onNavigate('dashboard')}
            aria-label="Kembali ke Dashboard"
            title="Kembali"
          >
            <Icon name="chevL" size={24} />
          </button>

          <button
            type="button"
            className="profile-save-btn"
            onClick={handleSaveProfile}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </header>

        {/* Page Title */}
        <h1 className="profile-edit-title">Edit Profile</h1>

        {/* Profile Photo Section */}
        <div className="profile-photo-section">
          <div className="profile-avatar-wrapper">
            <img
              src={avatarUrl || defaultAvatar}
              alt="Profile"
              className="profile-avatar-img"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <button
              type="button"
              className="profile-avatar-edit-badge"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              aria-label="Ubah foto profil"
              title="Ubah foto"
            >
              <Icon name="pencil" size={16} />
            </button>
          </div>

          <span
            className="profile-photo-label"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
          >
            PROFILE PHOTO
          </span>

          {avatarUrl && (
            <div className="profile-photo-actions">
              <button
                type="button"
                className="profile-remove-photo-btn"
                onClick={handleRemovePhoto}
              >
                Remove Photo
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Profile Information List */}
        <div className="profile-info-list">
          {/* Row 1: NAME */}
          <div
            className={`profile-info-row ${activeEditingField === 'name' ? 'is-editing' : ''}`}
            onClick={() => setActiveEditingField('name')}
          >
            <div className="profile-info-content">
              <span className="profile-row-label">NAME</span>
              {activeEditingField === 'name' ? (
                <input
                  type="text"
                  className="profile-inline-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setActiveEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setActiveEditingField(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className="profile-row-value">{name || 'Carrie Sanders'}</span>
              )}
            </div>
            <div className="profile-row-chevron">
              <Icon name="chevR" size={18} />
            </div>
          </div>

          {/* Row 2: EMAIL */}
          <div
            className="profile-info-row"
            onClick={() => onAddToast('Email dikelola secara otomatis oleh organisasi.')}
          >
            <div className="profile-info-content">
              <span className="profile-row-label">EMAIL</span>
              <span className="profile-row-value">{email}</span>
            </div>
            <div className="profile-row-chevron">
              <Icon name="chevR" size={18} />
            </div>
          </div>

          {/* Row 3: TITLE */}
          <div
            className={`profile-info-row ${activeEditingField === 'role' ? 'is-editing' : ''}`}
            onClick={() => setActiveEditingField('role')}
          >
            <div className="profile-info-content">
              <span className="profile-row-label">TITLE</span>
              {activeEditingField === 'role' ? (
                <input
                  type="text"
                  className="profile-inline-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  onBlur={() => setActiveEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setActiveEditingField(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className="profile-row-value">{role || 'Principal Product Designer'}</span>
              )}
            </div>
            <div className="profile-row-chevron">
              <Icon name="chevR" size={18} />
            </div>
          </div>

          {/* Row 4: LOCATION */}
          <div
            className={`profile-info-row ${activeEditingField === 'location' ? 'is-editing' : ''}`}
            onClick={() => setActiveEditingField('location')}
          >
            <div className="profile-info-content">
              <span className="profile-row-label">LOCATION</span>
              {activeEditingField === 'location' ? (
                <input
                  type="text"
                  className="profile-inline-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => setActiveEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setActiveEditingField(null);
                  }}
                  autoFocus
                />
              ) : (
                <span className={`profile-row-value ${!location ? 'is-placeholder' : ''}`}>
                  {location || 'Not set'}
                </span>
              )}
            </div>
            <div className="profile-row-chevron">
              <Icon name="chevR" size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Photo Cropper Modal */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={() => {
          setIsPhotoModalOpen(false);
          setRawImageSrc(null);
        }}
        title="Atur Crop Foto Profil"
      >
        {rawImageSrc ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '13.5px', color: 'var(--muted, #666)', marginBottom: '14px' }}>
              Geser foto dan atur zoom untuk menyesuaikan pratinjau lingkaran:
            </p>

            {(() => {
              const activeDims = imageDims || imageDimsRef.current || (imgRef.current?.naturalWidth ? {
                width: imgRef.current.naturalWidth,
                height: imgRef.current.naturalHeight,
                baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
              } : null);

              const baseWidth = activeDims ? activeDims.width * activeDims.baseScale : CONTAINER_SIZE;
              const baseHeight = activeDims ? activeDims.height * activeDims.baseScale : CONTAINER_SIZE;

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
                    border: '3px solid #111111',
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
                      left: '50%',
                      top: '50%',
                      width: `${baseWidth}px`,
                      height: `${baseHeight}px`,
                      transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0) scale(${zoom})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      pointerEvents: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                      willChange: 'transform',
                    }}
                  />
                </div>
              );
            })()}

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '18px' }}>
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
                max="4"
                step="0.01"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                style={{ width: '130px', accentColor: '#111111', cursor: 'pointer' }}
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

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setIsPhotoModalOpen(false);
                  setRawImageSrc(null);
                }}
                disabled={isSubmittingPhoto}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleGenerateCrop}
                disabled={isSubmittingPhoto}
              >
                {isSubmittingPhoto ? 'Menyimpan...' : 'Terapkan Crop'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
