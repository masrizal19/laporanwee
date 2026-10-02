import React, { useState, useRef, useEffect } from 'react';
import { Project, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { getUserDisplayName } from '../utils/userUtils';
import { api } from '../utils/api';

interface EvidenceFileItem {
  id: string;
  file?: File;
  previewUrl: string;
  serverUrl?: string;
  name: string;
}

interface CreateReportViewProps {
  projects: Project[];
  userName?: string;
  userEmail?: string;
  onNavigate: (view: ViewType) => void;
  onAddReport: (report: Omit<Report, 'id'>) => Promise<string> | string;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

export const CreateReportView: React.FC<CreateReportViewProps> = ({
  projects,
  userName,
  userEmail,
  onNavigate,
  onAddReport,
  onSelectReport,
  onAddToast,
}) => {
  const reporterName = getUserDisplayName({ name: userName, email: userEmail });

  const [selectedProject, setSelectedProject] = useState(
    projects[0]?.name || 'Website Redesign Wee Agency'
  );
  const [category, setCategory] = useState('Desain & UI/UX');
  const [task, setTask] = useState('');
  const [desc, setDesc] = useState('');
  const [progress, setProgress] = useState(85);
  const [status, setStatus] = useState<Report['status']>('In Review');
  const [timeSpent, setTimeSpent] = useState('4 jam 30 mnt');
  const [challenges, setChallenges] = useState('');
  const [next, setNext] = useState('');
  const [taskErr, setTaskErr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evidence items state: holds pristine File instances and uncompressed Object URLs
  const [evidenceItems, setEvidenceItems] = useState<EvidenceFileItem[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived preview URLs for UI rendering and Lightbox
  const evidencePreviews = evidenceItems.map((item) => item.previewUrl);

  // Clean up blob Object URLs when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      evidenceItems.forEach((item) => {
        if (item.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  // Process selected image files using native URL.createObjectURL (zero compression, zero blur)
  const processImageFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const validFiles = fileList.filter((f) => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
      onAddToast('Mohon pilih file gambar yang valid (JPG, PNG, atau WEBP).');
      return;
    }

    const newItems: EvidenceFileItem[] = validFiles.map((file) => ({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    }));

    setEvidenceItems((prev) => [...prev, ...newItems]);
    onAddToast(`✓ ${validFiles.length} foto bukti pekerjaan berhasil dipilih dari galeri.`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processImageFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setEvidenceItems((prev) => {
      const target = prev[indexToRemove];
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (activePreviewIndex >= updated.length) {
        setActivePreviewIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
    onAddToast('Bukti foto dihapus.');
  };

  const handleClearEvidence = () => {
    evidenceItems.forEach((item) => {
      if (item.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setEvidenceItems([]);
    setActivePreviewIndex(0);
    onAddToast('Semua bukti foto telah dihapus.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) {
      setTaskErr('Judul tugas atau deliverable wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find matching project id for genuine server file storage
      const matchedProject = projects.find((p) => p.name === selectedProject) || projects[0];
      const projectId = matchedProject ? matchedProject.id : 8;

      const uploadedUrls: string[] = [];

      // Upload actual File instances directly to MySQL server storage via FormData
      for (const item of evidenceItems) {
        if (item.file) {
          try {
            const formData = new FormData();
            formData.append('project_id', String(projectId));
            formData.append('file', item.file);
            const uploadRes = await api.upload('/project-documents/upload.php', formData);
            const serverUrl =
              uploadRes?.data?.file_url ||
              uploadRes?.data?.url ||
              uploadRes?.data?.original_url;
            if (serverUrl) {
              uploadedUrls.push(serverUrl);
            }
          } catch (uploadErr) {
            console.warn('Gagal upload bukti pekerjaan ke server:', uploadErr);
          }
        } else if (item.serverUrl) {
          uploadedUrls.push(item.serverUrl);
        } else if (item.previewUrl && !item.previewUrl.startsWith('blob:')) {
          uploadedUrls.push(item.previewUrl);
        }
      }

      // Default category photo if user didn't upload any
      const finalEvidence: string[] =
        uploadedUrls.length > 0
          ? uploadedUrls
          : [
              category.includes('Desain')
                ? 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80'
                : category.includes('Video')
                ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80'
                : category.includes('Foto')
                ? 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80'
                : 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
            ];

      const newId = await onAddReport({
        person: reporterName,
        date: new Date().toISOString().slice(0, 10),
        project: selectedProject,
        task: task.trim(),
        category,
        desc: desc.trim() || 'Laporan kerja harian selesai.',
        progress,
        time: timeSpent || '4 jam 00 mnt',
        status,
        challenges: challenges.trim() || 'Tidak ada kendala berarti.',
        next: next.trim() || 'Melanjutkan modul sprint berikutnya.',
        evidence_urls: finalEvidence,
        evidence_url: finalEvidence[0],
      });

      if (newId) {
        onSelectReport(newId);
        onNavigate('report-detail');
      } else {
        onNavigate('reports');
      }
    } catch (_) {
    } finally {
      setIsSubmitting(false);
    }
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
          <Icon name="chevL" style={{ width: 16, height: 16 }} />
          <span>Kembali ke Laporan</span>
        </button>
      </div>

      <div className="form-layout">
        {/* Left Form */}
        <div className="card" style={{ padding: '26px' }}>
          {/* Date Card */}
          <div className="date-card">
            <div className="ic">
              <Icon name="calendar" style={{ width: 18, height: 18 }} />
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

            {/* BUKTI PEKERJAAN UPLOAD SECTION (GALLERY PICKER) */}
            <div className="field">
              <div className="field-label-row">
                <label htmlFor="evidence-file-input">
                  Bukti Pekerjaan (Foto/Screenshot dari Galeri)
                </label>
                <span className="field-hint-tag">JPG, PNG, WEBP</span>
              </div>

              <div
                className="evidence-form-picker-box"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  id="evidence-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  hidden
                />

                <div className="evidence-picker-controls">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="camera" style={{ width: 16, height: 16 }} />
                    <span>+ Pilih dari Galeri</span>
                  </button>
                  <span className="picker-status-txt">
                    {evidencePreviews.length > 0
                      ? `✓ ${evidencePreviews.length} foto bukti pekerjaan dipilih`
                      : 'Pilih satu atau beberapa screenshot/foto pekerjaan Anda'}
                  </span>
                </div>

                {/* Thumbnails Gallery inside Form */}
                {evidencePreviews.length > 0 && (
                  <div className="evidence-form-thumbs-grid">
                    {evidencePreviews.map((pUrl, idx) => (
                      <div key={idx} className="evidence-form-thumb-item">
                        <img
                          src={pUrl}
                          alt={`Bukti ${idx + 1}`}
                          className="thumb-img"
                          onClick={() => {
                            setActivePreviewIndex(idx);
                            setIsLightboxOpen(true);
                          }}
                        />
                        <button
                          type="button"
                          className="thumb-remove-btn"
                          onClick={() => handleRemovePhoto(idx)}
                          title="Hapus foto ini"
                          aria-label="Hapus foto"
                        >
                          <Icon name="x" style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

            {/* Submit Action Buttons with Small 18px Check Icon */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="submit"
                className="btn btn-dark"
                disabled={isSubmitting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Icon name="check" style={{ width: 18, height: 18 }} />
                <span>{isSubmitting ? 'Mengirim Laporan...' : 'Kirim Laporan Kerja'}</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onNavigate('reports')}
              >
                <Icon name="x" style={{ width: 16, height: 16 }} />
                <span>Batal</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: Pratinjau Bukti Pekerjaan (Replaces Large Doc Icon) */}
        <div>
          <div className="card preview-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Icon name="camera" style={{ width: 18, height: 18 }} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Pratinjau Bukti Pekerjaan
              </h3>
            </div>
            <p className="section-sub" style={{ margin: '0 0 16px' }}>
              Bukti hasil kerja nyata yang akan ditampilkan di dashboard dan laporan tim
            </p>

            {/* Empty or Filled Evidence Box */}
            {evidencePreviews.length === 0 ? (
              <div
                className="evidence-empty-preview-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                role="button"
                tabIndex={0}
              >
                <div className="dropzone-icon">
                  <Icon name="upload" style={{ width: 22, height: 22 }} />
                </div>
                <b>+ Tambah Bukti</b>
                <span>Upload foto pekerjaan dari galeri</span>
                <small>PNG, JPG, WEBP</small>
              </div>
            ) : (
              <div className="evidence-filled-preview-box">
                {/* Main Hero Thumbnail */}
                <div
                  className="evidence-hero-frame"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Klik untuk memperbesar bukti"
                >
                  <img
                    src={evidencePreviews[activePreviewIndex] || evidencePreviews[0]}
                    alt="Pratinjau bukti pekerjaan"
                    className="hero-evidence-img"
                  />
                  <span className="hero-zoom-badge">
                    <Icon name="search" style={{ width: 14, height: 14 }} />
                  </span>
                </div>

                {/* Multiple thumbnails strip */}
                {evidencePreviews.length > 1 && (
                  <div className="evidence-strip-row">
                    {evidencePreviews.map((pUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`strip-thumb-btn ${idx === activePreviewIndex ? 'active' : ''}`}
                        onClick={() => setActivePreviewIndex(idx)}
                      >
                        <img src={pUrl} alt={`Foto ${idx + 1}`} />
                      </button>
                    ))}
                  </div>
                )}

                {/* Action footer below thumbnail */}
                <div className="evidence-filled-footer">
                  <div>
                    <div className="fn-title">Bukti Pekerjaan</div>
                    <div className="fn-count">{evidencePreviews.length} foto dipilih</div>
                  </div>
                  <div className="fn-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-xs"
                      onClick={handleClearEvidence}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Metadata Rows */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--line-soft)', paddingTop: '16px' }}>
              <div className="preview-row">
                <div className="pic2">
                  <Icon name="users" size={20} />
                </div>
                <div className="pl">
                  <div className="lbl">Pelapor</div>
                  <div className="val">{reporterName}</div>
                </div>
              </div>

              <div className="preview-row">
                <div className="pic2">
                  <Icon name="folder" size={20} />
                </div>
                <div className="pl">
                  <div className="lbl">Proyek</div>
                  <div className="val">{selectedProject}</div>
                </div>
              </div>

              <div className="preview-row">
                <div className="pic2">
                  <Icon name="palette" size={20} />
                </div>
                <div className="pl">
                  <div className="lbl">Kategori</div>
                  <div className="val">{category}</div>
                </div>
              </div>

              <div className="preview-row">
                <div className="pic2">
                  <Icon name="checksq" size={20} />
                </div>
                <div className="pl">
                  <div className="lbl">Judul Tugas</div>
                  <div className="val">{task || '(Belum mengisi judul tugas)'}</div>
                </div>
              </div>

              <div className="preview-row">
                <div className="pic2">
                  <Icon name="target" size={20} />
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
                  <Icon name="clock" size={20} />
                </div>
                <div className="pl">
                  <div className="lbl">Durasi Kerja</div>
                  <div className="val">{timeSpent}</div>
                </div>
              </div>

              {desc && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    background: 'var(--paper)',
                    borderRadius: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--muted)',
                      marginBottom: '4px',
                    }}
                  >
                    Deskripsi:
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{desc}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Previewing Evidence Full-screen */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        images={evidencePreviews}
        currentIndex={activePreviewIndex}
        title={task || selectedProject}
        onClose={() => setIsLightboxOpen(false)}
        onNavigate={(newIdx) => setActivePreviewIndex(newIdx)}
      />
    </div>
  );
};
