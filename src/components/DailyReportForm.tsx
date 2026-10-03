import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectDocument, Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { getUserDisplayName } from '../utils/userUtils';
import { api, API_BASE_URL, dailyReportService, mapFrontendStatusToBackend } from '../utils/api';
import { categoryService, WorkCategory } from '../utils/categoryService';
import { projectService } from '../utils/projectService';

export interface EvidenceFileItem {
  id: string;
  file?: File;
  previewUrl: string;
  serverUrl?: string;
  name: string;
}

export interface DailyReportFormProps {
  mode: 'create' | 'edit';
  initialReport?: Report;
  projects: Project[];
  userName?: string;
  userEmail?: string;
  onNavigate?: (view: ViewType) => void;
  onCancel?: () => void;
  onAddReport?: (report: Omit<Report, 'id'>) => Promise<string> | string;
  onUpdateReport?: (updatedReport: Report) => Promise<void> | void;
  onSelectReport?: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

/**
 * Format date string into standard Indonesian day and date format
 */
const formatFullDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return 'Hari ini';
  const clean = dateStr.trim();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const dayNum = parseInt(parts[2], 10);
      const d = new Date(year, mIdx, dayNum);
      const dayName = isNaN(d.getTime()) ? 'Hari' : days[d.getDay()];
      return `${dayName}, ${dayNum} ${months[mIdx] || parts[1]} ${year}`;
    }
  }
  return clean;
};

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

