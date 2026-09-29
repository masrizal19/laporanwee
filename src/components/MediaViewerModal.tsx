import React, { useEffect, useRef } from 'react';
import { TaskDocument, ProjectDocument } from '../types';
import { Icon } from './icons';

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

  if (!isOpen || documents.length === 0) return null;

  const currentDoc = documents[currentIndex] || documents[0];
  const isVideo = currentDoc.file_type === 'video';

  return (
    <div
      className="media-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Dokumentasi Pekerjaan"
    >
      <div
        className="media-viewer-content"
        onClick={(e) => e.stopPropagation()}
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

          <div className="media-display-container">
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
              >
                Browser Anda tidak mendukung pemutar video HTML5.
              </video>
            ) : (
              <img
                src={currentDoc.file_url}
                alt={currentDoc.file_name}
                className="media-image-display"
              />
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
