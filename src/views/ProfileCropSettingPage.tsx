import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../profile-edit.css';
import { getStoredToken, getStoredUser, withAvatarCacheBust } from '../utils/api';

interface ProfileCropSettingPageProps {
  onBack?: () => void;
  onNavigate?: (view: any) => void;
  onAddToast?: (msg: string) => void;
}

const CROP_SETTING_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/profile/profile-crop-setting.php';
const FALLBACK_CROP_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';

// Canvas initials fallback generator
const createInitialsAvatar = (initialChar: string) => {
  if (typeof document === 'undefined') return '';
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
  g.fillStyle = 'rgba(255, 255, 255, 0.45)';
  g.beginPath();
  g.arc(360, 120, 140, 0, 7);
  g.fill();
  g.fillStyle = 'rgba(143, 127, 224, 0.35)';
  g.beginPath();
  g.arc(90, 420, 170, 0, 7);
  g.fill();
  g.fillStyle = '#2a2440';
  g.font = '600 190px Outfit, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((initialChar || 'P').toUpperCase(), 240, 262);
  return c.toDataURL('image/jpeg', 0.92);
};

export const ProfileCropSettingPage: React.FC<ProfileCropSettingPageProps> = ({
  onBack,
  onNavigate,
  onAddToast,
}) => {
  // 1. Authentication Token Verification (localStorage only, never exposed in URL query)
  const token =
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('laporanwee_token') ||
    getStoredToken() ||
    '';

  const storedUser = getStoredUser();
  const userName = storedUser?.full_name || storedUser?.name || 'Pengguna';

  // State: Zoom, Pan, Rotation, Flip
  const [zoom, setZoom] = useState<number>(1); // 1.0 to 3.0
  const [panX, setPanX] = useState<number>(50); // 0 to 100
  const [panY, setPanY] = useState<number>(50); // 0 to 100
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Image source state
  const initialLocalAvatar = storedUser?.avatar_url || '';
  const [imageSrc, setImageSrc] = useState<string>(() => initialLocalAvatar || createInitialsAvatar(userName[0] || 'P'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const STAGE_SIZE = 280;
  const offsetX = ((panX - 50) / 50) * 120;
  const offsetY = ((panY - 50) / 50) * 120;

  const getSharedTransform = (scaleMultiplier: number = 1) => {
    const scaleVal = zoom * scaleMultiplier;
    const tx = (offsetX * scaleMultiplier) / zoom;
    const ty = (offsetY * scaleMultiplier) / zoom;
    const rot = `rotate(${rotation}deg)`;
    const flip = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    return `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scaleVal}) ${rot} ${flip}`;
  };

  // Safe navigation helper
  const navigateTo = (pathOrView: string) => {
    if (pathOrView === '/profil' || pathOrView.startsWith('/profil')) {
      if (onBack) {
        onBack();
        return;
      }
      if (onNavigate) {
        onNavigate('profil');
        return;
      }
    }
    const clean = pathOrView.startsWith('/') ? pathOrView : `/${pathOrView}`;
    window.history.pushState({}, '', clean);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // 2. Initial Setup: Check token and fetch active avatar from backend
  useEffect(() => {
    if (!token) {
      console.warn('[ProfileCropSettingPage] No auth token found. Redirecting to /login');
      window.location.href = '/login';
      return;
    }

    // Ensure URL is cleanly set to /profil/crop-setting without query token
    if (window.location.search.includes('token=')) {
      window.history.replaceState({}, '', '/profil/crop-setting');
    }

    let isMounted = true;
    const fetchCurrentAvatar = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(CROP_SETTING_ENDPOINT, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            const avatarFound = json.data?.avatar_url || json.avatar_url || json.data?.user?.avatar_url;
            if (isMounted && avatarFound) {
              const fresh = withAvatarCacheBust(avatarFound);
              setImageSrc(fresh);
            }
          }
        } else {
          // Fallback to setting-profil-picture endpoint if crop-setting returned 404/html
          const fallbackRes = await fetch(FALLBACK_CROP_ENDPOINT, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            const avatarFound = fallbackJson.data?.avatar_url || fallbackJson.avatar_url;
            if (isMounted && avatarFound) {
              setImageSrc(withAvatarCacheBust(avatarFound));
            }
          }
        }
      } catch (err) {
        console.warn('[ProfileCropSettingPage] Error fetching avatar:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCurrentAvatar();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Pointer drag gestures on circular stage
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    setHasInteracted(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    const nextPanX = dragStartRef.current.startPanX + (dx / 120) * 50;
    const nextPanY = dragStartRef.current.startPanY + (dy / 120) * 50;
    setPanX(Math.max(0, Math.min(100, Math.round(nextPanX))));
    setPanY(Math.max(0, Math.min(100, Math.round(nextPanY))));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    dragStartRef.current = null;
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setHasInteracted(true);
    setZoom((prev) => {
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const next = Math.max(1.0, Math.min(3.0, prev + delta));
      return parseFloat(next.toFixed(2));
    });
  };

  // D-Pad pan handler
  const handleDpadNudge = (direction: 'up' | 'down' | 'left' | 'right' | 'center') => {
    setHasInteracted(true);
    const STEP = 8;
    switch (direction) {
      case 'up':
        setPanY((y) => Math.max(0, y - STEP));
        break;
      case 'down':
        setPanY((y) => Math.min(100, y + STEP));
        break;
      case 'left':
        setPanX((x) => Math.max(0, x - STEP));
        break;
      case 'right':
        setPanX((x) => Math.min(100, x + STEP));
        break;
      case 'center':
        setPanX(50);
        setPanY(50);
        break;
    }
  };

  // File input reader (drag-drop & file picker)
  const handleReadFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      onAddToast?.('File harus berupa gambar (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      onAddToast?.('Ukuran foto maksimal 12 MB');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => onAddToast?.('Gagal membaca file gambar');
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageSrc(reader.result);
        setZoom(1);
        setPanX(50);
        setPanY(50);
        setRotation(0);
        setIsFlipped(false);
        setHasInteracted(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset to original center & 1.0x
  const handleReset = () => {
    setZoom(1);
    setPanX(50);
    setPanY(50);
    setRotation(0);
    setIsFlipped(false);
  };

  // 3. Simpan Foto: Render to 512x512 Canvas, Blob JPEG, and upload with Authorization Bearer header
  const handleSave = async () => {
    const imgElement = imgRef.current;
    if (!imgElement || !imageSrc) {
      onAddToast?.('Belum ada foto untuk disimpan');
      return;
    }

    setIsSaving(true);

    try {
      // Avoid canvas tainting by converting remote HTTP/HTTPS images to same-origin Blob Data URL
      let drawSource: CanvasImageSource = imgElement;
      if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
        try {
          const resp = await fetch(imageSrc, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (resp.ok) {
            const imgBlob = await resp.blob();
            const blobDataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = reject;
              r.readAsDataURL(imgBlob);
            });
            const safeImg = new Image();
            await new Promise<void>((resolve, reject) => {
              safeImg.onload = () => resolve();
              safeImg.onerror = reject;
              safeImg.src = blobDataUrl;
            });
            drawSource = safeImg;
          }
        } catch (fetchErr) {
          console.warn('Fallback direct draw:', fetchErr);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onAddToast?.('Gagal memproses kanvas gambar');
        setIsSaving(false);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);

      ctx.save();
      // Center matrix (256, 256) + user pan offset
      ctx.translate(256 + (offsetX * (512 / STAGE_SIZE)), 256 + (offsetY * (512 / STAGE_SIZE)));
      ctx.scale(zoom, zoom);
      ctx.rotate((rotation * Math.PI) / 180);
      if (isFlipped) ctx.scale(-1, 1);

      const natW = (drawSource as HTMLImageElement).naturalWidth || imgElement.naturalWidth || 512;
      const natH = (drawSource as HTMLImageElement).naturalHeight || imgElement.naturalHeight || 512;
      const coverScale = Math.max(512 / natW, 512 / natH);
      const drawW = natW * coverScale;
      const drawH = natH * coverScale;

      ctx.drawImage(drawSource, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      if (!blob) {
        onAddToast?.('Gagal membuat blob gambar');
        setIsSaving(false);
        return;
      }

      const fd = new FormData();
      fd.append('avatar', blob, `avatar_${Date.now()}.jpg`);
      fd.append('file', blob, `avatar_${Date.now()}.jpg`);
      fd.append('crop_zoom', zoom.toString());
      fd.append('crop_x', panX.toString());
      fd.append('crop_y', panY.toString());

      // Attempt primary endpoint
      let success = false;
      let finalAvatarUrl = '';

      try {
        const res = await fetch(CROP_SETTING_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            if (json.success && (json.data?.avatar_url || json.avatar_url)) {
              success = true;
              finalAvatarUrl = json.data?.avatar_url || json.avatar_url;
            }
          }
        }
      } catch (err) {
        console.warn('Primary crop endpoint failed, trying fallback endpoint...', err);
      }

      // If primary didn't succeed, use setting-profil-picture endpoint
      if (!success) {
        const fallbackRes = await fetch(FALLBACK_CROP_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.success && (fallbackJson.data?.avatar_url || fallbackJson.avatar_url)) {
          success = true;
          finalAvatarUrl = fallbackJson.data?.avatar_url || fallbackJson.avatar_url;
        } else {
          onAddToast?.(fallbackJson.message || 'Gagal menyimpan foto profil');
          setIsSaving(false);
          return;
        }
      }

      if (success && finalAvatarUrl) {
        const cleanUrl = finalAvatarUrl.split('?')[0];
        const cacheBustedUrl = `${cleanUrl}?t=${Date.now()}`;

        // 1. Update localStorage user
        const stored = JSON.parse(
          localStorage.getItem('laporanwee_user') || localStorage.getItem('user') || '{}'
        );
        stored.avatar_url = cacheBustedUrl;
        localStorage.setItem('laporanwee_user', JSON.stringify(stored));
        localStorage.setItem('user', JSON.stringify(stored));

        // 2. Dispatch profile updated event
        window.dispatchEvent(
          new CustomEvent('laporanwee-profile-updated', {
            detail: {
              avatar_url: cacheBustedUrl,
            },
          })
        );

        onAddToast?.('Foto profil berhasil disimpan!');

        // 3. Return user to main profile with saved timestamp
        navigateTo(`/profil?saved=${Date.now()}`);
      } else {
        onAddToast?.('Gagal menyimpan foto profil');
      }
    } catch (saveErr) {
      console.error('[ProfileCropSettingPage] Save error:', saveErr);
      onAddToast?.('Terjadi kesalahan saat menyimpan foto');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: 'var(--bg2)',
        boxSizing: 'border-box',
      }}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleReadFile(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      <div
        className="pc-modal pc-show"
        style={{
          opacity: 1,
          transform: 'none',
          width: 'min(580px, 100%)',
          margin: 'auto',
          boxShadow: '0 24px 60px -20px rgba(35, 33, 46, 0.45)',
        }}
      >
        {/* Header & Close Button */}
        <div className="pc-head">
          <div>
            <h2 id="pc-title" style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Edit Foto Profil
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--pc-muted)', marginTop: '4px' }}>
              Atur posisi, perbesar, dan sesuaikan sudut foto Anda.
            </div>
          </div>
          <button
            type="button"
            className="pc-x"
            onClick={() => navigateTo('/profil')}
            aria-label="Tutup dan kembali ke profil"
            title="Kembali ke Profil"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Stage & 3 Circular Previews */}
        <div className="pc-main" style={{ marginTop: '20px' }}>
          {/* Main 280px Circular Stage */}
          <div
            className={`pc-stage ${isDragging ? 'pc-drag' : ''} ${isDragOver ? 'pc-over' : ''} ${
              hasInteracted ? 'pc-touched' : ''
            }`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            style={{
              width: `${STAGE_SIZE}px`,
              height: `${STAGE_SIZE}px`,
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e2e8f0',
              flexShrink: 0,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleReadFile(e.dataTransfer.files[0]);
              }
            }}
          >
            {imageSrc ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Stage Foto"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: getSharedTransform(1),
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #cfc6f4 0%, #e3ddfa 55%, #d4ee6b 100%)',
                  color: '#2a2440',
                  fontSize: '84px',
                  fontWeight: 700,
                }}
              >
                {(userName || 'P').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret foto untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

          {/* 3 Synchronous Previews (72px, 44px, 28px) */}
          <div className="pc-prevs" aria-hidden="true">
            {[72, 44, 28].map((size) => (
              <div
                key={size}
                className={`pc-pv ${size === 72 ? 'l' : size === 44 ? 'm' : 's'}`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e2e8f0',
                  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.75)',
                  flexShrink: 0,
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt="Pratinjau"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: getSharedTransform(size / STAGE_SIZE),
                      transformOrigin: 'center center',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #cfc6f4 0%, #e3ddfa 55%, #d4ee6b 100%)',
                      color: '#2a2440',
                      fontSize: `${Math.round(size * 0.4)}px`,
                      fontWeight: 700,
                    }}
                  >
                    {(userName || 'P').trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            <small style={{ fontSize: '11px', color: 'var(--pc-muted)', marginTop: '2px' }}>
              Pratinjau
            </small>
          </div>
        </div>

        {/* Orientation & Transform Tools: Rotate & Flip */}
        <div className="pc-tools" style={{ justifyContent: 'center', marginBottom: '18px' }}>
          <button
            type="button"
            className="pc-tool"
            onClick={() => {
              setHasInteracted(true);
              setRotation((r) => (r + 90) % 360);
            }}
            title="Putar 90 Derajat"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
            </svg>
            Putar 90°
          </button>
          <button
            type="button"
            className="pc-tool"
            onClick={() => {
              setHasInteracted(true);
              setIsFlipped((f) => !f);
            }}
            title="Balik Horizontal"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
            </svg>
            Balik
          </button>
          <button
            type="button"
            className="pc-tool"
            onClick={handleReset}
            title="Reset Posisi & Zoom"
          >
            <svg viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset
          </button>
        </div>

        {/* 2-Column Control Panels: Zoom & D-Pad Pan */}
        <div className="pc-panels">
          {/* Panel 1: Zoom Slider */}
          <div className="pc-panel">
            <h3>PENGATURAN ZOOM</h3>
            <div className="pc-zoom">
              <button
                type="button"
                className="pc-ico"
                disabled={zoom <= 1.0}
                onClick={() => {
                  setHasInteracted(true);
                  setZoom((z) => Math.max(1.0, parseFloat((z - 0.1).toFixed(2))));
                }}
                aria-label="Perkecil Zoom"
                title="Perkecil"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <input
                className="pc-range"
                type="range"
                min="1.0"
                max="3.0"
                step="0.01"
                value={zoom}
                onChange={(e) => {
                  setHasInteracted(true);
                  setZoom(parseFloat(e.target.value));
                }}
                aria-label="Pengatur Zoom"
              />
              <button
                type="button"
                className="pc-ico"
                disabled={zoom >= 3.0}
                onClick={() => {
                  setHasInteracted(true);
                  setZoom((z) => Math.min(3.0, parseFloat((z + 0.1).toFixed(2))));
                }}
                aria-label="Perbesar Zoom"
                title="Perbesar"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--pc-muted)', textAlign: 'center' }}>
              Gunakan slider atau scroll mouse pada foto
            </div>
          </div>

          {/* Panel 2: D-Pad Position Navigator */}
          <div className="pc-panel">
            <h3>NAVIGASI POSISI (D-PAD)</h3>
            <div className="pc-dpad">
              {/* Up */}
              <button
                type="button"
                className="pc-pad"
                data-d="up"
                onClick={() => handleDpadNudge('up')}
                aria-label="Geser ke atas"
                title="Geser Atas"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              {/* Left */}
              <button
                type="button"
                className="pc-pad"
                data-d="left"
                onClick={() => handleDpadNudge('left')}
                aria-label="Geser ke kiri"
                title="Geser Kiri"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              {/* Center */}
              <button
                type="button"
                className="pc-pad"
                data-d="center"
                onClick={() => handleDpadNudge('center')}
                aria-label="Pusatkan posisi"
                title="Pusatkan"
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
              </button>
              {/* Right */}
              <button
                type="button"
                className="pc-pad"
                data-d="right"
                onClick={() => handleDpadNudge('right')}
                aria-label="Geser ke kanan"
                title="Geser Kanan"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              {/* Down */}
              <button
                type="button"
                className="pc-pad"
                data-d="down"
                onClick={() => handleDpadNudge('down')}
                aria-label="Geser ke bawah"
                title="Geser Bawah"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            <div className="pc-read">
              X: <b>{Math.round(panX)}%</b> • Y: <b>{Math.round(panY)}%</b>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pc-actions">
          <button
            type="button"
            className="pc-b soft pc-full"
            onClick={() => fileInputRef.current?.click()}
            title="Unggah file foto baru dari perangkat"
          >
            <svg viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Pilih Foto Baru dari Perangkat
          </button>

          <button
            type="button"
            className="pc-b soft"
            onClick={() => navigateTo('/profil')}
            disabled={isSaving}
          >
            Batal
          </button>

          <button
            type="button"
            className={`pc-b dark ${isSaving ? 'pc-load' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            <span className="pc-spn" />
            <svg viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>Simpan Foto</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCropSettingPage;
