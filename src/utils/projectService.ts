import { Project, ProjectDocument } from '../types';
import { api } from './api';
import { formatFileSize } from './taskDocuments';

const DEFAULT_TEAM_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
];

/**
  Map category string from backend to frontend icon key and readable label
 */
export const getCategoryMeta = (catStr?: string): { cat: string; catLabel: string } => {
  const c = (catStr || '').toLowerCase();
  if (c.includes('video') || c === 'video') {
    return { cat: 'video', catLabel: 'Videografi' };
  }
  if (c.includes('foto') || c.includes('photo') || c === 'camera') {
    return { cat: 'camera', catLabel: 'Fotografi' };
  }
  if (c.includes('code') || c.includes('web') || c.includes('mobile') || c === 'laptop') {
    return { cat: 'code', catLabel: 'Web & Mobile' };
  }
  if (c.includes('market') || c.includes('ads') || c === 'megaphone') {
    return { cat: 'megaphone', catLabel: 'Marketing' };
  }
  return { cat: 'palette', catLabel: catStr || 'Design & Code' };
};

/**
 * Maps raw backend Project object to frontend Project interface
 */
export const mapBackendProject = (item: any): Project => {
  const { cat, catLabel } = getCategoryMeta(item.category || item.cat);
  const name = item.title || item.name || 'Proyek Tanpa Judul';
  const desc = item.description || item.desc || 'Deliverable studio kreatif LaporanWee';
  const progress = typeof item.progress === 'number' ? item.progress : parseInt(item.progress, 10) || 0;
  const status = item.status || (progress === 100 ? 'Completed' : 'Active');
  const due = item.deadline || item.due || '31 Okt 2026';
  const thumbnail_url = item.cover_url || item.thumbnail_url || undefined;

  let evidence_urls: string[] = [];
  if (Array.isArray(item.evidence_urls)) {
    evidence_urls = item.evidence_urls;
  } else if (typeof item.evidence_urls === 'string' && item.evidence_urls.startsWith('[')) {
    try {
      evidence_urls = JSON.parse(item.evidence_urls);
    } catch (_) {}
  }
  if (evidence_urls.length === 0 && item.cover_url) {
    evidence_urls = [item.cover_url];
  }

  return {
    id: String(item.id),
    name,
    title: name,
    cat,
    catLabel: item.category || catLabel,
    category: item.category || catLabel,
    desc,
    description: desc,
    progress,
    team: Array.isArray(item.team) && item.team.length > 0 ? item.team : DEFAULT_TEAM_AVATARS,
    due,
    deadline: due,
    status,
    thumbnail_url,
    cover_url: item.cover_url || null,
    evidence_urls,
    created_by: item.created_by,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
};

/**
 * Maps raw backend Document object to frontend ProjectDocument interface
 */
export const mapBackendDocument = (item: any): ProjectDocument => {
  const fileSize = typeof item.file_size === 'number' ? item.file_size : parseInt(item.file_size, 10) || 0;
  return {
    id: item.id,
    project_id: item.project_id,
    original_name: item.original_name || item.file_name || 'Dokumen',
    file_name: item.file_name || 'file',
    file_url: item.file_url,
    mime_type: item.mime_type || 'application/octet-stream',
    file_type: item.file_type || (item.mime_type?.startsWith('video/') ? 'video' : 'image'),
    file_size: fileSize,
    file_size_formatted: formatFileSize(fileSize),
    uploaded_by: item.uploaded_by,
    created_at: item.created_at || 'Baru saja',
    updated_at: item.updated_at,
  };
};

export const projectService = {
  /**
   * GET /api/projects/list.php
   */
  fetchProjects: async (): Promise<Project[]> => {
    try {
      const res = await api.get('/projects/list.php');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendProject);
      }
      return [];
    } catch (err) {
      console.warn('Gagal memuat projects dari backend API:', err);
      throw err;
    }
  },

  /**
   * POST /api/projects/create.php
   */
  createProject: async (projectData: Partial<Project>): Promise<Project> => {
    const payload = {
      title: projectData.name || projectData.title || '',
      description: projectData.desc || projectData.description || '',
      category: projectData.catLabel || projectData.category || projectData.cat || 'Design & Code',
      status: projectData.status || 'Active',
      progress: typeof projectData.progress === 'number' ? projectData.progress : 0,
      deadline: projectData.due || projectData.deadline || '2026-10-31',
      cover_url: projectData.thumbnail_url || projectData.cover_url || null,
    };

    const res = await api.post('/projects/create.php', payload);
    if (res && res.success && res.data) {
      return mapBackendProject(res.data);
    }
    throw new Error(res?.message || 'Gagal membuat proyek');
  },

  /**
   * POST /api/projects/update.php
   */
  updateProject: async (projectData: Partial<Project> & { id: string | number }): Promise<Project> => {
    const payload: Record<string, any> = {
      id: projectData.id,
    };

    if (projectData.name || projectData.title) payload.title = projectData.name || projectData.title;
    if (projectData.desc !== undefined || projectData.description !== undefined) {
      payload.description = projectData.desc || projectData.description;
    }
    if (projectData.catLabel || projectData.category || projectData.cat) {
      payload.category = projectData.catLabel || projectData.category || projectData.cat;
    }
    if (projectData.status) payload.status = projectData.status;
    if (projectData.progress !== undefined) payload.progress = projectData.progress;
    if (projectData.due || projectData.deadline) payload.deadline = projectData.due || projectData.deadline;
    if (projectData.thumbnail_url !== undefined || projectData.cover_url !== undefined) {
      payload.cover_url = projectData.thumbnail_url || projectData.cover_url;
    }

    const res = await api.post('/projects/update.php', payload);
    if (res && res.success && res.data) {
      return mapBackendProject(res.data);
    }
    throw new Error(res?.message || 'Gagal memperbarui proyek');
  },

  /**
   * POST /api/projects/delete.php
   */
  deleteProject: async (projectId: string | number): Promise<boolean> => {
    const res = await api.post('/projects/delete.php', { id: projectId });
    return Boolean(res && res.success);
  },

  /**
   * GET /api/project-documents/list.php?project_id={id}
   */
  fetchDocuments: async (projectId: string | number): Promise<ProjectDocument[]> => {
    try {
      const res = await api.get(`/project-documents/list.php?project_id=${projectId}`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendDocument);
      }
      return [];
    } catch (err) {
      console.warn(`Gagal memuat dokumentasi proyek ${projectId}:`, err);
      return [];
    }
  },

  /**
   * POST /api/project-documents/upload.php
   * Supports image and video without frontend size limitation
   */
  uploadDocument: async (projectId: string | number, file: File): Promise<ProjectDocument> => {
    const formData = new FormData();
    formData.append('project_id', String(projectId));
    formData.append('file', file);

    const res = await api.upload('/project-documents/upload.php', formData);
    if (res && res.success && res.data) {
      return mapBackendDocument(res.data);
    }
    throw new Error(res?.message || 'Gagal mengunggah dokumentasi proyek');
  },

  /**
   * POST /api/project-documents/update.php
   */
  updateDocument: async (documentId: string | number, originalName: string): Promise<ProjectDocument> => {
    const res = await api.post('/project-documents/update.php', {
      id: documentId,
      original_name: originalName,
    });
    if (res && res.success && res.data) {
      return mapBackendDocument(res.data);
    }
    throw new Error(res?.message || 'Gagal mengubah nama dokumentasi');
  },

  /**
   * POST /api/project-documents/delete.php
   */
  deleteDocument: async (documentId: string | number): Promise<boolean> => {
    const res = await api.post('/project-documents/delete.php', {
      id: documentId,
    });
    return Boolean(res && res.success);
  },
};
