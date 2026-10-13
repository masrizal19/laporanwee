import React, { useState, useEffect, useRef } from 'react';
import { AnalyticsSummary, ViewType, AuthUser } from '../types';
import { Icon } from '../components/icons';
import { analyticsService, getStoredToken, getStoredUser } from '../utils/api';

interface AnalyticsViewProps {
  analytics?: AnalyticsSummary;
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
  onRefresh?: () => void;
  currentUser?: AuthUser | null;
  isAdmin?: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics: propAnalytics,
  onNavigate,
  onAddToast,
  onRefresh,
  currentUser: propCurrentUser,
  isAdmin: propIsAdmin,
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
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const previewPrintRef = useRef<HTMLIFrameElement>(null);

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

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUser = propCurrentUser || getStoredUser();
  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : Boolean(
    currentUser?.role?.toLowerCase() === 'admin' || (currentUser as any)?.is_admin === true
  );

  const handleExportPdf = () => {
    const url = `/analitik/exporlaporan?month=${selectedMonth}&year=${selectedYear}`;
    window.open(url, '_blank');
    setIsExportOpen(false);
    onAddToast(`Membuka preview cetak laporan bulan ${selectedMonth}/${selectedYear}...`);
  };

  const handleExportJpg = () => {
    const token = getStoredToken() || localStorage.getItem('laporanwee_token') || localStorage.getItem('auth_token') || '';
    const url = `https://api-laporanwe.mkverse.my.id/api/analytics/export.php?format=jpg&month=${selectedMonth}&year=${selectedYear}&token=${token}`;
    window.open(url, '_blank');
    setIsExportOpen(false);
    onAddToast(`Mengekspor gambar laporan (.jpg) bulan ${selectedMonth}/${selectedYear}...`);
  };

  const handleEditDesign = () => {
    const url = `/analitik/editlaporan?month=${selectedMonth}&year=${selectedYear}`;
    window.open(url, '_blank');
    setIsExportOpen(false);
    onAddToast('Membuka editor desain rekap laporan...');
  };