export const DailyReportForm: React.FC<DailyReportFormProps> = ({
  mode,
  initialReport,
  projects,
  userName,
  userEmail,
  onNavigate,
  onCancel,
  onAddReport,
  onUpdateReport,
  onSelectReport,
  onAddToast,
}) => {
  const isEdit = mode === 'edit';

  const reporterName = isEdit && initialReport?.person
    ? initialReport.person
    : getUserDisplayName({ name: userName, email: userEmail });

  // Ensure initial category exists in global categories list
  useEffect(() => {
    if (initialReport?.category || initialReport?.work_category) {
      categoryService.ensureCategoryExists(initialReport.work_category || initialReport.category);
    }
  }, [initialReport]);

  const [categories, setCategories] = useState<WorkCategory[]>(() =>
    categoryService.getActiveCategories()
  );

  // Form Field States
  const [selectedProject, setSelectedProject] = useState<string>(() => {
    if (isEdit && initialReport) {
      return initialReport.project_name || initialReport.project || projects[0]?.name || 'KEGIATAN JOB FAIR';
    }
    return projects[0]?.name || 'Website Redesign Wee Agency';
  });

  const [category, setCategory] = useState<string>(() => {
    if (isEdit && initialReport) {
      return initialReport.work_category || initialReport.category || 'Desain & UI/UX';
    }
    return 'Desain & UI/UX';
  });

  const [task, setTask] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.task || '' : '';
  });

  const [desc, setDesc] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.desc || '' : '';
  });

  const [progress, setProgress] = useState<number>(() => {
    return isEdit && initialReport && typeof initialReport.progress === 'number'
      ? initialReport.progress
      : 85;
  });

  const [status, setStatus] = useState<Report['status']>(() => {
    return isEdit && initialReport ? initialReport.status || 'In Review' : 'In Review';
  });

  const [timeSpent, setTimeSpent] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.time || '4 jam 30 mnt' : '4 jam 30 mnt';
  });

  const [challenges, setChallenges] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.challenges || '' : '';
  });

  const [next, setNext] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.next || '' : '';
  });

  const [reportDate, setReportDate] = useState<string>(() => {
    return isEdit && initialReport
      ? parseToDateInput(initialReport.report_date || initialReport.date)
      : new Date().toISOString().slice(0, 10);
  });

  const [taskErr, setTaskErr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Evidence Files State
  const [evidenceItems, setEvidenceItems] = useState<EvidenceFileItem[]>(() => {
    if (isEdit && initialReport) {
      const urls = initialReport.evidence_urls && initialReport.evidence_urls.length > 0
        ? initialReport.evidence_urls
        : initialReport.evidence_url
        ? [initialReport.evidence_url]
        : [];
      return urls.map((url, idx) => ({
        id: `ev_init_${idx}_${Date.now()}`,
        previewUrl: url,
        serverUrl: url,
        name: `Foto Bukti #${idx + 1}`,
      }));
    }
    return [];
  });

  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // File replacement and deletion confirmation state
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Derived preview URLs for UI rendering and Lightbox
  const evidencePreviews = evidenceItems.map((item) => item.previewUrl);

  // Project Documents (Lampiran & Berkas)
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Load backend documents for selected project
  useEffect(() => {
    const matched = projects.find((p) => p.name === selectedProject || p.title === selectedProject);
    const projId = matched?.id || (selectedProject.toLowerCase().includes('job fair') ? 8 : undefined);
    if (projId) {
      projectService
        .fetchDocuments(projId)
        .then((docs) => setProjectDocs(docs || []))
        .catch((err) => console.warn('Fetch docs notice:', err));
    }
  }, [selectedProject, projects]);

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
    onAddToast('Bukti foto berhasil dihapus.');
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

  // Replace photo file picker handler
  const handleReplaceClick = (idx: number) => {
    setReplaceIndex(idx);
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null) return;

    if (!file.type.startsWith('image/')) {
      onAddToast('Mohon pilih file gambar yang valid.');
      return;
    }

    const newPreviewUrl = URL.createObjectURL(file);
    setEvidenceItems((prev) => {
      return prev.map((item, idx) => {
        if (idx === replaceIndex) {
          if (item.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
          }
          return {
            id: `ev_rep_${Date.now()}`,
            file,
            previewUrl: newPreviewUrl,
            name: file.name,
          };
        }
        return item;
      });
    });

    onAddToast(`Foto #${replaceIndex + 1} berhasil diganti dengan "${file.name}".`);
    setReplaceIndex(null);
    e.target.value = '';
  };

  // Handle uploading extra document / attachment to project
  const handleUploadProjectDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const matchedProject = projects.find((p) => p.name === selectedProject) || projects[0];
    const projId = matchedProject ? matchedProject.id : 8;

    setIsUploadingDoc(true);
    try {
      const doc = await projectService.uploadDocument(projId, file);
      if (doc) {
        setProjectDocs((prev) => [doc, ...prev]);
        onAddToast(`Berkas "${file.name}" berhasil diunggah.`);
      }
    } catch (err: any) {
      console.warn('Upload doc error:', err);
      onAddToast(err?.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) {
      setTaskErr('Judul tugas atau deliverable wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
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
            const docId = uploadRes?.data?.id;
            const serverUrl = docId
              ? `${API_BASE_URL}/project-documents/original.php?id=${docId}`
              : (uploadRes?.data?.file_url || uploadRes?.data?.url || uploadRes?.data?.original_url);
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

      if (isEdit && initialReport) {
        // Submit update to backend MySQL via POST /api/daily-reports/update.php
        const res = await dailyReportService.updateDailyReport({
          id: initialReport.id,
          work_category: category,
          project_name: selectedProject,
          title: task.trim(),
          description: desc.trim() || 'Laporan kerja harian selesai.',
          progress,
          status: mapFrontendStatusToBackend(status),
          report_date: reportDate,
        });

        if (res && res.success !== false) {
          onAddToast('Laporan berhasil diperbarui');

          const updatedReport: Report = {
            ...initialReport,
            task: task.trim(),
            desc: desc.trim() || 'Laporan kerja harian selesai.',
            project: selectedProject,
            project_name: selectedProject,
            category,
            work_category: category,
            progress,
            status,
            time: timeSpent || '4 jam 00 mnt',
            challenges: challenges.trim() || 'Tidak ada kendala berarti.',
            next: next.trim() || 'Melanjutkan modul sprint berikutnya.',
            report_date: reportDate,
            date: formatFullDateDisplay(reportDate),
            evidence_urls: finalEvidence,
            evidence_url: finalEvidence[0],
            ...(res.data && typeof res.data === 'object' ? {
              ...(res.data.title && { task: res.data.title }),
              ...(res.data.description && { desc: res.data.description }),
              ...(res.data.project_name && { project: res.data.project_name, project_name: res.data.project_name }),
              ...(res.data.work_category && { category: res.data.work_category, work_category: res.data.work_category }),
              ...(res.data.progress !== undefined && { progress: Number(res.data.progress) }),
            } : {}),
          };

          if (onUpdateReport) {
            await onUpdateReport(updatedReport);
          }
          if (onCancel) {
            onCancel();
          }
        } else {
          onAddToast(res?.message || 'Gagal memperbarui laporan. Silakan coba lagi.');
        }
      } else {
        // Mode Create
        if (!onAddReport) return;
        const newId = await onAddReport({
          person: reporterName,
          date: reportDate,
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

        if (newId && onSelectReport && onNavigate) {
          onSelectReport(newId);
          onNavigate('report-detail');
        } else if (onNavigate) {
          onNavigate('reports');
        }
      }
    } catch (err: any) {
      console.error('Submit report error:', err);
      let errorMsg = 'Gagal menyimpan laporan. Silakan coba lagi.';
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
      onAddToast(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hidden file input for replacing an existing image */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleReplaceFileChange}
        hidden
      />

      {/* Hidden file input for uploading extra project doc */}
      <input
        ref={docFileInputRef}
        type="file"
        onChange={handleUploadProjectDoc}
        hidden
      />

      {/* Confirmation Modal for Photo Deletion */}
      {photoToDeleteIndex !== null && (
        <div
          className="edit-report-modal-overlay"
          style={{ zIndex: 10005 }}
          onClick={() => setPhotoToDeleteIndex(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '380px',
              padding: '24px',
              textAlign: 'center',
              border: '1.5px solid var(--line)',
              borderRadius: '12px',
              background: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '12px' }}>
              <Icon name="alert" size={28} style={{ color: 'var(--danger)', margin: '0 auto' }} />
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>
              Hapus Bukti Pekerjaan?
            </h4>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--muted)' }}>
              Foto bukti pekerjaan #{photoToDeleteIndex + 1} akan dihapus dari daftar bukti laporan ini.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPhotoToDeleteIndex(null)}
              >
                BATAL
              </button>
              <button
                type="button"
                className="btn btn-dark btn-sm"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => {
                  handleRemovePhoto(photoToDeleteIndex);
                  setPhotoToDeleteIndex(null);
                }}
              >
                HAPUS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Page Header */}
      <div className="page-head" style={{ marginBottom: '22px' }}>
        <div>
          <h1>{isEdit ? 'Edit Laporan Harian' : 'Formulir Laporan Harian'}</h1>
          <p className="sub">
            {isEdit
              ? 'Perbarui capaian kerja, progres deliverable, dan dokumentasi bukti pekerjaan.'
              : 'Dokumentasikan pencapaian, durasi kerja, dan kendala yang dihadapi hari ini.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (isEdit && onCancel) {
              onCancel();
            } else if (onNavigate) {
              onNavigate('reports');
            }
          }}
        >
          <Icon name="chevL" style={{ width: 16, height: 16 }} />
          <span>{isEdit ? 'Kembali ke Detail' : 'Kembali ke Laporan'}</span>
        </button>
      </div>

      <div className="form-layout">
        {/* Left Form: Comprehensive Form Fields */}
        <div className="card" style={{ padding: '26px' }}>
          {/* Date Card & Date Picker */}
          <div className="date-card" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="ic">
                <Icon name="calendar" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <b>{formatFullDateDisplay(reportDate)}</b>
                <span>Waktu Pelaporan Harian Tim Kreatif</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="input"
                style={{ padding: '6px 10px', fontSize: '13px', width: 'auto' }}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Field: Project Terkait & Kategori */}
            <div className="form-2col">
              <div className="field">
                <label htmlFor="report-project-select">Pilih Proyek Terkait *</label>
                <select
                  id="report-project-select"
                  className="input"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={isSubmitting}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                  {/* Ensure initial project is present in options */}
                  {selectedProject && !projects.some((p) => p.name === selectedProject) && (
                    <option value={selectedProject}>{selectedProject}</option>
                  )}
                </select>
              </div>

              <div className="field">
                <label htmlFor="report-category-select">Divisi &amp; Kategori Kerja</label>
                <select
                  id="report-category-select"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon || '📁'} {cat.name}
                    </option>
                  ))}
                  {/* Ensure initial category is present in options */}
                  {category && !categories.some((c) => c.name === category) && (
                    <option value={category}>📁 {category}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Field: Judul Tugas / Pekerjaan */}
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
                disabled={isSubmitting}
              />
              {taskErr && <span className="err">{taskErr}</span>}
            </div>

            {/* Field: Deskripsi Rinci Pekerjaan */}
            <div className="field">
              <label htmlFor="report-desc-input">Deskripsi Rinci Pekerjaan</label>
              <textarea
                id="report-desc-input"
                rows={4}
                placeholder="Tuliskan detail hal-hal yang telah kamu selesaikan, perubahan yang dibuat..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* BUKTI PEKERJAAN UPLOAD & GALLERY SECTION */}
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
                    disabled={isSubmitting}
                  >
                    <Icon name="camera" style={{ width: 16, height: 16 }} />
                    <span>+ Tambah Bukti</span>
                  </button>
                  <span className="picker-status-txt">
                    {evidenceItems.length > 0
                      ? `✓ ${evidenceItems.length} foto bukti pekerjaan tersimpan/dipilih`
                      : 'Pilih satu atau beberapa screenshot/foto pekerjaan Anda'}
                  </span>
                </div>

                {/* Thumbnails Gallery with Action buttons */}
                {evidenceItems.length > 0 && (
                  <div className="evidence-form-thumbs-grid">
                    {evidenceItems.map((item, idx) => (
                      <div key={item.id || idx} className="evidence-form-thumb-item" style={{ position: 'relative' }}>
                        <img
                          src={item.previewUrl}
                          alt={`Bukti ${idx + 1}`}
                          className="thumb-img"
                          onClick={() => {
                            setActivePreviewIndex(idx);
                            setIsLightboxOpen(true);
                          }}
                          title="Klik untuk pratinjau penuh"
                        />

                        {/* Action buttons overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '4px',
                            right: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '4px',
                            background: 'rgba(20, 19, 26, 0.82)',
                            borderRadius: '4px',
                            padding: '2px 4px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleReplaceClick(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                            title="Ganti foto ini"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoToDeleteIndex(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#fca5a5',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                            title="Hapus foto ini"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Field: Persentase Capaian Tugas */}
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
                  disabled={isSubmitting}
                />
                <span className="slider-val" style={{ color: 'var(--violet)' }}>
                  {progress}%
                </span>
              </div>
            </div>

            {/* Field: Status Laporan */}
            <div className="field">
              <label>Status Laporan</label>
              <div className="status-toggle">
                {(['To Do', 'In Progress', 'In Review', 'Completed'] as Report['status'][]).map(
                  (s) => (
                    <div
                      key={s}
                      className={`status-opt ${status === s ? 'sel' : ''}`}
                      onClick={() => !isSubmitting && setStatus(s)}
                    >
                      <span className="rd" />
                      <span>{s}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Field: Durasi & Kendala */}
            <div className="form-2col">
              <div className="field">
                <label htmlFor="report-time-input">Durasi Pengerjaan</label>
                <input
                  id="report-time-input"
                  type="text"
                  placeholder="Misal: 4 jam 30 mnt"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Field: Rencana Pengerjaan Besok */}
            <div className="field">
              <label htmlFor="report-next-input">Rencana Pengerjaan Besok</label>
              <input
                id="report-next-input"
                type="text"
                placeholder="Langkah berikutnya yang akan dikerjakan"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Field: Lampiran & Berkas Bukti (Dari Backend MySQL) */}
            <div className="field" style={{ marginTop: '20px' }}>
              <div className="field-label-row">
                <label>Lampiran &amp; Berkas Proyek ({projectDocs.length})</label>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => docFileInputRef.current?.click()}
                  disabled={isSubmitting || isUploadingDoc}
                >
                  <Icon name="plus" size={12} />
                  <span>{isUploadingDoc ? 'Mengunggah...' : '+ Tambah File'}</span>
                </button>
              </div>

              {projectDocs.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px',
                    marginTop: '8px',
                  }}
                >
                  {projectDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={`${API_BASE_URL}/project-documents/original.php?id=${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attach-card"
                      style={{ padding: '8px', textDecoration: 'none', color: 'inherit' }}
                      title={`Buka berkas ${doc.original_name}`}
                    >
                      <div className="attach-meta">
                        <div className="fn" style={{ fontSize: '12px' }}>{doc.original_name}</div>
                        <div className="fs">
                          {doc.file_size_formatted || (doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Berkas')}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
                  Belum ada berkas lampiran tambahan dari server untuk proyek ini.
                </p>
              )}
            </div>

            {/* Action Buttons: [BATAL] & [SIMPAN PERUBAHAN] / [Kirim Laporan] */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button
                type="submit"
                className="btn btn-dark"
                disabled={isSubmitting}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="btn-spinner" style={{ marginRight: '6px' }} />
                    <span>{isEdit ? 'Menyimpan Perubahan...' : 'Mengirim Laporan...'}</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" style={{ width: 18, height: 18 }} />
                    <span>{isEdit ? 'SIMPAN PERUBAHAN' : 'Kirim Laporan Kerja'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  if (isEdit && onCancel) {
                    onCancel();
                  } else if (onNavigate) {
                    onNavigate('reports');
                  }
                }}
                disabled={isSubmitting}
              >
                <Icon name="x" style={{ width: 16, height: 16 }} />
                <span>BATAL</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: Live Realtime Preview Card */}
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
                      onClick={() => handleReplaceClick(activePreviewIndex)}
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-xs"
                      onClick={() => setPhotoToDeleteIndex(activePreviewIndex)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Metadata Rows (Realtime sync) */}
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
