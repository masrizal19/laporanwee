import React, { useState } from 'react';

export interface VersionUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionUpdateModal: React.FC<VersionUpdateModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem('lw_v5_2_notified', 'true');
      localStorage.setItem('laporanwee_v5_2_notified', 'true');
      localStorage.setItem('laporanwee_v3_seen', 'true');
    }
    onClose();
  };

  const updates = [
    {
      id: 'fast-page-load',
      icon: '⚡',
      badgeColor: '#10b981',
      tag: '0ms Transisi',
      title: 'Transisi Cepat 0ms',
      desc: 'Pemuatan halaman kini instan dan bebas jeda antar menu Dashboard, Laporan, dan Tim.',
    },
    {
      id: 'persistent-activities',
      icon: '📋',
      badgeColor: '#6366f1',
      tag: 'Data Stabil',
      title: 'Riwayat Aktivitas & Laporan Presisten',
      desc: '120 riwayat aktivitas dan data laporan harian tetap terjaga stabil setelah browser di-reload (F5).',
    },
    {
      id: 'chat-room',
      icon: '💬',
      badgeColor: '#ec4899',
      tag: 'Chat Terpadu',
      title: 'Chat Room Terpadu',
      desc: 'Pengetikan waktu nyata, centang dibaca, dan pratinjau berkas privat (/chat/preview-file).',
    },
    {
      id: 'file-upload',
      icon: '📁',
      badgeColor: '#f59e0b',
      tag: 'Kapasitas 3 GB',
      title: 'Unggah Berkas hingga 3 GB',
      desc: 'Transfer foto, video dokumentasi, dan dokumen kerja proyek tanpa batas kompresi.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md transition-all duration-300 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v52-modal-title"
      onClick={handleConfirm}
    >
      <div
        className="relative w-full max-w-lg md:max-w-xl max-h-[92vh] overflow-hidden rounded-3xl bg-white/95 dark:bg-[#181622]/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl flex flex-col text-gray-900 dark:text-white animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#d4ee6b] via-emerald-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-black/5 dark:border-white/10 relative">
          <button
            type="button"
            onClick={handleConfirm}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-white transition-all cursor-pointer"
            title="Tutup Notifikasi"
            aria-label="Tutup"
          >
            ✕
          </button>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#d4ee6b] text-[#1f1d2b] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#1f1d2b] animate-pulse" />
              RESMI v5.2
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/5 tracking-wider">
              JANGAN LUPA KERJA HARI INI
            </span>
          </div>

          <h2 id="v52-modal-title" className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight mt-1">
            LaporanWee v5.2 Telah Aktif!
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Pembaruan performa dan kecepatan sistem untuk pengalaman kerja yang mulus, responsif, dan bebas jeda.
          </p>
        </div>

        {/* Modal Body - Feature List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 max-h-[50vh] sm:max-h-[55vh]">
          {updates.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/5 transition-all"
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-xs"
                style={{
                  backgroundColor: `${item.badgeColor}20`,
                }}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                    style={{
                      color: item.badgeColor,
                      backgroundColor: `${item.badgeColor}15`,
                    }}
                  >
                    {item.tag}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {item.title}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 pt-3 border-t border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer user-select-none w-full sm:w-auto">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
            />
            <span>Jangan tampilkan otomatis lagi</span>
          </label>

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Mulai Bekerja</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionUpdateModal;
