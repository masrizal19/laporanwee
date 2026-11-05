import React, { useEffect } from 'react';
import { Icon } from './icons';

export interface AttachmentPreviewData {
  url: string;
  name: string;
  type: 'image' | 'video' | 'document' | string;
  extension?: string;
  size_formatted?: string;
}

interface AttachmentPreviewModalProps {
  preview: AttachmentPreviewData | null;
  onClose: () => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  preview,
  onClose,
}) => {
  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview, onClose]);

  if (!preview) return null;

  const url = preview.url;
  const name = preview.name || 'Berkas Lampiran';
  const type = preview.type || 'document';
  const ext = preview.extension || url.split('.').pop()?.toLowerCase() || '';
  const isImage = type === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
  const isVideo = type === 'video' || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-motion="none"
    >
      <div
        className="relative max-w-4xl w-full bg-[#181622]/95 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-motion="none"
      >
        {/* Header Bar */}
        <div className="w-full flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-[#d4ee6b]">
              <Icon name={isImage ? 'image' : isVideo ? 'video' : 'doc'} style={{ width: 18, height: 18 }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate text-white">{name}</h3>
              <p className="text-[11px] text-gray-400 capitalize">
                {type} {preview.size_formatted ? `• ${preview.size_formatted}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={url}
              download={name}
              className="px-3 py-1.5 rounded-xl bg-[#d4ee6b] text-[#181622] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
              title="Muat Turun Fail"
            >
              <Icon name="download" style={{ width: 14, height: 14 }} />
              <span>Muat Turun Fail</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="Tutup (Esc)"
            >
              <Icon name="x" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="w-full flex items-center justify-center max-h-[75vh] min-h-[250px] overflow-hidden rounded-2xl bg-black/40 p-2 border border-white/5">
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              loading="eager"
              decoding="async"
            />
          ) : isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-xl outline-none"
            >
              Browser anda tidak menyokong pemain video HTML5.
            </video>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#d4ee6b]/10 text-[#d4ee6b] flex items-center justify-center border border-[#d4ee6b]/20">
                <Icon name="doc" style={{ width: 32, height: 32 }} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">{name}</h4>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Fail dokumen/arkib sedia untuk dimuat turun ke peranti anda.
                </p>
              </div>
              <a
                href={url}
                download={name}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-[#d4ee6b] text-[#181622] font-bold text-xs hover:opacity-95 transition-all flex items-center gap-2 shadow-md"
              >
                <Icon name="download" style={{ width: 16, height: 16 }} />
                <span>Muat Turun Fail ({preview.size_formatted || 'Dokumen'})</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
