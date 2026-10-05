import React, { useState, useEffect } from 'react';
import { Icon } from './icons';
import { API_BASE_URL } from '../utils/api';

interface ImageLightboxProps {
  isOpen: boolean;
  images: string[];
  documents?: Array<{ id?: number | string; original_name?: string; [key: string]: any }>;
  documentIds?: Array<number | string>;
  currentIndex: number;
  title?: string;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

/**
 * Returns original full-resolution image URL, stripping any thumbnail downscaling parameters
 */
const getOriginalImageUrl = (url?: string): string => {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();

  // If it's an Unsplash placeholder with small width parameter, request high resolution
  if (clean.includes('images.unsplash.com') && (clean.includes('w=100') || clean.includes('w=400') || clean.includes('w=600'))) {
    return clean.replace(/w=\d+/, 'w=1920').replace(/q=\d+/, 'q=95');
  }

  // Backend uploads or direct URLs: return pristine original file URL
  return clean;
};

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  images,
  documents,
  documentIds,
  currentIndex,
  title,
  onClose,
  onNavigate,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const rawImage = images[currentIndex] || images[0] || '';
  const currentDoc = documents?.[currentIndex] || documents?.[0];

  // Resolve document ID if present on doc object, documentIds prop, or query params
  let docId: number | string | undefined = currentDoc?.id || (documentIds && documentIds[currentIndex]);
  if (!docId && typeof rawImage === 'string') {
    const match = rawImage.match(/[?&]id=(\d+)/);
    if (match) {
      docId = match[1];
    }
  }

  // If document has id and is project document, serve from original.php endpoint
  let originalImage = '';
  if (docId) {
    originalImage = `${API_BASE_URL}/project-documents/original.php?id=${docId}`;
  } else if (rawImage.includes('/project-documents/original.php?id=')) {
    originalImage = rawImage;
  } else {
    originalImage = getOriginalImageUrl(rawImage);
  }

  // Stable key based on document id as required: key={`preview-${document.id}`}
  const stableKey = docId ? `preview-${docId}` : `preview-${currentIndex}`;

  // Reset loaded indicator when navigating images
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex, originalImage]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && onNavigate && currentIndex < images.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && onNavigate && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="evidence-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Bukti Pekerjaan"
      data-motion="none"
    >
      <div
        className="evidence-lightbox-content"
        onClick={(e) => e.stopPropagation()}
        data-motion="none"
      >
        {/* Lightbox Header Bar */}
        <div className="evidence-lightbox-header">
          <div className="lightbox-title-wrap">
            <span className="lightbox-label">Bukti Pekerjaan Nyata</span>
            {title && <span className="lightbox-title">{title}</span>}
          </div>

          <div className="lightbox-actions">
            {originalImage && (
              <>
                <a
                  href={originalImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lightbox-ext-link"
                  title="Buka file gambar asli di tab baru"
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
                <a
                  href={originalImage}
                  download={currentDoc?.original_name || 'bukti-pekerjaan.jpg'}
                  className="lightbox-ext-link"
                  title="Unduh file gambar asli"
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
                  <Icon name="download" style={{ width: 13, height: 13 }} />
                  <span>Unduh</span>
                </a>
              </>
            )}

            {images.length > 1 && (
              <span className="lightbox-counter">
                {currentIndex + 1} / {images.length}
              </span>
            )}
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={onClose}
              title="Tutup Pratinjau (Esc)"
              aria-label="Tutup"
            >
              <Icon name="x" />
            </button>
          </div>
        </div>

        {/* Lightbox Image Container */}
        <div className="evidence-lightbox-image-wrap" data-motion="none">
          {images.length > 1 && onNavigate && (
            <button
              type="button"
              className="lightbox-nav-btn prev"
              disabled={currentIndex <= 0}
              onClick={() => onNavigate(currentIndex - 1)}
              title="Foto Sebelumnya"
              aria-label="Foto Sebelumnya"
            >
              <Icon name="chevL" />
            </button>
          )}

          {/* Loading Indicator */}
          {!imageLoaded && (
            <div className="lightbox-image-loading" data-motion="none">
              <div className="lightbox-spinner" />
            </div>
          )}

          <img
            key={stableKey}
            src={originalImage}
            alt={currentDoc?.original_name || title || 'Bukti pekerjaan'}
            className="lightbox-img"
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

          {images.length > 1 && onNavigate && (
            <button
              type="button"
              className="lightbox-nav-btn next"
              disabled={currentIndex >= images.length - 1}
              onClick={() => onNavigate(currentIndex + 1)}
              title="Foto Selanjutnya"
              aria-label="Foto Selanjutnya"
            >
              <Icon name="chevR" />
            </button>
          )}
        </div>

        {/* Thumbnail strip for multiple images */}
        {images.length > 1 && onNavigate && (
          <div className="evidence-lightbox-strip" data-motion="none">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`lightbox-strip-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => onNavigate(idx)}
                aria-label={`Lihat foto ${idx + 1}`}
                data-motion="none"
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} data-motion="none" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
