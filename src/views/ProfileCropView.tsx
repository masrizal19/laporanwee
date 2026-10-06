import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  withAvatarCacheBust,
  recordProfileSaveTimestamp,
  getLatestProfileSaveTimestamp,
  syncAuthenticatedUser,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileCropViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: { email: string; name: string; avatar_url?: string | null }) => void;
}

export const ProfileCropView: React.FC<ProfileCropViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(
    initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : null
  );
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ w: number; h: number; base: number }>({ w: 0, h: 0, base: 1 });

  // Single unified crop state
  const [crop, setCrop] = useState<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile metadata to preserve during save
  const [profileMeta, setProfileMeta] = useState<{
    full_name: string;
    profile_title: string;
    profile_location: string;
  }>({
    full_name: userName || userEmail?.split('@')[0] || '',
    profile_title: '',
    profile_location: '',
  });

  // Internal refs
  const dragRef = useRef<{
    active: boolean;
    id: number | null;
    sx: number;
    sy: number;
    ix: number;
    iy: number;
  }>({ active: false, id: null, sx: 0, sy: 0, ix: 0, iy: 0 });

  const cropStateRef = useRef<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0 });
  const metaRef = useRef<{ w: number; h: number; base: number }>({ w: 0, h: 0, base: 1 });
  const cropAreaRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    cropStateRef.current = crop;
  }, [crop]);

  useEffect(() => {
    metaRef.current = imageMeta;
  }, [imageMeta]);

  // Load existing profile on mount with request sequence guard
  useEffect(() => {
    let isMounted = true;
    const requestInitiatedAt = Date.now();

    const initData = async () => {
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

        if (res && res.success && res.data) {
          const d = res.data;
          const rawAvatar = extractAvatarFromResponse(res);
          if (rawAvatar && !rawImageSrc) {
            setRawImageSrc(withAvatarCacheBust(rawAvatar, d.updated_at || Date.now()));
          }

          setProfileMeta({
            full_name: d.full_name || d.name || userName,
            profile_title: d.profile_title || d.title || '',
            profile_location: d.profile_location || d.status || d.location || '',
          });
        }
      } catch (e) {
        console.warn('[ProfileCropView] Initialization notice:', e);
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, [userName]);

  // Clamping calculation
  const clampCoordinates = useCallback((x: number, y: number, z: number, meta?: { w: number; h: number; base: number }) => {
    const m = meta || metaRef.current;
    const cropEl = cropAreaRef.current;
    if (!cropEl || m.w === 0 || m.h === 0) {
      return { x, y };
    }

    const cropSize = cropEl.clientWidth || 300;
    const displayedWidth = m.w * m.base * z;
    const displayedHeight = m.h * m.base * z;

    const maxX = Math.max(0, (displayedWidth - cropSize) / 2);
    const maxY = Math.max(0, (displayedHeight - cropSize) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const applyZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(1, Math.min(4, parseFloat(newZoom.toFixed(2))));
      const current = cropStateRef.current;
      const clampedPos = clampCoordinates(current.x, current.y, clampedZoom);

      setCrop({
        zoom: clampedZoom,
        x: clampedPos.x,
        y: clampedPos.y,
      });
    },
    [clampCoordinates]
  );

  const handleImageLoaded = useCallback((imgEl: HTMLImageElement) => {
    const naturalWidth = imgEl.naturalWidth || 500;
    const naturalHeight = imgEl.naturalHeight || 500;
    const cropEl = cropAreaRef.current;
    const cropSize = cropEl ? cropEl.clientWidth : 300;

    const base = Math.max(cropSize / naturalWidth, cropSize / naturalHeight);
    const newMeta = { w: naturalWidth, h: naturalHeight, base };
    setImageMeta(newMeta);
    setIsImageLoaded(true);

    const clamped = clampCoordinates(0, 0, 1, newMeta);
    setCrop({ zoom: 1, x: clamped.x, y: clamped.y });
  }, [clampCoordinates]);

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onAddToast('Pilih file gambar yang valid.');
      return;
    }

    setSelectedFile(file);
    setIsImageLoaded(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const resStr = evt.target?.result as string;
      if (resStr) {
        setRawImageSrc(resStr);
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!rawImageSrc) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      active: true,
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ix: crop.x,
      iy: crop.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    e.preventDefault();

    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;

    const targetX = dragRef.current.ix + dx;
    const targetY = dragRef.current.iy + dy;

    const clamped = clampCoordinates(targetX, targetY, crop.zoom);
    setCrop((prev) => ({ ...prev, x: clamped.x, y: clamped.y }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setIsDragging(false);
    dragRef.current.active = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    applyZoom(crop.zoom + delta);
  };

  const handleReset = () => {
    const clamped = clampCoordinates(0, 0, 1);
    setCrop({ zoom: 1, x: clamped.x, y: clamped.y });
  };

  // Direct Save Foto (Combines crop + profile save in one go)
  const handleSaveCrop = async () => {
    if (!rawImageSrc) {
      onAddToast('Belum ada foto untuk disimpan.');
      return;
    }
    if (isSavingCrop) return;
    setIsSavingCrop(true);

    try {
      const savePayload: any = {
        full_name: profileMeta.full_name,
        profile_title: profileMeta.profile_title,
        profile_location: profileMeta.profile_location,
        zoom: crop.zoom,
        x: crop.x,
        y: crop.y,
      };

      if (selectedFile instanceof File) {
        savePayload.crop_file = selectedFile;
      } else if (rawImageSrc && !rawImageSrc.startsWith('data:image/svg+xml')) {
        savePayload.crop_url = rawImageSrc;
      }

      const res = await profileService.saveProfile(savePayload);
      recordProfileSaveTimestamp();

      if (res && res.success) {
        onAddToast('Foto profil berhasil disimpan.');
        const d = res.data || res;
        const rawAvatar = extractAvatarFromResponse(res);
        const freshAvatar = rawAvatar ? withAvatarCacheBust(rawAvatar, d.updated_at || Date.now()) : (d.avatar_url !== undefined ? d.avatar_url : null);

        syncAuthenticatedUser({
          avatar_url: freshAvatar,
          ...(d.full_name ? { name: d.full_name } : {}),
          ...(d.profile_title !== undefined ? { profile_title: d.profile_title } : {}),
          ...(d.profile_location !== undefined ? { profile_location: d.profile_location } : {}),
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: d.full_name || profileMeta.full_name,
            email: userEmail,
            avatar_url: freshAvatar,
          });
        }

        window.dispatchEvent(new CustomEvent('laporanwee-profile-updated', {
          detail: {
            avatar_url: freshAvatar,
            full_name: d.full_name || profileMeta.full_name,
            profile_title: d.profile_title,
            profile_location: d.profile_location,
          },
        }));

        onNavigate('profile');
      } else {
        const errorMsg = res?.message || 'Gagal menyimpan foto.';
        onAddToast(`Gagal menyimpan foto: ${errorMsg}`);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Kesalahan server';
      onAddToast(`Gagal menyimpan foto: ${errorMsg}`);
    } finally {
      setIsSavingCrop(false);
    }
  };

  // Delete Photo
  const handleDeletePhoto = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await profileService.deletePhoto();
      recordProfileSaveTimestamp();

      if (res && res.success) {
        onAddToast('Foto profil berhasil dihapus.');
        setRawImageSrc(null);
        setSelectedFile(null);

        syncAuthenticatedUser({
          avatar_url: null,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: profileMeta.full_name,
            email: userEmail,
            avatar_url: null,
          });
        }

        window.dispatchEvent(new CustomEvent('laporanwee-profile-updated', { detail: { avatar_url: null } }));
        onNavigate('profile');
      } else {
        const errorMsg = res?.message || 'Gagal menghapus foto.';
        onAddToast(`Gagal menghapus foto: ${errorMsg}`);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Kesalahan server';
      onAddToast(`Gagal menghapus foto: ${errorMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculation for image transform style
  const imageTransformStyle = {
    transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${crop.zoom})`,
    maxWidth: 'none',
    maxHeight: 'none',
    width: imageMeta.w > 0 ? `${imageMeta.w * imageMeta.base}px` : 'auto',
    height: imageMeta.h > 0 ? `${imageMeta.h * imageMeta.base}px` : 'auto',
  };

  return (
    <div className="profile-crop-page-root">
      {/* Header */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('profile')}
            aria-label="Kembali ke profile"
            title="Kembali ke Profile"
          >
            ←
          </button>
          <span className="profile-brand-title">Atur Crop Foto</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="profile-top-save-btn"
            style={{ background: '#dc2626' }}
            onClick={handleDeletePhoto}
            disabled={isDeleting}
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Foto'}
          </button>
          <button
            type="button"
            className="profile-top-save-btn"
            onClick={handleSaveCrop}
            disabled={isSavingCrop}
          >
            {isSavingCrop ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="profile-shell-main" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
        <h1 className="profile-main-title" style={{ fontSize: '22px', marginBottom: '8px' }}>Atur &amp; Potong Foto Profil</h1>
        <p className="profile-crop-hint" style={{ marginBottom: '24px' }}>
          Geser foto di dalam lingkaran, gunakan slider zoom atau scroll mouse untuk menyesuaikan ukuran.
        </p>

        {/* File Picker Option */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="profile-top-save-btn"
            style={{ background: 'var(--profile-surface, #2a2a2a)', color: 'var(--profile-text, #fff)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Pilih Foto Baru...
          </button>
        </div>

        {/* Cropper Stage Area (Single Preview) */}
        <div
          className="profile-crop-stage"
          ref={cropAreaRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={{
            position: 'relative',
            width: '300px',
            height: '300px',
            margin: '0 auto 20px auto',
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#111',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            border: '3px solid var(--profile-accent, #3b82f6)',
          }}
        >
          {rawImageSrc ? (
            <img
              ref={imgRef}
              src={rawImageSrc}
              alt="Crop Source"
              onLoad={(e) => handleImageLoaded(e.currentTarget)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                userSelect: 'none',
                pointerEvents: 'none',
                ...imageTransformStyle,
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              Belum ada foto
            </div>
          )}
        </div>

        {/* Zoom Controls Bar */}
        <div className="profile-zoom-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '30px' }}>
          <button
            type="button"
            onClick={() => applyZoom(crop.zoom - 0.2)}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#333', color: '#fff', border: 'none', fontSize: '18px', cursor: 'pointer' }}
          >
            -
          </button>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={crop.zoom}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            style={{ width: '200px', accentColor: 'var(--profile-accent, #3b82f6)' }}
          />
          <button
            type="button"
            onClick={() => applyZoom(crop.zoom + 0.2)}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#333', color: '#fff', border: 'none', fontSize: '18px', cursor: 'pointer' }}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{ padding: '8px 14px', borderRadius: '8px', background: '#333', color: '#fff', border: 'none', fontSize: '13px', cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>
      </main>
    </div>
  );
};
