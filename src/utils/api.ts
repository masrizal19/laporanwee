import { Project, ProjectDocument, Activity, CalendarEvent } from '../types';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '') ||
  'https://api-laporanwe.mkverse.my.id';

// Helper to get authorization headers with stored token and active user email
export const getHeaders = () => {
  const token = localStorage.getItem('laporanwee_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Include X-Admin-Email if user is logged in
  try {
    const storedUser = localStorage.getItem('laporanwee_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.email) {
        headers['X-Admin-Email'] = parsed.email.trim();
      }
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

export const handleResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw {
      message: `Server mengembalikan response tidak valid (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  if (!response.ok || data.success === false) {
    throw {
      message: data.message || data.error || `Terjadi kesalahan sistem (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  return data;
};

export const api = {
  get: async (endpoint: string) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http')
      ? endpoint
      : formattedEndpoint.startsWith('/api')
      ? `${API_BASE_URL}${formattedEndpoint}`
      : `${API_BASE_URL}/api${formattedEndpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  post: async (endpoint: string, body: any) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http')
      ? endpoint
      : formattedEndpoint.startsWith('/api')
      ? `${API_BASE_URL}${formattedEndpoint}`
      : `${API_BASE_URL}/api${formattedEndpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  put: async (endpoint: string, body: any) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http')
      ? endpoint
      : formattedEndpoint.startsWith('/api')
      ? `${API_BASE_URL}${formattedEndpoint}`
      : `${API_BASE_URL}/api${formattedEndpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  delete: async (endpoint: string) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http')
      ? endpoint
      : formattedEndpoint.startsWith('/api')
      ? `${API_BASE_URL}${formattedEndpoint}`
      : `${API_BASE_URL}/api${formattedEndpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  upload: async (endpoint: string, formData: FormData) => {
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http')
      ? endpoint
      : formattedEndpoint.startsWith('/api')
      ? `${API_BASE_URL}${formattedEndpoint}`
      : `${API_BASE_URL}/api${formattedEndpoint}`;

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
    return handleResponse(response);
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
        : ['Rangga Arya'];

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

