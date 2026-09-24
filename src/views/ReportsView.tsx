import React, { useState } from 'react';
import { Report, ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';

interface ReportsViewProps {
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  reports,
  onNavigate,
  onSelectReport,
}) => {
  const [filterTab, setFilterTab] = useState<'All' | 'In Review' | 'In Progress' | 'Completed'>('All');
  const [search, setSearch] = useState('');

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

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Laporan Kerja Harian</h1>
          <p className="sub">
            Catatan progres, milestone, dan aktivitas seluruh tim kreatif Wee Studio.
          </p>
        </div>
        <div>
          <button className="btn btn-dark" onClick={() => onNavigate('create-report')}>
            <Icon name="plus" />
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
          {filteredReports.length === 0 ? (
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
                  <Icon name="doc" />
                </div>
                <div className="rmid">
                  <b>{r.task}</b>
                  <span>
                    {r.person} &bull; {r.project} &bull; {r.date} ({r.progress}%)
                  </span>
                </div>
                <span className={`rstat ${r.status.replace(/\s+/g, '')}`}>
                  {r.status}
                </span>
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
              className="btn btn-dark"
              style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
              onClick={() => onNavigate('create-report')}
            >
              <Icon name="plus" />
              <span>Submit Laporan Hari Ini</span>
            </button>
          </div>

          <div className="promo-card">
            <div>
              <h3>Review Cepat Tanpa Ribet</h3>
              <p>Project lead dapat langsung menyetujui atau meminta revisi laporan sekali klik.</p>
            </div>
            <div className="promo-illus">
              <Illustration kind="clipboard" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
