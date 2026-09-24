import React from 'react';
import { ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';

interface AnalyticsViewProps {
  onNavigate: (view: ViewType) => void;
  onAddToast: (text: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onNavigate, onAddToast }) => {
  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Statistik &amp; Analitik Kinerja Tim</h1>
          <p className="sub">
            Evaluasi kecepatan sprint, konsistensi pelaporan harian, dan distribusi beban kerja tim.
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => onAddToast('Mengunduh laporan analitik bulanan (PDF)...')}
        >
          <Icon name="doc" />
          <span>Ekspor Laporan (PDF)</span>
        </button>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">142 Jam</div>
            <div className="lbl">Total Jam Kerja</div>
          </div>
        </div>
        <div className="stat-chip c-lav">
          <div className="ic">
            <Icon name="checksq" />
          </div>
          <div>
            <div className="num">24</div>
            <div className="lbl">Laporan Disetujui</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">98.2%</div>
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
              {/* Senin */}
              <div className="bar-group">
                <div className="bars">
                  <div className="bar" style={{ height: '55%', background: 'var(--violet)' }}>
                    <span className="bv">14</span>
                  </div>
                  <div className="bar" style={{ height: '40%', background: 'var(--lime-deep)' }}>
                    <span className="bv">10</span>
                  </div>
                </div>
                <div className="bar-day">Senin</div>
              </div>

              {/* Selasa */}
              <div className="bar-group">
                <div className="bars">
                  <div className="bar" style={{ height: '70%', background: 'var(--violet)' }}>
                    <span className="bv">18</span>
                  </div>
                  <div className="bar" style={{ height: '50%', background: 'var(--lime-deep)' }}>
                    <span className="bv">13</span>
                  </div>
                </div>
                <div className="bar-day">Selasa</div>
              </div>

              {/* Rabu (Today) */}
              <div className="bar-group">
                <div className="bars">
                  <div className="bar" style={{ height: '90%', background: 'var(--violet)' }}>
                    <span className="bv">24</span>
                  </div>
                  <div className="bar" style={{ height: '75%', background: 'var(--lime-deep)' }}>
                    <span className="bv">19</span>
                  </div>
                </div>
                <div className="bar-day" style={{ color: 'var(--violet)', fontWeight: 800 }}>Rabu</div>
              </div>

              {/* Kamis */}
              <div className="bar-group">
                <div className="bars">
                  <div className="bar" style={{ height: '60%', background: 'var(--violet)' }}>
                    <span className="bv">15</span>
                  </div>
                  <div className="bar" style={{ height: '45%', background: 'var(--lime-deep)' }}>
                    <span className="bv">11</span>
                  </div>
                </div>
                <div className="bar-day">Kamis</div>
              </div>

              {/* Jumat */}
              <div className="bar-group">
                <div className="bars">
                  <div className="bar" style={{ height: '80%', background: 'var(--violet)' }}>
                    <span className="bv">21</span>
                  </div>
                  <div className="bar" style={{ height: '65%', background: 'var(--lime-deep)' }}>
                    <span className="bv">16</span>
                  </div>
                </div>
                <div className="bar-day">Jumat</div>
              </div>
            </div>
          </div>

          {/* Distribution Section */}
          <div className="card" style={{ padding: '22px', marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Distribusi Beban Kerja per Divisi
            </h3>
            <p className="section-sub" style={{ margin: '0 0 16px' }}>
              Persentase porsi pengerjaan tim kreatif di bulan Oktober
            </p>

            <div className="dist-row">
              <div className="dist-ic" style={{ background: 'var(--lavender)' }}>
                <Icon name="palette" />
              </div>
              <div className="dist-label">Desain &amp; Branding</div>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: '38%', background: 'var(--violet)' }} />
              </div>
              <div className="dist-val">38%</div>
            </div>

            <div className="dist-row">
              <div className="dist-ic" style={{ background: 'var(--mint)' }}>
                <Icon name="video" />
              </div>
              <div className="dist-label">Video &amp; Motion</div>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: '26%', background: '#1e6e56' }} />
              </div>
              <div className="dist-val">26%</div>
            </div>

            <div className="dist-row">
              <div className="dist-ic" style={{ background: 'var(--pink)' }}>
                <Icon name="camera" />
              </div>
              <div className="dist-label">Fotografi Katalog</div>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: '20%', background: '#d64d7c' }} />
              </div>
              <div className="dist-val">20%</div>
            </div>

            <div className="dist-row">
              <div className="dist-ic" style={{ background: 'var(--cream)' }}>
                <Icon name="code" />
              </div>
              <div className="dist-label">Web &amp; Mobile Dev</div>
              <div className="dist-track">
                <div className="dist-fill" style={{ width: '16%', background: 'var(--ink)' }} />
              </div>
              <div className="dist-val">16%</div>
            </div>
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
                <div className="ws-num">142.5 Jam</div>
                <div className="ws-lbl">Jam Kerja Efektif</div>
              </div>
              <span className="ws-delta">+12.4%</span>
            </div>

            <div className="week-stat-row">
              <div className="ws-ic">
                <Icon name="check" />
              </div>
              <div>
                <div className="ws-num">24 / 26</div>
                <div className="ws-lbl">Laporan Disetujui Langsung</div>
              </div>
              <span className="ws-delta">+8.0%</span>
            </div>

            <div className="week-stat-row">
              <div className="ws-ic">
                <Icon name="target" />
              </div>
              <div>
                <div className="ws-num">96.5%</div>
                <div className="ws-lbl">Skor Produktivitas</div>
              </div>
              <span className="ws-delta">+3.1%</span>
            </div>
          </div>

          {/* Momentum Card */}
          <div className="momentum-card">
            <div className="momentum-big">
              <span>98.2%</span>
              <span style={{ fontSize: '20px' }}>🚀</span>
            </div>
            <h3>Sprint Momentum Tinggi</h3>
            <p>
              Tingkat penyelesaian deliverable tim meningkat 24% dibandingkan bulan lalu tanpa adanya laporan yang terlambat.
            </p>
            <button
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
