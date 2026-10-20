import React, { useState, useEffect, useRef } from 'react';
import { LwIcon } from '../components/LaporanWeeIcons';
import { API_CONFIG, UserProfileData, generateDefaultAvatarSvg } from '../utils/apiConfig';
import { PhotoCropStudioModal } from '../components/PhotoCropStudioModal';

export type DashboardNavTab =
  | 'dashboard'
  | 'proyek'
  | 'laporan'
  | 'tugas'
  | 'sosial'
  | 'tim'
  | 'kalender'
  | 'analitik'
  | 'profil';

interface LaporanWeeDashboardProps {
  user: UserProfileData;
  onUpdateUser: (updated: UserProfileData) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: (t: 'light' | 'dark') => void;
  onAddToast: (msg: string) => void;
}

export const LaporanWeeDashboard: React.FC<LaporanWeeDashboardProps> = ({
  user,
  onUpdateUser,
  onLogout,
  theme,
  onToggleTheme,
  onAddToast,
}) => {
  const [currentTab, setCurrentTab] = useState<DashboardNavTab>('dashboard');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // New report form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportProject, setReportProject] = useState('Rebranding Kopi Nusa');

  // Project filter tab
  const [projectFilter, setProjectFilter] = useState<'Semua' | 'On-Track' | 'Berisiko'>('Semua');

  // Chart tooltip state
  const [activeChartPoint, setActiveChartPoint] = useState<number>(4);
  const chartPoints = [210, 330, 250, 300, 390, 280, 340, 260, 300, 380, 330, 430];

  // Interactive todo list state
  const [todos, setTodos] = useState([
    { id: 1, title: 'Review & umpan balik klien', sub: 'Redesain landing page · 22.00 – 23.45', done: true, ppl: ['Ri', 'Di'] },
    { id: 2, title: 'Susun laporan mingguan', sub: 'Divisi Kreatif · 10.00 – 11.00', done: false, ppl: ['Sa', 'Ba'] },
    { id: 3, title: 'Revisi kemasan Kopi Nusa', sub: 'Rebranding · 13.30 – 15.00', done: false, ppl: ['Ti', 'Ar'] },
    { id: 4, title: 'Rapat sinkronisasi tim', sub: 'Google Meet · 16.00 – 16.30', done: false, ppl: ['Ri', 'Sa'] },
  ]);

  // Profile Form state
  const [profileName, setProfileName] = useState(user.name || user.full_name || 'Admin');
  const [profileEmail, setProfileEmail] = useState(user.email || 'admin@gmail.com');
  const [profileJob, setProfileJob] = useState(user.job || user.profile_title || 'Art Director');
  const [profileStatus, setProfileStatus] = useState(user.status || 'KARYAWAN');
  const [profileSaving, setProfileSaving] = useState(false);

  // Sync profile form when user prop changes
  useEffect(() => {
    setProfileName(user.name || user.full_name || 'Admin');
    setProfileEmail(user.email || 'admin@gmail.com');
    setProfileJob(user.job || user.profile_title || 'Art Director');
    setProfileStatus(user.status || 'KARYAWAN');
  }, [user]);

  // Check if profile form is dirty
  const isProfileDirty =
    profileName !== (user.name || user.full_name) ||
    profileEmail !== user.email ||
    profileJob !== (user.job || user.profile_title) ||
    profileStatus !== user.status;

  // Calculate profile completeness percentage
  const calcCompleteness = () => {
    let count = 0;
    if (user.avatar_url) count++;
    if (profileName.trim()) count++;
    if (profileEmail.trim()) count++;
    if (profileJob.trim()) count++;
    if (profileStatus.trim()) count++;
    return count * 20;
  };
  const completeness = calcCompleteness();

  const JOBS = ['Art Director', 'Desainer Grafis', 'Videografer', 'Copywriter', 'Social Media', 'Full-Stack Developer'];
  const STATUSES = ['KARYAWAN', 'MAGANG', 'PKL SISWA', 'PKL MAHASISWA'];

  // Project List
  const PROJECTS = [
    { title: 'Rebranding Kopi Nusa', desc: 'Identitas visual dan kemasan', status: 'On-Track', prog: 78, color: 'var(--lime-soft)', members: 3 },
    { title: 'Kampanye Ramadan', desc: 'Konten sosial media 30 hari', status: 'On-Track', prog: 62, color: 'var(--lav)', members: 4 },
    { title: 'Website Studio Kaya', desc: 'Desain dan pengembangan landing page', status: 'Berisiko', prog: 34, color: 'var(--peach)', members: 2 },
    { title: 'Video Profil Perusahaan', desc: 'Naskah, syuting, dan penyuntingan', status: 'On-Track', prog: 91, color: 'var(--mint)', members: 3 },
    { title: 'Katalog Produk 2026', desc: 'Layout cetak dan digital', status: 'Berisiko', prog: 48, color: 'var(--pink)', members: 2 },
    { title: 'Event Launching Q4', desc: 'Dekorasi, rundown, dan publikasi', status: 'On-Track', prog: 55, color: 'var(--lav)', members: 5 },
  ];

  // Daily Reports List
  const [reports, setReports] = useState([
    { id: 1, title: 'Progres desain landing page', author: 'Rina', date: '11 Mei', status: 'Terkirim', bg1: 'var(--lav)', bg2: 'var(--lime-soft)' },
    { id: 2, title: 'Revisi kemasan tahap 2', author: 'Dimas', date: '10 Mei', status: 'Direview', bg1: 'var(--peach)', bg2: 'var(--lav)' },
    { id: 3, title: 'Syuting video profil hari ke-3', author: 'Sari', date: '09 Mei', status: 'Terkirim', bg1: 'var(--mint)', bg2: 'var(--lime-soft)' },
    { id: 4, title: 'Rekap konten sosial media', author: 'Bayu', date: '08 Mei', status: 'Draf', bg1: 'var(--pink)', bg2: 'var(--peach)' },
    { id: 5, title: 'Evaluasi event launching', author: 'Tika', date: '07 Mei', status: 'Terkirim', bg1: 'var(--lav)', bg2: 'var(--lime-soft)' },
  ]);

  // Kanban Tasks
  const [kanbanCols, setKanbanCols] = useState([
    {
      id: 'todo',
      title: 'To Do',
      tasks: ['Brief kampanye Ramadan', 'Moodboard kemasan'],
    },
    {
      id: 'progress',
      title: 'Sedang Dikerjakan',
      tasks: ['Desain landing page', 'Naskah video profil', 'Layout katalog'],
    },
    {
      id: 'review',
      title: 'Dalam Review',
      tasks: ['Logo Kopi Nusa'],
    },
    {
      id: 'done',
      title: 'Selesai',
      tasks: ['Rundown event', 'Kontrak vendor'],
    },
  ]);

  // Navigation Items
  const NAV_ITEMS: { id: DashboardNavTab; label: string; icon: keyof typeof import('../components/LaporanWeeIcons').ICONS }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'proyek', label: 'Proyek', icon: 'folder' },
    { id: 'laporan', label: 'Laporan', icon: 'doc' },
    { id: 'tugas', label: 'Tugas', icon: 'task' },
    { id: 'sosial', label: 'Sosial Media', icon: 'share' },
    { id: 'tim', label: 'Tim', icon: 'users' },
    { id: 'kalender', label: 'Kalender', icon: 'cal' },
    { id: 'analitik', label: 'Analitik', icon: 'chart' },
    { id: 'profil', label: 'Pengaturan Profil', icon: 'profile' },
  ];

  const activeNavIndex = NAV_ITEMS.findIndex((n) => n.id === currentTab);

  // Breadcrumb title
  const currentNavLabel = NAV_ITEMS.find((n) => n.id === currentTab)?.label || 'Dashboard';

  // Toggle todo item
  const handleToggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  // Submit new report
  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) {
      onAddToast('Harap masukkan judul laporan');
      return;
    }
    const newRep = {
      id: Date.now(),
      title: reportTitle.trim(),
      author: user.name || 'Admin',
      date: 'Hari ini',
      status: 'Terkirim',
      bg1: 'var(--lime-soft)',
      bg2: 'var(--lav)',
    };
    setReports((prev) => [newRep, ...prev]);
    setIsReportModalOpen(false);
    setReportTitle('');
    onAddToast('Laporan berhasil disimpan dan dikirimkan');
  };

  // Save profile info (Optimistic UI)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      onAddToast('Nama profil wajib diisi');
      return;
    }
    setProfileSaving(true);

    const updatedData: Partial<UserProfileData> = {
      name: profileName.trim(),
      full_name: profileName.trim(),
      email: profileEmail.trim(),
      job: profileJob,
      profile_title: profileJob,
      status: profileStatus,
    };

    try {
      const saved = await API_CONFIG.profile.update(updatedData);
      onUpdateUser(saved);
      setTimeout(() => {
        setProfileSaving(false);
        onAddToast('Profil berhasil disimpan');
      }, 500);
    } catch (err: any) {
      setProfileSaving(false);
      onAddToast(err?.message || 'Gagal menyimpan profil');
    }
  };

  // Render user avatar: photo or generated initials
  const userAvatarSrc = user.avatar_url || generateDefaultAvatarSvg(user.name || 'Admin');
  const userInitial = ((user.name || 'Admin')[0] || 'A').toUpperCase();

  return (
    <div className="lw-dash-container">
      <div className="lw-ambient">
        <i />
        <i />
        <i />
      </div>

      {/* Collapsible Left Rail */}
      <aside className="lw-rail" aria-label="Navigasi utama">
        <div
          className="lw-rail-logo"
          style={{ cursor: 'pointer' }}
          onClick={() => setCurrentTab('dashboard')}
        >
          <b>
            <LwIcon name="logo" size={22} />
          </b>
          <em>
            Laporan<span>Wee</span>
          </em>
        </div>

        <nav className="lw-nav">
          <div
            className="lw-pill"
            style={{
              transform: `translateY(${activeNavIndex * 54}px)`,
            }}
          />
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={currentTab === item.id ? 'on' : ''}
              onClick={() => {
                setCurrentTab(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={item.label}
            >
              <LwIcon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="lw-rail-foot">
          <button type="button" onClick={onLogout} title="Keluar dari akun">
            <LwIcon name="logout" size={20} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lw-main">
        {/* Top bar */}
        <div className="lw-top">
          <div className="crumb">{currentNavLabel}</div>

          {/* Theme switcher knob */}
          <div className="lw-theme" role="group" aria-label="Tema">
            <div className="knob" />
            <button
              type="button"
              data-t="light"
              aria-label="Terang"
              onClick={() => onToggleTheme('light')}
            >
              <LwIcon name="sun" size={16} />
            </button>
            <button
              type="button"
              data-t="dark"
              aria-label="Gelap"
              onClick={() => onToggleTheme('dark')}
            >
              <LwIcon name="moon" size={16} />
            </button>
          </div>

          <button
            className="lw-round"
            type="button"
            aria-label="Cari"
            onClick={() => onAddToast('Pencarian cepat aktif')}
          >
            <LwIcon name="search" size={18} />
          </button>

          {/* User Avatar in Topbar: Clicking navigates directly to Profil View! */}
          <button
            className="lw-avatar-btn"
            type="button"
            title="Buka Pengaturan Profil"
            aria-label="Buka Pengaturan Profil"
            onClick={() => {
              setCurrentTab('profil');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name || 'Profil'} />
            ) : (
              userInitial
            )}
          </button>
        </div>

        {/* ═════════ 1. TAB: DASHBOARD ═════════ */}
        {currentTab === 'dashboard' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Selamat pagi, {user.name || 'Pengguna'}!</h1>
                <p>Mari buat hari ini produktif bersama seluruh tim.</p>
              </div>

              <div className="lw-kpi">
                <small>Proyek Aktif</small>
                <strong>12</strong>
              </div>
              <div className="lw-kpi">
                <small>Tugas Berjalan</small>
                <strong>48</strong>
              </div>
              <div className="lw-kpi">
                <small>Tingkat Selesai</small>
                <strong>82</strong>
                <sup>%</sup>
              </div>

              <button
                className="lw-cta"
                type="button"
                onClick={() => setIsReportModalOpen(true)}
              >
                <LwIcon name="plus" size={18} strokeWidth={2.4} />
                Buat Laporan
              </button>
            </div>

            <div className="lw-grid">
              {/* Tugas Berjalan Checklist */}
              <section className="lw-card lw-c5">
                <div className="lw-card-h">
                  <div>
                    <h3>Tugas Berjalan</h3>
                    <div className="sub">Rabu, 11 Mei</div>
                  </div>
                </div>

                <div className="lw-todo" style={{ padding: '0 4px 4px' }}>
                  {todos.map((t) => (
                    <div
                      key={t.id}
                      className={`lw-t ${t.done ? 'done' : ''}`}
                      tabIndex={0}
                      role="checkbox"
                      aria-checked={t.done}
                      onClick={() => handleToggleTodo(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleToggleTodo(t.id);
                        }
                      }}
                    >
                      <span className="lw-chk">
                        <LwIcon name="check" size={15} strokeWidth={3} />
                      </span>
                      <div className="tx">
                        <b>{t.title}</b>
                        <small>{t.sub}</small>
                      </div>
                      <div className="lw-av-stack">
                        {t.ppl.map((p, idx) => (
                          <i
                            key={idx}
                            style={{
                              background: idx % 2 === 0 ? 'var(--lav)' : 'var(--lime)',
                            }}
                          >
                            {p}
                          </i>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Aktivitas Hari Ini Timeline */}
              <section className="lw-card lw-c7">
                <div className="lw-card-h">
                  <div>
                    <h3>Aktivitas Hari Ini</h3>
                    <div className="sub">Jadwal &amp; koordinasi tim</div>
                  </div>
                </div>

                <div className="lw-inner lw-tl">
                  <div className="lw-hours">
                    {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map(
                      (h) => (
                        <span key={h} className={h === '12:00' ? 'now' : ''}>
                          {h}
                        </span>
                      )
                    )}
                  </div>

                  <div className="lw-tl-body">
                    <div
                      className="lw-timeline-bar"
                      style={{
                        left: '0%',
                        width: '32%',
                        top: '6px',
                        color: '#2a3308',
                      }}
                    >
                      <span className="fill" style={{ background: 'var(--lime)' }} />
                      <span className="ghost" style={{ background: 'var(--lime)', width: '16%' }} />
                      <div>
                        <b>Onboarding proyek</b>
                        <small>Google Meet</small>
                      </div>
                    </div>

                    <div
                      className="lw-timeline-bar"
                      style={{
                        left: '20%',
                        width: '30%',
                        top: '66px',
                        color: '#2a2733',
                      }}
                    >
                      <span className="fill" style={{ background: '#d6d3dc' }} />
                      <span className="ghost" style={{ background: '#d6d3dc', width: '15%' }} />
                      <div>
                        <b>Riset desain</b>
                        <small>Figma</small>
                      </div>
                    </div>

                    <div
                      className="lw-timeline-bar"
                      style={{
                        left: '56%',
                        width: '22%',
                        top: '126px',
                        color: '#2a2440',
                      }}
                    >
                      <span className="fill" style={{ background: '#c9bff0' }} />
                      <span className="ghost" style={{ background: '#c9bff0', width: '11%' }} />
                      <div>
                        <b>Istirahat kopi</b>
                        <small>CoCo Café</small>
                      </div>
                    </div>

                    <div className="lw-nowline" style={{ left: '62.5%' }} />
                  </div>
                </div>
              </section>

              {/* Tingkat Selesai Ring Gauge */}
              <section className="lw-card lw-c4">
                <div className="lw-card-h">
                  <div>
                    <h3>Tingkat Selesai</h3>
                    <div className="sub">Capaian deliverable minggu ini</div>
                  </div>
                </div>

                <div className="lw-inner lw-ringwrap">
                  <svg viewBox="0 0 180 180">
                    <defs>
                      <linearGradient id="lw-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#c2e04a" />
                        <stop offset="1" stopColor="#8f7fe0" />
                      </linearGradient>
                    </defs>
                    <circle className="lw-ring-bg" cx="90" cy="90" r="80" />
                    <circle
                      className="lw-ring-fg"
                      cx="90"
                      cy="90"
                      r="80"
                      style={{ strokeDashoffset: `${502 - 502 * 0.82}` }}
                    />
                  </svg>
                  <div className="lw-ringnum">
                    <strong>82%</strong>
                    <small>Selesai</small>
                  </div>
                </div>
              </section>

              {/* Kemajuan Divisi Interactive Chart */}
              <section className="lw-card lw-c8">
                <div className="lw-card-h">
                  <div>
                    <h3>Kemajuan Divisi</h3>
                    <div className="sub">Pantau performa harian tim kreatif</div>
                  </div>
                </div>

                <div className="lw-inner">
                  <div className="lw-chart">
                    <svg viewBox="0 0 760 238" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="lw-area-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#8f7fe0" stopOpacity="0.28" />
                          <stop offset="1" stopColor="#8f7fe0" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {[0, 100, 200, 300, 400].map((v) => {
                        const y = 238 - 24 - (v / 450) * (238 - 50);
                        return (
                          <g key={v}>
                            <line className="grid-l" x1="30" x2="730" y1={y} y2={y} />
                            <text className="ax" x="0" y={y + 4}>
                              {v}
                            </text>
                          </g>
                        );
                      })}

                      {/* Smooth cubic bezier curve */}
                      <path
                        className="area"
                        d="M30,123 C93,76 156,128 220,95 C283,62 346,134 410,88 C473,42 536,110 600,68 C663,26 690,40 730,22 L730,214 L30,214 Z"
                      />
                      <path
                        className="ln"
                        d="M30,123 C93,76 156,128 220,95 C283,62 346,134 410,88 C473,42 536,110 600,68 C663,26 690,40 730,22"
                      />

                      {chartPoints.map((val, idx) => {
                        const x = 30 + idx * ((760 - 60) / (chartPoints.length - 1));
                        const y = 238 - 24 - (val / 450) * (238 - 50);
                        return (
                          <circle
                            key={idx}
                            className={`pt ${activeChartPoint === idx ? 'act' : ''}`}
                            cx={x}
                            cy={y}
                            r={activeChartPoint === idx ? 6 : 4}
                            onMouseEnter={() => setActiveChartPoint(idx)}
                          />
                        );
                      })}
                    </svg>

                    <div
                      className="lw-tip"
                      style={{
                        left: `${(30 + activeChartPoint * ((760 - 60) / (chartPoints.length - 1))) * (100 / 760)}%`,
                        top: `${(238 - 24 - (chartPoints[activeChartPoint] / 450) * (238 - 50)) * (100 / 238)}%`,
                      }}
                    >
                      {chartPoints[activeChartPoint]} poin
                    </div>
                  </div>
                </div>
              </section>

              {/* Pekerjaan & Proyek Terkini */}
              <section className="lw-card lw-c12">
                <div className="lw-card-h">
                  <div>
                    <h3>Pekerjaan &amp; Proyek Terkini</h3>
                    <div className="sub">Klik kartu untuk membuka proyek</div>
                  </div>
                </div>

                <div className="lw-projs">
                  {PROJECTS.slice(0, 3).map((p, idx) => (
                    <article
                      key={idx}
                      className="lw-proj"
                      tabIndex={0}
                      onClick={() => onAddToast(`Membuka proyek: ${p.title}`)}
                    >
                      <span className="tag" style={{ background: p.color }}>
                        {p.status}
                      </span>
                      <h4>{p.title}</h4>
                      <p>{p.desc}</p>
                      <div className="lw-prog">
                        <i style={{ width: `${p.prog}%` }} />
                      </div>
                      <div className="lw-row">
                        <div className="lw-av-stack">
                          <i style={{ background: 'var(--lav)' }}>Ri</i>
                          <i style={{ background: 'var(--lime)' }}>Di</i>
                          <i style={{ background: 'var(--peach)' }}>+{p.members}</i>
                        </div>
                        <b>{p.prog}%</b>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ═════════ 2. TAB: PROYEK ═════════ */}
        {currentTab === 'proyek' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Proyek</h1>
                <p>Semua pekerjaan kreatif tim dalam satu tempat.</p>
              </div>
              <button
                className="lw-cta"
                type="button"
                onClick={() => setIsReportModalOpen(true)}
              >
                <LwIcon name="plus" size={18} strokeWidth={2.4} />
                Buat Laporan
              </button>
            </div>

            <div className="lw-filters">
              <div
                className="fp"
                style={{
                  width: projectFilter === 'Semua' ? '88px' : projectFilter === 'On-Track' ? '106px' : '96px',
                  transform:
                    projectFilter === 'Semua'
                      ? 'translateX(0px)'
                      : projectFilter === 'On-Track'
                      ? 'translateX(92px)'
                      : 'translateX(202px)',
                }}
              />
              {(['Semua', 'On-Track', 'Berisiko'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={projectFilter === filter ? 'on' : ''}
                  onClick={() => setProjectFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="lw-card">
              <div className="lw-projs">
                {PROJECTS.filter(
                  (p) => projectFilter === 'Semua' || p.status === projectFilter
                ).map((p, idx) => (
                  <article
                    key={idx}
                    className="lw-proj"
                    tabIndex={0}
                    onClick={() => onAddToast(`Membuka proyek: ${p.title}`)}
                  >
                    <span className="tag" style={{ background: p.color }}>
                      {p.status}
                    </span>
                    <h4>{p.title}</h4>
                    <p>{p.desc}</p>
                    <div className="lw-prog">
                      <i style={{ width: `${p.prog}%` }} />
                    </div>
                    <div className="lw-row">
                      <div className="lw-av-stack">
                        <i style={{ background: 'var(--lav)' }}>Ri</i>
                        <i style={{ background: 'var(--lime)' }}>Di</i>
                        <i style={{ background: 'var(--peach)' }}>+{p.members}</i>
                      </div>
                      <b>{p.prog}%</b>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 3. TAB: LAPORAN ═════════ */}
        {currentTab === 'laporan' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Laporan Harian</h1>
                <p>Catatan progres harian seluruh tim.</p>
              </div>
              <button
                className="lw-cta"
                type="button"
                onClick={() => setIsReportModalOpen(true)}
              >
                <LwIcon name="plus" size={18} strokeWidth={2.4} />
                Buat Laporan
              </button>
            </div>

            <div className="lw-card">
              <div className="lw-rows">
                {reports.map((r) => (
                  <div key={r.id} className="lw-rw">
                    <div
                      className="lw-thumb"
                      style={{
                        background: `linear-gradient(135deg, ${r.bg1}, ${r.bg2})`,
                      }}
                    />
                    <div className="tx">
                      <b>{r.title}</b>
                      <small>
                        {r.author} · {r.date}
                      </small>
                    </div>
                    <span
                      className="tag"
                      style={{
                        padding: '6px 14px',
                        borderRadius: '999px',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        background:
                          r.status === 'Terkirim'
                            ? 'var(--lime-soft)'
                            : r.status === 'Direview'
                            ? 'var(--lav)'
                            : 'var(--peach)',
                        color: 'var(--ink)',
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 4. TAB: TUGAS (KANBAN) ═════════ */}
        {currentTab === 'tugas' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Papan Tugas</h1>
                <p>Seret prioritas Anda dari rencana sampai selesai.</p>
              </div>
            </div>

            <div className="lw-kan">
              {kanbanCols.map((col) => (
                <div key={col.id} className="lw-col">
                  <h5>
                    {col.title}
                    <span>{col.tasks.length}</span>
                  </h5>
                  {col.tasks.map((taskTitle, idx) => (
                    <div
                      key={idx}
                      className="lw-k"
                      onClick={() => onAddToast(`Tugas dipilih: ${taskTitle}`)}
                    >
                      <b>{taskTitle}</b>
                      <div className="lw-row" style={{ margin: 0 }}>
                        <div className="lw-av-stack">
                          <i style={{ background: 'var(--lav)' }}>Ri</i>
                          <i style={{ background: 'var(--lime)' }}>Di</i>
                        </div>
                        <span>{10 + idx * 3} Mei</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═════════ 5. TAB: SOSIAL MEDIA ═════════ */}
        {currentTab === 'sosial' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Sosial Media</h1>
                <p>Performa konten di semua kanal distribusi kreatif.</p>
              </div>
            </div>

            <div className="lw-grid">
              {[
                { name: 'Instagram', stat: '24,8 rb', sub: 'Pengikut', growth: '+3,2%', color: 'var(--pink)' },
                { name: 'TikTok', stat: '61,4 rb', sub: 'Penayangan', growth: '+12%', color: 'var(--lav)' },
                { name: 'YouTube', stat: '8,1 rb', sub: 'Pelanggan', growth: '+1,4%', color: 'var(--peach)' },
                { name: 'LinkedIn', stat: '5,6 rb', sub: 'Koneksi', growth: '+2,1%', color: 'var(--mint)' },
              ].map((s, idx) => (
                <section key={idx} className="lw-card lw-c3">
                  <div className="lw-inner" style={{ background: s.color, color: 'var(--ink)' }}>
                    <small style={{ fontWeight: 600 }}>{s.name}</small>
                    <div className="lw-kpi" style={{ marginTop: '22px' }}>
                      <strong>{s.stat}</strong>
                      <small style={{ color: 'var(--ink)', opacity: 0.75, marginTop: '6px' }}>
                        {s.sub} · {s.growth}
                      </small>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ═════════ 6. TAB: TIM ═════════ */}
        {currentTab === 'tim' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Tim Kreatif</h1>
                <p>Anggota dan beban kerja minggu ini.</p>
              </div>
            </div>

            <div className="lw-grid">
              {/* Current user card with optimistic updates */}
              <section className="lw-card lw-c4">
                <div className="lw-inner" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    className="lw-avatar-btn"
                    style={{ width: '58px', height: '58px', fontSize: '18px', flex: 'none' }}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontWeight: 600, display: 'block' }}>{user.name || 'Admin'} (Anda)</b>
                    <div className="sub" style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {user.job || 'Art Director'} · {user.status || 'KARYAWAN'}
                    </div>
                    <div className="lw-prog" style={{ marginTop: '12px' }}>
                      <i style={{ width: '85%' }} />
                    </div>
                  </div>
                </div>
              </section>

              {[
                { name: 'Rina', role: 'Desainer UI/UX', prog: 82, color: '#e3ddfa' },
                { name: 'Dimas', role: 'Motion Designer', prog: 64, color: '#e9f5b8' },
                { name: 'Sari', role: 'Videografer', prog: 91, color: '#f6e6cf' },
                { name: 'Bayu', role: 'Copywriter', prog: 55, color: '#d6ecdf' },
                { name: 'Tika', role: 'Social Media Lead', prog: 73, color: '#f1d8e4' },
              ].map((p, idx) => (
                <section key={idx} className="lw-card lw-c4">
                  <div className="lw-inner" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      className="lw-avatar-btn"
                      style={{
                        width: '58px',
                        height: '58px',
                        background: p.color,
                        fontSize: '18px',
                        flex: 'none',
                      }}
                    >
                      {p.name.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontWeight: 600, display: 'block' }}>{p.name}</b>
                      <div className="sub" style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {p.role}
                      </div>
                      <div className="lw-prog" style={{ marginTop: '12px' }}>
                        <i style={{ width: `${p.prog}%` }} />
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ═════════ 7. TAB: KALENDER ═════════ */}
        {currentTab === 'kalender' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Kalender</h1>
                <p>Mei 2026 — Jadwal &amp; Tenggat Proyek</p>
              </div>
            </div>

            <div className="lw-card">
              <div className="lw-cal">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
                  <div key={d} className="dn">
                    {d}
                  </div>
                ))}
                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const eventMap: Record<number, [string, string]> = {
                    3: ['Rapat tim', 'var(--lav)'],
                    7: ['Deadline logo', 'var(--peach)'],
                    11: ['Hari ini · Review', 'var(--lime)'],
                    14: ['Syuting video', 'var(--mint)'],
                    19: ['Launching Q4', 'var(--pink)'],
                    24: ['Evaluasi sprint', 'var(--lav)'],
                  };
                  const hasEv = eventMap[day];

                  return (
                    <div
                      key={day}
                      className={`lw-cd ${day === 11 ? 'today' : ''}`}
                      onClick={() => onAddToast(`Tanggal ${day} Mei dipilih`)}
                    >
                      {day}
                      {hasEv && (
                        <i style={{ background: hasEv[1] }}>{hasEv[0]}</i>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 8. TAB: ANALITIK ═════════ */}
        {currentTab === 'analitik' && (
          <div className="lw-view-content">
            <div className="lw-head">
              <div className="grow">
                <h1>Analitik Produktivitas</h1>
                <p>Hasil capaian dan efektivitas tim 8 minggu terakhir.</p>
              </div>
            </div>

            <div className="lw-card">
              <div className="lw-inner lw-bars-w">
                <div className="lw-bars">
                  {[42, 55, 48, 70, 63, 82, 76, 90].map((val, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${val}%` }}
                      title={`Minggu ${idx + 1}: ${val}%`}
                    >
                      <span>M{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ 9. TAB: PROFIL SETTING (PENGATURAN PROFIL) ═════════ */}
        {currentTab === 'profil' && (
          <div className="lw-view-content">
            <main className="lw-wrap">
              {/* Profile Card & Avatar Studio Trigger */}
              <aside className="lw-card">
                <div className="lw-inner lw-pc">
                  <div className="lw-pwrap">
                    <svg className="lw-pr" viewBox="0 0 200 200">
                      <defs>
                        <linearGradient id="lw-pg" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#c2e04a" />
                          <stop offset="1" stopColor="#8f7fe0" />
                        </linearGradient>
                      </defs>
                      <circle className="a" cx="100" cy="100" r="88" />
                      <circle
                        className="b"
                        cx="100"
                        cy="100"
                        r="88"
                        style={{
                          strokeDashoffset: `${553 * (1 - completeness / 100)}`,
                        }}
                      />
                    </svg>

                    <div
                      className="lw-pimg"
                      role="button"
                      tabIndex={0}
                      aria-label="Ubah foto profil"
                      onClick={() => setIsCropModalOpen(true)}
                    >
                      <img src={userAvatarSrc} alt="Foto Profil" />
                    </div>

                    <button
                      className="lw-pen"
                      type="button"
                      aria-label="Edit foto profil"
                      onClick={() => setIsCropModalOpen(true)}
                    >
                      <LwIcon name="pen" size={19} />
                    </button>

                    <span className="lw-pct">{completeness}%</span>
                  </div>

                  <div className="lw-eyebrow">Foto Profil</div>
                  <h1 style={{ fontSize: '30px', margin: '4px 0 8px', wordBreak: 'break-word' }}>
                    {profileName || 'Pengguna'}
                  </h1>

                  <p className="sub" style={{ maxWidth: '30ch', marginInline: 'auto' }}>
                    Foto diedit dari pratinjau utama, lalu disimpan langsung tanpa kartu pratinjau crop tambahan.
                  </p>

                  <div className="lw-chips">
                    <span className="lw-chip lime">Profil {completeness}% lengkap</span>
                    <span className="lw-chip">{profileJob || 'Pekerjaan belum diatur'}</span>
                    <span className="lw-chip lav">{profileStatus || 'Status belum dipilih'}</span>
                  </div>

                  <button
                    className="lw-btn"
                    type="button"
                    style={{ width: '100%', background: 'var(--dark)', color: 'var(--on-dark)' }}
                    onClick={() => setIsCropModalOpen(true)}
                  >
                    <LwIcon name="image" size={19} />
                    <span>Ubah Foto</span>
                  </button>
                </div>
              </aside>

              {/* Profile Information Form */}
              <section className="lw-card">
                <div className="lw-inner">
                  <div className="lw-fh">
                    <div>
                      <div className="lw-eyebrow">Pengaturan</div>
                      <h2 style={{ marginTop: '6px', fontSize: '26px' }}>Informasi Profil</h2>
                      <p className="sub">Ubah data yang tampil di akun Anda.</p>
                    </div>

                    <span className={`lw-dirty ${isProfileDirty ? 'on' : ''}`}>
                      <i />
                      Perubahan belum disimpan
                    </span>
                  </div>

                  <form onSubmit={handleSaveProfile} noValidate>
                    <div className="lw-f">
                      <input
                        id="lw-fn"
                        placeholder=" "
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        autoComplete="name"
                      />
                      <label htmlFor="lw-fn">Nama Lengkap</label>
                    </div>

                    <div className="lw-f">
                      <input
                        id="lw-fe"
                        type="email"
                        placeholder=" "
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        autoComplete="email"
                      />
                      <label htmlFor="lw-fe">Email</label>
                    </div>

                    <div className="lw-f">
                      <input
                        id="lw-fj"
                        placeholder=" "
                        value={profileJob}
                        onChange={(e) => setProfileJob(e.target.value)}
                        autoComplete="organization-title"
                      />
                      <label htmlFor="lw-fj">Pekerjaan</label>
                    </div>

                    {/* Quick role chips */}
                    <div className="lw-opt-chips" style={{ margin: '-4px 0 16px' }}>
                      {JOBS.map((j) => (
                        <button
                          key={j}
                          type="button"
                          className={`lw-opt ${profileJob === j ? 'on' : ''}`}
                          onClick={() => setProfileJob(j)}
                        >
                          {j}
                        </button>
                      ))}
                    </div>

                    <div className="lw-gl">STATUS</div>
                    <div className="lw-opt-chips" role="radiogroup" aria-label="Status">
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={profileStatus === st}
                          className={`lw-opt ${profileStatus === st ? 'on' : ''}`}
                          onClick={() => setProfileStatus(st)}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <div className="lw-fa">
                      <button
                        type="button"
                        className="lw-btn"
                        style={{
                          width: 'auto',
                          padding: '0 22px',
                          background: 'var(--glass-solid)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink)',
                        }}
                        onClick={() => {
                          setProfileName(user.name || 'Admin');
                          setProfileEmail(user.email || 'admin@gmail.com');
                          setProfileJob(user.job || 'Art Director');
                          setProfileStatus(user.status || 'KARYAWAN');
                          onAddToast('Perubahan formulir dibatalkan');
                        }}
                      >
                        Batalkan
                      </button>

                      <button
                        type="submit"
                        className={`lw-btn ${profileSaving ? 'load' : ''}`}
                        style={{
                          width: 'auto',
                          padding: '0 26px',
                          background: 'var(--dark)',
                          color: 'var(--on-dark)',
                        }}
                      >
                        <span>Simpan Profil</span>
                        <LwIcon name="check" size={17} />
                        <i className="sp" />
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </main>
          </div>
        )}
      </main>

      {/* Modal Buat Laporan */}
      <div className={`lw-ov ${isReportModalOpen ? 'show' : ''}`} role="dialog" aria-modal="true">
        <div className="lw-modal" style={{ width: 'min(440px, 92vw)' }}>
          <div className="lw-mh">
            <h2>Buat Laporan Baru</h2>
            <button
              className="lw-x"
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              aria-label="Tutup modal"
            >
              <LwIcon name="close" size={16} />
            </button>
          </div>

          <form onSubmit={handleSaveReport} style={{ marginTop: '16px' }}>
            <div className="lw-f">
              <input
                id="lw-rep-title"
                placeholder=" "
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
              <label htmlFor="lw-rep-title">Judul Laporan</label>
            </div>

            <div className="lw-f">
              <select
                id="lw-rep-proj"
                value={reportProject}
                onChange={(e) => setReportProject(e.target.value)}
                style={{
                  width: '100%',
                  height: '56px',
                  borderRadius: '20px',
                  border: '1.5px solid var(--line)',
                  background: 'var(--glass)',
                  padding: '0 18px',
                  font: 'inherit',
                  color: 'var(--ink)',
                }}
              >
                {PROJECTS.map((p, idx) => (
                  <option key={idx} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="lw-fa" style={{ borderTop: 'none', marginTop: '16px', paddingTop: 0 }}>
              <button
                type="button"
                className="lw-btn"
                style={{
                  width: 'auto',
                  padding: '0 20px',
                  background: 'var(--glass)',
                  color: 'var(--muted)',
                }}
                onClick={() => setIsReportModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="lw-btn"
                style={{ width: 'auto', padding: '0 26px', background: 'var(--dark)', color: 'var(--on-dark)' }}
              >
                <span>Simpan Laporan</span>
                <LwIcon name="check" size={17} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Photo Crop Studio Modal */}
      <PhotoCropStudioModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        currentAvatarUrl={user.avatar_url}
        userName={user.name || 'Pengguna'}
        onAvatarSaved={(newUrl) => {
          const updated = { ...user, avatar_url: newUrl };
          onUpdateUser(updated);
        }}
        onAddToast={onAddToast}
      />
    </div>
  );
};
