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

const API_BASE = 'https://api-laporanwe.mkverse.my.id/api/profile';
const MAXDIM = 2048;
const STEP = 34;
const HOLD_SPEED = 3.4;

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
  const [activePadDir, setActivePadDir] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animation and physics refs
  const stateRef = useRef({
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    z: 1,
    base: 1,
    nw: 0,
    nh: 0,
    CS: 280,
    dragging: false,
    hold: null as { x: number; y: number } | null,
    raf: 0,
    last: null as { x: number; y: number; t: number } | null,
    pinch: null as { d: number; z: number } | null,
    ptrs: new Map<number, { x: number; y: number }>(),
  });

  const holdTimerRef = useRef<any>(null);
  const wasHeldRef = useRef(false);

  // Sync stateRef with React state
  useEffect(() => {
    stateRef.current.z = zoom;
    stateRef.current.base = base;
    stateRef.current.nw = nw;
    stateRef.current.nh = nh;
  }, [zoom, base, nw, nh]);

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const lim = useCallback(() => {
    const { CS, nw: w, nh: h, base: b, z } = stateRef.current;
    return {
      x: Math.min(0, CS - w * b * z),
      y: Math.min(0, CS - h * b * z),
    };
  }, []);

  const elastic = (v: number, lo: number, hi: number) =>
    v < lo ? lo + (v - lo) * 0.35 : v > hi ? hi + (v - hi) * 0.35 : v;

  // Flash grid animation
  const flashGrid = useCallback(() => {
    setHasInteracted(true);
    if (stageRef.current) {
      stageRef.current.classList.add('pc-act');
      stageRef.current.classList.add('pc-touched');
      clearTimeout((flashGrid as any).timer);
      (flashGrid as any).timer = setTimeout(() => {
        if (stageRef.current) stageRef.current.classList.remove('pc-act');
      }, 900);
    }
  }, []);

  // Update DOM transform & state
  const applyDraw = useCallback(() => {
    const L = lim();
    const { px, py, base: b, z } = stateRef.current;
    const ex = elastic(px, L.x, 0);
    const ey = elastic(py, L.y, 0);
    const s = b * z;

    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${ex}px, ${ey}px) scale(${s})`;
    }

    setPosX(ex);
    setPosY(ey);
  }, [lim]);

  // Main physics loop (inertia + elasticity bounce + holding pad)
  const loop = useCallback(() => {
    stateRef.current.raf = 0;
    let on = stateRef.current.dragging;
    const L = lim();
    const st = stateRef.current;

    if (st.hold) {
      st.px = clamp(st.px + st.hold.x * HOLD_SPEED, L.x, 0);
      st.py = clamp(st.py + st.hold.y * HOLD_SPEED, L.y, 0);
      on = true;
      st.vx = 0;
      st.vy = 0;
    } else if (!st.dragging) {
      if (Math.abs(st.vx) > 0.15 || Math.abs(st.vy) > 0.15) {
        st.px += st.vx;
        st.py += st.vy;
        st.vx *= 0.93;
        st.vy *= 0.93;
        on = true;
      }
      const tx = clamp(st.px, L.x, 0);
      const ty = clamp(st.py, L.y, 0);
      if (Math.abs(tx - st.px) > 0.25 || Math.abs(ty - st.py) > 0.25) {
        st.px += (tx - st.px) * 0.2;
        st.py += (ty - st.py) * 0.2;
        st.vx *= 0.8;
        st.vy *= 0.8;
        on = true;
      } else {
        st.px = tx;
        st.py = ty;
      }
    }

    applyDraw();
    if (on) {
      stateRef.current.raf = requestAnimationFrame(loop);
    }
  }, [lim, applyDraw]);

  const kick = useCallback(() => {
    if (!stateRef.current.raf) {
      stateRef.current.raf = requestAnimationFrame(loop);
    }
  }, [loop]);

  const settle = useCallback(() => {
    const L = lim();
    stateRef.current.px = clamp(stateRef.current.px, L.x, 0);
    stateRef.current.py = clamp(stateRef.current.py, L.y, 0);
    stateRef.current.vx = 0;
    stateRef.current.vy = 0;
  }, [lim]);

  // Set zoom level with center anchor
  const setZ = useCallback(
    (newZ: number, anim = false) => {
      settle();
      const nz = clamp(newZ, 1, 3);
      const { CS, px, py, base: b, z } = stateRef.current;
      const cx = (CS / 2 - px) / (b * z);
      const cy = (CS / 2 - py) / (b * z);
      stateRef.current.z = nz;
      stateRef.current.px = CS / 2 - cx * b * nz;
      stateRef.current.py = CS / 2 - cy * b * nz;
      settle();
      setZoom(nz);
      applyDraw();
      flashGrid();
    },
    [settle, applyDraw, flashGrid]
  );

  // Set image source and compute natural dimensions
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

        stateRef.current.nw = w;
        stateRef.current.nh = h;
        stateRef.current.CS = CS;
        stateRef.current.base = b;
        stateRef.current.z = 1;
        stateRef.current.px = initX;
        stateRef.current.py = initY;
        stateRef.current.vx = 0;
        stateRef.current.vy = 0;

        applyDraw();
      };
      img.src = url;
    },
    [applyDraw]
  );

  // Initialize image on open
  useEffect(() => {
    if (isOpen && initialSrc) {
      setOrigSrc(initialSrc);
      loadImage(initialSrc);
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      if (stateRef.current.raf) {
        cancelAnimationFrame(stateRef.current.raf);
      }
    };
  }, [isOpen, initialSrc, loadImage]);

  // Step movement (from D-pad click or arrow keys)
  const step = useCallback(
    (dx: number, dy: number) => {
      settle();
      const L = lim();
      stateRef.current.px = clamp(stateRef.current.px + dx, L.x, 0);
      stateRef.current.py = clamp(stateRef.current.py + dy, L.y, 0);
      applyDraw();
      flashGrid();
    },
    [settle, lim, applyDraw, flashGrid]
  );

  // Pointer interactions on stage (drag & pinch)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const stage = e.currentTarget;
    stage.setPointerCapture(e.pointerId);
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 1) {
      stateRef.current.last = { x: e.clientX, y: e.clientY, t: performance.now() };
      stateRef.current.vx = 0;
      stateRef.current.vy = 0;
      stateRef.current.dragging = true;
      setIsDragging(true);
    }
    if (stateRef.current.ptrs.size === 2) {
      const [a, b] = Array.from(stateRef.current.ptrs.values());
      stateRef.current.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        z: stateRef.current.z,
      };
      stateRef.current.dragging = false;
      setIsDragging(false);
    }
    flashGrid();
    kick();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stateRef.current.ptrs.has(e.pointerId)) return;
    stateRef.current.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (stateRef.current.ptrs.size === 2 && stateRef.current.pinch) {
      const [a, b] = Array.from(stateRef.current.ptrs.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      setZ((stateRef.current.pinch.z * dist) / stateRef.current.pinch.d);
      return;
    }

    if (stateRef.current.ptrs.size === 1 && stateRef.current.last) {
      const now = performance.now();
      const dx = e.clientX - stateRef.current.last.x;
      const dy = e.clientY - stateRef.current.last.y;
      const dt = Math.max(1, now - stateRef.current.last.t);

      stateRef.current.px += dx;
      stateRef.current.py += dy;
      stateRef.current.vx = (dx / dt) * 16;
      stateRef.current.vy = (dy / dt) * 16;
      stateRef.current.last = { x: e.clientX, y: e.clientY, t: now };
      kick();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    stateRef.current.ptrs.delete(e.pointerId);
    stateRef.current.pinch = null;

    if (stateRef.current.ptrs.size === 0) {
      stateRef.current.dragging = false;
      stateRef.current.last = null;
      setIsDragging(false);
      kick();
    } else {
      const [a] = Array.from(stateRef.current.ptrs.values());
      stateRef.current.last = { x: a.x, y: a.y, t: performance.now() };
      stateRef.current.dragging = true;
      setIsDragging(true);
    }
  };

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZ(zoom * Math.exp(-e.deltaY * 0.0015));
  };

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? STEP * 2 : STEP;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(s, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(-s, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(0, s);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(0, -s);
    } else if (e.key === '+' || e.key === '=') {
      setZ(zoom + 0.1, true);
    } else if (e.key === '-') {
      setZ(zoom - 0.1, true);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // D-pad continuous hold & single click logic
  const DIR_MAP: Record<string, [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [1, 0],
    right: [-1, 0],
  };

  const handlePadPointerDown = (d: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (d === 'center') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasHeldRef.current = false;
    setActivePadDir(d);
    settle();

    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      wasHeldRef.current = true;
      stateRef.current.hold = { x: DIR_MAP[d][0], y: DIR_MAP[d][1] };
      flashGrid();
      kick();
    }, 240);
  };

  const handlePadPointerUp = () => {
    clearTimeout(holdTimerRef.current);
    setActivePadDir(null);
    if (stateRef.current.hold) {
      stateRef.current.hold = null;
      wasHeldRef.current = true;
      kick();
    }
  };

  const handlePadClick = (d: string) => {
    if (d === 'center') {
      const { CS, nw: w, nh: h, base: b, z } = stateRef.current;
      stateRef.current.px = (CS - w * b * z) / 2;
      stateRef.current.py = (CS - h * b * z) / 2;
      settle();
      applyDraw();
      flashGrid();
      return;
    }
    if (wasHeldRef.current) {
      wasHeldRef.current = false;
      return;
    }
    step(DIR_MAP[d][0] * STEP, DIR_MAP[d][1] * STEP);
  };

  // Rotate & Flip image using canvas bake
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

  // Read and validate selected image file
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
          const k = MAXDIM / maxSide;
          const cv = document.createElement('canvas');
          cv.width = Math.round(im.naturalWidth * k);
          cv.height = Math.round(im.naturalHeight * k);
          const ctx = cv.getContext('2d');
          if (ctx) {
            ctx.drawImage(im, 0, 0, cv.width, cv.height);
            resultUrl = cv.toDataURL('image/jpeg', 0.92);
          }
        }
        setOrigSrc(resultUrl);
        loadImage(resultUrl);
      };
      im.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop onto stage
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = () => {
    setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleReadFile(e.dataTransfer.files[0]);
    }
  };

  // Save cropped result to MySQL backend via upload.php
  const handleSave = async () => {
    const img = imgRef.current;
    if (!img || !nw || !nh) return;

    settle();
    applyDraw();
    setIsUploading(true);

    const { CS, px, py, base: b, z } = stateRef.current;
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
    g.drawImage(img, 0, 0, nw, nh, px * k, py * k, nw * b * z * k, nh * b * z * k);

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
          fd.append('avatar', blob, `avatar_${profileId}_${Date.now()}.jpg`);
          fd.append('id', String(profileId));

          const res = await fetch(`${API_BASE}/upload.php`, {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
            },
            body: fd,
          });

          const json = await res.json();
          let finalAvatarUrl = previewDataUrl;
          if (json && json.success && json.avatar_url) {
            finalAvatarUrl = json.avatar_url;
          }

          // Real-time synchronization
          onSaved(finalAvatarUrl);
          onClose();
        } catch (err) {
          // Offline fallback
          onSaved(previewDataUrl);
          onClose();
        } finally {
          setIsUploading(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

  const L = lim();
  const CS = stateRef.current.CS || 280;
  const ox = -L.x;
  const oy = -L.y;
  const cx = clamp(posX, L.x, 0);
  const cy = clamp(posY, L.y, 0);
  const percentX = ox > 1 ? Math.round((-cx / ox) * 100) : 50;
  const percentY = oy > 1 ? Math.round((-cy / oy) * 100) : 50;

  // Render directly at root DOM via createPortal
  return createPortal(
    <div
      className={`pc-ov pc-show`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          <button type="button" className="pc-x" onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="pc-hint-t">
          Seret foto atau pakai tombol arah untuk menggeser kanan, kiri, atas, dan bawah. Atur zoom, lalu klik Simpan Foto.
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
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
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

        {/* Panel Kontrol D-pad & Zoom / Orientasi */}
        <div className="pc-panels">
          <section className="pc-panel" aria-label="Geser posisi foto">
            <h3>Geser</h3>
            <div className="pc-dpad">
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'up' ? 'pc-hold' : ''}`}
                data-d="up"
                aria-label="Geser ke atas"
                onPointerDown={(e) => handlePadPointerDown('up', e)}
                onPointerUp={handlePadPointerUp}
                onPointerCancel={handlePadPointerUp}
                onClick={() => handlePadClick('up')}
              >
                <svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg>
              </button>
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'left' ? 'pc-hold' : ''}`}
                data-d="left"
                aria-label="Geser ke kiri"
                onPointerDown={(e) => handlePadPointerDown('left', e)}
                onPointerUp={handlePadPointerUp}
                onPointerCancel={handlePadPointerUp}
                onClick={() => handlePadClick('left')}
              >
                <svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>
              </button>
              <button
                type="button"
                className="pc-pad"
                data-d="center"
                aria-label="Pusatkan foto"
                onClick={() => handlePadClick('center')}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                </svg>
              </button>
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'right' ? 'pc-hold' : ''}`}
                data-d="right"
                aria-label="Geser ke kanan"
                onPointerDown={(e) => handlePadPointerDown('right', e)}
                onPointerUp={handlePadPointerUp}
                onPointerCancel={handlePadPointerUp}
                onClick={() => handlePadClick('right')}
              >
                <svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg>
              </button>
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'down' ? 'pc-hold' : ''}`}
                data-d="down"
                aria-label="Geser ke bawah"
                onPointerDown={(e) => handlePadPointerDown('down', e)}
                onPointerUp={handlePadPointerUp}
                onPointerCancel={handlePadPointerUp}
                onClick={() => handlePadClick('down')}
              >
                <svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6" /></svg>
              </button>
            </div>
            <div className="pc-read" aria-live="polite">
              {ox > 1 || oy > 1 ? (
                <>Posisi <b>X {percentX}%</b> · <b>Y {percentY}%</b></>
              ) : (
                'Foto pas — perbesar zoom untuk menggeser'
              )}
            </div>
          </section>

          <section className="pc-panel">
            <h3>Zoom</h3>
            <div className="pc-zoom">
              <button
                type="button"
                className="pc-ico"
                disabled={zoom <= 1}
                onClick={() => setZ(zoom - 0.2, true)}
                aria-label="Perkecil"
              >
                <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
              </button>
              <input
                className="pc-range"
                type="range"
                min="100"
                max="300"
                value={Math.round(zoom * 100)}
                onChange={(e) => setZ(Number(e.target.value) / 100)}
                aria-label="Zoom"
              />
              <button
                type="button"
                className="pc-ico"
                disabled={zoom >= 3}
                onClick={() => setZ(zoom + 0.2, true)}
                aria-label="Perbesar"
              >
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <output>{Math.round(zoom * 100)}%</output>
            </div>

            <h3>Orientasi</h3>
            <div className="pc-tools">
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
          </section>
        </div>

        {/* Tombol Aksi */}
        <div className="pc-actions">
          <label className="pc-b soft pc-full" htmlFor="pc-file" style={{ cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            Pilih Foto Baru
          </label>
          <input
            ref={fileInputRef}
            className="sr-only"
            id="pc-file"
            type="file"
            accept="image/*"
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
