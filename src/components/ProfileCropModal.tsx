import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ProfileCropModalProps {
  isOpen: boolean;
  currentAvatarUrl?: string | null;
  initialSrc?: string;
  profileId?: number | string;
  onClose: () => void;
  onSuccess?: (avatarUrl: string) => void;
  onSaved: (avatarUrl: string) => void;
  onError?: (message: string) => void;
}

const CROP_SETTING_API = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';

export const ProfileCropModal: React.FC<ProfileCropModalProps> = ({
  isOpen,
  currentAvatarUrl,
  initialSrc = '',
  onClose,
  onSuccess,
  onSaved,
  onError,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(50);
  const [panY, setPanY] = useState<number>(50);
  const [rotation, setRotation] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const activeInitial = (currentAvatarUrl || initialSrc || '').trim();
  const [imageSrc, setImageSrc] = useState<string>(activeInitial);
  const [origSrc, setOrigSrc] = useState<string>(activeInitial);
  const [imageError, setImageError] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

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

  const loadImage = useCallback((srcUrl: string) => {
    setImageError(false);
    setImageSrc(srcUrl);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.documentElement.style.overflow = '';
      return;
    }

    document.documentElement.style.overflow = 'hidden';

    setZoom(1);
    setPanX(50);
    setPanY(50);
    setRotation(0);
    setIsFlipped(false);
    setImageError(false);

    const activePhoto = (currentAvatarUrl || initialSrc || '').trim();
    if (activePhoto) {
      setImageSrc(activePhoto);
      setOrigSrc(activePhoto);
      loadImage(activePhoto);
    }
  }, [isOpen, currentAvatarUrl, initialSrc, loadImage]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const next = Math.max(1.0, Math.min(3.0, prev + delta));
      return parseFloat(next.toFixed(2));
    });
  };

  const handleReadFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      onError?.('File harus berupa gambar');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      onError?.('Ukuran foto maksimal 12 MB');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => onError?.('Gagal membaca file gambar');
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOrigSrc(reader.result);
        loadImage(reader.result);
        setZoom(1);
        setPanX(50);
        setPanY(50);
        setRotation(0);
        setIsFlipped(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const imgElement = imgRef.current;
    if (!imgElement || !imageSrc || imageError) {
      onError?.('Belum ada foto untuk disimpan');
      return;
    }

    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

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
      } catch (err) {
        console.warn('Fallback direct draw:', err);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onError?.('Gagal membuat kanvas gambar');
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
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

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          onError?.('Gagal memproses gambar');
          return;
        }

        setIsSaving(true);
        try {
          const fd = new FormData();
          fd.append('avatar', blob, `avatar_${Date.now()}.jpg`);
          fd.append('crop_zoom', zoom.toString());
          fd.append('crop_x', panX.toString());
          fd.append('crop_y', panY.toString());

          const res = await fetch(CROP_SETTING_API, {
            method: 'POST',
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: fd,
          });

          const json = await res.json();
          if (json.success && (json.data?.avatar_url || json.avatar_url)) {
            const returnedAvatar = json.data?.avatar_url || json.avatar_url;
            const cleanUrl = returnedAvatar.split('?')[0];
            const finalUrl = `${cleanUrl}?t=${Date.now()}`;

            const avatarImgs = document.querySelectorAll('#mainAvatarImg, .pimg img, .avatar img');
            avatarImgs.forEach((el) => {
              (el as HTMLImageElement).src = finalUrl;
              (el as HTMLImageElement).style.display = 'block';
            });

            onSuccess?.(finalUrl);
            onSaved(finalUrl);
            onClose();
          } else {
            onError?.(json.message || 'Gagal menyimpan foto.');
          }
        } catch (err) {
          onError?.('Terjadi gangguan koneksi saat menyimpan foto.');
        } finally {
          setIsSaving(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="pc-ov pc-show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-title"
    >
      <div className="pc-modal" tabIndex={-1}>
        <div className="pc-grab" />
        <div className="pc-head">
          <h2 id="pc-title">Edit Foto Profil</h2>
          <button type="button" className="pc-x" onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="pc-hint-t">
          Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
        </p>

        <div className="pc-main">
          <div
            className={`pc-stage ${isDragging ? 'pc-drag' : ''} ${isDragOver ? 'pc-over' : ''}`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e2e8f0',
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
            {imageSrc && !imageError ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Stage Foto"
                draggable={false}
                onError={() => {
                  console.warn('Gagal memuat URL avatar:', imageSrc);
                  if (!imageSrc) {
                    setImageError(true);
                  }
                }}
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
                P
              </div>
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

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
                  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.7)',
                  flexShrink: 0,
                }}
              >
                {imageSrc && !imageError ? (
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
                    P
                  </div>
                )}
              </div>
            ))}
            <small style={{ fontSize: '11px', color: '#7d7a8c', marginTop: '4px' }}>Pratinjau</small>
          </div>
        </div>

        <div className="pc-tools" style={{ justifyContent: 'center', marginBottom: '18px' }}>
          <button
            type="button"
            className="pc-tool"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
            </svg>
            Putar
          </button>
          <button
            type="button"
            className="pc-tool"
            onClick={() => setIsFlipped((f) => !f)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
            </svg>
            Balik
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Zoom</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={zoom <= 1.0}
              onClick={() => setZoom((z) => Math.max(1.0, parseFloat((z - 0.1).toFixed(2))))}
              aria-label="Perkecil"
            >
              -
            </button>
            <input
              className="pc-range"
              type="range"
              min="1.0"
              max="3.0"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              aria-label="Pengatur Zoom"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={zoom >= 3.0}
              onClick={() => setZoom((z) => Math.min(3.0, parseFloat((z + 0.1).toFixed(2))))}
              aria-label="Perbesar"
            >
              +
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoom * 100)}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Kiri–Kanan</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={panX <= 0}
              onClick={() => setPanX((p) => Math.max(0, p - 5))}
              aria-label="Geser kiri"
            >
              &lt;
            </button>
            <input
              className="pc-range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={panX}
              onChange={(e) => setPanX(parseFloat(e.target.value))}
              aria-label="Slider pan horizontal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={panX >= 100}
              onClick={() => setPanX((p) => Math.min(100, p + 5))}
              aria-label="Geser kanan"
            >
              &gt;
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panX)}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Atas–Bawah</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={panY <= 0}
              onClick={() => setPanY((p) => Math.max(0, p - 5))}
              aria-label="Geser atas"
            >
              ^
            </button>
            <input
              className="pc-range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={panY}
              onChange={(e) => setPanY(parseFloat(e.target.value))}
              aria-label="Slider pan vertikal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={panY >= 100}
              onClick={() => setPanY((p) => Math.min(100, p + 5))}
              aria-label="Geser bawah"
            >
              v
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panY)}%
            </output>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            className="pc-b soft pc-full"
            style={{ cursor: 'pointer', width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            📁 Pilih Foto Baru
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleReadFile(file);
                e.target.value = '';
              }
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              className="pc-b soft"
              onClick={() => {
                if (currentAvatarUrl && currentAvatarUrl.trim() !== '') {
                  setImageSrc(currentAvatarUrl);
                  setOrigSrc(currentAvatarUrl);
                } else {
                  loadImage(origSrc);
                }
                setZoom(1);
                setPanX(50);
                setPanY(50);
                setRotation(0);
                setIsFlipped(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className={`pc-b dark ${isSaving ? 'pc-load' : ''}`}
              onClick={handleSave}
              disabled={isSaving}
            >
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Foto'}</span>
              <i className="pc-spn" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
