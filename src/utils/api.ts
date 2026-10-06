import {
  Project,
  ProjectDocument,
  Activity,
  CalendarEvent,
  Report,
  TeamMember,
  AnalyticsSummary,
  Task,
  TaskStatus,
  PriorityLevel,
  DailyReportFile,
} from '../types';

const rawEnvUrl = (import.meta.env.VITE_API_URL as string) || '';
let baseApi = rawEnvUrl.trim().replace(/\/+$/, '');

// Ensure strictly official backend HTTPS host with /api
if (!baseApi || !baseApi.startsWith('https://api-laporanwe.mkverse.my.id')) {
  baseApi = 'https://api-laporanwe.mkverse.my.id/api';
}
if (!baseApi.endsWith('/api')) {
  baseApi = `${baseApi}/api`;
}

export const API_BASE_URL = baseApi;

/**
 * Normalizes file URLs to ensure valid, public HTTPS URLs pointing to
 * https://api-laporanwe.mkverse.my.id/uploads/daily-reports/...
 * Handles relative filenames, legacy api domain, and paths seamlessly.
 */
export const normalizeFileUrl = (rawUrl?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  // If already a blob or data URL
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  // Replace legacy domain if present
  if (url.includes('api.mkverse.my.id')) {
    url = url.replace('api.mkverse.my.id', 'api-laporanwe.mkverse.my.id');
  }

  // Force HTTPS if pointing to official server
  if (url.startsWith('http://api-laporanwe.mkverse.my.id')) {
    url = url.replace('http://', 'https://');
  }

  // If already an absolute http/https URL pointing to an external or full host
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If relative path starting with /uploads/
  if (url.startsWith('/uploads/')) {
    return `https://api-laporanwe.mkverse.my.id${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `https://api-laporanwe.mkverse.my.id/${url}`;
  }

  // If relative file name without leading slash (e.g. "photo.jpg" or "daily_123.jpg")
  const cleanName = url.replace(/^\/+/, '');
  return `https://api-laporanwe.mkverse.my.id/uploads/daily-reports/${cleanName}`;
};

/**
 * Extracts avatar URL from any backend response structure.
 * Returns string if present, null if explicitly null, or undefined if not in payload.
 */
export const extractAvatarFromResponse = (res: any): string | null | undefined => {
  if (!res || typeof res !== 'object') return undefined;

  // Direct top-level
  if ('avatar_url' in res) return res.avatar_url;
  if ('avatar' in res) return res.avatar;

  // Inside data object
  if (res.data && typeof res.data === 'object') {
    if ('avatar_url' in res.data) return res.data.avatar_url;
    if ('avatar' in res.data) return res.data.avatar;
    if ('crop_url' in res.data) return res.data.crop_url;
    if ('file_url' in res.data) return res.data.file_url;
    if (res.data.user && typeof res.data.user === 'object') {
      if ('avatar_url' in res.data.user) return res.data.user.avatar_url;
      if ('avatar' in res.data.user) return res.data.user.avatar;
    }
  }

  // Inside user object
  if (res.user && typeof res.user === 'object') {
    if ('avatar_url' in res.user) return res.user.avatar_url;
    if ('avatar' in res.user) return res.user.avatar;
  }

  return undefined;
};

/**
 * Safe avatar URL cache-busting helper.
 * Correctly normalizes to absolute HTTPS URL and adds or updates ?v= parameter without duplicating query strings.
 */
export const withAvatarCacheBust = (rawUrl?: string | null, version?: string | number): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('placeholder')) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const url = getAbsoluteAvatarUrl(trimmed);
  if (!url) return '';

  const v = version !== undefined && version !== null ? String(version) : String(Date.now());
  try {
    const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
    const dummyBase = isAbsolute ? undefined : 'https://api-laporanwe.mkverse.my.id';
    const parsed = new URL(url, dummyBase);
    parsed.searchParams.set('v', v);
    return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
  } catch (_) {
    const cleanUrl = url.split('?')[0];
    return `${cleanUrl}?v=${encodeURIComponent(v)}`;
  }
};

let latestProfileSaveTimestamp = 0;

export const recordProfileSaveTimestamp = () => {
  latestProfileSaveTimestamp = Date.now();
  return latestProfileSaveTimestamp;
};

export const getLatestProfileSaveTimestamp = () => latestProfileSaveTimestamp;

export interface ProfileUpdatePayload {
  id?: number;
  full_name?: string;
  name?: string;
  email?: string;
  role?: string;
  profile_title?: string;
  profile_location?: string;
  avatar_url?: string | null;
  updated_at?: string;
}

export const syncAuthenticatedUser = (profileData: ProfileUpdatePayload) => {
  const stored = getStoredUser();
  const updatedUser = {
    ...stored,
    ...(profileData.id !== undefined ? { id: profileData.id } : {}),
    ...(profileData.full_name !== undefined ? { full_name: profileData.full_name, name: profileData.full_name } : {}),
    ...(profileData.name !== undefined ? { name: profileData.name, full_name: profileData.name } : {}),
    ...(profileData.email !== undefined ? { email: profileData.email } : {}),
    ...(profileData.role !== undefined ? { role: profileData.role } : {}),
    ...(profileData.profile_title !== undefined ? { profile_title: profileData.profile_title } : {}),
    ...(profileData.profile_location !== undefined ? { profile_location: profileData.profile_location } : {}),
    avatar_url: profileData.avatar_url !== undefined ? profileData.avatar_url : stored?.avatar_url,
  };

  setStoredUser(updatedUser);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('laporanwee-profile-updated', { detail: updatedUser }));
  }
  return updatedUser;
};

/**
 * Guarantees a clean absolute HTTPS URL to the official backend:
 * https://api-laporanwe.mkverse.my.id/api/...
 */
export const buildApiUrl = (endpoint: string): string => {
  let clean = (endpoint || '').trim();

  // If already pointing to the official backend API
  if (clean.startsWith('https://api-laporanwe.mkverse.my.id/api/')) {
    return clean.replace('/api/api/', '/api/');
  }

  // If pointing to a frontend or wrong domain (e.g. http://laporan.mkverse.my.id)
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const u = new URL(clean);
      clean = u.pathname + u.search;
    } catch (_) {}
  }

  if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }

  // Normalize aliases so frontend routes or legacy endpoints never leak
  if (clean === '/login') clean = '/login.php';
  if (clean === '/api/login') clean = '/login.php';
  if (clean === '/resend-verification.php' || clean === '/api/resend-verification.php') {
    clean = '/email/resend-verification.php';
  }
  if (clean === '/verify-email.php' || clean === '/api/verify-email.php') {
    clean = '/email/verify-email.php';
  }

  if (clean.startsWith('/api/')) {
    clean = clean.substring(4); // strip leading /api
  }

  return `${API_BASE_URL}${clean}`.replace('/api/api/', '/api/');
};

export const getStoredToken = (): string | null => {
  const token = localStorage.getItem('laporanwee_token');
  if (!token || token === 'undefined' || token === 'null' || token === 'session-active-token') {
    return null;
  }
  return token.trim();
};

