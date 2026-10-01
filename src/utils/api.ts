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

export const api = {
  get: async (endpoint: string) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'GET', url });
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response, url, 'GET');
  },

  post: async (endpoint: string, body: any) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'POST', url });
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response, url, 'POST');
  },

  put: async (endpoint: string, body: any) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'PUT', url });
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response, url, 'PUT');
  },

  delete: async (endpoint: string) => {
    const url = buildApiUrl(endpoint);
    console.log('[API REQUEST]', { method: 'DELETE', url });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
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
export const mapBackendStatusToFrontend = (
  status?: string
): Report['status'] => {
  const s = (status || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'completed' || s === 'selesai') return 'Completed';
  if (s === 'in_progress' || s === 'sedang_berjalan' || s === 'ongoing') return 'In Progress';
  if (s === 'todo' || s === 'to_do') return 'To Do';
  return 'In Review';
};

export const mapFrontendStatusToBackend = (
  status?: Report['status'] | string
): string => {
  if (status === 'Completed') return 'completed';
  if (status === 'In Progress') return 'in_progress';
  if (status === 'To Do') return 'todo';
  return 'in_review';
};

export const dailyReportService = {
  fetchDailyReports: async (): Promise<Report[]> => {
    const res = await api.get('/daily-reports/list.php');
    if (!res || !Array.isArray(res.data)) {
      return [];
    }

    return res.data.map((item: any): Report => {
      const cover = item.cover_url || null;
      const evidenceList = cover ? [cover] : [];
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
        project: item.project_name || 'LaporanWee',
        task: item.title || 'Laporan Kerja Harian',
        category: item.category || 'Desain & UI/UX',
        desc: item.description || '',
        progress: Number(item.progress) || 0,
        time: item.time_spent || '4 jam 00 mnt',
        status: mapBackendStatusToFrontend(item.status),
        challenges: item.challenges || 'Tidak ada kendala berarti.',
        next: item.next_plan || item.next || 'Melanjutkan deliverable berikutnya.',
        evidence_urls: evidenceList,
        evidence_url: cover || undefined,
      };
    });
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
      project_name: reportData.project || 'Proyek Wee Studio',
      report_date: dateStr,
      progress: typeof reportData.progress === 'number' ? reportData.progress : 85,
      status: mapFrontendStatusToBackend(reportData.status),
      cover_url:
        reportData.evidence_urls && reportData.evidence_urls.length > 0
          ? reportData.evidence_urls[0]
          : reportData.evidence_url || '',
    };

    const res = await api.post('/daily-reports/create.php', payload);
    const createdId = res?.data?.id ? String(res.data.id) : `r_${Date.now()}`;
    return {
      id: createdId,
      ...reportData,
    };
  },

  deleteDailyReport: async (id: string | number): Promise<boolean> => {
    const numericId = Number(id);
    const res = await api.post('/daily-reports/delete.php', {
      id: isNaN(numericId) ? id : numericId,
    });
    return res && res.success !== false;
  },

  resetDailyReports: async (): Promise<boolean> => {
    const res = await api.post('/daily-reports/reset.php', {});
    return res && res.success !== false;
  },
};

// Export individual helper functions for clean usage
export const fetchDailyReports = dailyReportService.fetchDailyReports;
export const createDailyReport = dailyReportService.createDailyReport;
export const deleteDailyReport = dailyReportService.deleteDailyReport;
export const resetDailyReports = dailyReportService.resetDailyReports;

// ==========================================
// 6. TEAM & PRESENCE SERVICE
// ==========================================

export const getAbsoluteAvatarUrl = (img?: string | null, userName?: string): string => {
  if (!img || typeof img !== 'string' || img.trim() === '' || img === 'null' || img === 'undefined' || img.includes('placeholder')) {
    console.log(`[PROFILE PHOTO] ${userName || 'User'} -> (No valid avatar)`);
    return '';
  }
  let finalUrl = img.trim();
  if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
    if (finalUrl.includes('https://api-laporanwe.mkverse.my.id/https://')) {
      finalUrl = finalUrl.substring(finalUrl.indexOf('https://', 8));
    }
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `https://api-laporanwe.mkverse.my.id${finalUrl}`;
  } else {
    finalUrl = `https://api-laporanwe.mkverse.my.id/${finalUrl}`;
  }
  finalUrl = finalUrl.replace(/([^:]\/)\/+/g, '$1');
  console.log(`[PROFILE PHOTO] ${userName || 'User'} -> ${finalUrl}`);
  return finalUrl;
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

