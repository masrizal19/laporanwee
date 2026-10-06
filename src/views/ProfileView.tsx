import React, { useState, useEffect, useRef } from 'react';
import { Project, Report, ViewType } from '../types';
import { API_BASE_URL, api } from '../utils/api';

interface ProfileViewProps {
  projects: Project[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
  userEmail: string;
  userName: string;
  avatarUrl?: string | null;
  onUpdateUser?: (updated: { email: string; name: string; avatar_url?: string }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  projects,
  reports,
  onNavigate,
  onSelectProject,
  onSelectReport,
  onAddToast,
  userEmail,
  userName,
  avatarUrl: initialAvatarUrl,
  onUpdateUser,
}) => {
  const [name, setName] = useState(userName || userEmail?.split('@')[0] || 'Pengguna LaporanWee');
  const [role, setRole] = useState('Anggota Tim Kreatif');
  const [email, setEmail] = useState(userEmail || 'user@laporanwee.agency');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null);

  // Crop tracking states
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageDims, setImageDims] = useState<{ width: number; height: number; baseScale: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Status texts for loading states
  const [statusText, setStatusText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Server crop result
  const [serverCropResult, setServerCropResult] = useState<{ file_name: string; crop_url: string } | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const imageDimsRef = useRef<{ width: number; height: number; baseScale: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const CONTAINER_SIZE = 300;

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    imageDimsRef.current = imageDims;
  }, [imageDims]);

  const computeMaxPan = (z: number, dims: { width: number; height: number; baseScale: number } | null) => {
    if (!dims) return { maxX: 0, maxY: 0 };
    const scaledW = dims.width * dims.baseScale * z;
    const scaledH = dims.height * dims.baseScale * z;
    const maxX = Math.max(0, (scaledW - CONTAINER_SIZE) / 2);
    const maxY = Math.max(0, (scaledH - CONTAINER_SIZE) / 2);
    return { maxX, maxY };
  };

  // Profile data fetcher - Source of Truth
  const fetchProfileData = async () => {
    try {
      const res = await api.get('/profile/get.php');
      if (res && res.success && res.data) {
        const p = res.data;
        if (p.full_name) setName(p.full_name);
        if (p.email) setEmail(p.email);
        if (p.role) setRole(p.role);
        
        // Cache busted profile photo URL
        if (p.avatar_url) {
          const avatarWithCache = `${p.avatar_url}${p.avatar_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
          setAvatarUrl(avatarWithCache);
        } else {
          setAvatarUrl(null);
        }

        // Restore crop settings from the settings table response
        const settings = p.crop_settings || p;
        if (settings.zoom || settings.crop_zoom) {
          const restoredZoom = Number(settings.zoom || settings.crop_zoom) || 1;
          setZoom(restoredZoom);
          zoomRef.current = restoredZoom;
        }
        if (settings.x !== undefined || settings.crop_x !== undefined) {
          const restoredX = Number(settings.x !== undefined ? settings.x : settings.crop_x) || 0;
          const restoredY = Number(settings.y !== undefined ? settings.y : settings.crop_y) || 0;
          setPosition({ x: restoredX, y: restoredY });
          positionRef.current = { x: restoredX, y: restoredY };
        }

        // Instantly sync localStorage so other app headers/navbars display updated name and picture
        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.name = p.full_name || parsed.name;
            parsed.avatar_url = p.avatar_url ? `${p.avatar_url}${p.avatar_url.includes('?') ? '&' : '?'}v=${Date.now()}` : null;
            localStorage.setItem('laporanwee_user', JSON.stringify(parsed));
          } catch (_) {}
        }

        // Call callback props
        if (onUpdateUser) {
          onUpdateUser({
            email: p.email || email,
            name: p.full_name || name,
            avatar_url: p.avatar_url ? `${p.avatar_url}${p.avatar_url.includes('?') ? '&' : '?'}v=${Date.now()}` : undefined
          });
        }
      }
    } catch (err: any) {
      console.warn('Gagal memuat data profil aktual:', err);
    }
  };

  // Fetch profile on mount
  useEffect(() => {
    fetchProfileData();
  }, []);

  const placeholder = () => {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="100%" height="100%" fill="#eee"/><circle cx="250" cy="200" r="90" fill="#ccc"/><path d="M110 470c25-110 95-155 140-155s115 45 140 155" fill="#ccc"/></svg>`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      loadFile(file);
      e.target.value = '';
    }
  };

  const loadFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onAddToast('Format file foto harus JPG, PNG, atau WEBP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onAddToast('Ukuran file foto maksimal 10 MB.');
      return;
    }

    setSelectedFile(file);
    const src = URL.createObjectURL(file);
    setRawImageSrc(src);

    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width <= 0 || height <= 0) return;

      const baseScale = Math.max(CONTAINER_SIZE / width, CONTAINER_SIZE / height);

      const newDims = { width, height, baseScale };
      setImageDims(newDims);
      imageDimsRef.current = newDims;
      setZoom(1);
      zoomRef.current = 1;
      setPosition({ x: 0, y: 0 });
      positionRef.current = { x: 0, y: 0 };
      setIsDragging(false);
      isDraggingRef.current = false;

      setServerCropResult(null);
      setStatusText('');
      setIsModalOpen(true);
    };
    img.onerror = () => {
      onAddToast('Gagal memuat foto profil untuk diatur.');
    };
    img.src = src;
  };

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(4, Math.round(nextZoom * 100) / 100));
    setZoom(clampedZoom);
    zoomRef.current = clampedZoom;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    const { maxX, maxY } = computeMaxPan(clampedZoom, dims);
    setPosition((prev) => {
      const nextX = Math.max(-maxX, Math.min(maxX, prev.x));
      const nextY = Math.max(-maxY, Math.min(maxY, prev.y));
      positionRef.current = { x: nextX, y: nextY };
      return { x: nextX, y: nextY };
    });
  };

  // Pointer Events for smooth drag across desktop mouse and touch (Pointer Capture)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!rawImageSrc) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const rawX = dragStartRef.current.initialX + dx;
    const rawY = dragStartRef.current.initialY + dy;

    const dims = imageDimsRef.current || (imgRef.current?.naturalWidth ? {
      width: imgRef.current.naturalWidth,
      height: imgRef.current.naturalHeight,
      baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
    } : null);

    if (dims) {
      const { maxX, maxY } = computeMaxPan(zoomRef.current, dims);
      const clampedX = Math.max(-maxX, Math.min(maxX, rawX));
      const clampedY = Math.max(-maxY, Math.min(maxY, rawY));

      setPosition({ x: clampedX, y: clampedY });
      positionRef.current = { x: clampedX, y: clampedY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleZoomChange(zoomRef.current + delta);
  };

  const handleResetCrop = () => {
    setZoom(1);
    zoomRef.current = 1;
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    isDraggingRef.current = false;
  };

  const handleProcessCrop = async () => {
    if (!selectedFile) {
      onAddToast('Pilih foto terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    setStatusText('Memproses crop di server...');

    try {
      const fd = new FormData();
      fd.append('avatar', selectedFile, selectedFile.name);
      fd.append('zoom', String(zoom));
      fd.append('x', String(position.x));
      fd.append('y', String(position.y));

      const res = await api.upload('/profile/crop.php', fd);

      if (res && res.success && res.data) {
        setServerCropResult(res.data);
        setStatusText('Crop server berhasil. Klik Simpan Profil untuk menulis data ke MySQL.');
      } else {
        throw new Error(res?.message || 'Proses crop gagal.');
      }
    } catch (err: any) {
      console.error('[API ERROR] Crop error:', err);
      setStatusText('Crop gagal: ' + (err.message || err));
      onAddToast(err.message || 'Gagal memproses crop.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSubmitting(true);
    setStatusText('Menyimpan profil ke MySQL...');

    try {
      const fd = new FormData();
      fd.append('full_name', name.trim());

      if (serverCropResult) {
        fd.append('crop_file', serverCropResult.file_name);
        fd.append('crop_url', serverCropResult.crop_url || (serverCropResult as any).file_url || '');
        fd.append('zoom', String(zoom));
        fd.append('x', String(position.x));
        fd.append('y', String(position.y));
      }

      const res = await api.upload('/profile/save.php', fd);

      if (res && res.success && res.data) {
        onAddToast('Profil berhasil disimpan!');
        setIsModalOpen(false);
        setServerCropResult(null);
        setStatusText('');

        // Re-fetch profile data from get.php to treat MySQL as Source of Truth
        await fetchProfileData();
      } else {
        throw new Error(res?.message || 'Gagal menyimpan profil.');
      }
    } catch (err: any) {
      console.error('[API ERROR] Save error:', err);
      setStatusText('Save gagal: ' + (err.message || err));
      onAddToast(err.message || 'Gagal menyimpan profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameRowClick = () => {
    const v = prompt('Nama lengkap:', name === '—' ? '' : name);
    if (v === null) return;
    const n = v.trim();
    if (!n) {
      alert('Nama tidak boleh kosong.');
      return;
    }
    setName(n);
    onAddToast('Nama diubah di UI. Klik Save di pojok kanan atas untuk menyimpan perubahan.');
  };

  const handleRoleRowClick = () => {
    const v = prompt('Jabatan / Title:', role);
    if (v === null) return;
    const r = v.trim();
    if (!r) return;
    setRole(r);
    onAddToast('Jabatan diubah di UI. Klik Save di pojok kanan atas untuk menyimpan perubahan.');
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus foto profil?')) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/profile/delete.php', {});
      if (res && res.success) {
        onAddToast('Foto profil berhasil dihapus.');
        setServerCropResult(null);
        
        // Re-fetch profile data from get.php to treat MySQL as Source of Truth
        await fetchProfileData();
      } else {
        throw new Error(res?.message || 'Gagal menghapus foto profil.');
      }
    } catch (err: any) {
      onAddToast(err.message || 'Terjadi kesalahan saat menghapus foto profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeDims = imageDims || (imgRef.current?.naturalWidth ? {
    width: imgRef.current.naturalWidth,
    height: imgRef.current.naturalHeight,
    baseScale: Math.max(CONTAINER_SIZE / imgRef.current.naturalWidth, CONTAINER_SIZE / imgRef.current.naturalHeight)
  } : null);

  const baseWidth = activeDims ? activeDims.width * activeDims.baseScale : CONTAINER_SIZE;
  const baseHeight = activeDims ? activeDims.height * activeDims.baseScale : CONTAINER_SIZE;

  return (
    <div className="profile-page-shell">
      <style>{`
        .profile-page-shell {
          --bg: #fff;
          --soft: #f6f6f7;
          --line: #e8e8ea;
          --text: #111;
          --muted: #777;
          --accent: #111;
          box-sizing: border-box;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
        }
        .profile-page-shell button, .profile-page-shell input {
          font: inherit;
        }
        .profile-page-shell button {
          border: 0;
          background: none;
          color: inherit;
          cursor: pointer;
        }
        .profile-page-shell .top {
          height: 72px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(10px);
        }
        .profile-page-shell .left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .profile-page-shell .brand {
          font-weight: 900;
          letter-spacing: -0.04em;
          font-size: 20px;
        }
        .profile-page-shell .back {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 300;
        }
        .profile-page-shell .back:hover {
          background: var(--soft);
        }
        .profile-page-shell .save {
          font-weight: 800;
          padding: 10px 14px;
          border-radius: 10px;
          background: var(--soft);
        }
        .profile-page-shell .save:hover {
          background: #e8e8ea;
        }
        .profile-page-shell .shell {
          width: min(980px, 100%);
          margin: auto;
          padding: 26px 26px 80px;
        }
        .profile-page-shell .title {
          font-size: clamp(38px, 6vw, 60px);
          font-weight: 900;
          letter-spacing: -0.06em;
          line-height: 1;
          margin: 8px 0 44px;
        }
        .profile-page-shell .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          padding-bottom: 44px;
          border-bottom: 1px solid var(--line);
        }
        .profile-page-shell .copy .kicker {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .profile-page-shell .copy h2 {
          font-size: 38px;
          letter-spacing: -0.05em;
          margin: 0 0 10px;
        }
        .profile-page-shell .copy p {
          color: var(--muted);
          line-height: 1.6;
          max-width: 460px;
          margin: 0;
        }
        .profile-page-shell .avatar-stage {
          display: flex;
          justify-content: center;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .profile-page-shell .avatar-wrap {
          position: relative;
          width: 220px;
          height: 220px;
        }
        .profile-page-shell .avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          background: #eee;
          border: 1px solid #ddd;
        }
        .profile-page-shell .edit-avatar {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #ddd;
          box-shadow: 0 8px 25px rgba(0,0,0,0.06);
          display: grid;
          place-items: center;
        }
        .profile-page-shell .edit-avatar:hover {
          transform: translateY(-1px);
        }
        .profile-page-shell .rows {
          padding-top: 12px;
        }
        .profile-page-shell .row {
          min-height: 96px;
          border-bottom: 1px solid var(--line);
          display: grid;
          grid-template-columns: 170px 1fr auto;
          align-items: center;
          gap: 18px;
        }
        .profile-page-shell .row.click {
          cursor: pointer;
        }
        .profile-page-shell .row.click:hover {
          background: #fafafa;
        }
        .profile-page-shell .label {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }
        .profile-page-shell .value {
          font-size: 17px;
        }
        .profile-page-shell .muted {
          color: var(--muted);
        }
        .profile-page-shell .arrow {
          font-size: 28px;
          font-weight: 300;
        }
        .profile-page-shell .btn {
          padding: 10px 14px;
          border-radius: 11px;
          font-weight: 800;
          border: 1px solid #ddd;
          background: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13px;
        }
        .profile-page-shell .btn:hover {
          background: var(--soft);
        }
        .profile-page-shell .btn.dark {
          background: #111;
          color: #fff;
          border-color: #111;
        }
        .profile-page-shell .btn.dark:hover {
          background: #222;
        }
        .profile-page-shell .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: none;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 9999;
        }
        .profile-page-shell .modal-bg.open {
          display: flex;
        }
        .profile-page-shell .modal {
          width: min(620px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: #fff;
          border-radius: 22px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.25);
        }
        .profile-page-shell .mh {
          padding: 20px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 3;
        }
        .profile-page-shell .mh h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
        }
        .profile-page-shell .x {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid var(--line);
          font-size: 22px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .profile-page-shell .x:hover {
          background: var(--soft);
        }
        .profile-page-shell .mb {
          padding: 20px 22px;
        }
        .profile-page-shell .hint {
          text-align: center;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 16px;
        }
        .profile-page-shell .crop-stage {
          display: flex;
          justify-content: center;
          padding: 4px 0 18px;
        }
        .profile-page-shell #crop {
          width: 300px;
          height: 300px;
          border-radius: 50%;
          overflow: hidden;
          position: relative;
          background: #111;
          border: 3px solid #111;
          cursor: grab;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        .profile-page-shell #crop.dragging {
          cursor: grabbing;
        }
        .profile-page-shell #img {
          position: absolute;
          left: 50%;
          top: 50%;
          max-width: none;
          max-height: none;
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          transform-origin: center center;
          will-change: transform;
          display: block;
        }
        .profile-page-shell .zoom {
          display: grid;
          grid-template-columns: 42px 1fr 42px 62px;
          gap: 10px;
          align-items: center;
        }
        .profile-page-shell .zbtn {
          width: 42px;
          height: 42px;
          border: 1px solid #ddd;
          border-radius: 11px;
          font-size: 20px;
          font-weight: 900;
          display: grid;
          place-items: center;
        }
        .profile-page-shell .zbtn:hover {
          background: var(--soft);
        }
        .profile-page-shell .zoom input {
          width: 100%;
          accent-color: #111;
        }
        .profile-page-shell .zval {
          text-align: center;
          font-size: 12px;
          font-weight: 900;
        }
        .profile-page-shell .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid var(--line);
        }
        .profile-page-shell .statusline {
          display: none;
          color: var(--muted);
          font-size: 13px;
          margin-top: 12px;
          text-align: center;
        }
        .profile-page-shell .statusline.show {
          display: block;
        }
        .profile-page-shell .result {
          display: none;
          margin-top: 18px;
          border: 1px solid var(--line);
          background: #fafafa;
          border-radius: 15px;
          padding: 15px;
          text-align: center;
        }
        .profile-page-shell .result.show {
          display: block;
        }
        .profile-page-shell .result img {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #111;
          margin: 12px auto;
          display: block;
        }
        .profile-page-shell .meta {
          font-size: 12px;
          line-height: 1.5;
          color: var(--muted);
          word-break: break-word;
          margin-bottom: 12px;
        }
        @media(max-width: 820px) {
          .profile-page-shell .hero {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .profile-page-shell .copy {
            text-align: center;
          }
          .profile-page-shell .copy p {
            margin: auto;
          }
          .profile-page-shell .row {
            grid-template-columns: 120px 1fr auto;
          }
        }
        @media(max-width: 600px) {
          .profile-page-shell .top {
            height: 64px;
            padding: 0 14px;
          }
          .profile-page-shell .shell {
            padding: 16px 16px 60px;
          }
          .profile-page-shell .title {
            font-size: 38px;
            margin: 12px 0 32px;
          }
          .profile-page-shell .avatar-wrap {
            width: 175px;
            height: 175px;
          }
          .profile-page-shell .hero {
            padding-bottom: 30px;
          }
          .profile-page-shell .copy h2 {
            font-size: 28px;
          }
          .profile-page-shell .row {
            grid-template-columns: 1fr auto;
            padding: 17px 0;
            gap: 6px;
          }
          .profile-page-shell .label {
            grid-column: 1/-1;
          }
          .profile-page-shell .value {
            grid-column: 1;
          }
          .profile-page-shell .arrow {
            grid-column: 2;
            grid-row: 2;
          }
          .profile-page-shell .modal {
            border-radius: 18px;
          }
          .profile-page-shell .mb {
            padding: 16px;
          }
          .profile-page-shell .zoom {
            grid-template-columns: 40px 1fr 40px 55px;
          }
          .profile-page-shell #crop {
            width: 260px;
            height: 260px;
          }
        }
      `}</style>

      <header className="top">
        <div className="left">
          <button className="back" onClick={() => onNavigate('dashboard')} aria-label="Kembali">‹</button>
          <div className="brand">LaporanWee</div>
        </div>
        <button className="save" id="topSave" onClick={handleSaveProfile} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </header>

      <main className="shell">
        <h1 className="title">Edit Profile</h1>
        
        <section className="hero">
          <div className="copy">
            <div className="kicker">Profile Photo</div>
            <h2 id="displayName">{name}</h2>
            <p>Versi web dari desain mobile. Foto dapat dipilih, digeser, di-zoom, di-crop di server, lalu disimpan ke database MySQL.</p>
          </div>
          <div className="avatar-stage">
            <div className="avatar-wrap">
              <img
                id="avatar"
                className="avatar"
                alt="Foto Profil"
                src={avatarUrl || placeholder()}
              />
              <button
                id="editAvatar"
                className="edit-avatar"
                aria-label="Edit foto"
                onClick={() => document.getElementById('file-input-trigger')?.click()}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="m14.5 7.5 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {avatarUrl && (
              <button
                className="btn"
                style={{ borderColor: '#ff4d4f', color: '#ff4d4f', marginTop: '6px' }}
                onClick={handleDeleteAvatar}
                disabled={isSubmitting}
              >
                Hapus Foto Profil
              </button>
            )}
          </div>
        </section>

        <section className="rows">
          <div className="row click" id="nameRow" onClick={handleNameRowClick}>
            <div className="label">Name</div>
            <div className="value" id="name">{name}</div>
            <div className="arrow">›</div>
          </div>
          <div className="row">
            <div className="label">Email</div>
            <div className="value muted" id="email">{email}</div>
            <div className="arrow">›</div>
          </div>
          <div className="row click" onClick={handleRoleRowClick}>
            <div className="label">Title</div>
            <div className="value muted" id="role">{role}</div>
            <div className="arrow">›</div>
          </div>
          <div className="row">
            <div className="label">Location</div>
            <div className="value muted">LaporanWee Web</div>
            <div className="arrow">›</div>
          </div>
        </section>

        <input
          id="file-input-trigger"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          hidden
        />
      </main>

      {/* Embedded Crop Modal aligned 100% with the design of test-crop-profile.html */}
      <div className={`modal-bg ${isModalOpen ? 'open' : ''}`} id="modal" onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsModalOpen(false);
          setServerCropResult(null);
          setStatusText('');
        }
      }}>
        <div className="modal" role="dialog" aria-modal="true">
          <div className="mh">
            <h3>Atur Crop Foto</h3>
            <button className="x" id="close" onClick={() => {
              setIsModalOpen(false);
              setServerCropResult(null);
              setStatusText('');
            }}>×</button>
          </div>
          <div className="mb">
            <p className="hint">Geser foto di dalam lingkaran. Gunakan slider, tombol −/+, atau scroll mouse untuk zoom.</p>
            
            <div className="crop-stage">
              <div
                id="crop"
                className={isDragging ? 'dragging' : ''}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onWheel={handleWheel}
              >
                {rawImageSrc && (
                  <img
                    ref={imgRef}
                    id="img"
                    alt="Crop Preview"
                    draggable={false}
                    src={rawImageSrc}
                    style={{
                      width: `${baseWidth}px`,
                      height: `${baseHeight}px`,
                      transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0) scale(${zoom})`,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="zoom">
              <button className="zbtn" id="minus" onClick={() => handleZoomChange(zoom - 0.1)}>−</button>
              <input
                id="slider"
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              />
              <button className="zbtn" id="plus" onClick={() => handleZoomChange(zoom + 0.1)}>+</button>
              <div className="zval" id="zval">{Math.round(zoom * 100)}%</div>
            </div>

            <div className="actions">
              <button className="btn" id="choose" onClick={() => document.getElementById('file-input-trigger')?.click()}>Pilih Foto</button>
              <button className="btn" id="reset" onClick={handleResetCrop}>Reset</button>
              <button className="btn dark" id="process" onClick={handleProcessCrop} disabled={isSubmitting}>
                {isSubmitting && statusText.includes('Memproses') ? 'Memproses...' : 'Proses Crop'}
              </button>
            </div>

            <div id="status" className={`statusline ${statusText ? 'show' : ''}`}>{statusText}</div>

            {serverCropResult && (
              <div id="result" className="result show">
                <strong>Hasil Crop Server</strong>
                <img
                  id="resultImg"
                  alt="Hasil Crop"
                  src={`${serverCropResult.crop_url || (serverCropResult as any).file_url}?v=${Date.now()}`}
                />
                <div id="meta" className="meta">
                  400 × 400 JPEG &bull; zoom {zoom.toFixed(2)} &bull; x {position.x.toFixed(2)} &bull; y {position.y.toFixed(2)}
                </div>
                <div className="actions">
                  <button className="btn dark" id="saveProfile" onClick={handleSaveProfile} disabled={isSubmitting}>
                    Simpan Profil
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