export const setStoredToken = (token: string) => {
  if (token && token.trim() && token !== 'session-active-token') {
    localStorage.setItem('laporanwee_token', token.trim());
  } else {
    localStorage.removeItem('laporanwee_token');
  }
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('laporanwee_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const setStoredUser = (user: any) => {
  if (user) {
    localStorage.setItem('laporanwee_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('laporanwee_user');
  }
};

export const clearStoredAuth = () => {
  localStorage.removeItem('laporanwee_token');
  localStorage.removeItem('laporanwee_user');
  localStorage.removeItem('laporanwee_daily_reports_cache');
  localStorage.removeItem('laporanwee_selected_report_id');
  localStorage.removeItem('laporanwee_last_sync');
};

// Helper to get authorization headers with stored Bearer token
export const getHeaders = () => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Include user email in X-Admin-Email header to ensure consistent backend authorization
  try {
    const user = getStoredUser();
    if (user?.email && typeof user.email === 'string') {
      headers['X-Admin-Email'] = user.email.trim();
    }
  } catch (_) {}

  return headers;
};

// Error helper
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export const handleResponse = async (response: Response, customUrl?: string, customMethod?: string) => {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const errorDetails = {
      url: customUrl || response.url,
      method: customMethod || 'UNKNOWN',
      status: response.status,
      response: text,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      message: 'Failed to parse JSON response'
    };
    console.error('[API ERROR]', errorDetails);
    throw {
      message: `Server mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  if (!response.ok || data.success === false) {
    const errorDetails = {
      url: customUrl || response.url,
      method: customMethod || 'UNKNOWN',
      status: response.status,
      response: data,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      message: data.message || data.error || `Terjadi kesalahan sistem (${response.status})`
    };
    console.error('[API ERROR]', errorDetails);
    throw {
      message: data.message || data.error || `Terjadi kesalahan sistem (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  return data;
};

/**
 * Standard Indonesian error messages mapping for consistent UX
 */
export const formatApiErrorMessage = (err: any): string => {
  if (!err) return 'Terjadi kesalahan sistem.';
  const status = Number(err.status || err.code);
  if (status === 401) return 'Session tidak valid atau sudah berakhir.';
  if (status === 403) return 'Anda tidak memiliki izin untuk mengubah laporan ini.';
  if (status === 404) return 'Laporan/file tidak ditemukan.';
  if (status === 413) return 'Ukuran file terlalu besar.';
  if (status === 422) return 'Terdapat data yang belum valid.';
  if (status === 500) return 'Terjadi kesalahan server.';
  if (
    err.name === 'TypeError' ||
    err.message?.toLowerCase().includes('failed to fetch') ||
    err.message?.toLowerCase().includes('network')
  ) {
    return 'Backend tidak dapat dihubungi.';
  }
  return err.message || 'Terjadi kesalahan pada sistem.';
};

export const api = {
  get: async (endpoint: string, options?: { signal?: AbortSignal }) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'GET', url });
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
      signal: options?.signal,
    });
    return handleResponse(response, url, 'GET');
  },

  post: async (endpoint: string, body: any, options?: { signal?: AbortSignal }) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'POST', url });
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    return handleResponse(response, url, 'POST');
  },

  put: async (endpoint: string, body: any, options?: { signal?: AbortSignal }) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'PUT', url });
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    return handleResponse(response, url, 'PUT');
  },

  delete: async (endpoint: string, options?: { signal?: AbortSignal }) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'DELETE', url });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
      signal: options?.signal,
    });
    return handleResponse(response, url, 'DELETE');
  },

  upload: async (endpoint: string, formData: FormData) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'POST (UPLOAD)', url });
    const token = localStorage.getItem('laporanwee_token');
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token && token !== 'undefined' && token !== 'null') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      const storedUser = localStorage.getItem('laporanwee_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.email) {
          headers['X-Admin-Email'] = parsed.email.trim();
        }
      }
    } catch (_) {}

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(response, url, 'POST (UPLOAD)');
  },
};

// ==========================================
// 1. PROJECT SERVICE (MySQL API)
// ==========================================
export const projectService = {
  fetchProjects: async (): Promise<Project[]> => {
    const res = await api.get('/projects/list.php');
    if (!res || !Array.isArray(res.data)) {
      return [];
    }

    return res.data.map((item: any): Project => {
      const category = item.category || 'Creative';
      let cat = 'palette';
      if (category.toLowerCase().includes('photo')) cat = 'camera';
      else if (category.toLowerCase().includes('video')) cat = 'video';
      else if (category.toLowerCase().includes('code') || category.toLowerCase().includes('dev')) cat = 'sparkle';

      const teamList = Array.isArray(item.team)
        ? item.team
        : typeof item.team === 'string' && item.team.trim()
        ? item.team.split(',').map((s: string) => s.trim())
        : (item.created_by ? [item.created_by] : []);

      return {
        id: String(item.id),
        name: item.title || item.name || 'Untitled Project',
        title: item.title || item.name || 'Untitled Project',
        cat,
        catLabel: category,
        category,
        desc: item.description || '',
        description: item.description || '',
        progress: Number(item.progress) || 0,
        team: teamList,
        due: item.deadline ? item.deadline.slice(0, 10) : '2026-10-20',
        deadline: item.deadline || '',
        status: item.status || 'Active',
        cover_url: item.cover_url || null,
        thumbnail_url: item.cover_url || undefined,
        created_by: item.created_by || '',
        created_at: item.created_at || '',
        updated_at: item.updated_at || '',
        evidence_urls: item.cover_url ? [item.cover_url] : [],
      };
    });
  },

  createProject: async (projectData: Omit<Project, 'id'>): Promise<Project> => {
    const payload = {
      title: projectData.name || projectData.title,
      description: projectData.desc || projectData.description || '',
      category: projectData.catLabel || projectData.category || 'Design & Code',
      status: projectData.status || 'Active',
      progress: projectData.progress || 0,
      deadline: projectData.due || projectData.deadline || '2026-10-30',
      cover_url: projectData.thumbnail_url || projectData.cover_url || null,
    };
    const res = await api.post('/projects/create.php', payload);
    const createdId = res?.data?.id ? String(res.data.id) : `p_${Date.now()}`;
    return {
      id: createdId,
      ...projectData,
    };
  },

  updateProject: async (project: Project): Promise<void> => {
    const payload = {
      id: Number(project.id) || project.id,
      title: project.name || project.title,
      description: project.desc || project.description || '',
      category: project.catLabel || project.category || 'Design & Code',
      status: project.status || 'Active',
      progress: project.progress || 0,
      deadline: project.due || project.deadline || '',
      cover_url: project.thumbnail_url || project.cover_url || null,
    };
    await api.post('/projects/update.php', payload);
  },

  deleteProject: async (projectId: string | number): Promise<boolean> => {
    const numericId = Number(projectId);
    const payload = { id: isNaN(numericId) ? projectId : numericId };
    const res = await api.post('/projects/delete.php', payload);
    return res && res.success !== false;
  },
};

// ==========================================
// 2. PROJECT DOCUMENTS SERVICE (MySQL API)
// ==========================================
export const documentService = {
  fetchDocuments: async (projectId: string | number): Promise<ProjectDocument[]> => {
    const res = await api.get(`/project-documents/list.php?project_id=${projectId}`);
    if (!res || !Array.isArray(res.data)) {
      return [];
    }
    return res.data;
  },

  uploadDocument: async (formData: FormData): Promise<any> => {
    return api.upload('/project-documents/upload.php', formData);
  },

  updateDocument: async (id: number | string, originalName: string): Promise<any> => {
    return api.post('/project-documents/update.php', {
      id: Number(id) || id,
      original_name: originalName,
    });
  },

  deleteDocument: async (id: number | string): Promise<any> => {
    return api.post('/project-documents/delete.php', {
      id: Number(id) || id,
    });
  },
};

// ==========================================
// 3. ACTIVITY SERVICE (MySQL API)
// ==========================================
export const activityService = {
  fetchActivities: async (): Promise<Activity[]> => {
    const res = await api.get('/activities/list.php');
    if (!res || !Array.isArray(res.data)) {
      return [];
    }

    return res.data.map((item: any): Activity => {
      const activityType = item.activity_type || 'Tasks';
      let kind: Activity['kind'] = 'Tasks';
      if (activityType === 'Reports' || activityType === 'report') kind = 'Reports';
      else if (activityType === 'Files' || activityType === 'file' || activityType === 'document') kind = 'Files';
      else if (activityType === 'Comments' || activityType === 'comment') kind = 'Comments';

      let icon = item.icon_type || 'checksq';
      if (!item.icon_type) {
        if (kind === 'Reports') icon = 'doc';
        else if (kind === 'Files') icon = 'camera';
        else if (kind === 'Comments') icon = 'comment';
        else icon = 'folder';
      }

      const person = item.user_name || item.user_email?.split('@')[0] || 'Tim LaporanWee';
      const action = item.title || 'memperbarui aktivitas';
      const quote = item.description ? `"${item.description}"` : '';

      // Format time from created_at
      let time = 'Baru saja';
      if (item.created_at) {
        try {
          const d = new Date(item.created_at.replace(' ', 'T'));
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
          if (diffMinutes < 1) time = 'Baru saja';
          else if (diffMinutes < 60) time = `${diffMinutes} mnt lalu`;
          else if (diffMinutes < 1440) time = `${Math.floor(diffMinutes / 60)} jam lalu`;
          else time = item.created_at.slice(0, 10);
        } catch (_) {
          time = item.created_at;
        }
      }

      return {
        id: String(item.id),
        person,
        action,
        quote,
        time,
        project: item.reference_name || item.description || 'LaporanWee',
        kind,
        icon,
      };
    });
  },

  createActivity: async (act: {
    title: string;
    description?: string;
    activity_type?: string;
    icon_type?: string;
    user_name?: string;
    user_email?: string;
    reference_type?: string;
    reference_id?: number | string;
  }): Promise<void> => {
    try {
      await api.post('/activities/create.php', {
        title: act.title,
        description: act.description || '',
        activity_type: act.activity_type || 'general',
        icon_type: act.icon_type || null,
        user_name: act.user_name || '',
        user_email: act.user_email || '',
        reference_type: act.reference_type || null,
        reference_id: act.reference_id || null,
      });
    } catch (err) {
      console.warn('Log activity error:', err);
    }
  },

  deleteActivity: async (id: string | number): Promise<boolean> => {
    const numericId = Number(id);
    const res = await api.post('/activities/delete.php', {
      id: isNaN(numericId) ? id : numericId,
    });
    return res && res.success !== false;
  },

  resetActivities: async (): Promise<boolean> => {
    const res = await api.post('/activities/reset.php', {});
    return res && res.success !== false;
  },
};

