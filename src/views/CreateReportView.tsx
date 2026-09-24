import React, { useState } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';

interface CreateReportViewProps {
  projects: Project[];
  onNavigate: (view: ViewType) => void;
  onAddReport: (report: Omit<Report, 'id'>) => string;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

export const CreateReportView: React.FC<CreateReportViewProps> = ({
  projects,
  onNavigate,
  onAddReport,
  onSelectReport,
  onAddToast,
}) => {
  const [selectedProject, setSelectedProject] = useState(projects[0]?.name || 'Website Redesign Wee Agency');
  const [category, setCategory] = useState('Desain & UI/UX');
  const [task, setTask] = useState('');
  const [desc, setDesc] = useState('');
  const [progress, setProgress] = useState(85);
  const [status, setStatus] = useState<Report['status']>('In Review');
  const [timeSpent, setTimeSpent] = useState('4 jam 30 mnt');
  const [challenges, setChallenges] = useState('');
  const [next, setNext] = useState('');
  const [taskErr, setTaskErr] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) {
      setTaskErr('Judul tugas atau deliverable wajib diisi.');
      return;
    }

    const newId = onAddReport({
      person: 'Rangga Arya',
      date: '14 Okt 2026',
      project: selectedProject,
      task: task.trim(),
      category,
      desc: desc.trim() || 'Laporan kerja harian selesai.',
      progress,
      time: timeSpent || '4 jam 00 mnt',
      status,
      challenges: challenges.trim() || 'Tidak ada kendala berarti.',
      next: next.trim() || 'Melanjutkan modul sprint berikutnya.',
    });

    onAddToast('Laporan kerja harian berhasil disubmit!');
    onSelectReport(newId);
    onNavigate('report-detail');
  };

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Formulir Laporan Harian</h1>
          <p className="sub">
            Dokumentasikan pencapaian, durasi kerja, dan kendala yang dihadapi hari ini.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => onNavigate('reports')}>
          <Icon name="chevL" />
          <span>Kembali ke Laporan</span>
        </button>
      </div>

      <div className="form-layout">
        {/* Left Form */}
        <div className="card" style={{ padding: '26px' }}>
          {/* Date Card */}
          <div className="date-card">
            <div className="ic">
              <Icon name="calendar" />
            </div>
            <div>
              <b>Rabu, 14 Oktober 2026</b>
              <span>Waktu Pelaporan Harian Tim Kreatif</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-2col">
              <div className="field">
                <label htmlFor="report-project-select">Pilih Proyek Terkait *</label>
                <select
                  id="report-project-select"
                  className="input"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="report-category-select">Divisi &amp; Kategori Kerja</label>
                <select
                  id="report-category-select"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Desain & UI/UX">🎨 Desain &amp; UI/UX</option>
                  <option value="Videografi & Editing">🎬 Videografi &amp; Editing</option>
                  <option value="Fotografi & Retouch">📸 Fotografi &amp; Retouch</option>
                  <option value="Frontend Development">💻 Frontend Development</option>
                  <option value="Copywriting & Strategy">📢 Copywriting &amp; Strategy</option>
                </select>
              </div>
            </div>

            <div className={`field ${taskErr ? 'invalid' : ''}`}>
              <label htmlFor="report-task-input">Judul Tugas / Pekerjaan yang Dikerjakan *</label>
              <input
                id="report-task-input"
                type="text"
                placeholder="Contoh: Finalisasi mockup homepage desktop & mobile"
                value={task}
                onChange={(e) => {
                  setTask(e.target.value);
                  setTaskErr('');
                }}
              />
              {taskErr && <span className="err">{taskErr}</span>}
            </div>

            <div className="field">
              <label htmlFor="report-desc-input">Deskripsi Rinci Pekerjaan</label>
              <textarea
                id="report-desc-input"
                rows={3}
                placeholder="Tuliskan detail hal-hal yang telah kamu selesaikan, perubahan yang dibuat..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            {/* Slider Row */}
            <div className="field">
              <label htmlFor="report-progress-slider">Persentase Capaian Tugas</label>
              <div className="slider-row">
                <input
                  id="report-progress-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                />
                <span className="slider-val" style={{ color: 'var(--violet)' }}>
                  {progress}%
                </span>
              </div>
            </div>

            {/* Status Selector */}
            <div className="field">
              <label>Status Laporan</label>
              <div className="status-toggle">
                {(['To Do', 'In Progress', 'In Review', 'Completed'] as Report['status'][]).map(
                  (s) => (
                    <div
                      key={s}
                      className={`status-opt ${status === s ? 'sel' : ''}`}
                      onClick={() => setStatus(s)}
                    >
                      <span className="rd" />
                      <span>{s}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="form-2col">
              <div className="field">
                <label htmlFor="report-time-input">Durasi Pengerjaan</label>
                <input
                  id="report-time-input"
                  type="text"
                  placeholder="Misal: 4 jam 30 mnt"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="report-challenges-input">Kendala / Hambatan</label>
                <input
                  id="report-challenges-input"
                  type="text"
                  placeholder="Opsional jika ada kendala"
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="report-next-input">Rencana Pengerjaan Besok</label>
              <input
                id="report-next-input"
                type="text"
                placeholder="Langkah berikutnya yang akan dikerjakan"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-dark" style={{ flex: 1, justifyContent: 'center' }}>
                <Icon name="check" />
                <span>Kirim Laporan Kerja</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onNavigate('reports')}
              >
                Batal
              </button>
            </div>
          </form>
        </div>

        {/* Right Live Preview */}
        <div>
          <div className="card preview-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Icon name="doc" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Pratinjau Laporan Langsung
              </h3>
            </div>
            <p className="section-sub" style={{ margin: '0 0 16px' }}>
              Format tampilan yang akan dilihat oleh Project Lead dan tim Anda
            </p>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="users" />
              </div>
              <div className="pl">
                <div className="lbl">Pelapor</div>
                <div className="val">Rangga Arya (UI/UX)</div>
              </div>
            </div>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="folder" />
              </div>
              <div className="pl">
                <div className="lbl">Proyek</div>
                <div className="val">{selectedProject}</div>
              </div>
            </div>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="palette" />
              </div>
              <div className="pl">
                <div className="lbl">Kategori</div>
                <div className="val">{category}</div>
              </div>
            </div>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="checksq" />
              </div>
              <div className="pl">
                <div className="lbl">Judul Tugas</div>
                <div className="val">{task || '(Belum mengisi judul tugas)'}</div>
              </div>
            </div>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="target" />
              </div>
              <div className="pl">
                <div className="lbl">Progress &amp; Status</div>
                <div className="val" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{progress}%</span>
                  <span className="preview-badge">{status}</span>
                </div>
              </div>
            </div>

            <div className="preview-row">
              <div className="pic2">
                <Icon name="clock" />
              </div>
              <div className="pl">
                <div className="lbl">Durasi Kerja</div>
                <div className="val">{timeSpent}</div>
              </div>
            </div>

            {desc && (
              <div style={{ marginTop: '14px', padding: '12px', background: 'var(--paper)', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  Deskripsi:
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{desc}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
