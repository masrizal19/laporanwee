import React, { useState, useEffect } from 'react';
import { Project, ProjectDocument, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { projectService } from '../utils/projectService';
import { dailyReportService, mapBackendStatusToFrontend, API_BASE_URL } from '../utils/api';

interface ReportDetailViewProps {
  report: Report;
  projects?: Project[];
  onNavigate: (view: ViewType) => void;
  onUpdateStatus: (reportId: string, newStatus: Report['status']) => void;
  onReportUpdated?: (updatedReport: Report) => void;
  onAddToast: (text: string) => void;
}

interface Comment {
  id: string;
  name: string;
  avatar: string;
  time: string;
  text: string;
}

/**
 * Format YYYY-MM-DD into Indonesian human readable date
 */
const formatHumanDate = (dateStr?: string): string => {
  if (!dateStr) return 'Hari ini';
  const clean = dateStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
    }
  }
  return clean;
};

/**
 * Parse any date string into standard YYYY-MM-DD for <input type="date" />
 */
const parseToDateInput = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
    jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
    oct: '10', nov: '11', des: '12', dec: '12'
  };
  const parts = clean.split(/[\s,]+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthKey = parts[1].toLowerCase().slice(0, 3);
    const month = monthMap[monthKey] || '10';
    const year = parts[2].length === 4 ? parts[2] : '2026';
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
};

/**
 * Normalizes frontend / backend status to backend enum value:
 * 'in_review' | 'completed' | 'draft' | 'rejected'
 */
const getInitialStatusValue = (status?: string): string => {
  const s = (status || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'completed' || s === 'selesai') return 'completed';
  if (s === 'draft' || s === 'draf' || s === 'todo' || s === 'to_do') return 'draft';
  if (s === 'rejected' || s === 'ditolak' || s === 'revisi') return 'rejected';
  return 'in_review';
};