// ==========================================
// 4. CALENDAR SERVICE (MySQL API)
// ==========================================
export const calendarService = {
  fetchEvents: async (): Promise<CalendarEvent[]> => {
    const res = await api.get('/calendar/list.php');
    if (!res || !Array.isArray(res.data)) {
      return [];
    }

    return res.data.map((item: any): CalendarEvent => {
      let timeFormatted = '09:00';
      if (item.event_time) {
        timeFormatted = item.event_time.slice(0, 5);
      }

      return {
        id: String(item.id),
        title: item.title || 'Agenda',
        date: item.event_date || '2026-10-15',
        time: timeFormatted,
        cat: item.event_type || 'cat-meeting',
        description: item.description || undefined,
        created_by: item.created_by || '',
        created_at: item.created_at || '',
      };
    });
  },

  createEvent: async (eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    const payload = {
      title: eventData.title,
      event_date: eventData.date,
      event_time: eventData.time.length === 5 ? `${eventData.time}:00` : eventData.time,
      category: eventData.cat,
      event_type: eventData.cat,
      description: eventData.description || null,
    };
    const res = await api.post('/calendar/create.php', payload);
    const createdId = res?.data?.id ? String(res.data.id) : `ev_${Date.now()}`;
    return {
      id: createdId,
      ...eventData,
    };
  },

  deleteEvent: async (id: string | number): Promise<boolean> => {
    const numericId = Number(id);
    const res = await api.post('/calendar/delete.php', {
      id: isNaN(numericId) ? id : numericId,
    });
    return res && res.success !== false;
  },

  resetEvents: async (): Promise<boolean> => {
    const res = await api.post('/calendar/reset.php', {});
    return res && res.success !== false;
  },
};

// ==========================================
// 5. DAILY REPORTS SERVICE (MySQL API)
// ==========================================

export const normalizeCanonicalStatus = (status?: string | null): TaskStatus => {
  if (!status) return 'todo';
  const clean = String(status).toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'completed' || clean === 'complete' || clean === 'done' || clean === 'selesai') {
    return 'done';
  }
  if (
    clean === 'inprogress' ||
    clean === 'progress' ||
    clean === 'sedangberjalan' ||
    clean === 'sedangdikerjakan' ||
    clean === 'berjalan' ||
    clean === 'ongoing' ||
    clean === 'proses' ||
    clean === 'working'
  ) {
    return 'inprogress';
  }
  if (
    clean === 'review' ||
    clean === 'inreview' ||
    clean === 'dalamreview'
  ) {
    return 'review';
  }
  return 'todo';
};

export const mapBackendStatusToFrontend = (
  status?: string
): Report['status'] => {
  const col = normalizeCanonicalStatus(status);
  if (col === 'done') return 'Completed';
  if (col === 'inprogress') return 'In Progress';
  if (col === 'review') return 'In Review';
  return 'To Do';
};

export const mapFrontendStatusToBackend = (
  status?: Report['status'] | string
): string => {
  const col = normalizeCanonicalStatus(status);
  if (col === 'done') return 'completed';
  if (col === 'inprogress') return 'in_progress';
  if (col === 'review') return 'in_review';
  return 'todo';
};

export const reportProofCoverCache = new Map<string, string>();

