import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ProfileCropModalProps {
  isOpen: boolean;
  initialSrc?: string;
  profileId?: number | string;
  onClose: () => void;
  onSaved: (avatarUrl: string) => void;
  onError?: (message: string) => void;
}

const CROP_SETTING_API = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';
const STAGE_SIZE = 280; // Diameter lingkaran crop
const OUTPUT_SIZE = 512; // Ukuran hasil simpan kanvas

export const ProfileCropModal: React.FC<ProfileCropModalProps> = ({
  isOpen,
  initialSrc = '',
  onClose,
  onSaved,
  onError,
}) => {
  const [src, setSrc] = useState(initialSrc);
  const [origSrc, setOrigSrc] = useState(initialSrc);

  // Core Zoom & Pan percentage states
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panXPercentage, setPanXPercentage] = useState<number>(50);
  const [panYPercentage, setPanYPercentage] = useState<number>(50);

  // Natural image dimensions
  const [naturalW, setNaturalW] = useState<number>(480);
  const [naturalH, setNaturalH] = useState<number>(480);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  // Mathematical Bounding & Clamping calculation
  const baseScale = Math.max(STAGE_SIZE / (naturalW || 1), STAGE_SIZE / (naturalH || 1));
  const currentScale = baseScale * zoomLevel;
  const renderedW = naturalW * currentScale;
  const renderedH = naturalH * currentScale;

  const maxOffsetX = Math.max(0, (renderedW - STAGE_SIZE) / 2);
  const maxOffsetY = Math.max(0, (renderedH - STAGE_SIZE) / 2);

  const clampedX = maxOffsetX > 0 ? ((panXPercentage - 50) / 50) * maxOffsetX : 0;
  const clampedY = maxOffsetY > 0 ? ((panYPercentage - 50) / 50) * maxOffsetY : 0;

  const previewRatioL = 72 / STAGE_SIZE;
  const previewRatioM = 44 / STAGE_SIZE;
  const previewRatioS = 28 / STAGE_SIZE;

  const loadImage = useCallback((imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = img.naturalWidth || 480;
      const h = img.naturalHeight || 480;
      setNaturalW(w);
      setNaturalH(h);
      setSrc(imageUrl);
      setZoomLevel(1.0);
      setPanXPercentage(50);
      setPanYPercentage(50);
    };

    img.onerror = () => {
      setSrc(imageUrl);
    };

    img.src = imageUrl;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      document.documentElement.style.overflow = '';
      return;
    }

    document.documentElement.style.overflow = 'hidden';

    const fetchServerAvatar = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      try {
        const res = await fetch(CROP_SETTING_API, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        const fetchedAvatar = u?.avatar_url || u?.avatar || u?.file_url;

        if (fetchedAvatar && typeof fetchedAvatar === 'string') {
          const cleanUrl = fetchedAvatar.includes('?') ? fetchedAvatar.split('?')[0] : fetchedAvatar;
          const freshUrl = cleanUrl.startsWith('data:') ? cleanUrl : `${cleanUrl}?t=${Date.now()}`;

          try {
            const imgRes = await fetch(freshUrl, { mode: 'cors' });
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const blobUrl = URL.createObjectURL(blob);
              setOrigSrc(blobUrl);
              loadImage(blobUrl);
              return;
            }
          } catch (_) {}

          setOrigSrc(freshUrl);
          loadImage(freshUrl);
          return;
        }
      } catch (_) {}

      if (initialSrc) {
        setOrigSrc(initialSrc);
        loadImage(initialSrc);
      }
    };

    fetchServerAvatar();

    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, initialSrc, loadImage]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    setHasInteracted(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panXPercentage,
      startPanY: panYPercentage,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (maxOffsetX > 0) {
      const nextPanX = dragStartRef.current.startPanX + (dx / maxOffsetX) * 50;
      setPanXPercentage(Math.max(0, Math.min(100, Math.round(nextPanX))));
    }

    if (maxOffsetY > 0) {
      const nextPanY = dragStartRef.current.startPanY + (dy / maxOffsetY) * 50;
      setPanYPercentage(Math.max(0, Math.min(100, Math.round(nextPanY))));
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
    setHasInteracted(true);
    setZoomLevel((prev) => {
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const next = Math.max(1.0, Math.min(3.0, prev + delta));
      return Number(next.toFixed(2));
    });
  };

  const bakeCanvas = (isRotate: boolean) => {
    if (!imgRef.current || !naturalW || !naturalH) return;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return;

    c.width = isRotate ? naturalH : naturalW;
    c.height = isRotate ? naturalW : naturalH;
    g.translate(c.width / 2, c.height / 2);

    if (isRotate) {
      g.rotate(-Math.PI / 2);
    } else {
      g.scale(-1, 1);
    }

    g.drawImage(imgRef.current, -naturalW / 2, -naturalH / 2);
    const newUrl = c.toDataURL('image/jpeg', 0.95);
    setOrigSrc(newUrl);
    loadImage(newUrl);
    setHasInteracted(true);
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
        setHasInteracted(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const imgElement = imgRef.current;
      if (!imgElement || !naturalW || !naturalH) {
        onError?.('Belum ada foto untuk disimpan');
        setIsSaving(false);
        return;
      }

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = OUTPUT_SIZE;
      exportCanvas.height = OUTPUT_SIZE;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        onError?.('Gagal membuat kanvas gambar');
        setIsSaving(false);
        return;
      }

      const ratioToNatural = 1 / currentScale;
      const cropSizeOnNatural = STAGE_SIZE * ratioToNatural;

      const sourceX = (naturalW - cropSizeOnNatural) / 2 - (clampedX * ratioToNatural);
      const sourceY = (naturalH - cropSizeOnNatural) / 2 - (clampedY * ratioToNatural);

      const safeSourceX = Math.max(0, Math.min(naturalW - 1, sourceX));
      const safeSourceY = Math.max(0, Math.min(naturalH - 1, sourceY));
      const safeCropW = Math.max(1, Math.min(naturalW - safeSourceX, cropSizeOnNatural));
      const safeCropH = Math.max(1, Math.min(naturalH - safeSourceY, cropSizeOnNatural));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      ctx.drawImage(
        imgElement,
        safeSourceX,
        safeSourceY,
        safeCropW,
        safeCropH,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      exportCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsSaving(false);
            onError?.('Gagal memproses gambar');
            return;
          }

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

              onSaved(finalUrl);
              onClose();
            } else {
              onError?.(json.message || 'Gagal menyimpan foto.');
            }
          } catch (err: any) {
            onError?.('Terjadi gangguan koneksi saat menyimpan foto.');
          } finally {
            setIsSaving(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err: any) {
      onError?.('Terjadi kesalahan saat memproses gambar.');
      setIsSaving(false);
    }
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
            className={`pc-stage ${isDragging ? 'pc-drag' : ''} ${isDragOver ? 'pc-over' : ''} ${hasInteracted ? 'pc-touched' : ''}`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            style={{
              width: `${STAGE_SIZE}px`,
              height: `${STAGE_SIZE}px`,
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
            {src && (
              <img
                ref={imgRef}
                src={src}
                crossOrigin="anonymous"
                alt="Pratinjau Crop"
                draggable={false}
                style={{
                  width: `${renderedW}px`,
                  height: `${renderedH}px`,
                  transform: `translate(${(STAGE_SIZE - renderedW) / 2 + clampedX}px, ${(STAGE_SIZE - renderedH) / 2 + clampedY}px)`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

          <div className="pc-prevs" aria-hidden="true">
            <div className="pc-pv l" style={{ width: '72px', height: '72px', position: 'relative', overflow: 'hidden' }}>
              <img
                src={src}
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: `${renderedW * previewRatioL}px`,
                  height: `${renderedH * previewRatioL}px`,
                  transform: `translate(${((72 - renderedW * previewRatioL) / 2) + clampedX * previewRatioL}px, ${((72 - renderedH * previewRatioL) / 2) + clampedY * previewRatioL}px)`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                }}
              />
            </div>
            <div className="pc-pv m" style={{ width: '44px', height: '44px', position: 'relative', overflow: 'hidden' }}>
              <img
                src={src}
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: `${renderedW * previewRatioM}px`,
                  height: `${renderedH * previewRatioM}px`,
                  transform: `translate(${((44 - renderedW * previewRatioM) / 2) + clampedX * previewRatioM}px, ${((44 - renderedH * previewRatioM) / 2) + clampedY * previewRatioM}px)`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                }}
              />
            </div>
            <div className="pc-pv s" style={{ width: '28px', height: '28px', position: 'relative', overflow: 'hidden' }}>
              <img
                src={src}
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: `${renderedW * previewRatioS}px`,
                  height: `${renderedH * previewRatioS}px`,
                  transform: `translate(${((28 - renderedW * previewRatioS) / 2) + clampedX * previewRatioS}px, ${((28 - renderedH * previewRatioS) / 2) + clampedY * previewRatioS}px)`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                }}
              />
            </div>
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
              disabled={zoomLevel <= 1.0}
              onClick={() => {
                setHasInteracted(true);
                setZoomLevel((z) => Math.max(1.0, Number((z - 0.1).toFixed(2))));
              }}
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
              value={Math.round(zoomLevel * 100)}
              onChange={(e) => {
                setHasInteracted(true);
                setZoomLevel(Number(e.target.value) / 100);
              }}
              aria-label="Pengatur Zoom"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={zoomLevel >= 3.0}
              onClick={() => {
                setHasInteracted(true);
                setZoomLevel((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))));
              }}
              aria-label="Perbesar"
            >
              +
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoomLevel * 100)}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Kiri–Kanan</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={maxOffsetX <= 0 || panXPercentage <= 0}
              onClick={() => {
                setHasInteracted(true);
                setPanXPercentage((p) => Math.max(0, p - 5));
              }}
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
              disabled={maxOffsetX <= 0}
              value={panXPercentage}
              onChange={(e) => {
                setHasInteracted(true);
                setPanXPercentage(Number(e.target.value));
              }}
              aria-label="Slider pan horizontal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={maxOffsetX <= 0 || panXPercentage >= 100}
              onClick={() => {
                setHasInteracted(true);
                setPanXPercentage((p) => Math.min(100, p + 5));
              }}
              aria-label="Geser kanan"
            >
              &gt;
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {panXPercentage}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Atas–Bawah</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={maxOffsetY <= 0 || panYPercentage <= 0}
              onClick={() => {
                setHasInteracted(true);
                setPanYPercentage((p) => Math.max(0, p - 5));
              }}
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
              disabled={maxOffsetY <= 0}
              value={panYPercentage}
              onChange={(e) => {
                setHasInteracted(true);
                setPanYPercentage(Number(e.target.value));
              }}
              aria-label="Slider pan vertikal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={maxOffsetY <= 0 || panYPercentage >= 100}
              onClick={() => {
                setHasInteracted(true);
                setPanYPercentage((p) => Math.min(100, p + 5));
              }}
              aria-label="Geser bawah"
            >
              v
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {panYPercentage}%
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
                setZoomLevel(1.0);
                setPanXPercentage(50);
                setPanYPercentage(50);
                setHasInteracted(true);
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
