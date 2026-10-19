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
      localStorage.setItem('laporanwee_v3_seen', 'true');
    }
    onClose();
  };

  const updates = [
    {
      id: 'bento-gallery',
      tag: 'Fitur Utama',
      title: 'Galeri Bento Lampiran & Berkas Proyek',
      desc: 'Tata letak editorial Bento Grid 6-kolom modern untuk foto, video preview, dan dokumen berkas dengan warna tipe file (PDF, Doc, Excel, PPT, Zip). Dilengkapi Lightbox resolusi penuh dan filter instan.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      ),
      badgeColor: '#6366f1',
    },
    {
      id: 'css-loader',
      tag: 'Pengalaman Pengguna',
      title: 'Real-Time CSS Loader & Pelacak Status Upload',
      desc: 'Indikator loader animasi dengan bar kilau (sweep progress) dan denyut status. Berkas yang diunggah kini tampil bersamaan di panel status upload dan langsung muncul di galeri berkas secara real-time, plus loader pada tombol Simpan.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
      badgeColor: '#10b981',
    },
    {
      id: 'large-files',
      tag: 'Performa & Storage',
      title: 'Dukungan Berkas Hingga 2 GB per File',
      desc: 'Kapasitas unggahan berkas foto resolusi tinggi, rekaman video pekerjaan, dan dokumen proyek kini diperluas hingga 2 GB langsung ke endpoint database server.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m8 17 4 4 4-4" />
        </svg>
      ),
      badgeColor: '#f59e0b',
    },
    {
      id: 'security-admin',
      tag: 'Keamanan & Akun',
      title: 'Peningkatan Hak Akses & Sesi Tim',
      desc: 'Penguatan sistem otorisasi multi-role untuk admin dan anggota tim, proteksi pengeditan laporan harian, dan sinkronisasi data yang lebih cepat dan aman.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      badgeColor: '#8b5cf6',
    },
  ];

  return (
    <div
      className="v3-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v3-modal-title"
      onClick={handleConfirm}
    >
      <div
        className="v3-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="v3-modal-header">
          <div className="v3-modal-badge-row">
            <span className="v3-badge-pill">
              <span className="v3-badge-dot" />
              Versi 3.0 Resmi Dirilis
            </span>
            <span className="v3-tagline-pill">
              JANGAN LUPA KERJA HARI INI
            </span>
          </div>

          <button
            type="button"
            className="v3-modal-close"
            onClick={handleConfirm}
            title="Tutup Pengumuman"
            aria-label="Tutup"
          >
            ✕
          </button>

          <h2 id="v3-modal-title" className="v3-modal-title">
            Pembaruan Akbar LaporanWee v3.0
          </h2>
          <p className="v3-modal-subtitle">
            Ruang kerja tim kreatif kini semakin responsif, intuitif, dan bertenaga. Berikut pembaruan fitur yang siap Anda gunakan hari ini:
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="v3-modal-body">
          <div className="v3-features-grid">
            {updates.map((item) => (
              <div key={item.id} className="v3-feature-item">
                <div
                  className="v3-feature-icon"
                  style={{
                    color: item.badgeColor,
                    backgroundColor: `${item.badgeColor}18`,
                  }}
                >
                  {item.icon}
                </div>
                <div className="v3-feature-content">
                  <div className="v3-feature-top">
                    <span
                      className="v3-feature-tag"
                      style={{ color: item.badgeColor }}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="v3-feature-title">{item.title}</h3>
                  <p className="v3-feature-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="v3-modal-footer">
          <label className="v3-modal-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Jangan tampilkan otomatis lagi</span>
          </label>

          <div className="v3-modal-footer-btns">
            <button
              type="button"
              className="v3-btn-primary"
              onClick={handleConfirm}
            >
              <span>Mengerti &amp; Mulai Kerja Sekarang</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
