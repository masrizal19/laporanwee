import React, { useState } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { WorkEvidenceThumbnail } from '../components/WorkEvidenceThumbnail';
import { getUserFirstName } from '../utils/userUtils';

interface DashboardViewProps {
  projects: Project[];
  reports?: Report[];
  userName?: string;
  userEmail?: string;
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onAddToast: (text: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  reports = [],
  userName,
  userEmail,
  onNavigate,
  onSelectProject,
  onAddToast,
}) => {
  const [filterTab, setFilterTab] = useState<'All' | 'Ongoing' | 'Completed' | 'Urgent'>('All');

  // Compute dynamic greeting name from logged in session
  const greetingName = getUserFirstName({ name: userName, email: userEmail });

  const filteredProjects = projects.filter((p) => {
    if (filterTab === 'Ongoing') return p.progress < 100;
    if (filterTab === 'Completed') return p.progress === 100;
    if (filterTab === 'Urgent') return p.due.includes('14') || p.due.includes('10');
    return true;
  });

  // Helper to extract evidence photos for a project
  const getProjectEvidenceList = (p: Project): string[] => {
    if (p.evidence_urls && p.evidence_urls.length > 0) return p.evidence_urls;
    if (p.thumbnail_url) return [p.thumbnail_url];
    if (reports && reports.length > 0) {
      const match = reports.find(
        (r) =>
          r.project.toLowerCase() === p.name.toLowerCase() ||
          p.name.toLowerCase().includes(r.project.toLowerCase())
      );
      if (match?.evidence_urls && match.evidence_urls.length > 0) return match.evidence_urls;
      if (match?.evidence_url) return [match.evidence_url];
    }
    return [];
  };

  const featuredProject = projects[0] || filteredProjects[0];

  return (
    <div className="view">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Halo, {greetingName}! 👋</h1>
          <p className="sub">
            Rabu, 14 Oktober 2026 &bull; Pantau seluruh progres tim kreatif Wee Studio hari ini.
          </p>
        </div>
        <div className="head-stats">
          <div className="stat-chip c-mint">
            <div className="ic">
              <Icon name="folder" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="num">6</div>
              <div className="lbl">Proyek Aktif</div>
            </div>
          </div>
          <div className="stat-chip c-lav">
            <div className="ic">
              <Icon name="checksq" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="num">18</div>
              <div className="lbl">Tugas Berjalan</div>
            </div>
          </div>
          <div className="stat-chip c-pink">
            <div className="ic">
              <Icon name="target" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="num">94%</div>
              <div className="lbl">Tingkat Selesai</div>
            </div>
          </div>
          <div className="stat-chip c-white">
            <div className="ic">
              <Icon name="users" style={{ width: 18, height: 18 }} />
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
          {/* Featured Project Card — Real Work Evidence as Main Visual */}
          {featuredProject && (
            <div className="feature-evidence-card">
              <div className="feature-evidence-media">
                <WorkEvidenceThumbnail
                  evidenceUrls={getProjectEvidenceList(featuredProject)}
                  thumbnailUrl={featuredProject.thumbnail_url}
                  projectTitle={featuredProject.name}
                  height={220}
                  onCreateReport={() => onNavigate('create-report')}
                />
              </div>

              <div className="feature-evidence-body">
                <div className="tag-row">
                  <Icon name={featuredProject.cat || 'palette'} style={{ width: 16, height: 16 }} />
                  <span>{featuredProject.catLabel}</span>
                  <span className="deadline-badge">
                    <Icon name="clock" style={{ width: 14, height: 14 }} />
                    <span>Tenggat: {featuredProject.due}</span>
                  </span>
                </div>

                <h3>{featuredProject.name}</h3>
                <p className="feature-desc">{featuredProject.desc}</p>

                <div className="feature-progress-box">
                  <div className="feature-pct">
                    <span>{featuredProject.progress}% Selesai</span>
                    <span className="sprint-tag">&bull; Sprint 2</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${featuredProject.progress}%` }}
                    />
                  </div>
                </div>

                <div className="feature-bottom-row">
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

                  <div className="feature-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onNavigate('create-report')}
                    >
                      <Icon name="plus" style={{ width: 16, height: 16 }} />
                      <span>Buat Laporan</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      onClick={() => {
                        onSelectProject(featuredProject.id);
                        onNavigate('project-detail');
                      }}
                    >
                      <span>Buka Proyek</span>
                      <Icon name="arrowR" style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Pekerjaan & Proyek Terkini */}
          <div style={{ marginTop: '28px' }}>
            <div className="section-head-row">
              <div>
                <h2 className="section-title">Pekerjaan &amp; Proyek Terkini</h2>
                <p className="section-sub" style={{ margin: 0 }}>
                  Bukti pengerjaan nyata dari deliverable kreatif yang sedang berjalan
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

            {/* Grid of Work Cards with Work Evidence Thumbnails */}
            <div className="card-grid-2">
              {filteredProjects.slice(0, 4).map((p) => {
                const evidenceList = getProjectEvidenceList(p);

                return (
                  <div
                    key={p.id}
                    className="work-card evidence-card"
                    onClick={() => {
                      onSelectProject(p.id);
                      onNavigate('project-detail');
                    }}
                  >
                    {/* 1. THUMBNAIL BUKTI PEKERJAAN SEBAGAI VISUAL UTAMA */}
                    <div className="wc-evidence-media">
                      <WorkEvidenceThumbnail
                        evidenceUrls={evidenceList}
                        thumbnailUrl={p.thumbnail_url}
                        projectTitle={p.name}
                        height={185}
                        onCreateReport={() => onNavigate('create-report')}
                      />
                    </div>

                    <div className="wc-content">
                      {/* Divisi / Kategori with small icon */}
                      <div className="wc-cat-row">
                        <span className="cat-badge">
                          <Icon name={p.cat} style={{ width: 14, height: 14 }} />
                          <span>{p.catLabel}</span>
                        </span>
                        <span className="status-badge-sm">{p.status}</span>
                      </div>

                      {/* 2. Nama Proyek */}
                      <h4 className="wc-title">{p.name}</h4>

                      {/* 3. Persentase Selesai & Sprint/Status */}
                      <div className="wc-sub-meta">
                        <span className="pct-bold">{p.progress}% Selesai</span>
                        <span className="dot-sep">&bull;</span>
                        <span className="sub-tag">
                          {p.status === 'Completed' ? 'Tuntas' : p.progress > 70 ? 'Sprint 2' : 'Sprint 1'}
                        </span>
                      </div>

                      {/* 4. Progress Track */}
                      <div className="wc-progress-row">
                        <div className="mini-track">
                          <div
                            className="mini-fill"
                            style={{
                              width: `${p.progress}%`,
                              background: p.progress === 100 ? '#1e6e56' : 'var(--primary-color, #4A55FF)',
                            }}
                          />
                        </div>
                      </div>

                      {/* 5. Metadata: Anggota & Icon Jam Kecil 14px */}
                      <div className="wc-footer-meta">
                        <div className="avatar-stack-sm">
                          {p.team.slice(0, 3).map((img, i) => (
                            <img key={i} src={img} alt="Anggota" />
                          ))}
                          {p.team.length > 3 && (
                            <span className="plus-sm">+{p.team.length - 3}</span>
                          )}
                        </div>

                        {/* Clock icon small 14px indicator only */}
                        <div className="wc-date-chip" title={`Tenggat: ${p.due}`}>
                          <Icon name="clock" style={{ width: 14, height: 14 }} />
                          <span>{p.due}</span>
                        </div>
                      </div>

                      {/* 5. Action Button */}
                      <div className="wc-action-row">
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(p.id);
                            onNavigate('project-detail');
                          }}
                        >
                          <span>Buka Proyek</span>
                          <Icon name="arrowR" style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <Icon name="check" style={{ width: 15, height: 15 }} />
                <span>On-Track</span>
              </span>
            </div>
            <p className="section-sub">Tingkat capaian deliverable divisi minggu ini</p>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--lavender)' }}>
                <Icon name="palette" style={{ width: 16, height: 16 }} />
              </div>
              <div className="plabel">Desain Grafis</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '82%', background: 'var(--violet)' }} />
              </div>
              <div className="pval">82%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--mint)' }}>
                <Icon name="video" style={{ width: 16, height: 16 }} />
              </div>
              <div className="plabel">Videografi</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '58%', background: '#1e6e56' }} />
              </div>
              <div className="pval">58%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--pink)' }}>
                <Icon name="camera" style={{ width: 16, height: 16 }} />
              </div>
              <div className="plabel">Fotografi</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '90%', background: '#d64d7c' }} />
              </div>
              <div className="pval">90%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--cream)' }}>
                <Icon name="code" style={{ width: 16, height: 16 }} />
              </div>
              <div className="plabel">Frontend Dev</div>
              <div className="ptrack">
                <div className="pfill" style={{ width: '74%', background: '#d8ea2c' }} />
              </div>
              <div className="pval">74%</div>
            </div>

            <div className="prog-row">
              <div className="pic" style={{ background: 'var(--paper)' }}>
                <Icon name="megaphone" style={{ width: 16, height: 16 }} />
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
              <Icon name="arrowR" style={{ width: 16, height: 16 }} />
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
                <Icon name="arrowR" style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="promo-badge-tag">
              <Icon name="sparkles" style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
