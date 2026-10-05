import React, { useState, useEffect, useRef } from 'react';
import { Project, Task, Report, ViewType, ProjectDocument } from '../types';
import { Icon } from '../components/icons';
import { projectService } from '../utils/projectService';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { ReportCoverThumbnail } from '../components/ReportCoverThumbnail';

interface ProjectDetailViewProps {
  project: Project;
  tasks: Task[];
  reports: Report[];
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
  onUpdateProject?: (project: Project) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  tasks,
  reports,
  onNavigate,
  onSelectReport,
  onAddToast,
}) => {
  // Project documents state
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Edit document metadata state
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete document confirmation state
  const [docToDelete, setDocToDelete] = useState<ProjectDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Media Viewer modal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents from backend API
  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const docs = await projectService.fetchDocuments(project.id);
      setDocuments(docs);
    } catch (err) {
      console.warn('Gagal memuat dokumentasi proyek:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [project.id]);

  // Handle file upload without size restriction
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await projectService.uploadDocument(project.id, file);
      await loadDocuments();
      onAddToast(`Dokumentasi "${file.name}" berhasil diunggah.`);
    } catch (err: any) {
      console.error('Gagal upload dokumentasi:', err);
      onAddToast(err?.message || 'Gagal mengunggah dokumentasi. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        handleFileUpload(files[i]);
      }
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        handleFileUpload(files[i]);
      }
    }
  };

  // Handle edit document original name
  const handleSaveDocName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editDocName.trim()) return;
    setIsSavingEdit(true);
    try {
      await projectService.updateDocument(editingDoc.id, editDocName.trim());
      await loadDocuments();
      setEditingDoc(null);
      onAddToast('Nama dokumentasi berhasil diperbarui.');
    } catch (err: any) {
      console.error('Gagal update nama dokumentasi:', err);
      onAddToast(err?.message || 'Gagal memperbarui dokumentasi.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle delete document
  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      await projectService.deleteDocument(docToDelete.id);
      await loadDocuments();
      setDocToDelete(null);
      onAddToast('Dokumentasi berhasil dihapus.');
    } catch (err: any) {
      console.error('Gagal hapus dokumentasi:', err);
      onAddToast(err?.message || 'Gagal menghapus dokumentasi.');
    } finally {
      setIsDeletingDoc(false);
    }
  };

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
            {project.thumbnail_url ? (
              <div
                style={{
                  width: '90px',
                  height: '74px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  flex: 'none',
                  border: '1.5px solid var(--line-soft)',
                }}
              >
                <img
                  src={project.thumbnail_url}
                  alt={project.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  background: 'var(--paper)',
                  border: '1px solid var(--line-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                  color: 'var(--violet)',
                }}
              >
                <Icon name={project.cat} style={{ width: 22, height: 22 }} />
              </div>
            )}
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

          {/* DOKUMENTASI & BUKTI PEKERJAAN PROYEK */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 2px' }}>
                  Dokumentasi &amp; Bukti Proyek ({documents.length})
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  Unggah foto &amp; video hasil pekerjaan nyata yang tersinkronisasi global ke server MySQL.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Icon name="loader" className="spin" style={{ width: 14, height: 14 }} />
                    <span>Mengunggah...</span>
                  </>
                ) : (
                  <>
                    <Icon name="upload" style={{ width: 14, height: 14 }} />
                    <span>+ Unggah Bukti</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
            </div>

            {/* Drag & drop zone */}
            <div
              className={`task-docs-dropzone ${isDragOver ? 'dragover' : ''}`}
              style={{
                border: '2px dashed var(--line-soft)',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'center',
                background: isDragOver ? 'rgba(74, 85, 255, 0.05)' : 'var(--paper)',
                cursor: 'pointer',
                marginBottom: '16px',
                transition: 'all 0.2s ease',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <Icon name="camera" style={{ width: 22, height: 22, margin: '0 auto 6px', color: 'var(--violet)' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {isUploading ? 'Sedang memproses unggahan file...' : 'Klik atau seret foto/video bukti pekerjaan di sini'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                Mendukung gambar (JPG, PNG, WEBP) &amp; video (MP4, MOV, WEBM) resolusi penuh
              </div>
            </div>

            {/* Documents Grid */}
            {loadingDocs ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <Icon name="loader" className="spin" style={{ width: 18, height: 18, margin: '0 auto 8px' }} />
                <span>Memuat dokumentasi dari server...</span>
              </div>
            ) : documents.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13.5px', margin: '10px 0' }}>
                Belum ada foto atau video dokumentasi yang diunggah untuk proyek ini.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                  marginTop: '10px',
                }}
              >
                {documents.map((doc, idx) => {
                  const isVid = doc.file_type === 'video' || doc.mime_type?.startsWith('video/');
                  return (
                    <div
                      key={doc.id}
                      className="task-doc-item"
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 10',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#14131a',
                        border: '1.5px solid var(--line-soft)',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                      onClick={() => {
                        setViewerIndex(idx);
                        setViewerOpen(true);
                      }}
                    >
                      {/* Media Thumbnail */}
                      {isVid ? (
                        <video
                          src={`${doc.file_url}#t=0.5`}
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <img
                          src={doc.file_url}
                          alt={doc.original_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      )}

                      {/* Video Center Play Badge */}
                      {isVid && (
                        <div className="task-doc-video-badge">
                          <Icon name="video" style={{ width: 14, height: 14 }} />
                        </div>
                      )}

                      {/* Top Type Pill */}
                      <span className="task-doc-type-pill">
                        <Icon name={isVid ? 'video' : 'image'} style={{ width: 10, height: 10 }} />
                        <span>{isVid ? 'Video' : 'Foto'}</span>
                      </span>

                      {/* Action buttons (Edit name & Delete) */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          display: 'flex',
                          gap: '4px',
                          zIndex: 2,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Ubah nama"
                          onClick={() => {
                            setEditingDoc(doc);
                            setEditDocName(doc.original_name);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: 'rgba(20, 19, 26, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <Icon name="edit" style={{ width: 11, height: 11 }} />
                        </button>
                        <button
                          type="button"
                          title="Hapus dokumentasi"
                          onClick={() => setDocToDelete(doc)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: 'rgba(220, 38, 38, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <Icon name="trash" style={{ width: 11, height: 11 }} />
                        </button>
                      </div>

                      {/* Bottom Info Overlay */}
                      <div className="task-doc-meta-overlay">
                        <span className="task-doc-name-cut" title={doc.original_name}>
                          {doc.original_name}
                        </span>
                        <span className="task-doc-size">{doc.file_size_formatted || ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  <ReportCoverThumbnail report={r} />
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
              <p>Setiap progress dan file dokumentasi langsung tersimpan aman dan terupdate di backend MySQL.</p>
            </div>
            <div className="promo-badge-tag">
              <Icon name="sparkles" style={{ width: 22, height: 22 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Media Viewer Modal (Photos & Videos) */}
      <MediaViewerModal
        isOpen={viewerOpen}
        documents={documents}
        currentIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onNavigate={(idx) => setViewerIndex(idx)}
      />

      {/* Edit Document Name Modal */}
      {editingDoc && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isSavingEdit && setEditingDoc(null)}
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
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--line-soft, #e5e7eb)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700 }}>
              Edit Nama Dokumentasi
            </h3>
            <form onSubmit={handleSaveDocName}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>
                  Nama Tampilan File
                </label>
                <input
                  type="text"
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  placeholder="Masukkan nama baru..."
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line-soft)',
                    background: 'var(--paper)',
                    color: 'inherit',
                    fontSize: '13.5px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditingDoc(null)}
                  disabled={isSavingEdit}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-dark btn-sm"
                  disabled={isSavingEdit || !editDocName.trim()}
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {docToDelete && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => !isDeletingDoc && setDocToDelete(null)}
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
          }}
        >
          <div
            className="doc-delete-confirm-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card, #ffffff)',
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
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Hapus Dokumentasi?
              </h3>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 20px' }}>
              File <strong>"{docToDelete.original_name}"</strong> akan dihapus permanen dari server. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleConfirmDeleteDoc}
                disabled={isDeletingDoc}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isDeletingDoc ? (
                  <>
                    <Icon name="loader" style={{ width: 14, height: 14 }} className="spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Icon name="trash" style={{ width: 15, height: 15 }} />
                    <span>Hapus Dokumentasi</span>
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
