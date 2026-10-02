import React, { useState, useEffect, useRef } from 'react';
import { TaskDocument, ProjectDocument } from '../types';
import { Icon } from './icons';
import { API_BASE_URL } from '../utils/api';

interface MediaViewerModalProps {
  isOpen: boolean;
  documents: Array<TaskDocument | ProjectDocument>;
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  documents,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentIndex < documents.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, documents.length, onClose, onNavigate]);

  // Pause video if user navigates or closes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [currentIndex, isOpen]);

  const currentDoc = documents[currentIndex] || documents[0];
  const isVideo = currentDoc?.file_type === 'video';

  // Use original.php endpoint if document has an id, preserving pristine file resolution
  const originalFileUrl = currentDoc?.id
    ? `${API_BASE_URL}/project-documents/original.php?id=${currentDoc.id}`
    : currentDoc?.file_url || '';

  // Stable key based on document id: key={`preview-${document.id}`}
  const stableKey = currentDoc?.id ? `preview-${currentDoc.id}` : `preview-${currentIndex}`;

  // Reset loaded indicator when navigating documents
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex, originalFileUrl]);

  if (!isOpen || documents.length === 0) return null;

  return (
    <div
      className="media-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Dokumentasi Pekerjaan"
      data-motion="none"
    >
      <div
        className="media-viewer-content"
        onClick={(e) => e.stopPropagation()}
        data-motion="none"
      >
        {/* Header Bar */}
        <div className="media-viewer-header">
          <div className="media-header-meta">
            <span className="media-type-badge">
              <Icon name={isVideo ? 'video' : 'image'} style={{ width: 14, height: 14 }} />
              <span>{isVideo ? 'Video Dokumentasi' : 'Foto Dokumentasi'}</span>
            </span>
            <div className="media-file-info">
              <span className="media-filename" title={currentDoc.file_name}>
                {currentDoc.file_name}
              </span>
              <span className="media-meta-sub">
                {currentDoc.file_size_formatted && (
                  <>
                    <span>{currentDoc.file_size_formatted}</span>
                    <span className="dot-sep">&bull;</span>
                  </>
                )}
                {currentDoc.uploader_name && (
                  <>
                    <span>{currentDoc.uploader_name}</span>
                    <span className="dot-sep">&bull;</span>
                  </>
                )}
                <span>{currentDoc.created_at}</span>
              </span>
            </div>
          </div>

          <div className="media-header-actions">
            {originalFileUrl && (
              <a
                href={originalFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="media-ext-link"
                title="Buka file asli di tab baru"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  textDecoration: 'none',
                  marginRight: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <Icon name="link" style={{ width: 13, height: 13 }} />
                <span>Buka Asli</span>
              </a>
            )}

            {documents.length > 1 && (
              <span className="media-counter">
                {currentIndex + 1} / {documents.length}
              </span>
            )}
            <button
              type="button"
              className="media-close-btn"
              onClick={onClose}
              title="Tutup (Esc)"
              aria-label="Tutup"
            >
              <Icon name="x" style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Media Frame */}
        <div className="media-viewer-viewport">
          {documents.length > 1 && (
            <button
              type="button"
              className="media-nav-btn prev"
              disabled={currentIndex <= 0}
              onClick={() => onNavigate(currentIndex - 1)}
              title="Dokumentasi Sebelumnya"
              aria-label="Dokumentasi Sebelumnya"
            >
              <Icon name="chevL" style={{ width: 18, height: 18 }} />
            </button>
          )}

          <div className="media-display-container" data-motion="none">
            {isVideo ? (
              <video
                ref={videoRef}
                key={currentDoc.file_url}
                src={currentDoc.file_url}
                controls
                playsInline
                autoPlay={false}
                muted={true}
                className="media-video-player"
                data-motion="none"
              >
                Browser Anda tidak mendukung pemutar video HTML5.
              </video>
            ) : (
              <>
                {!imageLoaded && (
                  <div className="lightbox-image-loading" data-motion="none">
                    <div className="lightbox-spinner" />
                  </div>
                )}
                <img
                  key={stableKey}
                  src={originalFileUrl}
                  alt={('original_name' in currentDoc ? currentDoc.original_name : currentDoc.file_name) || currentDoc.file_name}
                  className="media-image-display"
                  data-motion="none"
                  loading="eager"
                  decoding="async"
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 220px)',
                    objectFit: 'contain',
                    imageRendering: 'auto',
                    transform: 'none',
                  }}
                />
              </>
            )}
          </div>

          {documents.length > 1 && (
            <button
              type="button"
              className="media-nav-btn next"
              disabled={currentIndex >= documents.length - 1}
              onClick={() => onNavigate(currentIndex + 1)}
              title="Dokumentasi Selanjutnya"
              aria-label="Dokumentasi Selanjutnya"
            >
              <Icon name="chevR" style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* Strip Navigation for Multiple Files */}
        {documents.length > 1 && (
          <div className="media-viewer-strip">
            {documents.map((doc, idx) => (
              <button
                key={doc.id}
                type="button"
                className={`media-strip-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => onNavigate(idx)}
                title={doc.file_name}
              >
                {doc.file_type === 'video' ? (
                  <div className="media-strip-video-thumb">
                    {doc.thumbnail_url ? (
                      <img src={doc.thumbnail_url} alt={doc.file_name} />
                    ) : (
                      <div className="media-strip-placeholder">
                        <Icon name="video" style={{ width: 14, height: 14 }} />
                      </div>
                    )}
                    <span className="strip-play-badge">
                      <Icon name="play" style={{ width: 10, height: 10 }} />
                    </span>
                  </div>
                ) : (
                  <img
                    src={doc.thumbnail_url || doc.file_url}
                    alt={doc.file_name}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
