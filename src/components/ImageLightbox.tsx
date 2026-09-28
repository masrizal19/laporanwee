import React, { useEffect } from 'react';
import { Icon } from './icons';

interface ImageLightboxProps {
  isOpen: boolean;
  images: string[];
  currentIndex: number;
  title?: string;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  images,
  currentIndex,
  title,
  onClose,
  onNavigate,
}) => {
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

  const currentImage = images[currentIndex] || images[0];

  return (
    <div
      className="evidence-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau Bukti Pekerjaan"
    >
      <div
        className="evidence-lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lightbox Header Bar */}
        <div className="evidence-lightbox-header">
          <div className="lightbox-title-wrap">
            <span className="lightbox-label">Bukti Pekerjaan Nyata</span>
            {title && <span className="lightbox-title">{title}</span>}
          </div>

          <div className="lightbox-actions">
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
        <div className="evidence-lightbox-image-wrap">
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

          <img
            src={currentImage}
            alt={title || 'Bukti pekerjaan'}
            className="lightbox-img"
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
          <div className="evidence-lightbox-strip">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`lightbox-strip-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => onNavigate(idx)}
                aria-label={`Lihat foto ${idx + 1}`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
