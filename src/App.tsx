import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewType,
  Project,
  Task,
  Report,
  Activity,
  CalendarEvent,
  TeamMember,
  ToastMessage,
  UISettings,
} from './types';
import {
  INITIAL_TASKS,
  INITIAL_REPORTS,
  INITIAL_MEMBERS,
} from './data/initialData';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/Toast';

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
import { api, activityService, calendarService } from './utils/api';
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

  const getPathFromLocation = (): string => {
    const hashPath = window.location.hash.replace('#', '');
    const validPaths = [
      '/login',
      '/register',
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
    if (validPaths.includes(hashPath)) {
      return hashPath;
    }
    const path = window.location.pathname;
    for (const validPath of validPaths) {
      if (path.endsWith(validPath)) {
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
    setCurrentPath(path);
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
      if (currentPath !== '/register') {
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
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('laporanwee_local_tasks');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_TASKS;
  });
  const [reports, setReports] = useState<Report[]>(() => {
    try {
      const saved = localStorage.getItem('laporanwee_local_reports');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_REPORTS;
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members] = useState<TeamMember[]>(INITIAL_MEMBERS);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string>('r1');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Determine if current logged in user has Administrator privileges
  const isAdmin = Boolean(
    user?.email?.toLowerCase().includes('admin') ||
    user?.email === 'rizalstudios.backup01@gmail.com' ||
    user?.email === 'rizalsaragih498@gmail.com' ||
    (user as any)?.role === 'admin' ||
    (user as any)?.is_admin === true
  );

  // Synchronize Tasks and Reports with local storage
  useEffect(() => {
    try {
      localStorage.setItem('laporanwee_local_tasks', JSON.stringify(tasks));
    } catch (_) {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('laporanwee_local_reports', JSON.stringify(reports));
    } catch (_) {}
  }, [reports]);

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

  // Load all server-side global data when user is authenticated
  useEffect(() => {
    if (user) {
      refreshProjectsFromApi();
      refreshActivitiesFromApi();
      refreshEventsFromApi();
    } else {
      setProjects([]);
      setActivities([]);
      setEvents([]);
    }
  }, [user, refreshProjectsFromApi, refreshActivitiesFromApi, refreshEventsFromApi]);

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

  // Tasks CRUD
  const handleAddTask = (taskData: Omit<Task, 'id'>) => {
    const newId = `t_${Date.now()}`;
    const newTask: Task = { id: newId, ...taskData };
    setTasks((prev) => [newTask, ...prev]);

    // Log activity to backend MySQL API
    activityService.createActivity({
      title: 'menambahkan tugas baru',
      description: `"${taskData.title}" (${taskData.proj})`,
      activity_type: 'task',
      icon_type: 'checksq',
      user_name: user?.name || 'Admin',
      user_email: user?.email || '',
    }).then(() => refreshActivitiesFromApi()).catch(() => {});
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Reports CRUD
  const handleAddReport = (reportData: Omit<Report, 'id'>): string => {
    const newId = `r_${Date.now()}`;
    const newReport: Report = { id: newId, ...reportData };
    setReports((prev) => [newReport, ...prev]);

    // Log activity to backend MySQL API
    activityService.createActivity({
      title: 'mengirim laporan kerja',
      description: `"${reportData.task}" (${reportData.project})`,
      activity_type: 'report',
      icon_type: 'doc',
      user_name: reportData.person || user?.name || 'Tim LaporanWee',
      user_email: user?.email || '',
    }).then(() => refreshActivitiesFromApi()).catch(() => {});

    // Also bump project progress and update thumbnail/evidence if project matches
    setProjects((prev) =>
      prev.map((p) => {
        const matchesProject =
          p.name.toLowerCase() === reportData.project.toLowerCase() ||
          reportData.project.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(reportData.project.toLowerCase());

        if (matchesProject) {
          const newProg = Math.min(100, Math.max(p.progress, reportData.progress));
          const reportEvidence =
            reportData.evidence_urls && reportData.evidence_urls.length > 0
              ? reportData.evidence_urls
              : reportData.evidence_url
              ? [reportData.evidence_url]
              : [];

          const existingEvidence = p.evidence_urls || [];
          const combinedEvidence =
            reportEvidence.length > 0
              ? Array.from(new Set([...reportEvidence, ...existingEvidence]))
              : existingEvidence;

          return {
            ...p,
            progress: newProg,
            status: newProg === 100 ? 'Completed' : p.status,
            thumbnail_url: reportEvidence[0] || p.thumbnail_url,
            evidence_urls: combinedEvidence,
          };
        }
        return p;
      })
    );

    return newId;
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
          onLoginSuccess={(email, name) => {
            const loggedInUser = { email, name };
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
        logoUrl={uiSettings?.logo_url}
        menuIconUrl={uiSettings?.menu_icon_url}
        signoutIconUrl={uiSettings?.signout_icon_url}
      />

      {/* Main Container */}
      <main>
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
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
            onNavigate={handleNavigate}
            onSelectReport={(id) => setSelectedReportId(id)}
          />
        )}

        {currentView === 'report-detail' && currentReport && (
          <ReportDetailView
            report={currentReport}
            onNavigate={handleNavigate}
            onUpdateStatus={handleUpdateReportStatus}
            onAddToast={addToast}
          />
        )}

        {currentView === 'create-report' && (
          <CreateReportView
            projects={projects}
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
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
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
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            onNavigate={handleNavigate}
            onAddToast={addToast}
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
