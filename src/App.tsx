import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewType,
  Project,
  Task,
  Report,
  Activity,
  CalendarEvent,
  TeamMember,
  AnalyticsSummary,
  ToastMessage,
  UISettings,
} from './types';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';
import { Icon } from './components/icons';

// Views
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { ReportsView } from './views/ReportsView';
import { ReportDetailView } from './views/ReportDetailView';
import { CreateReportView } from './views/CreateReportView';
import { TasksView } from './views/TasksView';
import { TeamView } from './views/TeamView';
import { CalendarView } from './views/CalendarView';
import { ProfileView } from './views/ProfileView';
import { AnalyticsView } from './views/AnalyticsView';
import { AdminUISettingsView } from './views/AdminUISettingsView';

// Auth views
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';
import { VerifyEmailView } from './views/VerifyEmailView';
import {
  api,
  activityService,
  calendarService,
  dailyReportService,
  teamService,
  analyticsService,
  taskService,
  realtimeService,
} from './utils/api';
import { projectService } from './utils/projectService';
import {
  fetchUISettings,
  applyUISettingsToDocument,
  DEFAULT_UI_SETTINGS,
} from './utils/uiSettings';

export function App() {
  // 1. Session & Routing state
  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem('laporanwee_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Verify active session on load from localStorage to keep state active during refresh
  useEffect(() => {
    const saved = localStorage.getItem('laporanwee_user');
    const token = localStorage.getItem('laporanwee_token');
    if (saved && token) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem('laporanwee_user');
        localStorage.removeItem('laporanwee_token');
        setUser(null);
        navigateToPath('/login');
      }
    }
  }, []);

  // Fetch user profile from MySQL database on load to sync avatar_url, role, id and name
  useEffect(() => {
    if (user) {
      api.get('/profile.php')
        .then((res) => {
          if (res && res.success && res.data) {
            setUser((prev) => prev ? {
              ...prev,
              id: res.data.id || (prev as any).id,
              name: res.data.full_name || prev.name,
              role: res.data.role || (prev as any).role,
              avatar_url: res.data.avatar_url || (prev as any).avatar_url,
            } : null);
          }
        })
        .catch(() => {});
    }
  }, [user?.email]);

  const getPathFromLocation = (): string => {
    const hashPart = window.location.hash.replace('#', '').split('?')[0];
    const validPaths = [
      '/login',
      '/register',
      '/verify-email',
      '/dashboard',
      '/proyek',
      '/laporan',
      '/tugas',
      '/tim',
      '/kalender',
      '/analitik',
      '/admin/ui-settings',
      '/ui-settings'
    ];
    if (validPaths.includes(hashPart)) {
      return hashPart;
    }
    const path = window.location.pathname.split('?')[0];
    const cleanPath = path.replace(/\/+$/, '') || '/';
    for (const validPath of validPaths) {
      if (cleanPath === validPath || cleanPath.endsWith(validPath)) {
        return validPath;
      }
    }
    if (path === '/' || path.endsWith('/')) {
      return '/dashboard';
    }
    return '/dashboard';
  };

  const [currentPath, setCurrentPath] = useState<string>(getPathFromLocation);

  const [uiSettings, setUiSettings] = useState<UISettings | null>(null);

  // Apply UI Settings from server on initial load
  useEffect(() => {
    fetchUISettings(user?.email)
      .then((data) => {
        if (data) {
          setUiSettings(data);
          applyUISettingsToDocument(data);
        }
      })
      .catch(() => {
        applyUISettingsToDocument(DEFAULT_UI_SETTINGS);
      });
  }, [user]);

  const navigateToPath = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.split('?')[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getPathFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync protected routes
  useEffect(() => {
    if (!user) {
      if (currentPath !== '/register' && currentPath !== '/verify-email') {
        navigateToPath('/login');
      }
    } else {
      if (currentPath === '/login' || currentPath === '/register') {
        navigateToPath('/dashboard');
      }
    }
  }, [user, currentPath]);

  // Route & View Maps for clean SPA routing on custom domain
  const pathToViewMap: Record<string, ViewType> = {
    '/dashboard': 'dashboard',
    '/proyek': 'projects',
    '/laporan': 'reports',
    '/tugas': 'tasks',
    '/tim': 'team',
    '/kalender': 'calendar',
    '/analitik': 'analytics',
    '/admin/ui-settings': 'ui-settings',
    '/ui-settings': 'ui-settings',
  };

  const viewToPathMap: Record<ViewType, string> = {
    'dashboard': '/dashboard',
    'projects': '/proyek',
    'project-detail': '/proyek',
    'tasks': '/tugas',
    'team': '/tim',
    'calendar': '/kalender',
    'reports': '/laporan',
    'report-detail': '/laporan',
    'create-report': '/laporan',
    'profile': '/dashboard',
    'analytics': '/analitik',
    'ui-settings': '/admin/ui-settings',
  };

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const initialPath = getPathFromLocation();
    if (initialPath === '/login' || initialPath === '/register') return 'dashboard';
    return pathToViewMap[initialPath] || 'dashboard';
  });

  // Sync currentView with currentPath when browser path changes (like on forward/back navigation)
  useEffect(() => {
    if (user) {
      const targetView = pathToViewMap[currentPath];
      if (targetView && targetView !== currentView) {
        setCurrentView(targetView);
      }
    }
  }, [currentPath, user]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | undefined>(undefined);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Determine if current logged in user has Administrator privileges
  const isAdmin = Boolean(
    user?.email?.toLowerCase().includes('admin') ||
    user?.email === 'rizalstudios.backup01@gmail.com' ||
    user?.email === 'rizalsaragih498@gmail.com' ||
    (user as any)?.role === 'admin' ||
    (user as any)?.is_admin === true
  );

  // Synchronize Tasks with Backend PHP/MySQL API — Single Source of Truth
  const refreshTasksFromApi = useCallback(async () => {
    try {
      const fetchedTasks = await taskService.fetchTasks();
      setTasks(fetchedTasks || []);
    } catch (err) {
      console.warn('Sync tasks from API notice:', err);
      setTasks([]);
    }
  }, []);

  // Synchronize Projects with Backend PHP/MySQL API — Single Source of Truth
  const refreshProjectsFromApi = useCallback(async () => {
    try {
      const fetchedProjects = await projectService.fetchProjects();
      setProjects(fetchedProjects || []);
      if (fetchedProjects && fetchedProjects.length > 0) {
        setSelectedProjectId((prev) =>
          fetchedProjects.some((p) => p.id === prev) ? prev : fetchedProjects[0].id
        );
      } else {
        setSelectedProjectId('');
      }
    } catch (err) {
      console.warn('Sync projects from API notice:', err);
      setProjects([]);
    }
  }, []);

  // Synchronize Activities with Backend PHP/MySQL API
  const refreshActivitiesFromApi = useCallback(async () => {
    try {
      const fetchedActivities = await activityService.fetchActivities();
      setActivities(fetchedActivities || []);
    } catch (err) {
      console.warn('Sync activities from API notice:', err);
      setActivities([]);
    }
  }, []);

  // Synchronize Calendar Events with Backend PHP/MySQL API
  const refreshEventsFromApi = useCallback(async () => {
    try {
      const fetchedEvents = await calendarService.fetchEvents();
      setEvents(fetchedEvents || []);
    } catch (err) {
      console.warn('Sync calendar events from API notice:', err);
      setEvents([]);
    }
  }, []);

  // Synchronize Daily Reports with Backend PHP/MySQL API
  const refreshReportsFromApi = useCallback(async () => {
    try {
      const fetchedReports = await dailyReportService.fetchDailyReports();
      setReports(fetchedReports || []);
      if (fetchedReports && fetchedReports.length > 0) {
        setSelectedReportId((prev) =>
          fetchedReports.some((r) => r.id === prev) ? prev : fetchedReports[0].id
        );
      } else {
        setSelectedReportId('');
      }
    } catch (err) {
      console.warn('Sync reports from API notice:', err);
      setReports([]);
    }
  }, []);

  // Synchronize Team Members from Backend PHP/MySQL API
  const refreshTeamFromApi = useCallback(async () => {
    try {
      const res = await teamService.fetchTeamMembers();
      setMembers(res.members || []);
    } catch (err) {
      console.warn('Sync team members from API notice:', err);
      setMembers([]);
    }
  }, []);

  // Synchronize Analytics from Backend PHP/MySQL API
  const refreshAnalyticsFromApi = useCallback(async () => {
    try {
      const res = await analyticsService.fetchSummary();
      setAnalytics(res);
    } catch (err) {
      console.warn('Sync analytics from API notice:', err);
    }
  }, []);

  // Reset Presence handler
  const handleResetPresence = useCallback(async () => {
    try {
      await teamService.resetPresence();
      await refreshTeamFromApi();
      addToast('Seluruh status kehadiran berhasil direset ke offline.');
    } catch (err: any) {
      console.error('Reset presence error:', err);
      addToast(err?.message || 'Gagal mereset kehadiran tim.');
    }
  }, [refreshTeamFromApi]);

  // Load all server-side global data when user is authenticated
  useEffect(() => {
    if (user) {
      refreshTasksFromApi();
      refreshProjectsFromApi();
      refreshActivitiesFromApi();
      refreshEventsFromApi();
      refreshReportsFromApi();
      refreshTeamFromApi();
      refreshAnalyticsFromApi();

      // Mark current user as online in database
      if (user.email) {
        teamService.updatePresence(true, user.email).then(() => {
          refreshTeamFromApi();
        });
      }

      // Send initial heartbeat and setup periodic heartbeat (every 30s) + periodic presence sync (every 20s)
      teamService.sendHeartbeat((user as any).id, user.email);
      const heartbeatInterval = setInterval(() => {
        teamService.sendHeartbeat((user as any).id, user.email);
      }, 30000);

      const presenceInterval = setInterval(() => {
        refreshTeamFromApi();
      }, 20000);

      // Handle window beforeunload to mark offline
      const handleBeforeUnload = () => {
        if (user?.email) {
          teamService.updatePresence(false, user.email);
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(heartbeatInterval);
        clearInterval(presenceInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      setProjects([]);
      setTasks([]);
      setActivities([]);
      setEvents([]);
      setReports([]);
      setMembers([]);
      setAnalytics(undefined);
    }
  }, [
    user,
    refreshTasksFromApi,
    refreshProjectsFromApi,
    refreshActivitiesFromApi,
    refreshEventsFromApi,
    refreshReportsFromApi,
    refreshTeamFromApi,
    refreshAnalyticsFromApi,
  ]);

  // Re-fetch tasks whenever user navigates to tasks view
  useEffect(() => {
    if (user && currentView === 'tasks') {
      refreshTasksFromApi();
    }
  }, [user, currentView, refreshTasksFromApi]);

  // Realtime Polling via /realtime/poll.php
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let sinceCursor: string | number | undefined = undefined;
    const abortController = new AbortController();

    const runRealtimePoll = async () => {
      if (!isMounted) return;
      try {
        const res = await realtimeService.poll(sinceCursor, abortController.signal);
        if (res && isMounted) {
          if (res.latest !== undefined) {
            sinceCursor = res.latest;
          }
          if (res.changed === true) {
            console.log('[Realtime] Database changes detected from poll.php, syncing data...');
            refreshTasksFromApi();
            refreshProjectsFromApi();
            refreshActivitiesFromApi();
            refreshEventsFromApi();
            refreshReportsFromApi();
            refreshTeamFromApi();
            refreshAnalyticsFromApi();
          }
        }
      } catch (_) {}
    };

    // Initial poll to set cursor
    realtimeService.poll(undefined, abortController.signal)
      .then((res) => {
        if (res && res.latest !== undefined) {
          sinceCursor = res.latest;
        }
      })
      .catch(() => {});

    const pollInterval = setInterval(() => {
      runRealtimePoll();
    }, 2500);

    return () => {
      isMounted = false;
      abortController.abort();
      clearInterval(pollInterval);
    };
  }, [
    user,
    refreshTasksFromApi,
    refreshProjectsFromApi,
    refreshActivitiesFromApi,
    refreshEventsFromApi,
    refreshReportsFromApi,
    refreshTeamFromApi,
    refreshAnalyticsFromApi,
  ]);

  const addToast = (text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleNavigate = (view: ViewType) => {
    const targetPath = viewToPathMap[view] || '/dashboard';
    navigateToPath(targetPath);
    setCurrentView(view);
  };

  // Projects CRUD strictly connected to backend MySQL API
  const handleAddProject = async (projectData: Omit<Project, 'id'>) => {
    try {
      const created = await projectService.createProject(projectData);
      // Re-fetch directly from MySQL API to ensure single source of truth
      await refreshProjectsFromApi();
      setSelectedProjectId(created.id);
      addToast(`Proyek "${created.name}" berhasil dibuat!`);

      // Log activity to backend MySQL API
      await activityService.createActivity({
        title: 'membuat proyek baru',
        description: `"${created.name}"`,
        activity_type: 'project',
        icon_type: 'folder',
        user_name: user?.name || 'Admin',
        user_email: user?.email || '',
      });
      await refreshActivitiesFromApi();
    } catch (e: any) {
      console.error('API create project error:', e);
      addToast(e?.message || `Gagal membuat proyek "${projectData.name}".`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const ok = await projectService.deleteProject(projectId);
      if (ok) {
        // Re-fetch directly from MySQL API
        await refreshProjectsFromApi();
        addToast('Project berhasil dihapus.');

        // Log activity to backend MySQL API
        await activityService.createActivity({
          title: 'menghapus proyek',
          description: `ID: ${projectId}`,
          activity_type: 'project',
          icon_type: 'trash',
          user_name: user?.name || 'Admin',
          user_email: user?.email || '',
        });
        await refreshActivitiesFromApi();
      } else {
        addToast('Project gagal dihapus. Silakan coba lagi.');
      }
    } catch (e: any) {
      console.error('API delete project error:', e);
      addToast('Project gagal dihapus. Silakan coba lagi.');
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    try {
      await projectService.updateProject(updatedProject);
      await refreshProjectsFromApi();
      addToast('Proyek berhasil diperbarui.');

      // Log activity to backend MySQL API
      await activityService.createActivity({
        title: 'memperbarui proyek',
        description: `"${updatedProject.name}"`,
        activity_type: 'project',
        icon_type: 'folder',
        user_name: user?.name || 'Admin',
        user_email: user?.email || '',
      });
      await refreshActivitiesFromApi();
    } catch (e: any) {
      console.error('API update project error:', e);
      addToast('Gagal memperbarui proyek.');
    }
  };

  // Tasks CRUD strictly connected to backend MySQL API
  const handleAddTask = async (taskData: Omit<Task, 'id'>) => {
    try {
      await taskService.createTask(taskData);
      // Re-fetch directly from MySQL API to ensure single source of truth
      await refreshTasksFromApi();
      addToast(`Tugas "${taskData.title}" berhasil ditambahkan!`);

      // Log activity to backend MySQL API
      await activityService.createActivity({
        title: 'menambahkan tugas baru',
        description: `"${taskData.title}" (${taskData.proj})`,
        activity_type: 'task',
        icon_type: 'checksq',
        user_name: user?.name || 'Admin',
        user_email: user?.email || '',
      });
      await refreshActivitiesFromApi();
      await refreshAnalyticsFromApi();
    } catch (e: any) {
      console.error('API create task error:', e);
      addToast(e?.message || `Gagal membuat tugas "${taskData.title}".`);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      // Optimistic UI update
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      const ok = await taskService.updateTask(updatedTask);
      if (ok) {
        await refreshTasksFromApi();
        await refreshAnalyticsFromApi();
      } else {
        addToast('Gagal memperbarui status tugas di database.');
        await refreshTasksFromApi();
      }
    } catch (e: any) {
      console.error('API update task error:', e);
      addToast(e?.message || 'Gagal memperbarui tugas.');
      await refreshTasksFromApi();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const ok = await taskService.deleteTask(taskId);
      if (ok) {
        await refreshTasksFromApi();
        addToast('Tugas berhasil dihapus.');
        await refreshAnalyticsFromApi();
      } else {
        addToast('Gagal menghapus tugas dari database.');
      }
    } catch (e: any) {
      console.error('API delete task error:', e);
      addToast(e?.message || 'Gagal menghapus tugas.');
    }
  };

  const handleResetTasks = async () => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat mereset papan tugas.');
      return;
    }
    try {
      const ok = await taskService.resetTasks();
      if (ok) {
        await refreshTasksFromApi();
        addToast('Seluruh tugas di papan Kanban berhasil direset.');
        await refreshAnalyticsFromApi();
      } else {
        addToast('Gagal mereset tugas dari database.');
      }
    } catch (e: any) {
      console.error('API reset tasks error:', e);
      addToast(e?.message || 'Gagal mereset tugas.');
    }
  };

  // Reports CRUD strictly connected to backend MySQL API
  const handleAddReport = async (reportData: Omit<Report, 'id'>): Promise<string> => {
    try {
      const created = await dailyReportService.createDailyReport(
        reportData,
        user?.email,
        user?.name
      );
      // Re-fetch directly from MySQL API to ensure single source of truth
      await refreshReportsFromApi();
      setSelectedReportId(created.id);
      addToast(`Laporan kerja "${reportData.task}" berhasil dikirim!`);

      // Log activity to backend MySQL API
      await activityService.createActivity({
        title: 'mengirim laporan kerja',
        description: `"${reportData.task}" (${reportData.project})`,
        activity_type: 'report',
        icon_type: 'doc',
        user_name: reportData.person || user?.name || 'Tim LaporanWee',
        user_email: user?.email || '',
      });
      await refreshActivitiesFromApi();

      // Refresh projects from API as well in case project progress/cover was updated
      await refreshProjectsFromApi();

      return created.id;
    } catch (e: any) {
      console.error('API create daily report error:', e);
      addToast(e?.message || 'Gagal mengirim laporan kerja.');
      throw e;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat menghapus laporan.');
      return;
    }
    try {
      const ok = await dailyReportService.deleteDailyReport(reportId);
      if (ok) {
        await refreshReportsFromApi();
        addToast('Laporan berhasil dihapus.');

        // Log activity to backend MySQL API
        await activityService.createActivity({
          title: 'menghapus laporan kerja',
          description: `ID: ${reportId}`,
          activity_type: 'report',
          icon_type: 'trash',
          user_name: user?.name || 'Admin',
          user_email: user?.email || '',
        });
        await refreshActivitiesFromApi();
      } else {
        addToast('Gagal menghapus laporan dari database.');
      }
    } catch (e: any) {
      console.error('API delete daily report error:', e);
      addToast(e?.message || 'Gagal menghapus laporan.');
    }
  };

  const handleResetReports = async () => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat mereset seluruh laporan.');
      return;
    }
    try {
      const ok = await dailyReportService.resetDailyReports();
      if (ok) {
        await refreshReportsFromApi();
        addToast('Seluruh laporan kerja harian berhasil direset.');

        // Log activity to backend MySQL API
        await activityService.createActivity({
          title: 'mereset seluruh laporan kerja',
          description: 'Mengosongkan daftar daily reports',
          activity_type: 'report',
          icon_type: 'trash',
          user_name: user?.name || 'Admin',
          user_email: user?.email || '',
        });
        await refreshActivitiesFromApi();
      } else {
        addToast('Gagal mereset laporan kerja dari database.');
      }
    } catch (e: any) {
      console.error('API reset daily reports error:', e);
      addToast(e?.message || 'Gagal mereset laporan kerja.');
    }
  };

  const handleUpdateReportStatus = (
    reportId: string,
    newStatus: Report['status']
  ) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
    );
  };

  // Activities Admin CRUD strictly connected to backend MySQL API
  const handleDeleteActivity = async (activityId: string) => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat menghapus aktivitas.');
      return;
    }
    try {
      const ok = await activityService.deleteActivity(activityId);
      if (ok) {
        await refreshActivitiesFromApi();
        addToast('Aktivitas berhasil dihapus.');
      } else {
        addToast('Gagal menghapus aktivitas dari database.');
      }
    } catch (e: any) {
      console.error('API delete activity error:', e);
      addToast(e?.message || 'Gagal menghapus aktivitas.');
    }
  };

  const handleResetActivities = async () => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat mereset riwayat aktivitas.');
      return;
    }
    try {
      const ok = await activityService.resetActivities();
      if (ok) {
        await refreshActivitiesFromApi();
        addToast('Seluruh riwayat aktivitas berhasil dikosongkan.');
      } else {
        addToast('Gagal mereset riwayat aktivitas dari database.');
      }
    } catch (e: any) {
      console.error('API reset activities error:', e);
      addToast(e?.message || 'Gagal mereset riwayat aktivitas.');
    }
  };

  // Calendar Events Admin CRUD strictly connected to backend MySQL API
  const handleAddEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    try {
      await calendarService.createEvent(eventData);
      await refreshEventsFromApi();
      addToast(`Agenda "${eventData.title}" berhasil disimpan!`);

      // Log activity to backend MySQL API
      await activityService.createActivity({
        title: 'menambahkan agenda baru',
        description: `"${eventData.title}" (${eventData.date} ${eventData.time})`,
        activity_type: 'calendar',
        icon_type: 'calendar',
        user_name: user?.name || 'Admin',
        user_email: user?.email || '',
      });
      await refreshActivitiesFromApi();
    } catch (e: any) {
      console.error('API create event error:', e);
      addToast(e?.message || `Gagal menyimpan agenda "${eventData.title}".`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat menghapus agenda.');
      return;
    }
    try {
      const ok = await calendarService.deleteEvent(eventId);
      if (ok) {
        await refreshEventsFromApi();
        addToast('Agenda berhasil dihapus dari kalender.');
      } else {
        addToast('Gagal menghapus agenda dari database.');
      }
    } catch (e: any) {
      console.error('API delete event error:', e);
      addToast(e?.message || 'Gagal menghapus agenda.');
    }
  };

  const handleResetEvents = async () => {
    if (!isAdmin) {
      addToast('Akses ditolak: Hanya Administrator yang dapat mereset kalender.');
      return;
    }
    try {
      const ok = await calendarService.resetEvents();
      if (ok) {
        await refreshEventsFromApi();
        addToast('Seluruh jadwal kalender berhasil direset.');
      } else {
        addToast('Gagal mereset kalender dari database.');
      }
    } catch (e: any) {
      console.error('API reset events error:', e);
      addToast(e?.message || 'Gagal mereset kalender.');
    }
  };

  const handleLogout = () => {
    const token = localStorage.getItem('laporanwee_token');
    if (user?.email) {
      teamService.updatePresence(false, user.email).catch(() => {});
    }
    
    // Clear state & storage immediately for reactive UI response
    localStorage.removeItem('laporanwee_user');
    localStorage.removeItem('laporanwee_token');
    setUser(null);
    addToast('Berhasil keluar dari sesi.');
    navigateToPath('/login');

    // Notify backend
    if (token) {
      api.post('/logout.php', {}).catch(() => {});
    }
  };

  const currentProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];
  const currentReport =
    reports.find((r) => r.id === selectedReportId) || reports[0];

  // Conditional Rendering for Auth Flows
  if (currentPath === '/verify-email') {
    return (
      <>
        <VerifyEmailView
          onNavigateToLogin={() => {
            localStorage.removeItem('laporanwee_user');
            localStorage.removeItem('laporanwee_token');
            setUser(null);
            navigateToPath('/login');
          }}
          onAddToast={addToast}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (!user && currentPath === '/register') {
    return (
      <>
        <RegisterView
          onRegisterSuccess={() => {
            addToast('Akun berhasil dibuat! Silakan masuk.');
            navigateToPath('/login');
          }}
          onNavigateToLogin={() => navigateToPath('/login')}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (!user || currentPath === '/login') {
    return (
      <>
        <LoginView
          onLoginSuccess={(email, name, fullUser) => {
            const loggedInUser = fullUser || { email, name };
            localStorage.setItem('laporanwee_user', JSON.stringify(loggedInUser));
            setUser(loggedInUser);
            addToast(`Selamat datang kembali, ${name}!`);
            navigateToPath('/dashboard');
          }}
          onNavigateToRegister={() => navigateToPath('/register')}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  return (
    <div id="app-shell">
      {/* Top and Bottom Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onAddToast={addToast}
        onLogout={handleLogout}
        userEmail={user.email}
        userName={user.name}
        avatarUrl={(user as any)?.avatar_url}
        logoUrl={uiSettings?.logo_url}
        menuIconUrl={uiSettings?.menu_icon_url}
        signoutIconUrl={uiSettings?.signout_icon_url}
      />

      {/* Main Container */}
      <main>
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            reports={reports}
            members={members}
            analytics={analytics}
            tasksCount={tasks.length}
            userName={user.name}
            userEmail={user.email}
            onNavigate={handleNavigate}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onDeleteProject={handleDeleteProject}
            onAddToast={addToast}
          />
        )}

        {currentView === 'projects' && (
          <ProjectsView
            projects={projects}
            onNavigate={handleNavigate}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
            onAddToast={addToast}
          />
        )}

        {currentView === 'project-detail' && currentProject && (
          <ProjectDetailView
            project={currentProject}
            tasks={tasks}
            reports={reports}
            onNavigate={handleNavigate}
            onSelectReport={(id) => setSelectedReportId(id)}
            onAddToast={addToast}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView
            reports={reports}
            isAdmin={isAdmin}
            onNavigate={handleNavigate}
            onSelectReport={(id) => setSelectedReportId(id)}
            onDeleteReport={handleDeleteReport}
            onResetReports={handleResetReports}
            onAddToast={addToast}
          />
        )}

        {currentView === 'report-detail' && (
          currentReport ? (
            <ReportDetailView
              report={currentReport}
              projects={projects}
              onNavigate={handleNavigate}
              onUpdateStatus={handleUpdateReportStatus}
              onAddToast={addToast}
            />
          ) : (
            <div className="view">
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center', background: '#fff' }}>
                <Icon name="doc" style={{ width: 32, height: 32, margin: '0 auto 12px', color: 'var(--line-soft)' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '17px' }}>Laporan Tidak Ditemukan</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13.5px', margin: '0 0 16px' }}>
                  Laporan kerja belum dipilih atau telah dihapus dari database.
                </p>
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  onClick={() => handleNavigate('reports')}
                >
                  Kembali ke Daftar Laporan
                </button>
              </div>
            </div>
          )
        )}

        {currentView === 'create-report' && (
          <CreateReportView
            projects={projects}
            userName={user.name}
            userEmail={user.email}
            onNavigate={handleNavigate}
            onAddReport={handleAddReport}
            onSelectReport={(id) => setSelectedReportId(id)}
            onAddToast={addToast}
          />
        )}

        {currentView === 'tasks' && (
          <TasksView
            tasks={tasks}
            projects={projects}
            members={members}
            isAdmin={isAdmin}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onResetTasks={handleResetTasks}
            onRefreshTasks={refreshTasksFromApi}
            onAddToast={addToast}
          />
        )}

        {currentView === 'team' && (
          <TeamView
            activities={activities}
            members={members}
            isAdmin={isAdmin}
            onNavigate={handleNavigate}
            onAddToast={addToast}
            onDeleteActivity={handleDeleteActivity}
            onResetActivities={handleResetActivities}
            onResetPresence={handleResetPresence}
            onRefreshTeam={refreshTeamFromApi}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            members={members}
            isAdmin={isAdmin}
            userEmail={user.email}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
            onResetEvents={handleResetEvents}
            onAddToast={addToast}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            projects={projects}
            reports={reports}
            onNavigate={handleNavigate}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onSelectReport={(id) => setSelectedReportId(id)}
            onAddToast={addToast}
            userEmail={user.email}
            userName={user.name}
            avatarUrl={(user as any)?.avatar_url}
            onUpdateUser={(updated) => {
              const updatedUser = {
                ...user,
                email: updated.email,
                name: updated.name,
                avatar_url: updated.avatar_url,
              };
              setUser(updatedUser);
              try {
                localStorage.setItem('laporanwee_user', JSON.stringify(updatedUser));
              } catch (_) {}
            }}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            onNavigate={handleNavigate}
            onAddToast={addToast}
            onRefresh={refreshAnalyticsFromApi}
          />
        )}

        {currentView === 'ui-settings' && (
          <AdminUISettingsView
            onNavigate={handleNavigate}
            onAddToast={addToast}
            userEmail={user.email}
            userName={user.name}
            onSettingsUpdated={(newSettings) => {
              setUiSettings(newSettings);
            }}
          />
        )}

        <div className="footer-tag">
          LaporanWee v2.4 &bull; Creative Team Workspace &amp; Daily Reporting System
        </div>
      </main>

      {/* Global Toast Stack */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
