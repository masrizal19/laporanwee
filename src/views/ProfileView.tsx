import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ViewType } from '../types';
import {
  profileService,
  extractAvatarFromResponse,
  getAbsoluteAvatarUrl,
  withAvatarCacheBust,
  syncAuthenticatedUser,
} from '../utils/api';
import '../profile-edit.css';

interface ProfileViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  projects?: any[];
  reports?: any[];
  onSelectProject?: (id: string) => void;
  onSelectReport?: (id: string) => void;
  onUpdateUser?: (updated: {
    email: string;
    name: string;
    avatar_url?: string | null;
    profile_title?: string;
    profile_location?: string;
  }) => void;
}

const STAT_OPTIONS = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];
const JOB_OPTIONS = ['Art Director', 'Desainer Grafis', 'Videografer', 'Copywriter', 'Social Media'];

// Generates pastel initials canvas data URL
function generateInitialsAvatar(name: string): string {
  try {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 480;
    const g = c.getContext('2d');
    if (!g) return '';
    const gr = g.createLinearGradient(0, 0, 480, 480);
    gr.addColorStop(0, '#cfc6f4');
    gr.addColorStop(0.55, '#e3ddfa');
    gr.addColorStop(1, '#d4ee6b');
    g.fillStyle = gr;
    g.fillRect(0, 0, 480, 480);

    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath();
    g.arc(360, 120, 140, 0, 7);
    g.fill();

    g.fillStyle = 'rgba(143,127,224,.35)';
    g.beginPath();
    g.arc(90, 420, 170, 0, 7);
    g.fill();

    g.fillStyle = '#2a2440';
    g.font = '500 190px Outfit, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const initial = (name.trim()[0] || 'P').toUpperCase();
    g.fillText(initial, 240, 262);
    return c.toDataURL('image/jpeg', 0.92);
  } catch (_) {
    return '';
  }
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onNavigate,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  // Committed / Backend State
  const [savedName, setSavedName] = useState<string>(userName || 'Admin');
  const [savedEmail, setSavedEmail] = useState<string>(userEmail || 'admin@gmail.com');
  const [savedJob, setSavedJob] = useState<string>('');
  const [savedStatus, setSavedStatus] = useState<string>('');
  const [currentAvatar, setCurrentAvatar] = useState<string>('');
  const [hasCustomPhoto, setHasCustomPhoto] = useState<boolean>(false);

  // Form Input States
  const [inputName, setInputName] = useState<string>(userName || 'Admin');
  const [inputEmail, setInputEmail] = useState<string>(userEmail || 'admin@gmail.com');
  const [inputJob, setInputJob] = useState<string>('');
  const [inputStatus, setInputStatus] = useState<string>('');

  // Form Validation & Errors
  const [nameError, setNameError] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<boolean>(false);

  // Loading States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPhotoSaving, setIsPhotoSaving] = useState<boolean>(false);
  const [isPopActive, setIsPopActive] = useState<boolean>(false);

  // Theme Mode State
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('laporanwee_theme') || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  });

  const handleToggleTheme = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem('laporanwee_theme', mode);
      localStorage.setItem('theme', mode);
    } catch (_) {}
  };

  // Modal / Crop Editor States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalImageSrc, setModalImageSrc] = useState<string>('');
  const [origImageSrc, setOrigImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [cropWidth, setCropWidth] = useState<number>(260);
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);
  const [baseScale, setBaseScale] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGridActive, setIsGridActive] = useState<boolean>(false);

  // Refs for Crop interaction
  const cropRef = useRef<HTMLDivElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const prevLRef = useRef<HTMLImageElement | null>(null);
  const prevMRef = useRef<HTMLImageElement | null>(null);
  const prevSRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; initZoom: number } | null>(null);
  const lastPtrRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const animFrameRef = useRef<number | null>(null);
  const gridTimeoutRef = useRef<any>(null);

  // Initialize Avatar
  useEffect(() => {
    if (initialAvatarUrl) {
      const abs = getAbsoluteAvatarUrl(initialAvatarUrl);
      setCurrentAvatar(withAvatarCacheBust(abs));
      setHasCustomPhoto(true);
    } else {
      const generated = generateInitialsAvatar(userName || 'Admin');
      setCurrentAvatar(generated);
      setHasCustomPhoto(false);
    }
  }, [initialAvatarUrl, userName]);

  // Fetch real profile data from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchBackendProfile = async () => {
      try {
        const res = await profileService.getProfile();
        if (!isMounted) return;
        if (res && (res.success || res.status === 'success') && res.data) {
          const d = res.data;
          const freshName = d.full_name || d.name || userName || 'Admin';
          const freshEmail = d.email || userEmail || 'admin@gmail.com';
          const freshJob = d.profile_title || d.title || d.job || '';
          const freshStatus = d.profile_location || d.status || d.location || '';

          setSavedName(freshName);
          setInputName(freshName);
          setSavedEmail(freshEmail);
          setInputEmail(freshEmail);
          setSavedJob(freshJob);
          setInputJob(freshJob);
          setSavedStatus(freshStatus);
          setInputStatus(freshStatus);

          const rawAvatar = extractAvatarFromResponse(res);
          if (rawAvatar) {
            const abs = getAbsoluteAvatarUrl(rawAvatar);
            const busted = withAvatarCacheBust(abs, d.updated_at || Date.now());
            setCurrentAvatar(busted);
            setHasCustomPhoto(true);
          }
        }
      } catch (err) {
        console.warn('[ProfileView] Backend load error, using local session:', err);
      }
    };

    fetchBackendProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Dirty state
  const isDirty = useMemo(() => {
    return (
      inputName.trim() !== savedName.trim() ||
      inputEmail.trim() !== savedEmail.trim() ||
      inputJob.trim() !== savedJob.trim() ||
      inputStatus.trim() !== savedStatus.trim()
    );
  }, [inputName, inputEmail, inputJob, inputStatus, savedName, savedEmail, savedJob, savedStatus]);

  // Compute Completion percentage
  const completionPercentage = useMemo(() => {
    let count = 0;
    if (hasCustomPhoto || currentAvatar) count++;
    if (inputName.trim()) count++;
    if (inputEmail.trim()) count++;
    if (inputJob.trim()) count++;
    if (inputStatus.trim()) count++;
    return count * 20;
  }, [hasCustomPhoto, currentAvatar, inputName, inputEmail, inputJob, inputStatus]);

  // Trigger grid flash on crop
  const flashGrid = useCallback(() => {
    setIsGridActive(true);
    if (gridTimeoutRef.current) clearTimeout(gridTimeoutRef.current);
    gridTimeoutRef.current = setTimeout(() => {
      setIsGridActive(false);
    }, 900);
  }, []);

  // Clamp and Draw crop transform
  const updateCropTransform = useCallback(
    (curPanX: number, curPanY: number, curZoom: number) => {
      const CS = cropWidth || 260;
      const effectiveBase = baseScale || 1;
      const s = effectiveBase * curZoom;
      const w = naturalWidth * s;
      const h = naturalHeight * s;

      const clampedX = Math.min(0, Math.max(CS - w, curPanX));
      const clampedY = Math.min(0, Math.max(CS - h, curPanY));

      setPanX(clampedX);
      setPanY(clampedY);

      if (cropImgRef.current) {
        cropImgRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px) scale(${s})`;
      }

      // Update 3 preview circular images
      [
        { ref: prevLRef, size: 64 },
        { ref: prevMRef, size: 40 },
        { ref: prevSRef, size: 26 },
      ].forEach(({ ref, size }) => {
        if (ref.current) {
          const r = size / CS;
          ref.current.style.transform = `translate(${clampedX * r}px, ${clampedY * r}px) scale(${s * r})`;
        }
      });
    },
    [cropWidth, baseScale, naturalWidth, naturalHeight]
  );

  // Load image into editor
  const loadModalImage = useCallback(
    (src: string, keepPosition = false) => {
      setModalImageSrc(src);
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || 480;
        const nh = img.naturalHeight || 480;
        const CS = cropRef.current ? cropRef.current.clientWidth : 260;
        const base = CS / Math.min(nw, nh);

        setNaturalWidth(nw);
        setNaturalHeight(nh);
        setCropWidth(CS);
        setBaseScale(base);

        let initialZoom = 1;
        let initialX = (CS - nw * base) / 2;
        let initialY = (CS - nh * base) / 2;

        if (keepPosition) {
          initialZoom = zoom;
          initialX = panX;
          initialY = panY;
        } else {
          setZoom(1);
        }

        updateCropTransform(initialX, initialY, initialZoom);
      };
      img.src = src;
    },
    [updateCropTransform, zoom, panX, panY]
  );

  // Open modal editor
  const handleOpenEditor = () => {
    setIsModalOpen(true);
    setOrigImageSrc(currentAvatar);
    setTimeout(() => {
      loadModalImage(currentAvatar);
      if (cropRef.current) {
        cropRef.current.focus({ preventScroll: true });
      }
    }, 60);
  };

  // Close modal editor
  const handleCloseEditor = () => {
    setIsModalOpen(false);
  };

  // Nudge pan with button or keyboard
  const nudgePan = (dx: number, dy: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    updateCropTransform(panX + dx, panY + dy, zoom);
    flashGrid();
  };

  // Change zoom with center anchor
  const changeZoom = (newZoomRaw: number) => {
    const CS = cropWidth || 260;
    const nz = Math.min(3, Math.max(1, newZoomRaw));
    const effectiveBase = baseScale || 1;
    const cx = (CS / 2 - panX) / (effectiveBase * zoom);
    const cy = (CS / 2 - panY) / (effectiveBase * zoom);

    const nextPanX = CS / 2 - cx * effectiveBase * nz;
    const nextPanY = CS / 2 - cy * effectiveBase * nz;

    setZoom(nz);
    updateCropTransform(nextPanX, nextPanY, nz);
    flashGrid();
  };

  // Pointer drag event handlers for Crop box
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (pointerMapRef.current.size === 1) {
      lastPtrRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
      velocityRef.current = { vx: 0, vy: 0 };
      setIsDragging(true);
    }

    if (pointerMapRef.current.size === 2) {
      const pts = Array.from(pointerMapRef.current.values());
      pinchRef.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        initZoom: zoom,
      };
    }
    flashGrid();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerMapRef.current.has(e.pointerId)) return;
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointerMapRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointerMapRef.current.values());
      const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scaleFactor = curDist / (pinchRef.current.dist || 1);
      changeZoom(pinchRef.current.initZoom * scaleFactor);
      return;
    }

    if (pointerMapRef.current.size === 1 && lastPtrRef.current) {
      const now = performance.now();
      const dx = e.clientX - lastPtrRef.current.x;
      const dy = e.clientY - lastPtrRef.current.y;
      const dt = Math.max(1, now - lastPtrRef.current.time);

      velocityRef.current = {
        vx: (dx / dt) * 16,
        vy: (dy / dt) * 16,
      };

      lastPtrRef.current = { x: e.clientX, y: e.clientY, time: now };
      updateCropTransform(panX + dx, panY + dy, zoom);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerMapRef.current.delete(e.pointerId);
    pinchRef.current = null;

    if (pointerMapRef.current.size === 0) {
      setIsDragging(false);
      lastPtrRef.current = null;

      // Inertia decay
      let curVx = velocityRef.current.vx;
      let curVy = velocityRef.current.vy;
      let curX = panX;
      let curY = panY;

      const tick = () => {
        curVx *= 0.92;
        curVy *= 0.92;
        if (Math.abs(curVx) < 0.15 && Math.abs(curVy) < 0.15) return;
        curX += curVx;
        curY += curVy;
        updateCropTransform(curX, curY, zoom);
        animFrameRef.current = requestAnimationFrame(tick);
      };

      if (Math.hypot(curVx, curVy) > 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }
  };

  // Keyboard navigation on crop area
  const handleKeyDownCrop = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const s = e.shiftKey ? 30 : 10;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudgePan(s, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudgePan(-s, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nudgePan(0, s);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nudgePan(0, -s);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      changeZoom(zoom + 0.1);
    } else if (e.key === '-') {
      e.preventDefault();
      changeZoom(zoom - 0.1);
    }
  };

  // Wheel zoom
  const handleWheelCrop = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    changeZoom(zoom + (e.deltaY < 0 ? 0.08 : -0.08));
  };

  // Rotate & Flip image (Bake transformation)
  const bakeImage = (rotate: boolean) => {
    if (!cropImgRef.current) return;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return;

    const nw = naturalWidth;
    const nh = naturalHeight;
    c.width = rotate ? nh : nw;
    c.height = rotate ? nw : nh;

    g.translate(c.width / 2, c.height / 2);
    if (rotate) {
      g.rotate(-Math.PI / 2);
    } else {
      g.scale(-1, 1);
    }
    g.drawImage(cropImgRef.current, -nw / 2, -nh / 2);
    const newSrc = c.toDataURL('image/jpeg', 0.95);
    loadModalImage(newSrc, false);
  };

  // File Picker change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      onAddToast('File harus berupa gambar (JPG/PNG/WebP).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      onAddToast('Ukuran foto maksimal 10 MB.');
      return;
    }

    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      setOrigImageSrc(result);
      loadModalImage(result, false);
    };
    r.readAsDataURL(f);
  };

  // Save Cropped Photo
  const handleSavePhoto = async () => {
    if (!cropImgRef.current) return;
    setIsPhotoSaving(true);

    try {
      const o = document.createElement('canvas');
      o.width = 512;
      o.height = 512;
      const g = o.getContext('2d');
      if (!g) throw new Error('Canvas context not available');

      const CS = cropWidth || 260;
      const k = 512 / CS;
      const s = (baseScale || 1) * zoom;

      g.drawImage(
        cropImgRef.current,
        0,
        0,
        naturalWidth,
        naturalHeight,
        panX * k,
        panY * k,
        naturalWidth * s * k,
        naturalHeight * s * k
      );

      const croppedDataUrl = o.toDataURL('image/jpeg', 0.92);

      // Convert canvas to File for backend upload
      const blob = await new Promise<Blob | null>((resolve) =>
        o.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      let serverAvatarUrl = croppedDataUrl;

      if (blob) {
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        try {
          const res = await profileService.uploadPhoto(file);
          if (res && (res.success || res.status === 'success')) {
            const raw = extractAvatarFromResponse(res);
            if (raw) {
              serverAvatarUrl = withAvatarCacheBust(getAbsoluteAvatarUrl(raw));
            }
          }
        } catch (uploadErr) {
          console.warn('[ProfileView] Photo upload fallback to local state:', uploadErr);
        }
      }

      setCurrentAvatar(serverAvatarUrl);
      setHasCustomPhoto(true);

      // Trigger pop animation
      setIsPopActive(true);
      setTimeout(() => setIsPopActive(false), 700);

      // Sync across app shell
      syncAuthenticatedUser({
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: serverAvatarUrl,
      });

      if (onUpdateUser) {
        onUpdateUser({
          name: inputName.trim(),
          email: inputEmail.trim(),
          profile_title: inputJob.trim(),
          profile_location: inputStatus.trim(),
          avatar_url: serverAvatarUrl,
        });
      }

      setIsModalOpen(false);
      onAddToast('Foto profil disimpan');
    } catch (err) {
      console.error('[ProfileView] Save photo error:', err);
      onAddToast('Gagal memproses foto profil');
    } finally {
      setIsPhotoSaving(false);
    }
  };

  // Save Profile Form Data (Name, Email, Job, Status)
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let valid = true;
    if (!inputName.trim()) {
      setNameError(true);
      valid = false;
    } else {
      setNameError(false);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!inputEmail.trim() || !emailRegex.test(inputEmail.trim())) {
      setEmailError(true);
      valid = false;
    } else {
      setEmailError(false);
    }

    if (!valid) {
      onAddToast('Periksa kembali isian Anda.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        full_name: inputName.trim(),
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: currentAvatar,
      };

      // Call backend save
      await profileService.saveProfile(payload);
      try {
        await profileService.updateName(inputName.trim());
      } catch (_) {}

      setSavedName(inputName.trim());
      setSavedEmail(inputEmail.trim());
      setSavedJob(inputJob.trim());
      setSavedStatus(inputStatus.trim());

      // Sync user in localStorage and parent state
      syncAuthenticatedUser({
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: currentAvatar,
      });

      if (onUpdateUser) {
        onUpdateUser({
          name: inputName.trim(),
          email: inputEmail.trim(),
          profile_title: inputJob.trim(),
          profile_location: inputStatus.trim(),
          avatar_url: currentAvatar,
        });
      }

      onAddToast('Profil disimpan');
    } catch (err: any) {
      console.warn('[ProfileView] Save profile error:', err);
      // Still apply locally so user experience is not broken
      setSavedName(inputName.trim());
      setSavedEmail(inputEmail.trim());
      setSavedJob(inputJob.trim());
      setSavedStatus(inputStatus.trim());

      syncAuthenticatedUser({
        name: inputName.trim(),
        email: inputEmail.trim(),
        profile_title: inputJob.trim(),
        profile_location: inputStatus.trim(),
        avatar_url: currentAvatar,
      });

      if (onUpdateUser) {
        onUpdateUser({
          name: inputName.trim(),
          email: inputEmail.trim(),
          profile_title: inputJob.trim(),
          profile_location: inputStatus.trim(),
          avatar_url: currentAvatar,
        });
      }

      onAddToast('Profil disimpan');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel / Revert changes
  const handleCancel = () => {
    setInputName(savedName);
    setInputEmail(savedEmail);
    setInputJob(savedJob);
    setInputStatus(savedStatus);
    setNameError(false);
    setEmailError(false);
    onAddToast('Perubahan dibatalkan');
  };

  // Calculate stroke dashoffset for ring (circumference = 553)
  const ringOffset = 553 * (1 - completionPercentage / 100);

  // Compute slider percentages for display
  const effectiveW = naturalWidth * (baseScale || 1) * zoom - (cropWidth || 260);
  const effectiveH = naturalHeight * (baseScale || 1) * zoom - (cropWidth || 260);
  const canPanX = effectiveW > 1;
  const canPanY = effectiveH > 1;

  const panXPercent = canPanX ? Math.round((-panX / effectiveW) * 100) : 50;
  const panYPercent = canPanY ? Math.round((-panY / effectiveH) * 100) : 50;

  return (
    <>
      {/* Profile Top Bar */}
      <header className="profile-bar">
        <div
          className="brand"
          onClick={() => onNavigate('dashboard')}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          title="Kembali ke Dashboard"
        >
          <b>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
              <path d="M5 13c3-6 11-6 14 0M8 17c2-3 6-3 8 0" />
            </svg>
          </b>
          <span>
            Laporan<span>Wee</span>
          </span>
        </div>
        <div className="sp1" />

        {/* Theme Switcher Sliding Pill */}
        <div className="theme" role="group" aria-label="Tema">
          <div className="knob" />
          <button
            type="button"
            data-t="light"
            onClick={() => handleToggleTheme('light')}
            aria-label="Terang"
            title="Mode Terang"
            className={themeMode === 'light' ? 'active' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
          <button
            type="button"
            data-t="dark"
            onClick={() => handleToggleTheme('dark')}
            aria-label="Gelap"
            title="Mode Gelap"
            className={themeMode === 'dark' ? 'active' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
            </svg>
          </button>
        </div>

        {/* Top Simpan Profil Button */}
        <button
          type="button"
          className={`btn dark hide-s ${isSaving ? 'load' : ''}`}
          id="save"
          onClick={() => handleSaveProfile()}
          disabled={isSaving}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.500 10 17.500 19 7" />
          </svg>
          <span>Simpan Profil</span>
          <i className="sp" />
        </button>
      </header>

      {/* Main Wrap Layout */}
      <main className="profile-layout profile-wrap" id="profileMain">
        {/* Left Aside Card: Foto Profil */}
        <aside className="card rv" style={{ '--i': 0 } as React.CSSProperties}>
          <div className="inner pc">
            <div className="pwrap">
              <svg className="pr" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#c2e04a" />
                    <stop offset="1" stopColor="#8f7fe0" />
                  </linearGradient>
                </defs>
                <circle className="a" cx="100" cy="100" r="88" />
                <circle
                  className="b"
                  id="ring"
                  cx="100"
                  cy="100"
                  r="88"
                  style={{ strokeDashoffset: ringOffset }}
                />
              </svg>

              <div
                className={`pimg ${isPopActive ? 'pop' : ''}`}
                id="pimg"
                role="button"
                tabIndex={0}
                aria-label="Ubah foto profil"
                onClick={handleOpenEditor}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenEditor();
                  }
                }}
              >
                <img
                  id="avimg"
                  src={currentAvatar || generateInitialsAvatar(inputName)}
                  alt="Foto Profil"
                />
              </div>

              <button
                type="button"
                className="pen"
                id="pen"
                aria-label="Edit foto profil"
                onClick={handleOpenEditor}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />
                </svg>
              </button>

              <span className="pct" id="pct">
                {completionPercentage}%
              </span>
            </div>

            <div className="eyebrow">Foto Profil</div>
            <h1 id="hname">{inputName.trim() || 'Pengguna'}</h1>
            <p className="sub" style={{ maxWidth: '30ch', marginInline: 'auto' }}>
              Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.
            </p>

            <div className="chips">
              <span className="chip lime" id="cDone">
                Profil {completionPercentage}% lengkap
              </span>
              <span className="chip" id="cJob">
                {inputJob.trim() || 'Pekerjaan belum diatur'}
              </span>
              <span className="chip lav" id="cStat">
                {inputStatus || 'Status belum dipilih'}
              </span>
            </div>

            <button
              type="button"
              className="btn dark"
              id="openEd"
              style={{ width: '100%' }}
              onClick={handleOpenEditor}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="9" cy="10" r="2" />
                <path d="m21 16-5-5-8 8" />
              </svg>
              <span>Ubah Foto</span>
            </button>
          </div>
        </aside>

        {/* Right Section Card: Informasi Profil */}
        <section className="card rv" style={{ '--i': 1 } as React.CSSProperties}>
          <div className="inner">
            <div className="fh">
              <div>
                <div className="eyebrow">Pengaturan</div>
                <h2 style={{ marginTop: '6px', fontSize: '26px' }}>Informasi Profil</h2>
                <p className="sub">Ubah data yang tampil di akun Anda.</p>
              </div>
              <span className={`dirty ${isDirty ? 'on' : ''}`} id="dirty">
                <i />
                Perubahan belum disimpan
              </span>
            </div>

            <form id="form" noValidate onSubmit={handleSaveProfile}>
              {/* Field Name */}
              <div
                className={`f ${nameError ? 'bad' : ''}`}
                style={{ '--j': 0 } as React.CSSProperties}
              >
                <input
                  id="fn"
                  placeholder=" "
                  autoComplete="name"
                  value={inputName}
                  onChange={(e) => {
                    setInputName(e.target.value);
                    if (nameError) setNameError(false);
                    if (!hasCustomPhoto) {
                      setCurrentAvatar(generateInitialsAvatar(e.target.value));
                    }
                  }}
                />
                <label htmlFor="fn">Name</label>
                <div className="err">Name wajib diisi.</div>
              </div>

              {/* Field Email */}
              <div
                className={`f ${emailError ? 'bad' : ''}`}
                style={{ '--j': 1 } as React.CSSProperties}
              >
                <input
                  id="fe"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={inputEmail}
                  onChange={(e) => {
                    setInputEmail(e.target.value);
                    if (emailError) setEmailError(false);
                  }}
                />
                <label htmlFor="fe">Email</label>
                <div className="err">Masukkan alamat email yang valid.</div>
              </div>

              {/* Field Pekerjaan */}
              <div className="f" style={{ '--j': 2 } as React.CSSProperties}>
                <input
                  id="fj"
                  placeholder=" "
                  autoComplete="organization-title"
                  value={inputJob}
                  onChange={(e) => setInputJob(e.target.value)}
                />
                <label htmlFor="fj">Pekerjaan</label>
              </div>

              {/* Quick Job Chips */}
              <div className="opts" id="jobs" style={{ '--j': 3, margin: '-4px 0 0' } as React.CSSProperties}>
                {JOB_OPTIONS.map((j) => (
                  <button
                    key={j}
                    type="button"
                    className={`opt ${inputJob === j ? 'on' : ''}`}
                    onClick={() => setInputJob(j)}
                  >
                    {j}
                  </button>
                ))}
              </div>

              {/* Group Label Status */}
              <div className="gl" style={{ '--j': 4 } as React.CSSProperties}>
                STATUS
              </div>

              {/* Quick Status Chips */}
              <div
                className="opts"
                id="stat"
                role="radiogroup"
                aria-label="Status"
                style={{ '--j': 5 } as React.CSSProperties}
              >
                {STAT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={inputStatus === s}
                    className={`opt ${inputStatus === s ? 'on' : ''}`}
                    onClick={() => setInputStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Form Action Buttons */}
              <div className="fa" style={{ '--j': 6 } as React.CSSProperties}>
                <button
                  type="button"
                  className="btn soft"
                  id="cancel"
                  onClick={handleCancel}
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className={`btn dark ${isSaving ? 'load' : ''}`}
                  id="save2"
                  disabled={isSaving}
                >
                  <span>Simpan Profil</span>
                  <i className="sp" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* Modal / Sheet Overlay for Foto Profil */}
      <div
        className={`ov ${isModalOpen ? 'show' : ''}`}
        id="ov"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseEditor();
        }}
      >
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
          <div className="grab" />
          <div className="mh">
            <h2 id="mt">Edit Foto Profil</h2>
            <button
              type="button"
              className="x"
              id="mx"
              aria-label="Tutup"
              onClick={handleCloseEditor}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <p className="hint">
            Gunakan foto yang ada atau pilih foto baru. Geser untuk mengatur posisi, atur zoom, lalu klik Simpan Foto.
          </p>

          <div className="stagewrap">
            {/* Interactive Crop Stage */}
            <div
              className={`crop ${isDragging ? 'drag' : ''} ${isGridActive ? 'act' : ''}`}
              id="crop"
              ref={cropRef}
              tabIndex={0}
              role="application"
              aria-label="Area crop. Gunakan tombol panah untuk menggeser, plus dan minus untuk zoom."
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheelCrop}
              onKeyDown={handleKeyDownCrop}
            >
              <img
                id="cimg"
                ref={cropImgRef}
                src={modalImageSrc || currentAvatar}
                alt="Pratinjau Crop"
                draggable={false}
              />
              <div className="grid" />
              <div className="ring" />
            </div>

            {/* Live 3 Previews */}
            <div className="prevs" aria-hidden="true">
              <div className="pv l">
                <img ref={prevLRef} src={modalImageSrc || currentAvatar} alt="" />
              </div>
              <div className="pv m">
                <img ref={prevMRef} src={modalImageSrc || currentAvatar} alt="" />
              </div>
              <div className="pv s">
                <img ref={prevSRef} src={modalImageSrc || currentAvatar} alt="" />
              </div>
              <small>Pratinjau</small>
            </div>
          </div>

          {/* Tools: Putar & Balik */}
          <div className="tools">
            <button
              type="button"
              className="tl"
              id="rl"
              onClick={() => bakeImage(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9a8 8 0 1 1-1 5M4 4v5h5" />
              </svg>
              Putar
            </button>
            <button
              type="button"
              className="tl"
              id="fl"
              onClick={() => bakeImage(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" />
              </svg>
              Balik
            </button>
          </div>

          {/* Slider Controls */}
          {/* Zoom */}
          <div className="ctl">
            <span>Zoom</span>
            <button
              type="button"
              className="z"
              id="zm"
              aria-label="Perkecil"
              disabled={zoom <= 1}
              onClick={() => changeZoom(zoom - 0.15)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
            <input
              id="zr"
              type="range"
              min="100"
              max="300"
              value={Math.round(zoom * 100)}
              aria-label="Zoom"
              onChange={(e) => changeZoom(Number(e.target.value) / 100)}
            />
            <button
              type="button"
              className="z"
              id="zp"
              aria-label="Perbesar"
              disabled={zoom >= 3}
              onClick={() => changeZoom(zoom + 0.15)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <output id="zo">{Math.round(zoom * 100)}%</output>
          </div>

          {/* Kiri-Kanan */}
          <div className="ctl">
            <span>Kiri–Kanan</span>
            <button
              type="button"
              className="z"
              id="gl"
              aria-label="Geser ke kiri"
              disabled={!canPanX}
              onClick={() => nudgePan(18, 0)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <input
              id="hx"
              type="range"
              min="0"
              max="100"
              value={panXPercent}
              aria-label="Geser kiri atau kanan"
              disabled={!canPanX}
              onChange={(e) => {
                const percent = Number(e.target.value) / 100;
                const nextX = -percent * effectiveW;
                updateCropTransform(nextX, panY, zoom);
                flashGrid();
              }}
            />
            <button
              type="button"
              className="z"
              id="gr"
              aria-label="Geser ke kanan"
              disabled={!canPanX}
              onClick={() => nudgePan(-18, 0)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
            <output id="xo">{panXPercent}%</output>
          </div>

          {/* Atas-Bawah */}
          <div className="ctl">
            <span>Atas–Bawah</span>
            <button
              type="button"
              className="z"
              id="gu"
              aria-label="Geser ke atas"
              disabled={!canPanY}
              onClick={() => nudgePan(0, 18)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 14 6-6 6 6" />
              </svg>
            </button>
            <input
              id="vy"
              type="range"
              min="0"
              max="100"
              value={panYPercent}
              aria-label="Geser atas atau bawah"
              disabled={!canPanY}
              onChange={(e) => {
                const percent = Number(e.target.value) / 100;
                const nextY = -percent * effectiveH;
                updateCropTransform(panX, nextY, zoom);
                flashGrid();
              }}
            />
            <button
              type="button"
              className="z"
              id="gd"
              aria-label="Geser ke bawah"
              disabled={!canPanY}
              onClick={() => nudgePan(0, -18)}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 10 6 6 6-6" />
              </svg>
            </button>
            <output id="yo">{panYPercent}%</output>
          </div>

          {/* Modal Actions */}
          <div className="mact">
            <label className="btn soft full" htmlFor="file" style={{ cursor: 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              <span>Pilih Foto Baru</span>
            </label>
            <input
              id="file"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr"
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="btn soft"
              id="rst"
              onClick={() => loadModalImage(origImageSrc, false)}
            >
              Reset
            </button>

            <button
              type="button"
              className={`btn dark ${isPhotoSaving ? 'load' : ''}`}
              id="sph"
              disabled={isPhotoSaving}
              onClick={handleSavePhoto}
            >
              <span>Simpan Foto</span>
              <i className="sp" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default ProfileView;
