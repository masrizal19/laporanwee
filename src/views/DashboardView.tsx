import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Report, TeamMember, AnalyticsSummary, ViewType } from '../types';
import { getUserFirstName } from '../utils/userUtils';

interface DashboardViewProps {
  projects: Project[];
  reports?: Report[];
  members?: TeamMember[];
  analytics?: AnalyticsSummary;
  tasksCount?: number;
  userName?: string;
  userEmail?: string;
  onNavigate: (view: ViewType) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onAddToast: (text: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  reports = [],
  members = [],
  analytics,
  tasksCount = 0,
  userName,
  userEmail,
  onNavigate,
  onSelectProject,
  onDeleteProject,
  onAddToast,
}) => {
  const [filterTab, setFilterTab] = useState<'Semua' | 'On-Track' | 'Berisiko'>('Semua');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dynamic dashboard state synced with backend
  const [dateLabel, setDateLabel] = useState('Rabu, 11 Mei');
  const [kpiActiveProjects, setKpiActiveProjects] = useState<number | string>(12);
  const [kpiOngoingTasks, setKpiOngoingTasks] = useState<number | string>(48);
  const [kpiCompletionRate, setKpiCompletionRate] = useState<number>(82);

  const [todoList, setTodoList] = useState([
    { id: '1', title: 'Review & umpan balik klien', subtitle: 'Redesain landing page', time: '22.00 – 23.45', done: true, assignees: [{ initial: 'Ri', bg: '#e3ddfa' }, { initial: 'Sa', bg: '#f6e6cf' }] },
    { id: '2', title: 'Susun laporan mingguan', subtitle: 'Divisi Kreatif', time: '10.00 – 11.00', done: false, assignees: [{ initial: 'Ri', bg: '#e3ddfa' }, { initial: 'Di', bg: '#e9f5b8' }] },
    { id: '3', title: 'Revisi kemasan Kopi Nusa', subtitle: 'Rebranding', time: '13.30 – 15.00', done: false, assignees: [{ initial: 'Sa', bg: '#f6e6cf' }, { initial: 'Ba', bg: '#d6ecdf' }] },
    { id: '4', title: 'Rapat sinkronisasi tim', subtitle: 'Google Meet', time: '16.00 – 16.30', done: false, assignees: [{ initial: 'Ba', bg: '#d6ecdf' }, { initial: 'Ti', bg: '#f1d8e4' }] },
  ]);

  // Sync dashboard data from backend API with 30s polling
  useEffect(() => {
    const syncDashboardData = async () => {
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        const adminEmail = localStorage.getItem('admin_email') || '';

        const res = await fetch('https://api-laporanwe.mkverse.my.id/api/dashboard/index.php', {
          headers: {
            'Authorization': 'Bearer ' + token,
            'X-Admin-Email': adminEmail,
            'Accept': 'application/json',
          },
        });
        const text = await res.text();
        let result: any = {};
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          return;
        }

        if (!result.success) return;

        if (result.header && result.header.date_label) {
          setDateLabel(result.header.date_label);
        }

        if (Array.isArray(result.running_tasks) && result.running_tasks.length > 0) {
          setTodoList(
            result.running_tasks.map((t: any) => ({
              id: String(t.id),
              title: t.title || '',
              subtitle: t.subtitle || t.desc || '',
              time: t.time || '10.00 – 11.00',
              done: Boolean(t.done),
              assignees: Array.isArray(t.assignees) ? t.assignees : [{ initial: 'Ri', bg: '#e3ddfa' }],
            }))
          );
        }

        if (result.kpi) {
          if (result.kpi.active_projects !== undefined) setKpiActiveProjects(result.kpi.active_projects);
          if (result.kpi.ongoing_tasks !== undefined) setKpiOngoingTasks(result.kpi.ongoing_tasks);
          if (result.kpi.completion_rate !== undefined) setKpiCompletionRate(Number(result.kpi.completion_rate));
        }
      } catch (err) {
        console.warn('Dashboard sync offline:', err);
      }
    };

    syncDashboardData();
    const intervalId = setInterval(syncDashboardData, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // 2-way toggle task handler with Optimistic UI & Rollback on failure
  const toggleTodo = async (id: string) => {
    const targetItem = todoList.find((t) => t.id === id);
    if (!targetItem) return;

    const willBeDone = !targetItem.done;

    // 1. Optimistic UI Update
    setTodoList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: willBeDone } : t))
    );

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/tasks/toggle.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ id, completed: willBeDone }),
      });

      const text = await res.text();
      let resData: any = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Invalid response from server');
      }

      if (!res.ok || resData.success === false) {
        throw new Error(resData.message || 'Gagal menyimpan status tugas');
      }

      // Update KPI stats if returned
      if (resData.stats) {
        if (resData.stats.ongoing !== undefined) setKpiOngoingTasks(resData.stats.ongoing);
        if (resData.stats.completion_rate !== undefined) setKpiCompletionRate(Number(resData.stats.completion_rate));
      }
    } catch (e: any) {
      console.error('Gagal update status tugas:', e);
      // Rollback Optimistic UI state on error
      setTodoList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !willBeDone } : t))
      );
      onAddToast(e.message || 'Gagal menyinkronkan perubahan tugas ke server.');
    }
  };

  // Compute dynamic greeting name from session
  const greetingName = getUserFirstName({ name: userName, email: userEmail }) || 'Admin';

  // Compute active projects count
  const activeProjects = projects.filter((p) => {
    const s = (p.status || '').toLowerCase();
    return s === 'active' || s === 'in progress' || s === 'in_progress' || s === 'on-track';
  });

  const activeProjectsCount = activeProjects.length || kpiActiveProjects;
  const runningTasksCount = analytics?.tasks?.total || tasksCount || kpiOngoingTasks;
  const completionRate =
    analytics && analytics.reports?.total > 0
      ? Math.round((analytics.reports.completed / analytics.reports.total) * 100)
      : kpiCompletionRate;

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (filterTab === 'On-Track') {
      return projects.filter((p) => (p.progress || 0) >= 50);
    }
    if (filterTab === 'Berisiko') {
      return projects.filter((p) => (p.progress || 0) < 50);
    }
    return projects;
  }, [projects, filterTab]);

  const displayProjects = filteredProjects.length > 0 ? filteredProjects : [
    { id: '1', name: 'Rebranding Kopi Nusa', desc: 'Identitas visual dan kemasan', status: 'On-Track', progress: 78, due: '2026-10-25' },
    { id: '2', name: 'Kampanye Ramadan', desc: 'Konten sosial media 30 hari', status: 'On-Track', progress: 62, due: '2026-11-01' },
    { id: '3', name: 'Website Studio Kaya', desc: 'Desain dan pengembangan landing page', status: 'Berisiko', progress: 34, due: '2026-10-30' },
  ];

  // Interactive wave spline chart
  const chartRef = useRef<HTMLDivElement>(null);
  const [activePointIndex, setActivePointIndex] = useState<number>(4);
  const chartData = [210, 330, 250, 300, 390, 280, 340, 260, 300, 380, 330, 430];
  const maxVal = 450;
  const W = 760;
  const H = 238;
  const pad = 30;

  const getX = (i: number) => pad + (i * (W - pad * 2)) / (chartData.length - 1);
  const getY = (v: number) => H - 24 - (v / maxVal) * (H - 50);

  const chartPoints = useMemo(
    () => chartData.map((v, i) => [getX(i), getY(v)]),
    []
  );

  const splinePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    let p = `M${chartPoints[0][0]},${chartPoints[0][1]}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const a = chartPoints[i - 1] || chartPoints[i];
      const b = chartPoints[i];
      const c = chartPoints[i + 1];
      const e = chartPoints[i + 2] || c;
      const cp1x = b[0] + (c[0] - a[0]) / 6;
      const cp1y = b[1] + (c[1] - a[1]) / 6;
      const cp2x = c[0] - (e[0] - b[0]) / 6;
      const cp2y = c[1] - (e[1] - b[1]) / 6;
      p += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${c[0]},${c[1]}`;
    }
    return p;
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (!splinePath) return '';
    const last = chartPoints[chartPoints.length - 1];
    const first = chartPoints[0];
    return `${splinePath} L${last[0]},${H - 24} L${first[0]},${H - 24} Z`;
  }, [splinePath, chartPoints]);

  const rafRef = useRef<number | null>(null);
  const handleMouseMoveChart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartRef.current) return;
    const clientX = e.clientX;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      const xCoord = ((clientX - rect.left) / rect.width) * W;
      let closestIndex = 0;
      let minDist = Infinity;
      chartPoints.forEach((pt, idx) => {
        const dist = Math.abs(pt[0] - xCoord);
        if (dist < minDist) {
          minDist = dist;
          closestIndex = idx;
        }
      });
      setActivePointIndex(closestIndex);
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    const target = projectToDelete;
    setIsDeleting(true);
    try {
      if (onDeleteProject) {
        await onDeleteProject(target.id);
      }
      setProjectToDelete(null);
      onAddToast('Proyek berhasil dihapus.');
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* 1. Greeting Header & Inline Micro KPIs */}
      <div className="head">
        <div className="grow">
          <h1>Selamat pagi, {greetingName}!</h1>
          <p>Mari buat hari ini produktif bersama seluruh tim.</p>
        </div>

        <div className="kpi">
          <small>Proyek Aktif</small>
          <strong>{activeProjectsCount}</strong>
        </div>

        <div className="kpi">
          <small>Tugas Berjalan</small>
          <strong>{runningTasksCount}</strong>
        </div>

        <div className="kpi">
          <small>Tingkat Selesai</small>
          <strong>{completionRate}</strong>
          <sup>%</sup>
        </div>

        <button
          type="button"
          className="cta"
          onClick={() => onNavigate('create-report')}
          title="Kirim Laporan Kerja Baru"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Buat Laporan</span>
        </button>
      </div>

      {/* 2. Bento Grid 12-Columns */}
      <div className="grid">
        {/* Row 1 Kiri: Tugas Berjalan (span 5) */}
        <section className="card c5">
          <div className="card-h">
            <div>
              <h3>Tugas Berjalan</h3>
              <div className="sub">{dateLabel} &bull; Prioritas Harian</div>
            </div>
            <button
              type="button"
              className="tagline-link"
              onClick={() => onNavigate('tasks')}
              style={{ fontSize: '12px', color: 'var(--lav-deep)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer' }}
            >
              Lihat Semua &rarr;
            </button>
          </div>

          <div className="todo" style={{ padding: '0 4px 4px' }}>
            {todoList.map((t) => (
              <div
                key={t.id}
                className={`t ${t.done ? 'done' : ''}`}
                tabIndex={0}
                role="checkbox"
                aria-checked={t.done}
                onClick={() => toggleTodo(t.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleTodo(t.id);
                  }
                }}
              >
                <span className="chk">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 4.5 4.5L19 7" />
                  </svg>
                </span>
                <div className="tx">
                  <b>{t.title}</b>
                  <small>{t.subtitle} &bull; {t.time}</small>
                </div>
                <div className="stack">
                  {t.assignees.map((a, i) => (
                    <i key={i} style={{ background: a.bg || (i % 2 === 0 ? 'var(--lav)' : 'var(--lime-soft)') }}>
                      {a.initial}
                    </i>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Row 1 Kanan: Aktivitas Hari Ini (span 7) */}
        <section className="card c7">
          <div className="card-h">
            <div>
              <h3>Aktivitas Hari Ini</h3>
              <div className="sub">Jadwal dan tenggat yang menunggu Anda</div>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
              Zona Waktu WIB
            </span>
          </div>

          <div className="inner tl">
            <div className="hours">
              {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((h) => (
                <span key={h} className={h === '12:00' ? 'now' : ''}>
                  {h}
                </span>
              ))}
            </div>

            <div className="tl-body">
              {/* Event Bar 1 */}
              <div
                className="bar"
                style={{
                  left: '0%',
                  width: '32%',
                  top: '6px',
                  color: '#2a3308',
                  ['--ext' as any]: '16%',
                  ['--i' as any]: 0,
                }}
              >
                <span className="fill" style={{ background: 'var(--lime)' }} />
                <span className="ghost" style={{ background: 'var(--lime)' }} />
                <div>
                  <b>Onboarding proyek</b>
                  <small>Google Meet</small>
                </div>
                <div className="stack" style={{ marginLeft: 'auto' }}>
                  <i style={{ background: '#f6e6cf' }}>Sa</i>
                  <i style={{ background: '#d6ecdf' }}>Ba</i>
                </div>
              </div>

              {/* Event Bar 2 */}
              <div
                className="bar"
                style={{
                  left: '20%',
                  width: '30%',
                  top: '66px',
                  color: 'var(--ink)',
                  ['--ext' as any]: '15%',
                  ['--i' as any]: 1,
                }}
              >
                <span className="fill" style={{ background: '#d6d3dc' }} />
                <span className="ghost" style={{ background: '#d6d3dc' }} />
                <div>
                  <b>Riset desain</b>
                  <small>Figma Workspace</small>
                </div>
                <div className="stack" style={{ marginLeft: 'auto' }}>
                  <i style={{ background: '#e3ddfa' }}>Ri</i>
                  <i style={{ background: '#f1d8e4' }}>Ti</i>
                </div>
              </div>

              {/* Event Bar 3 */}
              <div
                className="bar"
                style={{
                  left: '56%',
                  width: '22%',
                  top: '126px',
                  color: '#2a2440',
                  ['--ext' as any]: '10%',
                  ['--i' as any]: 2,
                }}
              >
                <span className="fill" style={{ background: '#c9bff0' }} />
                <span className="ghost" style={{ background: '#c9bff0' }} />
                <div>
                  <b>Istirahat kopi</b>
                  <small>CoCo Café</small>
                </div>
              </div>

              {/* Vertical Pulsing Real-time Nowline */}
              <div className="nowline" style={{ left: '62.5%' }} />
            </div>
          </div>
        </section>

        {/* Row 2 Kiri: Tingkat Selesai Radial Ring (span 4) */}
        <section className="card c4">
          <div className="card-h">
            <div>
              <h3>Tingkat Selesai</h3>
              <div className="sub">Capaian deliverable minggu ini</div>
            </div>
          </div>

          <div className="inner ringwrap">
            <svg viewBox="0 0 180 180">
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c2e04a" />
                  <stop offset="100%" stopColor="#8f7fe0" />
                </linearGradient>
              </defs>
              <circle className="ring-bg" cx="90" cy="90" r="80" />
              <circle
                className="ring-fg"
                cx="90"
                cy="90"
                r="80"
                style={{ ['--p' as any]: completionRate / 100 }}
              />
            </svg>
            <div className="ringnum">
              <strong>{completionRate}</strong>
              <strong>%</strong>
              <small>Deliverable Selesai</small>
            </div>
          </div>
        </section>

        {/* Row 2 Kanan: Kemajuan Divisi Wave Spline Chart (span 8) */}
        <section className="card c8">
          <div className="card-h">
            <div>
              <h3>Kemajuan Divisi</h3>
              <div className="sub">Pantau performa dan output tim kreatif</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--lime)' }} />
              <small style={{ color: 'var(--muted)', fontWeight: 600 }}>Poin Deliverable</small>
            </div>
          </div>

          <div className="inner">
            <div
              className="chart"
              ref={chartRef}
              onMouseMove={handleMouseMoveChart}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8f7fe0" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#8f7fe0" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                {[0, 100, 200, 300, 400].map((v) => (
                  <g key={v}>
                    <line
                      className="grid-l"
                      x1={pad}
                      x2={W - pad}
                      y1={getY(v)}
                      y2={getY(v)}
                    />
                    <text className="ax" x="0" y={getY(v) + 4}>
                      {v}
                    </text>
                  </g>
                ))}

                {/* Gradient area under spline */}
                <path className="area" d={areaPath} />

                {/* Smooth spline curve line */}
                <path className="ln" d={splinePath} />

                {/* Data points */}
                {chartPoints.map((pt, i) => (
                  <circle
                    key={i}
                    className={`pt ${i === activePointIndex ? 'act' : ''}`}
                    cx={pt[0]}
                    cy={pt[1]}
                    r={i === activePointIndex ? 6 : 4}
                  />
                ))}
              </svg>

              {/* Interactive Tooltip */}
              {chartPoints[activePointIndex] && (
                <div
                  className="tip"
                  style={{
                    left: `${(chartPoints[activePointIndex][0] / W) * 100}%`,
                    top: `${(chartPoints[activePointIndex][1] / H) * 100}%`,
                  }}
                >
                  {chartData[activePointIndex]} Poin
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Row 3: Pekerjaan & Proyek Terkini (span 12) */}
        <section className="card c12">
          <div className="card-h">
            <div>
              <h3>Pekerjaan &amp; Proyek Terkini</h3>
              <div className="sub">Klik kartu untuk membuka detail dan dokumen proyek</div>
            </div>

            {/* Filter Tabs Slider */}
            <div className="filters" style={{ margin: 0 }}>
              {(['Semua', 'On-Track', 'Berisiko'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={filterTab === tab ? 'on' : ''}
                  onClick={() => setFilterTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="projs">
            {displayProjects.map((p, idx) => {
              const tagBg =
                (p.progress || 0) >= 70
                  ? 'var(--lime-soft)'
                  : (p.progress || 0) >= 40
                  ? 'var(--lav)'
                  : 'var(--peach)';
              const tagStatus = (p.progress || 0) >= 50 ? 'On-Track' : 'Berisiko';

              return (
                <article
                  key={p.id || idx}
                  className="proj"
                  tabIndex={0}
                  onClick={() => {
                    if (p.id) {
                      onSelectProject(p.id);
                    }
                    onNavigate('project-detail');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      if (p.id) onSelectProject(p.id);
                      onNavigate('project-detail');
                    }
                  }}
                >
                  <span className="tag" style={{ background: tagBg }}>
                    {p.status || tagStatus}
                  </span>
                  <h4>{p.name}</h4>
                  <p>{p.desc || 'Desain, perancangan deliverable, dan kolaborasi tim terintegrasi.'}</p>

                  <div className="prog">
                    <i style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }} />
                  </div>

                  <div className="row">
                    <div className="stack">
                      <i style={{ background: '#e3ddfa' }}>Ri</i>
                      <i style={{ background: '#e9f5b8' }}>Di</i>
                      <i style={{ background: '#f6e6cf' }}>Sa</i>
                    </div>
                    <b>{p.progress || 0}%</b>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      {projectToDelete && (
        <div className="ov show" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Hapus Proyek?</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5, margin: '8px 0 20px' }}>
              Apakah Anda yakin ingin menghapus proyek <b>"{projectToDelete.name}"</b>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="acts">
              <button
                type="button"
                className="ghost-b"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="cta"
                style={{ background: 'var(--bad)', color: '#fff' }}
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
