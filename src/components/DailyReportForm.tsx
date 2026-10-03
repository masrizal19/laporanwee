import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectDocument, Report, ViewType, DailyReportFile } from '../types';
import { Icon } from '../components/icons';
import { ImageLightbox } from '../components/ImageLightbox';
import { getUserDisplayName } from '../utils/userUtils';
import {
  api,
  API_BASE_URL,
  dailyReportService,
  mapFrontendStatusToBackend,
  formatApiErrorMessage,
} from '../utils/api';
import { categoryService, WorkCategory } from '../utils/categoryService';
import { projectService } from '../utils/projectService';
import { formatFileSize } from '../utils/taskDocuments';

export interface EvidenceFileItem {
  id: string;
  file_id?: number | string;
  file?: File;
  previewUrl: string;
  serverUrl?: string;
  name: string;
  size?: number;
  sizeFormatted?: string;
  isNew?: boolean;
}

export interface PendingAttachmentFile {
  id: string;
  file: File;
  name: string;
  size: number;
  sizeFormatted: string;
  type: string;
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
    return isEdit && initialReport ? initialReport.duration || initialReport.time || '4 jam 30 mnt' : '4 jam 30 mnt';
  });

  const [challenges, setChallenges] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.obstacles || initialReport.challenges || '' : '';
  });

  const [next, setNext] = useState<string>(() => {
    return isEdit && initialReport ? initialReport.next_plan || initialReport.next || '' : '';
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

  // Project Documents (Lampiran & Berkas) — Max 2 GB per file
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [reportAttachmentFiles, setReportAttachmentFiles] = useState<DailyReportFile[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingAttachmentFile[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<number | string | null>(null);
  const [docToDelete, setDocToDelete] = useState<{ id: string | number; name: string } | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // 2 GB limit per file (2,147,483,648 bytes)
  const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

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

  // SINGLE SOURCE OF TRUTH: In Edit Mode, fetch freshest report data, proof files, and attachments from backend MySQL API
  useEffect(() => {
    if (!isEdit || !initialReport?.id) return;
    let isMounted = true;

    // 1. Fetch freshest report fields from backend
    dailyReportService
      .fetchDailyReportDetail(initialReport.id)
      .then((fresh) => {
        if (!isMounted || !fresh) return;
        if (fresh.task) setTask(fresh.task);
        if (fresh.desc) setDesc(fresh.desc);
        if (fresh.project || fresh.project_name) {
          setSelectedProject(fresh.project_name || fresh.project);
        }
        if (fresh.category || fresh.work_category) {
          setCategory(fresh.work_category || fresh.category);
          categoryService.ensureCategoryExists(fresh.work_category || fresh.category);
        }
        if (typeof fresh.progress === 'number') setProgress(fresh.progress);
        if (fresh.status) setStatus(fresh.status);
        if (fresh.duration || fresh.time) setTimeSpent(fresh.duration || fresh.time || '');
        if (fresh.obstacles || fresh.challenges) setChallenges(fresh.obstacles || fresh.challenges || '');
        if (fresh.next_plan || fresh.next) setNext(fresh.next_plan || fresh.next || '');
        if (fresh.report_date || fresh.date) {
          setReportDate(parseToDateInput(fresh.report_date || fresh.date));
        }
      })
      .catch((err) => console.warn('Fetch report detail notice:', err));

    // 2. Fetch proof files (category=proof) from backend
    dailyReportService
      .fetchReportFiles(initialReport.id, 'proof')
      .then((files) => {
        if (!isMounted) return;
        if (files && files.length > 0) {
          setEvidenceItems(
            files.map((f, idx) => ({
              id: `ev_server_${f.id}`,
              file_id: f.id,
              previewUrl: f.file_url,
              serverUrl: f.file_url,
              name: f.original_name || f.file_name || `Foto Bukti #${idx + 1}`,
              size: f.file_size,
              sizeFormatted: f.file_size_formatted,
            }))
          );
        }
      })
      .catch((err) => console.warn('Fetch proof files notice:', err));

    // 3. Fetch attachment files (category=attachment) from backend
    dailyReportService
      .fetchReportFiles(initialReport.id, 'attachment')
      .then((files) => {
        if (!isMounted) return;
        if (files && files.length > 0) {
          setReportAttachmentFiles(files);
        }
      })
      .catch((err) => console.warn('Fetch attachment files notice:', err));

    return () => {
      isMounted = false;
    };
  }, [isEdit, initialReport?.id]);

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

  // Process selected image files using native File / FormData without Base64, canvas, or compression
  const processImageFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const validFiles = fileList.filter((f) => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
      onAddToast('Mohon pilih file gambar yang valid (JPG, PNG, atau WEBP).');
      return;
    }

    // In Edit mode with backend report ID, upload directly to MySQL API
    if (isEdit && initialReport?.id) {
      setIsSubmitting(true);
      try {
        for (const file of validFiles) {
          await dailyReportService.uploadReportFile(initialReport.id, file, 'proof');
        }
        // Re-fetch freshest proof files from backend
        const files = await dailyReportService.fetchReportFiles(initialReport.id, 'proof');
        if (files && files.length > 0) {
          setEvidenceItems(
            files.map((f, idx) => ({
              id: `ev_server_${f.id}`,
              file_id: f.id,
              previewUrl: f.file_url,
              serverUrl: f.file_url,
              name: f.original_name || f.file_name || `Foto Bukti #${idx + 1}`,
              size: f.file_size,
              sizeFormatted: f.file_size_formatted,
            }))
          );
        }
        onAddToast(`✓ ${validFiles.length} foto bukti pekerjaan berhasil diunggah ke server.`);
      } catch (err) {
        console.warn('Upload proof error:', err);
        onAddToast(formatApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // In Create mode, stage native File instances
    const newItems: EvidenceFileItem[] = validFiles.map((file) => ({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      isNew: true,
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

  const handleRemovePhoto = async (indexToRemove: number) => {
    const target = evidenceItems[indexToRemove];
    if (isEdit && target?.file_id && initialReport?.id) {
      setIsSubmitting(true);
      try {
        await dailyReportService.deleteReportFile(target.file_id);
        onAddToast('Foto bukti pekerjaan berhasil dihapus dari server.');
        // Re-fetch freshest proof files from backend
        const files = await dailyReportService.fetchReportFiles(initialReport.id, 'proof');
        setEvidenceItems(
          files.map((f, idx) => ({
            id: `ev_server_${f.id}`,
            file_id: f.id,
            previewUrl: f.file_url,
            serverUrl: f.file_url,
            name: f.original_name || f.file_name || `Foto Bukti #${idx + 1}`,
            size: f.file_size,
            sizeFormatted: f.file_size_formatted,
          }))
        );
        return;
      } catch (err) {
        console.warn('Delete proof error:', err);
        onAddToast(formatApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    }

    setEvidenceItems((prev) => {
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

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replaceIndex === null) return;

    if (!file.type.startsWith('image/')) {
      onAddToast('Mohon pilih file gambar yang valid.');
      return;
    }

    const targetItem = evidenceItems[replaceIndex];
    if (isEdit && targetItem?.file_id && initialReport?.id) {
      setIsSubmitting(true);
      try {
        await dailyReportService.replaceReportFile(targetItem.file_id, file);
        onAddToast(`Foto bukti berhasil diganti di server.`);
        const files = await dailyReportService.fetchReportFiles(initialReport.id, 'proof');
        setEvidenceItems(
          files.map((f, idx) => ({
            id: `ev_server_${f.id}`,
            file_id: f.id,
            previewUrl: f.file_url,
            serverUrl: f.file_url,
            name: f.original_name || f.file_name || `Foto Bukti #${idx + 1}`,
            size: f.file_size,
            sizeFormatted: f.file_size_formatted,
          }))
        );
      } catch (err) {
        console.warn('Replace proof error:', err);
        onAddToast(formatApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
        setReplaceIndex(null);
        e.target.value = '';
      }
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
            isNew: true,
          };
        }
        return item;
      });
    });

    onAddToast(`Foto #${replaceIndex + 1} berhasil diganti dengan "${file.name}".`);
    setReplaceIndex(null);
    e.target.value = '';
  };

  // Process selected attachment files with strict 2 GB per-file validation
  const handleSelectAttachmentFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const accepted: File[] = [];
    const rejected: { name: string; sizeFormatted: string }[] = [];

    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push({
          name: file.name,
          sizeFormatted: formatFileSize(file.size),
        });
      } else {
        accepted.push(file);
      }
    }

    if (rejected.length > 0) {
      rejected.forEach((item) => {
        onAddToast(`File "${item.name}" ditolak (${item.sizeFormatted}). Ukuran maksimal 2 GB per file.`);
      });
    }

    if (accepted.length === 0) return;

    // In Edit mode, upload directly to MySQL API
    if (isEdit && initialReport?.id) {
      setIsSubmitting(true);
      try {
        const matchedProject = projects.find((p) => p.name === selectedProject) || projects[0];
        const projId = matchedProject ? matchedProject.id : 8;

        for (const file of accepted) {
          await dailyReportService.uploadReportFile(initialReport.id, file, 'attachment');
          try {
            await projectService.uploadDocument(projId, file);
          } catch (_) {}
        }

        const files = await dailyReportService.fetchReportFiles(initialReport.id, 'attachment');
        if (files) setReportAttachmentFiles(files);
        if (projId) {
          const docs = await projectService.fetchDocuments(projId);
          if (docs) setProjectDocs(docs);
        }
        onAddToast(`✓ ${accepted.length} berkas berhasil diunggah ke server.`);
      } catch (err) {
        console.warn('Upload attachment error:', err);
        onAddToast(formatApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // In Create mode, stage files
    const pendingItems: PendingAttachmentFile[] = accepted.map((file) => ({
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      type: file.type || 'application/octet-stream',
    }));

    setPendingDocs((prev) => [...prev, ...pendingItems]);
    onAddToast(`✓ ${accepted.length} berkas berhasil ditambahkan ke daftar lampiran.`);
  };

  const handleAttachmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectAttachmentFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleAttachmentDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectAttachmentFiles(e.dataTransfer.files);
    }
  };

  const handleRemovePendingDoc = (id: string, name: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.id !== id));
    onAddToast(`Berkas "${name}" dibatalkan dari daftar upload.`);
  };

  const handleDeleteAttachmentDoc = async (itemToDelete: { id: string | number; name: string }) => {
    setDeletingDocId(itemToDelete.id);
    try {
      // 1. Delete from daily report files
      try {
        await dailyReportService.deleteReportFile(itemToDelete.id);
      } catch (_) {}
      // 2. Also delete from project docs if matched
      try {
        await projectService.deleteDocument(itemToDelete.id);
      } catch (_) {}

      // Re-fetch from backend
      if (initialReport?.id) {
        const files = await dailyReportService.fetchReportFiles(initialReport.id, 'attachment');
        setReportAttachmentFiles(files || []);
      }
      const matched = projects.find((p) => p.name === selectedProject);
      if (matched?.id) {
        const docs = await projectService.fetchDocuments(matched.id);
        setProjectDocs(docs || []);
      } else {
        setProjectDocs((prev) => prev.filter((d) => String(d.id) !== String(itemToDelete.id)));
      }
      onAddToast(`Berkas "${itemToDelete.name}" berhasil dihapus dari server.`);
    } catch (err) {
      console.warn('Delete attachment error:', err);
      onAddToast(formatApiErrorMessage(err));
    } finally {
      setDeletingDocId(null);
      setDocToDelete(null);
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

      // 1. Upload pending project attachment files to MySQL project-documents (Max 2 GB per file)
      if (pendingDocs.length > 0) {
        for (const item of pendingDocs) {
          try {
            const uploadedDoc = await projectService.uploadDocument(projectId, item.file);
            if (uploadedDoc) {
              setProjectDocs((prev) => [uploadedDoc, ...prev]);
            }
          } catch (uploadDocErr) {
            console.warn(`Gagal upload berkas lampiran "${item.name}":`, uploadDocErr);
          }
        }
        setPendingDocs([]);
      }

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
          duration: timeSpent.trim() || '4 jam 00 mnt',
          obstacles: challenges.trim() || '',
          next_plan: next.trim() || '',
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
            time: timeSpent.trim() || '4 jam 00 mnt',
            duration: timeSpent.trim() || '4 jam 00 mnt',
            challenges: challenges.trim() || 'Tidak ada kendala berarti.',
            obstacles: challenges.trim() || 'Tidak ada kendala berarti.',
            next: next.trim() || 'Melanjutkan modul sprint berikutnya.',
            next_plan: next.trim() || 'Melanjutkan modul sprint berikutnya.',
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
              ...(res.data.duration && { time: res.data.duration, duration: res.data.duration }),
              ...(res.data.obstacles && { challenges: res.data.obstacles, obstacles: res.data.obstacles }),
              ...(res.data.next_plan && { next: res.data.next_plan, next_plan: res.data.next_plan }),
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

      {/* Hidden file input for project attachments supporting multiple selection and 2 GB limit */}
      <input
        ref={docFileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz,.mp4,.mov,.webm,.mkv,.avi,image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-rar-compressed"
        multiple
        onChange={handleAttachmentInputChange}
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

      {/* Confirmation Modal for Project Document Deletion from MySQL */}
      {docToDelete && (
        <div
          className="edit-report-modal-overlay"
          style={{ zIndex: 10006 }}
          onClick={() => !deletingDocId && setDocToDelete(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '400px',
              padding: '24px',
              textAlign: 'center',
              border: '1.5px solid var(--line)',
              borderRadius: '12px',
              background: 'var(--card, #fff)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '12px', display: 'inline-flex', padding: '10px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <Icon name="trash" size={26} />
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 800 }}>
              Hapus Berkas dari Server?
            </h4>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus berkas <b>"{docToDelete.name}"</b> dari server? File yang dihapus tidak dapat dipulihkan.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDocToDelete(null)}
                disabled={Boolean(deletingDocId)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: '#dc2626', color: '#fff', border: '1px solid #dc2626' }}
                onClick={() => handleDeleteAttachmentDoc(docToDelete)}
                disabled={Boolean(deletingDocId)}
              >
                {deletingDocId ? 'Menghapus...' : 'Ya, Hapus Berkas'}
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

            {/* Field: Lampiran & Berkas Proyek (Maksimal 2 GB per file) */}
            <div className="field" style={{ marginTop: '24px' }}>
              <div
                className="field-label-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <label style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>
                    Lampiran &amp; Berkas Proyek ({projectDocs.length + pendingDocs.length})
                  </label>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Ukuran maksimal 2 GB per file. Format: JPG, PNG, WEBP, PDF, DOCX, XLSX, PPTX, ZIP, RAR, MP4, MOV, dll.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={() => docFileInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="plus" size={13} />
                  <span>+ Tambah File</span>
                </button>
              </div>

              {/* Drag and Drop Container & File Cards List */}
              <div
                className="attachment-dropzone-box"
                onDrop={handleAttachmentDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  border: '1.5px dashed var(--line-soft)',
                  borderRadius: '10px',
                  padding: '12px',
                  background: 'var(--paper)',
                  marginTop: '6px',
                }}
              >
                {projectDocs.length === 0 && pendingDocs.length === 0 ? (
                  <div
                    onClick={() => docFileInputRef.current?.click()}
                    style={{
                      padding: '28px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        padding: '10px',
                        borderRadius: '50%',
                        background: 'var(--card, #fff)',
                        border: '1px solid var(--line-soft)',
                        marginBottom: '10px',
                        color: 'var(--ink)',
                      }}
                    >
                      <Icon name="upload" size={22} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>
                      + Tambah File Lampiran Proyek
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                      Pilih atau seret berkas ke area ini (Maks. 2 GB per file)
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* 1. Pending Files (ready to be uploaded on submit) */}
                    {pendingDocs.map((item) => {
                      const isImg = item.type.startsWith('image/');
                      const isVid = item.type.startsWith('video/');
                      return (
                        <div
                          key={item.id}
                          className="attachment-file-row pending"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: 'var(--card, #fff)',
                            border: '1.5px solid var(--line-soft)',
                            borderRadius: '8px',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                background: 'var(--paper)',
                                border: '1px solid var(--line-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon name={isImg ? 'image' : isVid ? 'video' : 'doc'} size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  color: 'var(--ink)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={item.name}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginTop: '2px',
                                }}
                              >
                                <span>{item.sizeFormatted}</span>
                                <span>&bull;</span>
                                <span style={{ color: 'var(--violet)', fontWeight: 600 }}>
                                  File Baru (Menunggu Unggah)
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePendingDoc(item.id, item.name)}
                            disabled={isSubmitting}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 6px',
                              flexShrink: 0,
                            }}
                            title="Batalkan berkas ini"
                          >
                            <Icon name="x" size={13} />
                            <span>Hapus X</span>
                          </button>
                        </div>
                      );
                    })}

                    {/* 2. Stored Files (already in MySQL database) */}
                    {projectDocs.map((doc) => {
                      const isImg = doc.file_type === 'image';
                      const isVid = doc.file_type === 'video';
                      return (
                        <div
                          key={doc.id}
                          className="attachment-file-row stored"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: 'var(--card, #fff)',
                            border: '1.5px solid var(--line-soft)',
                            borderRadius: '8px',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                background: 'rgba(167, 139, 250, 0.15)',
                                border: '1px solid var(--line-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon name={isImg ? 'image' : isVid ? 'video' : 'doc'} size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <a
                                href={`${API_BASE_URL}/project-documents/original.php?id=${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  color: 'var(--ink)',
                                  textDecoration: 'none',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={`Buka berkas ${doc.original_name}`}
                              >
                                {doc.original_name}
                              </a>
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginTop: '2px',
                                }}
                              >
                                <span>
                                  {doc.file_size_formatted ||
                                    (doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'Berkas')}
                                </span>
                                <span>&bull;</span>
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Tersimpan di Server</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <a
                              href={`${API_BASE_URL}/project-documents/original.php?id=${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-xs"
                              style={{
                                textDecoration: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'inherit',
                              }}
                              title="Buka atau unduh berkas asli"
                            >
                              <span>Buka</span>
                              <span style={{ fontSize: '11px' }}>↗</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setDocToDelete({ id: doc.id, name: doc.original_name })}
                              disabled={deletingDocId === doc.id || isSubmitting}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 6px',
                              }}
                              title="Hapus berkas ini dari server"
                            >
                              <Icon name="x" size={13} />
                              <span>Hapus X</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
