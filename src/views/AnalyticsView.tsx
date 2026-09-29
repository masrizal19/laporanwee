import React, { useState, useEffect } from 'react';
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

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Statistik &amp; Analitik Kinerja Tim</h1>
          <p className="sub">
            Evaluasi kecepatan sprint, konsistensi pelaporan harian, dan distribusi beban kerja tim.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            className="btn btn-outline"
            onClick={() => onAddToast('Mengunduh laporan analitik bulanan (PDF)...')}
          >
            <Icon name="doc" />
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
    </div>
  );
};
