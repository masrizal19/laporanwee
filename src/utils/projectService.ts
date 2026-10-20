import { Project, ProjectDocument, ProjectTeamMember } from '../types';
import { api, API_BASE_URL } from './api';
import { formatFileSize } from './taskDocuments';

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

  // Audit if backend supplies team_members, members, or assignees
  let teamMembers: ProjectTeamMember[] = [];
  const rawMembers = item.team_members || item.members || item.assignees;
  if (Array.isArray(rawMembers) && rawMembers.length > 0) {
    teamMembers = rawMembers.map((m: any) => ({
      user_id: m.user_id || m.id,
      full_name: m.full_name || m.name || '',
      profile_title: m.profile_title || '',
      profile_location: m.profile_location || '',
      avatar_url: m.avatar_url || null,
    }));
  }

  // Use team array if provided by backend, otherwise empty
  const teamUrls: string[] = Array.isArray(item.team)
    ? item.team.filter((t: any) => typeof t === 'string' && t.trim() !== '')
    : [];

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
    team: teamUrls,
    teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
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
 * Returns original project document endpoint:
 * https://api-laporanwe.mkverse.my.id/api/project-documents/original.php?id={id}
 */
export const getOriginalDocumentUrl = (documentId: number | string): string => {
  return `${API_BASE_URL}/project-documents/original.php?id=${documentId}`;
};

/**
 * Maps raw backend Document object to frontend ProjectDocument interface
 */
export const mapBackendDocument = (item: any): ProjectDocument => {
  const fileSize = typeof item.file_size === 'number' ? item.file_size : parseInt(item.file_size, 10) || 0;
  const originalUrl = item.id ? getOriginalDocumentUrl(item.id) : (item.file_url || '');
  return {
    id: item.id,
    project_id: item.project_id,
    original_name: item.original_name || item.file_name || 'Dokumen',
    file_name: item.file_name || 'file',
    file_url: originalUrl,
    mime_type: item.mime_type || 'application/octet-stream',
    file_type: item.file_type || (item.mime_type?.startsWith('video/') ? 'video' : 'image'),
    file_size: fileSize,
    file_size_formatted: formatFileSize(fileSize),
    uploaded_by: item.uploaded_by,
    created_at: item.created_at || 'Baru saja',
    updated_at: item.updated_at,
  };
};

const DEFAULT_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Rebranding Kopi Nusa',
    title: 'Rebranding Kopi Nusa',
    desc: 'Identitas visual dan kemasan',
    description: 'Identitas visual dan kemasan',
    status: 'On-Track',
    progress: 78,
    cat: 'palette',
    catLabel: 'Desain & UI',
    category: 'Desain & UI',
    due: '2026-10-25',
    deadline: '2026-10-25',
    team: ['#e3ddfa', '#e9f5b8', '#f6e6cf'],
  },
  {
    id: '2',
    name: 'Kampanye Ramadan',
    title: 'Kampanye Ramadan',
    desc: 'Konten sosial media 30 hari',
    description: 'Konten sosial media 30 hari',
    status: 'On-Track',
    progress: 62,
    cat: 'megaphone',
    catLabel: 'Marketing',
    category: 'Marketing',
    due: '2026-11-01',
    deadline: '2026-11-01',
    team: ['#d6ecdf', '#f1d8e4', '#d9d3f5', '#e3ddfa'],
  },
  {
    id: '3',
    name: 'Website Studio Kaya',
    title: 'Website Studio Kaya',
    desc: 'Desain dan pengembangan landing page',
    description: 'Desain dan pengembangan landing page',
    status: 'Berisiko',
    progress: 34,
    cat: 'code',
    catLabel: 'Web & Mobile',
    category: 'Web & Mobile',
    due: '2026-10-30',
    deadline: '2026-10-30',
    team: ['#f6e6cf', '#e3ddfa'],
  },
  {
    id: '4',
    name: 'Video Profil Perusahaan',
    title: 'Video Profil Perusahaan',
    desc: 'Naskah, syuting, dan penyuntingan',
    description: 'Naskah, syuting, dan penyuntingan',
    status: 'On-Track',
    progress: 91,
    cat: 'video',
    catLabel: 'Videografi',
    category: 'Videografi',
    due: '2026-11-15',
    deadline: '2026-11-15',
    team: ['#d6ecdf', '#e9f5b8', '#f1d8e4'],
  },
  {
    id: '5',
    name: 'Katalog Produk 2026',
    title: 'Katalog Produk 2026',
    desc: 'Layout cetak dan digital',
    description: 'Layout cetak dan digital',
    status: 'Berisiko',
    progress: 48,
    cat: 'palette',
    catLabel: 'Desain & UI',
    category: 'Desain & UI',
    due: '2026-11-05',
    deadline: '2026-11-05',
    team: ['#e3ddfa', '#f6e6cf'],
  },
  {
    id: '6',
    name: 'Event Launching Q4',
    title: 'Event Launching Q4',
    desc: 'Dekorasi, rundown, dan publikasi',
    description: 'Dekorasi, rundown, dan publikasi',
    status: 'On-Track',
    progress: 55,
    cat: 'camera',
    catLabel: 'Event & Foto',
    category: 'Event & Foto',
    due: '2026-12-01',
    deadline: '2026-12-01',
    team: ['#d9d3f5', '#e9f5b8', '#f1d8e4', '#d6ecdf', '#f6e6cf'],
  },
];

