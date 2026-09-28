import React, { useState } from 'react';
import { Icon } from './icons';
import { ImageLightbox } from './ImageLightbox';

interface WorkEvidenceThumbnailProps {
  evidenceUrls?: string[];
  thumbnailUrl?: string;
  projectTitle: string;
  height?: number | string;
  className?: string;
  onCreateReport?: () => void;
  showGalleryStrip?: boolean;
}

export const WorkEvidenceThumbnail: React.FC<WorkEvidenceThumbnailProps> = ({
  evidenceUrls,
  thumbnailUrl,
  projectTitle,
  height = 180,
  className = '',
  onCreateReport,
  showGalleryStrip = true,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Compile list of unique valid image URLs
  const allImages: string[] = [];
  if (thumbnailUrl && !allImages.includes(thumbnailUrl)) {
    allImages.push(thumbnailUrl);
  }
  if (evidenceUrls && evidenceUrls.length > 0) {
    evidenceUrls.forEach((url) => {
      if (url && !allImages.includes(url)) {
        allImages.push(url);
      }
    });
  }

  const hasEvidence = allImages.length > 0 && !imgError;
  const primaryImage = allImages[0];
  const secondaryImages = allImages.slice(1, 3);
  const remainingCount = allImages.length > 3 ? allImages.length - 3 : 0;

  const handleOpenLightbox = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  if (!hasEvidence) {
    return (
      <div
        className={`work-evidence-empty ${className}`}
        style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="empty-evidence-icon">
          <Icon name="camera" style={{ width: 16, height: 16 }} />
        </div>
        <div className="empty-evidence-text">
          <b>Belum ada bukti pekerjaan</b>
          <span>Unggah bukti hasil kerja nyata melalui formulir laporan</span>
        </div>
        {onCreateReport && (
          <button
            type="button"
            className="btn btn-outline btn-xs empty-evidence-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCreateReport();
            }}
          >
            <Icon name="plus" style={{ width: 12, height: 12 }} />
            <span>+ Buat Laporan</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={`work-evidence-container ${className}`}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {/* Main Work Evidence Photo */}
        <div
          className="work-evidence-main"
          onClick={(e) => handleOpenLightbox(0, e)}
          title="Klik untuk memperbesar bukti pekerjaan"
          role="button"
          tabIndex={0}
        >
          <img
            src={primaryImage}
            alt={`Bukti pekerjaan ${projectTitle}`}
            className="evidence-img-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <div className="evidence-badge-overlay">
            <span className="evidence-pill">
              <span className="evidence-dot" />
              Bukti Pekerjaan Nyata
            </span>
            <span className="evidence-zoom-hint" title="Perbesar gambar">
              <Icon name="search" style={{ width: 13, height: 13 }} />
            </span>
          </div>
        </div>

        {/* Gallery Strip if multiple evidence images exist */}
        {showGalleryStrip && allImages.length > 1 && (
          <div className="work-evidence-gallery-strip" onClick={(e) => e.stopPropagation()}>
            {secondaryImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className="evidence-mini-thumb"
                onClick={(e) => handleOpenLightbox(idx + 1, e)}
                title={`Lihat foto ${idx + 2}`}
                aria-label={`Lihat foto ${idx + 2}`}
              >
                <img src={img} alt={`Bukti ${idx + 2}`} />
              </button>
            ))}

            {remainingCount > 0 && (
              <button
                type="button"
                className="evidence-mini-thumb more"
                onClick={(e) => handleOpenLightbox(3, e)}
                title={`Lihat ${remainingCount} foto lainnya`}
                aria-label={`Lihat ${remainingCount} foto lainnya`}
              >
                <span>+{remainingCount}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={allImages}
        currentIndex={activeImageIndex}
        title={projectTitle}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setActiveImageIndex(newIdx)}
      />
    </>
  );
};
