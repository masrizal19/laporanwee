import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';
import {
  profileService,
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
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ w: number; h: number; base: number }>({ w: 0, h: 0, base: 1 });

  // Single unified crop state
  const [crop, setCrop] = useState<{ zoom: number; x: number; y: number }>({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Server crop preview result
  const [serverCropResult, setServerCropResult] = useState<{
    crop_url?: string;
    file_url?: string;
    file_name?: string;
    avatar_url?: string;
  } | null>(null);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Load existing profile and crop settings on mount with request sequence guard
  useEffect(() => {
    let isMounted = true;
    const requestInitiatedAt = Date.now();

    const initData = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.allSettled([
          profileService.getProfile(),
          profileService.getSettings(),
        ]);

        if (!isMounted) return;
        // Ignore stale GET responses if a save occurred after this request started
        if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

        let initialImg: string | null = null;
        let initialZoom = 1;
        let initialX = 0;
        let initialY = 0;

        if (profileRes.status === 'fulfilled' && profileRes.value?.success && profileRes.value?.data) {
          const d = profileRes.value.data;
          if (d.avatar_url) {
            initialImg = withAvatarCacheBust(d.avatar_url, d.updated_at || Date.now());
          }
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value?.success && settingsRes.value?.data) {
          const s = settingsRes.value.data;
          const z = Number(s.crop_zoom || s.zoom);
          const x = Number(s.crop_x || s.x);
          const y = Number(s.crop_y || s.y);
          if (!isNaN(z) && z >= 1) initialZoom = z;
          if (!isNaN(x)) initialX = x;
          if (!isNaN(y)) initialY = y;
        }

        if (initialImg && !rawImageSrc) {
          setRawImageSrc(initialImg);
          setCrop({ zoom: initialZoom, x: initialX, y: initialY });
        }
      } catch (e) {
        console.warn('[ProfileCropView] Initialization notice:', e);
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Clamping calculation based on exact Golden Reference formulas
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

  // Update zoom with coordinate clamping
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

      console.log('[CROP_DEBUG] ZOOM_CHANGE', {
        zoom: clampedZoom,
        x: clampedPos.x,
        y: clampedPos.y,
      });
    },
    [clampCoordinates]
  );

  // Initialize image on load
  const handleImageLoaded = useCallback(() => {
    const cropEl = cropAreaRef.current;
    const imgEl = imgRef.current;
    if (!cropEl || !imgEl) return;

    const nw = imgEl.naturalWidth || 400;
    const nh = imgEl.naturalHeight || 400;
    const cropSize = cropEl.clientWidth || 300;

    // baseScale formula: Math.max(cropSize / nw, cropSize / nh)
    const baseScale = Math.max(cropSize / nw, cropSize / nh);

    const newMeta = { w: nw, h: nh, base: baseScale };
    setImageMeta(newMeta);
    metaRef.current = newMeta;
    setIsImageLoaded(true);

    // Initial clamp
    const current = cropStateRef.current;
    const clamped = clampCoordinates(current.x, current.y, current.zoom, newMeta);
    setCrop((prev) => ({ ...prev, x: clamped.x, y: clamped.y }));

    console.log('[CROP_DEBUG] CROP_READY', {
      naturalWidth: nw,
      naturalHeight: nh,
      cropSize,
      baseScale,
    });
  }, [clampCoordinates]);

  // Pointer Events for single-touch / mouse drag with pointer capture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageLoaded) return;
    e.preventDefault();
    e.stopPropagation();

    const cropEl = cropAreaRef.current;
    if (cropEl) {
      try {
        cropEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    dragRef.current = {
      active: true,
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ix: cropStateRef.current.x,
      iy: cropStateRef.current.y,
    };
    setIsDragging(true);

    console.log('[CROP_DEBUG] POINTER_DOWN', {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.id !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;

    const clamped = clampCoordinates(drag.ix + dx, drag.iy + dy, cropStateRef.current.zoom);

    setCrop((prev) => ({
      ...prev,
      x: clamped.x,
      y: clamped.y,
    }));

    console.log('[CROP_DEBUG] POINTER_MOVE', {
      dx,
      dy,
      x: clamped.x,
      y: clamped.y,
    });
  };

  const handlePointerStop = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.id === e.pointerId || drag.active) {
      const cropEl = cropAreaRef.current;
      if (cropEl) {
        try {
          cropEl.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      dragRef.current = { active: false, id: null, sx: 0, sy: 0, ix: 0, iy: 0 };
      setIsDragging(false);

      console.log('[CROP_DEBUG] POINTER_UP', {
        pointerId: e.pointerId,
      });
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isImageLoaded) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    applyZoom(cropStateRef.current.zoom + delta);
  };

  // File selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (rawImageSrc && rawImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(rawImageSrc);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setRawImageSrc(objectUrl);
    setIsImageLoaded(false);
    setServerCropResult(null);
    setStatusMessage('');

    // Reset crop state on new image
    setCrop({ zoom: 1, x: 0, y: 0 });

    console.log('[CROP_DEBUG] FILE_SELECTED', {
      name: file.name,
      size: file.size,
      type: file.type,
    });
  };

  // Reset Crop to defaults
  const handleResetCrop = () => {
    setCrop({ zoom: 1, x: 0, y: 0 });
    setStatusMessage('Posisi crop direset ke posisi awal.');
  };

  // Process Server-Side Crop via /api/profile/crop.php
  const processServerCrop = async () => {
    if (!rawImageSrc && !selectedFile) {
      setStatusMessage('Pilih foto terlebih dahulu.');
      return;
    }

    setIsProcessingCrop(true);
    setStatusMessage('Mengirim koordinat crop ke server...');

    console.log('[CROP_DEBUG] CROP_REQUEST', {
      hasSelectedFile: !!selectedFile,
      zoom: crop.zoom,
      x: crop.x,
      y: crop.y,
    });

    try {
      const res = await profileService.cropPhoto({
        avatar: selectedFile || rawImageSrc || undefined,
        zoom: crop.zoom,
        x: crop.x,
        y: crop.y,
      });

      console.log('[CROP_DEBUG] CROP_RESPONSE', res);

      if (res && res.success && res.data) {
        setServerCropResult(res.data);
        setStatusMessage('Berhasil membuat preview crop dari server. Klik "Simpan Foto Profil" untuk menerapkan.');
        onAddToast('Preview crop server berhasil dibuat!');
      } else {
        setStatusMessage(res?.message || 'Gagal memproses crop di server.');
      }
    } catch (err: any) {
      console.error('[CROP_ERROR] processServerCrop:', err);
      setStatusMessage(err.message || 'Terjadi kesalahan saat memproses crop di server.');
      onAddToast('Gagal memproses crop: ' + (err.message || 'Kesalahan server'));
    } finally {
      setIsProcessingCrop(false);
    }
  };

  // Save Cropped Profile to MySQL via /api/profile/save.php (Instant, non-blocking flow)
  const saveCroppedProfile = async () => {
    if (isSavingCrop) return;
    setIsSavingCrop(true);
    setStatusMessage('Menyimpan foto profil ke database...');

    console.log('[CROP_DEBUG] SAVE_REQUEST', {
      zoom: crop.zoom,
      x: crop.x,
      y: crop.y,
      cropResult: serverCropResult,
    });

    try {
      // 1. Primary request: save profile to MySQL
      const saveRes = await profileService.saveProfile({
        full_name: userName,
        crop_file: serverCropResult?.file_name || selectedFile || undefined,
        crop_url: serverCropResult?.crop_url || serverCropResult?.file_url || undefined,
        zoom: crop.zoom,
        x: crop.x,
        y: crop.y,
      });

      console.log('[CROP_DEBUG] SAVE_RESPONSE', saveRes);

      // Record save timestamp for race condition prevention
      recordProfileSaveTimestamp();

      // Determine fresh avatar URL with cache busting
      const rawUrl = saveRes?.data?.avatar_url || serverCropResult?.crop_url || serverCropResult?.file_url || initialAvatarUrl;
      const freshAvatarUrl = withAvatarCacheBust(rawUrl, saveRes?.data?.updated_at || Date.now());

      // 2. Immediately sync global authenticated user state & cache
      syncAuthenticatedUser({
        name: saveRes?.data?.full_name || userName,
        email: userEmail,
        avatar_url: freshAvatarUrl,
        updated_at: saveRes?.data?.updated_at,
      });

      if (onUpdateUser) {
        onUpdateUser({
          name: saveRes?.data?.full_name || userName,
          email: userEmail,
          avatar_url: freshAvatarUrl,
        });
      }

      onAddToast('Foto profil berhasil diperbarui!');

      // 3. Immediately navigate back to profile (instant response, no artificial delay)
      onNavigate('profile');

      // 4. Background revalidation (non-blocking)
      (async () => {
        try {
          await profileService.saveSettings({
            crop_zoom: crop.zoom,
            crop_x: crop.x,
            crop_y: crop.y,
          });
        } catch (_) {}
      })();
    } catch (err: any) {
      console.error('[CROP_ERROR] saveCroppedProfile:', err);
      setStatusMessage(err.message || 'Gagal menyimpan foto profil.');
      onAddToast('Gagal menyimpan foto profil: ' + (err.message || 'Kesalahan server'));
      setIsSavingCrop(false);
    }
  };

  // Delete profile photo via /api/profile/delete.php
  const deleteProfilePhoto = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await profileService.deletePhoto();
      recordProfileSaveTimestamp();

      if (rawImageSrc && rawImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(rawImageSrc);
      }

      setSelectedFile(null);
      setRawImageSrc(null);
      setServerCropResult(null);
      setIsImageLoaded(false);

      // Immediately sync state to null avatar
      syncAuthenticatedUser({
        name: userName,
        email: userEmail,
        avatar_url: null,
      });

      if (onUpdateUser) {
        onUpdateUser({
          name: userName,
          email: userEmail,
          avatar_url: undefined,
        });
      }

      onAddToast('Foto profil berhasil dihapus.');
      onNavigate('profile');
    } catch (err: any) {
      onAddToast('Gagal menghapus foto: ' + (err.message || 'Kesalahan server'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="profile-page-root profile-crop-page-root">
      {/* Top Bar Header */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('profile')}
            aria-label="Kembali ke profil"
            title="Kembali ke Profil"
          >
            ←
          </button>
          <span className="profile-brand-title">Atur Crop Foto</span>
        </div>
        <div>
          <button
            type="button"
            className="profile-top-save-btn"
            onClick={() => onNavigate('profile')}
          >
            Selesai
          </button>
        </div>
      </header>

      {/* Main Full-Page Cropper Stage */}
      <main className="profile-shell-main" style={{ maxWidth: '680px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 className="profile-main-title" style={{ fontSize: '32px', margin: '0 0 8px' }}>
            Sesuaikan Posisi &amp; Zoom
          </h1>
          <p className="profile-crop-hint" style={{ fontSize: '14px', maxWidth: '520px', margin: '0 auto' }}>
            Geser foto di dalam lingkaran. Gunakan slider, tombol −/+, atau scroll mouse untuk memperbesar/memperkecil foto.
          </p>
        </div>

        {/* Circular Crop Area */}
        <div className="profile-crop-stage">
          <div
            id="crop"
            ref={cropAreaRef}
            className={`profile-crop-area ${isDragging ? 'is-dragging' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerStop}
            onPointerCancel={handlePointerStop}
            onWheel={handleWheel}
          >
            {rawImageSrc ? (
              <img
                ref={imgRef}
                id="img"
                className="profile-crop-image"
                src={rawImageSrc}
                alt="Crop Preview"
                draggable={false}
                onLoad={handleImageLoaded}
                style={{
                  width: `${imageMeta.w * imageMeta.base}px`,
                  height: `${imageMeta.h * imageMeta.base}px`,
                  transform: `translate3d(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px), 0) scale(${crop.zoom})`,
                }}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '100%',
                  color: '#888',
                  fontSize: '13px',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                Pilih foto untuk memulai crop
              </div>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="profile-zoom-bar">
          <button
            type="button"
            className="profile-zoom-step-btn"
            id="minus"
            onClick={() => applyZoom(crop.zoom - 0.1)}
            disabled={!isImageLoaded}
            aria-label="Zoom out"
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
            value={crop.zoom}
            disabled={!isImageLoaded}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            aria-label="Zoom slider"
          />
          <button
            type="button"
            className="profile-zoom-step-btn"
            id="plus"
            onClick={() => applyZoom(crop.zoom + 0.1)}
            disabled={!isImageLoaded}
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="profile-zoom-value-badge" id="zval">
            {Math.round(crop.zoom * 100)}%
          </div>
        </div>

        {/* Buttons Panel */}
        <div className="profile-modal-actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
          {rawImageSrc && (
            <button
              type="button"
              className="profile-action-btn is-danger"
              onClick={deleteProfilePhoto}
              disabled={isDeleting || isSavingCrop}
              style={{ marginRight: 'auto' }}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Foto'}
            </button>
          )}

          <button
            type="button"
            className="profile-action-btn"
            id="choose"
            onClick={() => fileInputRef.current?.click()}
          >
            {rawImageSrc ? 'Ganti Foto' : 'Pilih Foto'}
          </button>

          <button
            type="button"
            className="profile-action-btn"
            id="reset"
            onClick={handleResetCrop}
            disabled={!isImageLoaded}
          >
            Reset
          </button>

          <button
            type="button"
            className="profile-action-btn is-dark"
            id="process"
            onClick={processServerCrop}
            disabled={!rawImageSrc || isProcessingCrop || isSavingCrop}
          >
            {isProcessingCrop ? 'Memproses...' : 'Proses Crop'}
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div id="status" className="profile-status-message">
            {statusMessage}
          </div>
        )}

        {/* Server Crop Result Preview */}
        {serverCropResult && (
          <div id="result" className="profile-server-result-box" style={{ marginTop: '28px' }}>
            <strong style={{ fontSize: '15px' }}>Hasil Crop Server</strong>
            <img
              id="resultImg"
              className="profile-result-avatar-preview"
              src={withAvatarCacheBust(serverCropResult.crop_url || serverCropResult.file_url)}
              alt="Hasil Crop Server"
            />
            <div id="meta" className="profile-result-metadata">
              {`400 × 400 JPEG · zoom ${crop.zoom.toFixed(2)} · x ${crop.x.toFixed(2)} · y ${crop.y.toFixed(2)}`}
            </div>
            <div className="profile-modal-actions" style={{ justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="profile-action-btn is-dark"
                id="saveProfile"
                onClick={saveCroppedProfile}
                disabled={isSavingCrop}
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                {isSavingCrop ? 'Menyimpan...' : 'Simpan Foto Profil'}
              </button>
            </div>
          </div>
        )}

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
    </div>
  );
};
