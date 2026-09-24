import React, { useState } from 'react';
import { Project, ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';

interface DashboardViewProps {
  projects: Project[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onAddToast: (text: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onNavigate,
  onSelectProject,
  onAddToast,
}) => {
  const [filterTab, setFilterTab] = useState<'All' | 'Ongoing' | 'Completed' | 'Urgent'>('All');

  const filteredProjects = projects.filter((p) => {
    if (filterTab === 'Ongoing') return p.progress < 100;
    if (filterTab === 'Completed') return p.progress === 100;
    if (filterTab === 'Urgent') return p.due.includes('14') || p.due.includes('10');
    return true;
  });

  return (
    <div className="view">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Halo, Rangga! 👋</h1>
          <p className="sub">
            Rabu, 14 Oktober 2026 &bull; Pantau seluruh progres tim kreatif Wee Studio hari ini.
          </p>
        </div>
        <div className="head-stats">
          <div className="stat-chip c-mint">
            <div className="ic">
              <Icon name="folder" />
            </div>
            <div>
              <div className="num">6</div>
              <div className="lbl">Proyek Aktif</div>
            </div>
          </div>
          <div className="stat-chip c-lav">
            <div className="ic">
              <Icon name="checksq" />
            </div>
            <div>
              <div className="num">18</div>
              <div className="lbl">Tugas Berjalan</div>
            </div>
          </div>
          <div className="stat-chip c-pink">
            <div className="ic">
              <Icon name="target" />
            </div>
            <div>
              <div className="num">94%</div>
              <div className="lbl">Tingkat Selesai</div>
            </div>
          </div>
          <div className="stat-chip c-white">
            <div className="ic">
              <Icon name="users" />
            </div>
            <div>
              <div className="num">6</div>
              <div className="lbl">Anggota Tim</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Dashboard Grid */}
      <div className="dash-grid">
        {/* Left Column */}
        <div>
          {/* Feature Card */}
          <div className="feature-card">
            <div className="feature-illus float-idle">
              <Illustration kind="laptop" />
            </div>

            <div className="feature-mid">
              <div className="tag-row">
                <Icon name="palette" />
                <span>Desain &amp; Pengembangan Web</span>
              </div>
              <h3>Website Redesign Wee Agency</h3>
              <div className="feature-pct">74% Selesai &bull; Sprint 2</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: '74%' }} />
              </div>
            </div>

            <div className="feature-right">
              <div className="avatar-stack">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Rangga"
                />
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                  alt="Dimas"
                />
                <img
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80"
                  alt="Siti"
                />
                <div className="plus">+2</div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => onNavigate('create-report')}
                >
                  <Icon name="plus" />
                  <span>Buat Laporan</span>
                </button>
                <button
                  className="btn btn-dark btn-sm"
                  onClick={() => {
                    onSelectProject('p1');
                    onNavigate('project-detail');
                  }}
                >
                  <span>Buka Proyek</span>
                  <Icon name="arrowR" />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Pekerjaan Terbaru */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 className="section-title">Pekerjaan &amp; Proyek Terkini</h2>
                <p className="section-sub" style={{ margin: 0 }}>
                  Ringkasan status proyek kreatif yang sedang dikerjakan minggu ini
                </p>
              </div>
              <div className="tab-row">
                <button
                  className={filterTab === 'All' ? 'active' : ''}
                  onClick={() => setFilterTab('All')}
                >
                  Semua
                </button>
                <button
                  className={filterTab === 'Ongoing' ? 'active' : ''}
                  onClick={() => setFilterTab('Ongoing')}
                >
                  Berjalan
                </button>
                <button
                  className={filterTab === 'Completed' ? 'active' : ''}
                  onClick={() => setFilterTab('Completed')}
                >
                  Selesai
                </button>
                <button
                  className={filterTab === 'Urgent' ? 'active' : ''}
                  onClick={() => setFilterTab('Urgent')}
                >
                  Mendesak
                </button>
              </div>
            </div>

            <div className="card-grid-2">
              {filteredProjects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="work-card"
                  onClick={() => {
                    onSelectProject(p.id);
                    onNavigate('project-detail');
                  }}
                >
                  <div className="cat">
                    <Icon name={p.cat} />
                    <span>{p.catLabel}</span>
                  </div>
                  <h4>{p.name}</h4>

                  <div className="wc-illus" style={{ background: p.progress === 100 ? 'var(--mint)' : 'var(--lavender)' }}>
                    <Illustration kind={p.illus} />
                  </div>

                  <div className="wc-footer">
                    <img src={p.team[0]} alt="Pic" />
                    <div className="mini-track">
                      <div className="mini-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="pct">{p.progress}%</span>
                  </div>

                  <div className="wc-date">
                    <Icon name="clock" />
                    <span>Tenggat: {p.due}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="see-all-bar"
              style={{ width: '100%' }}
              onClick={() => onNavigate('projects')}
            >
              Lihat Semua {projects.length} Proyek Tim &rarr;
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-col">
          {/* Progress Card */}
          <div className="card progress-card">
            <div className="ph">
              <h3>Kemajuan Divisi</h3>
              <span className="pill-mini">
                <Icon name="check" />
                <span>On-Track</span>
              </span>
            </div>
            <p className="section-sub">Tingkat capaian deliverable divisi minggu ini</p>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--lavender)' }}>
                <Icon name="palette" />
              </div>
              <div className="plabel">Desain Grafis</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '82%', background: 'var(--violet)' }} />
              </div>
              <div className="pval">82%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--mint)' }}>
                <Icon name="video" />
              </div>
              <div className="plabel">Videografi</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '58%', background: '#1e6e56' }} />
              </div>
              <div className="pval">58%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--pink)' }}>
                <Icon name="camera" />
              </div>
              <div className="plabel">Fotografi</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '90%', background: '#d64d7c' }} />
              </div>
              <div className="pval">90%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--cream)' }}>
                <Icon name="code" />
              </div>
              <div className="plabel">Frontend Dev</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '74%', background: '#d8ea2c' }} />
              </div>
              <div className="pval">74%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--paper)' }}>
                <Icon name="megaphone" />
              </div>
              <div className="plabel">Copywriting</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '95%', background: 'var(--violet-ink)' }} />
              </div>
              <div className="pval">95%</div>
            </div>

            <button
              className="link-row"
              style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => onNavigate('analytics')}
            >
              <span>Buka analitik produktivitas lengkap</span>
              <Icon name="arrowR" />
            </button>
          </div>

          {/* Promo Card */}
          <div className="promo-card">
            <div>
              <h3>Tingkatkan Ruang Kerja Tim</h3>
              <p>Kelola hingga 50 proyek simultan, cloud asset storage tanpa batas, dan integrasi Figma.</p>
              <button
                className="btn btn-sm"
                onClick={() => onAddToast('Fitur Wee Cloud Workspace aktif!')}
              >
                <span>Pelajari Paket Pro</span>
                <Icon name="arrowR" />
              </button>
            </div>
            <div className="promo-illus float-idle">
              <Illustration kind="rocket" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