export const projectService = {
  /**
   * GET /api/projects/list.php with dual-network fallback
   */
  fetchProjects: async (): Promise<Project[]> => {
    try {
      const res = await api.get('/projects/list.php');
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map(mapBackendProject);
        try {
          localStorage.setItem('laporanwee_cached_projects', JSON.stringify(mapped));
        } catch (_) {}
        return mapped;
      }
    } catch (err) {
      console.warn('Gagal memuat projects dari backend API, menggunakan cache dual-network:', err);
    }

    // Dual-network fallback to cache
    try {
      const cached = localStorage.getItem('laporanwee_cached_projects');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}

    return DEFAULT_PROJECTS;
  },

  /**
   * POST /api/projects/create.php with dual-network fallback
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

    try {
      const res = await api.post('/projects/create.php', payload);
      if (res && res.success && res.data) {
        const created = mapBackendProject(res.data);
        projectService.saveToLocalCache(created);
        return created;
      }
    } catch (err) {
      console.warn('Backend create project notice, saving to local cache:', err);
    }

    // Fallback local creation
    const localCreated: Project = {
      id: 'proj_' + Date.now(),
      name: payload.title,
      title: payload.title,
      desc: payload.description,
      description: payload.description,
      cat: 'palette',
      catLabel: payload.category,
      category: payload.category,
      status: payload.status,
      progress: payload.progress,
      due: payload.deadline,
      deadline: payload.deadline,
      team: ['#e3ddfa', '#d6ecdf'],
    };
    projectService.saveToLocalCache(localCreated);
    return localCreated;
  },

  saveToLocalCache: (proj: Project) => {
    try {
      const cached = localStorage.getItem('laporanwee_cached_projects');
      const list: Project[] = cached ? JSON.parse(cached) : [...DEFAULT_PROJECTS];
      const idx = list.findIndex((p) => String(p.id) === String(proj.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...proj };
      } else {
        list.unshift(proj);
      }
      localStorage.setItem('laporanwee_cached_projects', JSON.stringify(list));
    } catch (_) {}
  },

  /**
   * POST /api/projects/update.php with dual-network fallback
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

    try {
      const res = await api.post('/projects/update.php', payload);
      if (res && res.success && res.data) {
        const updated = mapBackendProject(res.data);
        projectService.saveToLocalCache(updated);
        return updated;
      }
    } catch (err) {
      console.warn('Backend update project notice, updating in local cache:', err);
    }

    // Update in local cache
    const updatedLocal: Project = {
      ...(projectData as any),
      id: String(projectData.id),
      name: payload.title || (projectData as any).name,
      title: payload.title || (projectData as any).title,
      desc: payload.description || (projectData as any).desc,
      description: payload.description || (projectData as any).description,
      progress: payload.progress !== undefined ? payload.progress : (projectData as any).progress,
      status: payload.status || (projectData as any).status,
    };
    projectService.saveToLocalCache(updatedLocal);
    return updatedLocal;
  },

  /**
   * POST /api/projects/delete.php with dual-network fallback
   */
  deleteProject: async (projectId: string | number): Promise<boolean> => {
    try {
      const res = await api.post('/projects/delete.php', { id: projectId });
      if (res && res.success) {
        projectService.removeFromLocalCache(projectId);
        return true;
      }
    } catch (err) {
      console.warn('Backend delete project notice, removing from local cache:', err);
    }

    projectService.removeFromLocalCache(projectId);
    return true;
  },

  removeFromLocalCache: (projectId: string | number) => {
    try {
      const cached = localStorage.getItem('laporanwee_cached_projects');
      if (cached) {
        const list: Project[] = JSON.parse(cached);
        const filtered = list.filter((p) => String(p.id) !== String(projectId));
        localStorage.setItem('laporanwee_cached_projects', JSON.stringify(filtered));
      }
    } catch (_) {}
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
   * POST https://api-laporanwe.mkverse.my.id/api/project-documents/delete.php
   */
  deleteDocument: async (documentId: string | number, filename?: string): Promise<boolean> => {
    const token =
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('laporanwee_token') ||
      '';
    try {
      const response = await fetch('https://api-laporanwe.mkverse.my.id/api/project-documents/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          id: documentId,
          filename: filename || '',
        }),
      });
      const res = await response.json().catch(() => ({ success: response.ok }));
      return Boolean(res && res.success !== false);
    } catch (err) {
      console.warn('Delete project document fallback:', err);
      return true;
    }
  },
};

