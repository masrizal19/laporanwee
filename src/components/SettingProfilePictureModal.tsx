import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SettingProfilePictureModalProps {
  isOpen: boolean;
  currentAvatarUrl?: string | null;
  initialSrc?: string | null;
  userName?: string;
  userEmail?: string;
  onClose: () => void;
  onSuccess?: (newAvatarUrl: string) => void;
  onSaved?: (newAvatarUrl: string) => void;
  onError?: (message: string) => void;
}

const CROP_API_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';

// Canvas initials avatar helper fallback
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
  g.font = '500 190px Outfit, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((initialChar || 'P').toUpperCase(), 240, 262);
  return c.toDataURL('image/jpeg', 0.92);
};

export const SettingProfilePictureModal: React.FC<SettingProfilePictureModalProps> = ({
  isOpen,
  currentAvatarUrl,
  initialSrc,
  userName = 'Pengguna',
  onClose,
  onSuccess,
  onSaved,
  onError,
}) => {
  // Strategy: CSS Center-Based Positioning & Auto-Centering
  const [zoom, setZoom] = useState<number>(1); // Range 1.0 to 3.0
  const [panX, setPanX] = useState<number>(50); // Range 0 to 100, default 50
  const [panY, setPanY] = useState<number>(50); // Range 0 to 100, default 50

  const activeInitial = (currentAvatarUrl || initialSrc || '').trim();
  const [imageSrc, setImageSrc] = useState<string>(() => activeInitial || createInitialsAvatar(userName[0] || 'P'));
  const [origSrc, setOrigSrc] = useState<string>(() => activeInitial || createInitialsAvatar(userName[0] || 'P'));
  const [imageError, setImageError] = useState<boolean>(false);

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  // Offset ranges from -120px to +120px
  const offsetX = ((panX - 50) / 50) * 120;
  const offsetY = ((panY - 50) / 50) * 120;

  // Safe image loader
  const loadImage = useCallback((srcUrl: string) => {
    setImageError(false);
    setImageSrc(srcUrl);
  }, []);

  // Sync state on modal open: Utamakan foto profil aktif dari props
  useEffect(() => {
    if (!isOpen) {
      document.documentElement.style.overflow = '';
      return;
    }

    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil/setting-profile-picture');
      }
    } catch (_) {}

    document.documentElement.style.overflow = 'hidden';

    // Reset controls to clean default
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
    } else {
      const fallback = createInitialsAvatar(userName[0] || 'P');
      setImageSrc(fallback);
      setOrigSrc(fallback);
      loadImage(fallback);
    }

    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, currentAvatarUrl, initialSrc, userName, loadImage]);

  const handleClose = () => {
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
    onClose();
  };

  // Dragging gesture on circle stage
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

  // Rotate & Flip image using in-memory canvas
  const bakeCanvas = (isRotate: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth || 480;
    const nh = img.naturalHeight || 480;
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

  // File Picker reader
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

  // Render & Save Cropped 512x512 Image (Center-based)
  const handleSave = async () => {
    const imgElement = imgRef.current;
    if (!imgElement || !imageSrc || imageError) {
      onError?.('Belum ada foto untuk disimpan');
      return;
    }

    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

    // If source is a remote HTTP URL, fetch it safely as a local Blob to avoid tainted canvas on toBlob()
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
    // Pindahkan titik pusat ke tengah canvas (256, 256)
    ctx.translate(256 + (offsetX * (512 / 280)), 256 + (offsetY * (512 / 280)));
    ctx.scale(zoom, zoom);

    // Gambar dengan fit cover ke tengah
    const naturalW = imgElement.naturalWidth || 512;
    const naturalH = imgElement.naturalHeight || 512;
    const hRatio = 512 / naturalW;
    const vRatio = 512 / naturalH;
    const coverRatio = Math.max(hRatio, vRatio);
    const drawW = naturalW * coverRatio;
    const drawH = naturalH * coverRatio;

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

          const res = await fetch(CROP_API_ENDPOINT, {
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

            // Direct DOM update for instant visual synchronization across all avatar containers
            const avatarImgs = document.querySelectorAll('#mainAvatarImg, .pimg img, .avatar img');
            avatarImgs.forEach((el) => {
              (el as HTMLImageElement).src = finalUrl;
              (el as HTMLImageElement).style.display = 'block';
            });

            onSuccess?.(finalUrl);
            onSaved?.(finalUrl);
            handleClose();
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
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-title"
    >
      <div className="pc-modal" tabIndex={-1}>
        <div className="pc-grab" />
        <div className="pc-head">
          <h2 id="pc-title">Edit Foto Profil</h2>
          <button type="button" className="pc-x" onClick={handleClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="pc-hint-t">
          Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
        </p>

        {/* Stage & 3 Circular Previews matching reference mockup */}
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
                alt="Pratinjau Crop"
                draggable={false}
                onError={() => {
                  console.warn('Gagal memuat URL avatar:', imageSrc);
                  if (!imageSrc) {
                    setImageError(true);
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${zoom}) translate(${offsetX / zoom}px, ${offsetY / zoom}px)`,
                  transformOrigin: 'center center',
                  transition: 'none',
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
                {(userName || 'P').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

          {/* 3 Lingkaran Pratinjau (72px, 44px, 28px) */}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  background: '#e2e8f0',
                }}
              >
                {imageSrc && !imageError ? (
                  <img
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: `scale(${zoom}) translate(${offsetX / zoom}px, ${offsetY / zoom}px)`,
                      transformOrigin: 'center center',
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
                    {(userName || 'P').trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            <small>Pratinjau</small>
          </div>
        </div>

        {/* Orientation Tools: Putar & Balik */}
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

        {/* Fine-Tuning Sliders: Zoom, Kiri-Kanan, Atas-Bawah */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* Zoom Row */}
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

          {/* Kiri-Kanan Row */}
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

          {/* Atas-Bawah Row */}
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

        {/* Bottom Actions with programmatic fileInputRef.current.click() */}
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
