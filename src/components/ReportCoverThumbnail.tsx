import React, { useState, useEffect } from 'react';
import { Report } from '../types';
import { Icon } from './icons';
import { dailyReportService, normalizeFileUrl, reportProofCoverCache } from '../utils/api';

interface ReportCoverThumbnailProps {
  report: Report;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ReportCoverThumbnail
 *
 * Automatically displays the first image proof file from daily_report_files (category="proof")
 * as the cover/thumbnail for Daily Report cards/rows.
 *
 * Adheres strictly to:
 * - Direct use of authentic MySQL daily_report_files.file_url without Base64, canvas, or compression.
 * - Displays the first proof image as cover, or fallback icon if no proof images exist.
 * - Graceful onError fallback preserving card layout.
 * - object-fit: cover with exact matching card dimensions.
 */
export const ReportCoverThumbnail: React.FC<ReportCoverThumbnailProps> = ({
  report,
  size = 36,
  className = '',
  style,
}) => {
  const reportId = String(report.id || '').trim();

  // Helper to extract the first valid proof image URL from report or cache
  const getInitialCoverUrl = (): string => {
    // 1. Check if report already has proof_files loaded
    if (report.proof_files && report.proof_files.length > 0) {
      const firstImg = report.proof_files.find((f) => {
        const mime = (f.mime_type || '').toLowerCase();
        const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
        return (
          mime.startsWith('image/') ||
          f.file_type === 'image' ||
          /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name)
        );
      });
      if (firstImg) return normalizeFileUrl(firstImg.file_url);
    }

    // 2. Check if report has evidence_url populated
    if (report.evidence_url) {
      return normalizeFileUrl(report.evidence_url);
    }

    // 3. Check if report has evidence_urls array
    if (report.evidence_urls && report.evidence_urls.length > 0) {
      return normalizeFileUrl(report.evidence_urls[0]);
    }

    // 4. Check global in-memory cover cache
    if (reportId && reportProofCoverCache.has(reportId)) {
      return reportProofCoverCache.get(reportId) || '';
    }

    return '';
  };

  const [coverUrl, setCoverUrl] = useState<string>(getInitialCoverUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  // Synchronize when parent report object updates
  useEffect(() => {
    const nextUrl = getInitialCoverUrl();
    if (nextUrl) {
      setCoverUrl(nextUrl);
      setHasError(false);
    }
  }, [report.evidence_url, report.evidence_urls, report.proof_files, reportId]);

  // If coverUrl is not yet loaded, query existing backend endpoint /api/daily-reports/list.php
  useEffect(() => {
    if (coverUrl || !reportId) return;

    let isMounted = true;
    dailyReportService
      .fetchReportFiles(reportId, 'proof')
      .then((files) => {
        if (!isMounted) return;
        if (files && files.length > 0) {
          // Rule 8: Jika ada beberapa file proof, gunakan file proof pertama sebagai cover.
          const firstImg = files.find((f) => {
            const mime = (f.mime_type || '').toLowerCase();
            const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
            return (
              mime.startsWith('image/') ||
              f.file_type === 'image' ||
              /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name)
            );
          });

          if (firstImg) {
            const resolvedUrl = normalizeFileUrl(firstImg.file_url);
            setCoverUrl(resolvedUrl);
            setHasError(false);
            reportProofCoverCache.set(reportId, resolvedUrl);
            report.evidence_url = resolvedUrl;
          }
        }
      })
      .catch((err) => {
        console.warn(`[ReportCoverThumbnail] Fetch proof for report #${reportId} notice:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [reportId, coverUrl]);

  return (
    <div
      className={`ric ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)',
        flex: 'none',
        ...style,
      }}
    >
      {coverUrl && !hasError ? (
        <img
          src={coverUrl}
          alt={`Sampul ${report.task || 'Laporan'}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '10px',
            display: 'block',
          }}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <Icon name="doc" size={Math.round(size * 0.47)} />
      )}
    </div>
  );
};
