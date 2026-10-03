import React, { useState, useEffect } from 'react';
import { Project, ProjectDocument, Report, ViewType, DailyReportFile } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { projectService } from '../utils/projectService';
import { API_BASE_URL, dailyReportService } from '../utils/api';
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
  const [reportFiles, setReportFiles] = useState<DailyReportFile[]>([]);

  // SINGLE SOURCE OF TRUTH: Re-fetch freshest report detail from backend MySQL
  useEffect(() => {
    if (!currentData?.id) return;
    dailyReportService
      .fetchDailyReportDetail(currentData.id)
      .then((fresh) => {
        if (!fresh) return;
        setCurrentData((prev) => ({
          ...prev,
          task: fresh.task || prev.task,
          desc: fresh.desc || prev.desc,
          project: fresh.project_name || fresh.project || prev.project,
          project_name: fresh.project_name || fresh.project || prev.project_name,
          category: fresh.work_category || fresh.category || prev.category,
          work_category: fresh.work_category || fresh.category || prev.work_category,
          progress: typeof fresh.progress === 'number' ? fresh.progress : prev.progress,
          status: fresh.status || prev.status,
          time: fresh.duration || fresh.time || prev.time,
          duration: fresh.duration || fresh.time || prev.duration,
          challenges: fresh.obstacles || fresh.challenges || prev.challenges,
          obstacles: fresh.obstacles || fresh.challenges || prev.obstacles,
          next: fresh.next_plan || fresh.next || prev.next,
          next_plan: fresh.next_plan || fresh.next || prev.next_plan,
          report_date: fresh.report_date || fresh.date || prev.report_date,
        }));
      })
      .catch((err) => console.warn('Fetch report detail notice in ReportDetailView:', err));
  }, [currentData.id]);

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

  // Load report attachments (category=attachment) from backend MySQL
  useEffect(() => {
    if (!currentData?.id) return;
    dailyReportService
      .fetchReportFiles(currentData.id, 'attachment')
      .then((files) => {
        if (files) setReportFiles(files);
      })
      .catch((err) => console.warn('Fetch report files notice:', err));
  }, [currentData.id]);

  // Combined documents list (Project docs + Report attachments)
  const allDocs: ProjectDocument[] = [
    ...projectDocs,
    ...reportFiles
      .filter((rf) => !projectDocs.some((pd) => String(pd.id) === String(rf.id) || pd.original_name === rf.original_name))
      .map((rf) => ({
        id: rf.id,
        project_id: (currentData as any)?.project_id || 0,
        file_name: rf.file_name,
        original_name: rf.original_name || rf.file_name,
        file_type: rf.file_type || 'doc',
        file_size: rf.file_size,
        file_size_formatted: rf.file_size_formatted,
        file_url: rf.file_url,
      } as ProjectDocument))
  ];

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

  // Map evidence items
  const evidenceList = rawEvidence.map((url, idx) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:'))) {
      return url;
    }
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

          {/* Attachments Section — Connected to Backend MySQL */}
          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
              Lampiran &amp; Berkas Proyek ({allDocs.length})
            </h3>
            <p className="section-sub" style={{ margin: 0 }}>
              Berkas asli dari server proyek yang dapat dibuka dan diunduh.
            </p>

            {allDocs.length > 0 ? (
              <div className="attach-grid" style={{ marginTop: '14px' }}>
                {allDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url || `${API_BASE_URL}/project-documents/original.php?id=${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attach-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    title={`Buka berkas asli ${doc.original_name}`}
                  >
                    <div className="attach-thumb" style={{ background: 'var(--paper)' }}>
                      <Icon name={doc.file_type === 'image' ? 'image' : doc.file_type === 'video' ? 'video' : 'doc'} />
                    </div>
                    <div className="attach-meta">
                      <div className="fn">{doc.original_name}</div>
                      <div className="fs">
                        {doc.file_size_formatted || (doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Dokumen')} &bull; Asli
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '24px 16px',
                  background: 'var(--paper)',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--line-soft)',
                  textAlign: 'center',
                  marginTop: '12px',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '10px',
                    borderRadius: '50%',
                    background: 'var(--card, #fff)',
                    border: '1px solid var(--line-soft)',
                    marginBottom: '8px',
                    color: 'var(--muted)',
                  }}
                >
                  <Icon name="doc" size={20} />
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                  Belum Ada Berkas Lampiran Tambahan
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                  Gunakan tombol <b>EDIT LAPORAN</b> untuk menambahkan berkas proyek (Maks. 2 GB per file).
                </div>
              </div>
            )}
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
