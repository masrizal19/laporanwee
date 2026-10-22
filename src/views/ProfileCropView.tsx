import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  withAvatarCacheBust,
  getAbsoluteAvatarUrl,
  syncAuthenticatedUser,
  formatApiErrorMessage,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileCropViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: {
    email: string;
    name: string;
    avatar_url?: string | null;
    profile_title?: string;
    profile_location?: string;
  }) => void;
}

export const ProfileCropView: React.FC<ProfileCropViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // Single Crop State: { zoom, x, y }
  const [zoom, setZoom] = useState<number>(1);
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);

  // File / Source distinction
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(initialAvatarUrl || null);
  const [previewSrc, setPreviewSrc] = useState<string>(initialAvatarUrl ? getAbsoluteAvatarUrl(initialAvatarUrl, userName) : '');

  // Image Dimensions
  const [nw, setNw] = useState<number>(0);
  const [nh, setNh] = useState<number>(0);
  const [baseScale, setBaseScale] = useState<number>(1);

  // Loading States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Refs
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stateRef = useRef({
    x: 0,
    y: 0,
    zoom: 1,
    baseScale: 1,
    nw: 0,
    nh: 0,
    CS: 280,
    dragging: false,
    dragStart: { x: 0, y: 0, px: 0, py: 0 },
    ptrs: new Map<number, { x: number; y: number }>(),
  });

  const clamp = useCallback((val: number, min: number, max: number) => {
    if (isNaN(val)) return min;
    return Math.min(max, Math.max(min, val));
  }, []);

  const getBounds = useCallback(
    (
      curZoom = stateRef.current.zoom,
      curBase = stateRef.current.baseScale,
      curW = stateRef.current.nw,
      curH = stateRef.current.nh,
      curCS = stateRef.current.CS || 280
    ) => {
      const scaledW = curW * curBase * curZoom;
      const scaledH = curH * curBase * curZoom;
      const minX = Math.min(0, curCS - scaledW);
      const maxX = 0;
      const minY = Math.min(0, curCS - scaledH);
      const maxY = 0;
      return { minX, maxX, minY, maxY, scaledW, scaledH, curCS };
    },
    []
  );

  // Sync stateRef
  useEffect(() => {
    stateRef.current.zoom = zoom;
    stateRef.current.baseScale = baseScale;
    stateRef.current.nw = nw;
    stateRef.current.nh = nh;
    stateRef.current.x = x;
    stateRef.current.y = y;
  }, [zoom, baseScale, nw, nh, x, y]);

  // Load Image helper
  const loadImage = useCallback((srcUrl: string) => {
    setPreviewSrc(srcUrl);
    const img = new Image();
    if (typeof srcUrl === 'string' && (srcUrl.startsWith('http://') || srcUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    } else {
      img.removeAttribute('crossOrigin');
    }
    img.onload = () => {
      const w = img.naturalWidth || 480;
      const h = img.naturalHeight || 480;
      const stageEl = stageRef.current;
      const CS = stageEl?.clientWidth || 280;
      const b = CS / Math.min(w, h);
      const initX = (CS - w * b) / 2;
      const initY = (CS - h * b) / 2;

      setNw(w);
      setNh(h);
      setBaseScale(b);
      setZoom(1);
      setX(initX);
      setY(initY);

      stateRef.current.nw = w;
      stateRef.current.nh = h;
      stateRef.current.CS = CS;
      stateRef.current.baseScale = b;
      stateRef.current.zoom = 1;
      stateRef.current.x = initX;
      stateRef.current.y = initY;
    };
    img.src = srcUrl;
  }, []);

  // Fetch current avatar from backend on mount if not provided in props
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentPhoto = async () => {
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        const rawAvatar = extractAvatarFromResponse(res);
        if (rawAvatar) {
          setExistingAvatarUrl(rawAvatar);
          const fullUrl = getAbsoluteAvatarUrl(rawAvatar, userName);
          loadImage(fullUrl);
        } else if (initialAvatarUrl) {
          setExistingAvatarUrl(initialAvatarUrl);
          loadImage(getAbsoluteAvatarUrl(initialAvatarUrl, userName));
        }
      } catch (_) {
        if (initialAvatarUrl) {
          setExistingAvatarUrl(initialAvatarUrl);
          loadImage(getAbsoluteAvatarUrl(initialAvatarUrl, userName));
        }
      }
    };

    fetchCurrentPhoto();
    return () => {
      isMounted = false;
    };
  }, [initialAvatarUrl, userName, loadImage]);

  // Update zoom helper
  const updateZoom = useCallback(
    (newZoom: number) => {
      const nz = clamp(newZoom, 1, 3);
      const curZ = stateRef.current.zoom;
      const curB = stateRef.current.baseScale;
      const CS = stateRef.current.CS || 280;
      const curPx = stateRef.current.x;
      const curPy = stateRef.current.y;

      const centerImgX = (CS / 2 - curPx) / (curB * curZ);
      const centerImgY = (CS / 2 - curPy) / (curB * curZ);

      const targetPx = CS / 2 - centerImgX * curB * nz;
      const targetPy = CS / 2 - centerImgY * curB * nz;

      const bounds = getBounds(nz, curB, stateRef.current.nw, stateRef.current.nh, CS);
      const finalPx = clamp(targetPx, bounds.minX, bounds.maxX);
      const finalPy = clamp(targetPy, bounds.minY, bounds.maxY);

      stateRef.current.zoom = nz;
      stateRef.current.x = finalPx;
      stateRef.current.y = finalPy;

      setZoom(nz);
      setX(finalPx);
      setY(finalPy);
    },
    [clamp, getBounds]
  );

  // Pointer Drag Handlers
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const stage = e.currentTarget;
    stage.setPointerCapture(e.pointerId);
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 1) {
      stateRef.current.dragStart = {
        x: e.clientX,
        y: e.clientY,
        px: stateRef.current.x,
        py: stateRef.current.y,
      };
      stateRef.current.dragging = true;
      setIsDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stateRef.current.ptrs.has(e.pointerId)) return;
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 1 && stateRef.current.dragging) {
      const dx = e.clientX - stateRef.current.dragStart.x;
      const dy = e.clientY - stateRef.current.dragStart.y;
      const bounds = getBounds();

      const nextX = clamp(stateRef.current.dragStart.px + dx, bounds.minX, bounds.maxX);
      const nextY = clamp(stateRef.current.dragStart.py + dy, bounds.minY, bounds.maxY);

      stateRef.current.x = nextX;
      stateRef.current.y = nextY;
      setX(nextX);
      setY(nextY);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    stateRef.current.ptrs.delete(e.pointerId);
    stateRef.current.dragging = false;
    setIsDragging(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    updateZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  };

  // Select new file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar.');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // SIMPAN FOTO (cropPhoto -> saveProfile -> sync user)
  const handleSaveCrop = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      let cropRes: any = null;

      if (selectedFile instanceof File) {
        // Multipart file upload for newly selected local file
        cropRes = await profileService.cropPhoto({
          avatar: selectedFile,
          zoom,
          x,
          y,
        });
      } else if (existingAvatarUrl) {
        // Crop existing avatar string
        cropRes = await profileService.cropPhoto({
          avatar: existingAvatarUrl,
          avatar_url: existingAvatarUrl,
          zoom,
          x,
          y,
        });
      } else if (previewSrc) {
        // Fallback to previewSrc
        cropRes = await profileService.cropPhoto({
          avatar: previewSrc,
          zoom,
          x,
          y,
        });
      } else {
        onAddToast('Belum ada foto untuk disimpan.');
        setIsSaving(false);
        return;
      }

      const rawNewAvatar =
        cropRes?.data?.avatar_url ||
        cropRes?.avatar_url ||
        cropRes?.data?.url ||
        cropRes?.url ||
        cropRes?.data?.file_url;

      // Call saveProfile to commit avatar_url if returned
      let finalAvatarUrl = rawNewAvatar ? withAvatarCacheBust(rawNewAvatar) : null;
      if (rawNewAvatar) {
        const saveRes = await profileService.saveProfile({
          avatar_url: rawNewAvatar,
          zoom,
          x,
          y,
        });
        if (saveRes && (saveRes.data?.avatar_url || saveRes.avatar_url)) {
          const committed = saveRes.data?.avatar_url || saveRes.avatar_url;
          finalAvatarUrl = withAvatarCacheBust(committed);
        }
      }

      if (finalAvatarUrl || cropRes?.success) {
        syncAuthenticatedUser({
          avatar_url: finalAvatarUrl,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: userName,
            email: userEmail,
            avatar_url: finalAvatarUrl,
          });
        }

        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              avatar_url: finalAvatarUrl,
            },
          })
        );

        onAddToast('Foto profil berhasil disimpan.');
        onNavigate('profile');
      } else {
        onAddToast(cropRes?.message || 'Gagal menyimpan foto profil.');
      }
    } catch (err: any) {
      console.error('[ProfileCropView] Save crop error:', err);
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // HAPUS FOTO (deletePhoto -> avatar_url = null -> sync user)
  const handleDeletePhoto = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await profileService.deletePhoto();

      if (res && (res.success || res.status === 'success')) {
        setExistingAvatarUrl(null);
        setSelectedFile(null);
        setPreviewSrc('');

        syncAuthenticatedUser({
          avatar_url: null,
        });

        if (onUpdateUser) {
          onUpdateUser({
            name: userName,
            email: userEmail,
            avatar_url: null,
          });
        }

        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              avatar_url: null,
            },
          })
        );

        onAddToast('Foto profil berhasil dihapus.');
        onNavigate('profile');
      } else {
        onAddToast(res?.message || 'Gagal menghapus foto profil.');
      }
    } catch (err: any) {
      console.error('[ProfileCropView] Delete photo error:', err);
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="profile-crop-page-root">
      {/* Top Header */}
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
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Foto'}
          </button>
          <button
            type="button"
            className="profile-top-save-btn"
            onClick={handleSaveCrop}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </header>

      {/* Main Crop Workspace */}
      <main className="profile-shell-main" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px 48px' }}>
        <h1 className="profile-main-title" style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
          Edit &amp; Sesuaikan Foto Profil
        </h1>
        <p className="pc-hint-t" style={{ textAlign: 'center', marginBottom: '20px' }}>
          Seret foto untuk mengatur posisi, sesuaikan slider zoom, lalu klik Simpan Foto.
        </p>

        {/* Single Main Preview Stage */}
        <div className="pc-main" style={{ justifyContent: 'center', marginBottom: '20px' }}>
          <div
            className={`pc-stage ${isDragging ? 'pc-drag' : ''}`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {previewSrc ? (
              <img
                ref={imgRef}
                src={previewSrc}
                alt="Pratinjau Crop"
                draggable={false}
                style={{
                  width: nw ? `${nw}px` : 'auto',
                  height: nh ? `${nh}px` : 'auto',
                  transform: `translate(${x}px, ${y}px) scale(${baseScale * zoom})`,
                }}
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--pc-muted)' }}>
                Belum ada foto
              </div>
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px 48px', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <button
            type="button"
            className="pc-ico"
            disabled={zoom <= 1}
            onClick={() => updateZoom(zoom - 0.15)}
            aria-label="Perkecil zoom"
          >
            -
          </button>
          <input
            className="pc-range"
            type="range"
            min="100"
            max="300"
            value={Math.round(zoom * 100)}
            onChange={(e) => updateZoom(Number(e.target.value) / 100)}
            aria-label="Zoom slider"
          />
          <button
            type="button"
            className="pc-ico"
            disabled={zoom >= 3}
            onClick={() => updateZoom(zoom + 0.15)}
            aria-label="Perbesar zoom"
          >
            +
          </button>
          <output style={{ fontSize: '13px', color: 'var(--pc-muted)', textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </output>
        </div>

        {/* Actions Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            className="pc-b soft"
            style={{ cursor: 'pointer', fontSize: '13.5px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Pilih Foto Baru
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFileChange(e);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            className="pc-b soft"
            style={{ fontSize: '13.5px' }}
            onClick={() => {
              setZoom(1);
              if (previewSrc) {
                loadImage(previewSrc);
              }
            }}
          >
            Reset
          </button>

          <button
            type="button"
            className={`pc-b dark ${isSaving ? 'pc-load' : ''}`}
            style={{ fontSize: '13.5px' }}
            onClick={handleSaveCrop}
            disabled={isSaving || isDeleting}
          >
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Foto'}</span>
            <i className="pc-spn" />
          </button>
        </div>
      </main>
    </div>
  );
};
