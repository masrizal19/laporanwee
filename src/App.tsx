import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuthUser,
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
  mapRawDailyReportToReport,
  extractReportsArrayFromResponse,
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  clearStoredAuth,
  clearReportCache,
  reportStatusToTaskCol,
  taskColToReportStatus,
  taskColToBackendReportStatus,
} from './utils/api';
import { projectService } from './utils/projectService';
import {
  fetchUISettings,
  applyUISettingsToDocument,
  DEFAULT_UI_SETTINGS,
} from './utils/uiSettings';

export function App() {
  // 1. Session & Routing state
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getStoredToken();
    const saved = getStoredUser();
    if (!token || !saved) {
      clearStoredAuth();
      return null;
    }
    return saved;
  });

  // Verify active session on load with valid Bearer token
  useEffect(() => {
    const saved = getStoredUser();
    const token = getStoredToken();
    if (saved && token) {
      setUser(saved);
      console.log('[AUTH] Current user:', {
        id: saved.id,
        email: saved.email,
        role: saved.role,
      });
    } else {
      clearStoredAuth();
      clearReportCache();
      setUser(null);
      navigateToPath('/login');
    }
  }, []);

  // Fetch user profile from MySQL database on load to sync avatar_url, role, id and name
  useEffect(() => {
    if (user && getStoredToken()) {
      api.get('/profile.php')
        .then((res) => {
          if (res && res.success && res.data) {
            setUser((prev) => {
              if (!prev) return null;
              if (
                prev.id === res.data.id &&
                prev.full_name === res.data.full_name &&
                prev.role === res.data.role &&
                prev.avatar_url === res.data.avatar_url
              ) {
                return prev;
              }
              const updated: AuthUser = {
                ...prev,
                id: res.data.id || prev.id,
                full_name: res.data.full_name || prev.full_name,
                name: res.data.full_name || prev.name,
                role: res.data.role || prev.role,
                avatar_url: res.data.avatar_url || prev.avatar_url,
              };
              setStoredUser(updated);
              console.log('[AUTH] Current user (synced from DB):', {
                id: updated.id,
                email: updated.email,
                role: updated.role,
              });
              return updated;
            });
          }
        })
        .catch((err) => {
          if (err?.status === 401) {
            clearStoredAuth();
            clearReportCache();
            setUser(null);
            navigateToPath('/login');
          }
        });
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
  const [reports, setReports] = useState<Report[]>(() => dailyReportService.getCachedReports());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | undefined>(undefined);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    return localStorage.getItem('laporanwee_selected_report_id') || '';
  });
  const [isReportsLoading, setIsReportsLoading] = useState<boolean>(() => {
    return dailyReportService.getCachedReports().length === 0;
  });
  const [reportsError, setReportsError] = useState<{
    status?: number;
    message: string;
    type: '401' | '403' | '404' | '500' | 'network' | 'error';
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Determine if current logged in user has Administrator privileges strictly from database users.role (Rule 4)
  const isAdmin = Boolean(
    user?.role?.toLowerCase() === 'admin' ||
    (user as any)?.is_admin === true
  );

  // Synchronize Tasks and Daily Reports with Backend PHP/MySQL API — Single Source of Truth
  const refreshTasksFromApi = useCallback(async (reportListOverride?: Report[]) => {
    try {
      const fetchedTasks = await taskService.fetchTasks();

      // Retrieve current reports from parameter, state, cache, or API
      let reportList: Report[] = reportListOverride || reports;
      if (!reportList || reportList.length === 0) {
        reportList = dailyReportService.getCachedReports();
        if (!reportList || reportList.length === 0) {
          const apiReports = await dailyReportService.fetchDailyReports(user?.email, isAdmin).catch(() => []);
          if (Array.isArray(apiReports) && apiReports.length > 0) {
            reportList = apiReports;
          }
        }
      }

      const mergedTasks: Task[] = [];
      const processedReportIds = new Set<string>();

      // 1. Process tasks fetched from backend tasks table
      for (const t of fetchedTasks) {
        let matchedReport: Report | undefined;
        if (t.report_id) {
          matchedReport = reportList.find((r) => String(r.id).trim() === String(t.report_id).trim());
        }
        if (!matchedReport && t.title) {
          matchedReport = reportList.find(
            (r) =>
              r.task.trim().toLowerCase() === t.title.trim().toLowerCase() &&
              (!t.proj || r.project.trim().toLowerCase() === t.proj.trim().toLowerCase())
          );
        }

        if (matchedReport) {
          const rId = String(matchedReport.id).trim();
          processedReportIds.add(rId);
          mergedTasks.push({
            ...t,
            report_id: rId,
            title: matchedReport.task || t.title,
            description: matchedReport.desc || t.description || '',
            proj: matchedReport.project || t.proj,
            category: matchedReport.category || t.category,
            assignee: matchedReport.person || t.assignee,
            assignee_email: matchedReport.user_email || t.assignee_email,
            due: matchedReport.date || t.due,
            progress: typeof matchedReport.progress === 'number' ? matchedReport.progress : t.progress,
            col: reportStatusToTaskCol(matchedReport.status),
            cover_url: matchedReport.evidence_url || t.cover_url,
          });
        } else {
          mergedTasks.push(t);
        }
      }

      // 2. Synthesize linked task for any daily report without a task row yet
      for (const r of reportList) {
        const rId = String(r.id).trim();
        if (!processedReportIds.has(rId)) {
          processedReportIds.add(rId);
          mergedTasks.push({
            id: `report-${rId}`,
            report_id: rId,
            proj: r.project || 'Creative Sprint',
            title: r.task || 'Laporan Harian',
            description: r.desc || '',
            category: r.category || 'Desain & UI/UX',
            priority: (r.progress >= 80 ? 'High' : 'Medium'),
            assignee: r.person || r.user_name || '',
            assignee_email: r.user_email || '',
            due: r.date || r.report_date || 'Hari ini',
            progress: typeof r.progress === 'number' ? r.progress : 0,
            col: reportStatusToTaskCol(r.status),
            cover_url: r.evidence_url || (r.evidence_urls && r.evidence_urls[0]),
            documents: [],
          });
        }
      }

      setTasks(mergedTasks);
    } catch (err) {
      console.warn('Sync tasks from API notice:', err);
    }
  }, [reports, user?.email, isAdmin]);

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

  // Tracking for active reports fetch and incremental realtime sync
  const reportsAbortControllerRef = useRef<AbortController | null>(null);
  const lastSyncAtRef = useRef<string>(localStorage.getItem('laporanwee_last_sync') || '');

  // Calculate latest update timestamp from reports list
  const computeLatestTimestamp = (list: Report[]): string => {
    let latest = '';
    for (const r of list) {
      const candidate = r.updated_at || r.created_at || r.report_date || '';
      if (candidate && candidate > latest) {
        latest = candidate;
      }
    }
    return latest;
  };

  // Synchronize Daily Reports with Backend PHP/MySQL API with AbortController
  const refreshReportsFromApi = useCallback(async (silent = false) => {
    // Abort previous in-flight request to prevent requests piling up
    if (reportsAbortControllerRef.current) {
      reportsAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    reportsAbortControllerRef.current = controller;

    // Show loading spinner if not silent OR if we do not yet have reports loaded from server
    setIsReportsLoading((prev) => !silent || prev);

    try {
      setReportsError(null);
      const fetchedReports = await dailyReportService.fetchDailyReports(user?.email, isAdmin, {
        signal: controller.signal,
      });

      // MySQL is the SINGLE SOURCE OF TRUTH (Rule 6, Rule 18)
      if (Array.isArray(fetchedReports)) {
        setReports(fetchedReports);
        const latestTime = computeLatestTimestamp(fetchedReports);
        if (latestTime) {
          lastSyncAtRef.current = latestTime;
          localStorage.setItem('laporanwee_last_sync', latestTime);
        }

        setSelectedReportId((prev) => {
          if (prev && fetchedReports.some((r) => String(r.id).trim() === String(prev).trim())) {
            return prev;
          }
          const stored = localStorage.getItem('laporanwee_selected_report_id');
          if (stored && fetchedReports.some((r) => String(r.id).trim() === String(stored).trim())) {
            return stored;
          }
          return (fetchedReports[0] ? String(fetchedReports[0].id) : '') || prev;
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Sync reports from API error:', err);
      const status = Number(err?.status || err?.code);
      let errorType: '401' | '403' | '404' | '500' | 'network' | 'error' = 'error';
      if (status === 401) errorType = '401';
      else if (status === 403) errorType = '403';
      else if (status === 404) errorType = '404';
      else if (status >= 500) errorType = '500';
      else if (
        err?.name === 'TypeError' ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('network')
      ) {
        errorType = 'network';
      }

      setReportsError({
        status,
        message: err?.message || 'Gagal memuat laporan dari server backend.',
        type: errorType,
      });
    } finally {
      setIsReportsLoading(false);
    }
  }, [user?.email, isAdmin]);

  // Incrementally merge new or updated reports without refetching the full table
  const mergeUpdatedReports = useCallback((newOrUpdatedRaw: any[]) => {
    if (!Array.isArray(newOrUpdatedRaw) || newOrUpdatedRaw.length === 0) return;
    const newOrUpdated = newOrUpdatedRaw.map(mapRawDailyReportToReport);
    newOrUpdated.forEach((r) => dailyReportService.saveReportToCache(r));

    setReports((prev) => {
      const updatedMap = new Map<string, Report>();
      newOrUpdated.forEach((r) => updatedMap.set(String(r.id).trim(), r));

      const result: Report[] = [];
      const seenIds = new Set<string>();

      // Update matching items in-place
      for (const item of prev) {
        const idStr = String(item.id).trim();
        seenIds.add(idStr);
        if (updatedMap.has(idStr)) {
          result.push(updatedMap.get(idStr)!);
        } else {
          result.push(item);
        }
      }

      // Prepend brand new items
      for (const item of newOrUpdated) {
        const idStr = String(item.id).trim();
        if (!seenIds.has(idStr)) {
          result.unshift(item);
          seenIds.add(idStr);
        }
      }

      const latestTime = computeLatestTimestamp(result);
      if (latestTime) {
        lastSyncAtRef.current = latestTime;
        localStorage.setItem('laporanwee_last_sync', latestTime);
      }
      return result;
    });
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

  // Initial load when user is authenticated:
  // Immediately prioritize current view (e.g. reports) so it displays without waiting for secondary requests
  useEffect(() => {
    if (user) {
      // 1. Immediate primary fetch for active screen
      if (currentView === 'reports') {
        refreshReportsFromApi();
      } else if (currentView === 'tasks') {
        refreshTasksFromApi();
      } else if (currentView === 'projects') {
        refreshProjectsFromApi();
      } else {
        refreshReportsFromApi();
      }

      // 2. Defer secondary data fetching so initial report list renders in milliseconds
      const secondaryTimer = setTimeout(() => {
        refreshTasksFromApi();
        refreshProjectsFromApi();
        refreshActivitiesFromApi();
        refreshEventsFromApi();
        refreshTeamFromApi();
        refreshAnalyticsFromApi();
      }, 350);

      // Mark current user as online in database
      if (user.email) {
        teamService.updatePresence(true, user.email).then(() => {
          refreshTeamFromApi();
        });
      }

      // Periodic heartbeat every 45s (lightweight)
      teamService.sendHeartbeat((user as any).id, user.email);
      const heartbeatInterval = setInterval(() => {
        if (navigator.onLine) {
          teamService.sendHeartbeat((user as any).id, user.email);
        }
      }, 45000);

      const handleBeforeUnload = () => {
        if (user?.email) {
          teamService.updatePresence(false, user.email);
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearTimeout(secondaryTimer);
        clearInterval(heartbeatInterval);
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
  }, [user]);

  // Re-fetch tasks whenever user navigates to tasks view
  useEffect(() => {
    if (user && currentView === 'tasks') {
      refreshTasksFromApi();
    }
  }, [user, currentView, refreshTasksFromApi]);

  // Re-fetch reports whenever user navigates to reports view
  useEffect(() => {
    if (user && currentView === 'reports') {
      refreshReportsFromApi(reports.length > 0);
    }
  }, [user, currentView, refreshReportsFromApi, reports.length]);

  // Optimized Incremental Realtime Polling via /api/realtime/poll.php
  useEffect(() => {
    // Poll when: user is logged in, reports or tasks view is active, and browser is online
    const isReportsOrTasks = currentView === 'reports' || currentView === 'tasks';
    if (!user || !isReportsOrTasks) return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollController: AbortController | null = null;

    const executePoll = async () => {
      if (!isMounted || !user || (!isReportsOrTasks) || !navigator.onLine) {
        return;
      }

      // Abort old pending poll request before issuing new one
      if (pollController) {
        pollController.abort();
      }
      pollController = new AbortController();

      try {
        const sinceParam = lastSyncAtRef.current || undefined;
        const res = await realtimeService.poll(sinceParam, pollController.signal);

        if (res && isMounted) {
          // Track server timestamp or cursor
          if (res.server_time || res.latest || res.last_sync) {
            const nextCursor = String(res.server_time || res.latest || res.last_sync).trim();
            lastSyncAtRef.current = nextCursor;
            localStorage.setItem('laporanwee_last_sync', nextCursor);
          }

          // Check if deleted reports are indicated directly
          const deletedIdsRaw = res.deleted_ids || res.deleted_reports || res.deleted || res.removed || [];
          if (Array.isArray(deletedIdsRaw) && deletedIdsRaw.length > 0) {
            const deletedSet = new Set(deletedIdsRaw.map((id: any) => String(id).trim()));
            deletedSet.forEach((id) => dailyReportService.removeReportFromCache(id));
            setReports((prev) => prev.filter((r) => !deletedSet.has(String(r.id).trim())));
            setTasks((prev) => prev.filter((t) => !deletedSet.has(String(t.report_id || '').trim())));
          }

          // Check if total count changed (e.g. report deleted or added by another user)
          const serverTotal = res.total_count ?? res.count;
          if (typeof serverTotal === 'number' && reports.length > 0 && serverTotal !== reports.length) {
            console.log('[Realtime] Report count discrepancy detected (server:', serverTotal, 'local:', reports.length, '), refetching...');
            refreshReportsFromApi(true);
            refreshTasksFromApi();
          } else {
            // Check if incremental updated reports are provided directly
            const changedItems = extractReportsArrayFromResponse(res);
            if (changedItems && changedItems.length > 0) {
              console.log('[Realtime] Received incremental reports update:', changedItems.length);
              mergeUpdatedReports(changedItems);
              refreshTasksFromApi();
            } else if (res.changed === true || res.has_updates === true) {
              // If server indicated changes occurred without sending list, do a silent refetch
              console.log('[Realtime] Database change flagged, fetching latest reports and tasks...');
              refreshReportsFromApi(true);
              refreshTasksFromApi();
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('[Realtime] Poll notice:', err);
        }
      } finally {
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (!isMounted || !user || (!isReportsOrTasks)) return;
      if (pollTimer) clearTimeout(pollTimer);

      // 5-10s (8s) when active, 30s when hidden
      const isVisible = document.visibilityState === 'visible';
      const delay = isVisible ? 8000 : 30000;

      pollTimer = setTimeout(() => {
        executePoll();
      }, delay);
    };

    // On tab visibility change: sync immediately when becoming visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (pollTimer) clearTimeout(pollTimer);
        executePoll();
      }
    };

    // On reconnecting online
    const handleOnline = () => {
      if (pollTimer) clearTimeout(pollTimer);
      executePoll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Initial scheduled poll
    scheduleNext();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (pollController) pollController.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, currentView, refreshReportsFromApi, mergeUpdatedReports]);

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
      // Determine synchronized progress and column (Rule 5: Progress laporan dan task harus sinkron)
      let syncedProgress = typeof updatedTask.progress === 'number' ? updatedTask.progress : 0;
      let finalCol = updatedTask.col;
      if (finalCol === 'done' && syncedProgress < 100) {
        syncedProgress = 100;
      } else if (syncedProgress === 100 && finalCol !== 'done') {
        finalCol = 'done';
      }
      const taskWithSyncedProgress: Task = { ...updatedTask, progress: syncedProgress, col: finalCol };

      // Optimistic UI update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskWithSyncedProgress.id ? taskWithSyncedProgress : t))
      );

      // Check if this task is linked to a daily report (Rule 7: EDIT TASK - update data laporan terkait)
      const linkedReportId = taskWithSyncedProgress.report_id ||
        (taskWithSyncedProgress.id.startsWith('report-') ? taskWithSyncedProgress.id.replace('report-', '') : undefined);

      if (linkedReportId) {
        const backendStatus = taskColToBackendReportStatus(taskWithSyncedProgress.col);
        const frontendStatus = taskColToReportStatus(taskWithSyncedProgress.col);

        // Optimistically update report state
        setReports((prev) =>
          prev.map((r) => {
            if (String(r.id).trim() === String(linkedReportId).trim()) {
              return {
                ...r,
                status: frontendStatus,
                progress: syncedProgress,
                task: taskWithSyncedProgress.title || r.task,
                project: taskWithSyncedProgress.proj || r.project,
              };
            }
            return r;
          })
        );

        // Update daily report in backend MySQL API
        await dailyReportService.updateDailyReport({
          id: linkedReportId,
          status: backendStatus,
          progress: syncedProgress,
          title: taskWithSyncedProgress.title,
          description: taskWithSyncedProgress.description || '',
          work_category: taskWithSyncedProgress.category || taskWithSyncedProgress.proj || 'Desain & UI/UX',
          project_name: taskWithSyncedProgress.proj || 'Creative Sprint',
          report_date: taskWithSyncedProgress.due || new Date().toISOString().slice(0, 10),
        }).catch((err) => console.warn('Update linked daily report notice:', err));
      }

      // If it's a backend task row, update it in tasks table
      if (!taskWithSyncedProgress.id.startsWith('report-')) {
        await taskService.updateTask(taskWithSyncedProgress).catch((err) => console.warn('Update backend task notice:', err));
      }

      await refreshTasksFromApi();
      await refreshReportsFromApi(true);
      await refreshAnalyticsFromApi();
    } catch (e: any) {
      console.error('API update task error:', e);
      addToast(e?.message || 'Gagal memperbarui tugas.');
      await refreshTasksFromApi();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Rule 9: HAPUS TASK - laporan tetap aman, jangan menghapus laporan secara sembarangan
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      if (!taskId.startsWith('report-')) {
        await taskService.deleteTask(taskId);
      }
      await refreshTasksFromApi();
      addToast('Tugas berhasil dihapus dari papan.');
      await refreshAnalyticsFromApi();
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

      if (!created || !created.id) {
        throw new Error('Server berhasil membuat laporan namun ID laporan baru tidak valid.');
      }

      const createdId = String(created.id).trim();

      // Rule 1: SETIAP LAPORAN MENJADI TUGAS
      const linkedCol = reportStatusToTaskCol(reportData.status);
      const linkedProgress = linkedCol === 'done' ? 100 : (typeof reportData.progress === 'number' ? reportData.progress : 0);

      try {
        const backendTask = await taskService.createTask({
          report_id: createdId,
          title: reportData.task,
          description: reportData.desc || '',
          proj: reportData.project || 'Creative Sprint',
          category: reportData.category || 'Desain & UI/UX',
          priority: linkedProgress >= 80 ? 'High' : 'Medium',
          assignee: reportData.person || user?.name || '',
          assignee_email: user?.email || '',
          due: reportData.date || 'Hari ini',
          progress: linkedProgress,
          col: linkedCol,
        });

        if (backendTask && backendTask.id) {
          created.task_id = backendTask.id;
          setTasks((prev) => [
            backendTask,
            ...prev.filter((t) => t.id !== backendTask.id && t.report_id !== createdId),
          ]);
        }
      } catch (err) {
        console.warn('Auto create linked task notice:', err);
        const fallbackTask: Task = {
          id: `report-${createdId}`,
          report_id: createdId,
          proj: reportData.project || 'Creative Sprint',
          title: reportData.task,
          description: reportData.desc || '',
          category: reportData.category || 'Desain & UI/UX',
          priority: linkedProgress >= 80 ? 'High' : 'Medium',
          assignee: reportData.person || user?.name || '',
          assignee_email: user?.email || '',
          due: reportData.date || 'Hari ini',
          progress: linkedProgress,
          col: linkedCol,
          documents: [],
        };
        setTasks((prev) => [
          fallbackTask,
          ...prev.filter((t) => t.id !== fallbackTask.id && t.report_id !== createdId),
        ]);
      }

      // Immediately place new report into reports state so it is instantly available
      setReports((prev) => [
        created,
        ...prev.filter((r) => String(r.id).trim() !== createdId),
      ]);

      // Set active report ID and persist to localStorage
      setSelectedReportId(createdId);
      localStorage.setItem('laporanwee_selected_report_id', createdId);

      // Verify the report can actually be retrieved (Rule 7: pastikan laporan benar-benar dapat ditemukan)
      const verified = await dailyReportService.fetchDailyReportDetail(createdId).catch(() => null);
      if (verified) {
        setReports((prev) => [
          verified,
          ...prev.filter((r) => String(r.id).trim() !== createdId),
        ]);
      }

      // Re-fetch reports and tasks from MySQL API so new report appears immediately (Requirement 6)
      await refreshReportsFromApi().catch((err) => console.warn('Sync reports notice:', err));
      await refreshTasksFromApi().catch((err) => console.warn('Sync tasks notice:', err));

      // Show success feedback ONLY AFTER verification succeeded (Rule 8: jangan menampilkan success palsu)
      addToast(`Laporan kerja "${reportData.task}" berhasil dikirim!`);

      // Log activity to backend MySQL API
      activityService.createActivity({
        title: 'mengirim laporan kerja',
        description: `"${reportData.task}" (${reportData.project})`,
        activity_type: 'report',
        icon_type: 'doc',
        user_name: reportData.person || user?.name || 'Tim LaporanWee',
        user_email: user?.email || '',
      }).then(() => refreshActivitiesFromApi()).catch(() => {});

      // Refresh projects from API as well in case project progress/cover was updated
      refreshProjectsFromApi().catch(() => {});
      refreshAnalyticsFromApi().catch(() => {});

      return createdId;
    } catch (e: any) {
      console.error('API create daily report error:', e);
      addToast(e?.message || 'Gagal mengirim laporan kerja.');
      throw e;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const targetReport = reports.find((r) => String(r.id).trim() === String(reportId).trim());
    const isOwner = Boolean(
      user?.email &&
      targetReport &&
      ((targetReport.user_email && targetReport.user_email.toLowerCase() === user.email.toLowerCase()) ||
       (targetReport.created_by && targetReport.created_by.toLowerCase() === user.email.toLowerCase()) ||
       (targetReport.person && targetReport.person.toLowerCase() === (user.name || '').toLowerCase()))
    );

    if (!isAdmin && !isOwner) {
      addToast('Akses ditolak: Hanya Administrator atau pemilik laporan yang dapat menghapus laporan.');
      return;
    }
    try {
      // Rule 8: HAPUS LAPORAN - task terkait harus ikut dihapus atau diputus
      const linkedTask = tasks.find(
        (t) =>
          (t.report_id && String(t.report_id).trim() === String(reportId).trim()) ||
          t.id === `report-${reportId}`
      );
      if (linkedTask) {
        if (!linkedTask.id.startsWith('report-')) {
          taskService.deleteTask(linkedTask.id).catch((err) => console.warn('Delete linked task error:', err));
        }
        setTasks((prev) =>
          prev.filter((t) => t.id !== linkedTask.id && t.report_id !== String(reportId).trim())
        );
      }

      const ok = await dailyReportService.deleteDailyReport(reportId);
      if (ok) {
        setReports((prev) => prev.filter((r) => String(r.id).trim() !== String(reportId).trim()));
        dailyReportService.removeReportFromCache(reportId);
        await refreshReportsFromApi(true);
        await refreshTasksFromApi();
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
        await refreshTasksFromApi();
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

  const handleReportUpdated = (updatedReport: Report) => {
    setReports((prev) =>
      prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
    );

    // Rule 6: EDIT LAPORAN - update task terkait, jangan membuat task baru, pertahankan task_id
    const targetTaskId = updatedReport.task_id;
    const targetTask = tasks.find(
      (t) =>
        (t.report_id && String(t.report_id).trim() === String(updatedReport.id).trim()) ||
        (targetTaskId && String(t.id).trim() === String(targetTaskId).trim()) ||
        t.id === `report-${updatedReport.id}`
    );

    if (targetTask) {
      const syncedTask: Task = {
        ...targetTask,
        report_id: String(updatedReport.id).trim(),
        title: updatedReport.task,
        description: updatedReport.desc || targetTask.description,
        proj: updatedReport.project,
        category: updatedReport.category,
        assignee: updatedReport.person,
        due: updatedReport.date,
        progress: updatedReport.progress,
        col: reportStatusToTaskCol(updatedReport.status),
      };

      setTasks((prev) => prev.map((t) => (t.id === syncedTask.id ? syncedTask : t)));

      if (!syncedTask.id.startsWith('report-')) {
        taskService.updateTask(syncedTask).catch((err) => console.warn('Update synced task notice:', err));
      }
    }

    // Refresh analytics summary and reports in background
    refreshAnalyticsFromApi().catch(() => {});
    refreshReportsFromApi(true).catch(() => {});
    refreshTasksFromApi().catch(() => {});
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
    const token = getStoredToken();
    if (user?.email) {
      teamService.updatePresence(false, user.email).catch(() => {});
    }
    
    // Clear state & storage immediately for reactive UI response
    clearStoredAuth();
    clearReportCache();
    setUser(null);
    setReports([]);
    setReportsError(null);
    addToast('Berhasil keluar dari sesi.');
    navigateToPath('/login');

    // Notify backend
    if (token) {
      api.post('/logout.php', {}).catch(() => {});
    }
  };

  const handleSelectReport = (id: string | number) => {
    const cleanId = String(id).trim();
    setSelectedReportId(cleanId);
    localStorage.setItem('laporanwee_selected_report_id', cleanId);
  };

  const currentProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];
  const currentReport =
    reports.find((r) => String(r.id).trim() === String(selectedReportId).trim()) || reports[0];

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
            clearReportCache();
            setReports([]);
            setReportsError(null);
            setIsReportsLoading(true);
            const loggedInUser: AuthUser = fullUser || {
              id: 1,
              email,
              name,
              full_name: name,
              role: 'team',
            };
            setStoredUser(loggedInUser);
            setUser(loggedInUser);
            console.log('[AUTH] Current user:', {
              id: loggedInUser.id,
              email: loggedInUser.email,
              role: loggedInUser.role,
            });
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
            isLoading={isReportsLoading}
            isAdmin={isAdmin}
            currentUserEmail={user.email}
            reportsError={reportsError}
            onRetry={() => refreshReportsFromApi()}
            onNavigate={handleNavigate}
            onSelectReport={handleSelectReport}
            onDeleteReport={handleDeleteReport}
            onResetReports={handleResetReports}
            onAddToast={addToast}
          />
        )}

        {currentView === 'report-detail' && (
          <ReportDetailView
            reportId={selectedReportId}
            initialReport={reports.find((r) => String(r.id).trim() === String(selectedReportId).trim())}
            projects={projects}
            onNavigate={handleNavigate}
            onUpdateStatus={handleUpdateReportStatus}
            onReportUpdated={handleReportUpdated}
            onAddToast={addToast}
          />
        )}

        {currentView === 'create-report' && (
          <CreateReportView
            projects={projects}
            userName={user.name}
            userEmail={user.email}
            onNavigate={handleNavigate}
            onAddReport={handleAddReport}
            onSelectReport={handleSelectReport}
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
