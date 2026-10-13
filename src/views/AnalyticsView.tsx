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
  const previewPrintRef = useRef<HTMLDivElement>(null);

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

  const handleExport = (format: 'excel' | 'word' | 'jpg') => {
    const token =
      localStorage.getItem('laporanwee_token') ||
      localStorage.getItem('auth_token') ||
      '';
    const downloadUrl = `https://api-laporanwe.mkverse.my.id/api/analytics/export.php?format=${format}&month=${selectedMonth}&year=${selectedYear}&token=${token}`;
    window.open(downloadUrl, '_blank');
    onAddToast(`Memulai unduhan laporan format ${format.toUpperCase()} (Bulan ${selectedMonth}/${selectedYear})...`);
  };

  const handlePrint = () => {
    window.print();
    onAddToast('Membuka dialog cetak dokumen rekap...');
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

  // Compute maximum value for relative bar heights
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

  const monthName = months.find((m) => m.value === selectedMonth)?.label || 'Oktober';
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

      {/* ================= PREVIEW CETAK & DOKUMEN REKAP MODAL ================= */}
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
                A4 &bull; PORTRAIT &bull; {totalReportsCount} Laporan
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

          {/* Modal Body / A4 Paper Sheet Preview */}
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
              ref={previewPrintRef}
              style={{
                width: '210mm',
                maxWidth: '100%',
                minHeight: '297mm',
                background: '#eceef2',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative',
                color: '#2b2f3a',
                fontFamily: 'Poppins, system-ui, sans-serif',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              {/* --- A4 Report Template Container --- */}
              <div style={{ background: '#4a62a8', color: '#fff', padding: '38px 44px 120px', position: 'relative', borderBottomRightRadius: '46px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 6px)', gap: '4px' }}>
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                      <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e0566b', display: 'block' }} />
                    </div>
                    <div>
                      <b style={{ display: 'block', fontSize: '22px', fontWeight: 700, letterSpacing: '.5px' }}>WEE LAPORAN</b>
                      <small style={{ fontSize: '9px', letterSpacing: '1.5px', opacity: .85 }}>LAPORAN KERJA HARIAN</small>
                    </div>
                  </div>
                  <div style={{ fontSize: '10.5px', opacity: .9, textAlign: 'left' }}>
                    <b style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Wee Studio</b>
                    Medan, Sumatera Utara<br />rizalsaragih498@gmail.com
                  </div>
                </div>
                <div style={{ marginTop: '44px', display: 'flex', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <small style={{ display: 'block', fontSize: '11px', opacity: .75 }}>Laporan kerja oleh</small>
                    <b style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>Rizal Fadhilah</b>
                    <span style={{ fontSize: '11px', opacity: .85 }}>Tim Kreatif - Wee Studio</span>
                  </div>
                  <div style={{ display: 'flex', gap: '34px' }}>
                    <div>
                      <small style={{ display: 'block', fontSize: '11px', opacity: .75 }}>Periode</small>
                      <b style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>{monthName} {selectedYear}</b>
                      <span style={{ fontSize: '11px', opacity: .85 }}>1 - 31 {monthName}</span>
                    </div>
                    <div>
                      <small style={{ display: 'block', fontSize: '11px', opacity: .75 }}>Dicetak</small>
                      <b style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>13 Okt</b>
                      <span style={{ fontSize: '11px', opacity: .85 }}>{selectedYear}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Content */}
              <div style={{ padding: '0 36px 20px', marginTop: '-78px', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1.1fr 1.6fr', background: '#f6f7fa', borderRadius: '22px', height: '64px', boxShadow: '0 10px 22px rgba(30,40,80,.18), inset 0 -2px 0 rgba(255,255,255,.7)', fontWeight: 600, fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Tanggal</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Nama Pekerjaan</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Desain/Gambar</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '26px 12px 6px', paddingBottom: '6px', borderBottom: '1.5px solid #4a62a8', fontSize: '11px' }}>
                  <b style={{ color: '#4a62a8', fontWeight: 700, fontSize: '12.5px' }}>Minggu 1</b>
                  <span style={{ color: '#707586' }}>1 - 7 {monthName} {selectedYear}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '90px 1.1fr 1.6fr', borderBottom: '1px solid #cfd3dc', minHeight: '112px', background: '#fff', borderRadius: '12px', marginBottom: '10px' }}>
                  <div style={{ padding: '14px 6px', textAlign: 'center', fontWeight: 600, color: '#4a62a8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    1/{selectedMonth === 10 ? '10' : selectedMonth}/{selectedYear}
                    <small style={{ fontWeight: 400, color: '#707586', fontSize: '10px' }}>Rabu</small>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #cfd3dc' }}>
                    <b style={{ fontWeight: 600, fontSize: '12px' }}>Dokumentasi dan edit kegiatan emka</b>
                    <small style={{ color: '#707586', fontSize: '10.5px', marginTop: '2px' }}>Foto kegiatan dan hasil edit</small>
                    <span style={{ display: 'inline-block', alignSelf: 'flex-start', marginTop: '8px', fontSize: '9.5px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: '#dfe5f6', color: '#3d5296' }}>Completed</span>
                  </div>
                  <div style={{ padding: '12px', borderLeft: '1px solid #cfd3dc', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 90px', maxWidth: '150px', aspectRatio: '4/3', borderRadius: '10px', background: 'linear-gradient(135deg,#d6dcee,#b3bfe0) center/cover no-repeat', border: '2px solid #fff' }} />
                    <div style={{ flex: '1 1 90px', maxWidth: '150px', aspectRatio: '4/3', borderRadius: '10px', background: 'linear-gradient(135deg,#d6dcee,#b3bfe0) center/cover no-repeat', border: '2px solid #fff' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '26px 12px 6px', paddingBottom: '6px', borderBottom: '1.5px solid #4a62a8', fontSize: '11px' }}>
                  <b style={{ color: '#4a62a8', fontWeight: 700, fontSize: '12.5px' }}>Minggu 2</b>
                  <span style={{ color: '#707586' }}>8 - 14 {monthName} {selectedYear}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '90px 1.1fr 1.6fr', borderBottom: '1px solid #cfd3dc', minHeight: '112px', background: '#fff', borderRadius: '12px', marginBottom: '10px' }}>
                  <div style={{ padding: '14px 6px', textAlign: 'center', fontWeight: 600, color: '#4a62a8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    8/{selectedMonth === 10 ? '10' : selectedMonth}/{selectedYear}
                    <small style={{ fontWeight: 400, color: '#707586', fontSize: '10px' }}>Rabu</small>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #cfd3dc' }}>
                    <b style={{ fontWeight: 600, fontSize: '12px' }}>DOKUMENTASI SUASANA PSB</b>
                    <small style={{ color: '#707586', fontSize: '10.5px', marginTop: '2px' }}>Dokumentasi penerimaan siswa baru</small>
                    <span style={{ display: 'inline-block', alignSelf: 'flex-start', marginTop: '8px', fontSize: '9.5px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: '#dfe5f6', color: '#3d5296' }}>Completed</span>
                  </div>
                  <div style={{ padding: '12px', borderLeft: '1px solid #cfd3dc', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 90px', maxWidth: '150px', aspectRatio: '4/3', borderRadius: '10px', background: 'linear-gradient(135deg,#d6dcee,#b3bfe0) center/cover no-repeat', border: '2px solid #fff' }} />
                  </div>
                </div>
              </div>

              {/* Recap Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', padding: '10px 36px 8px', alignItems: 'start' }}>
                <div style={{ border: '1px solid #cfd3dc', borderRadius: '18px', padding: '18px 20px', background: 'rgba(255,255,255,.35)' }}>
                  <h4 style={{ fontSize: '10.5px', fontWeight: 700, marginBottom: '8px', letterSpacing: '.3px' }}>REKAP SOSIAL MEDIA</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', fontSize: '10.5px', gap: '2px 8px', color: '#4a4f5e' }}>
                    <span>Instagram</span><span>: 8 konten</span>
                    <span>TikTok</span><span>: 4 konten</span>
                    <span>YouTube</span><span>: 3 konten</span>
                    <span>Total terbit</span><span>: 15 konten</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#707586', marginTop: '14px' }}>Bukti unggahan (screenshot) dilampirkan pada kolom Desain/Gambar di tanggal terkait.</p>
                </div>

                <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #cfd3dc', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', fontSize: '11.5px', borderBottom: '1px solid #cfd3dc' }}><span>Minggu 1</span><b style={{ fontWeight: 600 }}>7 pekerjaan</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', fontSize: '11.5px', borderBottom: '1px solid #cfd3dc' }}><span>Minggu 2</span><b style={{ fontWeight: 600 }}>8 pekerjaan</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', fontSize: '11.5px', borderBottom: '1px solid #cfd3dc' }}><span>Minggu 3</span><b style={{ fontWeight: 600 }}>6 pekerjaan</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', fontSize: '11.5px' }}><span>Minggu 4</span><b style={{ fontWeight: 600 }}>5 pekerjaan</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: '#4a62a8', color: '#fff', borderRadius: '14px', padding: '12px 20px', fontWeight: 600, margin: '10px', boxShadow: '0 8px 18px rgba(74,98,168,.35)' }}><span>Total Sebulan</span><span>{totalReportsCount} pekerjaan</span></div>
                </div>
              </div>

              <div style={{ padding: '0 36px', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ margin: '42px 0 0 auto', width: '60%', textAlign: 'center', fontSize: '11px', color: '#707586', borderTop: '1px solid #cfd3dc', paddingTop: '8px' }}>Disetujui oleh Project Lead</div>
              </div>
              <div style={{ margin: '26px 36px 28px', background: '#4a62a8', color: '#fff', textAlign: 'center', fontSize: '10.5px', padding: '10px', borderRadius: '30px' }}>Terima kasih atas kerja kerasnya</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