  const handlePrint = () => {
    window.print();
    onAddToast('Membuka dialog cetak / Simpan PDF...');
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

          {/* Export Dropdown (Strictly PDF and JPG) */}
          <div ref={exportDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => setIsExportOpen(!isExportOpen)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="doc" style={{ width: 16, height: 16 }} />
              <span>Ekspor Laporan</span>
              <Icon name="chevD" style={{ width: 12, height: 12 }} />
            </button>

            {isExportOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: '#fff',
                  border: '1px solid var(--line-soft)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px rgba(20, 19, 26, 0.15)',
                  zIndex: 50,
                  minWidth: '220px',
                  overflow: 'hidden',
                  animation: 'fadeInUp 0.15s ease',
                  willChange: 'transform, opacity',
                }}
              >
                <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--line-soft)' }}>
                  PILIH FORMAT EKSPOR
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,85,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Icon name="doc" style={{ width: 14, height: 14, color: '#3b82f6' }} />
                  <span>Cetak / Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJpg}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,85,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Icon name="image" style={{ width: 14, height: 14, color: '#9333ea' }} />
                  <span>Export Gambar (.jpg)</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleEditDesign}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'none',
                      borderTop: '1px solid var(--line-soft)',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0a7a58',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,122,88,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span>🎨 Edit Desain Laporan</span>
                  </button>
                )}
              </div>
            )}
          </div>
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

      {/* ================= PREVIEW CETAK & DOKUMEN REKAP MODAL (PORTRAIT / LANDSCAPE) ================= */}
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
                A4 &bull; {orientation.toUpperCase()} &bull; {totalReportsCount} Laporan
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

              {/* Orientation Switcher */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  style={{
                    background: orientation === 'portrait' ? '#4a62a8' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  style={{
                    background: orientation === 'landscape' ? '#4a62a8' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Landscape
                </button>
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
                }}
              >
                <span>🖨️ Cetak / Save PDF</span>
              </button>

              {/* Export JPEG */}
              <button
                type="button"
                onClick={handleExportJpg}
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

          <div
            style={{
              flex: 1,
              background: '#15171d',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              ref={previewPrintRef}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#8a8c93',
              }}
              srcDoc={`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan Kerja Tim - Mode Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--blue:#4a62a8;--blue-deep:#3d5296;--blue-soft:#6f84c4;--paper:#eceef2;--card:#f6f7fa;--ink:#2b2f3a;--muted:#707586;--line:#cfd3dc;--accent:#e0566b}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Poppins,system-ui,sans-serif;background:#8a8c93;color:var(--ink);font-size:12px;line-height:1.5}

.bar{position:sticky;top:0;z-index:50;background:#15171d;color:#fff;display:flex;align-items:center;gap:14px;padding:10px 20px;flex-wrap:wrap}
.bar b{font-weight:600;font-size:13px;margin-right:auto}
.bar small{opacity:.6;font-size:11px}
.bar select,.bar button{font:inherit;font-size:12px;border-radius:10px;border:0;padding:8px 14px}
.bar select{background:#262a33;color:#fff}
.bar button{background:var(--blue);color:#fff;font-weight:600;cursor:pointer}
.bar button:hover{background:var(--blue-soft)}
.bar :focus-visible{outline:2px solid #fff;outline-offset:2px}

#doc{padding:26px 12px;overflow-x:auto}

.page{width:${orientation === 'landscape' ? '297mm' : '210mm'};height:${orientation === 'landscape' ? '210mm' : '297mm'};margin:0 auto 26px;background:var(--paper);box-shadow:0 18px 50px rgba(0,0,0,.35);position:relative;overflow:hidden}
.top{background:var(--blue);color:#fff;padding:38px 44px 118px;position:relative;border-radius:0 0 46px 0;overflow:hidden}
.top.sm{padding:24px 44px 78px}
.top::before{content:"";position:absolute;right:-60px;top:-90px;width:380px;height:240px;background:var(--blue-deep);border-radius:0 0 0 220px;opacity:.7}
.top::after{content:"";position:absolute;left:-70px;bottom:-60px;width:220px;height:220px;background:var(--blue-soft);border-radius:50%;opacity:.25}
.top>*{position:relative;z-index:1}
.row{display:flex;justify-content:space-between;gap:24px}
.brand{display:flex;gap:12px;align-items:center}
.dots{display:grid;grid-template-columns:repeat(3,6px);gap:4px}
.dots i{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.brand b{display:block;font-size:22px;font-weight:700;letter-spacing:.5px;line-height:1.1}
.brand small{font-size:9px;letter-spacing:1.5px;opacity:.85}
.contact{font-size:10.5px;opacity:.9}
.contact b{display:block;font-size:12px;margin-bottom:3px}
.info{margin-top:40px}
.info small{display:block;font-size:11px;opacity:.75}
.info b{display:block;font-size:16px;font-weight:600}
.info span{font-size:11px;opacity:.85}
.dates{display:flex;gap:34px}

.content{padding:0 36px;margin-top:-76px;position:relative;z-index:2}
.top.sm+.content{margin-top:-50px}
.thead,.mrow{display:grid;grid-template-columns:90px 1.1fr 1.6fr}
.thead{background:var(--card);border-radius:22px;height:62px;box-shadow:0 10px 22px rgba(30,40,80,.18),inset 0 -2px 0 rgba(255,255,255,.7);font-weight:600;font-size:11.5px}
.thead div{display:flex;align-items:center;justify-content:center;position:relative;text-align:center}
.thead div+div::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:var(--line)}

.week{display:flex;justify-content:space-between;align-items:center;margin:22px 12px 4px;padding-bottom:5px;border-bottom:1.5px solid var(--blue);font-size:11px}
.week b{color:var(--blue);font-weight:700;font-size:12.5px}
.week span{color:var(--muted)}
.item{display:grid;grid-template-columns:90px 1.1fr 1.6fr;border-bottom:1px solid var(--line);min-height:108px}
.item .d{padding:14px 6px;text-align:center;font-weight:600;color:var(--blue);display:flex;flex-direction:column;align-items:center}
.item .d small{font-weight:400;color:var(--muted);font-size:10px}
.item .n{padding:14px 16px;display:flex;flex-direction:column;justify-content:center;border-left:1px solid var(--line)}
.item .n b{font-weight:600;font-size:12px}
.item .n small{color:var(--muted);font-size:10.5px;margin-top:2px}
.tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.tagp{font-size:9.5px;font-weight:600;padding:2px 10px;border-radius:20px;background:#dfe5f6;color:var(--blue-deep)}
.tagp.ok{background:#d6f0e4;color:#0a7a58}.tagp.rv{background:#fbe8bd;color:#946000}.tagp.pg{background:#e4defa;color:#5b3fd1}
.item .g{padding:12px;border-left:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap;align-content:center}
.shot{flex:1 1 90px;max-width:150px;aspect-ratio:4/3;border-radius:10px;background:linear-gradient(135deg,#d6dcee,#b3bfe0) center/cover no-repeat;border:2px solid #fff;box-shadow:0 2px 6px rgba(30,40,80,.15)}

.recap{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:24px;align-items:start}
.box{border:1px solid var(--line);border-radius:18px;padding:16px 20px;background:rgba(255,255,255,.35)}
.box h4{font-size:10.5px;font-weight:700;margin-bottom:8px}
.kv{display:grid;grid-template-columns:100px 1fr;font-size:10.5px;gap:2px 8px;color:#4a4f5e}
.sum .line{display:flex;justify-content:space-between;padding:8px 18px;font-size:11.5px;border-bottom:1px solid var(--line)}
.sum .line b{font-weight:600}
.total{display:flex;justify-content:space-between;background:var(--blue);color:#fff;border-radius:14px;padding:11px 20px;font-weight:600;margin-top:10px;box-shadow:0 8px 18px rgba(74,98,168,.35)}
.sign{margin:30px 0 0 auto;width:55%;text-align:center;font-size:11px;color:var(--muted);border-top:1px solid var(--line);padding-top:6px}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 22px}
.stat{background:var(--card);border-radius:16px;padding:14px 16px;box-shadow:0 6px 16px rgba(30,40,80,.1)}
.stat.hl{background:var(--blue);color:#fff;box-shadow:0 10px 22px rgba(74,98,168,.4)}
.stat strong{display:block;font-size:24px;font-weight:700;line-height:1.1}
.stat span{font-size:10.5px;opacity:.75}
.c6{grid-template-columns:1.7fr .6fr .6fr .6fr .8fr .8fr}
.mrow{border-bottom:1px solid var(--line);padding:13px 0;font-size:11.5px;align-items:center;text-align:center}
.mrow div:first-child{text-align:left;padding-left:18px}
.mrow b{display:block;font-weight:600}
.mrow small{color:var(--muted);font-size:10px}
.pbar{height:6px;border-radius:6px;background:#dfe2ea;margin:4px 14px 0;overflow:hidden}
.pbar i{display:block;height:100%;background:var(--blue)}

.pgno{position:absolute;left:36px;right:36px;bottom:18px;background:var(--blue);color:#fff;text-align:center;font-size:10.5px;padding:7px;border-radius:30px}

@page{size:A4 ${orientation};margin:0}
@media print{
  body{background:#fff}
  .bar{display:none}
  #doc{padding:0;overflow:visible}
  .page{margin:0;box-shadow:none;break-after:page}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>

<div class="bar">
  <b>Laporan Kerja Tim · Mode Admin</b>
  <small id="meta"></small>
  <select id="filter" aria-label="Pilih anggota"></select>
  <button id="print">Cetak / Simpan PDF</button>
</div>
<div id="doc"></div>

<script>
const REPORT = {
  label: '${monthName} ${selectedYear}', year: ${selectedYear}, month: ${selectedMonth - 1},
  weeks: [[1,7],[8,14],[15,21],[22,31]],
  printed: '13 Oktober 2026',
  members: [
    {name:'Rizal Fadhilah', role:'Videografer & Editor', tasks:[
      [1,'Dokumentasi dan edit kegiatan emka','Foto kegiatan dan hasil edit','C',3,'Instagram'],
      [2,'DOKUMENTASI SUSASANA PSB','Dokumentasi penerimaan siswa baru','C',2,''],
      [3,'Edit video recap hari pertama PSB','Video 1 menit untuk feed','C',2,'TikTok'],
      [6,'Desain poster jadwal ujian','Poster A3 dan versi feed','C',2,'Instagram'],
      [7,'Dokumentasi upacara senin','','C',3,''],
      [8,'Mencari sound untuk opening futsal','Seleksi dan edit audio','C',1,''],
      [9,'Desain seleksi Jaka Dara','Poster dan feed pengumuman','C',3,'Instagram'],
      [10,'Edit teaser PORSENIK','Video teaser 30 detik','C',2,'TikTok'],
      [13,'Info lomba videografi','Thumbnail dan deskripsi','C',2,'YouTube'],
      [14,'Dokumentasi technical meeting','','C',2,''],
      [16,'Desain banner pembukaan PORSENIK','Banner 3 x 1 meter','R',2,''],
      [20,'Edit highlight pertandingan futsal','Video highlight 2 menit','P',1,'YouTube'],
      [23,'Konten penutupan PORSENIK','Carousel 5 slide','R',3,'Instagram'],
      [27,'Rekap dokumentasi bulanan','Arsip foto dan video','P',1,'']]},
    {name:'Farel Haqqi', role:'Desainer Grafis', tasks:[
      [2,'Membuat tanggal dan bulan (1 dan 2)','Aset kalender digital','C',2,''],
      [8,'Desain feed pengumuman lomba','','C',2,'Instagram'],
      [15,'Template kalender Agustus','','C',3,''],
      [21,'Desain sertifikat PORSENIK','Format A4','R',1,''],
      [28,'Desain merchandise tim','','P',2,'']]},
    {name:'Zaiyana Shofiya', role:'Konten Kreator', tasks:[
      [3,'Informasi ulang tahun Mhd. Nizam Nabawi','Template ucapan','C',1,'Instagram'],
      [10,'Informasi ulang tahun Mhd Farhan','Template ucapan','C',1,'Instagram'],
      [17,'Caption dan jadwal posting mingguan','','C',2,'Instagram'],
      [24,'Konten edukasi singkat','Carousel 4 slide','C',3,'TikTok']]},
    {name:'Muhammad Rafa', role:'Editor Berita', tasks:[
      [4,'Info lomba videografi','Materi pengumuman','C',2,'YouTube'],
      [9,'Berita pendidikan dan umum','Naskah dan thumbnail','C',2,'YouTube'],
      [15,'Polemik komisi X DPR (TV Desain Berita)','Thumbnail berita','C',1,'TikTok'],
      [22,'Edit video liputan upacara','','C',2,'YouTube'],
      [29,'Berita pekan terakhir Juli','','R',1,'']]},
    {name:'Nadia Putri', role:'Admin Media', tasks:[
      [5,'Arsip aset desain bulan lalu','','C',1,''],
      [12,'Update jadwal posting','','C',1,'Instagram'],
      [19,'Rekap insight media sosial','Screenshot insight','C',3,''],
      [26,'Penjadwalan konten Agustus','','P',1,'Instagram']]}
  ]
};

const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ST={C:['Completed','ok',100],R:['In Review','rv',85],P:['In Progress','pg',60]};
const PLAT=['Instagram','TikTok','YouTube'];
const $doc=document.getElementById('doc');
const RES=66;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const el=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild};
const weekOf=d=>REPORT.weeks.findIndex(w=>d>=w[0]&&d<=w[1]);

function stats(m){
  const t=m.tasks, n=t.length;
  const done=t.filter(x=>x[3]==='C').length;
  const prog=n?Math.round(t.reduce((a,x)=>a+ST[x[3]][2],0)/n):0;
  const sos={};PLAT.forEach(p=>sos[p]=t.filter(x=>x[5]===p).length);
  const wk=REPORT.weeks.map((_,i)=>t.filter(x=>weekOf(x[0])===i).length);
  return {n,done,prog,sos,sosTotal:t.filter(x=>x[5]).length,wk};
}

const HEAD_BRAND='<div class="brand"><div class="dots"><i></i><i></i><i></i><i></i><i></i><i></i></div><div><b>WEE LAPORAN</b><small>LAPORAN KERJA HARIAN</small></div></div>';

function newPage(headHTML,small,theadHTML){
  const p=el('<section class="page"><header class="top' + (small ? ' sm' : '') + '">' + headHTML + '</header><main class="content">' + theadHTML + '<div class="body"></div></main><div class="pgno"></div></section>');
  $doc.appendChild(p);return p;
}
const THEAD='<div class="thead"><div>Tanggal</div><div>Nama Pekerjaan</div><div>Desain/Gambar</div></div>';

function overflowing(page){
  const last=page.querySelector('.body').lastElementChild; if(!last) return false;
  const pr=page.getBoundingClientRect();
  return last.getBoundingClientRect().bottom > pr.top+pr.height-RES;
}

function itemEl(t){
  const [d,title,desc,st,img,plat]=t, s=ST[st];
  const wd=DAYS[new Date(REPORT.year,REPORT.month,d).getDay()];
  const shots=(Array.isArray(img)?img:Array(img).fill('')).map(u=>'<div class="shot"' + (u ? ' style="background-image:url(\'' + esc(u) + '\')"' : '') + '></div>').join('');
  return el('<div class="item"><div class="d">' + d + '/' + (REPORT.month+1) + '/' + REPORT.year + '<small>' + wd + '</small></div>' +
    '<div class="n"><b>' + esc(title) + '</b>' + (desc ? '<small>' + esc(desc) + '</small>' : '') +
    '<div class="tags"><span class="tagp ' + s[1] + '">' + s[0] + '</span>' + (plat ? '<span class="tagp">' + plat + '</span>' : '') + '</div></div>' +
    '<div class="g">' + shots + '</div></div>');
}
const weekEl=(i,cont)=>{const w=REPORT.weeks[i];return el('<div class="week"><b>Minggu ' + (i+1) + (cont ? ' (lanjutan)' : '') + '</b><span>' + w[0] + ' - ' + w[1] + ' ' + REPORT.label + '</span></div>')};

function buildMember(m){
  const s=stats(m), first=$doc.children.length;
  const fullHead='<div class="row">' + HEAD_BRAND + '<div class="contact"><b>Wee Studio</b>Laporan kerja bulanan<br>Dicetak ' + REPORT.printed + '</div></div>' +
    '<div class="row info"><div><small>Laporan kerja oleh</small><b>' + esc(m.name) + '</b><span>' + esc(m.role) + '</span></div>' +
    '<div class="dates"><div><small>Periode</small><b>' + REPORT.label + '</b><span>' + s.n + ' pekerjaan</span></div></div></div>';
  const contHead='<div class="row">' + HEAD_BRAND + '<div class="contact"><b>' + esc(m.name) + '</b>Lanjutan laporan ' + REPORT.label + '</div></div>';
  let cur=newPage(fullHead,false,THEAD);
  const place=units=>{
    const body=()=>cur.querySelector('.body');
    units.forEach(u=>body().appendChild(u));
    if(overflowing(cur)&&body().children.length>units.length){
      units.forEach(u=>u.remove());
      cur=newPage(contHead,true,THEAD);
      if(units[0].classList.contains('item')&&units[0].dataset.w) units.unshift(weekEl(+units[0].dataset.w,true));
      units.forEach(u=>body().appendChild(u));
    }
  };
  let lastW=-1;
  [...m.tasks].sort((a,b)=>a[0]-b[0]).forEach(t=>{
    const w=weekOf(t[0]), it=itemEl(t); it.dataset.w=w;
    place(w!==lastW?[weekEl(w),it]:[it]); lastW=w;
  });
  const recap=el('<div><div class="recap">' +
    '<div class="box"><h4>REKAP SOSIAL MEDIA</h4><div class="kv">' +
    PLAT.map(p=>'<span>' + p + '</span><span>: ' + s.sos[p] + ' konten</span>').join('') +
    '<span>Total terbit</span><span>: ' + s.sosTotal + ' konten</span></div></div>' +
    '<div class="sum">' + s.wk.map((c,i)=>'<div class="line"><span>Minggu ' + (i+1) + '</span><b>' + c + ' pekerjaan</b></div>').join('') +
    '<div class="total"><span>Total Sebulan</span><span>' + s.n + ' pekerjaan</span></div></div></div>' +
    '<div class="sign">Disetujui oleh Project Lead</div></div>');
  place([recap]);
  return [first,$doc.children.length-1];
}

function buildCover(){
  const head='<div class="row">' + HEAD_BRAND + '<div class="contact"><b>Wee Studio</b>Mode administrator<br>Dicetak ' + REPORT.printed + '</div></div>' +
    '<div class="row info"><div><small>Laporan kerja seluruh anggota</small><b>Rekap Tim</b><span>' + REPORT.members.length + ' anggota</span></div>' +
    '<div class="dates"><div><small>Periode</small><b>' + REPORT.label + '</b><span>1 - 31</span></div></div></div>';
  const th='<div class="thead c6"><div>Anggota</div><div>Tugas</div><div>Selesai</div><div>Sosmed</div><div>Progres</div><div>Halaman</div></div>';
  return newPage(head,false,th);
}

function render(only){
  $doc.innerHTML='';
  const list=only==='all'?REPORT.members:REPORT.members.filter(m=>m.name===only);
  const cover=only==='all'?buildCover():null;
  const ranges=list.map(buildMember);
  const pages=[...$doc.children], N=pages.length;
  if(cover){
    const all=list.map(stats);
    const sum=k=>all.reduce((a,s)=>a+s[k],0);
    const avg=Math.round(all.reduce((a,s)=>a+s.prog,0)/(all.length||1));
    const rows=list.map((m,i)=>{const s=all[i],r=ranges[i];
      return '<div class="mrow c6"><div><b>' + esc(m.name) + '</b><small>' + esc(m.role) + '</small></div><div>' + s.n + '</div><div>' + s.done + '</div><div>' + s.sosTotal + '</div>' +
      '<div>' + s.prog + '%<div class="pbar"><i style="width:' + s.prog + '%"></i></div></div><div>' + (r[0]===r[1]?r[0]+1:(r[0]+1)+'-'+(r[1]+1)) + '</div></div>'}).join('');
    cover.querySelector('.content').insertAdjacentHTML('beforeend',
      '<div class="body">' + rows + '</div>' +
       '<div class="recap"><div class="box"><h4>REKAP SOSIAL MEDIA TIM</h4><div class="kv">' +
         PLAT.map(p=>'<span>' + p + '</span><span>: ' + all.reduce((a,s)=>a+s.sos[p],0) + ' konten</span>').join('') +
         '<span>Total terbit</span><span>: ' + sum('sosTotal') + ' konten</span></div></div>' +
         '<div class="sum"><div class="line"><span>Pekerjaan selesai</span><b>' + sum('done') + '</b></div>' +
         '<div class="line"><span>Rata-rata progres</span><b>' + avg + '%</b></div>' +
         '<div class="total"><span>Total Pekerjaan Tim</span><span>' + sum('n') + '</span></div></div></div>');
    cover.querySelectorAll('.body')[0].remove();
  }
  pages.forEach((p,i)=>{
    const name=cover&&i===0?'Rekap Tim':(list.find((m,k)=>i>=ranges[k][0]&&i<=ranges[k][1])||{}).name||'';
    p.querySelector('.pgno').textContent='Halaman ' + (i+1) + ' dari ' + N + ' · ' + name;
  });
  document.getElementById('meta').textContent=REPORT.label + ' · ' + list.length + ' anggota · ' + N + ' halaman';
}

const sel=document.getElementById('filter');
sel.innerHTML='<option value="all">Semua anggota</option>'+REPORT.members.map(m=>'<option>' + esc(m.name) + '</option>').join('');
sel.onchange=()=>render(sel.value);
document.getElementById('print').onclick=()=>window.print();
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(()=>render('all'));
</script>
</body>
</html>`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