export const ReportDetailView: React.FC<ReportDetailViewProps> = ({
  report,
  projects,
  onNavigate,
  onUpdateStatus,
  onReportUpdated,
  onAddToast,
}) => {
  // Local state for the current report data to allow instant reactive updates
  const [currentData, setCurrentData] = useState<Report>(report);

  // Edit Modal & Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    work_category: report.work_category || report.category || '',
    project_name: report.project_name || report.project || '',
    title: report.task || '',
    description: report.desc || '',
    progress: typeof report.progress === 'number' ? report.progress : 85,
    status: getInitialStatusValue(report.status),
    report_date: parseToDateInput(report.report_date || report.date),
  });

  // Keep local state in sync when parent report prop changes
  useEffect(() => {
    setCurrentData(report);
  }, [report]);

  // Synchronize form values whenever modal is opened
  useEffect(() => {
    if (isEditModalOpen) {
      setFormData({
        work_category: currentData.work_category || currentData.category || '',
        project_name: currentData.project_name || currentData.project || '',
        title: currentData.task || '',
        description: currentData.desc || '',
        progress: typeof currentData.progress === 'number' ? currentData.progress : 85,
        status: getInitialStatusValue(currentData.status),
        report_date: parseToDateInput(currentData.report_date || currentData.date),
      });
      setFormError(null);
    }
  }, [isEditModalOpen, currentData]);

  // Interaction: close modal on ESC key
  useEffect(() => {
    if (!isEditModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setIsEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, isSubmitting]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isEditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEditModalOpen]);

  // Team Discussion Comments
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 'c1',
      name: 'Rizky Pratama (Lead)',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      time: '1 jam lalu',
      text: 'Struktur layout dan spacing deliverable sudah rapi banget! Pastikan icon set konsisten dengan style 2px stroke ya.',
    },
    {
      id: 'c2',
      name: 'Dimas Wicaksono',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
      time: '30 menit lalu',
      text: 'Tokens warna sudah aku import ke Tailwind CSS config. Ready untuk proses slicing.',
    },
  ]);

  const [newComment, setNewComment] = useState('');
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);

  // Load project documents from MySQL to link original.php endpoint
  useEffect(() => {
    const matched = projects?.find(
      (p) => p.name === currentData.project || p.title === currentData.project
    );
    const projId = matched?.id || (currentData.project?.toLowerCase().includes('job fair') ? 8 : undefined);
    if (projId) {
      projectService
        .fetchDocuments(projId)
        .then((docs) => setProjectDocs(docs))
        .catch((err) => console.warn('Fetch docs notice:', err));
    }
  }, [currentData.project, projects]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentItem: Comment = {
      id: `c_${Date.now()}`,
      name: 'Rangga Arya (Anda)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      time: 'Baru saja',
      text: newComment.trim(),
    };

    setComments([...comments, commentItem]);
    setNewComment('');
    onAddToast('Komentar berhasil ditambahkan!');
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const rawEvidence =
    currentData.evidence_urls && currentData.evidence_urls.length > 0
      ? currentData.evidence_urls
      : currentData.evidence_url
      ? [currentData.evidence_url]
      : [];

  // Map evidence items to original.php endpoint if document ID is available
  const evidenceList = rawEvidence.map((url, idx) => {
    const doc = projectDocs[idx] || projectDocs[0];
    if (doc?.id) {
      return `${API_BASE_URL}/project-documents/original.php?id=${doc.id}`;
    }
    if (currentData.id === '3' || currentData.project?.toLowerCase().includes('job fair')) {
      return `${API_BASE_URL}/project-documents/original.php?id=6`;
    }
    return url;
  });

  const handleApprove = () => {
    onUpdateStatus(currentData.id, 'Completed');
    setCurrentData((prev) => ({ ...prev, status: 'Completed' }));
    onAddToast(`Laporan "${currentData.task}" telah disetujui (Completed)!`);
  };

  const handleRequestRevision = () => {
    onUpdateStatus(currentData.id, 'In Review');
    setCurrentData((prev) => ({ ...prev, status: 'In Review' }));
    onAddToast(`Revisi telah diminta untuk laporan "${currentData.task}".`);
  };

  // Close modal and reset form
  const handleCloseEditModal = () => {
    if (isSubmitting) return;
    setFormData({
      work_category: currentData.work_category || currentData.category || '',
      project_name: currentData.project_name || currentData.project || '',
      title: currentData.task || '',
      description: currentData.desc || '',
      progress: typeof currentData.progress === 'number' ? currentData.progress : 85,
      status: getInitialStatusValue(currentData.status),
      report_date: parseToDateInput(currentData.report_date || currentData.date),
    });
    setFormError(null);
    setIsEditModalOpen(false);
  };

  // Submit edit form to backend MySQL via POST /api/daily-reports/update.php
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation
    if (!formData.title.trim()) {
      setFormError('Judul / tugas wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const res = await dailyReportService.updateDailyReport({
        id: currentData.id,
        work_category: formData.work_category.trim(),
        project_name: formData.project_name.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        progress: Number(formData.progress),
        status: formData.status,
        report_date: formData.report_date,
      });

      if (res && res.success !== false) {
        onAddToast('Laporan berhasil diperbarui');

        const updatedReport: Report = {
          ...currentData,
          task: formData.title.trim(),
          desc: formData.description.trim(),
          project: formData.project_name.trim(),
          project_name: formData.project_name.trim(),
          category: formData.work_category.trim(),
          work_category: formData.work_category.trim(),
          progress: Number(formData.progress),
          status: mapBackendStatusToFrontend(formData.status),
          report_date: formData.report_date,
          date: formatHumanDate(formData.report_date),
          ...(res.data && typeof res.data === 'object' ? {
            ...(res.data.title && { task: res.data.title }),
            ...(res.data.description && { desc: res.data.description }),
            ...(res.data.project_name && { project: res.data.project_name, project_name: res.data.project_name }),
            ...(res.data.work_category && { category: res.data.work_category, work_category: res.data.work_category }),
            ...(res.data.progress !== undefined && { progress: Number(res.data.progress) }),
            ...(res.data.status && { status: mapBackendStatusToFrontend(res.data.status) }),
          } : {}),
        };

        // Update local Detail Laporan state immediately
        setCurrentData(updatedReport);

        // Notify parent state for immediate synchronization across ReportsView & Dashboard
        if (onReportUpdated) {
          onReportUpdated(updatedReport);
        }

        setIsEditModalOpen(false);
      } else {
        const msg = res?.message || 'Gagal memperbarui laporan. Silakan coba lagi.';
        setFormError(msg);
        onAddToast(msg);
      }
    } catch (err: any) {
      console.error('Update daily report error:', err);
      let errorMsg = 'Gagal memperbarui laporan. Silakan coba lagi.';
      if (err?.status === 401) {
        errorMsg = 'Session login sudah berakhir. Silakan login kembali.';
      } else if (err?.status === 403) {
        errorMsg = 'Anda tidak memiliki izin untuk mengedit laporan ini.';
      } else if (err?.status === 404) {
        errorMsg = 'Laporan tidak ditemukan.';
      } else if (err?.status === 500) {
        errorMsg = 'Terjadi kesalahan server.';
      } else if (
        err?.name === 'TypeError' ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('failed to fetch')
      ) {
        errorMsg = 'Tidak dapat terhubung ke server.';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      setFormError(errorMsg);
      onAddToast(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="view">
      {/* Top Bar with Navigation, Chips, and EDIT LAPORAN Button */}
      <div className="rd-top">
        <button className="back-btn" onClick={() => onNavigate('reports')}>
          <Icon name="chevL" />
          <span>Kembali ke Daftar Laporan</span>
        </button>

        <div className="rd-chip">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt={currentData.person}
          />
          <div>
            <b>{currentData.person}</b>
            <span>Pelapor Kerja</span>
          </div>
        </div>

        <div className="rd-chip">
          <Icon name="calendar" />
          <div>
            <b>{currentData.date}</b>
            <span>Tanggal Pengerjaan</span>
          </div>
        </div>

        <div className="rd-chip status">
          <Icon name="clock" />
          <div>
            <b>{currentData.time || '4 jam 00 mnt'}</b>
            <span>Durasi Kerja</span>
          </div>
        </div>

        <div
          className="rd-chip"
          style={{
            background:
              currentData.status === 'Completed'
                ? 'var(--mint)'
                : currentData.status === 'In Review'
                ? 'var(--peach)'
                : 'var(--lavender)',
          }}
        >
          <Icon name="target" />
          <div>
            <b>{currentData.status}</b>
            <span>Status Verifikasi</span>
          </div>
        </div>

        {/* Tombol EDIT LAPORAN */}
        <button
          type="button"
          className="rd-btn-edit"
          onClick={() => setIsEditModalOpen(true)}
          title="Edit laporan kerja ini"
        >
          <Icon name="pencil" size={15} />
          <span>EDIT LAPORAN</span>
        </button>
      </div>

      <div className="rd-layout">
        {/* Main Content */}
        <div className="card rd-main">
          <div className="rd-grid2">
            <div className="rd-box">
              <div className="rl">
                <div className="rd-box-icon">
                  <Icon name="folder" size={15} />
                </div>
                <span>Proyek Terkait</span>
              </div>
              <div className="rv">{currentData.project_name || currentData.project}</div>
            </div>

            <div className="rd-box">
              <div className="rl">
                <div className="rd-box-icon">
                  <Icon name="palette" size={15} />
                </div>
                <span>Kategori Kerja</span>
              </div>
              <div className="rv">{currentData.work_category || currentData.category}</div>
            </div>
          </div>

          <div style={{ margin: '14px 0 20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px' }}>
              {currentData.task}
            </h2>
            <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--ink)', margin: 0 }}>
              {currentData.desc}
            </p>
          </div>

          {/* Progress Bar */}
          <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>
                Tingkat Penyelesaian Tugas
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--violet)' }}>
                {currentData.progress}%
              </span>
            </div>
            <div className="progress-track" style={{ maxWidth: '100%', height: '9px' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${currentData.progress}%`,
                  background: currentData.progress === 100 ? '#1e6e56' : 'var(--violet)',
                }}
              />
            </div>
          </div>

          {/* Details 2-box */}
          <div className="rd-grid2">
            <div className="rd-box">
              <div className="rl">
                <div className="rd-box-icon">
                  <Icon name="flag" size={15} />
                </div>
                <span>Kendala &amp; Hambatan</span>
              </div>
              <div className="rd-desc">
                {currentData.challenges || 'Tidak ada kendala berarti.'}
              </div>
            </div>

            <div className="rd-box">
              <div className="rl">
                <div className="rd-box-icon">
                  <Icon name="arrowR" size={15} />
                </div>
                <span>Rencana Kerja Selanjutnya</span>
              </div>
              <div className="rd-desc">
                {currentData.next || 'Melanjutkan deliverable berikutnya.'}
              </div>
            </div>
          </div>

          {/* Bukti Pekerjaan Nyata (Foto & Screenshot) */}
          {evidenceList.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="camera" style={{ width: 18, height: 18 }} />
                  <span>Bukti Pekerjaan Nyata ({evidenceList.length})</span>
                </h3>
                <span className="field-hint-tag">Klik gambar untuk memperbesar</span>
              </div>
              <p className="section-sub" style={{ margin: '0 0 14px' }}>
                Dokumentasi visual hasil pengerjaan deliverable yang diunggah pelapor.
              </p>

              <div className="report-evidence-gallery-grid">
                {evidenceList.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="report-evidence-thumb-card"
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      src={imgUrl}
                      alt={`Bukti pekerjaan ${idx + 1}`}
                      className="thumb-img"
                      loading="lazy"
                    />
                    <div className="thumb-zoom-overlay">
                      <span className="zoom-ic">
                        <Icon name="search" style={{ width: 14, height: 14 }} />
                      </span>
                      <span className="zoom-txt">Foto #{idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Lampiran &amp; Berkas Bukti ({projectDocs.length > 0 ? projectDocs.length : 4})
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Klik berkas untuk melihat preview atau mengunduh aset.
            </p>

            <div className="attach-grid">
              {projectDocs.length > 0 ? (
                projectDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={`${API_BASE_URL}/project-documents/original.php?id=${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attach-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    title={`Buka berkas ${doc.original_name}`}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--paper)' }}>
                      <Icon name={doc.file_type === 'image' ? 'image' : 'doc'} />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">{doc.original_name}</div>
                      <div className="fs">
                        {doc.file_size_formatted || (doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Dokumen')} &bull; Asli
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <>
                  <div
                    className="attach-card"
                    onClick={() => onAddToast('Membuka file mockup Figma...')}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--lavender)' }}>
                      <Icon name="palette" />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">Mockup-v3.fig</div>
                      <div className="fs">14.2 MB &bull; Figma</div>
                    </div>
                  </div>

                  <div
                    className="attach-card"
                    onClick={() => onAddToast('Mengunduh dokumentasi PDF...')}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--mint)' }}>
                      <Icon name="doc" />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">Responsive-Spec.pdf</div>
                      <div className="fs">3.8 MB &bull; PDF</div>
                    </div>
                  </div>

                  <div
                    className="attach-card"
                    onClick={() => onAddToast('Membuka palet token PNG...')}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--peach)' }}>
                      <Icon name="image" />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">Palette-Tokens.png</div>
                      <div className="fs">820 KB &bull; PNG</div>
                    </div>
                  </div>

                  <div
                    className="attach-card"
                    onClick={() => onAddToast('Mengunduh shotlist video...')}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--cream)' }}>
                      <Icon name="video" />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">Shotlist-Take3.mov</div>
                      <div className="fs">42 MB &bull; Video</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions & Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Actions Card */}
          <div className="card summary-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px' }}>
              Verifikasi Laporan
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5 }}>
              Tinjau capaian kerja ini dan beri tanda persetujuan atau instruksi revisi.
            </p>

            <div className="verify-actions-wrap">
              <button
                type="button"
                className="btn btn-dark verify-btn-approve"
                onClick={handleApprove}
              >
                <div className="verify-action-ic">
                  <Icon name="check" size={18} />
                </div>
                <span>Setujui Laporan Ini</span>
              </button>

              <button
                type="button"
                className="btn btn-outline verify-btn-revision"
                onClick={handleRequestRevision}
              >
                <div className="verify-action-ic">
                  <Icon name="pencil" size={16} />
                </div>
                <span>Minta Catatan Revisi</span>
              </button>
            </div>
          </div>

          {/* Comments Card */}
          <div className="card comments-card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>
              Diskusi Tim ({comments.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {comments.map((c) => (
                <div key={c.id} className="comment-row">
                  <img src={c.avatar} alt={c.name} />
                  <div className="cb">
                    <b>{c.name}</b>
                    <span className="ctime">{c.time}</span>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="comment-input-row">
              <input
                type="text"
                placeholder="Tulis tanggapan atau feedback..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" aria-label="Kirim Komentar">
                <Icon name="send" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL EDIT LAPORAN (600-760px, Clean Editorial UI)
          ======================================================== */}
      {isEditModalOpen && (
        <div
          className="edit-report-modal-overlay"
          onClick={() => {
            if (!isSubmitting) handleCloseEditModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div
            className="edit-report-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: EDIT LAPORAN + Subtitle + Close [X] Button */}
            <div className="edit-modal-header">
              <div>
                <h2 id="edit-modal-title" className="edit-modal-title">
                  EDIT LAPORAN
                </h2>
                <p className="edit-modal-subtitle">
                  Edit informasi pekerjaan dan simpan perubahan.
                </p>
              </div>
              <button
                type="button"
                className="edit-modal-close-btn"
                onClick={handleCloseEditModal}
                disabled={isSubmitting}
                aria-label="Tutup form edit"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form Fields Body */}
            <form onSubmit={handleSaveEdit}>
              <div className="edit-modal-body">
                {formError && (
                  <div className="edit-form-error-banner">
                    <Icon name="alert" size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* A. Kategori Pekerjaan */}
                <div className="edit-form-field">
                  <label htmlFor="edit-field-work-category" className="edit-form-label">
                    Kategori Pekerjaan
                  </label>
                  <input
                    id="edit-field-work-category"
                    type="text"
                    className="edit-form-input"
                    value={formData.work_category}
                    onChange={(e) =>
                      setFormData({ ...formData, work_category: e.target.value })
                    }
                    placeholder="Contoh: Desain & UI/UX"
                    disabled={isSubmitting}
                  />
                </div>

                {/* B. Project Terkait */}
                <div className="edit-form-field">
                  <label htmlFor="edit-field-project-name" className="edit-form-label">
                    Project Terkait
                  </label>
                  <input
                    id="edit-field-project-name"
                    type="text"
                    className="edit-form-input"
                    value={formData.project_name}
                    onChange={(e) =>
                      setFormData({ ...formData, project_name: e.target.value })
                    }
                    placeholder="Contoh: KEGIATAN JOB FAIR"
                    disabled={isSubmitting}
                  />
                </div>

                {/* C. Judul / Tugas */}
                <div className="edit-form-field">
                  <label htmlFor="edit-field-title" className="edit-form-label">
                    Judul / Tugas <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="edit-field-title"
                    type="text"
                    className="edit-form-input"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Judul deliverable atau pekerjaan"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* D. Deskripsi Pekerjaan */}
                <div className="edit-form-field">
                  <label htmlFor="edit-field-description" className="edit-form-label">
                    Deskripsi Pekerjaan
                  </label>
                  <textarea
                    id="edit-field-description"
                    className="edit-form-textarea"
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Tuliskan deskripsi lengkap deliverable atau catatan pengerjaan..."
                    disabled={isSubmitting}
                  />
                </div>

                {/* E. Progress Pekerjaan */}
                <div className="edit-form-field">
                  <div className="edit-progress-header">
                    <label htmlFor="edit-field-progress" className="edit-form-label" style={{ marginBottom: 0 }}>
                      Progress Pekerjaan
                    </label>
                    <span className="edit-progress-val">{formData.progress}%</span>
                  </div>
                  <div className="edit-progress-slider-wrap">
                    <input
                      id="edit-field-progress"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      className="edit-progress-range"
                      value={formData.progress}
                      onChange={(e) =>
                        setFormData({ ...formData, progress: Number(e.target.value) })
                      }
                      disabled={isSubmitting}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="edit-form-input edit-progress-input-num"
                      value={formData.progress}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setFormData({ ...formData, progress: val });
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* F. Status Laporan & G. Tanggal Laporan */}
                <div className="edit-form-grid-2">
                  <div className="edit-form-field">
                    <label htmlFor="edit-field-status" className="edit-form-label">
                      Status Laporan
                    </label>
                    <select
                      id="edit-field-status"
                      className="edit-form-select"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      disabled={isSubmitting}
                    >
                      <option value="in_review">in_review (In Review)</option>
                      <option value="completed">completed (Completed)</option>
                      <option value="draft">draft (Draft)</option>
                      <option value="rejected">rejected (Rejected)</option>
                    </select>
                  </div>

                  <div className="edit-form-field">
                    <label htmlFor="edit-field-report-date" className="edit-form-label">
                      Tanggal Laporan
                    </label>
                    <input
                      id="edit-field-report-date"
                      type="date"
                      className="edit-form-input"
                      value={formData.report_date}
                      onChange={(e) =>
                        setFormData({ ...formData, report_date: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Footer: [BATAL] & [SIMPAN PERUBAHAN] */}
              <div className="edit-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleCloseEditModal}
                  disabled={isSubmitting}
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="btn-spinner" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>SIMPAN PERUBAHAN</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal for Evidence Photos */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={evidenceList}
        documents={projectDocs}
        currentIndex={lightboxIndex}
        title={currentData.task}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />
    </div>
  );
};
