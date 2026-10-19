import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProjectDocument, DailyReportFile } from '../types';
import { API_BASE_URL, normalizeFileUrl } from '../utils/api';

export interface GalleryItem {
  id: string | number;
  name: string;
  size: number;
  url: string;
  thumb?: string;
  videoURL?: string;
  file?: File;
  kind: 'image' | 'video' | 'doc';
  ext: string;
  cls: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  progress?: number;
  speedText?: string;
  errorMsg?: string;
  rawDoc?: ProjectDocument | DailyReportFile;
}

export interface ProjectAttachmentsGalleryProps {
  documents: (ProjectDocument | DailyReportFile | any)[];
  title?: string;
  subtitle?: string;
  pillText?: string;
  editable?: boolean;
  onUploadFile?: (file: File) => Promise<any> | void;
  onDeleteFile?: (fileItem: { id: string | number; name: string; filename?: string }) => Promise<void> | void;
  onAddToast?: (text: string) => void;
  className?: string;
}

const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp'];
const VID_EXTS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];
const CLS_MAP: Record<string, string> = {
  pdf: 'k-pdf',
  doc: 'k-doc',
  docx: 'k-doc',
  xls: 'k-xls',
  xlsx: 'k-xls',
  csv: 'k-xls',
  ppt: 'k-ppt',
  pptx: 'k-ppt',
  zip: 'k-zip',
  rar: 'k-zip',
  '7z': 'k-zip',
  tar: 'k-zip',
  gz: 'k-zip',
};

export const describeFile = (name: string, mime: string = '') => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  let kind: 'image' | 'video' | 'doc' = 'doc';
  const cleanMime = (mime || '').toLowerCase();

  if (cleanMime.startsWith('image/') || IMG_EXTS.includes(ext)) {
    kind = 'image';
  } else if (cleanMime.startsWith('video/') || VID_EXTS.includes(ext)) {
    kind = 'video';
  }

  return {
    ext: ext || 'FILE',
    kind,
    cls: CLS_MAP[ext] || 'k-file',
  };
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
};

