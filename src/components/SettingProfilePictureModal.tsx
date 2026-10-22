import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface SettingProfilePictureModalProps {
  isOpen: boolean;
  initialSrc?: string | null;
  userName?: string;
  userEmail?: string;
  onClose: () => void;
  onSaved: (newAvatarUrl: string) => void;
  onError: (message: string) => void;
}

const STAGE_SIZE = 280; // Diameter lingkaran crop (px)
const OUTPUT_SIZE = 512; // Ukuran hasil simpan kanvas (px)
const CROP_API_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';

// Generator avatar inisial kanvas lokal aman tanpa isu CORS
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
  initialSrc,
  userName = 'Pengguna',
  onClose,
  onSaved,
  onError,
}) => {
  // State Sumber Gambar & Dimensi
  const [src, setSrc] = useState<string>('');
  const [origSrc, setOrigSrc] = useState<string>('');
  const [naturalW, setNaturalW] = useState<number>(0);
  const [naturalH, setNaturalH] = useState<number>(0);

  // Parameter Slider: Zoom 1.0 - 3.0, PanX 0 - 100 (default 50), PanY 0 - 100 (default 50)
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(50);
  const [panY, setPanY] = useState<number>(50);

  // Status Interaksi & Loading
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Refs
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridTimerRef = useRef<any>(null);

  // Dragging Tracker
  const dragRef = useRef<{
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

  // Skala dasar agar gambar menutupi penuh stage diameter 280px (cover fit)
  const baseScale = naturalW > 0 && naturalH > 0
    ? Math.max(STAGE_SIZE / naturalW, STAGE_SIZE / naturalH)
    : 1;

  // Efek kedip grid saat berinteraksi
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

  // Memuat sumber gambar dengan kondisional crossOrigin yang aman (bebas error CORS)
  const loadNewImageSrc = useCallback((srcUrl: string) => {
    if (!srcUrl) return;
    setIsLoading(true);

    const img = new Image();
    // Hanya pasang crossOrigin = 'anonymous' jika URL berasal dari protokol HTTP/HTTPS
    if (typeof srcUrl === 'string' && (srcUrl.startsWith('http://') || srcUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    } else {
      img.removeAttribute('crossOrigin');
    }

    img.onload = () => {
      const nw = img.naturalWidth || 480;
      const nh = img.naturalHeight || 480;
      setNaturalW(nw);
      setNaturalH(nh);
      setSrc(srcUrl);
      setIsLoading(false);
      flashGrid();
    };

    img.onerror = () => {
      setIsLoading(false);
      onError('Gagal memuat pratinjau foto');
    };

    img.src = srcUrl;
  }, [flashGrid, onError]);

  // Sinkronisasi data saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil/setting-profile-picture');
      }
    } catch (_) {}

    document.documentElement.style.overflow = 'hidden';

    // Reset slider ke posisi tengah
    setZoom(1.0);
    setPanX(50);
    setPanY(50);

    const fetchInitialAvatar = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      try {
        const res = await fetch(CROP_API_ENDPOINT, {
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

      // Fallback awal jika belum ada foto di server
      const fallback = initialSrc || createInitialsAvatar(userName[0] || 'P');
      setOrigSrc(fallback);
      loadNewImageSrc(fallback);
    };

    fetchInitialAvatar();

    return () => {
      document.documentElement.style.overflow = '';
      clearTimeout(gridTimerRef.current);
    };
  }, [isOpen, initialSrc, userName, loadNewImageSrc]);

  const handleClose = () => {
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
    onClose();
  };

  // Dragging Mouse / Touch pada stage crop secara dinamis
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const stage = e.currentTarget;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {}

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
      isDown: true,
    };
    setIsDragging(true);
    flashGrid();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDown) return;
    const { startX, startY, startPanX, startPanY } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Setiap 2px geser pointer = 1 persen slider
    const nextX = Math.min(100, Math.max(0, startPanX + dx / 2));
    const nextY = Math.min(100, Math.max(0, startPanY + dy / 2));
    setPanX(nextX);
    setPanY(nextY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    dragRef.current.isDown = false;
    setIsDragging(false);
  };

  // Zoom menggunakan mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3.0, Math.max(1.0, +(prev + delta).toFixed(2))));
    flashGrid();
  };

  // Pemutaran & Pembalikan Kanvas
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

  // Pemilih foto baru via FileReader: Data URL bebas CORS
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      onError('File harus berupa gambar');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      onError('Ukuran foto maksimal 12 MB');
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setIsLoading(false);
      onError('Gagal membaca file gambar');
    };
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setIsLoading(false);
        setOrigSrc(result);
        loadNewImageSrc(result);
        // Reset slider ke posisi tengah
        setZoom(1.0);
        setPanX(50);
        setPanY(50);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        setIsLoading(false);
        setOrigSrc(result);
        loadNewImageSrc(result);
        setZoom(1.0);
        setPanX(50);
        setPanY(50);
      }
    };
    reader.readAsDataURL(file);
  };

  // EKSEKUSI SIMPAN FOTO (512x512 Canvas Export & POST FormData)
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

      // Buat canvas 512x512
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsSaving(false);
        onError('Gagal menyiapkan kanvas gambar');
        return;
      }

      // Gambar latar putih bersih
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Hitung koordinat crop dan gambar ke canvas secara presisi:
      // Rasio skala dari stage (280px) ke canvas simpan (512px)
      const s = OUTPUT_SIZE / STAGE_SIZE;
      ctx.save();
      // Pusat kanvas (256, 256) ditambah pergeseran slider
      ctx.translate(
        OUTPUT_SIZE / 2 + (panX - 50) * 2 * s,
        OUTPUT_SIZE / 2 + (panY - 50) * 2 * s
      );
      ctx.scale(zoom * s * baseScale, zoom * s * baseScale);
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

            const res = await fetch(CROP_API_ENDPOINT, {
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

              // Update DOM avatar seketika agar tidak ada jeda visual
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
            onError('Gagal terhubung ke server backend.');
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

  // Rasio pratinjau lingkaran kecil (L: 72px, M: 44px, S: 28px)
  const ratioL = 72 / STAGE_SIZE;
  const ratioM = 44 / STAGE_SIZE;
  const ratioS = 28 / STAGE_SIZE;

  // Dimensi dasar render cover-fit
  const baseW = naturalW * baseScale;
  const baseH = naturalH * baseScale;

  // Transform dinamis real-time tanpa bounding kaku
  // translateX((panX - 50) * 2px) translateY((panY - 50) * 2px) scale(zoom)
  const shiftX = (panX - 50) * 2;
  const shiftY = (panY - 50) * 2;

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

        {/* Stage & 3 Lingkaran Pratinjau */}
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
            onDrop={handleDrop}
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
                  transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px)) scale(${zoom})`,
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

            {/* Spinner saat memuat foto */}
            {isLoading && (
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

          {/* 3 Lingkaran Pratinjau (L: 72px, M: 44px, S: 28px) */}
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
                    transform: `translate(calc(-50% + ${shiftX * ratioL}px), calc(-50% + ${shiftY * ratioL}px)) scale(${zoom})`,
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
                    transform: `translate(calc(-50% + ${shiftX * ratioM}px), calc(-50% + ${shiftY * ratioM}px)) scale(${zoom})`,
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
                    transform: `translate(calc(-50% + ${shiftX * ratioS}px), calc(-50% + ${shiftY * ratioS}px)) scale(${zoom})`,
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

        {/* Orientation Tools: Putar & Balik */}
        <div className="pc-tools" style={{ justifyContent: 'center', marginBottom: '16px' }}>
          <button
            type="button"
            className="pc-tool"
            onClick={() => handleBakeCanvas(true)}
            disabled={isLoading || isSaving}
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
            disabled={isLoading || isSaving}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
            </svg>
            Balik
          </button>
        </div>

        {/* Controls: Zoom, Kiri-Kanan, Atas-Bawah (Semua Unlocked & Bergerak Real-Time) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '18px' }}>
          {/* Zoom Control */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Zoom</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setZoom((prev) => Math.max(1.0, +(prev - 0.1).toFixed(2)));
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
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                setZoom(Number(e.target.value) / 100);
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
                setZoom((prev) => Math.min(3.0, +(prev + 0.1).toFixed(2)));
                flashGrid();
              }}
              aria-label="Perbesar"
            >
              +
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(zoom * 100)}%
            </output>
          </div>

          {/* Kiri-Kanan Control */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Kiri–Kanan</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanX((prev) => Math.max(0, prev - 5));
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
              value={Math.round(panX)}
              onChange={(e) => {
                setPanX(Number(e.target.value));
                flashGrid();
              }}
              aria-label="Slider pan horizontal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanX((prev) => Math.min(100, prev + 5));
                flashGrid();
              }}
              aria-label="Geser kanan"
            >
              &gt;
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panX)}%
            </output>
          </div>

          {/* Atas-Bawah Control */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 30px 1fr 30px 46px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Atas–Bawah</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanY((prev) => Math.max(0, prev - 5));
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
              value={Math.round(panY)}
              onChange={(e) => {
                setPanY(Number(e.target.value));
                flashGrid();
              }}
              aria-label="Slider pan vertikal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={isSaving}
              onClick={() => {
                setPanY((prev) => Math.min(100, prev + 5));
                flashGrid();
              }}
              aria-label="Geser bawah"
            >
              v
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(panY)}%
            </output>
          </div>
        </div>

        {/* Action Buttons: Pilih Foto Baru, Reset, Simpan Foto */}
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
            onChange={handleFileChange}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              className="pc-b soft"
              onClick={() => {
                if (origSrc) loadNewImageSrc(origSrc);
                setZoom(1.0);
                setPanX(50);
                setPanY(50);
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
              disabled={isSaving || isLoading}
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
