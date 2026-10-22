import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ProfileCropModalProps {
  isOpen: boolean;
  initialSrc: string;
  profileId: number | string;
  onClose: () => void;
  onSaved: (avatarUrl: string) => void;
  onError: (message: string) => void;
}

const STAGE_SIZE = 280; // Diameter lingkaran crop
const OUTPUT_SIZE = 512; // Ukuran hasil simpan kanvas
const CROP_SETTING_API = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';

export const ProfileCropModal: React.FC<ProfileCropModalProps> = ({
  isOpen,
  initialSrc,
  onClose,
  onSaved,
  onError,
}) => {
  const [src, setSrc] = useState<string>('');
  const [origSrc, setOrigSrc] = useState<string>('');
  const [naturalW, setNaturalW] = useState<number>(0);
  const [naturalH, setNaturalH] = useState<number>(0);

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panXPercentage, setPanXPercentage] = useState<number>(50);
  const [panYPercentage, setPanYPercentage] = useState<number>(50);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridTimerRef = useRef<any>(null);

  const dragTrackerRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    isDown: boolean;
  }>({
    startX: 0,
    startY: 0,
    startPanX: 50,
    startPanY: 50,
    isDown: false,
  });

  const baseScale = naturalW > 0 && naturalH > 0
    ? Math.max(STAGE_SIZE / naturalW, STAGE_SIZE / naturalH)
    : 1;

  const flashGrid = useCallback(() => {
    setHasInteracted(true);
    if (stageRef.current) {
      stageRef.current.classList.add('pc-act');
      stageRef.current.classList.add('pc-touched');
      clearTimeout(gridTimerRef.current);
      gridTimerRef.current = setTimeout(() => {
        if (stageRef.current) stageRef.current.classList.remove('pc-act');
      }, 700);
    }
  }, []);

  // Memuat gambar dengan pengamanan CORS: jangan pasang crossOrigin pada data: atau blob:
  const loadNewImageSrc = useCallback((newUrl: string) => {
    if (!newUrl) return;
    setIsLoadingImage(true);
    const img = new Image();
    if (typeof newUrl === 'string' && (newUrl.startsWith('http://') || newUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    } else {
      img.removeAttribute('crossOrigin');
    }
    img.onload = () => {
      const nw = img.naturalWidth || 480;
      const nh = img.naturalHeight || 480;
      setNaturalW(nw);
      setNaturalH(nh);
      setSrc(newUrl);
      setIsLoadingImage(false);
      flashGrid();
    };
    img.onerror = () => {
      setIsLoadingImage(false);
      onError('Gagal memuat pratinjau foto');
    };
    img.src = newUrl;
  }, [flashGrid, onError]);

  useEffect(() => {
    if (!isOpen) return;

    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil/setting-profile-picture');
      }
    } catch (_) {}

    document.documentElement.style.overflow = 'hidden';

    setZoomLevel(1.0);
    setPanXPercentage(50);
    setPanYPercentage(50);

    const fetchInitial = async () => {
      setIsLoadingImage(true);
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      try {
        const res = await fetch(CROP_SETTING_API, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
        });
        const json = await res.json();
        const u = json.data || json.user || json;
        const fetchedUrl = u?.avatar_url || u?.avatar || u?.file_url;
        if (fetchedUrl && typeof fetchedUrl === 'string') {
          const cleanUrl = fetchedUrl.includes('?') ? fetchedUrl.split('?')[0] : fetchedUrl;
          const busted = `${cleanUrl}?t=${Date.now()}`;
          setOrigSrc(busted);
          loadNewImageSrc(busted);
          return;
        }
      } catch (_) {}

      if (initialSrc) {
        setOrigSrc(initialSrc);
        loadNewImageSrc(initialSrc);
      }
    };

    fetchInitial();

    return () => {
      document.documentElement.style.overflow = '';
      clearTimeout(gridTimerRef.current);
    };
  }, [isOpen, initialSrc, loadNewImageSrc]);

  const handleClose = () => {
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
    onClose();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const stage = e.currentTarget;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {}

    dragTrackerRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panXPercentage,
      startPanY: panYPercentage,
      isDown: true,
    };
    setIsDragging(true);
    flashGrid();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTrackerRef.current.isDown) return;
    const { startX, startY, startPanX, startPanY } = dragTrackerRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const nextX = Math.min(100, Math.max(0, startPanX + dx / 2));
    const nextY = Math.min(100, Math.max(0, startPanY + dy / 2));
    setPanXPercentage(nextX);
    setPanYPercentage(nextY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    dragTrackerRef.current.isDown = false;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel((prev) => Math.min(3.0, Math.max(1.0, +(prev + delta).toFixed(2))));
    flashGrid();
  };

  const handleBakeCanvas = (isRotate: boolean) => {
    const img = imgRef.current;
    if (!img || !naturalW || !naturalH) return;

    const c = document.createElement('canvas');
    c.width = isRotate ? naturalH : naturalW;
    c.height = isRotate ? naturalW : naturalH;
    const g = c.getContext('2d');
    if (!g) return;

    g.translate(c.width / 2, c.height / 2);
    if (isRotate) {
      g.rotate(-Math.PI / 2);
    } else {
      g.scale(-1, 1);
    }
    g.drawImage(img, -naturalW / 2, -naturalH / 2);

    const bakedUrl = c.toDataURL('image/jpeg', 0.95);
    setOrigSrc(bakedUrl);
    loadNewImageSrc(bakedUrl);
  };

  const handleReadFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      onError('File harus berupa gambar');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      onError('Ukuran foto maksimal 12 MB');
      return;
    }

    setIsLoadingImage(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setIsLoadingImage(false);
      onError('Gagal membaca file gambar');
    };
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setIsLoadingImage(false);
        setOrigSrc(result);
        loadNewImageSrc(result);
        setZoomLevel(1.0);
        setPanXPercentage(50);
        setPanYPercentage(50);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      let imgElement: HTMLImageElement | null = imgRef.current;

      if (!imgElement || !naturalW || !naturalH) {
        if (!src) {
          onError('Belum ada foto untuk disimpan');
          setIsSaving(false);
          return;
        }
        const tempImg = new Image();
        if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
          tempImg.crossOrigin = 'anonymous';
        } else {
          tempImg.removeAttribute('crossOrigin');
        }
        await new Promise<void>((resolve, reject) => {
          tempImg.onload = () => resolve();
          tempImg.onerror = () => reject(new Error('Gagal memuat elemen gambar'));
          tempImg.src = src;
        });
        imgElement = tempImg;
      }

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsSaving(false);
        onError('Gagal menyiapkan kanvas gambar');
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const s = OUTPUT_SIZE / STAGE_SIZE;
      ctx.save();
      ctx.translate(
        OUTPUT_SIZE / 2 + (panXPercentage - 50) * 2 * s,
        OUTPUT_SIZE / 2 + (panYPercentage - 50) * 2 * s
      );
      ctx.scale(zoomLevel * s * baseScale, zoomLevel * s * baseScale);
      ctx.drawImage(imgElement, -naturalW / 2, -naturalH / 2);
      ctx.restore();

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsSaving(false);
            onError('Gagal memproses gambar');
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
            if (json && (json.success || json.status === 'success')) {
              const rawAvatar =
                json.data?.avatar_url ||
                json.avatar_url ||
                json.avatar ||
                json.data?.file_url;
              const cleanUrl = rawAvatar ? rawAvatar.split('?')[0] : '';
              const finalUrl = cleanUrl
                ? (cleanUrl.startsWith('data:') ? cleanUrl : `${cleanUrl}?t=${Date.now()}`)
                : canvas.toDataURL('image/jpeg', 0.92);

              const mainAvatars = document.querySelectorAll('#mainAvatarImg, .pimg img, .avatar img');
              mainAvatars.forEach((el) => {
                (el as HTMLImageElement).src = finalUrl;
                (el as HTMLImageElement).style.display = 'block';
              });

              onSaved(finalUrl);
              handleClose();
            } else {
              onError(json?.message || 'Gagal menyimpan foto.');
            }
          } catch (err) {
            onError('Terjadi gangguan koneksi saat menyimpan foto.');
          } finally {
            setIsSaving(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err: any) {
      setIsSaving(false);
      onError('Terjadi kesalahan saat memproses gambar.');
    }
  };

  if (!isOpen) return null;

  const ratioL = 72 / STAGE_SIZE;
  const ratioM = 44 / STAGE_SIZE;
  const ratioS = 28 / STAGE_SIZE;

  const baseW = naturalW * baseScale;
  const baseH = naturalH * baseScale;
  const shiftX = (panXPercentage - 50) * 2;
  const shiftY = (panYPercentage - 50) * 2;
  const isHttpUrl = typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'));

  return createPortal(
    <div
      className="pc-ov pc-show"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-title"
    >
      <div className="pc-modal" tabIndex={-1}>
        <div className="pc-grab" />
        <div className="pc-head">
          <h2 id="pc-title">Edit Foto Profil</h2>
          <button
            type="button"
            className="pc-x"
            onClick={handleClose}
            aria-label="Tutup"
            disabled={isSaving}
          >
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
                alt="Pratinjau Crop"
                draggable={false}
                crossOrigin={isHttpUrl ? 'anonymous' : undefined}
                style={{
                  width: `${baseW}px`,
                  height: `${baseH}px`,
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px)) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>

            {isLoadingImage && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(30, 26, 50, 0.45)',
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 5,
                  backdropFilter: 'blur(3px)',
                }}
              >
                <div
                  className="pc-spn"
                  style={{
                    opacity: 1,
                    position: 'static',
                    width: 34,
                    height: 34,
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    borderTopColor: 'var(--pc-lime, #d4ee6b)',
                    animation: 'pc-spin 0.8s linear infinite',
                  }}
                />
              </div>
            )}
          </div>

          <div className="pc-prevs" aria-hidden="true">
            <div className="pc-pv l">
              {src && (
                <img
                  src={src}
                  alt=""
                  crossOrigin={isHttpUrl ? 'anonymous' : undefined}
                  style={{
                    width: `${baseW * ratioL}px`,
                    height: `${baseH * ratioL}px`,
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${shiftX * ratioL}px), calc(-50% + ${shiftY * ratioL}px)) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            <div className="pc-pv m">
              {src && (
                <img
                  src={src}
                  alt=""
                  crossOrigin={isHttpUrl ? 'anonymous' : undefined}
                  style={{
                    width: `${baseW * ratioM}px`,
                    height: `${baseH * ratioM}px`,
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${shiftX * ratioM}px), calc(-50% + ${shiftY * ratioM}px)) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            <div className="pc-pv s">
              {src && (
                <img
                  src={src}
                  alt=""
                  crossOrigin={isHttpUrl ? 'anonymous' : undefined}
                  style={{
                    width: `${baseW * ratioS}px`,
                    height: `${baseH * ratioS}px`,
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${shiftX * ratioS}px), calc(-50% + ${shiftY * ratioS}px)) scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            <small>Pratinjau</small>
          </div>
        </div>

        <div className="pc-tools" style={{ justifyContent: 'center', marginBottom: '16px' }}>
          <button
            type="button"
            className="pc-tool"
            onClick={() => handleBakeCanvas(true)}
            disabled={isLoadingImage || isSaving}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
            </svg>
            Putar
          </button>
          <button
            type="button"
            className="pc-tool"
            onClick={() => handleBakeCanvas(false)}
            disabled={isLoadingImage || isSaving}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
            </svg>
            Balik
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Zoom</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setZoomLevel((prev) => Math.max(1.0, +(prev - 0.1).toFixed(2)));
                flashGrid();
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
                setZoomLevel(Number(e.target.value) / 100);
                flashGrid();
              }}
              aria-label="Pengatur Zoom"
              disabled={isSaving}
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setZoomLevel((prev) => Math.min(3.0, +(prev + 0.1).toFixed(2)));
                flashGrid();
              }}
              aria-label="Perbesar"
            >
              +
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoomLevel * 100)}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Kiri–Kanan</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanXPercentage((prev) => Math.max(0, prev - 5));
                flashGrid();
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
              disabled={isSaving}
              value={Math.round(panXPercentage)}
              onChange={(e) => {
                setPanXPercentage(Number(e.target.value));
                flashGrid();
              }}
              aria-label="Slider pan horizontal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanXPercentage((prev) => Math.min(100, prev + 5));
                flashGrid();
              }}
              aria-label="Geser kanan"
            >
              &gt;
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panXPercentage)}%
            </output>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Atas–Bawah</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanYPercentage((prev) => Math.max(0, prev - 5));
                flashGrid();
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
              disabled={isSaving}
              value={Math.round(panYPercentage)}
              onChange={(e) => {
                setPanYPercentage(Number(e.target.value));
                flashGrid();
              }}
              aria-label="Slider pan vertikal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanYPercentage((prev) => Math.min(100, prev + 5));
                flashGrid();
              }}
              aria-label="Geser bawah"
            >
              v
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panYPercentage)}%
            </output>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="pc-b soft pc-full"
            style={{ cursor: 'pointer', width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              className="pc-b soft"
              onClick={() => {
                if (origSrc) loadNewImageSrc(origSrc);
                setZoomLevel(1.0);
                setPanXPercentage(50);
                setPanYPercentage(50);
                flashGrid();
              }}
              disabled={isSaving}
            >
              Reset
            </button>
            <button
              type="button"
              className={`pc-b dark ${isSaving ? 'pc-load' : ''}`}
              onClick={handleSave}
              disabled={isSaving || isLoadingImage}
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
