import React, { useState, useEffect, useRef } from 'react';
import { AnalyticsSummary, ViewType } from '../types';
import { Icon } from '../components/icons';
import { analyticsService } from '../utils/api';

interface AnalyticsViewProps {
  analytics?: AnalyticsSummary;
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  onRefresh?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics: propAnalytics,
  onNavigate,
  onAddToast,
  onRefresh,
}) => {
  const [data, setData] = useState<AnalyticsSummary>(
    propAnalytics || {
      total_hours: 0,
      reports: { total: 0, completed: 0 },
      tasks: { total: 0, completed: 0 },
      activities: { total: 0 },
      deadline_accuracy: 0,
      daily_activity: [
        { day: 'Senin', tasks_completed: 0, reports: 0 },
        { day: 'Selasa', tasks_completed: 0, reports: 0 },
        { day: 'Rabu', tasks_completed: 0, reports: 0 },
        { day: 'Kamis', tasks_completed: 0, reports: 0 },
        { day: 'Jumat', tasks_completed: 0, reports: 0 },
      ],
      division_distribution: [],
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(10); // Oktober default
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (propAnalytics) {
      setData(propAnalytics);
    }
  }, [propAnalytics]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const summary = await analyticsService.fetchSummary();
      setData(summary);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Load analytics error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const getToken = () =>
    localStorage.getItem('laporanwee_token') ||
    localStorage.getItem('auth_token') ||
    '';

  const exportUrl = `https://api-laporanwe.mkverse.my.id/api/analytics/export.php?month=${selectedMonth}&year=${selectedYear}&status=completed&token=${getToken()}`;

  const handleExport = (format: 'excel' | 'word' | 'jpg') => {
    const downloadUrl = `https://api-laporanwe.mkverse.my.id/api/analytics/export.php?format=${format}&month=${selectedMonth}&year=${selectedYear}&status=completed&token=${getToken()}`;
    window.open(downloadUrl, '_blank');
    onAddToast(`Memulai unduhan laporan format ${format.toUpperCase()} (Bulan ${selectedMonth}/${selectedYear})...`);
  };

  const handlePrint = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.print();
        onAddToast('Membuka dialog cetak dokumen rekap multi-page...');
      } else {
        window.print();
      }
    } catch (err) {
      window.print();
    }
  };

  const dailyList =
    data.daily_activity && data.daily_activity.length > 0
      ? data.daily_activity
      : [
          { day: 'Senin', tasks_completed: 0, reports: 0 },
          { day: 'Selasa', tasks_completed: 0, reports: 0 },
          { day: 'Rabu', tasks_completed: 0, reports: 0 },
          { day: 'Kamis', tasks_completed: 0, reports: 0 },
          { day: 'Jumat', tasks_completed: 0, reports: 0 },
        ];

  const maxVal = Math.max(
    ...dailyList.map((d) => Math.max(d.tasks_completed, d.reports)),
    1
  );

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const totalReportsCount = data.reports.total || 26;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Statistik &amp; Analitik Kinerja Tim</h1>
          <p className="sub">
            Evaluasi kecepatan sprint, konsistensi pelaporan harian, dan distribusi beban kerja tim.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadAnalytics}
            disabled={isLoading}
            title="Muat ulang analitik dari database"
          >
            <Icon name="refresh" className={isLoading ? 'spin' : ''} style={{ width: 16, height: 16 }} />
            <span>{isLoading ? 'Memuat...' : 'Segarkan Data'}</span>
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={() => setIsPreviewModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="doc" style={{ width: 16, height: 16 }} />
            <span>Ekspor Laporan (PDF)</span>
          </button>
        </div>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{data.total_hours} Jam</div>
            <div className="lbl">Total Jam Kerja</div>
          </div>
        </div>
        <div className="stat-chip c-lav">
          <div className="ic">
            <Icon name="checksq" />
          </div>
          <div>
            <div className="num">{data.reports.completed}</div>
            <div className="lbl">Laporan Disetujui</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{data.deadline_accuracy}%</div>
            <div className="lbl">Ketepatan Deadline</div>
          </div>
        </div>
      </div>

      <div className="analytics-layout">
        {/* Left Column: Bar Chart & Distribution */}
        <div>
          {/* Bar Chart Card */}
          <div className="card chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 2px' }}>
                  Aktivitas Harian Minggu Ini
                </h3>
                <p className="section-sub" style={{ margin: 0 }}>
                  Volume laporan yang disubmit vs tugas yang diselesaikan per hari
                </p>
              </div>

              <div className="chart-legend">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--violet)' }} />
                  <span>Tugas Selesai</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--lime-deep)' }} />
                  <span>Laporan Harian</span>
                </div>
              </div>
            </div>

            <div className="bar-chart">
              {dailyList.map((item, idx) => {
                const taskPct =
                  item.tasks_completed > 0
                    ? Math.max(Math.round((item.tasks_completed / maxVal) * 85), 10)
                    : 4;
                const reportPct =
                  item.reports > 0
                    ? Math.max(Math.round((item.reports / maxVal) * 85), 10)
                    : 4;

                const isToday = item.day.toLowerCase() === 'rabu';

                return (
                  <div key={idx} className="bar-group">
                    <div className="bars">
                      <div
                        className="bar"
                        style={{
                          height: `${taskPct}%`,
                          background: item.tasks_completed > 0 ? 'var(--violet)' : 'rgba(74, 85, 255, 0.15)',
                        }}
                      >
                        <span className="bv">{item.tasks_completed}</span>
                      </div>
                      <div
                        className="bar"
                        style={{
                          height: `${reportPct}%`,
                          background: item.reports > 0 ? 'var(--lime-deep)' : 'rgba(216, 234, 44, 0.25)',
                        }}
                      >
                        <span className="bv">{item.reports}</span>
                      </div>
                    </div>
                    <div
                      className="bar-day"
                      style={isToday ? { color: 'var(--violet)', fontWeight: 800 } : undefined}
                    >
                      {item.day}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribution Section */}
          <div className="card" style={{ padding: '22px', marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Distribusi Beban Kerja per Divisi
            </h3>
            <p className="section-sub" style={{ margin: '0 0 16px' }}>
              Persentase porsi pengerjaan tim kreatif di database
            </p>

            {data.division_distribution && data.division_distribution.length > 0 ? (
              data.division_distribution.map((div, i) => (
                <div key={i} className="dist-row">
                  <div className="dist-ic" style={{ background: 'var(--lavender)' }}>
                    <Icon name="palette" />
                  </div>
                  <div className="dist-label">{div.division}</div>
                  <div className="dist-track">
                    <div
                      className="dist-fill"
                      style={{
                        width: `${div.percentage}%`,
                        background: div.color || 'var(--violet)',
                      }}
                    />
                  </div>
                  <div className="dist-val">{div.percentage}%</div>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: '13px',
                  background: 'var(--paper, #f9fafb)',
                  borderRadius: '10px',
                }}
              >
                Belum ada data distribusi beban kerja divisi.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Week Summary & Momentum */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px' }}>
              Ringkasan Efisiensi Minggu Ini
            </h3>

            <div className="week-stat-row">
              <div className="ws-ic">
                <Icon name="clock" />
              </div>
              <div>
                <div className="ws-num">{data.total_hours} Jam</div>
                <div className="ws-lbl">Jam Kerja Efektif</div>
              </div>
            </div>

            <div className="week-stat-row">
              <div className="ws-ic">
                <Icon name="check" />
              </div>
              <div>
                <div className="ws-num">
                  {data.reports.completed} / {data.reports.total}
                </div>
                <div className="ws-lbl">Laporan Disetujui Langsung</div>
              </div>
            </div>

            <div className="week-stat-row">
              <div className="ws-ic">
                <Icon name="target" />
              </div>
              <div>
                <div className="ws-num">{data.deadline_accuracy}%</div>
                <div className="ws-lbl">Skor Produktivitas &amp; Deadline</div>
              </div>
            </div>
          </div>

          {/* Momentum Card */}
          <div className="momentum-card">
            <div className="momentum-big">
              <span>{data.deadline_accuracy}%</span>
              <span style={{ fontSize: '20px' }}>🚀</span>
            </div>
            <h3>Sprint Momentum Tim</h3>
            <p>
              Tingkat penyelesaian deliverable dan kepatuhan tenggat waktu dihitung real-time dari database.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#fff', color: 'var(--violet-ink)' }}
              onClick={() => onNavigate('reports')}
            >
              Lihat Laporan Terkini
            </button>
          </div>
        </div>
      </div>

      {/* ================= PREVIEW CETAK & DOKUMEN REKAP MODAL (MULTI-PAGE) ================= */}
      {isPreviewModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12, 11, 16, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease',
            willChange: 'opacity',
          }}
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              background: '#0c0b10',
              color: '#fff',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span>PREVIEW CETAK &amp; DOKUMEN REKAP</span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '4px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, color: '#e2e8f0' }}>
                A4 &bull; PORTRAIT &bull; Multi-Page Tim ({totalReportsCount} Laporan)
              </div>
            </div>

            {/* Right Action Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Period Selectors */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '8px' }}>
                <select
                  style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: '12.5px', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value} style={{ color: '#14131a' }}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: '12.5px', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  <option value={2026} style={{ color: '#14131a' }}>2026</option>
                  <option value={2025} style={{ color: '#14131a' }}>2025</option>
                  <option value={2027} style={{ color: '#14131a' }}>2027</option>
                </select>
              </div>

              {/* Print / Save PDF */}
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <span>🖨️ Cetak / Save PDF</span>
              </button>

              {/* Export JPEG */}
              <button
                type="button"
                onClick={() => handleExport('jpg')}
                style={{
                  background: '#9333ea',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>🖼️ Export JPEG</span>
              </button>

              {/* Excel */}
              <button
                type="button"
                onClick={() => handleExport('excel')}
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>📊 Excel</span>
              </button>

              {/* Word */}
              <button
                type="button"
                onClick={() => handleExport('word')}
                style={{
                  background: '#fff',
                  color: '#14131a',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>📄 Word</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: 'none',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
                title="Tutup Preview"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modal Body / Multi-Page Iframe Preview */}
          <div
            style={{
              flex: 1,
              background: '#2b2f3a',
              overflowY: 'auto',
              padding: '40px 16px',
              display: 'flex',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '210mm',
                maxWidth: '100%',
                minHeight: '297mm',
                background: '#eceef2',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {isIframeLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 10 }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#64748b' }}>Memuat dokumen rekap multi-page tim...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={exportUrl}
                title="Print Preview Multi-Page"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '297mm',
                  border: 'none',
                  display: 'block',
                }}
                onLoad={() => setIsIframeLoading(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