export const mapRawDailyReportToReport = (item: any): Report => {
  const reportIdStr = String(item.id || '').trim();
  const cachedCover = reportProofCoverCache.get(reportIdStr);

  let evidenceList: string[] = [];
  if (item.proof_cover_url) {
    evidenceList.push(normalizeFileUrl(item.proof_cover_url));
  }
  if (cachedCover && !evidenceList.includes(cachedCover)) {
    evidenceList.push(cachedCover);
  }
  if (Array.isArray(item.proof_files) && item.proof_files.length > 0) {
    const proofImgs = item.proof_files
      .filter((f: any) => {
        const mime = (f.mime_type || '').toLowerCase();
        const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
        return mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name);
      })
      .map((f: any) => normalizeFileUrl(f.file_url || f.url))
      .filter(Boolean);
    if (proofImgs.length > 0) {
      evidenceList = [...proofImgs, ...evidenceList.filter((u) => !proofImgs.includes(u))];
    }
  }
  // Check if item has files from backend response
  if (Array.isArray(item.files) && item.files.length > 0) {
    const proofFiles = item.files.filter((f: any) => f.file_category === 'proof' || !f.file_category);
    const proofImgs = proofFiles
      .filter((f: any) => {
        const mime = (f.mime_type || '').toLowerCase();
        const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
        return mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name);
      })
      .map((f: any) => normalizeFileUrl(f.file_url || f.url))
      .filter(Boolean);
    if (proofImgs.length > 0) {
      evidenceList = [...proofImgs, ...evidenceList.filter((u) => !proofImgs.includes(u))];
    }
  }
  if (Array.isArray(item.evidence_urls) && item.evidence_urls.length > 0) {
    item.evidence_urls.forEach((u: string) => {
      const norm = normalizeFileUrl(u);
      if (norm && !evidenceList.includes(norm)) evidenceList.push(norm);
    });
  } else if (typeof item.evidence_urls === 'string' && item.evidence_urls.startsWith('[')) {
    try {
      const parsed = JSON.parse(item.evidence_urls);
      if (Array.isArray(parsed)) {
        parsed.forEach((u: string) => {
          const norm = normalizeFileUrl(u);
          if (norm && !evidenceList.includes(norm)) evidenceList.push(norm);
        });
      }
    } catch (_) {}
  }
  if (evidenceList.length === 0 && item.file_url) {
    evidenceList = [normalizeFileUrl(item.file_url)];
  }

  // Cover is strictly the FIRST image proof file if available (Rule 8: jika ada beberapa file proof, gunakan file proof pertama sebagai cover)
  const cover = evidenceList.length > 0 ? evidenceList[0] : undefined;
  if (cover && reportIdStr) {
    reportProofCoverCache.set(reportIdStr, cover);
  }
  let dateDisplay = item.report_date || '14 Okt 2026';
  if (item.report_date && item.report_date.includes('-')) {
    try {
      const parts = item.report_date.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10) - 1;
        dateDisplay = `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
      }
    } catch (_) {}
  }

  return {
    id: String(item.id),
    person: item.user_name || item.user_email?.split('@')[0] || 'Tim LaporanWee',
    date: dateDisplay,
    report_date: item.report_date || '',
    project: item.project_name || 'LaporanWee',
    project_name: item.project_name || 'LaporanWee',
    task: item.title || item.task || 'Laporan Kerja Harian',
    category: item.work_category || item.category || 'Desain & UI/UX',
    work_category: item.work_category || item.category || 'Desain & UI/UX',
    desc: item.description || item.desc || '',
    progress: Number(item.progress) || 0,
    time: item.duration || item.time_spent || '4 jam 00 mnt',
    duration: item.duration || item.time_spent || '4 jam 00 mnt',
    status: mapBackendStatusToFrontend(item.status),
    challenges: item.obstacles || item.challenges || 'Tidak ada kendala berarti.',
    obstacles: item.obstacles || item.challenges || 'Tidak ada kendala berarti.',
    next: item.next_plan || item.next || 'Melanjutkan deliverable berikutnya.',
    next_plan: item.next_plan || item.next || 'Melanjutkan deliverable berikutnya.',
    evidence_urls: evidenceList,
    evidence_url: cover || undefined,
    updated_at: item.updated_at || item.created_at || item.report_date || '',
    created_at: item.created_at || item.report_date || '',
    user_email: item.user_email || item.created_by || '',
    user_name: item.user_name || item.person || '',
    created_by: item.created_by || item.user_email || '',
  };
};

const REPORTS_CACHE_KEY = 'laporanwee_daily_reports_cache';

export const saveReportToCache = (report: Report) => {
  try {
    const raw = localStorage.getItem(REPORTS_CACHE_KEY);
    const existing: Report[] = raw ? JSON.parse(raw) : [];
    const targetId = String(report.id).trim();
    const filtered = existing.filter((r) => String(r.id).trim() !== targetId);
    const updated = [report, ...filtered];
    localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(updated));
  } catch (_) {}
};

export const getCachedReports = (): Report[] => {
  try {
    const raw = localStorage.getItem(REPORTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

export const getCachedReportById = (id: string | number): Report | null => {
  const targetIdStr = String(id).trim();
  const targetIdNum = Number(targetIdStr);
  const list = getCachedReports();
  const found = list.find((r) => {
    const rIdStr = String(r.id).trim();
    const rIdNum = Number(rIdStr);
    return rIdStr === targetIdStr || (!isNaN(targetIdNum) && !isNaN(rIdNum) && rIdNum === targetIdNum);
  });
  return found || null;
};

export const removeReportFromCache = (id: string | number) => {
  try {
    const targetIdStr = String(id).trim();
    const targetIdNum = Number(targetIdStr);
    const existing = getCachedReports();
    const filtered = existing.filter((r) => {
      const rIdStr = String(r.id).trim();
      const rIdNum = Number(rIdStr);
      return rIdStr !== targetIdStr && (isNaN(targetIdNum) || isNaN(rIdNum) || rIdNum !== targetIdNum);
    });
    localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(filtered));
  } catch (_) {}
};

export const clearReportCache = () => {
  try {
    localStorage.removeItem(REPORTS_CACHE_KEY);
  } catch (_) {}
};

export const PRIMARY_REPORT_ENDPOINT = '/reports/list.php';
export const FALLBACK_REPORT_ENDPOINT = '/reports/all.php';

export const extractReportsArrayFromResponse = (res: any): any[] | null => {
  if (!res) return null;
  if (res.success === false && !res.data && !res.reports && !res.items && !res.daily_reports) return null;

  let list: any[] | null = null;
  if (Array.isArray(res.data)) {
    list = res.data;
  } else if (Array.isArray(res.reports)) {
    list = res.reports;
  } else if (Array.isArray(res.daily_reports)) {
    list = res.daily_reports;
  } else if (Array.isArray(res.items)) {
    list = res.items;
  } else if (Array.isArray(res.list)) {
    list = res.list;
  } else if (Array.isArray(res.rows)) {
    list = res.rows;
  } else if (Array.isArray(res.results)) {
    list = res.results;
  } else if (res.data && typeof res.data === 'object') {
    if (Array.isArray(res.data.reports)) {
      list = res.data.reports;
    } else if (Array.isArray(res.data.daily_reports)) {
      list = res.data.daily_reports;
    } else if (Array.isArray(res.data.data)) {
      list = res.data.data;
    } else if (Array.isArray(res.data.items)) {
      list = res.data.items;
    } else if (Array.isArray(res.data.list)) {
      list = res.data.list;
    } else if (Array.isArray(res.data.rows)) {
      list = res.data.rows;
    } else if (Array.isArray(res.data.results)) {
      list = res.data.results;
    }
  } else if (Array.isArray(res)) {
    list = res;
  }

  if (list && Array.isArray(list)) {
    return list;
  }

  return null;
};

export const dailyReportService = {
  saveReportToCache,
  getCachedReports,
  getCachedReportById,
  removeReportFromCache,
  clearReportCache,

  fetchDailyReports: async (
    userEmail?: string,
    isAdmin?: boolean,
    options?: { signal?: AbortSignal }
  ): Promise<Report[]> => {
    let apiReports: Report[] = [];
    let fetchError: any = null;

    // 1. Primary request: /api/reports/list.php
    try {
      const res = await api.get(PRIMARY_REPORT_ENDPOINT, options);
      console.log('REPORT API RESPONSE:', res);
      const extracted = extractReportsArrayFromResponse(res);
      if (extracted !== null && extracted.length > 0) {
        console.log('REPORT DATA:', extracted);
        apiReports = extracted.map(mapRawDailyReportToReport);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      fetchError = err;
      console.warn('[LaporanWe] /reports/list.php notice:', err);
    }

    // 2. Fallback if primary returned 0 items or threw an error: /api/reports/all.php
    if (apiReports.length === 0) {
      try {
        const fallbackRes = await api.get(FALLBACK_REPORT_ENDPOINT, options);
        console.log('FALLBACK REPORT API RESPONSE:', fallbackRes);
        const extracted = extractReportsArrayFromResponse(fallbackRes);
        if (extracted !== null && extracted.length > 0) {
          console.log('REPORT DATA (from fallback):', extracted);
          apiReports = extracted.map(mapRawDailyReportToReport);
          fetchError = null; // Fallback succeeded
        }
      } catch (fallbackErr: any) {
        if (fallbackErr?.name === 'AbortError') throw fallbackErr;
        console.warn('[LaporanWe] /reports/all.php notice:', fallbackErr);
        if (!fetchError) fetchError = fallbackErr;
      }
    }

    // 3. Fallback with query parameters (e.g. all=1) if still empty
    if (apiReports.length === 0) {
      try {
        const paramRes = await api.get(`${PRIMARY_REPORT_ENDPOINT}?all=1`, options);
        const extracted = extractReportsArrayFromResponse(paramRes);
        if (extracted !== null && extracted.length > 0) {
          apiReports = extracted.map(mapRawDailyReportToReport);
          fetchError = null;
        }
      } catch (_) {}
    }

    // If an error occurred and no reports could be fetched from server,
    // throw the error so the UI can distinguish 401, 403, 500, network error (Rule 9)
    if (fetchError && apiReports.length === 0) {
      throw fetchError;
    }

    // Enrich each report with its authentic first proof image from daily_report_files table (MySQL API)
    if (apiReports.length > 0) {
      await Promise.allSettled(
        apiReports.map(async (r) => {
          try {
            const files = await dailyReportService.fetchReportFiles(r.id, 'proof');
            if (files && files.length > 0) {
              const imageFiles = files.filter((f) => {
                const mime = (f.mime_type || '').toLowerCase();
                const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
                return (
                  mime.startsWith('image/') ||
                  f.file_type === 'image' ||
                  /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name)
                );
              });
              if (imageFiles.length > 0) {
                // Rule 8: Jika ada beberapa file proof, gunakan file proof pertama sebagai cover.
                const firstProofImage = imageFiles[0];
                const coverUrl = normalizeFileUrl(firstProofImage.file_url);
                r.evidence_url = coverUrl;
                r.evidence_urls = imageFiles.map((f) => normalizeFileUrl(f.file_url));
                r.proof_files = files;
                reportProofCoverCache.set(String(r.id), coverUrl);
              }
            }
          } catch (fileErr) {
            console.warn(`Fetch proof files for report ${r.id} notice:`, fileErr);
          }
        })
      );
    }

    // Update local cache for offline/instant-transition optimisations
    if (apiReports.length > 0) {
      clearReportCache();
      apiReports.forEach((r) => saveReportToCache(r));
    } else {
      clearReportCache();
    }

    console.log('[LaporanWe] Reports loaded from MySQL:', apiReports.length);
    // MySQL is the SINGLE SOURCE OF TRUTH (Rule 6, Rule 18)
    return apiReports;
  },

  fetchDailyReportDetail: async (id: string | number): Promise<Report | null> => {
    const targetIdStr = String(id).trim();
    const targetIdNum = Number(targetIdStr);
    if (!targetIdStr) return null;

    // 1. Instant return from local cache
    const cached = getCachedReportById(targetIdStr);

    // 2. Fetch directly from /reports/list.php?id=... (with /reports/all.php fallback)
    const detailEndpoints = [
      `${PRIMARY_REPORT_ENDPOINT}?id=${encodeURIComponent(targetIdStr)}`,
      `${FALLBACK_REPORT_ENDPOINT}?id=${encodeURIComponent(targetIdStr)}`,
    ];

    let resolvedReport: Report | null = null;
    for (const endpoint of detailEndpoints) {
      try {
        const res = await api.get(endpoint);
        if (res && res.data) {
          const items = Array.isArray(res.data) ? res.data : [res.data];
          const matched = items.find((item: any) => {
            const itemIdStr = String(item.id).trim();
            const itemIdNum = Number(itemIdStr);
            const isIdMatch =
              itemIdStr === targetIdStr ||
              (!isNaN(targetIdNum) && !isNaN(itemIdNum) && itemIdNum === targetIdNum);
            const isReport =
              item.title !== undefined ||
              item.task !== undefined ||
              item.project_name !== undefined ||
              item.work_category !== undefined;
            return isIdMatch && isReport;
          });
          if (matched) {
            resolvedReport = mapRawDailyReportToReport(matched);
            break;
          }
        }
      } catch (_) {}
    }

    const finalReport = resolvedReport || cached;
    if (finalReport) {
      // Load proof files and attachment files directly from daily_report_files table (MySQL API)
      try {
        const [proofFiles, attachmentFiles] = await Promise.all([
          dailyReportService.fetchReportFiles(targetIdStr, 'proof'),
          dailyReportService.fetchReportFiles(targetIdStr, 'attachment'),
        ]);

        if (proofFiles && proofFiles.length > 0) {
          const proofUrls = proofFiles.map((f) => normalizeFileUrl(f.file_url)).filter(Boolean);
          finalReport.evidence_urls = proofUrls;
          finalReport.evidence_url = proofUrls[0];
          finalReport.proof_files = proofFiles;
        }
        if (attachmentFiles && attachmentFiles.length > 0) {
          finalReport.attachment_files = attachmentFiles;
        }
      } catch (fileErr) {
        console.warn('Fetch files for report detail notice:', fileErr);
      }

      saveReportToCache(finalReport);
      return finalReport;
    }

    return null;
  },

  createDailyReport: async (
    reportData: Omit<Report, 'id'>,
    userEmail?: string,
    userName?: string
  ): Promise<Report> => {
    // Format YYYY-MM-DD for report_date
    let dateStr = new Date().toISOString().slice(0, 10);
    if (reportData.date && reportData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateStr = reportData.date;
    }

    const payload = {
      title: reportData.task,
      description: reportData.desc || '',
      user_email: userEmail || '',
      user_name: reportData.person || userName || 'Tim LaporanWee',
      created_by: userEmail || '',
      project_name: reportData.project || 'Proyek Wee Studio',
      work_category: reportData.category || 'Desain & UI/UX',
      report_date: dateStr,
      duration: reportData.time || '4 jam 00 mnt',
      obstacles: reportData.challenges || '',
      next_plan: reportData.next || '',
      progress: typeof reportData.progress === 'number' ? reportData.progress : 85,
      status: mapFrontendStatusToBackend(reportData.status),
      cover_url:
        reportData.evidence_urls && reportData.evidence_urls.length > 0
          ? reportData.evidence_urls[0]
          : reportData.evidence_url || '',
    };

    const res = await api.post('/daily-reports/create.php', payload);
    console.log("CREATE REPORT RESPONSE:", res);

    if (!res || res.success === false) {
      throw new Error(res?.message || 'Gagal membuat laporan di server backend.');
    }

    // Extract real ID from MySQL response
    const rawId = res.data?.id ?? res.id ?? res.data?.report_id ?? res.report_id;
    if (rawId === undefined || rawId === null || rawId === '') {
      console.error("CREATE REPORT ERROR: Missing ID in backend response", res);
      throw new Error('Server berhasil membuat laporan namun tidak mengembalikan ID laporan baru.');
    }

    const createdReportId = String(rawId).trim();
    console.log("CREATED REPORT ID:", createdReportId);

    let dateDisplay = dateStr;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10) - 1;
        dateDisplay = `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
      }
    } catch (_) {}

    const mappedBackendData =
      res.data && typeof res.data === 'object' ? mapRawDailyReportToReport(res.data) : null;

    const finalReport: Report = {
      person: reportData.person || userName || 'Tim LaporanWee',
      date: dateDisplay,
      report_date: dateStr,
      project: reportData.project || 'Proyek Wee Studio',
      project_name: reportData.project || 'Proyek Wee Studio',
      task: reportData.task,
      category: reportData.category || 'Desain & UI/UX',
      work_category: reportData.category || 'Desain & UI/UX',
      desc: reportData.desc || '',
      progress: typeof reportData.progress === 'number' ? reportData.progress : 85,
      time: reportData.time || '4 jam 00 mnt',
      duration: reportData.time || '4 jam 00 mnt',
      status: reportData.status || 'In Review',
      challenges: reportData.challenges || '',
      obstacles: reportData.challenges || '',
      next: reportData.next || '',
      next_plan: reportData.next || '',
      evidence_urls: reportData.evidence_urls || [],
      evidence_url: reportData.evidence_url || (reportData.evidence_urls ? reportData.evidence_urls[0] : undefined),
      user_email: userEmail || '',
      user_name: reportData.person || userName || 'Tim LaporanWee',
      created_by: userEmail || '',
      ...(mappedBackendData || {}),
      id: createdReportId, // Ensure ID is definitively the created MySQL ID
    };

    // Immediately cache the newly created report for instant retrieval
    saveReportToCache(finalReport);

    return finalReport;
  },

  updateDailyReport: async (payload: {
    id: number | string;
    title: string;
    description: string;
    work_category: string;
    project_name: string;
    progress: number;
    status: string;
    report_date: string;
    duration?: string;
    obstacles?: string;
    next_plan?: string;
    task_id?: string | number;
  }): Promise<{ success: boolean; message?: string; data?: any }> => {
    const numericId = Number(payload.id);
    const body: Record<string, any> = {
      id: isNaN(numericId) ? payload.id : numericId,
      title: payload.title,
      description: payload.description,
      work_category: payload.work_category,
      project_name: payload.project_name,
      progress: Number(payload.progress),
      status: payload.status,
      report_date: payload.report_date,
      duration: payload.duration || '4 jam 00 mnt',
      obstacles: payload.obstacles || '',
      next_plan: payload.next_plan || '',
    };
    if (payload.task_id !== undefined && payload.task_id !== null) {
      body.task_id = payload.task_id;
    }
    const res = await api.post('/daily-reports/update.php', body);
    return res;
  },

  fetchReportFiles: async (
    reportId: string | number,
    category: 'proof' | 'attachment'
  ): Promise<DailyReportFile[]> => {
    try {
      const res = await api.get(`/daily-reports/list.php?report_id=${reportId}&category=${category}`);
      if (res && res.success && Array.isArray(res.data)) {
        const mappedFiles = res.data.map((item: any): DailyReportFile => {
          const rawUrl = item.file_url || item.url || '';
          const normUrl = normalizeFileUrl(rawUrl);
          const mime = (item.mime_type || '').toLowerCase();
          const origName = item.original_name || item.file_name || item.name || '';
          const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(origName || normUrl);
          const isVid = mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(origName || normUrl);
          const fType = isImg ? 'image' : isVid ? 'video' : 'doc';

          return {
            id: item.id,
            report_id: item.report_id || reportId,
            file_name: item.file_name || item.name || 'File',
            original_name: origName || 'File',
            file_url: normUrl,
            file_category: item.file_category || category,
            file_type: item.file_type || fType,
            mime_type: item.mime_type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
            file_size: Number(item.file_size) || 0,
            file_size_formatted:
              item.file_size_formatted ||
              (item.file_size ? `${Math.round(Number(item.file_size) / 1024)} KB` : undefined),
            uploaded_by: item.uploaded_by,
            created_at: item.created_at,
            updated_at: item.updated_at,
          };
        });

        if (category === 'proof') {
          const firstImg = mappedFiles.find((f: DailyReportFile) => {
            const mime = (f.mime_type || '').toLowerCase();
            const name = (f.original_name || f.file_name || f.file_url || '').toLowerCase();
            return (
              mime.startsWith('image/') ||
              f.file_type === 'image' ||
              /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name)
            );
          });
          if (firstImg) {
            reportProofCoverCache.set(String(reportId), firstImg.file_url);
          }
        }

        return mappedFiles;
      }
      return [];
    } catch (err) {
      console.warn(`Fetch ${category} files for report ${reportId} notice:`, err);
      return [];
    }
  },

  uploadReportFile: async (
    reportId: string | number,
    file: File,
    fileCategory: 'proof' | 'attachment'
  ): Promise<DailyReportFile> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('report_id', String(reportId));
    formData.append('file_category', fileCategory);

    const res = await api.upload('/daily-reports/upload.php', formData);
    if (res && res.success && res.data) {
      const item = res.data;
      const normUrl = normalizeFileUrl(item.file_url || item.url || '');
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const fType = isImg ? 'image' : isVid ? 'video' : 'doc';

      return {
        id: item.id,
        report_id: item.report_id || reportId,
        file_name: item.file_name || file.name,
        original_name: item.original_name || file.name,
        file_url: normUrl,
        file_category: item.file_category || fileCategory,
        file_type: item.file_type || fType,
        mime_type: item.mime_type || file.type,
        file_size: file.size,
        file_size_formatted: `${Math.round(file.size / 1024)} KB`,
      };
    }
    throw new Error(res?.message || 'Gagal mengunggah berkas laporan.');
  },

  deleteReportFile: async (fileId: string | number): Promise<boolean> => {
    const numId = Number(fileId);
    const idVal = isNaN(numId) ? fileId : numId;
    const res = await api.post('/daily-reports/delete.php', {
      file_id: idVal,
      id: idVal,
    });
    return Boolean(res && res.success !== false);
  },

  replaceReportFile: async (fileId: string | number, file: File): Promise<DailyReportFile> => {
    const formData = new FormData();
    formData.append('file_id', String(fileId));
    formData.append('id', String(fileId));
    formData.append('file', file);

    const res = await api.upload('/daily-reports/replace.php', formData);
    if (res && res.success && res.data) {
      const item = res.data;
      const normUrl = normalizeFileUrl(item.file_url || item.url || '');
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const fType = isImg ? 'image' : isVid ? 'video' : 'doc';

      return {
        id: item.id || fileId,
        report_id: item.report_id,
        file_name: item.file_name || file.name,
        original_name: item.original_name || file.name,
        file_url: normUrl,
        file_category: item.file_category || 'proof',
        file_type: item.file_type || fType,
        mime_type: item.mime_type || file.type,
        file_size: file.size,
        file_size_formatted: `${Math.round(file.size / 1024)} KB`,
      };
    }
    throw new Error(res?.message || 'Gagal mengganti berkas laporan.');
  },

  deleteDailyReport: async (id: string | number): Promise<boolean> => {
    const numericId = Number(id);
    const reportIdVal = isNaN(numericId) ? String(id).trim() : numericId;
    const res = await api.post('/reports/delete.php', {
      report_id: reportIdVal,
      id: reportIdVal,
    });
    if (res && res.success !== false) {
      removeReportFromCache(id);
    }
    return Boolean(res && res.success !== false);
  },

  resetDailyReports: async (): Promise<boolean> => {
    const res = await api.post('/daily-reports/reset.php', {});
    if (res && res.success !== false) {
      clearReportCache();
    }
    return res && res.success !== false;
  },
};

