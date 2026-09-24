import React from 'react';
import { Project, Task, Report, ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';

interface ProjectDetailViewProps {
  project: Project;
  tasks: Task[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  tasks,
  reports,
  onNavigate,
  onSelectReport,
  onAddToast,
}) => {
  const projectTasks = tasks.filter(
    (t) =>
      t.proj.toLowerCase().includes(project.name.toLowerCase().slice(0, 10)) ||
      project.name.toLowerCase().includes(t.proj.toLowerCase())
  );

  const projectReports = reports.filter(
    (r) =>
      r.project.toLowerCase().includes(project.name.toLowerCase().slice(0, 10)) ||
      project.name.toLowerCase().includes(r.project.toLowerCase())
  );

  return (
    <div className="view">
      {/* Top navigation */}
      <div className="rd-top">
        <button className="back-btn" onClick={() => onNavigate('projects')}>
          <Icon name="chevL" />
          <span>Kembali ke Semua Proyek</span>
        </button>

        <div className="rd-chip">
          <Icon name={project.cat} />
          <div>
            <b>{project.catLabel}</b>
            <span>Kategori Divisi</span>
          </div>
        </div>

        <div className="rd-chip status">
          <Icon name="clock" />
          <div>
            <b>{project.due}</b>
            <span>Tenggat Deliverable</span>
          </div>
        </div>

        <div
          className="rd-chip"
          style={{
            background:
              project.status === 'Completed'
                ? 'var(--mint)'
                : project.status === 'In Review'
                ? 'var(--peach)'
                : 'var(--cream)',
          }}
        >
          <Icon name="target" />
          <div>
            <b>{project.status}</b>
            <span>Status Pengerjaan</span>
          </div>
        </div>
      </div>

      <div className="rd-layout">
        {/* Left Column */}
        <div className="card rd-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>
                {project.name}
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '14.5px', lineHeight: 1.5, margin: 0 }}>
                {project.desc}
              </p>
            </div>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '16px',
                background: 'var(--lavender)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <Illustration kind={project.illus} />
            </div>
          </div>

          {/* Progress Section */}
          <div style={{ margin: '24px 0', padding: '18px', background: 'var(--paper)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <b style={{ fontSize: '14px' }}>Pencapaian Milestone Keseluruhan</b>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--violet)' }}>
                {project.progress}% Selesai
              </span>
            </div>
            <div className="progress-track" style={{ maxWidth: '100%', height: '10px' }}>
              <div className="progress-fill" style={{ width: `${project.progress}%` }} />
            </div>
          </div>

          {/* Linked Tasks */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Tugas Dalam Proyek Ini ({projectTasks.length})
              </h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate('tasks')}
              >
                <Icon name="plus" />
                <span>Buka Kanban Tugas</span>
              </button>
            </div>

            {projectTasks.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13.5px' }}>
                Belum ada tugas spesifik yang ditautkan ke proyek ini.
              </p>
            ) : (
              projectTasks.map((t) => (
                <div
                  key={t.id}
                  className="report-row"
                  style={{ marginBottom: '8px' }}
                >
                  <div className="ric">
                    <Icon name="checksq" />
                  </div>
                  <div className="rmid">
                    <b>{t.title}</b>
                    <span>Tenggat: {t.due} &bull; Prioritas: {t.priority}</span>
                  </div>
                  <span
                    className={`rstat ${
                      t.col === 'done'
                        ? 'Completed'
                        : t.col === 'review'
                        ? 'InReview'
                        : t.col === 'inprogress'
                        ? 'InProgress'
                        : 'ToDo'
                    }`}
                  >
                    {t.col === 'done'
                      ? 'Selesai'
                      : t.col === 'review'
                      ? 'Review'
                      : t.col === 'inprogress'
                      ? 'Berjalan'
                      : 'To Do'}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Linked Reports */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Laporan Kerja Terkait ({projectReports.length})
              </h3>
              <button
                className="btn btn-dark btn-sm"
                onClick={() => onNavigate('create-report')}
              >
                <Icon name="plus" />
                <span>Buat Laporan Baru</span>
              </button>
            </div>

            {projectReports.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13.5px' }}>
                Belum ada laporan harian yang disubmit untuk proyek ini.
              </p>
            ) : (
              projectReports.map((r) => (
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
                    <span>Oleh {r.person} &bull; {r.date}</span>
                  </div>
                  <span className={`rstat ${r.status.replace(/\s+/g, '')}`}>
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Project Meta Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 14px' }}>
              Informasi Proyek
            </h3>

            <div className="sum-row">
              <div className="sum-ic">
                <Icon name="clock" />
              </div>
              <div className="sum-mid">
                <div className="sl">Batas Waktu</div>
                <div className="sum-val">{project.due}</div>
              </div>
            </div>

            <div className="sum-row">
              <div className="sum-ic">
                <Icon name="users" />
              </div>
              <div className="sum-mid">
                <div className="sl">Tim Penanggung Jawab</div>
                <div className="avatar-stack" style={{ marginTop: '4px' }}>
                  {project.team.map((img, i) => (
                    <img key={i} src={img} alt="Tim" />
                  ))}
                </div>
              </div>
            </div>

            <div className="sum-row">
              <div className="sum-ic">
                <Icon name="target" />
              </div>
              <div className="sum-mid">
                <div className="sl">Status Saat Ini</div>
                <div className="sum-val">{project.status}</div>
              </div>
            </div>

            <div className="sum-actions">
              <button
                className="btn btn-dark btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onNavigate('create-report')}
              >
                <Icon name="plus" />
                <span>Tambah Laporan</span>
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onAddToast('Tautan proyek disalin!')}
                title="Bagikan proyek"
              >
                <Icon name="send" />
              </button>
            </div>
          </div>

          <div className="promo-card">
            <div>
              <h3>Sinkronisasi Tim Otomatis</h3>
              <p>Setiap progress laporan harian langsung mengupdate persentase deliverable proyek.</p>
            </div>
            <div className="promo-illus">
              <Illustration kind="chart" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
