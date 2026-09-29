import React, { useState } from 'react';
import { Project, ViewType } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { WorkEvidenceThumbnail } from '../components/WorkEvidenceThumbnail';
import { projectService } from '../utils/projectService';

interface ProjectsViewProps {
  projects: Project[];
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onAddProject: (project: Omit<Project, 'id'>) => void;
  onDeleteProject: (projectId: string) => void;
  onAddToast: (text: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onNavigate,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onAddToast,
}) => {
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'In Review' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'due' | 'progDesc' | 'progAsc'>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Project Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('palette');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('2026-10-31');
  const [formErr, setFormErr] = useState('');

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const target = projectToDelete;
    setIsDeleting(true);
    try {
      if (onDeleteProject) {
        await onDeleteProject(target.id);
      }
      setProjectToDelete(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects
    .filter((p) => {
      if (activeTab === 'Active' && p.status !== 'Active') return false;
      if (activeTab === 'In Review' && p.status !== 'In Review') return false;
      if (activeTab === 'Completed' && p.status !== 'Completed') return false;
      if (
        searchQuery.trim() &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.desc.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.catLabel.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'progDesc') return b.progress - a.progress;
      if (sortBy === 'progAsc') return a.progress - b.progress;
      if (sortBy === 'due') return a.due.localeCompare(b.due);
      return 0; // default order
    });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr('Nama proyek wajib diisi');
      return;
    }

    let catLabel = 'Desain & UI';
    let illus = 'palette';
    if (category === 'video') {
      catLabel = 'Videografi';
      illus = 'video';
    } else if (category === 'camera') {
      catLabel = 'Fotografi';
      illus = 'camera';
    } else if (category === 'code') {
      catLabel = 'Web & Mobile';
      illus = 'laptop';
    } else if (category === 'megaphone') {
      catLabel = 'Marketing';
      illus = 'megaphone';
    }

    onAddProject({
      name: name.trim(),
      cat: category,
      catLabel,
      desc: desc.trim() || 'Proyek baru studio kreatif LaporanWee.',
      progress: 0,
      team: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      ],
      due: due,
      status: 'Active',
      illus,
    });

    onAddToast(`Proyek "${name}" berhasil dibuat!`);
    setIsModalOpen(false);
    setName('');
    setDesc('');
    setFormErr('');
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Proyek Tim Wee</h1>
          <p className="sub">
            Pantau dan kelola seluruh timeline dan deliverables pekerjaan kreatif.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-dark" onClick={() => setIsModalOpen(true)}>
            <Icon name="plus" />
            <span>Tambah Proyek Baru</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="head-stats" style={{ marginBottom: '22px' }}>
        <div className="stat-chip c-white">
          <div className="ic">
            <Icon name="folder" />
          </div>
          <div>
            <div className="num">{projects.length}</div>
            <div className="lbl">Total Proyek</div>
          </div>
        </div>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{projects.filter((p) => p.status === 'Active').length}</div>
            <div className="lbl">Sedang Berjalan</div>
          </div>
        </div>
        <div className="stat-chip c-pink">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{projects.filter((p) => p.status === 'In Review').length}</div>
            <div className="lbl">Dalam Review</div>
          </div>
        </div>
        <div className="stat-chip c-lav">
          <div className="ic">
            <Icon name="check" />
          </div>
          <div>
            <div className="num">{projects.filter((p) => p.status === 'Completed').length}</div>
            <div className="lbl">Selesai</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="tab-row">
          <button
            className={activeTab === 'All' ? 'active' : ''}
            onClick={() => setActiveTab('All')}
          >
            Semua ({projects.length})
          </button>
          <button
            className={activeTab === 'Active' ? 'active' : ''}
            onClick={() => setActiveTab('Active')}
          >
            Aktif
          </button>
          <button
            className={activeTab === 'In Review' ? 'active' : ''}
            onClick={() => setActiveTab('In Review')}
          >
            Review
          </button>
          <button
            className={activeTab === 'Completed' ? 'active' : ''}
            onClick={() => setActiveTab('Completed')}
          >
            Selesai
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Cari nama atau divisi proyek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Urutkan proyek"
          >
            <option value="newest">Urutkan: Standar</option>
            <option value="progDesc">Progress: Tertinggi</option>
            <option value="progAsc">Progress: Terendah</option>
            <option value="due">Tenggat Waktu</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="empty-state card" style={{ background: '#fff' }}>
          <Icon name="folder" />
          <b>Tidak ada proyek yang sesuai</b>
          <p>Coba sesuaikan kata kunci pencarian atau ubah filter status.</p>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: '12px' }}
            onClick={() => {
              setSearchQuery('');
              setActiveTab('All');
            }}
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="proj-grid">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className="proj-card proj-evidence-card"
              onClick={() => {
                onSelectProject(p.id);
                onNavigate('project-detail');
              }}
            >
              {/* Visual Utama: Bukti Pekerjaan Nyata */}
              <div className="proj-evidence-media">
                <WorkEvidenceThumbnail
                  evidenceUrls={p.evidence_urls}
                  thumbnailUrl={p.thumbnail_url}
                  projectTitle={p.name}
                  height={165}
                  onCreateReport={() => onNavigate('create-report')}
                />
              </div>

              <div className="proj-card-body">
                <div className="proj-top">
                  <div className="proj-cat">
                    <Icon name={p.cat} style={{ width: 14, height: 14 }} />
                    <span>{p.catLabel}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-delete-project"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(p);
                    }}
                    title="Hapus Project"
                    aria-label="Hapus project"
                  >
                    <Icon name="trash" style={{ width: 18, height: 18 }} />
                  </button>
                </div>

                <h4>{p.name}</h4>
                <p>{p.desc}</p>

                <div className="proj-pct">{p.progress}% Selesai</div>
                <div className="progress-track" style={{ maxWidth: '100%' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${p.progress}%`,
                      background: p.status === 'Completed' ? '#1e6e56' : 'var(--violet)',
                    }}
                  />
                </div>

                <div className="proj-foot">
                  <div className="avatar-stack">
                    {p.team.map((img, i) => (
                      <img key={i} src={img} alt="Team" />
                    ))}
                  </div>

                  <div className="proj-due">
                    <Icon name="clock" style={{ width: 14, height: 14 }} />
                    <span>{p.due}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Tambah Proyek Baru */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Buat Proyek Baru"
      >
        <form onSubmit={handleCreateProject}>
          <div className={`field ${formErr ? 'invalid' : ''}`}>
            <label htmlFor="new-proj-name">Nama Proyek *</label>
            <input
              id="new-proj-name"
              type="text"
              placeholder="Contoh: Photoshoot Brand Fashion Fall"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormErr('');
              }}
            />
            {formErr && <span className="err">{formErr}</span>}
          </div>

          <div className="field">
            <label htmlFor="new-proj-category">Kategori &amp; Divisi</label>
            <select
              id="new-proj-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="palette">🎨 Desain &amp; Branding</option>
              <option value="video">🎬 Videografi &amp; Editing</option>
              <option value="camera">📸 Fotografi &amp; Retouch</option>
              <option value="code">💻 Web &amp; Mobile Dev</option>
              <option value="megaphone">📢 Social Media &amp; Ads</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="new-proj-desc">Deskripsi Singkat</label>
            <textarea
              id="new-proj-desc"
              rows={3}
              placeholder="Jelaskan deliverable dan ekspektasi klien..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="new-proj-due">Tenggat Waktu</label>
            <input
              id="new-proj-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-dark">
              Simpan Proyek
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Project */}
      {projectToDelete && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isDeleting && setProjectToDelete(null)}
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
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              color: 'var(--text-color, #1a1a1a)',
              borderRadius: '16px',
              padding: '24px',
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
                  borderRadius: '10px',
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
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'inherit' }}>
                Hapus Project?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted, #6b7280)', lineHeight: '1.5', margin: '0 0 20px' }}>
              Project ini beserta data yang terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
              >
                {isDeleting ? (
                  <>
                    <Icon name="loader" style={{ width: 14, height: 14 }} className="spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Icon name="trash" style={{ width: 15, height: 15 }} />
                    <span>Hapus Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