// Export individual helper functions for clean usage
export const fetchDailyReports = dailyReportService.fetchDailyReports;
export const fetchDailyReportDetail = dailyReportService.fetchDailyReportDetail;
export const createDailyReport = dailyReportService.createDailyReport;
export const updateDailyReport = dailyReportService.updateDailyReport;
export const deleteDailyReport = dailyReportService.deleteDailyReport;
export const resetDailyReports = dailyReportService.resetDailyReports;
export const fetchReportFiles = dailyReportService.fetchReportFiles;
export const uploadReportFile = dailyReportService.uploadReportFile;
export const deleteReportFile = dailyReportService.deleteReportFile;
export const replaceReportFile = dailyReportService.replaceReportFile;

// ==========================================
// 6. TEAM & PRESENCE SERVICE
// ==========================================

export const getAbsoluteAvatarUrl = (img?: string | null, _userName?: string): string => {
  if (!img || typeof img !== 'string' || img.trim() === '' || img === 'null' || img === 'undefined' || img.includes('placeholder')) {
    return '';
  }
  let finalUrl = img.trim();
  if (finalUrl.startsWith('data:') || finalUrl.startsWith('blob:')) {
    return finalUrl;
  }
  if (finalUrl.startsWith('http://api-laporanwe.mkverse.my.id')) {
    finalUrl = finalUrl.replace('http://', 'https://');
  }
  if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
    return finalUrl;
  }
  if (finalUrl.startsWith('/')) {
    return `https://api-laporanwe.mkverse.my.id${finalUrl}`;
  }
  return `https://api-laporanwe.mkverse.my.id/${finalUrl}`;
};