export const mapBackendTaskStatusToFrontend = (status?: string): TaskStatus => {
  if (!status) return 'todo';
  const s = status.toLowerCase();
  if (s === 'in_progress' || s === 'inprogress' || s === 'sedang dikerjakan') return 'inprogress';
  if (s === 'review' || s === 'in_review' || s === 'dalam review') return 'review';
  if (s === 'completed' || s === 'done' || s === 'selesai') return 'done';
  return 'todo';
};

export const mapFrontendTaskStatusToBackend = (col?: TaskStatus): string => {
  if (col === 'inprogress') return 'in_progress';
  if (col === 'review') return 'review';
  if (col === 'done') return 'completed';
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
        return {
          id: String(item.id),
          proj: item.category || item.project_name || item.project || 'Creative Sprint',
          title: item.title || 'Tugas Baru',
          priority: mapBackendTaskPriorityToFrontend(item.priority),
          assignee: item.assignee_name || item.assignee || item.assignee_email || '',
          due: (item.deadline && item.deadline !== '0000-00-00') ? item.deadline : (item.due || 'Besok'),
          progress: Number(item.progress) || 0,
          col: mapBackendTaskStatusToFrontend(item.status),
          documents: Array.isArray(item.documents) ? item.documents : [],
        };
      });
    } catch (err) {
      console.warn('Sync tasks from API notice:', err);
      return [];
    }
  },

  createTask: async (taskData: Partial<Task>): Promise<Task> => {
    const payload = {
      title: taskData.title || '',
      description: '',
      status: mapFrontendTaskStatusToBackend(taskData.col),
      priority: (taskData.priority || 'Medium').toLowerCase(),
      progress: typeof taskData.progress === 'number' ? taskData.progress : 0,
      category: taskData.proj || 'Creative Sprint',
      assignee_name: taskData.assignee || '',
      deadline: taskData.due || 'Hari ini',
    };

    const res = await api.post('/tasks/create.php', payload);
    const createdId = res?.data?.id ? String(res.data.id) : `t_${Date.now()}`;
    return {
      id: createdId,
      proj: taskData.proj || 'Creative Sprint',
      title: taskData.title || '',
      priority: taskData.priority || 'Medium',
      assignee: taskData.assignee || '',
      due: taskData.due || 'Hari ini',
      progress: taskData.progress || 0,
      col: taskData.col || 'todo',
      documents: taskData.documents || [],
    };
  },

  updateTask: async (taskData: Partial<Task> & { id: string | number }): Promise<boolean> => {
    const payload: Record<string, any> = {
      id: Number(taskData.id) || taskData.id,
    };
    if (taskData.title !== undefined) payload.title = taskData.title;
    if (taskData.col !== undefined) payload.status = mapFrontendTaskStatusToBackend(taskData.col);
    if (taskData.priority !== undefined) payload.priority = taskData.priority.toLowerCase();
    if (taskData.progress !== undefined) payload.progress = taskData.progress;
    if (taskData.proj !== undefined) payload.category = taskData.proj;
    if (taskData.assignee !== undefined) payload.assignee_name = taskData.assignee;
    if (taskData.due !== undefined) payload.deadline = taskData.due;

    const res = await api.post('/tasks/update.php', payload);
    return Boolean(res && res.success !== false);
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
export const deleteTask = taskService.deleteTask;
export const resetTasks = taskService.resetTasks;

export const realtimeService = {
  poll: async (since?: string | number, signal?: AbortSignal) => {
    try {
      const endpoint = since !== undefined && since !== null ? `/realtime/poll.php?since=${since}` : '/realtime/poll.php';
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


