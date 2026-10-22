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

const CROP_SETTING_API = 'https://api-laporanwe.mkverse.my.id/api/profile/setting-profil-picture/index.php';
const MAXDIM = 2048;
const STEP = 34;

export const ProfileCropModal: React.FC<ProfileCropModalProps> = ({
  isOpen,
  initialSrc,
  profileId,
  onClose,
  onSaved,
  onError,
}) => {
  const [src, setSrc] = useState(initialSrc);
  const [origSrc, setOrigSrc] = useState(initialSrc);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [base, setBase] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      const fetchPicture = async () => {
        try {
          const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
          const res = await fetch(CROP_SETTING_API, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': token ? 'Bearer ' + token : '',
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

        if (initialSrc) {
          setOrigSrc(initialSrc);
          loadImage(initialSrc);
        }
      };

      fetchPicture();
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
  }, [isOpen, initialSrc, loadImage]);

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
        if (maxSide > MAXDIM) {
          const scaleRatio = MAXDIM / maxSide;
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
    setIsUploading(true);
    try {
      let img = imgRef.current;
      let currentW = nw;
      let currentH = nh;

      if (!img || !currentW || !currentH) {
        if (src) {
          const loadedImg = new Image();
          loadedImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            loadedImg.onload = () => resolve();
            loadedImg.onerror = () => reject(new Error('Gagal memuat gambar'));
            loadedImg.src = src;
          });
          img = loadedImg;
          currentW = loadedImg.naturalWidth || 512;
          currentH = loadedImg.naturalHeight || 512;
        }
      }

      if (!img) {
        onError('Belum ada foto untuk disimpan');
        setIsUploading(false);
        return;
      }

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
        onError('Gagal membuat kanvas gambar');
        return;
      }

      const k = 512 / CS;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 512, 512);
      g.drawImage(
        img,
        0,
        0,
        currentW,
        currentH,
        clampedPx * k,
        clampedPy * k,
        currentW * base * zoom * k,
        currentH * base * zoom * k
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
            const userId = profileId || 1;
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
            const fd = new FormData();
            fd.append('avatar', blob, `avatar_${userId}_${Date.now()}.jpg`);
            fd.append('id', String(userId));

            const res = await fetch(CROP_SETTING_API, {
              method: 'POST',
              headers: {
                'Authorization': token ? 'Bearer ' + token : '',
              },
              body: fd,
            });

            const resJson = await res.json();
            if (resJson && (resJson.success || resJson.status === 'success')) {
              const rawAvatar = resJson.data?.avatar_url || resJson.avatar_url || resJson.avatar || resJson.data?.file_url;
              const cleanUrl = rawAvatar ? rawAvatar.split('?')[0] : '';
              const freshAvatar = cleanUrl
                ? (cleanUrl.startsWith('data:') ? cleanUrl : `${cleanUrl}?t=${Date.now()}`)
                : previewDataUrl;

              // Direct DOM update for instant visual synchronization
              const mainImgs = document.querySelectorAll('#mainAvatarImg, .pimg img, .avatar img');
              mainImgs.forEach((el) => {
                (el as HTMLImageElement).src = freshAvatar;
                (el as HTMLImageElement).style.display = 'block';
              });

              try {
                if (window.history && window.history.pushState) {
                  window.history.pushState({}, '', '/profil');
                }
              } catch (_) {}

              onSaved(freshAvatar);
              onClose();
            } else {
              onError(resJson?.message || 'Gagal mengunggah foto profil');
            }
          } catch (err: any) {
            onError('Terjadi kesalahan koneksi ke server.');
          } finally {
            setIsUploading(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err: any) {
      onError('Terjadi kesalahan saat memproses gambar.');
      setIsUploading(false);
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
          Seret foto untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
        </p>

        {/* Stage & 3 Previews */}
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
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="pc-actions">
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
              if (e.target.files && e.target.files[0]) {
                handleReadFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
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
    </div>,
    document.body
  );
};