export const ProjectAttachmentsGallery: React.FC<ProjectAttachmentsGalleryProps> = ({
  documents,
  title = 'Lampiran & Berkas Proyek',
  subtitle = 'Foto, video, dan dokumen pendukung laporan kerja. Ukuran maksimal 2 GB per file.',
  pillText = 'Lampiran & Berkas',
  editable = true,
  onUploadFile,
  onDeleteFile,
  onAddToast,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'doc'>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeUploads, setActiveUploads] = useState<GalleryItem[]>([]);
  const [uploadTrackerItems, setUploadTrackerItems] = useState<GalleryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map server documents into GalleryItem format
  const serverItems: GalleryItem[] = useMemo(() => {
    if (!Array.isArray(documents)) return [];
    return documents.map((doc, idx) => {
      const fileName =
        doc.original_name ||
        doc.file_name ||
        doc.filename ||
        doc.name ||
        `Berkas #${idx + 1}`;
      const mime = doc.mime_type || doc.type || '';
      const d = describeFile(fileName, mime);
      const rawUrl =
        doc.file_url ||
        doc.url ||
        doc.preview_url ||
        `${API_BASE_URL}/project-documents/original.php?id=${doc.id}`;
      const normUrl = normalizeFileUrl(rawUrl);
      const sizeNum = Number(doc.file_size || doc.size) || 0;

      return {
        id: doc.id || `doc_${idx}`,
        name: fileName,
        size: sizeNum,
        url: normUrl,
        thumb: d.kind === 'image' ? normUrl : undefined,
        videoURL: d.kind === 'video' ? normUrl : undefined,
        kind: d.kind,
        ext: d.ext,
        cls: d.cls,
        status: 'success' as const,
        rawDoc: doc,
      };
    });
  }, [documents]);

  // Combined items: active uploads and successfully uploaded items, then server items without duplicate names/ids
  const allItems: GalleryItem[] = useMemo(() => {
    const serverNameSet = new Set(serverItems.map((s) => s.name));
    const activeFiltered = activeUploads.filter((up) => {
      if (up.status === 'success' && serverNameSet.has(up.name)) {
        return false;
      }
      return true;
    });
    return [...activeFiltered, ...serverItems];
  }, [activeUploads, serverItems]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const c = { all: 0, image: 0, video: 0, doc: 0 };
    allItems.forEach((it) => {
      c.all++;
      c[it.kind]++;
    });
    return c;
  }, [allItems]);

  // Visible items based on active filter
  const visibleItems = useMemo(() => {
    return allItems.filter((it) => filter === 'all' || it.kind === filter);
  }, [allItems, filter]);

  // Lightbox items (only successful items currently visible)
  const lbItems = useMemo(() => {
    return visibleItems.filter((it) => it.status === 'success');
  }, [visibleItems]);

  const openLightbox = (item: GalleryItem) => {
    if (item.status !== 'success') return;
    if (item.kind === 'doc' && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const idx = lbItems.findIndex((it) => String(it.id) === String(item.id));
    if (idx !== -1) {
      setLightboxIndex(idx);
    } else {
      setLightboxIndex(0);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const stepLightbox = (delta: number) => {
    if (lightboxIndex === null || lbItems.length === 0) return;
    const nextIdx = (lightboxIndex + delta + lbItems.length) % lbItems.length;
    setLightboxIndex(nextIdx);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, lbItems]);

  // Upload handler with realistic progress simulation & direct backend call
  const handleAddFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

    fileList.forEach((file) => {
      const d = describeFile(file.name, file.type);
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const thumb = d.kind === 'image' ? URL.createObjectURL(file) : undefined;
      const videoURL = d.kind === 'video' ? URL.createObjectURL(file) : undefined;

      const uploadItem: GalleryItem = {
        id: uploadId,
        name: file.name,
        size: file.size,
        file,
        url: thumb || videoURL || '',
        thumb,
        videoURL,
        kind: d.kind,
        ext: d.ext,
        cls: d.cls,
        status: file.size > MAX_SIZE ? 'error' : 'uploading',
        progress: 0,
        speedText: 'Menyiapkan…',
        errorMsg: file.size > MAX_SIZE ? 'Ukuran melebihi 2 GB' : undefined,
      };

      if (file.size > MAX_SIZE) {
        onAddToast?.(`File "${file.name}" ditolak. Ukuran maksimal 2 GB per file.`);
        setActiveUploads((prev) => [uploadItem, ...prev]);
        setUploadTrackerItems((prev) => [uploadItem, ...prev]);
        return;
      }

      setActiveUploads((prev) => [uploadItem, ...prev]);
      setUploadTrackerItems((prev) => [uploadItem, ...prev]);

      // Start upload process
      let progress = 0;
      const startTime = Date.now();
      const step = Math.max(file.size / 30, 45000);

      const timer = setInterval(() => {
        progress = Math.min(100, progress + Math.round((step / file.size) * 100 * (0.8 + Math.random() * 0.4)));
        const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.2);
        const bytesLoaded = Math.min(file.size, Math.round((progress / 100) * file.size));
        const speedFormatted = `${formatFileSize(bytesLoaded / elapsedSec)}/s • ${formatFileSize(bytesLoaded)} / ${formatFileSize(file.size)}`;

        if (progress >= 100) {
          clearInterval(timer);
          setActiveUploads((prev) =>
            prev.map((it) =>
              it.id === uploadId
                ? {
                    ...it,
                    progress: 100,
                    status: 'processing',
                    speedText: 'Memproses di server…',
                  }
                : it
            )
          );
          setUploadTrackerItems((prev) =>
            prev.map((it) =>
              it.id === uploadId
                ? {
                    ...it,
                    progress: 100,
                    status: 'processing',
                    speedText: 'Memproses di server…',
                  }
                : it
            )
          );

          // Invoke real backend upload if provided
          if (onUploadFile) {
            Promise.resolve(onUploadFile(file))
              .then((result) => {
                const finalUrl = result?.file_url || result?.url || (result as any)?.url;
                setActiveUploads((prev) =>
                  prev.map((it) =>
                    it.id === uploadId
                      ? {
                          ...it,
                          status: 'success',
                          url: finalUrl || it.url,
                          speedText: 'Tersimpan di server',
                        }
                      : it
                  )
                );
                setUploadTrackerItems((prev) =>
                  prev.map((it) =>
                    it.id === uploadId
                      ? {
                          ...it,
                          status: 'success',
                          url: finalUrl || it.url,
                          speedText: 'Tersimpan di server',
                        }
                      : it
                  )
                );
                onAddToast?.(`✓ Berkas "${file.name}" berhasil diunggah.`);
              })
              .catch((err) => {
                console.warn('Upload error:', err);
                setActiveUploads((prev) =>
                  prev.map((it) =>
                    it.id === uploadId
                      ? {
                          ...it,
                          status: 'error',
                          errorMsg: err?.message || 'Gagal menyimpan berkas di server',
                        }
                      : it
                  )
                );
                setUploadTrackerItems((prev) =>
                  prev.map((it) =>
                    it.id === uploadId
                      ? {
                          ...it,
                          status: 'error',
                          errorMsg: err?.message || 'Gagal menyimpan berkas di server',
                        }
                      : it
                  )
                );
                onAddToast?.(`Gagal mengunggah "${file.name}": ${err?.message || 'Kesalahan server'}`);
              });
          } else {
            // Local fallback simulation
            setTimeout(() => {
              setActiveUploads((prev) =>
                prev.map((it) =>
                  it.id === uploadId
                    ? {
                        ...it,
                        status: 'success',
                        speedText: 'Tersimpan',
                      }
                    : it
                )
              );
              setUploadTrackerItems((prev) =>
                prev.map((it) =>
                  it.id === uploadId
                    ? {
                        ...it,
                        status: 'success',
                        speedText: 'Tersimpan',
                      }
                    : it
                )
              );
              onAddToast?.(`✓ Berkas "${file.name}" ditambahkan.`);
            }, 800);
          }
        } else {
          setActiveUploads((prev) =>
            prev.map((it) =>
              it.id === uploadId
                ? {
                    ...it,
                    progress,
                    speedText: speedFormatted,
                  }
                : it
            )
          );
          setUploadTrackerItems((prev) =>
            prev.map((it) =>
              it.id === uploadId
                ? {
                    ...it,
                    progress,
                    speedText: speedFormatted,
                  }
                : it
            )
          );
        }
      }, 150);
    });
  };

  const handleCancelUpload = (uploadId: string | number) => {
    setActiveUploads((prev) => prev.filter((it) => it.id !== uploadId));
    setUploadTrackerItems((prev) => prev.filter((it) => it.id !== uploadId));
    onAddToast?.('Pengunggahan berkas dibatalkan.');
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: GalleryItem) => {
    e.stopPropagation();
    if (deletingId !== null) return;

    if (item.file && item.status !== 'success') {
      handleCancelUpload(item.id);
      return;
    }

    if (!onDeleteFile) {
      onAddToast?.('Aksi hapus tidak diizinkan pada mode ini.');
      return;
    }

    setDeletingId(item.id);
    try {
      await onDeleteFile({
        id: item.id,
        name: item.name,
        filename: (item.rawDoc as any)?.filename || item.name,
      });
    } catch (err: any) {
      console.warn('Delete gallery file notice:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const activeLbItem = lightboxIndex !== null && lbItems[lightboxIndex] ? lbItems[lightboxIndex] : null;

  return (
    <div className={`bento-board ${className}`}>
      {/* Board Header */}
      <header className="bento-board-head">
        <div>
          <span className="bento-pill">{pillText}</span>
          <h2 className="bento-title">{title}</h2>
        </div>
        <p className="bento-head-note">{subtitle}</p>
      </header>

      {/* Toolbar: Category Filters & Add Button */}
      <div className="bento-toolbar">
        <div className="bento-filters" role="tablist" aria-label="Filter berkas">
          <button
            type="button"
            className={`bento-f ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span>Semua</span>
            <small>{counts.all}</small>
          </button>
          <button
            type="button"
            className={`bento-f ${filter === 'image' ? 'on' : ''}`}
            onClick={() => setFilter('image')}
          >
            <span>Gambar</span>
            <small>{counts.image}</small>
          </button>
          <button
            type="button"
            className={`bento-f ${filter === 'video' ? 'on' : ''}`}
            onClick={() => setFilter('video')}
          >
            <span>Video</span>
            <small>{counts.video}</small>
          </button>
          <button
            type="button"
            className={`bento-f ${filter === 'doc' ? 'on' : ''}`}
            onClick={() => setFilter('doc')}
          >
            <span>Dokumen</span>
            <small>{counts.doc}</small>
          </button>
        </div>

        {editable && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleAddFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              className="bento-btn-add"
              onClick={() => fileInputRef.current?.click()}
            >
              + Tambah File
            </button>
          </div>
        )}
      </div>

      {/* Upload Process CSS Loader & Real-Time Status Tracker */}
      {uploadTrackerItems.length > 0 && (
        <div className="upload-tracker-panel" aria-live="polite">
          <div className="upload-tracker-head">
            <div className="upload-tracker-title">
              <span
                className={`upload-tracker-pulse ${
                  uploadTrackerItems.some(
                    (i) => i.status === 'uploading' || i.status === 'processing'
                  )
                    ? ''
                    : 'is-done'
                }`}
              />
              <span>
                {uploadTrackerItems.some(
                  (i) => i.status === 'uploading' || i.status === 'processing'
                )
                  ? 'Sedang Mengunggah Berkas ke Server…'
                  : 'Riwayat Berkas Berhasil Diunggah'}
              </span>
              <span
                className="upload-tracker-badge badge-uploading"
                style={{ fontSize: '11px', marginLeft: '4px' }}
              >
                {uploadTrackerItems.filter((i) => i.status === 'success').length} /{' '}
                {uploadTrackerItems.length} Selesai
              </span>
            </div>
            {uploadTrackerItems.some((i) => i.status === 'success') && (
              <button
                type="button"
                className="upload-tracker-clear-btn"
                onClick={() =>
                  setUploadTrackerItems((prev) =>
                    prev.filter((i) => i.status !== 'success')
                  )
                }
              >
                Bersihkan Riwayat Selesai
              </button>
            )}
          </div>

          <div className="upload-tracker-list">
            {uploadTrackerItems.map((item) => (
              <div
                key={item.id}
                className={`upload-tracker-item ${
                  item.status === 'success'
                    ? 'is-success'
                    : item.status === 'error'
                    ? 'is-error'
                    : 'is-uploading'
                }`}
              >
                <div className={`upload-tracker-ext ${item.cls}`}>
                  {item.ext}
                </div>
                <div className="upload-tracker-body">
                  <div className="upload-tracker-title-row">
                    <span className="upload-tracker-filename" title={item.name}>
                      {item.name}
                    </span>
                    <span
                      className={`upload-tracker-badge ${
                        item.status === 'uploading'
                          ? 'badge-uploading'
                          : item.status === 'processing'
                          ? 'badge-processing'
                          : item.status === 'success'
                          ? 'badge-success'
                          : 'badge-error'
                      }`}
                    >
                      {item.status === 'uploading' && `Mengunggah ${item.progress || 0}%`}
                      {item.status === 'processing' && 'Memproses di Server…'}
                      {item.status === 'success' && '✓ Berhasil Diunggah'}
                      {item.status === 'error' && (item.errorMsg || 'Gagal')}
                    </span>
                  </div>

                  <div className="upload-tracker-bar-bg">
                    <div
                      className={`upload-tracker-bar-fill ${
                        item.status === 'processing'
                          ? 'fill-processing'
                          : item.status === 'success'
                          ? 'fill-success'
                          : ''
                      }`}
                      style={{
                        width: `${
                          item.status === 'processing' ? 100 : item.progress || 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="upload-tracker-meta">
                    <span>
                      {formatFileSize(item.size)}{' '}
                      {item.speedText ? `• ${item.speedText}` : ''}
                    </span>
                    <span>
                      {item.status === 'success' ? 'Tersedia di galeri' : ''}
                    </span>
                  </div>
                </div>

                <div className="upload-tracker-actions">
                  {item.status === 'success' && (
                    <button
                      type="button"
                      className="upload-tracker-action-btn"
                      title="Pratinjau di Lightbox"
                      onClick={() => openLightbox(item)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="upload-tracker-action-btn del-btn"
                    title="Tutup status"
                    onClick={() => {
                      setUploadTrackerItems((prev) =>
                        prev.filter((i) => i.id !== item.id)
                      );
                      if (item.status !== 'success') {
                        handleCancelUpload(item.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bento Grid Layout (6 columns with 7-slot repeating pattern) */}
      <section
        className={`bento-grid ${isDragOver ? 'is-dragover' : ''}`}
        aria-live="polite"
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
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
          if (editable && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleAddFiles(e.dataTransfer.files);
          }
        }}
      >
        {visibleItems.map((item, idx) => {
          const slot = idx % 7;
          const isDeleting = deletingId !== null && String(deletingId) === String(item.id);
          const stateClass =
            item.status === 'uploading'
              ? 'is-uploading'
              : item.status === 'processing'
              ? 'is-processing'
              : item.status === 'error'
              ? 'is-error'
              : 'is-success';

          return (
            <figure
              key={item.id}
              className={`bento-tile ${stateClass} ${isDeleting ? 'is-leaving' : ''}`}
              data-slot={slot}
              style={{ '--i': idx } as React.CSSProperties}
              tabIndex={0}
              onClick={() => openLightbox(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openLightbox(item);
              }}
            >
              {/* Tile Media (Image, Video, or Doc Face) */}
              <div className="bento-tile-media">
                {item.kind === 'image' ? (
                  <img
                    src={item.thumb || item.url}
                    alt={item.name}
                    loading="lazy"
                  />
                ) : item.kind === 'video' ? (
                  <>
                    <video
                      src={item.videoURL ? `${item.videoURL}#t=0.5` : undefined}
                      preload="metadata"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => {
                        const target = e.currentTarget;
                        target.play().catch(() => {});
                      }}
                      onMouseLeave={(e) => {
                        const target = e.currentTarget;
                        target.pause();
                      }}
                    />
                    <span className="bento-play">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <div className={`bento-doc-face ${item.cls}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5M9 13h6M9 17h6" />
                    </svg>
                    <span className="bento-doc-ext">{item.ext.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Shade Overlay */}
              <div className="bento-tile-shade" />

              {/* Top-Right Hover Action Buttons */}
              <div className="bento-tile-actions">
                <button
                  type="button"
                  className="bento-act act-open"
                  title="Buka / Pratinjau"
                  aria-label="Buka"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLightbox(item);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </button>
                {editable && (
                  <button
                    type="button"
                    className="bento-act bento-act-del"
                    title={isDeleting ? 'Menghapus...' : 'Hapus'}
                    aria-label="Hapus"
                    disabled={isDeleting}
                    onClick={(e) => handleDeleteItem(e, item)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Bottom Caption */}
              <figcaption className="bento-caption">
                <b className="bento-name" title={item.name}>
                  {item.name}
                </b>
                <span className="bento-meta">
                  {formatFileSize(item.size)} &bull;{' '}
                  {item.kind === 'image'
                    ? 'Gambar'
                    : item.kind === 'video'
                    ? 'Video'
                    : item.ext.toUpperCase()}
                </span>
              </figcaption>

              {/* Interactive Uploading / Processing / Error State Overlay */}
              <div className="bento-tile-state">
                <div className="bento-st-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h6" />
                  </svg>
                </div>
                <div className="bento-st-name" title={item.name}>
                  {item.name}
                </div>
                <div className="bento-st-line">
                  <span className="bento-spinner" />
                  <span>
                    {item.status === 'uploading'
                      ? `Mengunggah… ${item.progress || 0}%`
                      : item.status === 'processing'
                      ? 'Memproses di server…'
                      : item.status === 'error'
                      ? item.errorMsg || 'Gagal mengunggah'
                      : 'Tersimpan'}
                  </span>
                </div>
                <div className="bento-progress">
                  <div
                    className="bento-progress-bar"
                    style={{ width: `${item.progress || 0}%` }}
                  />
                </div>
                <div className="bento-state-sub">
                  {item.status === 'error'
                    ? 'Periksa koneksi lalu coba lagi'
                    : item.speedText || ''}
                </div>
                {item.status !== 'success' && (
                  <div className="bento-state-btns">
                    {item.status === 'error' ? (
                      <>
                        {item.file && (
                          <button
                            type="button"
                            className="bento-sbtn retry"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.file) handleAddFiles([item.file]);
                              handleCancelUpload(item.id);
                            }}
                          >
                            Coba Lagi
                          </button>
                        )}
                        <button
                          type="button"
                          className="bento-sbtn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelUpload(item.id);
                          }}
                        >
                          Hapus ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="bento-sbtn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelUpload(item.id);
                        }}
                      >
                        Batal ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            </figure>
          );
        })}

        {/* Tile Add Dropzone (Interactive Drag-Drop / File Picker) */}
        {editable && (
          <button
            type="button"
            className={`bento-tile-add ${visibleItems.length === 0 ? 'is-empty' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="bento-plus">+</span>
            <span>
              Seret berkas ke sini
              <br />
              atau klik untuk memilih
            </span>
          </button>
        )}
      </section>

      {/* Lightbox Modal */}
      {activeLbItem && (
        <div
          className="bento-lb"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau berkas"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="bento-lb-nav bento-lb-close"
            aria-label="Tutup"
            onClick={closeLightbox}
          >
            ✕
          </button>

          {lbItems.length > 1 && (
            <>
              <button
                type="button"
                className="bento-lb-nav bento-lb-prev"
                aria-label="Sebelumnya"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="bento-lb-nav bento-lb-next"
                aria-label="Berikutnya"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(1);
                }}
              >
                ›
              </button>
            </>
          )}

          <div className="bento-lb-stage" onClick={(e) => e.stopPropagation()}>
            <div id="lbMedia">
              {activeLbItem.kind === 'image' ? (
                <img
                  src={activeLbItem.thumb || activeLbItem.url}
                  alt={activeLbItem.name}
                  className="bento-lb-media"
                />
              ) : activeLbItem.kind === 'video' ? (
                <video
                  src={activeLbItem.videoURL || activeLbItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="bento-lb-media"
                />
              ) : (
                <div className={`bento-lb-doc ${activeLbItem.cls}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h6" />
                  </svg>
                  <b>{activeLbItem.ext.toUpperCase()}</b>
                </div>
              )}
            </div>

            <div className="bento-lb-cap">
              <div>
                <strong>{activeLbItem.name}</strong>
                <span>
                  {formatFileSize(activeLbItem.size)} &bull;{' '}
                  {lightboxIndex !== null ? lightboxIndex + 1 : 1} dari {lbItems.length}
                </span>
              </div>
              {activeLbItem.url && (
                <a
                  className="bento-lb-link"
                  href={activeLbItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={activeLbItem.name}
                >
                  <span>Buka di tab baru ↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
