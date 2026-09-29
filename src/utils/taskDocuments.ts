import { TaskDocument } from '../types';
import { api } from './api';

/**
 * Helper to format file sizes nicely (e.g. "1.5 MB", "420 KB")
 */
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Generates a video thumbnail frame by drawing the first frame onto a canvas
 */
export const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 270;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.82);
          URL.revokeObjectURL(fileUrl);
          resolve(thumbUrl);
          return;
        }
      } catch (_) {}
      URL.revokeObjectURL(fileUrl);
      resolve('');
    };

    video.onerror = () => {
      URL.revokeObjectURL(fileUrl);
      resolve('');
    };

    setTimeout(() => {
      resolve('');
    }, 2500);
  });
};

/**
 * Validates uploaded file against allowed types, extensions and file size
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType: 'image' | 'video';
}

export const validateTaskDocumentFile = (file: File): FileValidationResult => {
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Format file ".${ext}" tidak didukung. Harap gunakan format JPG, PNG, WEBP, MP4, MOV, atau WEBM.`,
      fileType: 'image',
    };
  }

  // Explicit safety check against executable and script files
  const dangerousExtensions = ['php', 'phtml', 'php5', 'exe', 'sh', 'js', 'py', 'bat', 'cmd', 'html', 'svg'];
  if (dangerousExtensions.includes(ext)) {
    return {
      valid: false,
      error: 'File berbahaya atau executable tidak diizinkan untuk diunggah.',
      fileType: 'image',
    };
  }

  const isVideo = ['mp4', 'mov', 'webm'].includes(ext) || file.type.startsWith('video/');
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    return {
      valid: false,
      error: 'Hanya file gambar (JPG, PNG, WEBP) atau video (MP4, MOV, WEBM) yang diizinkan.',
      fileType: 'image',
    };
  }

  // Size limit: 25MB for video, 10MB for image
  const maxBytes = isVideo ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Ukuran file melebihi batas maksimal (${isVideo ? '25 MB' : '10 MB'}).`,
      fileType: isVideo ? 'video' : 'image',
    };
  }

  return {
    valid: true,
    fileType: isVideo ? 'video' : 'image',
  };
};

/**
 * Task Documents Service — Single Source of Truth from MySQL API
 */
export const taskDocumentsService = {
  // Fetch documents for a specific task directly from MySQL API
  getDocuments: async (taskId: string | number, _initialFallback: TaskDocument[] = []): Promise<TaskDocument[]> => {
    try {
      const res = await api.get(`/task-documents/list.php?task_id=${taskId}`);
      if (!res || !Array.isArray(res.data)) {
        return [];
      }

      return res.data.map((item: any): TaskDocument => {
        const fileType = item.file_type || (item.mime_type?.startsWith('video/') ? 'video' : 'image');
        const fileUrl = item.file_url || '';
        return {
          id: String(item.id),
          task_id: String(item.task_id || taskId),
          uploader_name: item.uploaded_by || item.uploader_name || 'Tim LaporanWee',
          file_name: item.original_name || item.file_name || 'Dokumentasi',
          file_url: fileUrl,
          file_type: fileType,
          mime_type: item.mime_type || (fileType === 'video' ? 'video/mp4' : 'image/jpeg'),
          file_size: Number(item.file_size) || 0,
          file_size_formatted: formatFileSize(Number(item.file_size) || 0),
          thumbnail_url: fileType === 'video' ? (item.thumbnail_url || undefined) : fileUrl,
          created_at: item.created_at || '',
        };
      });
    } catch (err) {
      console.warn(`Sync task documents for task ${taskId} from API notice:`, err);
      return [];
    }
  },

  // Save documents memory helper (no-op as MySQL is source of truth)
  saveDocuments: (_taskId: string | number, _docs: TaskDocument[]) => {
    // MySQL API is authoritative; no local storage caching needed
  },

  // Upload a document file for a task to backend MySQL API
  uploadDocument: async (
    taskId: string | number,
    file: File,
    uploaderName: string,
    onProgress?: (pct: number) => void
  ): Promise<TaskDocument> => {
    const validation = validateTaskDocumentFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'File tidak valid.');
    }

    if (onProgress) onProgress(25);

    const formData = new FormData();
    formData.append('task_id', String(taskId));
    formData.append('file', file);
    formData.append('uploader_name', uploaderName || 'Tim LaporanWee');

    if (onProgress) onProgress(50);

    const res = await api.upload('/task-documents/upload.php', formData);

    if (onProgress) onProgress(100);

    const data = res?.data || {};
    const fileType = data.file_type || validation.fileType;
    const fileUrl = data.file_url || '';

    return {
      id: String(data.id || Date.now()),
      task_id: String(data.task_id || taskId),
      uploader_name: uploaderName || data.uploaded_by || 'Tim LaporanWee',
      file_name: data.original_name || file.name,
      file_url: fileUrl,
      file_type: fileType,
      mime_type: data.mime_type || file.type || (fileType === 'video' ? 'video/mp4' : 'image/jpeg'),
      file_size: Number(data.file_size) || file.size,
      file_size_formatted: formatFileSize(Number(data.file_size) || file.size),
      thumbnail_url: fileType === 'video' ? undefined : fileUrl,
      created_at: data.created_at || new Date().toISOString(),
    };
  },

  // Delete document via MySQL API
  deleteDocument: async (_taskId: string | number, documentId: string | number): Promise<boolean> => {
    try {
      const numericId = Number(documentId);
      const res = await api.post('/task-documents/delete.php', {
        id: isNaN(numericId) ? documentId : numericId,
      });
      return Boolean(res && res.success !== false);
    } catch (err) {
      console.error('Delete task document API error:', err);
      return false;
    }
  },
};
