import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LwIcon } from './LaporanWeeIcons';
import { API_CONFIG } from '../utils/apiConfig';

interface PhotoCropStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  userName: string;
  onAvatarSaved: (newAvatarUrl: string) => void;
  onAddToast: (msg: string) => void;
}

export const PhotoCropStudioModal: React.FC<PhotoCropStudioModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  userName,
  onAvatarSaved,
  onAddToast,
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [origSrc, setOrigSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGridActive, setIsGridActive] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Natural image dimensions and base scale
  const [naturalW, setNaturalW] = useState<number>(480);
  const [naturalH, setNaturalH] = useState<number>(480);
  const [baseScale, setBaseScale] = useState<number>(1);

  const cropBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const gridTimeoutRef = useRef<any>(null);

  // Velocity tracker for inertia physics
  const pointerMap = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const velocity = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const pinchDist = useRef<{ dist: number; initialZoom: number } | null>(null);

  const CROP_SIZE = 260; // diameter in px

  // Trigger grid visibility flash
  const flashGrid = useCallback(() => {
    setIsGridActive(true);
    if (gridTimeoutRef.current) clearTimeout(gridTimeoutRef.current);
    gridTimeoutRef.current = setTimeout(() => setIsGridActive(false), 900);
  }, []);

  // Clamping pan bounds to prevent empty gaps
  const clampPan = useCallback((x: number, y: number, currentZ: number, scale: number, nw: number, nh: number) => {
    const totalW = nw * scale * currentZ;
    const totalH = nh * scale * currentZ;
    const clampedX = Math.min(0, Math.max(CROP_SIZE - totalW, x));
    const clampedY = Math.min(0, Math.max(CROP_SIZE - totalH, y));
    return { x: clampedX, y: clampedY };
  }, []);

  // Set new image and compute initial centered coordinates
  const loadNewImage = useCallback((source: string, isReset = false) => {
    const testImg = new Image();
    testImg.onload = () => {
      const nw = testImg.naturalWidth || 480;
      const nh = testImg.naturalHeight || 480;
      const base = CROP_SIZE / Math.min(nw, nh);

      setNaturalW(nw);
      setNaturalH(nh);
      setBaseScale(base);

      if (!isReset) {
        const initialZoom = 1;
        setZoom(initialZoom);
        const initX = (CROP_SIZE - nw * base * initialZoom) / 2;
        const initY = (CROP_SIZE - nh * base * initialZoom) / 2;
        setPanX(initX);
        setPanY(initY);
      }
      setImgSrc(source);
    };
    testImg.src = source;
  }, []);

  // Initialize image on open
  useEffect(() => {
    if (isOpen) {
      const initial = currentAvatarUrl || API_CONFIG.getLocalUser().avatar_url || '';
      if (initial) {
        setOrigSrc(initial);
        loadNewImage(initial);
      } else {
        // Fallback initial
        const placeholder = API_CONFIG.getLocalUser().avatar_url || '';
        setOrigSrc(placeholder);
        loadNewImage(placeholder);
      }
    } else {
      cancelAnimationFrame(rafRef.current);
      if (gridTimeoutRef.current) clearTimeout(gridTimeoutRef.current);
    }
  }, [isOpen, currentAvatarUrl, loadNewImage]);

  // Adjust zoom while preserving focus around center
  const setZoomLevel = (newZ: number) => {
    const safeZ = Math.min(3, Math.max(1, newZ));
    const centerX = (CROP_SIZE / 2 - panX) / (baseScale * zoom);
    const centerY = (CROP_SIZE / 2 - panY) / (baseScale * zoom);

    const targetX = CROP_SIZE / 2 - centerX * baseScale * safeZ;
    const targetY = CROP_SIZE / 2 - centerY * baseScale * safeZ;

    const clamped = clampPan(targetX, targetY, safeZ, baseScale, naturalW, naturalH);
    setZoom(safeZ);
    setPanX(clamped.x);
    setPanY(clamped.y);
    flashGrid();
  };

  // Nudge pan with keyboard or stepper
  const nudge = (dx: number, dy: number) => {
    cancelAnimationFrame(rafRef.current);
    const clamped = clampPan(panX + dx, panY + dy, zoom, baseScale, naturalW, naturalH);
    setPanX(clamped.x);
    setPanY(clamped.y);
    flashGrid();
  };

  // Pointer event handlers with inertia physics
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropBoxRef.current) return;
    cropBoxRef.current.setPointerCapture(e.pointerId);
    pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(rafRef.current);

    if (pointerMap.current.size === 1) {
      lastPointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      velocity.current = { vx: 0, vy: 0 };
      setIsDragging(true);
    } else if (pointerMap.current.size === 2) {
      const [p1, p2] = Array.from(pointerMap.current.values());
      pinchDist.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        initialZoom: zoom,
      };
    }
    flashGrid();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerMap.current.has(e.pointerId)) return;
    pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch-to-zoom
    if (pointerMap.current.size === 2 && pinchDist.current) {
      const [p1, p2] = Array.from(pointerMap.current.values());
      const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const factor = currentDist / pinchDist.current.dist;
      setZoomLevel(pinchDist.current.initialZoom * factor);
      return;
    }

    // Single touch drag
    if (pointerMap.current.size === 1 && lastPointer.current) {
      const now = performance.now();
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      const dt = Math.max(1, now - lastPointer.current.t);

      const nextX = panX + dx;
      const nextY = panY + dy;
      const clamped = clampPan(nextX, nextY, zoom, baseScale, naturalW, naturalH);

      setPanX(clamped.x);
      setPanY(clamped.y);

      velocity.current = {
        vx: (dx / dt) * 16,
        vy: (dy / dt) * 16,
      };

      lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerMap.current.delete(e.pointerId);
    pinchDist.current = null;

    if (pointerMap.current.size === 0) {
      setIsDragging(false);
      lastPointer.current = null;

      // Inertia decay friction loop
      let curVx = velocity.current.vx;
      let curVy = velocity.current.vy;

      const decayStep = () => {
        curVx *= 0.92;
        curVy *= 0.92;

        if (Math.abs(curVx) < 0.2 && Math.abs(curVy) < 0.2) return;

        setPanX((prevX) => {
          setPanY((prevY) => {
            const clamped = clampPan(prevX + curVx, prevY + curVy, zoom, baseScale, naturalW, naturalH);
            return clamped.y;
          });
          const clamped = clampPan(prevX + curVx, panY, zoom, baseScale, naturalW, naturalH);
          return clamped.x;
        });

        rafRef.current = requestAnimationFrame(decayStep);
      };

      if (Math.hypot(curVx, curVy) > 1.2) {
        rafRef.current = requestAnimationFrame(decayStep);
      }
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel(zoom + delta);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 10;
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(step, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(-step, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, step); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, -step); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoomLevel(zoom + 0.1); }
    else if (e.key === '-') { e.preventDefault(); setZoomLevel(zoom - 0.1); }
  };

  // Canvas Bake tool: Rotate 90 degrees or Flip horizontally
  const bakeTransform = (isRotate: boolean) => {
    if (!imgSrc) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = isRotate ? img.naturalHeight : img.naturalWidth;
      canvas.height = isRotate ? img.naturalWidth : img.naturalHeight;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (isRotate) {
        ctx.rotate(-Math.PI / 2);
      } else {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const bakedData = canvas.toDataURL('image/jpeg', 0.95);
      loadNewImage(bakedData, true);
      onAddToast(isRotate ? 'Foto diputar 90°' : 'Foto dibalik horizontal');
    };
    img.src = imgSrc;
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar (JPG, PNG, atau WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onAddToast('Ukuran foto maksimal 10 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setOrigSrc(result);
      loadNewImage(result);
      onAddToast('Foto baru dimuat');
    };
    reader.readAsDataURL(file);
  };

  // Save cropped photo
  const handleSaveCropped = async () => {
    if (!imgSrc || isSaving) return;
    setIsSaving(true);

    try {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 512;
      outputCanvas.height = 512;
      const ctx = outputCanvas.getContext('2d');

      if (!ctx) throw new Error('Canvas rendering context unavailable');

      const img = new Image();
      img.onload = async () => {
        const k = 512 / CROP_SIZE;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          0,
          0,
          naturalW,
          naturalH,
          panX * k,
          panY * k,
          naturalW * baseScale * zoom * k,
          naturalH * baseScale * zoom * k
        );

        const exportedJpeg = outputCanvas.toDataURL('image/jpeg', 0.92);

        // Optimistically update everywhere
        await API_CONFIG.profile.uploadPhoto(exportedJpeg);
        onAvatarSaved(exportedJpeg);

        setTimeout(() => {
          setIsSaving(false);
          onAddToast('Foto profil berhasil diperbarui');
          onClose();
        }, 500);
      };
      img.src = imgSrc;
    } catch (err: any) {
      setIsSaving(false);
      onAddToast(err?.message || 'Gagal menyimpan foto');
    }
  };

  if (!isOpen) return null;

  // Compute percentage indicators for controls
  const totalW = naturalW * baseScale * zoom - CROP_SIZE;
  const totalH = naturalH * baseScale * zoom - CROP_SIZE;
  const horizPercent = totalW > 1 ? Math.round((-panX / totalW) * 100) : 50;
  const vertPercent = totalH > 1 ? Math.round((-panY / totalH) * 100) : 50;

  return (
    <div className={`lw-ov ${isOpen ? 'show' : ''}`} role="dialog" aria-modal="true">
      <div className="lw-modal">
        <div className="lw-mh">
          <h2>Edit Foto Profil</h2>
          <button className="lw-x" type="button" onClick={onClose} aria-label="Tutup modal">
            <LwIcon name="close" size={16} />
          </button>
        </div>

        <p className="lw-hint">
          Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
        </p>

        {/* Viewfinder and live previews */}
        <div className="lw-stagewrap">
          <div
            ref={cropBoxRef}
            className={`lw-crop ${isDragging ? 'drag' : ''} ${isGridActive ? 'act' : ''}`}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
          >
            {imgSrc && (
              <img
                src={imgSrc}
                alt="Area Crop"
                draggable={false}
                style={{
                  width: `${naturalW}px`,
                  height: `${naturalH}px`,
                  transform: `translate(${panX}px, ${panY}px) scale(${baseScale * zoom})`,
                }}
              />
            )}
            <div className="grid" />
            <div className="ring" />
          </div>

          {/* Live Preview Bubbles */}
          <div className="lw-prevs" aria-hidden="true">
            <div className="lw-pv l">
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="Preview Besar"
                  style={{
                    width: `${naturalW}px`,
                    height: `${naturalH}px`,
                    transform: `translate(${panX * (64 / CROP_SIZE)}px, ${panY * (64 / CROP_SIZE)}px) scale(${baseScale * zoom * (64 / CROP_SIZE)})`,
                  }}
                />
              )}
            </div>
            <div className="lw-pv m">
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="Preview Sedang"
                  style={{
                    width: `${naturalW}px`,
                    height: `${naturalH}px`,
                    transform: `translate(${panX * (40 / CROP_SIZE)}px, ${panY * (40 / CROP_SIZE)}px) scale(${baseScale * zoom * (40 / CROP_SIZE)})`,
                  }}
                />
              )}
            </div>
            <div className="lw-pv s">
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="Preview Kecil"
                  style={{
                    width: `${naturalW}px`,
                    height: `${naturalH}px`,
                    transform: `translate(${panX * (26 / CROP_SIZE)}px, ${panY * (26 / CROP_SIZE)}px) scale(${baseScale * zoom * (26 / CROP_SIZE)})`,
                  }}
                />
              )}
            </div>
            <small>Pratinjau</small>
          </div>
        </div>

        {/* Tools: Rotate & Flip */}
        <div className="lw-tools">
          <button className="lw-tl" type="button" onClick={() => bakeTransform(true)}>
            <LwIcon name="rotate" size={16} />
            Putar
          </button>
          <button className="lw-tl" type="button" onClick={() => bakeTransform(false)}>
            <LwIcon name="flip" size={16} />
            Balik
          </button>
        </div>

        {/* Controls: Zoom */}
        <div className="lw-ctl">
          <span>Zoom</span>
          <button
            type="button"
            className="lw-z"
            disabled={zoom <= 1}
            onClick={() => setZoomLevel(zoom - 0.15)}
            aria-label="Perkecil"
          >
            <LwIcon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} />
          </button>
          <input
            type="range"
            min="100"
            max="300"
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
            aria-label="Zoom foto"
          />
          <button
            type="button"
            className="lw-z"
            disabled={zoom >= 3}
            onClick={() => setZoomLevel(zoom + 0.15)}
            aria-label="Perbesar"
          >
            <LwIcon name="plus" size={14} />
          </button>
          <output>{Math.round(zoom * 100)}%</output>
        </div>

        {/* Controls: Kiri - Kanan */}
        <div className="lw-ctl">
          <span>Kiri–Kanan</span>
          <button
            type="button"
            className="lw-z"
            disabled={totalW <= 1}
            onClick={() => nudge(18, 0)}
            aria-label="Geser kiri"
          >
            &lt;
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={horizPercent}
            disabled={totalW <= 1}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPanX(-(val / 100) * totalW);
              flashGrid();
            }}
            aria-label="Geser posisi horizontal"
          />
          <button
            type="button"
            className="lw-z"
            disabled={totalW <= 1}
            onClick={() => nudge(-18, 0)}
            aria-label="Geser kanan"
          >
            &gt;
          </button>
          <output>{horizPercent}%</output>
        </div>

        {/* Controls: Atas - Bawah */}
        <div className="lw-ctl">
          <span>Atas–Bawah</span>
          <button
            type="button"
            className="lw-z"
            disabled={totalH <= 1}
            onClick={() => nudge(0, 18)}
            aria-label="Geser atas"
          >
            &and;
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={vertPercent}
            disabled={totalH <= 1}
            onChange={(e) => {
              const val = Number(e.target.value);
              setPanY(-(val / 100) * totalH);
              flashGrid();
            }}
            aria-label="Geser posisi vertikal"
          />
          <button
            type="button"
            className="lw-z"
            disabled={totalH <= 1}
            onClick={() => nudge(0, -18)}
            aria-label="Geser bawah"
          >
            &or;
          </button>
          <output>{vertPercent}%</output>
        </div>

        {/* Action Buttons */}
        <div className="lw-mact">
          <label className="lw-btn full" style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}>
            <LwIcon name="upload" size={17} />
            <span>Pilih Foto Baru</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>

          <button
            type="button"
            className="lw-btn"
            style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            onClick={() => {
              if (origSrc) {
                loadNewImage(origSrc);
                onAddToast('Reset ke foto semula');
              }
            }}
          >
            Reset
          </button>

          <button
            type="button"
            className={`lw-btn ${isSaving ? 'load' : ''}`}
            style={{ background: 'var(--dark)', color: 'var(--on-dark)' }}
            onClick={handleSaveCropped}
          >
            <span>Simpan Foto</span>
            <LwIcon name="check" size={17} />
            <i className="sp" />
          </button>
        </div>
      </div>
    </div>
  );
};
