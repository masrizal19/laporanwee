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

const CROP_API_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';
const MAX_DIMENSION = 2048;
const STEP_PIXELS = 34;
const HOLD_SPEED = 3.4;

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
  initialSrc,
  userName = 'Pengguna',
  userEmail = '',
  onClose,
  onSaved,
  onError,
}) => {
  const defaultFallback = initialSrc || createInitialsAvatar(userName[0] || 'P');
  const [src, setSrc] = useState<string>(defaultFallback);
  const [origSrc, setOrigSrc] = useState<string>(defaultFallback);
  const [zoom, setZoom] = useState<number>(1);
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0);
  const [nw, setNw] = useState<number>(0);
  const [nh, setNh] = useState<number>(0);
  const [base, setBase] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewLRef = useRef<HTMLImageElement>(null);
  const previewMRef = useRef<HTMLImageElement>(null);
  const previewSRRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stateRef = useRef({
    px: 0,
    py: 0,
    z: 1,
    base: 1,
    nw: 0,
    nh: 0,
    CS: 280,
    dragging: false,
    dragStart: { x: 0, y: 0, px: 0, py: 0 },
    hold: null as { x: number; y: number } | null,
    raf: 0,
    pinch: null as { d: number; z: number } | null,
    ptrs: new Map<number, { x: number; y: number }>(),
  });

  const smoothTimerRef = useRef<any>(null);
  const gridTimerRef = useRef<any>(null);

  const clamp = useCallback((val: number, min: number, max: number) => {
    if (isNaN(val)) return min;
    return Math.min(max, Math.max(min, val));
  }, []);

  const getBounds = useCallback(
    (
      curZ = stateRef.current.z,
      curB = stateRef.current.base,
      curW = stateRef.current.nw,
      curH = stateRef.current.nh,
      curCS = stateRef.current.CS || 280
    ) => {
      const scaledW = curW * curB * curZ;
      const scaledH = curH * curB * curZ;
      const minX = Math.min(0, curCS - scaledW);
      const maxX = 0;
      const minY = Math.min(0, curCS - scaledH);
      const maxY = 0;
      return { minX, maxX, minY, maxY, scaledW, scaledH, curCS };
    },
    []
  );

  useEffect(() => {
    stateRef.current.z = zoom;
    stateRef.current.base = base;
    stateRef.current.nw = nw;
    stateRef.current.nh = nh;
    stateRef.current.px = posX;
    stateRef.current.py = posY;
  }, [zoom, base, nw, nh, posX, posY]);

  const flashGrid = useCallback(() => {
    setHasInteracted(true);
    if (stageRef.current) {
      stageRef.current.classList.add('pc-act');
      stageRef.current.classList.add('pc-touched');
      clearTimeout(gridTimerRef.current);
      gridTimerRef.current = setTimeout(() => {
        if (stageRef.current) stageRef.current.classList.remove('pc-act');
      }, 900);
    }
  }, []);

  const triggerSmooth = useCallback(() => {
    if (stageRef.current) {
      stageRef.current.classList.add('pc-smooth');
      clearTimeout(smoothTimerRef.current);
      smoothTimerRef.current = setTimeout(() => {
        if (stageRef.current) stageRef.current.classList.remove('pc-smooth');
      }, 340);
    }
  }, []);

  const applyTransforms = useCallback(
    (x: number, y: number, z: number, b = base) => {
      const s = b * z;
      const CS = stateRef.current.CS || 280;

      if (imgRef.current) {
        imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      }
      if (previewLRef.current) {
        const rL = 72 / CS;
        previewLRef.current.style.transform = `translate(${x * rL}px, ${y * rL}px) scale(${s * rL})`;
      }
      if (previewMRef.current) {
        const rM = 44 / CS;
        previewMRef.current.style.transform = `translate(${x * rM}px, ${y * rM}px) scale(${s * rM})`;
      }
      if (previewSRRef.current) {
        const rS = 28 / CS;
        previewSRRef.current.style.transform = `translate(${x * rS}px, ${y * rS}px) scale(${s * rS})`;
      }
    },
    [base]
  );

  const updateZoom = useCallback(
    (newZ: number, withAnim = false) => {
      const nz = clamp(newZ, 1, 3);
      const curZ = stateRef.current.z;
      const curB = stateRef.current.base;
      const CS = stateRef.current.CS || 280;
      const curPx = stateRef.current.px;
      const curPy = stateRef.current.py;

      const centerImgX = (CS / 2 - curPx) / (curB * curZ);
      const centerImgY = (CS / 2 - curPy) / (curB * curZ);

      const targetPx = CS / 2 - centerImgX * curB * nz;
      const targetPy = CS / 2 - centerImgY * curB * nz;

      const bounds = getBounds(nz, curB, stateRef.current.nw, stateRef.current.nh, CS);
      const finalPx = clamp(targetPx, bounds.minX, bounds.maxX);
      const finalPy = clamp(targetPy, bounds.minY, bounds.maxY);

      stateRef.current.z = nz;
      stateRef.current.px = finalPx;
      stateRef.current.py = finalPy;

      setZoom(nz);
      setPosX(finalPx);
      setPosY(finalPy);

      if (withAnim) triggerSmooth();
      applyTransforms(finalPx, finalPy, nz, curB);
      flashGrid();
    },
    [clamp, getBounds, triggerSmooth, applyTransforms, flashGrid]
  );

  const step = useCallback(
    (dx: number, dy: number, withAnim = true) => {
      const bounds = getBounds();
      const currentX = stateRef.current.px;
      const currentY = stateRef.current.py;
      const nextX = clamp(currentX + dx, bounds.minX, bounds.maxX);
      const nextY = clamp(currentY + dy, bounds.minY, bounds.maxY);

      stateRef.current.px = nextX;
      stateRef.current.py = nextY;
      setPosX(nextX);
      setPosY(nextY);

      if (withAnim) triggerSmooth();
      applyTransforms(nextX, nextY, stateRef.current.z, stateRef.current.base);
      flashGrid();
    },
    [getBounds, clamp, triggerSmooth, applyTransforms, flashGrid]
  );

  const setPanPercentageX = useCallback(
    (pct: number) => {
      const bounds = getBounds();
      const ox = -bounds.minX;
      const targetX = ox > 1 ? -((pct / 100) * ox) : bounds.minX / 2;
      const finalX = clamp(targetX, bounds.minX, bounds.maxX);

      stateRef.current.px = finalX;
      setPosX(finalX);
      applyTransforms(finalX, stateRef.current.py, stateRef.current.z, stateRef.current.base);
      flashGrid();
    },
    [getBounds, clamp, applyTransforms, flashGrid]
  );

  const setPanPercentageY = useCallback(
    (pct: number) => {
      const bounds = getBounds();
      const oy = -bounds.minY;
      const targetY = oy > 1 ? -((pct / 100) * oy) : bounds.minY / 2;
      const finalY = clamp(targetY, bounds.minY, bounds.maxY);

      stateRef.current.py = finalY;
      setPosY(finalY);
      applyTransforms(stateRef.current.px, finalY, stateRef.current.z, stateRef.current.base);
      flashGrid();
    },
    [getBounds, clamp, applyTransforms, flashGrid]
  );

  const loadImage = useCallback(
    (url: string) => {
      setSrc(url);
      const img = new Image();
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
        setBase(b);
        setZoom(1);
        setPosX(initX);
        setPosY(initY);

        stateRef.current.nw = w;
        stateRef.current.nh = h;
        stateRef.current.CS = CS;
        stateRef.current.base = b;
        stateRef.current.z = 1;
        stateRef.current.px = initX;
        stateRef.current.py = initY;

        applyTransforms(initX, initY, 1, b);
      };
      img.src = url;
    },
    [applyTransforms]
  );

  // Fetch initial profile picture from CROP_API_ENDPOINT on mount/open
  useEffect(() => {
    if (isOpen) {
      // Update route URL to /profil/setting-profile-picture
      try {
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', '/profil/setting-profile-picture');
        }
      } catch (_) {}

      const fetchAvatar = async () => {
        try {
          const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
          const res = await fetch(CROP_API_ENDPOINT, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer ' + token,
            },
          });
          const json = await res.json();
          const u = json.data || json.user || json;
          const fetchedAvatar = u?.avatar_url || u?.avatar || u?.file_url;
          if (fetchedAvatar && typeof fetchedAvatar === 'string') {
            const cleanUrl = fetchedAvatar.includes('?') ? fetchedAvatar.split('?')[0] : fetchedAvatar;
            const busted = cleanUrl.startsWith('data:') ? cleanUrl : `${cleanUrl}?t=${Date.now()}`;
            setOrigSrc(busted);
            loadImage(busted);
            return;
          }
        } catch (_) {}

        const fallback = initialSrc || createInitialsAvatar(userName[0] || 'P');
        setOrigSrc(fallback);
        loadImage(fallback);
      };

      fetchAvatar();
      document.documentElement.style.overflow = 'hidden';
      setTimeout(() => {
        if (stageRef.current) stageRef.current.focus({ preventScroll: true });
      }, 180);
    } else {
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.documentElement.style.overflow = '';
      clearTimeout(smoothTimerRef.current);
      clearTimeout(gridTimerRef.current);
    };
  }, [isOpen, initialSrc, userName, loadImage]);

  const handleClose = () => {
    // Restore route back to /profil cleanly
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/profil');
      }
    } catch (_) {}
    onClose();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const stage = e.currentTarget;
    stage.setPointerCapture(e.pointerId);
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 1) {
      stateRef.current.dragStart = {
        x: e.clientX,
        y: e.clientY,
        px: stateRef.current.px,
        py: stateRef.current.py,
      };
      stateRef.current.dragging = true;
      setIsDragging(true);
    } else if (stateRef.current.ptrs.size === 2) {
      const [a, b] = Array.from(stateRef.current.ptrs.values());
      stateRef.current.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        z: stateRef.current.z,
      };
      stateRef.current.dragging = false;
      setIsDragging(false);
    }
    flashGrid();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stateRef.current.ptrs.has(e.pointerId)) return;
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 2 && stateRef.current.pinch) {
      const [a, b] = Array.from(stateRef.current.ptrs.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const targetZoom = (stateRef.current.pinch.z * dist) / stateRef.current.pinch.d;
      updateZoom(targetZoom);
      return;
    }

    if (stateRef.current.ptrs.size === 1 && stateRef.current.dragging) {
      const dx = e.clientX - stateRef.current.dragStart.x;
      const dy = e.clientY - stateRef.current.dragStart.y;
      const bounds = getBounds();

      const nextX = clamp(stateRef.current.dragStart.px + dx, bounds.minX, bounds.maxX);
      const nextY = clamp(stateRef.current.dragStart.py + dy, bounds.minY, bounds.maxY);

      stateRef.current.px = nextX;
      stateRef.current.py = nextY;
      setPosX(nextX);
      setPosY(nextY);

      applyTransforms(nextX, nextY, stateRef.current.z, stateRef.current.base);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    stateRef.current.ptrs.delete(e.pointerId);
    stateRef.current.pinch = null;

    if (stateRef.current.ptrs.size === 0) {
      stateRef.current.dragging = false;
      setIsDragging(false);
    } else {
      const [a] = Array.from(stateRef.current.ptrs.values());
      stateRef.current.dragStart = {
        x: a.x,
        y: a.y,
        px: stateRef.current.px,
        py: stateRef.current.py,
      };
      stateRef.current.dragging = true;
      setIsDragging(true);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    updateZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? STEP_PIXELS * 2 : STEP_PIXELS;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-s, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(s, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(0, -s);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(0, s);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      updateZoom(zoom + 0.1, true);
    } else if (e.key === '-') {
      e.preventDefault();
      updateZoom(zoom - 0.1, true);
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const bakeCanvas = (isRotate: boolean) => {
    const img = imgRef.current;
    if (!img || !nw || !nh) return;
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
    loadImage(newUrl);
    flashGrid();
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

    const reader = new FileReader();
    reader.onerror = () => onError('Gagal membaca file');
    reader.onload = () => {
      const im = new Image();
      im.onerror = () => onError('Gambar tidak dapat dibuka');
      im.onload = () => {
        let resultUrl = reader.result as string;
        const maxSide = Math.max(im.naturalWidth, im.naturalHeight);
        if (maxSide > MAX_DIMENSION) {
          const scaleRatio = MAX_DIMENSION / maxSide;
          const rescaleCanvas = document.createElement('canvas');
          rescaleCanvas.width = Math.round(im.naturalWidth * scaleRatio);
          rescaleCanvas.height = Math.round(im.naturalHeight * scaleRatio);
          const ctx = rescaleCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(im, 0, 0, rescaleCanvas.width, rescaleCanvas.height);
            resultUrl = rescaleCanvas.toDataURL('image/jpeg', 0.92);
          }
        }
        setOrigSrc(resultUrl);
        loadImage(resultUrl);
        flashGrid();
      };
      im.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img || !nw || !nh) return;

    setIsUploading(true);
    const bounds = getBounds();
    const clampedPx = clamp(posX, bounds.minX, bounds.maxX);
    const clampedPy = clamp(posY, bounds.minY, bounds.maxY);
    const CS = stateRef.current.CS || 280;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 512;
    outCanvas.height = 512;
    const g = outCanvas.getContext('2d');
    if (!g) {
      setIsUploading(false);
      return;
    }

    const k = 512 / CS;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 512);
    g.drawImage(
      img,
      0,
      0,
      nw,
      nh,
      clampedPx * k,
      clampedPy * k,
      nw * base * zoom * k,
      nh * base * zoom * k
    );

    const previewDataUrl = outCanvas.toDataURL('image/jpeg', 0.92);

    outCanvas.toBlob(
      async (blob) => {
        if (!blob) {
          setIsUploading(false);
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
              'Authorization': 'Bearer ' + token,
            },
            body: fd,
          });

          const resJson = await res.json();
          if (resJson && (resJson.success || resJson.status === 'success')) {
            const rawAvatar = resJson.data?.avatar_url || resJson.avatar_url || resJson.avatar || resJson.data?.file_url;
            const cleanUrl = rawAvatar ? rawAvatar.split('?')[0] : '';
            const newAvatar = cleanUrl
              ? (cleanUrl.startsWith('data:') ? cleanUrl : `${cleanUrl}?t=${Date.now()}`)
              : previewDataUrl;

            // Direct DOM update for instant visual synchronization
            const mainImg = (document.querySelector('#mainAvatarImg') || document.querySelector('.pimg img')) as HTMLImageElement | null;
            if (mainImg) {
              mainImg.src = newAvatar;
              mainImg.style.display = 'block';
            }

            handleClose();
            onSaved(newAvatar);
          } else {
            onError(resJson?.message || 'Gagal mengunggah foto profil');
          }
        } catch (err: any) {
          onError('Gagal terhubung ke server upload foto');
        } finally {
          setIsUploading(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

  const bounds = getBounds();
  const CS = stateRef.current.CS || 280;
  const ox = -bounds.minX;
  const oy = -bounds.minY;
  const cx = clamp(posX, bounds.minX, bounds.maxX);
  const cy = clamp(posY, bounds.minY, bounds.maxY);

  const percentX = ox > 1 ? Math.round((-cx / ox) * 100) : 50;
  const percentY = oy > 1 ? Math.round((-cy / oy) * 100) : 50;

  return createPortal(
    <div
      className="pc-ov pc-show"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={onKeyDown}
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
            className={`pc-stage ${isDragging ? 'pc-drag' : ''} ${isDragOver ? 'pc-over' : ''} ${hasInteracted ? 'pc-touched' : ''}`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
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
                style={{
                  width: nw ? `${nw}px` : 'auto',
                  height: nh ? `${nh}px` : 'auto',
                  transform: `translate(${posX}px, ${posY}px) scale(${base * zoom})`,
                }}
              />
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

          {/* 3 Lingkaran Pratinjau (L: 72px, M: 44px, S: 28px) */}
          <div className="pc-prevs" aria-hidden="true">
            <div className="pc-pv l">
              <img
                ref={previewLRef}
                src={src}
                alt=""
                style={{
                  width: nw ? `${nw}px` : 'auto',
                  height: nh ? `${nh}px` : 'auto',
                  transform: `translate(${posX * (72 / CS)}px, ${posY * (72 / CS)}px) scale(${base * zoom * (72 / CS)})`,
                }}
              />
            </div>
            <div className="pc-pv m">
              <img
                ref={previewMRef}
                src={src}
                alt=""
                style={{
                  width: nw ? `${nw}px` : 'auto',
                  height: nh ? `${nh}px` : 'auto',
                  transform: `translate(${posX * (44 / CS)}px, ${posY * (44 / CS)}px) scale(${base * zoom * (44 / CS)})`,
                }}
              />
            </div>
            <div className="pc-pv s">
              <img
                ref={previewSRRef}
                src={src}
                alt=""
                style={{
                  width: nw ? `${nw}px` : 'auto',
                  height: nh ? `${nh}px` : 'auto',
                  transform: `translate(${posX * (28 / CS)}px, ${posY * (28 / CS)}px) scale(${base * zoom * (28 / CS)})`,
                }}
              />
            </div>
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
              disabled={zoom <= 1}
              onClick={() => updateZoom(zoom - 0.1, true)}
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
              onChange={(e) => updateZoom(Number(e.target.value) / 100)}
              aria-label="Pengatur Zoom"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={zoom >= 3}
              onClick={() => updateZoom(zoom + 0.1, true)}
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
              disabled={ox <= 1}
              onClick={() => step(-STEP_PIXELS, 0)}
              aria-label="Geser kiri"
            >
              &lt;
            </button>
            <input
              className="pc-range"
              type="range"
              min="0"
              max="100"
              disabled={ox <= 1}
              value={percentX}
              onChange={(e) => setPanPercentageX(Number(e.target.value))}
              aria-label="Slider pan horizontal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={ox <= 1}
              onClick={() => step(STEP_PIXELS, 0)}
              aria-label="Geser kanan"
            >
              &gt;
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {percentX}%
            </output>
          </div>

          {/* Atas-Bawah Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 32px 1fr 32px 48px', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pc-ink)' }}>Atas–Bawah</span>
            <button
              type="button"
              className="pc-pan-btn"
              disabled={oy <= 1}
              onClick={() => step(0, -STEP_PIXELS)}
              aria-label="Geser atas"
            >
              ^
            </button>
            <input
              className="pc-range"
              type="range"
              min="0"
              max="100"
              disabled={oy <= 1}
              value={percentY}
              onChange={(e) => setPanPercentageY(Number(e.target.value))}
              aria-label="Slider pan vertikal"
            />
            <button
              type="button"
              className="pc-pan-btn"
              disabled={oy <= 1}
              onClick={() => step(0, STEP_PIXELS)}
              aria-label="Geser bawah"
            >
              v
            </button>
            <output style={{ fontSize: '12px', color: 'var(--pc-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {percentY}%
            </output>
          </div>
        </div>

        {/* Bottom Actions matching mockup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="pc-b soft pc-full" htmlFor="spm-file" style={{ cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            Pilih Foto Baru
          </label>
          <input
            ref={fileInputRef}
            className="sr-only"
            id="spm-file"
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleReadFile(e.target.files[0]);
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
                flashGrid();
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className={`pc-b dark ${isUploading ? 'pc-load' : ''}`}
              onClick={handleSave}
              disabled={isUploading}
            >
              <span>{isUploading ? 'Menyimpan...' : 'Simpan Foto'}</span>
              <i className="pc-spn" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
