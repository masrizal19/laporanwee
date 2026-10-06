import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { profileService, api } from '../utils/api';
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
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna');
  const [role, setRole] = useState('Profile User');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [location, setLocation] = useState('LaporanWee Web');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  // Modal and Cropper States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imgNaturalDims, setImgNaturalDims] = useState<{ w: number; h: number; base: number }>({ w: 0, h: 0, base: 1 });
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Server crop result
  const [serverCropResult, setServerCropResult] = useState<{
    crop_url?: string;
    file_url?: string;
    file_name?: string;
    avatar_url?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [isSavingCrop, setIsSavingCrop] = useState(false);

  const CROP_CONTAINER_SIZE = 300;

  const dragRef = useRef<{
    active: boolean;
    id: number | null;
    sx: number;
    sy: number;
    ix: number;
    iy: number;
  }>({ active: false, id: null, sx: 0, sy: 0, ix: 0, iy: 0 });

  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const dimsRef = useRef<{ w: number; h: number; base: number }>({ w: 0, h: 0, base: 1 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    dimsRef.current = imgNaturalDims;
  }, [imgNaturalDims]);

  useEffect(() => {
    setTempName(name);
  }, [name]);

  // Apply theme dynamically to CSS variables if provided
  const applyThemeSettings = useCallback((themeObj?: any) => {
    if (!themeObj || typeof themeObj !== 'object') return;
    const rootEl = rootRef.current || document.documentElement;

    if (themeObj.accent_color) rootEl.style.setProperty('--profile-accent', themeObj.accent_color);
    if (themeObj.primary_color) rootEl.style.setProperty('--profile-primary', themeObj.primary_color);
    if (themeObj.text_color) rootEl.style.setProperty('--profile-text', themeObj.text_color);
    if (themeObj.muted_color) rootEl.style.setProperty('--profile-muted', themeObj.muted_color);
    if (themeObj.background_color) rootEl.style.setProperty('--profile-bg', themeObj.background_color);
    if (themeObj.surface_color) rootEl.style.setProperty('--profile-surface', themeObj.surface_color);
  }, []);

  // Primary: Load Profile from /api/profile/get.php
  const loadProfile = useCallback(async (quiet = false) => {
    try {
      let res = await profileService.getProfile();
      if (!res || !res.success) {
        // Compatibility fallback
        res = await api.get('/profile.php');
      }

      if (res && res.success && res.data) {
        const d = res.data;
        if (d.full_name) setName(d.full_name);
        if (d.email) setEmail(d.email);
        if (d.role) setRole(d.role);
        if (d.location) setLocation(d.location);
        if (d.avatar_url) {
          const avatarBust = `${d.avatar_url}${d.avatar_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
          setAvatarUrl(avatarBust);
        } else if (d.avatar === null || d.avatar_url === null) {
          setAvatarUrl(null);
        }

        if (d.theme) {
          applyThemeSettings(d.theme);
        }

        // Apply crop settings if returned
        if (d.crop_settings) {
          const z = Number(d.crop_settings.crop_zoom || d.crop_settings.zoom);
          const x = Number(d.crop_settings.crop_x || d.crop_settings.x);
          const y = Number(d.crop_settings.crop_y || d.crop_settings.y);
          if (!isNaN(z) && z >= 1) {
            setZoom(z);
            zoomRef.current = z;
          }
          if (!isNaN(x) && !isNaN(y)) {
            setPosition({ x, y });
            positionRef.current = { x, y };
          }
        }
      }
    } catch (err: any) {
      if (!quiet) {
        console.warn('[PROFILE] loadProfile error:', err);
      }
    }
  }, [applyThemeSettings]);

  // Load Crop Settings from /api/profile/settings.php
  const loadProfileSettings = useCallback(async () => {
    try {
      const res = await profileService.getSettings();
      if (res && res.success && res.data) {
        const z = Number(res.data.crop_zoom || res.data.zoom);
        const x = Number(res.data.crop_x || res.data.x);
        const y = Number(res.data.crop_y || res.data.y);
        if (!isNaN(z) && z >= 1) {
          setZoom(z);
          zoomRef.current = z;
        }
        if (!isNaN(x) && !isNaN(y)) {
          setPosition({ x, y });
          positionRef.current = { x, y };
        }
        if (res.data.theme) {
          applyThemeSettings(res.data.theme);
        }
      }
    } catch (_) {}
  }, [applyThemeSettings]);

  // Initial fetch and automatic sync on focus/visibility change
  useEffect(() => {
    loadProfile();
    loadProfileSettings();

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        loadProfile(true);
        loadProfileSettings();
      }
    };

    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [loadProfile, loadProfileSettings]);

  // Cropper math
  const maxPan = (z = zoomRef.current) => {
    const size = CROP_CONTAINER_SIZE;
    const { w, h, base } = dimsRef.current;
    return {
      x: Math.max(0, (w * base * z - size) / 2),
      y: Math.max(0, (h * base * z - size) / 2),
    };
  };

  const clampPosition = (x: number, y: number, z = zoomRef.current) => {
    const m = maxPan(z);
    return {
      x: Math.max(-m.x, Math.min(m.x, x)),
      y: Math.max(-m.y, Math.min(m.y, y)),
    };
  };

  const applyZoom = (newZ: number) => {
    const clampedZ = Math.max(1, Math.min(4, Number(newZ) || 1));
    setZoom(clampedZ);
    zoomRef.current = clampedZ;
    const c = clampPosition(positionRef.current.x, positionRef.current.y, clampedZ);
    setPosition(c);
    positionRef.current = c;
  };

  // Load File into Cropper
  const loadSelectedFile = (f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      onAddToast('Format foto harus JPG, PNG, atau WEBP.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      onAddToast('Ukuran maksimal foto 10 MB.');
      return;
    }

    setSelectedFile(f);
    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc);
    }
    const objectUrl = URL.createObjectURL(f);
    setRawImageSrc(objectUrl);
    setServerCropResult(null);
    setStatusMessage('');

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const size = CROP_CONTAINER_SIZE;
      const base = Math.max(size / w, size / h);

      const nextDims = { w, h, base };
      setImgNaturalDims(nextDims);
      dimsRef.current = nextDims;
      setZoom(1);
      zoomRef.current = 1;
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
      setIsImageLoaded(true);
      setIsModalOpen(true);
    };
    img.onerror = () => {
      onAddToast('Gagal memuat file foto.');
    };
    img.src = objectUrl;
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      loadSelectedFile(f);
    }
    e.target.value = '';
  };

  // Pointer Drag Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageLoaded || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    dragRef.current = {
      active: true,
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ix: positionRef.current.x,
      iy: positionRef.current.y,
    };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.id) return;
    e.preventDefault();
    const c = clampPosition(
      dragRef.current.ix + e.clientX - dragRef.current.sx,
      dragRef.current.iy + e.clientY - dragRef.current.sy,
      zoomRef.current
    );
    setPosition(c);
    positionRef.current = c;
  };

  const stopDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.id !== e.pointerId) return;
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    applyZoom(zoomRef.current + (e.deltaY < 0 ? 0.1 : -0.1));
  };

  // Server Crop via POST /api/profile/crop.php
  const processServerCrop = async () => {
    if (!selectedFile) {
      onAddToast('Pilih foto terlebih dahulu.');
      return;
    }

    setIsProcessingCrop(true);
    setStatusMessage('Memproses crop di server...');

    try {
      // 1. Save crop settings to /api/profile/settings.php
      try {
        await profileService.saveSettings({
          crop_zoom: zoomRef.current,
          crop_x: positionRef.current.x,
          crop_y: positionRef.current.y,
        });
      } catch (_) {}

      // 2. Upload and crop via /api/profile/crop.php
      const cropRes = await profileService.cropPhoto({
        avatar: selectedFile,
        zoom: zoomRef.current,
        x: positionRef.current.x,
        y: positionRef.current.y,
      });

      if (cropRes && cropRes.success && cropRes.data) {
        setServerCropResult(cropRes.data);
        setStatusMessage('Crop server berhasil. Klik Simpan Profil untuk menulis data ke MySQL.');
        onAddToast('Crop server berhasil!');
      } else {
        throw new Error(cropRes?.message || 'Gagal memproses crop di server.');
      }
    } catch (err: any) {
      console.error('[CROP SERVER ERROR]', err);
      setStatusMessage(`Crop gagal: ${err.message || 'Terjadi kesalahan sistem'}`);
      onAddToast(err.message || 'Crop server gagal.');
    } finally {
      setIsProcessingCrop(false);
    }
  };

  // Save Cropped Profile via POST /api/profile/save.php
  const saveCroppedProfile = async () => {
    if (!serverCropResult) {
      onAddToast('Proses crop terlebih dahulu.');
      return;
    }

    setIsSavingCrop(true);
    setStatusMessage('Menyimpan profil ke MySQL...');

    try {
      const cropFileName = serverCropResult.file_name || '';
      const cropFileUrl = serverCropResult.crop_url || serverCropResult.file_url || '';

      const saveRes = await profileService.saveProfile({
        full_name: name.trim(),
        crop_file: cropFileName,
        crop_url: cropFileUrl,
        zoom: zoomRef.current,
        x: positionRef.current.x,
        y: positionRef.current.y,
      });

      if (saveRes && saveRes.success) {
        const returnedUrl = saveRes.data?.avatar_url || cropFileUrl;
        const bustUrl = returnedUrl ? `${returnedUrl}${returnedUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : null;

        if (bustUrl) setAvatarUrl(bustUrl);
        if (saveRes.data?.full_name) setName(saveRes.data.full_name);

        setStatusMessage('Profil, avatar, dan crop settings berhasil disimpan ke MySQL.');
        onAddToast('Profil dan foto berhasil disimpan!');
        setIsModalOpen(false);
        setRawImageSrc(null);
        setSelectedFile(null);
        setServerCropResult(null);

        if (onUpdateUser && bustUrl) {
          onUpdateUser({
            email,
            name,
            avatar_url: bustUrl,
          });
        }

        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (bustUrl) parsed.avatar_url = bustUrl;
            if (saveRes.data?.full_name) parsed.name = saveRes.data.full_name;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }

        await loadProfile(true);
      } else {
        throw new Error(saveRes?.message || 'Gagal menyimpan foto ke profil.');
      }
    } catch (err: any) {
      console.error('[SAVE PROFILE ERROR]', err);
      setStatusMessage(`Save gagal: ${err.message || 'Terjadi kesalahan sistem'}`);
      onAddToast(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSavingCrop(false);
    }
  };

  // Delete Photo via POST /api/profile/delete.php
  const deleteProfilePhoto = async () => {
    if (!avatarUrl && !rawImageSrc) return;

    try {
      const res = await profileService.deletePhoto();
      if (res && res.success) {
        setAvatarUrl(null);
        setRawImageSrc(null);
        setSelectedFile(null);
        setServerCropResult(null);
        setIsModalOpen(false);
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

        await loadProfile(true);
      } else {
        onAddToast(res?.message || 'Foto profil dihapus.');
        setAvatarUrl(null);
        setIsModalOpen(false);
      }
    } catch (err) {
      console.warn('[DELETE PHOTO ERROR]', err);
      setAvatarUrl(null);
      setIsModalOpen(false);
      onAddToast('Foto profil dihapus.');
    }
  };

  // Top Save Button Action
  const handleTopSave = async () => {
    if (isSaving) return;

    // If modal is open and has crop result ready, save it
    if (isModalOpen && serverCropResult) {
      await saveCroppedProfile();
      return;
    }

    setIsSaving(true);
    try {
      const res = await profileService.updateName(name.trim());
      if (res && res.success) {
        onAddToast('Perubahan profil berhasil disimpan!');
        if (res.data?.full_name) setName(res.data.full_name);

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

        await loadProfile(true);
      } else {
        onAddToast(res?.message || 'Profil berhasil disimpan.');
      }
    } catch (err: any) {
      console.error('[TOP SAVE ERROR]', err);
      onAddToast('Profil berhasil disimpan di sesi ini.');
    } finally {
      setIsSaving(false);
    }
  };

  const placeholderSvg =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="100%" height="100%" fill="#eee"/><circle cx="250" cy="200" r="90" fill="#ccc"/><path d="M110 470c25-110 95-155 140-155s115 45 140 155" fill="#ccc"/></svg>`
    );

  return (
    <div className="profile-page-root" ref={rootRef}>
      {/* Top Header Bar */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('dashboard')}
            aria-label="Kembali"
          >
            ‹
          </button>
          <div className="profile-brand-title">LaporanWee</div>
        </div>
        <button
          type="button"
          className="profile-top-save-btn"
          onClick={handleTopSave}
          disabled={isSaving || isSavingCrop}
        >
          {isSaving || isSavingCrop ? 'Saving...' : 'Save'}
        </button>
      </header>

      {/* Main Shell */}
      <main className="profile-shell-main">
        <h1 className="profile-main-title">Edit Profile</h1>

        {/* Hero Section */}
        <section className="profile-hero-section">
          <div className="profile-hero-copy">
            <div className="profile-hero-kicker">Profile Photo</div>
            <h2 id="displayName">{name || 'Pengguna'}</h2>
            <p>
              Versi web dari desain mobile. Foto dapat dipilih, digeser, di-zoom, di-crop di server, lalu disimpan ke
              database MySQL.
            </p>
          </div>

          <div className="profile-avatar-stage">
            <div className="profile-avatar-wrap-box">
              <img
                id="avatar"
                className="profile-avatar-element"
                src={avatarUrl || placeholderSvg}
                alt="Foto Profil"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              />
              <button
                type="button"
                id="editAvatar"
                className="profile-avatar-edit-button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Edit foto"
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="m14.5 7.5 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Rows Information List */}
        <section className="profile-rows-list">
          {/* Row 1: Name */}
          <div
            className={`profile-detail-row ${isEditingName ? 'is-active-edit' : 'is-clickable'}`}
            onClick={() => {
              if (!isEditingName) setIsEditingName(true);
            }}
          >
            <div className="profile-row-label-text">Name</div>
            {isEditingName ? (
              <input
                id="nameEdit"
                type="text"
                className="profile-name-edit-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  const trimmed = tempName.trim();
                  if (trimmed) {
                    setName(trimmed);
                  } else {
                    setTempName(name);
                  }
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTempName(name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="profile-row-value-text" id="name">
                {name || '—'}
              </div>
            )}
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 2: Email */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Email</div>
            <div className="profile-row-value-text is-muted" id="email">
              {email || '—'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 3: Title */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Title</div>
            <div className="profile-row-value-text is-muted" id="role">
              {role || 'Profile User'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>

          {/* Row 4: Location */}
          <div className="profile-detail-row">
            <div className="profile-row-label-text">Location</div>
            <div className="profile-row-value-text is-muted">
              {location || 'Not set'}
            </div>
            <div className="profile-row-arrow-icon">›</div>
          </div>
        </section>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          id="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </main>

      {/* Modal Cropper */}
      <div
        className={`profile-modal-backdrop ${isModalOpen ? 'is-open' : ''}`}
        id="modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsModalOpen(false);
          }
        }}
      >
        <div className="profile-modal-card" role="dialog" aria-modal="true">
          <div className="profile-modal-header">
            <h3>Atur Crop Foto</h3>
            <button
              type="button"
              className="profile-modal-close-btn"
              id="close"
              onClick={() => setIsModalOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="profile-modal-body">
            <p className="profile-crop-hint">
              Geser foto di dalam lingkaran. Gunakan slider, tombol −/+, atau scroll mouse untuk zoom.
            </p>

            <div className="profile-crop-stage">
              <div
                id="crop"
                className={`profile-crop-container ${isDragging ? 'is-dragging' : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onWheel={handleWheel}
              >
                {rawImageSrc && (
                  <img
                    ref={imgRef}
                    id="img"
                    className="profile-crop-img"
                    src={rawImageSrc}
                    alt="Crop Preview"
                    draggable={false}
                    style={{
                      width: `${imgNaturalDims.w * imgNaturalDims.base}px`,
                      height: `${imgNaturalDims.h * imgNaturalDims.base}px`,
                      transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0) scale(${zoom})`,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="profile-zoom-bar">
              <button
                type="button"
                className="profile-zoom-step-btn"
                id="minus"
                onClick={() => applyZoom(zoom - 0.1)}
              >
                −
              </button>
              <input
                id="slider"
                type="range"
                className="profile-zoom-slider"
                min="1"
                max="4"
                step="0.01"
                value={zoom}
                onChange={(e) => applyZoom(parseFloat(e.target.value))}
              />
              <button
                type="button"
                className="profile-zoom-step-btn"
                id="plus"
                onClick={() => applyZoom(zoom + 0.1)}
              >
                +
              </button>
              <div className="profile-zoom-value-badge" id="zval">
                {Math.round(zoom * 100)}%
              </div>
            </div>

            <div className="profile-modal-actions">
              {avatarUrl && (
                <button
                  type="button"
                  className="profile-action-btn is-danger"
                  onClick={deleteProfilePhoto}
                  style={{ marginRight: 'auto' }}
                >
                  Hapus Foto
                </button>
              )}
              <button
                type="button"
                className="profile-action-btn"
                id="choose"
                onClick={() => fileInputRef.current?.click()}
              >
                Pilih Foto
              </button>
              <button
                type="button"
                className="profile-action-btn"
                id="reset"
                onClick={() => {
                  setZoom(1);
                  zoomRef.current = 1;
                  setPosition({ x: 0, y: 0 });
                  positionRef.current = { x: 0, y: 0 };
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="profile-action-btn is-dark"
                id="process"
                onClick={processServerCrop}
                disabled={isProcessingCrop}
              >
                {isProcessingCrop ? 'Memproses...' : 'Proses Crop'}
              </button>
            </div>

            {statusMessage && (
              <div id="status" className="profile-status-message">
                {statusMessage}
              </div>
            )}

            {serverCropResult && (
              <div id="result" className="profile-server-result-box">
                <strong>Hasil Crop Server</strong>
                <img
                  id="resultImg"
                  className="profile-result-avatar-preview"
                  src={`${serverCropResult.crop_url || serverCropResult.file_url}?v=${Date.now()}`}
                  alt="Hasil Crop"
                />
                <div id="meta" className="profile-result-metadata">
                  {`400 × 400 JPEG · zoom ${zoom.toFixed(2)} · x ${position.x.toFixed(2)} · y ${position.y.toFixed(2)}`}
                </div>
                <div className="profile-modal-actions" style={{ justifyContent: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="profile-action-btn is-dark"
                    id="saveProfile"
                    onClick={saveCroppedProfile}
                    disabled={isSavingCrop}
                  >
                    {isSavingCrop ? 'Menyimpan...' : 'Simpan Profil'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
