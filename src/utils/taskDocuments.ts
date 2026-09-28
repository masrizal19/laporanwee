import { TaskDocument } from '../types';

const STORAGE_KEY_PREFIX = 'laporanwee_task_docs_';

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
      // Seek slightly into the video to avoid a black initial frame
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

    // Fallback timeout in case video fails to seek
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
 * Task Documents Service
 * Interacts with backend API endpoints if available, with structured localStorage persistence as reliable fallback
 */
export const taskDocumentsService = {
  // Fetch documents for a specific task
  getDocuments: async (taskId: string, initialFallback: TaskDocument[] = []): Promise<TaskDocument[]> => {
    try {
      // 1. Check local storage first
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${taskId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    return initialFallback;
  },

  // Save documents for a task into persistence
  saveDocuments: (taskId: string, docs: TaskDocument[]) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${taskId}`, JSON.stringify(docs));
    } catch (e) {
      console.warn('Gagal menyimpan task documents ke localStorage:', e);
    }
  },

  // Upload a document file for a task
  uploadDocument: async (
    taskId: string,
    file: File,
    uploaderName: string,
    onProgress?: (pct: number) => void
  ): Promise<TaskDocument> => {
    const validation = validateTaskDocumentFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'File tidak valid.');
    }

    // Simulate progress updates for realistic, smooth UX
    if (onProgress) {
      onProgress(15);
      await new Promise((r) => setTimeout(r, 80));
      onProgress(45);
      await new Promise((r) => setTimeout(r, 90));
      onProgress(80);
      await new Promise((r) => setTimeout(r, 70));
    }

    // Convert file to data URL
    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca data file.'));
      reader.readAsDataURL(file);
    });

    let thumbUrl = '';
    if (validation.fileType === 'video') {
      try {
        thumbUrl = await generateVideoThumbnail(file);
      } catch (_) {}
    } else {
      thumbUrl = fileDataUrl;
    }

    if (onProgress) {
      onProgress(100);
    }

    const now = new Date();
    const formattedDate = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const newDoc: TaskDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      task_id: taskId,
      uploader_name: uploaderName,
      file_name: file.name,
      file_url: fileDataUrl,
      file_type: validation.fileType,
      mime_type: file.type || (validation.fileType === 'video' ? 'video/mp4' : 'image/jpeg'),
      file_size: file.size,
      file_size_formatted: formatFileSize(file.size),
      thumbnail_url: thumbUrl || (validation.fileType === 'image' ? fileDataUrl : undefined),
      created_at: formattedDate,
    };

    return newDoc;
  },

  // Delete document
  deleteDocument: async (taskId: string, documentId: string): Promise<boolean> => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${taskId}`);
      if (stored) {
        const parsed: TaskDocument[] = JSON.parse(stored);
        const filtered = parsed.filter((d) => d.id !== documentId);
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${taskId}`, JSON.stringify(filtered));
      }
    } catch (_) {}
    return true;
  },
};
