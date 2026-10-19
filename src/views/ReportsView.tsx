import React, { useState, useEffect } from 'react';
import { Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { ReportCoverThumbnail } from '../components/ReportCoverThumbnail';
import { cleanReportText } from '../utils/formatters';

interface ReportsViewProps {
  reports: Report[];
  isLoading?: boolean;
  isAdmin?: boolean;
  currentUserEmail?: string;
  reportsError?: {
    status?: number;
    message: string;
    type: '401' | '403' | '404' | '500' | 'network' | 'error';
  } | null;
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
  onDeleteReport?: (reportId: string) => void;
  onResetReports?: () => void;
  onAddToast?: (text: string) => void;
  onRetry?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  reports,
  isLoading = false,
  isAdmin = false,
  currentUserEmail = '',
  reportsError = null,
  onNavigate,
  onSelectReport,
  onDeleteReport,
  onResetReports,
  onAddToast,
  onRetry,
}) => {
  const [filterTab, setFilterTab] = useState<'All' | 'In Review' | 'In Progress' | 'Completed'>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input by 300ms without triggering network requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Purely in-memory filtering: never request server on filter tab switch or search
  const filteredReports = reports.filter((r) => {
    if (filterTab === 'In Review' && r.status !== 'In Review') return false;
    if (filterTab === 'In Progress' && r.status !== 'In Progress') return false;
    if (filterTab === 'Completed' && r.status !== 'Completed') return false;
    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      const matchTask = r.task && r.task.toLowerCase().includes(query);
      const matchPerson = r.person && r.person.toLowerCase().includes(query);
      const matchProject = r.project && r.project.toLowerCase().includes(query);
      const matchDesc = r.desc && r.desc.toLowerCase().includes(query);
      const matchCategory = r.category && r.category.toLowerCase().includes(query);
      const matchEmail = r.user_email && r.user_email.toLowerCase().includes(query);

      if (!matchTask && !matchPerson && !matchProject && !matchDesc && !matchCategory && !matchEmail) {
        return false;
      }
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
      if (onAddToast) onAddToast('Laporan berhasil dihapus.');
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
      if (onAddToast) onAddToast('Semua laporan berhasil direset.');
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  const completedCount = reports.filter((r) => r.status === 'Completed').length;
  const inReviewCount = reports.filter((r) => r.status === 'In Review').length;

  return (
    <div className="view">
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: '22px' }}>
        <div>
          <h1>Laporan Kerja Harian</h1>
          <p className="sub">
            Catatan progres, milestone, dan aktivitas seluruh tim kreatif Wee Studio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsResetModalOpen(true)}
              style={{
                borderColor: '#fca5a5',
                color: '#dc2626',
                background: 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <Icon name="trash" style={{ width: 16, height: 16 }} />
              <span>Reset Laporan</span>
            </button>
          )}
          <button className="cta" onClick={() => onNavigate('create-report')}>
            <Icon name="plus" style={{ width: 16, height: 16 }} />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Chips */}
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
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{completedCount}</div>
            <div className="lbl">Selesai</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{inReviewCount}</div>
            <div className="lbl">Butuh Review</div>
          </div>
        </div>
      </div>

      {/* Toolbar: Filter Tabs & Search Bar */}
      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div className="filters" style={{ display: 'inline-flex', padding: '5px', borderRadius: '999px', background: 'var(--glass)', border: '1px solid var(--line)' }}>
          {[
            { id: 'All', label: `Semua (${reports.length})` },
            { id: 'In Review', label: 'In Review' },
            { id: 'In Progress', label: 'Sedang Berjalan' },
            { id: 'Completed', label: 'Selesai' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={filterTab === tab.id ? 'on' : ''}
              onClick={() => setFilterTab(tab.id as any)}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                fontSize: '13.5px',
                fontWeight: 600,
                border: 0,
                background: filterTab === tab.id ? 'var(--dark)' : 'transparent',
                color: filterTab === tab.id ? 'var(--on-dark)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-box" style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '380px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
            <Icon name="search" style={{ width: 18, height: 18 }} />
          </span>
          <input
            type="text"
            placeholder="Cari tugas, anggota tim, atau proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '999px',
              border: '1px solid var(--line)',
              background: 'var(--glass-solid)',
              padding: '0 16px 0 44px',
              font: 'inherit',
              fontSize: '14px',
              color: 'var(--ink)',
              outline: 0,
              boxShadow: 'var(--shadow-card)',
            }}
          />
        </div>
      </div>

      {/* ERROR / OFFLINE BANNER */}
      {reportsError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="alert" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <b style={{ display: 'block', fontSize: '14px', color: '#b91c1c' }}>Gagal Menyinkronkan Laporan</b>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{reportsError.message}</span>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onRetry}
              style={{ background: '#dc2626', color: '#fff', border: 0, padding: '8px 16px', borderRadius: '999px', fontWeight: 600, cursor: 'pointer' }}
            >
              Coba Lagi
            </button>
          )}
        </div>
      )}

      {/* MAIN BENTO LAYOUT (Grid 3 Kolom + Sticky Sidebar 320px) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: '24px',
          alignItems: 'start',
        }}
        className="reports-main-grid-layout"
      >
        {/* KOLOM KIRI: Bento Grid Kartu Laporan */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          {isLoading ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              Memuat laporan tim...
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--muted)', background: 'var(--glass)', borderRadius: '24px', border: '1px solid var(--line)' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>Tidak ada laporan ditemukan</p>
              <span style={{ fontSize: '13px' }}>Coba ubah kata kunci pencarian atau filter status.</span>
            </div>
          ) : (
            filteredReports.map((r) => {
              const statusClass =
                r.status === 'Completed'
                  ? 'bg-[#e9f5b8] text-[#2a3308]'
                  : r.status === 'In Review'
                  ? 'bg-[#f6e6cf] text-[#8c4e03]'
                  : 'bg-[#d9d3f5] text-[#433385]';

              const canDelete =
                isAdmin ||
                Boolean(
                  currentUserEmail &&
                    ((r.user_email && r.user_email.toLowerCase() === currentUserEmail.toLowerCase()) ||
                      (r.created_by && r.created_by.toLowerCase() === currentUserEmail.toLowerCase()))
                );

              return (
                <article
                  key={r.id}
                  className="report-card"
                  onClick={() => onSelectReport(r.id)}
                  style={{
                    background: 'var(--glass-solid, rgba(255, 255, 255, 0.92))',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--line, rgba(31, 29, 43, 0.08))',
                    borderRadius: '24px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 4px 20px -8px rgba(60, 50, 110, 0.12)',
                    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 16px 32px -12px rgba(60, 50, 110, 0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 20px -8px rgba(60, 50, 110, 0.12)';
                  }}
                >
                  {/* Top: Thumbnail & Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '16px',
                        flexShrink: 0,
                        overflow: 'hidden',
                        border: '1.5px solid rgba(255, 255, 255, 0.8)',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <ReportCoverThumbnail report={r} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--ink, #1f1d2b)',
                          lineHeight: 1.3,
                          marginBottom: '4px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {cleanReportText(r.task)}
                      </h4>
                      <div
                        style={{
                          fontSize: '12.5px',
                          color: 'var(--muted, #8b8898)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.person}
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--muted, #8b8898)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.project} &bull; {r.date} ({r.progress}%)
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Status Badge & Delete Action */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--line, rgba(31, 29, 43, 0.06))',
                    }}
                  >
                    <span
                      className={statusClass}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      {r.status}
                    </span>

                    {canDelete && (
                      <button
                        type="button"
                        title="Hapus laporan ini"
                        aria-label="Hapus laporan"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportToDelete(r);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: 'rgba(20, 19, 26, 0.04)',
                          border: '1px solid var(--line-soft)',
                          color: 'var(--muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
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
                </article>
              );
            })
          )}
        </div>

        {/* KOLOM KANAN: Sidebar Sticky Widget (Pedoman & Review Cepat) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'sticky',
            top: '90px',
          }}
          className="reports-side-sidebar"
        >
          <div className="card summary-card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px', color: 'var(--ink)' }}>
              Pedoman Laporan Efektif
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.5, margin: '0 0 16px' }}>
              Setiap anggota tim diharapkan submit laporan kerja sebelum pukul 18.00 WIB.
            </p>

            <div className="sum-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="sum-ic" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--lime-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="check" style={{ width: 16, height: 16 }} />
              </div>
              <div className="sum-mid" style={{ minWidth: 0 }}>
                <div className="sl" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Sertakan Persentase Progres</div>
                <div className="sum-val" style={{ fontSize: '12px', color: 'var(--muted)' }}>0% - 100%</div>
              </div>
            </div>

            <div className="sum-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div className="sum-ic" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--lav)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="folder" style={{ width: 16, height: 16 }} />
              </div>
              <div className="sum-mid" style={{ minWidth: 0 }}>
                <div className="sl" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Lampirkan Tautan Asset</div>
                <div className="sum-val" style={{ fontSize: '12px', color: 'var(--muted)' }}>Figma, GDrive, GitHub</div>
              </div>
            </div>

            <button
              type="button"
              className="cta"
              onClick={() => onNavigate('create-report')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon name="plus" style={{ width: 16, height: 16 }} />
              <span>Submit Laporan Hari Ini</span>
            </button>
          </div>

          <div
            className="promo-card"
            style={{
              background: 'linear-gradient(135deg, #8f7fe0, #6a54f0)',
              color: '#fff',
              borderRadius: '24px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 12px 28px -10px rgba(106, 84, 240, 0.4)',
            }}
          >
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px', color: '#fff' }}>
                Review Cepat Tanpa Ribet
              </h3>
              <p style={{ fontSize: '13px', opacity: 0.9, lineHeight: 1.45, margin: 0 }}>
                Project lead dapat langsung menyetujui atau meminta revisi laporan sekali klik.
              </p>
            </div>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'grid',
                placeItems: 'center',
                alignSelf: 'flex-start',
              }}
            >
              <Icon name="checksq" style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Responsive media query override style for screen < 1180px */}
      <style>{`
        @media (max-width: 1180px) {
          .reports-main-grid-layout {
            grid-template-columns: 1fr !important;
          }
          .reports-side-sidebar {
            position: static !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .reports-side-sidebar {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

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
              borderRadius: '24px',
              padding: '28px',
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
                  borderRadius: '12px',
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
                className="ghost-b"
                disabled={isDeleting}
                onClick={() => setReportToDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="cta"
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
              borderRadius: '24px',
              padding: '28px',
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
                  borderRadius: '12px',
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
                className="ghost-b"
                disabled={isDeleting}
                onClick={() => setIsResetModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="cta"
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