export const teamService = {
  fetchTeamMembers: async (): Promise<{
    members: TeamMember[];
    total_users: number;
    online_count: number;
  }> => {
    try {
      // 1. Fetch team members list
      const teamRes = await api.get('/team/list.php');

      // 2. Fetch online presence from /presence/online.php
      let onlineData: { online_count: number; users: any[] } = { online_count: 0, users: [] };
      try {
        const presenceRes = await api.get('/presence/online.php');
        console.log('[Presence API] Response from /presence/online.php:', presenceRes);
        if (presenceRes) {
          onlineData.online_count = typeof presenceRes.online_count === 'number'
            ? presenceRes.online_count
            : (presenceRes.data?.online_count || 0);

          onlineData.users = Array.isArray(presenceRes.users)
            ? presenceRes.users
            : (Array.isArray(presenceRes.data?.users)
              ? presenceRes.data.users
              : (Array.isArray(presenceRes.data) ? presenceRes.data : []));
        }
      } catch (presErr) {
        console.error('[API ERROR] Failed to fetch /presence/online.php:', presErr);
      }

      if (!teamRes || !Array.isArray(teamRes.data)) {
        return { members: [], total_users: 0, online_count: onlineData.online_count };
      }

      // Build Set of online user IDs or emails from presence response
      const onlineUserIdentifiers = new Set<string>();
      onlineData.users.forEach((u: any) => {
        if (u.id) onlineUserIdentifiers.add(String(u.id));
        if (u.user_id) onlineUserIdentifiers.add(String(u.user_id));
        if (u.email) onlineUserIdentifiers.add(String(u.email).toLowerCase().trim());
      });

      const members: TeamMember[] = teamRes.data
        .filter((item: any) => item.status === 'active' || item.status === undefined)
        .map((item: any): TeamMember => {
          const itemId = String(item.id || '');
          const itemEmail = String(item.email || '').toLowerCase().trim();
          
          const isOnlineFromPresence = onlineUserIdentifiers.has(itemId) || onlineUserIdentifiers.has(itemEmail);
          const isOnlineFallback = Boolean(
            item.is_online === true ||
              item.is_online === 1 ||
              item.is_online === '1' ||
              item.is_online === 'true'
          );
          const isOnline = isOnlineFromPresence || isOnlineFallback;

          const roleLabel =
            item.role === 'admin'
              ? 'Administrator'
              : item.role === 'lead'
              ? 'Project Lead'
              : item.role === 'designer'
              ? 'UI/UX Designer'
              : item.role === 'developer'
              ? 'Frontend Dev'
              : 'Anggota Tim';

          const memberName = item.full_name || item.name || item.email?.split('@')[0] || 'Anggota Tim';
          const rawImg = item.avatar_url || item.profile_photo || item.img || '';
          const resolvedImg = getAbsoluteAvatarUrl(rawImg, memberName);

          return {
            id: String(item.id),
            name: memberName,
            full_name: item.full_name,
            email: item.email || '',
            role: roleLabel,
            img: resolvedImg,
            avatar_url: rawImg || null,
            profile_title: item.profile_title || '',
            profile_location: item.profile_location || '',
            status: isOnline ? 'working' : 'offline',
            is_online: isOnline,
            last_seen: item.last_seen || null,
          };
        });

      const activeOnlineCount = onlineData.online_count > 0 
        ? onlineData.online_count 
        : members.filter((m) => m.is_online).length;

      return {
        members,
        total_users: typeof teamRes.total_users === 'number' ? teamRes.total_users : members.length,
        online_count: activeOnlineCount,
      };
    } catch (err) {
      console.error('[API ERROR] fetchTeamMembers error:', err);
      return { members: [], total_users: 0, online_count: 0 };
    }
  },

  updatePresence: async (isOnline: boolean, userEmail?: string): Promise<boolean> => {
    try {
      const payload = {
        is_online: isOnline ? 1 : 0,
      };
      const res = await api.post('/team/presence.php', payload);
      return Boolean(res && res.success !== false);
    } catch (err) {
      console.warn('Update presence notice:', err);
      return false;
    }
  },

  sendHeartbeat: async (userId?: string | number, userEmail?: string): Promise<boolean> => {
    try {
      let uid = userId;
      let email = userEmail;
      if (!uid || !email) {
        try {
          const stored = localStorage.getItem('laporanwee_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (!uid) uid = parsed.id || parsed.user_id;
            if (!email) email = parsed.email;
          }
        } catch (_) {}
      }
      const payload: Record<string, any> = {};
      if (uid) {
        payload.user_id = uid;
        payload.id = uid;
      }
      if (email) {
        payload.email = email;
      }
      const res = await api.post('/presence/heartbeat.php', payload);
      return Boolean(res && res.success !== false);
    } catch (err) {
      console.warn('[API ERROR] Heartbeat failed:', err);
      return false;
    }
  },

  resetPresence: async (): Promise<boolean> => {
    try {
      const res = await api.post('/team/reset.php', {});
      return Boolean(res && res.success !== false);
    } catch (err) {
      console.warn('Reset presence notice:', err);
      return false;
    }
  },
};

