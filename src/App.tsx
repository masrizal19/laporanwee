import React, { useState, useEffect } from 'react';
import {
  ViewType,
  Project,
  Task,
  Report,
  Activity,
  CalendarEvent,
  TeamMember,
  ToastMessage,
} from './types';
import {
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_REPORTS,
  INITIAL_ACTIVITIES,
  INITIAL_EVENTS,
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

// Auth views
import { LoginView } from './views/LoginView';
import { RegisterView } from './views/RegisterView';

export function App() {
  // 1. Session & Routing state
  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem('laporanwee_user');
    return saved ? JSON.parse(saved) : null;
  });

  const getPathFromLocation = (): string => {
    const hashPath = window.location.hash.replace('#', '');
    if (hashPath === '/login' || hashPath === '/register' || hashPath === '/dashboard') {
      return hashPath;
    }
    const path = window.location.pathname;
    if (path.endsWith('/login')) return '/login';
    if (path.endsWith('/register')) return '/register';
    if (path.endsWith('/dashboard')) return '/dashboard';
    return '/dashboard';
  };

  const [currentPath, setCurrentPath] = useState<string>(getPathFromLocation);

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

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [members] = useState<TeamMember[]>(INITIAL_MEMBERS);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('p1');
  const [selectedReportId, setSelectedReportId] = useState<string>('r1');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Projects CRUD
  const handleAddProject = (projectData: Omit<Project, 'id'>) => {
    const newId = `p_${Date.now()}`;
    const newProj: Project = { id: newId, ...projectData };
    setProjects((prev) => [newProj, ...prev]);

    // Add activity
    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        person: 'Rangga Arya',
        action: 'membuat proyek baru',
        quote: `"${projectData.name}"`,
        time: 'Baru saja',
        project: projectData.name,
        kind: 'Tasks',
        icon: 'folder',
      },
      ...prev,
    ]);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (selectedProjectId === projectId) {
      setSelectedProjectId(projects[0]?.id || '');
    }
  };

  // Tasks CRUD
  const handleAddTask = (taskData: Omit<Task, 'id'>) => {
    const newId = `t_${Date.now()}`;
    const newTask: Task = { id: newId, ...taskData };
    setTasks((prev) => [newTask, ...prev]);

    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        person: 'Rangga Arya',
        action: 'menambahkan tugas baru',
        quote: `"${taskData.title}"`,
        time: 'Baru saja',
        project: taskData.proj,
        kind: 'Tasks',
        icon: 'checksq',
      },
      ...prev,
    ]);
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

    // Add activity
    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        person: reportData.person,
        action: 'mengirim laporan kerja',
        quote: `"${reportData.task}"`,
        time: 'Baru saja',
        project: reportData.project,
        kind: 'Reports',
        icon: 'doc',
      },
      ...prev,
    ]);

    // Also bump project progress if project matches
    setProjects((prev) =>
      prev.map((p) => {
        if (
          p.name.toLowerCase() === reportData.project.toLowerCase() ||
          reportData.project.toLowerCase().includes(p.name.toLowerCase())
        ) {
          const newProg = Math.min(100, Math.max(p.progress, reportData.progress));
          return {
            ...p,
            progress: newProg,
            status: newProg === 100 ? 'Completed' : p.status,
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

  // Events CRUD
  const handleAddEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newId = `e_${Date.now()}`;
    const newEvent: CalendarEvent = { id: newId, ...eventData };
    setEvents((prev) => [...prev, newEvent]);
  };

  const handleLogout = () => {
    localStorage.removeItem('laporanwee_user');
    setUser(null);
    addToast('Berhasil keluar dari sesi.');
    navigateToPath('/login');
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
      />

      {/* Main Container */}
      <main>
        {currentView === 'dashboard' && (
          <DashboardView
            projects={projects}
            onNavigate={handleNavigate}
            onSelectProject={(id) => setSelectedProjectId(id)}
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
            onNavigate={handleNavigate}
            onAddToast={addToast}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            members={members}
            onAddEvent={handleAddEvent}
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
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            onNavigate={handleNavigate}
            onAddToast={addToast}
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
