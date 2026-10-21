import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  withAvatarCacheBust,
  recordProfileSaveTimestamp,
  getLatestProfileSaveTimestamp,
  syncAuthenticatedUser,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileCropViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: {
    email: string;
    name: string;
    avatar_url?: string | null;
    profile_title?: string;
    profile_location?: string;
  }) => void;
}

const MAXDIM = 2048;
const STEP = 34;
const HOLD_SPEED = 3.4;

export const ProfileCropView: React.FC<ProfileCropViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // State
  const [src, setSrc] = useState<string>(initialAvatarUrl ? withAvatarCacheBust(initialAvatarUrl) : '');
  const [origSrc, setOrigSrc] = useState<string>(initialAvatarUrl || '');
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [base, setBase] = useState(1);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activePadDir, setActivePadDir] = useState<string | null>(null);

  // Profile metadata to preserve during save
  const [profileMeta, setProfileMeta] = useState<{
    full_name: string;
    profile_title: string;
    profile_location: string;
  }>({
    full_name: userName || userEmail?.split('@')[0] || '',
    profile_title: '',
    profile_location: '',
  });

  // DOM refs
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewLRef = useRef<HTMLImageElement>(null);
  const previewMRef = useRef<HTMLImageElement>(null);
  const previewSRRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // High performance state reference
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

  const holdTimerRef = useRef<any>(null);
  const wasHeldRef = useRef(false);
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

  // Sync stateRef
  useEffect(() => {
    stateRef.current.z = zoom;
    stateRef.current.base = base;
    stateRef.current.nw = nw;
    stateRef.current.nh = nh;
    stateRef.current.px = posX;
    stateRef.current.py = posY;
  }, [zoom, base, nw, nh, posX, posY]);

  // Flash grid animation and touch marker
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

  // Temporary smooth CSS class for discrete steps
  const triggerSmooth = useCallback(() => {
    if (stageRef.current) {
      stageRef.current.classList.add('pc-smooth');
      clearTimeout(smoothTimerRef.current);
      smoothTimerRef.current = setTimeout(() => {
        if (stageRef.current) stageRef.current.classList.remove('pc-smooth');
      }, 340);
    }
  }, []);

  // Update styles directly on elements for zero latency rendering
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

  // Physics animation loop (for D-pad hold continuous panning)
  const loop = useCallback(() => {
    stateRef.current.raf = 0;
    const st = stateRef.current;
    let keepRunning = false;

    if (st.hold) {
      const bounds = getBounds(st.z, st.base, st.nw, st.nh, st.CS);
      const nextX = clamp(st.px + st.hold.x * HOLD_SPEED, bounds.minX, bounds.maxX);
      const nextY = clamp(st.py + st.hold.y * HOLD_SPEED, bounds.minY, bounds.maxY);

      st.px = nextX;
      st.py = nextY;
      setPosX(nextX);
      setPosY(nextY);
      applyTransforms(nextX, nextY, st.z, st.base);
      keepRunning = true;
    }

    if (keepRunning) {
      st.raf = requestAnimationFrame(loop);
    }
  }, [getBounds, clamp, applyTransforms]);

  const kick = useCallback(() => {
    if (!stateRef.current.raf) {
      stateRef.current.raf = requestAnimationFrame(loop);
    }
  }, [loop]);

  // Zoom update function: keeps the point at center of circle anchored
  const updateZoom = useCallback(
    (newZ: number, withAnim = false) => {
      const nz = clamp(newZ, 1, 3);
      const curZ = stateRef.current.z;
      const curB = stateRef.current.base;
      const CS = stateRef.current.CS || 280;
      const curPx = stateRef.current.px;
      const curPy = stateRef.current.py;

      // Center anchor coordinates in image space
      const centerImgX = (CS / 2 - curPx) / (curB * curZ);
      const centerImgY = (CS / 2 - curPy) / (curB * curZ);

      // Target position with new zoom
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

  // Step movement (from D-pad click, pan button, or keyboard)
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

  // Center image function
  const centerImage = useCallback(() => {
    const bounds = getBounds();
    const targetX = bounds.minX / 2;
    const targetY = bounds.minY / 2;

    stateRef.current.px = targetX;
    stateRef.current.py = targetY;
    setPosX(targetX);
    setPosY(targetY);

    triggerSmooth();
    applyTransforms(targetX, targetY, stateRef.current.z, stateRef.current.base);
    flashGrid();
  }, [getBounds, triggerSmooth, applyTransforms, flashGrid]);

  // Set position by percentage (0% to 100%) for horizontal and vertical pan sliders
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

  // Load and initialize an image
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

  // Load initial profile on mount
  useEffect(() => {
    let isMounted = true;
    const requestInitiatedAt = Date.now();

    const initData = async () => {
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

        if (res && res.success && res.data) {
          const d = res.data;
          const rawAvatar = extractAvatarFromResponse(res);
          const activeUrl = rawAvatar ? withAvatarCacheBust(rawAvatar, d.updated_at || Date.now()) : (initialAvatarUrl || '');

          if (activeUrl) {
            setOrigSrc(activeUrl);
            loadImage(activeUrl);
          }

          setProfileMeta({
            full_name: d.full_name || d.name || userName,
            profile_title: d.profile_title || d.title || '',
            profile_location: d.profile_location || d.status || d.location || '',
          });
        } else if (initialAvatarUrl) {
          setOrigSrc(initialAvatarUrl);
          loadImage(initialAvatarUrl);
        }
      } catch (e) {
        if (initialAvatarUrl) {
          setOrigSrc(initialAvatarUrl);
          loadImage(initialAvatarUrl);
        }
      }
    };

    initData();

    return () => {
      isMounted = false;
      if (stateRef.current.raf) {
        cancelAnimationFrame(stateRef.current.raf);
      }
      clearTimeout(holdTimerRef.current);
      clearTimeout(smoothTimerRef.current);
      clearTimeout(gridTimerRef.current);
    };
  }, []);

  // Pointer drag & pinch handlers on .pc-stage
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

    // Handle 2-finger pinch zoom
    if (stateRef.current.ptrs.size === 2 && stateRef.current.pinch) {
      const [a, b] = Array.from(stateRef.current.ptrs.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const targetZoom = (stateRef.current.pinch.z * dist) / stateRef.current.pinch.d;
      updateZoom(targetZoom);
      return;
    }

    // Handle 1-finger / cursor drag
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

  // Wheel zoom on stage
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    updateZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  };

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? STEP * 2 : STEP;
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
    }
  };

  // D-pad continuous hold & single click logic
  const DIR_MAP: Record<string, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };

  const handlePadPointerDown = (d: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (d === 'center') return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasHeldRef.current = false;
    setActivePadDir(d);

    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      wasHeldRef.current = true;
      stateRef.current.hold = { x: DIR_MAP[d][0], y: DIR_MAP[d][1] };
      flashGrid();
      kick();
    }, 200);
  };

  const handlePadPointerUp = (e?: React.PointerEvent<HTMLButtonElement>) => {
    if (e) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    clearTimeout(holdTimerRef.current);
    setActivePadDir(null);
    if (stateRef.current.hold) {
      stateRef.current.hold = null;
      wasHeldRef.current = true;
    }
  };

  const handlePadClick = (d: string) => {
    if (d === 'center') {
      centerImage();
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
      onAddToast('File harus berupa gambar');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      onAddToast('Ukuran foto maksimal 12 MB');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => onAddToast('Gagal membaca file');
    reader.onload = () => {
      const im = new Image();
      im.onerror = () => onAddToast('Gambar tidak dapat dibuka');
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

  // Save cropped image
  const handleSaveCrop = async () => {
    const img = imgRef.current;
    if (!img || !nw || !nh) {
      onAddToast('Belum ada foto untuk disimpan.');
      return;
    }
    if (isSavingCrop) return;
    setIsSavingCrop(true);

    const bounds = getBounds();
    const clampedPx = clamp(posX, bounds.minX, bounds.maxX);
    const clampedPy = clamp(posY, bounds.minY, bounds.maxY);
    const CS = stateRef.current.CS || 280;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 512;
    outCanvas.height = 512;
    const g = outCanvas.getContext('2d');
    if (!g) {
      setIsSavingCrop(false);
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
          setIsSavingCrop(false);
          onAddToast('Gagal memproses gambar');
          return;
        }

        try {
          // Upload to /upload.php
          const fileToUpload = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const uploadRes = await profileService.uploadPhoto(fileToUpload);

          let freshAvatarUrl = previewDataUrl;
          if (uploadRes && uploadRes.success && (uploadRes.avatar_url || uploadRes.data?.avatar_url)) {
            freshAvatarUrl = uploadRes.avatar_url || uploadRes.data?.avatar_url;
          }

          // Also save metadata via /save.php
          await profileService.saveProfile({
            full_name: profileMeta.full_name,
            profile_title: profileMeta.profile_title,
            profile_location: profileMeta.profile_location,
            crop_url: freshAvatarUrl,
            zoom: zoom,
            x: clampedPx,
            y: clampedPy,
          });

          recordProfileSaveTimestamp();
          const cleanAvatar = withAvatarCacheBust(freshAvatarUrl);

          syncAuthenticatedUser({
            avatar_url: cleanAvatar,
            name: profileMeta.full_name,
          });

          if (onUpdateUser) {
            onUpdateUser({
              name: profileMeta.full_name,
              email: userEmail,
              profile_title: profileMeta.profile_title,
              profile_location: profileMeta.profile_location,
              avatar_url: cleanAvatar,
            });
          }

          window.dispatchEvent(
            new CustomEvent('laporanwee-profile-updated', {
              detail: {
                avatar_url: cleanAvatar,
                full_name: profileMeta.full_name,
              },
            })
          );

          onAddToast('Foto profil berhasil disimpan.');
          onNavigate('profile');
        } catch (err: any) {
          onAddToast(err?.message || 'Gagal menyimpan foto ke server.');
        } finally {
          setIsSavingCrop(false);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // Delete photo
  const handleDeletePhoto = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await profileService.deletePhoto();
      recordProfileSaveTimestamp();

      if (res && res.success) {
        onAddToast('Foto profil berhasil dihapus.');
        syncAuthenticatedUser({ avatar_url: null });
        if (onUpdateUser) {
          onUpdateUser({
            name: profileMeta.full_name,
            email: userEmail,
            avatar_url: null,
          });
        }
        window.dispatchEvent(new CustomEvent('laporanwee-profile-updated', { detail: { avatar_url: null } }));
        onNavigate('profile');
      } else {
        onAddToast(res?.message || 'Gagal menghapus foto.');
      }
    } catch (err: any) {
      onAddToast(err?.message || 'Kesalahan server');
    } finally {
      setIsDeleting(false);
    }
  };

  const bounds = getBounds();
  const CS = stateRef.current.CS || 280;
  const ox = -bounds.minX;
  const oy = -bounds.minY;
  const cx = clamp(posX, bounds.minX, bounds.maxX);
  const cy = clamp(posY, bounds.minY, bounds.maxY);

  // Position percentage calculations (0% to 100%)
  const percentX = ox > 1 ? Math.round((-cx / ox) * 100) : 50;
  const percentY = oy > 1 ? Math.round((-cy / oy) * 100) : 50;

  // Limits for disabling D-pad buttons (photo moves towards button direction)
  const isLimLeft = ox <= 1 || cx <= bounds.minX + 0.5;
  const isLimRight = ox <= 1 || cx >= bounds.maxX - 0.5;
  const isLimUp = oy <= 1 || cy <= bounds.minY + 0.5;
  const isLimDown = oy <= 1 || cy >= bounds.maxY - 0.5;

  return (
    <div className="profile-crop-page-root" onKeyDown={onKeyDown}>
      {/* Top Header */}
      <header className="profile-top-bar">
        <div className="profile-top-left">
          <button
            type="button"
            className="profile-back-circle"
            onClick={() => onNavigate('profile')}
            aria-label="Kembali ke profile"
            title="Kembali ke Profile"
          >
            ←
          </button>
          <span className="profile-brand-title">Atur Crop Foto</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="profile-top-save-btn"
            style={{ background: '#dc2626' }}
            onClick={handleDeletePhoto}
            disabled={isDeleting}
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Foto'}
          </button>
          <button
            type="button"
            className="profile-top-save-btn"
            onClick={handleSaveCrop}
            disabled={isSavingCrop}
          >
            {isSavingCrop ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </header>

      {/* Main Cropper Container */}
      <main className="profile-shell-main" style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 48px' }}>
        <h1 className="profile-main-title" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          Edit &amp; Sesuaikan Foto Profil
        </h1>
        <p className="pc-hint-t" style={{ textAlign: 'center', marginBottom: '24px' }}>
          Seret foto atau pakai tombol arah untuk menggeser kanan, kiri, atas, dan bawah. Atur zoom, lalu klik Simpan Foto.
        </p>

        {/* Stage & 3 Previews */}
        <div className="pc-main" style={{ justifyContent: 'center' }}>
          <div
            className={`pc-stage ${isDragging ? 'pc-drag' : ''} ${isDragOver ? 'pc-over' : ''} ${hasInteracted ? 'pc-touched' : ''}`}
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Area crop foto profil. Seret untuk menggeser, tombol panah untuk mengatur posisi."
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
            {src ? (
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
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--pc-muted)' }}>
                Belum ada foto
              </div>
            )}
            <div className="pc-grid" />
            <div className="pc-ring" />
            <div className="pc-tip">Seret untuk menggeser</div>
            <div className="pc-dropmsg">Lepas foto di sini</div>
          </div>

          {/* 3 Lingkaran Pratinjau (L: 72px, M: 44px, S: 28px) */}
          <div className="pc-prevs" aria-hidden="true">
            <div className="pc-pv l">
              {src && (
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
              )}
            </div>
            <div className="pc-pv m">
              {src && (
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
              )}
            </div>
            <div className="pc-pv s">
              {src && (
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
              )}
            </div>
            <small>Pratinjau</small>
          </div>
        </div>

        {/* Panel Kontrol D-pad, Pan Sliders & Zoom */}
        <div className="pc-panels">
          {/* Panel Geser & Pan Sliders */}
          <section className="pc-panel" aria-label="Geser posisi foto">
            <h3>Geser Posisi</h3>
            <div className="pc-dpad">
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'up' ? 'pc-hold' : ''} ${isLimUp ? 'pc-lim' : ''}`}
                data-d="up"
                aria-label="Geser ke atas"
                aria-disabled={isLimUp}
                onPointerDown={(e) => handlePadPointerDown('up', e)}
                onPointerUp={(e) => handlePadPointerUp(e)}
                onPointerCancel={(e) => handlePadPointerUp(e)}
                onClick={() => handlePadClick('up')}
              >
                <svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg>
              </button>
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'left' ? 'pc-hold' : ''} ${isLimLeft ? 'pc-lim' : ''}`}
                data-d="left"
                aria-label="Geser ke kiri"
                aria-disabled={isLimLeft}
                onPointerDown={(e) => handlePadPointerDown('left', e)}
                onPointerUp={(e) => handlePadPointerUp(e)}
                onPointerCancel={(e) => handlePadPointerUp(e)}
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
                className={`pc-pad ${activePadDir === 'right' ? 'pc-hold' : ''} ${isLimRight ? 'pc-lim' : ''}`}
                data-d="right"
                aria-label="Geser ke kanan"
                aria-disabled={isLimRight}
                onPointerDown={(e) => handlePadPointerDown('right', e)}
                onPointerUp={(e) => handlePadPointerUp(e)}
                onPointerCancel={(e) => handlePadPointerUp(e)}
                onClick={() => handlePadClick('right')}
              >
                <svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg>
              </button>
              <button
                type="button"
                className={`pc-pad ${activePadDir === 'down' ? 'pc-hold' : ''} ${isLimDown ? 'pc-lim' : ''}`}
                data-d="down"
                aria-label="Geser ke bawah"
                aria-disabled={isLimDown}
                onPointerDown={(e) => handlePadPointerDown('down', e)}
                onPointerUp={(e) => handlePadPointerUp(e)}
                onPointerCancel={(e) => handlePadPointerUp(e)}
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

            {/* Slider Pan Kiri-Kanan & Atas-Bawah */}
            <div className="pc-pan-group">
              <div className="pc-pan-row">
                <span className="pc-pan-label">Kiri–Kanan</span>
                <button
                  type="button"
                  className="pc-pan-btn"
                  disabled={ox <= 1 || isLimLeft}
                  onClick={() => step(-STEP, 0)}
                  aria-label="Geser kiri"
                >
                  <svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg>
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
                  disabled={ox <= 1 || isLimRight}
                  onClick={() => step(STEP, 0)}
                  aria-label="Geser kanan"
                >
                  <svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg>
                </button>
                <output>{percentX}%</output>
              </div>

              <div className="pc-pan-row">
                <span className="pc-pan-label">Atas–Bawah</span>
                <button
                  type="button"
                  className="pc-pan-btn"
                  disabled={oy <= 1 || isLimUp}
                  onClick={() => step(0, -STEP)}
                  aria-label="Geser atas"
                >
                  <svg viewBox="0 0 24 24"><path d="m6 14 6-6 6 6" /></svg>
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
                  disabled={oy <= 1 || isLimDown}
                  onClick={() => step(0, STEP)}
                  aria-label="Geser bawah"
                >
                  <svg viewBox="0 0 24 24"><path d="m6 10 6 6 6-6" /></svg>
                </button>
                <output>{percentY}%</output>
              </div>
            </div>
          </section>

          {/* Panel Zoom & Orientasi */}
          <section className="pc-panel">
            <h3>Zoom Foto</h3>
            <div className="pc-zoom">
              <button
                type="button"
                className="pc-ico"
                disabled={zoom <= 1}
                onClick={() => updateZoom(zoom - 0.2, true)}
                aria-label="Perkecil zoom"
              >
                <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
              </button>
              <input
                id="zr"
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
                className="pc-ico"
                disabled={zoom >= 3}
                onClick={() => updateZoom(zoom + 0.2, true)}
                aria-label="Perbesar zoom"
              >
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <output id="zo">{Math.round(zoom * 100)}%</output>
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

        {/* Bottom Actions */}
        <div className="pc-actions" style={{ justifyContent: 'center', marginTop: '16px' }}>
          <label className="pc-b soft" htmlFor="pc-file-standalone" style={{ cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            Pilih Foto Baru
          </label>
          <input
            ref={fileInputRef}
            className="sr-only"
            id="pc-file-standalone"
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
              if (origSrc) {
                loadImage(origSrc);
                flashGrid();
              }
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className={`pc-b dark ${isSavingCrop ? 'pc-load' : ''}`}
            onClick={handleSaveCrop}
            disabled={isSavingCrop}
          >
            <span>{isSavingCrop ? 'Menyimpan...' : 'Simpan Foto'}</span>
            <i className="pc-spn" />
          </button>
        </div>
      </main>
    </div>
  );
};