export const fetchTeamMembers = teamService.fetchTeamMembers;
export const updatePresence = teamService.updatePresence;
export const resetPresence = teamService.resetPresence;

// ==========================================
// 7. ANALYTICS SERVICE
// ==========================================

export const analyticsService = {
  fetchSummary: async (): Promise<AnalyticsSummary> => {
    try {
      const res = await api.get('/analytics/summary.php');
      const data = res?.data || {};

      return {
        total_hours: Number(data.total_hours) || 0,
        reports: {
          total: Number(data.reports?.total) || 0,
          completed: Number(data.reports?.completed) || 0,
        },
        tasks: {
          total: Number(data.tasks?.total) || 0,
          completed: Number(data.tasks?.completed) || 0,
        },
        activities: {
          total: Number(data.activities?.total) || 0,
        },
        deadline_accuracy: Number(data.deadline_accuracy) || 0,
        daily_activity: Array.isArray(data.daily_activity)
          ? data.daily_activity.map((d: any) => ({
              day: d.day || '',
              tasks_completed: Number(d.tasks_completed) || 0,
              reports: Number(d.reports) || 0,
            }))
          : [],
        division_distribution: Array.isArray(data.division_distribution)
          ? data.division_distribution.map((div: any) => ({
              division: div.division || '',
              percentage: Number(div.percentage) || 0,
              count: Number(div.count) || 0,
              color: div.color || undefined,
            }))
          : [],
      };
    } catch (err) {
      console.warn('Sync analytics from API notice:', err);
      return {
        total_hours: 0,
        reports: { total: 0, completed: 0 },
        tasks: { total: 0, completed: 0 },
        activities: { total: 0 },
        deadline_accuracy: 0,
        daily_activity: [
          { day: 'Senin', tasks_completed: 0, reports: 0 },
          { day: 'Selasa', tasks_completed: 0, reports: 0 },
          { day: 'Rabu', tasks_completed: 0, reports: 0 },
          { day: 'Kamis', tasks_completed: 0, reports: 0 },
          { day: 'Jumat', tasks_completed: 0, reports: 0 },
        ],
        division_distribution: [],
      };
    }
  },
};

export const fetchAnalytics = analyticsService.fetchSummary;

// ==========================================
// 8. TASK / KANBAN SERVICE (MySQL API)
// ==========================================

export const reportStatusToTaskCol = (status?: string): TaskStatus => {
  return normalizeCanonicalStatus(status);
};

export const taskColToReportStatus = (col?: TaskStatus): 'Completed' | 'In Review' | 'In Progress' | 'To Do' => {
  const c = normalizeCanonicalStatus(col);
  if (c === 'done') return 'Completed';
  if (c === 'inprogress') return 'In Progress';
  if (c === 'review') return 'In Review';
  return 'To Do';
};

export const taskColToBackendReportStatus = (col?: TaskStatus): string => {
  const c = normalizeCanonicalStatus(col);
  if (c === 'done') return 'completed';
  if (c === 'inprogress') return 'in_progress';
  if (c === 'review') return 'in_review';
  return 'todo';
};

// Compute progress cleanly according to status rules:
// - Selesai: 100%
// - Sedang Dikerjakan: 1-99%
// - Dalam Review: retain existing progress
// - To Do: retain manual progress or keep 0
export const computeTargetProgress = (currentProgress: number, targetCol: TaskStatus): number => {
  if (targetCol === 'done') {
    return 100;
  }
  if (targetCol === 'inprogress') {
    if (currentProgress <= 0) return 25;
    if (currentProgress >= 100) return 85;
    return currentProgress;
  }
  if (targetCol === 'review') {
    if (currentProgress <= 0) return 80;
    if (currentProgress >= 100) return 90;
    return currentProgress;
  }
  if (currentProgress >= 100) return 0;
  return currentProgress;
};

export const mapBackendTaskStatusToFrontend = (status?: string): TaskStatus => {
  return normalizeCanonicalStatus(status);
};

export const mapFrontendTaskStatusToBackend = (col?: TaskStatus): string => {
  const c = normalizeCanonicalStatus(col);
  if (c === 'done') return 'completed';
  if (c === 'inprogress') return 'in_progress';
  if (c === 'review') return 'in_review';
  return 'todo';
};

export const mapBackendTaskPriorityToFrontend = (priority?: string): PriorityLevel => {
  if (!priority) return 'Medium';
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'tinggi') return 'High';
  if (p === 'low' || p === 'rendah') return 'Low';
  return 'Medium';
};

