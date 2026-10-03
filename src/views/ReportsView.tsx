import React, { useState } from 'react';
import { Report, ViewType } from '../types';
import { Icon } from '../components/icons';

interface ReportsViewProps {
  reports: Report[];
  isLoading?: boolean;
  isAdmin?: boolean;
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
  onDeleteReport?: (reportId: string) => void;
  onResetReports?: () => void;
  onAddToast?: (text: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  reports,
  isLoading = false,
  isAdmin = false,
  onNavigate,
  onSelectReport,
  onDeleteReport,
  onResetReports,
  onAddToast,
}) => {
  const [filterTab, setFilterTab] = useState<'All' | 'In Review' | 'In Progress' | 'Completed'>('All');
  const [search, setSearch] = useState('');
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredReports = reports.filter((r) => {
    if (filterTab === 'In Review' && r.status !== 'In Review') return false;
    if (filterTab === 'In Progress' && r.status !== 'In Progress') return false;
    if (filterTab === 'Completed' && r.status !== 'Completed') return false;
    if (
      search.trim() &&
      !r.task.toLowerCase().includes(search.toLowerCase()) &&
      !r.person.toLowerCase().includes(search.toLowerCase()) &&
      !r.project.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      if (onDeleteReport) {
        await onDeleteReport(reportToDelete.id);
      }
      setReportToDelete(null);
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmResetReports = async () => {
    setIsDeleting(true);
    try {
      if (onResetReports) {
        await onResetReports();
      }
      setIsResetModalOpen(false);
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Laporan Kerja Harian</h1>
          <p className="sub">
            Catatan progres, milestone, dan aktivitas seluruh tim kreatif Wee Studio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && reports.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsResetModalOpen(true)}
              style={{
                borderColor: '#fca5a5',
                color: '#dc2626',
                background: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
              }}
              title="Hapus seluruh laporan kerja"
            >
              <Icon name="trash" style={{ width: 14, height: 14 }} />
              <span>Reset Laporan</span>
            </button>
          )}
          <button className="btn btn-dark" onClick={() => onNavigate('create-report')}>
            <Icon name="plus" size={18} />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-white">
          <div className="ic">
            <Icon name="doc" />
          </div>
          <div>
            <div className="num">{reports.length}</div>
            <div className="lbl">Total Laporan</div>
          </div>
        </div>
        <div className="stat-chip c-lav">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{reports.filter((r) => r.status === 'In Review').length}</div>
            <div className="lbl">Butuh Review</div>
          </div>
        </div>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="check" />
          </div>
          <div>
            <div className="num">{reports.filter((r) => r.status === 'Completed').length}</div>
            <div className="lbl">Selesai</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="tab-row">
          <button
            className={filterTab === 'All' ? 'active' : ''}
            onClick={() => setFilterTab('All')}
          >
            Semua ({reports.length})
          </button>
          <button
            className={filterTab === 'In Review' ? 'active' : ''}
            onClick={() => setFilterTab('In Review')}
          >
            In Review
          </button>
          <button
            className={filterTab === 'In Progress' ? 'active' : ''}
            onClick={() => setFilterTab('In Progress')}
          >
            Sedang Berjalan
          </button>
          <button
            className={filterTab === 'Completed' ? 'active' : ''}
            onClick={() => setFilterTab('Completed')}
          >
            Selesai
          </button>
        </div>

        <div className="search-box">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Cari tugas, anggota tim, atau proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="dash-grid">
        {/* Left: Reports list */}
        <div>
          {isLoading ? (
            <div className="empty-state card" style={{ background: '#fff', padding: '48px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  margin: '0 auto 12px',
                  border: '3px solid var(--line-soft)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ color: 'var(--muted)', fontSize: '13.5px', margin: 0 }}>
                Memuat data laporan dari server...
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state card" style={{ background: '#fff' }}>
              <Icon name="doc" />
              <b>Belum ada laporan yang sesuai</b>
              <p>Coba ganti filter atau buat laporan harian baru.</p>
              <button
                className="btn btn-dark btn-sm"
                style={{ marginTop: '14px' }}
                onClick={() => onNavigate('create-report')}
              >
                Tulis Laporan Sekarang
              </button>
            </div>
          ) : (
            filteredReports.map((r) => (
              <div
                key={r.id}
                className="report-row"
                onClick={() => {
                  onSelectReport(r.id);
                  onNavigate('report-detail');
                }}
              >
                <div className="ric">
                  {r.evidence_urls && r.evidence_urls.length > 0 ? (
                    <img
                      src={r.evidence_urls[0]}
                      alt="Bukti"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                    />
                  ) : r.evidence_url ? (
                    <img
                      src={r.evidence_url}
                      alt="Bukti"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                    />
                  ) : (
                    <Icon name="doc" size={17} />
                  )}
                </div>
                <div className="rmid" style={{ flex: 1 }}>
                  <b>{r.task}</b>
                  <span>
                    {r.person} &bull; {r.project} &bull; {r.date} ({r.progress}%)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`rstat ${r.status.replace(/\s+/g, '')}`}>
                    {r.status}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Hapus laporan ini"
                      aria-label="Hapus laporan"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportToDelete(r);
                      }}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'rgba(20, 19, 26, 0.04)',
                        border: '1px solid var(--line-soft)',
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2';
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.borderColor = '#fca5a5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(20, 19, 26, 0.04)';
                        e.currentTarget.style.color = 'var(--muted)';
                        e.currentTarget.style.borderColor = 'var(--line-soft)';
                      }}
                    >
                      <Icon name="trash" style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Summary cards */}
        <div className="right-col">
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px' }}>
              Pedoman Laporan Efektif
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.5, margin: '0 0 16px' }}>
              Setiap anggota tim diharapkan submit laporan kerja sebelum pukul 18.00 WIB.
            </p>

            <div className="sum-row">
              <div className="sum-ic">
                <Icon name="check" />
              </div>
              <div className="sum-mid">
                <div className="sl">Sertakan Persentase Progres</div>
                <div className="sum-val">0% - 100%</div>
              </div>
            </div>

            <div className="sum-row">
              <div className="sum-ic">
                <Icon name="folder" />
              </div>
              <div className="sum-mid">
                <div className="sl">Lampirkan Tautan Asset</div>
                <div className="sum-val">Figma, GDrive, GitHub</div>
              </div>
            </div>

            <button
              className="btn btn-dark submit-report-cta"
              onClick={() => onNavigate('create-report')}
            >
              <div className="cta-icon-badge">
                <Icon name="plus" size={16} />
              </div>
              <span>Submit Laporan Hari Ini</span>
            </button>
          </div>

          <div className="promo-card">
            <div>
              <h3>Review Cepat Tanpa Ribet</h3>
              <p>Project lead dapat langsung menyetujui atau meminta revisi laporan sekali klik.</p>
            </div>
            <div className="promo-badge-tag">
              <Icon name="checksq" style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Konfirmasi Hapus Laporan */}
      {reportToDelete && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isDeleting && setReportToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Hapus Laporan Kerja?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Laporan <strong>"{reportToDelete.task}"</strong> ({reportToDelete.person} &bull; {reportToDelete.project}) akan dihapus dari database. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isDeleting}
                onClick={() => setReportToDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isDeleting}
                onClick={handleConfirmDeleteReport}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus Laporan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Reset Seluruh Laporan */}
      {isResetModalOpen && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isDeleting && setIsResetModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="trash" style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Reset Seluruh Laporan Kerja?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Semua laporan kerja harian akan dihapus dari database dan tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isDeleting}
                onClick={() => setIsResetModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={isDeleting}
                onClick={handleConfirmResetReports}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon name="trash" style={{ width: 14, height: 14 }} />
                <span>{isDeleting ? 'Mereset...' : 'Reset Semua Laporan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

