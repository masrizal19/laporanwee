import React, { useState } from 'react';
import { Project, ViewType } from '../types';
import { Icon, Illustration } from '../components/icons';
import { Modal } from '../components/Modal';

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

  // New Project Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('palette');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('2026-10-31');
  const [formErr, setFormErr] = useState('');

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
              className="proj-card"
              onClick={() => {
                onSelectProject(p.id);
                onNavigate('project-detail');
              }}
            >
              <div className="proj-top">
                <div className="proj-cat">
                  <Icon name={p.cat} />
                  <span>{p.catLabel}</span>
                </div>
                <button
                  className="more-dots"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Hapus proyek "${p.name}"?`)) {
                      onDeleteProject(p.id);
                      onAddToast(`Proyek "${p.name}" telah dihapus.`);
                    }
                  }}
                  title="Hapus proyek"
                  aria-label="Hapus proyek"
                >
                  <Icon name="dots" />
                </button>
              </div>

              <div
                className="proj-illus"
                style={{
                  background:
                    p.status === 'Completed'
                      ? 'var(--mint)'
                      : p.status === 'In Review'
                      ? 'var(--peach)'
                      : 'var(--lavender)',
                }}
              >
                <Illustration kind={p.illus} />
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
                  <Icon name="clock" />
                  <span>{p.due}</span>
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
    </div>
  );
};
