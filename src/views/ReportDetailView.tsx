import React, { useState, useEffect } from 'react';
import { Project, ProjectDocument, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { projectService } from '../utils/projectService';
import { API_BASE_URL } from '../utils/api';
import { DailyReportForm } from '../components/DailyReportForm';

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

  // Edit Mode state: toggles between read-only detail view and comprehensive DailyReportForm
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Keep local state in sync when parent report prop changes
  useEffect(() => {
    setCurrentData(report);
  }, [report]);

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
        .then((docs) => setProjectDocs(docs || []))
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

  // If user enters Edit Mode, render the comprehensive DailyReportForm in edit mode
  if (isEditing) {
    return (
      <div className="view">
        <DailyReportForm
          mode="edit"
          initialReport={currentData}
          projects={projects || []}
          userName={currentData.person}
          onCancel={() => setIsEditing(false)}
          onUpdateReport={async (updatedReport) => {
            setCurrentData(updatedReport);
            if (onReportUpdated) {
              await onReportUpdated(updatedReport);
            }
            setIsEditing(false);
          }}
          onAddToast={onAddToast}
        />
      </div>
    );
  }

  // Read-only Detail Laporan view
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
          onClick={() => setIsEditing(true)}
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