export const taskService = {
  fetchTasks: async (): Promise<Task[]> => {
    try {
      const res = await api.get('/tasks/list.php');
      if (!res || !Array.isArray(res.data)) {
        return [];
      }

      return res.data.map((item: any): Task => {
        let extractedReportId =
          item.daily_report_id !== undefined && item.daily_report_id !== null && String(item.daily_report_id).trim() !== ''
            ? String(item.daily_report_id).trim()
            : (item.report_id !== undefined && item.report_id !== null && String(item.report_id).trim() !== ''
              ? String(item.report_id).trim()
              : undefined);

        let cleanDescription = item.description || '';
        const tagMatch = cleanDescription.match(/(?:\[(?:daily_)?report_id:(\d+)\]|<!--(?:daily_)?report_id:(\d+)-->)/i);
        if (tagMatch) {
          if (!extractedReportId) {
            extractedReportId = tagMatch[1] || tagMatch[2];
          }
          cleanDescription = cleanDescription
            .replace(/(?:\s*\[(?:daily_)?report_id:\d+\]|\s*<!--(?:daily_)?report_id:\d+-->)/gi, '')
            .trim();
        }

        const projectVal = item.project_name || item.project || item.category || 'Creative Sprint';

        return {
          id: String(item.id),
          report_id: extractedReportId,
          daily_report_id: extractedReportId,
          proj: projectVal,
          title: item.title || 'Tugas Baru',
          description: cleanDescription,
          category: item.category || item.work_category || 'Desain & UI/UX',
          priority: mapBackendTaskPriorityToFrontend(item.priority),
          assignee: item.assignee_name || item.assignee || item.assignee_email || '',
          assignee_email: item.assignee_email || item.user_email || '',
          due: (item.deadline && item.deadline !== '0000-00-00') ? item.deadline : (item.due || 'Besok'),
          progress: Number(item.progress) || 0,
          col: mapBackendTaskStatusToFrontend(item.status),
          documents: Array.isArray(item.documents) ? item.documents : [],
          cover_url: item.cover_url || '',
        };
      });
    } catch (err) {
      console.warn('Sync tasks from API notice:', err);
      return [];
    }
  },

  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    const repId = taskData.report_id || (taskData as any).daily_report_id;
    let cleanDesc = (taskData.description || '').trim();
    let backendDesc = cleanDesc;
    if (repId && !backendDesc.includes(`[daily_report_id:${repId}]`)) {
      backendDesc = `${backendDesc} [daily_report_id:${repId}]`.trim();
    }

    const payload: Record<string, any> = {
      title: taskData.title || '',
      description: backendDesc,
      status: mapFrontendTaskStatusToBackend(taskData.col),
      priority: (taskData.priority || 'Medium').toLowerCase(),
      progress: typeof taskData.progress === 'number' ? taskData.progress : 0,
      category: taskData.category || 'Desain & UI/UX',
      project_name: taskData.proj || 'Creative Sprint',
      assignee_name: taskData.assignee || '',
      assignee_email: taskData.assignee_email || '',
      deadline: taskData.due || 'Hari ini',
    };

    if (repId) {
      payload.report_id = String(repId);
      payload.daily_report_id = String(repId);
    }

    const res = await api.post('/tasks/create.php', payload);
    const createdId = res?.data?.id ? String(res.data.id) : (res?.id ? String(res.id) : `t_${Date.now()}`);

    return {
      id: createdId,
      report_id: repId ? String(repId) : undefined,
      daily_report_id: repId ? String(repId) : undefined,
      proj: taskData.proj || 'Creative Sprint',
      title: taskData.title || '',
      description: cleanDesc,
      category: taskData.category || 'Desain & UI/UX',
      priority: taskData.priority || 'Medium',
      assignee: taskData.assignee || '',
      assignee_email: taskData.assignee_email || '',
      due: taskData.due || 'Hari ini',
      progress: typeof taskData.progress === 'number' ? taskData.progress : 0,
      col: taskData.col || 'todo',
      documents: taskData.documents || [],
      cover_url: taskData.cover_url || '',
    };
  },

  updateTask: async (taskData: Partial<Task> & { id: string | number }): Promise<boolean> => {
    const payload: Record<string, any> = {
      id: Number(taskData.id) || taskData.id,
    };
    const repId = taskData.report_id || (taskData as any).daily_report_id;
    if (taskData.title !== undefined) payload.title = taskData.title;
    if (taskData.description !== undefined) {
      let desc = taskData.description.trim();
      if (repId && !desc.includes(`[daily_report_id:${repId}]`)) {
        desc = `${desc} [daily_report_id:${repId}]`.trim();
      }
      payload.description = desc;
    }
    if (taskData.col !== undefined) payload.status = mapFrontendTaskStatusToBackend(taskData.col);
    if (taskData.priority !== undefined) payload.priority = taskData.priority.toLowerCase();
    if (taskData.progress !== undefined) payload.progress = taskData.progress;
    if (taskData.proj !== undefined) {
      payload.project_name = taskData.proj;
      payload.category = taskData.category || taskData.proj;
    }
    if (taskData.category !== undefined) payload.category = taskData.category;
    if (taskData.assignee !== undefined) payload.assignee_name = taskData.assignee;
    if (taskData.assignee_email !== undefined) payload.assignee_email = taskData.assignee_email;
    if (taskData.due !== undefined) payload.deadline = taskData.due;
    if (repId !== undefined) {
      payload.report_id = repId;
      payload.daily_report_id = repId;
    }

    const res = await api.post('/tasks/update.php', payload);
    return Boolean(res && res.success !== false);
  },

  updateTaskStatus: async (params: {
    taskId: string | number;
    col: TaskStatus;
    progress?: number;
    reportId?: string | number;
  }): Promise<{ success: boolean; data?: any; message?: string }> => {
    const backendStatus = mapFrontendTaskStatusToBackend(params.col);
    const payload: Record<string, any> = {
      task_id: params.taskId,
      status: backendStatus,
    };
    if (params.progress !== undefined) {
      payload.progress = params.progress;
    }
    if (params.reportId !== undefined) {
      payload.daily_report_id = params.reportId;
      payload.report_id = params.reportId;
    }

    // 1. Try dedicated endpoint /tasks/update-status.php
    try {
      const res = await api.post('/tasks/update-status.php', payload);
      if (res && res.success) {
        return { success: true, data: res.data, message: res.message };
      }
    } catch (err: any) {
      console.warn('/tasks/update-status.php not reachable or failed, using multi-endpoint sync fallback:', err?.message);
    }

    // 2. Fallback: update both /tasks/update.php and /daily-reports/update.php
    let taskOk = true;
    let reportOk = true;

    const isSynthetic = String(params.taskId).startsWith('report-');
    if (!isSynthetic) {
      const taskRes = await api.post('/tasks/update.php', {
        id: params.taskId,
        status: backendStatus,
        ...(params.progress !== undefined ? { progress: params.progress } : {}),
        ...(params.reportId !== undefined ? { report_id: params.reportId } : {}),
      }).catch((e) => {
        console.warn('Update task error in fallback:', e);
        return null;
      });
      taskOk = Boolean(taskRes && taskRes.success !== false);
    }

    const realReportId = params.reportId || (isSynthetic ? String(params.taskId).replace('report-', '') : undefined);
    if (realReportId) {
      const reportStatusBackend = taskColToBackendReportStatus(params.col);
      const reportRes = await api.post('/daily-reports/update.php', {
        id: realReportId,
        status: reportStatusBackend,
        ...(params.progress !== undefined ? { progress: params.progress } : {}),
      }).catch((e) => {
        console.warn('Update daily report error in fallback:', e);
        return null;
      });
      reportOk = Boolean(reportRes && reportRes.success !== false);
    }

    const overallSuccess = isSynthetic ? reportOk : (taskOk && reportOk);
    return {
      success: overallSuccess,
      data: {
        task_id: params.taskId,
        status: backendStatus,
        progress: params.progress,
        daily_report_id: realReportId,
      },
    };
  },

  deleteTask: async (id: string | number): Promise<boolean> => {
    const numericId = Number(id);
    const res = await api.post('/tasks/delete.php', {
      id: isNaN(numericId) ? id : numericId,
    });
    return Boolean(res && res.success !== false);
  },

  resetTasks: async (): Promise<boolean> => {
    const res = await api.post('/tasks/reset.php', {});
    return Boolean(res && res.success !== false);
  },
};

export const fetchTasks = taskService.fetchTasks;
export const createTask = taskService.createTask;
export const updateTask = taskService.updateTask;
export const updateTaskStatus = taskService.updateTaskStatus;
export const deleteTask = taskService.deleteTask;
export const resetTasks = taskService.resetTasks;

export const realtimeService = {
  poll: async (since?: string | number, signal?: AbortSignal) => {
    try {
      const query = since !== undefined && since !== null && String(since).trim() !== ''
        ? `?since=${encodeURIComponent(String(since).trim())}`
        : '';
      const endpoint = `/realtime/poll.php${query}`;
      const url = buildApiUrl(endpoint);
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
        signal,
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      return null;
    }
  },
};

// ==========================================
// PROFILE SERVICE (/api/profile/)
// ==========================================
export const profileService = {
  getProfile: async () => {
    return api.get('/profile/get.php');
  },
  updateName: async (fullName: string) => {
    return api.post('/profile/update.php', { full_name: fullName });
  },
  uploadPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.upload('/profile/upload.php', formData);
  },
  cropPhoto: async (params: {
    avatar?: string | File;
    avatar_url?: string;
    source_file?: string;
    zoom: number;
    x: number;
    y: number;
  }) => {
    if (params.avatar instanceof File) {
      const formData = new FormData();
      formData.append('avatar', params.avatar);
      formData.append('zoom', String(params.zoom));
      formData.append('x', String(params.x));
      formData.append('y', String(params.y));
      return api.upload('/profile/crop.php', formData);
    }
    const avatarVal = typeof params.avatar === 'string' ? params.avatar : (params.avatar_url || params.source_file || '');
    return api.post('/profile/crop.php', {
      avatar: avatarVal,
      avatar_url: avatarVal,
      zoom: params.zoom,
      x: params.x,
      y: params.y,
    });
  },
  saveProfile: async (params: {
    full_name?: string;
    profile_title?: string;
    profile_location?: string;
    crop_file?: string | File;
    crop_url?: string;
    zoom?: number;
    x?: number;
    y?: number;
  }) => {
    if (params.crop_file instanceof File) {
      const formData = new FormData();
      if (params.full_name !== undefined) formData.append('full_name', params.full_name);
      if (params.profile_title !== undefined) formData.append('profile_title', params.profile_title);
      if (params.profile_location !== undefined) formData.append('profile_location', params.profile_location);
      formData.append('crop_file', params.crop_file);
      if (params.crop_url !== undefined) formData.append('crop_url', params.crop_url);
      if (params.zoom !== undefined) formData.append('zoom', String(params.zoom));
      if (params.x !== undefined) formData.append('x', String(params.x));
      if (params.y !== undefined) formData.append('y', String(params.y));
      return api.upload('/profile/save.php', formData);
    }
    return api.post('/profile/save.php', params);
  },
  replacePhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.upload('/profile/replace.php', formData);
  },
  deletePhoto: async () => {
    return api.post('/profile/delete.php', {});
  },
  getSettings: async () => {
    return api.get('/profile/settings.php');
  },
  saveSettings: async (settings: { crop_zoom: number; crop_x: number; crop_y: number }) => {
    return api.post('/profile/settings.php', settings);
  },
};



