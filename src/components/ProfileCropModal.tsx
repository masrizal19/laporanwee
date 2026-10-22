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
  // Strategy: CSS Center-Based Positioning
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(50);
  const [panY, setPanY] = useState<number>(50);

  const [imageSrc, setImageSrc] = useState<string>(initialSrc);
  const [origSrc, setOrigSrc] = useState<string>(initialSrc);
  const [imageError, setImageError] = useState<boolean>(false);

  const [naturalW, setNaturalW] = useState<number>(480);
  const [naturalH, setNaturalH] = useState<number>(480);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const translateX = (panX - 50) * (zoom * 2.5);
  const translateY = (panY - 50) * (zoom * 2.5);

  const minDim = Math.min(naturalW || 280, naturalH || 280);
  const baseScale = 280 / (minDim || 280);
  const baseW = (naturalW || 280) * baseScale;
  const baseH = (naturalH || 280) * baseScale;

  const loadImage = useCallback((srcUrl: string) => {
    setImageError(false);
    setImageSrc(srcUrl);

    const testImg = new Image();
    testImg.crossOrigin = 'anonymous';
    testImg.onload = () => {
      setNaturalW(testImg.naturalWidth || 480);
      setNaturalH(testImg.naturalHeight || 480);
    };
    testImg.onerror = () => {
      setNaturalW(480);
      setNaturalH(480);
    };
    testImg.src = srcUrl;
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
    setImageError(false);

    // Utamakan foto profil aktif yang dikirim dari props
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

    const shiftFactor = zoom * 2.5;
    if (shiftFactor > 0) {
      const nextPanX = dragStartRef.current.startPanX + dx / shiftFactor;
      const nextPanY = dragStartRef.current.startPanY + dy / shiftFactor;
      setPanX(Math.max(0, Math.min(100, Math.round(nextPanX))));
      setPanY(Math.max(0, Math.min(100, Math.round(nextPanY))));
    }
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
      return Number(next.toFixed(2));
    });
  };

  const bakeCanvas = (isRotate: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth || naturalW || 480;
    const nh = img.naturalHeight || naturalH || 480;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return;

    c.width = isRotate ? nh : nw;
    c.height = isRotate ? nw : nh;
    g.translate(c.width / 2, c.height / 2);

    if (isRotate) {
      g.rotate(-Math.PI / 2);
    } else {
      g.scale(-1, 1);
    }

    g.drawImage(img, -nw / 2, -nh / 2);
    const newUrl = c.toDataURL('image/jpeg', 0.95);
    setOrigSrc(newUrl);
    loadImage(newUrl);
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

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 512;
    outCanvas.height = 512;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) {
      onError?.('Gagal membuat kanvas gambar');
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.translate(256 + translateX * (512 / 280), 256 + translateY * (512 / 280));
    ctx.scale(zoom * (512 / 280), zoom * (512 / 280));
    ctx.drawImage(imgElement, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();

    outCanvas.toBlob(
      async (blob) => {
        if (!blob) {
          onError?.('Gagal memproses gambar');
          return;
        }

        setIsSaving(true);
        try {
          const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
          const fd = new FormData();
          fd.append('avatar', blob, `avatar_${Date.now()}.jpg`);

          const res = await fetch(CROP_SETTING_API, {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
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
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '50%',
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
                crossOrigin="anonymous"
                alt="Pratinjau Crop"
                draggable={false}
                onError={() => {
                  console.warn('Gagal memuat URL avatar');
                  setImageError(true);
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${baseW}px`,
                  height: `${baseH}px`,
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none',
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
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '50%',
                }}
              >
                {imageSrc && !imageError ? (
                  <img
                    src={imageSrc}
                    crossOrigin="anonymous"
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: `${baseW}px`,
                      height: `${baseH}px`,
                      transform: `translate(calc(-50% + ${translateX * (size / 280)}px), calc(-50% + ${translateY * (size / 280)}px)) scale(${zoom * (size / 280)})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      userSelect: 'none',
                      pointerEvents: 'none',
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
            <small>Pratinjau</small>
          </div>
        </div>

        <div className="pc-tools" style={{ justifyContent: 'center', marginBottom: '18px' }}>
          <button type="button" className="pc-tool" onClick={() => bakeCanvas(true)}>
            <svg viewBox="0 0 24 24">
              <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
            </svg>
            Putar
          </button>
          <button type="button" className="pc-tool" onClick={() => bakeCanvas(false)}>
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
              onClick={() => setZoom((z) => Math.max(1.0, Number((z - 0.1).toFixed(2))))}
              aria-label="Perkecil"
            >
              -
            </button>
            <input
              className="pc-range"
              type="range"
              min="100"
              max="300"
              step="1"
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              aria-label="Pengatur Zoom"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={zoom >= 3.0}
              onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
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
              onChange={(e) => setPanX(Number(e.target.value))}
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
              {panX}%
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
              onChange={(e) => setPanY(Number(e.target.value))}
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
              {panY}%
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
                loadImage(origSrc);
                setZoom(1);
                setPanX(50);
                setPanY(50);
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
