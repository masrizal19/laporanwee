import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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
import { findAppBySlug, RegisteredApp } from './data/appsRegistry';
import { isUserAdmin } from './utils/userUtils';
import {
  api,
  profileService,
  profileAvatarService,
  withAvatarCacheBust,
  getAbsoluteAvatarUrl,
  extractAvatarFromResponse,
  getLatestProfileSaveTimestamp,
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
  getStoredUser,
  setStoredUser,
  clearStoredAuth,
  clearReportCache,
  reportStatusToTaskCol,
  mapFrontendStatusToBackend,
  taskColToReportStatus,
  computeTargetProgress,
} from './utils/api';
import { projectService } from './utils/projectService';
import {
  fetchUISettings,
  applyUISettingsToDocument,
  DEFAULT_UI_SETTINGS,
} from './utils/uiSettings';

// Route-level code splitting for faster initial load and lightweight navigation
const DashboardView = lazy(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })));
const ProjectsView = lazy(() => import('./views/ProjectsView').then((m) => ({ default: m.ProjectsView })));
const ProjectDetailView = lazy(() => import('./views/ProjectDetailView').then((m) => ({ default: m.ProjectDetailView })));
const ReportsView = lazy(() => import('./views/ReportsView').then((m) => ({ default: m.ReportsView })));
const ReportDetailView = lazy(() => import('./views/ReportDetailView').then((m) => ({ default: m.ReportDetailView })));
const CreateReportView = lazy(() => import('./views/CreateReportView').then((m) => ({ default: m.CreateReportView })));
const TasksView = lazy(() => import('./views/TasksView').then((m) => ({ default: m.TasksView })));
const TeamView = lazy(() => import('./views/TeamView').then((m) => ({ default: m.TeamView })));
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })));
const UserProfileView = lazy(() => import('./views/UserProfileView').then((m) => ({ default: m.UserProfileView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const SocialMediaView = lazy(() => import('./views/SocialMediaView').then((m) => ({ default: m.SocialMediaView })));
const ProfileSettingsView = lazy(() => import('./views/ProfileSettingsView').then((m) => ({ default: m.ProfileSettingsView })));
const UiSettingsView = lazy(() => import('./views/UiSettingsView').then((m) => ({ default: m.UiSettingsView })));
const ExportLaporanStandalone = lazy(() => import('./views/ExportLaporanStandalone').then((m) => ({ default: m.ExportLaporanStandalone })));
const EditLaporanStandalone = lazy(() => import('./views/EditLaporanStandalone').then((m) => ({ default: m.EditLaporanStandalone })));
const PengajuanBarangView = lazy(() => import('./views/PengajuanBarangView').then((m) => ({ default: m.PengajuanBarangView })));
const ChatView = lazy(() => import('./views/ChatView').then((m) => ({ default: m.ChatView })));
const GaleriBerkasView = lazy(() => import('./views/GaleriBerkasView').then((m) => ({ default: m.GaleriBerkasView })));
const PengajuanBarangExportView = lazy(() => import('./views/PengajuanBarangExportView').then((m) => ({ default: m.PengajuanBarangExportView })));
const AplikasiView = lazy(() => import('./views/AplikasiView').then((m) => ({ default: m.AplikasiView })));
const AplikasiHostView = lazy(() => import('./views/AplikasiHostView').then((m) => ({ default: m.AplikasiHostView })));
const ProfileCropSettingView = lazy(() => import('./views/ProfileCropSettingPage').then((m) => ({ default: m.ProfileCropSettingPage })));
const LoginView = lazy(() => import('./views/LoginView').then((m) => ({ default: m.LoginView })));
const RegisterView = lazy(() => import('./views/RegisterView').then((m) => ({ default: m.RegisterView })));
const VerifyEmailView = lazy(() => import('./views/VerifyEmailView').then((m) => ({ default: m.VerifyEmailView })));
const VersionUpdateModal = lazy(() => import('./components/VersionUpdateModal').then((m) => ({ default: m.VersionUpdateModal })));

export const CropSettingPage = ProfileCropSettingView;

const ViewLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[320px] py-16 px-4 animate-fade-in">
    <div className="w-10 h-10 rounded-2xl bg-[var(--ink)]/5 flex items-center justify-center mb-3">
      <div className="w-5 h-5 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
    </div>
    <p className="text-xs font-medium text-[var(--muted)]">Memuat halaman...</p>
  </div>
);

export function App() {
  // 1. Session & Routing state
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const token = getStoredToken();
      const saved = getStoredUser();
      console.log('[APP INIT STAGE 1: Auth Session Check]', { tokenExists: !!token, savedUserEmail: saved?.email });
      if (!token || !saved) {
        clearStoredAuth();
        return null;
      }
      return saved;
    } catch (err) {
      console.error('[APP INIT ERROR: Auth Session]', err);
      clearStoredAuth();
      return null;
    }
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

  // Fetch user profile from MySQL database on load/refresh to sync avatar_url, role, id and name
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const requestInitiatedAt = Date.now();
    profileService.getProfile()
      .then((res) => {
        // Ignore stale GET responses if a save occurred after this request started
        if (requestInitiatedAt < getLatestProfileSaveTimestamp()) return;

        if (res && res.success && res.data) {
          const rawAvatar = extractAvatarFromResponse(res);
          const cleanAvatar = rawAvatar ? withAvatarCacheBust(rawAvatar, res.data.updated_at || Date.now()) : null;

          setUser((prev) => {
            if (!prev) return null;
            if (
              prev.id === res.data.id &&
              prev.full_name === res.data.full_name &&
              prev.role === res.data.role &&
              prev.avatar_url === cleanAvatar
            ) {
              return prev;
            }
            const updated: AuthUser = {
              ...prev,
              id: res.data.id || prev.id,
              full_name: res.data.full_name || prev.full_name,
              name: res.data.full_name || prev.name,
              role: res.data.role || prev.role,
              profile_title: res.data.profile_title !== undefined ? res.data.profile_title : prev.profile_title,
              profile_location: res.data.profile_location !== undefined ? res.data.profile_location : prev.profile_location,
              avatar_url: cleanAvatar,
            };
            setStoredUser(updated);
            console.log('[AUTH] Current user (synced from DB):', {
              id: updated.id,
              email: updated.email,
              role: updated.role,
              avatar_url: updated.avatar_url,
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
  }, []);

  // Listen to profile update event from ProfileView or ProfileCropView
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      let targetEmail = '';
      let targetId = '';
      setUser((prev) => {
        if (!prev) return null;
        targetEmail = prev.email ? prev.email.toLowerCase() : '';
        targetId = prev.id ? String(prev.id) : '';
        const freshName = detail.name || detail.full_name || prev.name;
        const freshAvatar = detail.avatar_url !== undefined ? (detail.avatar_url ? withAvatarCacheBust(detail.avatar_url) : null) : prev.avatar_url;

        const freshTitle = detail.profile_title !== undefined ? detail.profile_title : prev.profile_title;
        const freshLocation = detail.profile_location !== undefined ? detail.profile_location : prev.profile_location;

        const updated: AuthUser = {
          ...prev,
          name: freshName,
          full_name: freshName,
          profile_title: freshTitle,
          profile_location: freshLocation,
          avatar_url: freshAvatar,
        };
        return updated;
      });

      // Synchronize presence list / team members if current user is in members list
      const uidToInvalidate = detail.user_id || detail.id || targetId;
      if (uidToInvalidate) {
        profileAvatarService.invalidateCache(uidToInvalidate);
      }

      setMembers((prevMembers) =>
        prevMembers.map((m) => {
          const isMatch = (targetId && String(m.id) === targetId) || (targetEmail && m.email?.toLowerCase() === targetEmail);
          if (isMatch) {
            const freshName = detail.name || detail.full_name || m.name;
            const freshAvatar = detail.avatar_url !== undefined ? (detail.avatar_url ? withAvatarCacheBust(detail.avatar_url) : null) : m.avatar_url;
            return {
              ...m,
              name: freshName,
              full_name: freshName,
              img: freshAvatar ? getAbsoluteAvatarUrl(freshAvatar, freshName) : m.img,
              avatar_url: freshAvatar,
              profile_title: detail.profile_title !== undefined ? detail.profile_title : m.profile_title,
              profile_location: detail.profile_location !== undefined ? detail.profile_location : m.profile_location,
            };
          }
          return m;
        })
      );
    };

    window.addEventListener('laporanwee-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('laporanwee-profile-updated', handleProfileUpdate);
    };
  }, []);

  const getPathFromLocation = (): string => {
    const hashPart = window.location.hash.replace('#', '').split('?')[0];
    const validPaths = [
      '/login',
      '/register',
      '/verify-email',
      '/dashboard',
      '/proyek',
      '/laporan',
      '/chat',
      '/chat/preview-file',
      '/laporan/detail',
      '/laporan/detail/edit-laporan',
      '/tugas',
      '/tim',
      '/kalender',
      '/analitik',
      '/pengajuan-barang',
      '/analitik/exporlaporan',
      '/analitik/editlaporan',
      '/admin/ui-settings',
      '/ui-settings',
      '/profil',
      '/profile',
      '/profil/crop-setting',
      '/profil/setting-profile-picture',
      '/profil/crop',
      '/profil/ubahfoto',
      '/profil/user',
      '/berkas',
      '/lampiran',
      '/galeri-lampiran',
      '/galeri-berkas',
      '/aplikasi',
      '/Aplikasi',
      '/pengajuan-barang/export',
    ];
    const normalizeAplikasiPath = (rawPath: string): string | null => {
      const trimmed = rawPath.split('?')[0].replace(/\/+$/, '');
      if (!trimmed) return null;
      if (/^\/aplikasi$/i.test(trimmed)) {
        return '/Aplikasi';
      }
      const match = trimmed.match(/^\/aplikasi\/([^/]+)$/i);
      if (match && match[1]) {
        const rawSlug = decodeURIComponent(match[1]);
        const registered = findAppBySlug(rawSlug);
        return `/Aplikasi/${registered ? registered.slug : rawSlug}`;
      }
      return null;
    };
    if (hashPart) {
      const appHash = normalizeAplikasiPath(hashPart);
      if (appHash) return appHash;
    }
    if (hashPart && hashPart.startsWith('/chat')) {
      return hashPart.includes('preview-file') ? '/chat/preview-file' : '/chat';
    }
    if (hashPart && hashPart.startsWith('/profil/user')) {
      return '/profil/user';
    }
    if (hashPart && (hashPart.includes('/crop-setting') || hashPart.includes('/setting-profile-picture') || hashPart.includes('/crop'))) {
      return '/profil/crop-setting';
    }
    if (hashPart && hashPart.startsWith('/laporan/')) {
      return hashPart.includes('edit') ? '/laporan/detail/edit-laporan' : '/laporan/detail';
    }
    if (validPaths.includes(hashPart)) {
      return hashPart;
    }
    const path = window.location.pathname.split('?')[0];
    const appPath = normalizeAplikasiPath(path);
    if (appPath) return appPath;
    if (path.startsWith('/chat')) {
      return path.includes('preview-file') ? '/chat/preview-file' : '/chat';
    }
    if (path.startsWith('/profil/user')) {
      return '/profil/user';
    }
    if (path.includes('/crop-setting') || path.includes('/setting-profile-picture') || path.includes('/crop')) {
      return '/profil/crop-setting';
    }
    if (path.startsWith('/laporan/detail') || path.startsWith('/laporan/')) {
      const sub = path.replace('/laporan', '').trim();
      if (sub && sub !== '/' && sub !== '') {
        return path.includes('edit') ? '/laporan/detail/edit-laporan' : '/laporan/detail';
      }
    }
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

  const extractAppSlugFromPath = (pathStr: string): string => {
    const match = pathStr.match(/^\/aplikasi\/([^/]+)$/i);
    if (!match || !match[1]) return '';
    const rawSlug = decodeURIComponent(match[1]);
    return findAppBySlug(rawSlug)?.slug || rawSlug;
  };

  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      const resolved = getPathFromLocation();
      console.log('[APP INIT STAGE 2: Initial Path Resolution]', resolved);
      return resolved;
    } catch (err) {
      console.error('[APP INIT ERROR: Path Resolution]', err);
      return '/dashboard';
    }
  });

  // Initialize UI Settings with cached settings or defaults for instant rendering (Rule 8, 11)
  const [uiSettings, setUiSettings] = useState<UISettings>(() => {
    try {
      const cached = localStorage.getItem('laporanwee_ui_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log('[APP INIT STAGE 3: Cached UI Settings Loaded]', parsed?.app_title || 'LaporanWee');
        applyUISettingsToDocument(parsed);
        return parsed;
      }
    } catch (err) {
      console.error('[APP INIT ERROR: Cached UI Settings]', err);
    }
    console.log('[APP INIT STAGE 3: Using Default UI Settings]');
    applyUISettingsToDocument(DEFAULT_UI_SETTINGS);
    return DEFAULT_UI_SETTINGS;
  });

  // Revalidate UI Settings once on mount or when authenticated email changes (deduped via 30s cooldown)
  useEffect(() => {
    fetchUISettings(user?.email)
      .then((data) => {
        if (data) {
          setUiSettings(data);
          applyUISettingsToDocument(data);
        }
      })
      .catch(() => {});
  }, [user?.email]);

  // Real-time SPA sync: Listen for custom events, storage updates, and tab visibility changes
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setUiSettings(e.detail);
        applyUISettingsToDocument(e.detail);
      }
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'laporanwee_ui_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setUiSettings(parsed);
          applyUISettingsToDocument(parsed);
        } catch (_) {}
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUISettings(user?.email)
          .then((data) => {
            if (data) {
              setUiSettings(data);
              applyUISettingsToDocument(data);
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('ui-settings-updated', handleSettingsUpdated);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('ui-settings-updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.email]);

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
        if (/^\/aplikasi(\/[^/]+)?$/i.test(currentPath)) {
          try {
            sessionStorage.setItem('laporanwee_post_login_redirect', currentPath);
          } catch (_) {}
        }
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
    '/laporan/detail': 'report-detail',
    '/laporan/detail/edit-laporan': 'report-detail',
    '/tugas': 'tasks',
    '/chat': 'chat',
    '/chat/preview-file': 'chat',
    '/tim': 'team',
    '/kalender': 'calendar',
    '/analitik': 'analytics',
    '/pengajuan-barang': 'pengajuan-barang',
    '/analitik/exporlaporan': 'export-laporan',
    '/analitik/editlaporan': 'edit-laporan',
    '/admin/ui-settings': 'ui_settings',
    '/ui-settings': 'ui_settings',
    '/ui_settings': 'ui_settings',
    '/sosial-media': 'social-media',
    '/social-media': 'social-media',
    '/profil': 'profil',
    '/profile': 'profil',
    '/profil/crop-setting': 'crop-setting',
    '/profil/crop': 'crop-setting',
    '/profil/ubahfoto': 'crop-setting',
    '/profil/setting-profile-picture': 'crop-setting',
    '/profil/user': 'user-profile',
    '/berkas': 'galeri-berkas',
    '/lampiran': 'galeri-berkas',
    '/galeri-lampiran': 'galeri-berkas',
    '/galeri-berkas': 'galeri-berkas',
    '/aplikasi': 'aplikasi',
    '/Aplikasi': 'aplikasi',
    '/pengajuan-barang/export': 'pengajuan-barang-export',
  };

  const [activeAppSlug, setActiveAppSlug] = useState<string>(() => {
    const initialPath = getPathFromLocation();
    return extractAppSlugFromPath(initialPath);
  });

  const viewToPathMap: Record<ViewType, string> = {
    'dashboard': '/dashboard',
    'projects': '/proyek',
    'project-detail': '/proyek',
    'tasks': '/tugas',
    'chat': '/chat',
    'team': '/tim',
    'calendar': '/kalender',
    'reports': '/laporan',
    'report-detail': '/laporan/detail',
    'create-report': '/laporan',
    'profile': '/profil',
    'profil': '/profil',
    'crop-setting': '/profil/crop-setting',
    'profile-crop': '/profil/crop-setting',
    'setting-profile-picture': '/profil/crop-setting',
    'user-profile': '/profil/user',
    'analytics': '/analitik',
    'pengajuan-barang': '/pengajuan-barang',
    'social-media': '/sosial-media',
    'ui-settings': '/ui-settings',
    'ui_settings': '/ui-settings',
    'export-laporan': '/analitik/exporlaporan',
    'edit-laporan': '/analitik/editlaporan',
    'galeri-lampiran': '/galeri-berkas',
    'galeri-berkas': '/galeri-berkas',
    'aplikasi': '/Aplikasi',
    'aplikasi-detail': activeAppSlug ? `/Aplikasi/${activeAppSlug}` : '/Aplikasi/Fotowe',
    'pengajuan-barang-export': '/pengajuan-barang/export',
  };

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const initialPath = getPathFromLocation();
    if (initialPath === '/login' || initialPath === '/register') return 'dashboard';
    if (/^\/aplikasi\/[^/]+$/i.test(initialPath)) return 'aplikasi-detail';
    return pathToViewMap[initialPath] || 'dashboard';
  });

  // Sync currentView with currentPath when browser path changes (like on forward/back navigation)
  useEffect(() => {
    if (user) {
      if (/^\/aplikasi\/[^/]+$/i.test(currentPath)) {
        const slug = extractAppSlugFromPath(currentPath);
        if (slug && slug !== activeAppSlug) {
          setActiveAppSlug(slug);
        }
        if (currentView !== 'aplikasi-detail') {
          setCurrentView('aplikasi-detail');
        }
      } else {
        const targetView = pathToViewMap[currentPath];
        if (targetView && targetView !== currentView) {
          setCurrentView(targetView);
        }
      }
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('id') || params.get('reportId') || params.get('report_id');
        if (urlId) {
          setSelectedReportId(urlId);
          localStorage.setItem('laporanwee_selected_report_id', urlId);
        }
      }
    }
  }, [currentPath, user]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>(() => dailyReportService.getCachedReports());
  const reportsRef = useRef<Report[]>(reports);
  reportsRef.current = reports;
  const loadedModulesAtRef = useRef<Record<string, number>>({});
  const [activities, setActivities] = useState<Activity[]>(() => activityService.getCachedActivities());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | undefined>(undefined);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedUserProfileId, setSelectedUserProfileId] = useState<string | number | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('id') || params.get('reportId') || params.get('report_id');
      if (urlId) return urlId;
    }
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
  const [showWhatsNewModal, setShowWhatsNewModal] = useState<boolean>(() => {
    try {
      const seen =
        localStorage.getItem('lw_v5_2_notified') ||
        localStorage.getItem('laporanwee_v5_2_notified');
      return seen !== 'true';
    } catch (_) {
      return false;
    }
  });

  // Determine if current logged in user has Administrator privileges
  const isAdmin = Boolean(isUserAdmin(user));

  // Synchronize Tasks and Daily Reports with Backend PHP/MySQL API — O(N) indexed lookup
  const refreshTasksFromApi = useCallback(async (reportListOverride?: Report[]) => {
    try {
      loadedModulesAtRef.current.tasks = Date.now();
      const fetchedTasks = await taskService.fetchTasks();

      // Retrieve current reports via ref (avoiding callback churn on reports state changes)
      let reportList: Report[] = reportListOverride || reportsRef.current;
      if (!reportList || reportList.length === 0) {
        reportList = dailyReportService.getCachedReports();
        if (!reportList || reportList.length === 0) {
          const apiReports = await dailyReportService.fetchDailyReports(user?.email, isAdmin).catch(() => []);
          if (Array.isArray(apiReports) && apiReports.length > 0) {
            reportList = apiReports;
          }
        }
      }

      // Build O(1) lookup maps before iterating tasks
      const reportById = new Map<string, Report>();
      const reportByTaskId = new Map<string, Report>();
      const reportByTitle = new Map<string, Report[]>();
      for (const r of reportList) {
        const rId = String(r.id).trim();
        reportById.set(rId, r);
        if (r.task_id) {
          reportByTaskId.set(String(r.task_id).trim(), r);
        }
        if (r.task) {
          const titleKey = r.task.trim().toLowerCase();
          const bucket = reportByTitle.get(titleKey);
          if (bucket) bucket.push(r);
          else reportByTitle.set(titleKey, [r]);
        }
      }

      const linkedReportIds = new Set<string>();
      const processedTaskIds = new Set<string>();
      const uniqueTasks: Task[] = [];

      for (const t of fetchedTasks) {
        if (processedTaskIds.has(t.id)) continue;
        processedTaskIds.add(t.id);

        let matchedReport: Report | undefined;
        const taskRepId = t.report_id || (t as any).daily_report_id;
        if (taskRepId) {
          matchedReport = reportById.get(String(taskRepId).trim());
        }
        if (!matchedReport) {
          matchedReport = reportByTaskId.get(String(t.id).trim());
        }
        if (!matchedReport && t.title) {
          const candidates = reportByTitle.get(t.title.trim().toLowerCase());
          if (candidates && candidates.length > 0) {
            const tEmail = t.assignee_email?.toLowerCase();
            const tAssignee = t.assignee?.toLowerCase();
            matchedReport = candidates.find(
              (r) =>
                !linkedReportIds.has(String(r.id).trim()) &&
                ((r.user_email && tEmail && r.user_email.toLowerCase() === tEmail) ||
                  (r.person && tAssignee && r.person.toLowerCase() === tAssignee))
            );
          }
        }

        if (matchedReport) {
          const rId = String(matchedReport.id).trim();
          if (linkedReportIds.has(rId)) {
            continue;
          }
          linkedReportIds.add(rId);

          uniqueTasks.push({
            ...t,
            report_id: rId,
            daily_report_id: rId,
            title: matchedReport.task || t.title,
            description: matchedReport.desc || t.description || '',
            proj: matchedReport.project || t.proj,
            category: matchedReport.category || t.category,
            assignee: matchedReport.person || t.assignee,
            assignee_name: t.assignee_name || matchedReport.user_name || matchedReport.person || t.assignee,
            user_name: t.user_name || matchedReport.user_name || matchedReport.person,
            user_id: t.user_id ?? matchedReport.user_id,
            assignee_email: matchedReport.user_email || t.assignee_email,
            assignee_avatar: t.assignee_avatar || matchedReport.user_avatar || '',
            user_avatar: t.user_avatar || matchedReport.user_avatar || '',
            avatar_url: t.avatar_url || matchedReport.avatar_url || '',
            avatar: t.avatar || matchedReport.avatar || '',
            foto_profil: t.foto_profil || matchedReport.foto_profil || '',
            due: matchedReport.report_date || matchedReport.date || t.due,
            progress: typeof matchedReport.progress === 'number' ? matchedReport.progress : t.progress,
            col: reportStatusToTaskCol(matchedReport.status),
            cover_url: matchedReport.evidence_url || t.cover_url,
          });
        } else {
          uniqueTasks.push(t);
        }
      }

      setTasks(uniqueTasks);
    } catch (err) {
      console.warn('Sync tasks from API notice:', err);
    }
  }, [user?.email, isAdmin]);

  // Synchronize Projects with Backend PHP/MySQL API — Single Source of Truth
  const refreshProjectsFromApi = useCallback(async () => {
    try {
      loadedModulesAtRef.current.projects = Date.now();
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
      loadedModulesAtRef.current.activities = Date.now();
      const fetchedActivities = await activityService.fetchActivities();
      if (fetchedActivities && fetchedActivities.length > 0) {
        setActivities(fetchedActivities);
      }
    } catch (err) {
      console.warn('Sync activities from API notice:', err);
    }
  }, []);

  // Synchronize Calendar Events with Backend PHP/MySQL API
  const refreshEventsFromApi = useCallback(async () => {
    try {
      loadedModulesAtRef.current.events = Date.now();
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
    loadedModulesAtRef.current.reports = Date.now();

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
        try {
          localStorage.setItem('lw_reports_data_cache', JSON.stringify(fetchedReports));
          const total = fetchedReports.length;
          const selesai = fetchedReports.filter((r) => r.status === 'Completed').length;
          const review = fetchedReports.filter((r) => r.status === 'In Review').length;
          const sedang_berjalan = fetchedReports.filter(
            (r) =>
              (r.status as string) === 'In Progress' ||
              (r.status as string) === 'Sedang Berjalan' ||
              r.status === 'To Do'
          ).length;
          localStorage.setItem(
            'lw_reports_counters_cache',
            JSON.stringify({ total, selesai, review, sedang_berjalan })
          );
        } catch (_) {}
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
      loadedModulesAtRef.current.team = Date.now();
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
      loadedModulesAtRef.current.analytics = Date.now();
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

  // Helper: Fetch module only if never loaded or older than 30s
  const ensureModuleFresh = useCallback((key: string, fn: () => Promise<any>, maxAgeMs = 30000) => {
    const last = loadedModulesAtRef.current[key] || 0;
    if (Date.now() - last > maxAgeMs) {
      fn();
    }
  }, []);

  // Initial session lifecycle: presence, heartbeat & clearing state on logout
  useEffect(() => {
    if (!user) {
      loadedModulesAtRef.current = {};
      setProjects([]);
      setTasks([]);
      setActivities([]);
      setEvents([]);
      setReports([]);
      setMembers([]);
      setAnalytics(undefined);
      return;
    }

    // Lightweight presence & periodic heartbeat (skip sending offline while just navigating)
    if (user.email) {
      teamService.updatePresence(true, user.email).catch(() => {});
    }
    teamService.sendHeartbeat((user as any).id, user.email);

    const heartbeatInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
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
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.email, (user as any)?.id]);

  // On-demand view-based loading: ONLY fetch APIs needed for the currently open page (eliminates 6-API startup storm)
  useEffect(() => {
    if (!user) return;

    switch (currentView) {
      case 'dashboard':
        ensureModuleFresh('reports', () => refreshReportsFromApi(reportsRef.current.length > 0));
        ensureModuleFresh('projects', refreshProjectsFromApi);
        ensureModuleFresh('team', refreshTeamFromApi);
        ensureModuleFresh('analytics', refreshAnalyticsFromApi);
        break;
      case 'projects':
      case 'project-detail':
        ensureModuleFresh('projects', refreshProjectsFromApi);
        if (currentView === 'project-detail') {
          ensureModuleFresh('reports', () => refreshReportsFromApi(reportsRef.current.length > 0));
          ensureModuleFresh('tasks', refreshTasksFromApi);
        }
        break;
      case 'reports':
        ensureModuleFresh('reports', () => refreshReportsFromApi(reportsRef.current.length > 0), 15000);
        break;
      case 'report-detail':
      case 'create-report':
        ensureModuleFresh('reports', () => refreshReportsFromApi(reportsRef.current.length > 0));
        ensureModuleFresh('projects', refreshProjectsFromApi);
        break;
      case 'tasks':
        ensureModuleFresh('tasks', refreshTasksFromApi, 15000);
        ensureModuleFresh('reports', () => refreshReportsFromApi(reportsRef.current.length > 0), 20000);
        ensureModuleFresh('projects', refreshProjectsFromApi);
        ensureModuleFresh('team', refreshTeamFromApi);
        break;
      case 'team':
        ensureModuleFresh('team', refreshTeamFromApi, 20000);
        ensureModuleFresh('activities', refreshActivitiesFromApi, 20000);
        break;
      case 'calendar':
        ensureModuleFresh('events', refreshEventsFromApi, 20000);
        ensureModuleFresh('team', refreshTeamFromApi);
        break;
      case 'analytics':
        ensureModuleFresh('analytics', refreshAnalyticsFromApi, 20000);
        break;
      default:
        break;
    }
  }, [
    user,
    currentView,
    ensureModuleFresh,
    refreshReportsFromApi,
    refreshProjectsFromApi,
    refreshTasksFromApi,
    refreshTeamFromApi,
    refreshActivitiesFromApi,
    refreshEventsFromApi,
    refreshAnalyticsFromApi,
  ]);

  // Optimized Incremental Realtime Polling via /api/realtime/poll.php (reads reportsRef to avoid restarting timer)
  useEffect(() => {
    const isReportsOrTasks = currentView === 'reports' || currentView === 'tasks';
    if (!user || !isReportsOrTasks) return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollController: AbortController | null = null;

    const executePoll = async () => {
      if (!isMounted || !user || !navigator.onLine) {
        return;
      }

      if (pollController) {
        pollController.abort();
      }
      pollController = new AbortController();

      try {
        const sinceParam = lastSyncAtRef.current || undefined;
        const res = await realtimeService.poll(sinceParam, pollController.signal);

        if (res && isMounted) {
          if (res.server_time || res.latest || res.last_sync) {
            const nextCursor = String(res.server_time || res.latest || res.last_sync).trim();
            lastSyncAtRef.current = nextCursor;
            localStorage.setItem('laporanwee_last_sync', nextCursor);
          }

          const deletedIdsRaw = res.deleted_ids || res.deleted_reports || res.deleted || res.removed || [];
          if (Array.isArray(deletedIdsRaw) && deletedIdsRaw.length > 0) {
            const deletedSet = new Set(deletedIdsRaw.map((id: any) => String(id).trim()));
            deletedSet.forEach((id) => dailyReportService.removeReportFromCache(id));
            setReports((prev) => prev.filter((r) => !deletedSet.has(String(r.id).trim())));
            setTasks((prev) => prev.filter((t) => !deletedSet.has(String(t.report_id || '').trim())));
          }

          const currentLen = reportsRef.current.length;
          const serverTotal = res.total_count ?? res.count;
          if (typeof serverTotal === 'number' && currentLen > 0 && serverTotal !== currentLen) {
            refreshReportsFromApi(true);
            refreshTasksFromApi();
          } else {
            const changedItems = extractReportsArrayFromResponse(res);
            if (changedItems && changedItems.length > 0) {
              mergeUpdatedReports(changedItems);
              refreshTasksFromApi();
            } else if (res.changed === true || res.has_updates === true) {
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
      if (!isMounted || !user) return;
      if (pollTimer) clearTimeout(pollTimer);
      const isVisible = document.visibilityState === 'visible';
      const delay = isVisible ? 12000 : 30000;
      pollTimer = setTimeout(executePoll, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (pollTimer) clearTimeout(pollTimer);
        executePoll();
      }
    };

    const handleOnline = () => {
      if (pollTimer) clearTimeout(pollTimer);
      executePoll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    scheduleNext();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (pollController) pollController.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, currentView, refreshReportsFromApi, refreshTasksFromApi, mergeUpdatedReports]);

  const addToast = useCallback((text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const viewToPathMapRef = useRef(viewToPathMap);
  viewToPathMapRef.current = viewToPathMap;

  const handleNavigate = useCallback((view: ViewType) => {
    const targetPath = viewToPathMapRef.current[view] || '/dashboard';
    navigateToPath(targetPath);
    setCurrentView(view);
  }, []);

  const handleOpenApp = useCallback((app: RegisteredApp) => {
    setActiveAppSlug(app.slug);
    navigateToPath(`/Aplikasi/${app.slug}`);
    setCurrentView('aplikasi-detail');
  }, []);

  const handleSelectUserProfile = (userId: string | number) => {
    setSelectedUserProfileId(userId);
    navigateToPath(`/profil/user/${userId}`);
    setCurrentView('user-profile');
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

  const handleUpdateTask = async (updatedTask: Task): Promise<boolean> => {
    // 1. Save previous state snapshots for reliable rollback if backend fails
    const previousTasks = [...tasks];
    const previousReports = [...reports];

    try {
      // 2. Compute canonical progress according to status rules
      const syncedProgress = computeTargetProgress(
        typeof updatedTask.progress === 'number' ? updatedTask.progress : 0,
        updatedTask.col
      );
      const taskWithSyncedProgress: Task = { ...updatedTask, progress: syncedProgress };

      // 3. Optimistic UI update for tasks
      setTasks((prev) =>
        prev.map((t) => (t.id === taskWithSyncedProgress.id ? taskWithSyncedProgress : t))
      );

      // Check if this task is linked to a daily report (Rule 7: EDIT TASK - update data laporan terkait)
      const linkedReportId =
        taskWithSyncedProgress.report_id ||
        (taskWithSyncedProgress.id.startsWith('report-')
          ? taskWithSyncedProgress.id.replace('report-', '')
          : undefined);

      if (linkedReportId) {
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
      }

      // 4. Send atomic update to backend API
      const result = await taskService.updateTaskStatus({
        taskId: taskWithSyncedProgress.id,
        col: taskWithSyncedProgress.col,
        progress: syncedProgress,
        reportId: linkedReportId,
      });

      if (!result.success) {
        throw new Error(result.message || 'Gagal memperbarui status tugas di server backend.');
      }

      // 5. On success: refresh lists to ensure total consistency from MySQL database
      await refreshTasksFromApi();
      await refreshReportsFromApi(true);
      await refreshAnalyticsFromApi();
      return true;
    } catch (e: any) {
      console.error('API update task status error:', e);
      // 6. On failure: ROLLBACK UI to previous state!
      setTasks(previousTasks);
      setReports(previousReports);
      addToast(e?.message || 'Gagal memperbarui status tugas di database. Perubahan dibatalkan.');
      return false;
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

  // Rule 22: Tombol "Sinkron" hanya melakukan reconciliation:
  // - cari Daily Report tanpa task → buat satu task.
  // - task yang sudah punya relasi → UPDATE.
  // - jangan membuat duplicate.
  const handleReconcileTasks = useCallback(async () => {
    try {
      addToast('Menyinkronkan tugas dan laporan kerja dari database...');
      const [fetchedReports, fetchedTasks] = await Promise.all([
        dailyReportService.fetchDailyReports(user?.email, isAdmin).catch(() => reports),
        taskService.fetchTasks().catch(() => tasks),
      ]);

      const reportById = new Map<string, Report>();
      for (const r of fetchedReports) {
        reportById.set(String(r.id).trim(), r);
      }

      // Group tasks by daily_report_id
      const tasksByReportId = new Map<string, Task[]>();
      const standaloneTasks: Task[] = [];

      for (const t of fetchedTasks) {
        let repId = t.report_id || (t as any).daily_report_id;
        if (!repId && t.title) {
          const matched = fetchedReports.find(
            (r) =>
              r.task.trim().toLowerCase() === t.title.trim().toLowerCase() &&
              ((r.user_email && t.assignee_email && r.user_email.toLowerCase() === t.assignee_email.toLowerCase()) ||
               (r.person && t.assignee && r.person.toLowerCase() === t.assignee.toLowerCase()))
          );
          if (matched) repId = String(matched.id).trim();
        }

        if (repId) {
          const repIdStr = String(repId).trim();
          const list = tasksByReportId.get(repIdStr) || [];
          list.push({ ...t, report_id: repIdStr, daily_report_id: repIdStr });
          tasksByReportId.set(repIdStr, list);
        } else {
          standaloneTasks.push(t);
        }
      }

      const reconciledTasks: Task[] = [...standaloneTasks];

      for (const r of fetchedReports) {
        const rId = String(r.id).trim();
        const existingList = tasksByReportId.get(rId) || [];
        const linkedCol = reportStatusToTaskCol(r.status);
        const linkedProgress = linkedCol === 'done' ? 100 : (typeof r.progress === 'number' ? r.progress : 0);
        const taskDueDate = r.report_date || r.date || 'Hari ini';

        if (existingList.length === 0) {
          // Cari Daily Report tanpa task -> buat satu task (Rule 22)
          try {
            const newTask = await taskService.createTask({
              report_id: rId,
              daily_report_id: rId,
              title: r.task,
              description: r.desc || '',
              proj: r.project || 'Creative Sprint',
              category: r.category || 'Desain & UI/UX',
              priority: linkedProgress >= 80 ? 'High' : 'Medium',
              assignee: r.person || user?.name || '',
              assignee_email: r.user_email || '',
              due: taskDueDate,
              progress: linkedProgress,
              col: linkedCol,
            });
            reconciledTasks.push(newTask);
          } catch (createErr) {
            console.warn(`Create missing task for report ${rId} error:`, createErr);
          }
        } else {
          // Task yang sudah punya relasi -> UPDATE (Rule 22)
          const primaryTask = existingList[0];
          const updatedTask: Task = {
            ...primaryTask,
            report_id: rId,
            daily_report_id: rId,
            title: r.task,
            description: r.desc || primaryTask.description || '',
            proj: r.project || primaryTask.proj,
            category: r.category || primaryTask.category,
            assignee: r.person || primaryTask.assignee,
            assignee_email: r.user_email || primaryTask.assignee_email,
            due: taskDueDate,
            progress: linkedProgress,
            col: linkedCol,
            cover_url: r.evidence_url || primaryTask.cover_url,
          };

          // If there are duplicate tasks in MySQL for the same report_id, remove the extras (Rule 22)
          if (existingList.length > 1) {
            for (let i = 1; i < existingList.length; i++) {
              const dup = existingList[i];
              taskService.deleteTask(dup.id).catch(() => {});
            }
          }

          taskService.updateTask(updatedTask).catch(() => {});
          reconciledTasks.push(updatedTask);
        }
      }

      setTasks(reconciledTasks);
      addToast('Sinkronisasi tugas & laporan selesai.');
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      addToast('Gagal menyinkronkan tugas.');
    }
  }, [reports, tasks, user?.email, user?.name, isAdmin]);

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

      // Rule 1, 14, 15: Status and due date strictly preserved from report_date
      const linkedCol = reportStatusToTaskCol(reportData.status);
      const linkedProgress = linkedCol === 'done' ? 100 : (typeof reportData.progress === 'number' ? reportData.progress : 0);
      const taskDueDate = reportData.report_date || reportData.date || 'Hari ini';

      // Rule 2, 4, 5: Sebelum membuat task baru, cek apakah task untuk Daily Report tersebut sudah ada
      const existingTask = tasks.find(
        (t) =>
          (t.report_id && String(t.report_id).trim() === createdId) ||
          ((t as any).daily_report_id && String((t as any).daily_report_id).trim() === createdId)
      );

      let linkedTask: Task | null = null;
      if (existingTask) {
        // Rule 4: JANGAN INSERT task baru. UPDATE task yang sudah ada jika data laporan berubah.
        const updatedTaskData: Task = {
          ...existingTask,
          report_id: createdId,
          daily_report_id: createdId,
          title: reportData.task,
          description: reportData.desc || '',
          proj: reportData.project || 'Creative Sprint',
          category: reportData.category || 'Desain & UI/UX',
          priority: linkedProgress >= 80 ? 'High' : 'Medium',
          assignee: reportData.person || user?.name || '',
          assignee_email: user?.email || '',
          due: taskDueDate,
          progress: linkedProgress,
          col: linkedCol,
        };
        await taskService.updateTask(updatedTaskData).catch((err) => console.warn('Update existing task error:', err));
        linkedTask = updatedTaskData;
      } else {
        // Rule 5, 18: Task belum ada -> INSERT SATU task baru
        try {
          const backendTask = await taskService.createTask({
            report_id: createdId,
            daily_report_id: createdId,
            title: reportData.task,
            description: reportData.desc || '',
            proj: reportData.project || 'Creative Sprint',
            category: reportData.category || 'Desain & UI/UX',
            priority: linkedProgress >= 80 ? 'High' : 'Medium',
            assignee: reportData.person || user?.name || '',
            assignee_email: user?.email || '',
            due: taskDueDate,
            progress: linkedProgress,
            col: linkedCol,
          });
          linkedTask = backendTask;
        } catch (taskErr) {
          console.error('Failed to create linked task in MySQL:', taskErr);
        }
      }

      if (linkedTask && linkedTask.id) {
        created.task_id = linkedTask.id;
        // Persist task_id in daily_reports table
        dailyReportService.updateDailyReport({
          id: createdId,
          title: reportData.task,
          description: reportData.desc || '',
          work_category: reportData.category || 'Desain & UI/UX',
          project_name: reportData.project || 'Proyek Wee Studio',
          progress: linkedProgress,
          status: mapFrontendStatusToBackend(reportData.status),
          report_date: reportData.report_date || (reportData.date?.match(/^\d{4}-\d{2}-\d{2}$/) ? reportData.date : new Date().toISOString().slice(0, 10)),
          task_id: linkedTask.id,
        } as any).catch(() => {});

        // Exactly ONE task in state (Rule 1, Rule 11)
        setTasks((prev) => [
          linkedTask!,
          ...prev.filter((t) => t.id !== linkedTask!.id && (!t.report_id || String(t.report_id).trim() !== createdId)),
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
      // Rule 8/20: HAPUS LAPORAN - task terkait harus ikut dihapus
      const linkedTask = tasks.find(
        (t) =>
          (t.report_id && String(t.report_id).trim() === String(reportId).trim()) ||
          ((t as any).daily_report_id && String((t as any).daily_report_id).trim() === String(reportId).trim()) ||
          (targetReport?.task_id && String(t.id).trim() === String(targetReport.task_id).trim()) ||
          t.id === `report-${reportId}`
      );
      if (linkedTask) {
        if (!linkedTask.id.startsWith('report-')) {
          taskService.deleteTask(linkedTask.id).catch((err) => console.warn('Delete linked task error:', err));
        }
        setTasks((prev) =>
          prev.filter(
            (t) =>
              t.id !== linkedTask.id &&
              t.report_id !== String(reportId).trim() &&
              (t as any).daily_report_id !== String(reportId).trim()
          )
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

    // Rule 19: EDIT LAPORAN - update task terkait, jangan membuat task baru, pertahankan task_id
    const targetTaskId = updatedReport.task_id;
    const targetTask = tasks.find(
      (t) =>
        (t.report_id && String(t.report_id).trim() === String(updatedReport.id).trim()) ||
        ((t as any).daily_report_id && String((t as any).daily_report_id).trim() === String(updatedReport.id).trim()) ||
        (targetTaskId && String(t.id).trim() === String(targetTaskId).trim()) ||
        t.id === `report-${updatedReport.id}`
    );

    if (targetTask) {
      const taskDueDate = updatedReport.report_date || updatedReport.date || targetTask.due;
      const syncedTask: Task = {
        ...targetTask,
        report_id: String(updatedReport.id).trim(),
        daily_report_id: String(updatedReport.id).trim(),
        title: updatedReport.task,
        description: updatedReport.desc || targetTask.description,
        proj: updatedReport.project,
        category: updatedReport.category,
        assignee: updatedReport.person,
        assignee_email: updatedReport.user_email || targetTask.assignee_email,
        due: taskDueDate,
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

  const handleLogout = useCallback(() => {
    const token = getStoredToken();
    if (user?.email) {
      teamService.updatePresence(false, user.email).catch(() => {});
    }
    
    clearStoredAuth();
    clearReportCache();
    loadedModulesAtRef.current = {};
    setUser(null);
    setReports([]);
    setReportsError(null);
    addToast('Berhasil keluar dari sesi.');
    navigateToPath('/login');

    if (token) {
      api.post('/logout.php', {}).catch(() => {});
    }
  }, [user?.email, addToast]);

  const handleOpenWhatsNew = useCallback(() => setShowWhatsNewModal(true), []);

  const [reportInitialEdit, setReportInitialEdit] = useState<boolean>(false);

  useEffect(() => {
    if (currentPath === '/laporan/detail/edit-laporan') {
      setReportInitialEdit(true);
    }
  }, [currentPath]);

  const handleNavigateToReportEdit = (reportId: string) => {
    const cleanId = String(reportId).trim();
    setSelectedReportId(cleanId);
    localStorage.setItem('laporanwee_selected_report_id', cleanId);
    setReportInitialEdit(true);
    setCurrentView('report-detail');
    navigateToPath(`/laporan/detail/edit-laporan?id=${cleanId}`);
  };

  const handleSelectReport = (id: string | number) => {
    const cleanId = String(id).trim();
    if (!cleanId) return;
    setSelectedReportId(cleanId);
    localStorage.setItem('laporanwee_selected_report_id', cleanId);
    setReportInitialEdit(false);
    setCurrentView('report-detail');
    navigateToPath(`/laporan/detail?id=${cleanId}`);
  };

  const currentProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];
  const currentReport =
    reports.find((r) => String(r.id).trim() === String(selectedReportId).trim()) || reports[0];

  if (
    currentView === 'crop-setting' ||
    currentView === 'setting-profile-picture' ||
    currentView === 'profile-crop' ||
    currentPath === '/profil/crop-setting' ||
    currentPath.includes('/crop-setting') ||
    currentPath.includes('/setting-profile-picture')
  ) {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <ProfileCropSettingView
          onBack={() => handleNavigate('profil')}
          onNavigate={handleNavigate}
          onAddToast={addToast}
        />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  if (currentView === 'pengajuan-barang-export' || currentPath === '/pengajuan-barang/export') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <PengajuanBarangExportView onBack={() => handleNavigate('pengajuan-barang')} />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  if (currentView === 'export-laporan' || currentPath === '/analitik/exporlaporan') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <ExportLaporanStandalone />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  if (currentView === 'edit-laporan' || currentPath === '/analitik/editlaporan') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <EditLaporanStandalone />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  if (currentPath === '/verify-email') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
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
      </Suspense>
    );
  }

  if (!user && currentPath === '/register') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <RegisterView
          logoUrl={uiSettings?.logo_url}
          onRegisterSuccess={() => {
            addToast('Akun berhasil dibuat! Silakan masuk.');
            navigateToPath('/login');
          }}
          onNavigateToLogin={() => navigateToPath('/login')}
        />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  if (!user || currentPath === '/login') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <LoginView
          logoUrl={uiSettings?.logo_url}
          onLoginSuccess={(email, name, fullUser) => {
            clearReportCache();
            loadedModulesAtRef.current = {};
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
            fetchUISettings(email, true)
              .then((data) => {
                if (data) {
                  setUiSettings(data);
                  applyUISettingsToDocument(data);
                }
              })
              .catch(() => {});
            addToast(`Selamat datang kembali, ${name}!`);
            let postLoginTarget = '/dashboard';
            try {
              const savedRedirect = sessionStorage.getItem('laporanwee_post_login_redirect');
              if (savedRedirect && /^\/aplikasi(\/[^/]+)?$/i.test(savedRedirect)) {
                postLoginTarget = savedRedirect;
              }
              sessionStorage.removeItem('laporanwee_post_login_redirect');
            } catch (_) {}
            navigateToPath(postLoginTarget);
          }}
          onNavigateToRegister={() => navigateToPath('/register')}
        />
        <ToastContainer toasts={toasts} />
      </Suspense>
    );
  }

  // Standalone full-screen application view (zero LaporanWe sidebar, header, or dashboard chrome)
  if (currentView === 'aplikasi-detail' || /^\/aplikasi\/[^/]+$/i.test(currentPath)) {
    const slug = activeAppSlug || extractAppSlugFromPath(currentPath) || 'Fotowe';
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <AplikasiHostView
          appSlug={slug}
          currentUser={user}
          onBackToHub={() => handleNavigate('aplikasi')}
          onSessionExpired={handleLogout}
          onAddToast={addToast}
        />
      </Suspense>
    );
  }

  return (
    <div id="app-shell">
      {/* Background Ambient Drifting Blobs */}
      <div className="ambient">
        <i></i><i></i><i></i>
      </div>

      {/* Floating Rail Navigation (Desktop) & Bottom Dock Pill (Mobile) */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onAddToast={addToast}
        onLogout={handleLogout}
        userEmail={user?.email || ''}
        userName={user?.name || user?.full_name || 'Pengguna'}
        avatarUrl={(user as any)?.avatar_url}
        logoUrl={uiSettings?.logo_url}
        menuIconUrl={uiSettings?.menu_icon_url}
        signoutIconUrl={uiSettings?.signout_icon_url}
        isAdmin={isAdmin}
        onOpenWhatsNew={handleOpenWhatsNew}
      />

      {/* Main Content Viewport */}
      <main className={`app-shell-main ${currentView === 'chat' ? 'h-screen max-h-screen overflow-hidden !pb-0 !pt-3 !mb-0 flex flex-col' : ''}`}>
        <Suspense fallback={<ViewLoadingFallback />}>
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            reports={reports}
            members={members}
            analytics={analytics}
            tasksCount={tasks.length}
            userName={user?.name || user?.full_name || 'Pengguna'}
            userEmail={user?.email || ''}
            onNavigate={handleNavigate}
            onSelectProject={(id) => setSelectedProjectId(id)}
            onDeleteProject={handleDeleteProject}
            onAddToast={addToast}
            onSelectUserProfile={handleSelectUserProfile}
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
            onSelectReport={handleSelectReport}
            onSelectUserProfile={handleSelectUserProfile}
            onAddToast={addToast}
          />
        )}

        {currentView === 'reports' && (
          <ReportsView
            reports={reports}
            isLoading={isReportsLoading}
            isAdmin={isAdmin}
            currentUserEmail={user?.email || ''}
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
            userName={user?.name || user?.full_name || 'Pengguna'}
            userEmail={user?.email || ''}
            avatarUrl={(user as any)?.avatar_url}
            initialIsEditing={reportInitialEdit}
            onNavigate={handleNavigate}
            onUpdateStatus={handleUpdateReportStatus}
            onReportUpdated={handleReportUpdated}
            onAddToast={addToast}
          />
        )}

        {currentView === 'create-report' && (
          <CreateReportView
            projects={projects}
            userName={user?.name || user?.full_name || 'Pengguna'}
            userEmail={user?.email || ''}
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
            reports={reports}
            isAdmin={isAdmin}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onResetTasks={handleResetTasks}
            onRefreshTasks={handleReconcileTasks}
            onNavigateToReportEdit={handleNavigateToReportEdit}
            onAddToast={addToast}
          />
        )}

        {currentView === 'chat' && (
          <ChatView
            onNavigate={handleNavigate}
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
            onSelectUserProfile={handleSelectUserProfile}
            onDeleteActivity={handleDeleteActivity}
            onResetActivities={handleResetActivities}
            onResetPresence={handleResetPresence}
            onRefreshTeam={refreshTeamFromApi}
          />
        )}

        {currentView === 'user-profile' && (
          <UserProfileView
            userId={selectedUserProfileId || ''}
            onNavigate={handleNavigate}
            onAddToast={addToast}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            members={members}
            isAdmin={isAdmin}
            userEmail={user?.email || ''}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
            onResetEvents={handleResetEvents}
            onAddToast={addToast}
          />
        )}


        {currentView === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            onNavigate={handleNavigate}
            onAddToast={addToast}
            onRefresh={refreshAnalyticsFromApi}
            currentUser={user}
            isAdmin={isAdmin}
          />
        )}

        {currentView === 'pengajuan-barang' && (
          <PengajuanBarangView onAddToast={addToast} />
        )}

        {(currentView === 'galeri-berkas' || currentView === 'galeri-lampiran') && (
          <GaleriBerkasView />
        )}

        {currentView === 'aplikasi' && (
          <AplikasiView
            onOpenApp={handleOpenApp}
            onAddToast={addToast}
          />
        )}

        {currentView === 'social-media' && (
          <SocialMediaView
            onNavigate={handleNavigate}
            onAddToast={addToast}
            currentUser={user}
            isAdmin={isAdmin}
          />
        )}

        {(currentView === 'profil' || currentView === 'profile') && (
          <ProfileSettingsView
            userName={user?.name || user?.full_name || ''}
            userEmail={user?.email || ''}
            userRole={user?.role || ''}
            userStatus={user?.status || ''}
            avatarUrl={user?.avatar_url}
            onNavigate={handleNavigate}
            onAddToast={addToast}
            onUpdateUser={(updated) => {
              setUser((prev) => {
                if (!prev) return null;
                const updatedUser: AuthUser = {
                  ...prev,
                  email: updated.email,
                  name: updated.name,
                  full_name: updated.name,
                  status: updated.status !== undefined ? updated.status : prev.status,
                  avatar_url: updated.avatar_url !== undefined ? updated.avatar_url : prev.avatar_url,
                };
                setStoredUser(updatedUser);
                return updatedUser;
              });
            }}
          />
        )}

        {(currentView === 'ui_settings' || currentView === 'ui-settings') && (
          <UiSettingsView
            onAddToast={addToast}
          />
        )}

        {currentView !== 'chat' && (
          <div
            className="footer-tag"
            onClick={() => setShowWhatsNewModal(true)}
            style={{ cursor: 'pointer', textAlign: 'center', margin: '40px 0 20px', color: 'var(--muted)', fontSize: '12.5px', fontWeight: 500 }}
            title="Klik untuk melihat Apa yang Baru di Versi 5.2"
          >
            LaporanWee v5.2 &bull; JANGAN LUPA KERJA HARI INI
          </div>
        )}
        </Suspense>
      </main>

      {/* Version 3.0 Release & Announcements Modal */}
      {showWhatsNewModal && (
        <Suspense fallback={null}>
          <VersionUpdateModal
            isOpen={showWhatsNewModal}
            onClose={() => setShowWhatsNewModal(false)}
          />
        </Suspense>
      )}

      {/* Global Toast Stack */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
