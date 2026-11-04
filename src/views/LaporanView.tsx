import React, { useState, useEffect, useMemo } from 'react';
import { Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { fetchWithFastCache, getCachedData, invalidateCache } from '../utils/apiCache';

export interface DailyReportItem {
  id: number | string;
  title: string;
  status: string;
  progress: number;
  created_at?: string;
  date?: string;
  author_name: string;
  author_job: string;
  avatar_url?: string | null;
  raw_data?: any;
}

export interface LaporanViewProps {
  reports?: Report[];
  isLoading?: boolean;
  isAdmin?: boolean;
  currentUserEmail?: string;
  reportsError?: {
    status?: number;
    message: string;
    type: '401' | '403' | '404' | '500' | 'network' | 'error';
  } | null;
  onNavigate: (view: ViewType) => void;
  onSelectReport: (reportId: string) => void;
  onDeleteReport?: (reportId: string) => void;
  onResetReports?: () => void;
  onAddToast?: (text: string) => void;
  onRetry?: () => void;
}

const REPORT_ENDPOINT = 'https://api-laporanwe.mkverse.my.id/api/daily-reports/list.php';

const normalizeReport = (item: any): DailyReportItem => {
  const raw = item.raw_data || item;
  return {
    id: item.id || raw.id,
    title: item.title || item.task || raw.title || raw.task || raw.project_name || 'Laporan Kerja Harian',
    status: item.status || raw.status || 'in_progress',
    progress: typeof item.progress === 'number' ? item.progress : (parseInt(item.progress || raw.progress, 10) || 0),
    created_at: item.created_at || raw.created_at || item.date || raw.report_date || '',
    date: item.report_date || raw.report_date || item.date || (item.created_at ? item.created_at.split(' ')[0] : ''),
    author_name: item.author_name || item.person || raw.user_name || raw.created_by || 'Anggota Tim',
    author_job: item.author_job || item.category || raw.work_category || 'Divisi Kreatif',
    avatar_url: item.avatar_url || raw.avatar_url || null,
    raw_data: raw,
  };
};

const getStatusBadge = (status: string) => {
  const s = String(status || '').toLowerCase().replace(/_/g, ' ');
  if (s.includes('selesai') || s.includes('complete') || s.includes('done')) {
    return {
      label: 'Selesai',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      dotClass: 'bg-emerald-500',
    };
  }
  if (s.includes('review') || s.includes('in review') || s.includes('butuh review')) {
    return {
      label: 'In Review',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    label: 'Sedang Berjalan',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    dotClass: 'bg-blue-500',
  };
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.replace('T', ' ').split(' ');
    const dateParts = parts[0].split('-');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthIndex = parseInt(dateParts[1], 10) - 1;
      const day = dateParts[2];
      const timeStr = parts[1] ? parts[1].substring(0, 5) : '';
      return `${day} ${monthNames[monthIndex] || dateParts[1]} ${year}${timeStr ? `, ${timeStr}` : ''}`;
    }
    return dateStr;
  } catch (_) {
    return dateStr;
  }
};

export const LaporanView: React.FC<LaporanViewProps> = ({
  reports: initialReportsProp = [],
  isAdmin = false,
  onNavigate,
  onSelectReport,
  onDeleteReport,
  onResetReports,
  onAddToast,
}) => {
  // 1. Initial State from In-Memory Fast Cache (0ms Instant Load)
  const cachedData = getCachedData<any>(REPORT_ENDPOINT);

  const [counters, setCounters] = useState<{
    total: number;
    selesai: number;
    review: number;
    sedang_berjalan: number;
  }>(() => {
    try {
      const cached = localStorage.getItem('lw_reports_counters_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    if (cachedData && cachedData.counters) {
      return cachedData.counters;
    }
    const total = initialReportsProp.length;
    const selesai = initialReportsProp.filter((r) => String(r.status).toLowerCase().includes('complete')).length;
    const review = initialReportsProp.filter((r) => String(r.status).toLowerCase().includes('review')).length;
    const sedang_berjalan = Math.max(0, total - selesai - review);
    return total > 0 ? { total, selesai, review, sedang_berjalan } : { total: 94, selesai: 82, review: 5, sedang_berjalan: 7 };
  });

  const [reportItems, setReportItems] = useState<DailyReportItem[]>(() => {
    try {
      const cached = localStorage.getItem('lw_reports_data_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : (parsed.data || []);
        if (Array.isArray(list) && list.length > 0) return list.map(normalizeReport);
      }
    } catch (_) {}
    if (cachedData && Array.isArray(cachedData.data)) {
      return cachedData.data.map(normalizeReport);
    }
    return initialReportsProp.map(normalizeReport);
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !cachedData && initialReportsProp.length === 0;
  });

  const [filterTab, setFilterTab] = useState<'Semua' | 'In Review' | 'Sedang Berjalan' | 'Selesai'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportToDelete, setReportToDelete] = useState<DailyReportItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Sync with initialReportsProp if passed
  useEffect(() => {
    if (Array.isArray(initialReportsProp) && initialReportsProp.length > 0) {
      setReportItems(initialReportsProp.map(normalizeReport));
      try {
        localStorage.setItem('lw_reports_data_cache', JSON.stringify(initialReportsProp));
      } catch (_) {}
    }
  }, [initialReportsProp]);

  // 2. Fetch Data Laporan & Counter Statistik dari API Berkecepatan Tinggi
  const loadReports = async (_isBackground = false) => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('laporanwee_token') ||
          ''
        : '';

    try {
      const json: any = await fetchWithFastCache(REPORT_ENDPOINT, {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      });

      if (json && json.success) {
        if (json.counters) {
          setCounters(json.counters);
          try {
            localStorage.setItem('lw_reports_counters_cache', JSON.stringify(json.counters));
          } catch (_) {}
        }
        if (Array.isArray(json.data)) {
          setReportItems(json.data.map(normalizeReport));
          try {
            localStorage.setItem('lw_reports_data_cache', JSON.stringify(json.data));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Gagal mengambil laporan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // 3. Filter Tab & Search Bar Frontend Instan
  const filteredReports = useMemo(() => {
    return reportItems.filter((item) => {
      const badge = getStatusBadge(item.status);
      if (filterTab !== 'Semua') {
        if (filterTab === 'Selesai' && badge.label !== 'Selesai') return false;
        if (filterTab === 'In Review' && badge.label !== 'In Review') return false;
        if (filterTab === 'Sedang Berjalan' && badge.label !== 'Sedang Berjalan') return false;
      }
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchAuthor = item.author_name.toLowerCase().includes(query);
        const matchJob = item.author_job.toLowerCase().includes(query);
        if (!matchTitle && !matchAuthor && !matchJob) return false;
      }
      return true;
    });
  }, [reportItems, filterTab, searchQuery]);

  const handleOpenDetail = (id: number | string) => {
    onSelectReport(String(id));
    onNavigate('report-detail');
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);
    try {
      if (onDeleteReport) {
        await onDeleteReport(String(reportToDelete.id));
      }
      invalidateCache(REPORT_ENDPOINT);
      setReportItems((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      setCounters((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setReportToDelete(null);
      if (onAddToast) onAddToast('Laporan berhasil dihapus.');
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsDeleting(true);
    try {
      if (onResetReports) {
        await onResetReports();
      }
      invalidateCache(REPORT_ENDPOINT);
      setReportItems([]);
      setCounters({ total: 0, selesai: 0, review: 0, sedang_berjalan: 0 });
      setIsResetModalOpen(false);
      if (onAddToast) onAddToast('Semua laporan kerja berhasil direset.');
    } catch (_) {
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="view w-full flex flex-col gap-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
            Laporan Kerja Harian
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Catatan progres, milestone, dan aktivitas seluruh tim kreatif Wee Studio.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Icon name="trash" style={{ width: 15, height: 15 }} />
              <span>Reset Laporan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('create-report')}
            className="px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Icon name="plus" style={{ width: 16, height: 16 }} />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Chips Header Counter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Laporan */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card flex items-center gap-3.5 transition-all hover:scale-[1.01]">
          <div className="w-11 h-11 rounded-2xl bg-[#1e1d2b] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <Icon name="doc" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-none">
              {counters.total}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
              Total Laporan
            </div>
          </div>
        </div>

        {/* Selesai */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card flex items-center gap-3.5 transition-all hover:scale-[1.01]">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Icon name="target" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-none">
              {counters.selesai}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
              Selesai
            </div>
          </div>
        </div>

        {/* Butuh Review */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card flex items-center gap-3.5 transition-all hover:scale-[1.01]">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Icon name="clock" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-none">
              {counters.review}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
              Butuh Review
            </div>
          </div>
        </div>

        {/* Sedang Berjalan */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card flex items-center gap-3.5 transition-all hover:scale-[1.01]">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Icon name="activity" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-none">
              {counters.sedang_berjalan}
            </div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
              Sedang Berjalan
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs overflow-x-auto">
          {(['Semua', 'In Review', 'Sedang Berjalan', 'Selesai'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterTab === tab
                  ? 'bg-[#1e1d2b] text-white dark:bg-[#d4ee6b] dark:text-[#1e1d2b] shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {tab === 'Semua' ? `Semua (${reportItems.length})` : tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px] sm:w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon name="search" style={{ width: 16, height: 16 }} />
          </span>
          <input
            type="text"
            placeholder="Cari tugas, nama tim, atau proyek..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#22202e] text-gray-900 dark:text-white outline-none focus:border-[#d4ee6b] transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main List Section */}
      {isLoading && reportItems.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10">
          <div className="w-10 h-10 rounded-2xl bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Icon name="doc" style={{ width: 18, height: 18 }} />
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-300">Menyinkronkan Laporan Kerja...</p>
          <p className="text-xs mt-1">Mengambil data terbaru dari server performa tinggi.</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-6">
          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Tidak ada laporan ditemukan</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau ubah tab status di atas untuk melihat laporan lainnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const badge = getStatusBadge(report.status);
            return (
              <div
                key={report.id}
                onClick={() => handleOpenDetail(report.id)}
                className="group relative p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card hover:shadow-xl hover:border-black/15 dark:hover:border-white/25 transition-all duration-300 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Top: Status Badge & Submit Time */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${badge.className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                      {badge.label}
                    </span>

                    <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                      {formatDateTime(report.created_at)}
                    </span>
                  </div>

                  {/* Judul Laporan */}
                  <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-[#d4ee6b] transition-colors">
                    {report.title}
                  </h3>
                </div>

                {/* Bottom Section: Progress Bar & Author */}
                <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5">
                  {/* Progress Bar */}
                  <div className="mb-3.5">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-gray-500 dark:text-gray-400 text-[11px]">Progres Kerja</span>
                      <span className="text-gray-900 dark:text-white font-bold">{report.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#d4ee6b] transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, report.progress))}%` }}
                      />
                    </div>
                  </div>

                  {/* Pembuat Laporan & Tombol Aksi */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1e1d2b] to-[#403b60] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden shadow-xs">
                        {report.avatar_url ? (
                          <img
                            src={report.avatar_url}
                            alt={report.author_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          report.author_name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {report.author_name}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate uppercase tracking-wider font-medium">
                          {report.author_job}
                        </div>
                      </div>
                    </div>

                    {isAdmin && onDeleteReport && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportToDelete(report);
                        }}
                        title="Hapus Laporan"
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                      >
                        <Icon name="trash" style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Laporan */}
      {reportToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setReportToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#181622] p-6 shadow-2xl border border-white/60 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <Icon name="trash" style={{ width: 22, height: 22 }} />
            </div>
            <h3 className="text-base font-bold text-center text-gray-900 dark:text-white">
              Hapus Laporan Ini?
            </h3>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 mb-6">
              Laporan &quot;{reportToDelete.title}&quot; akan dihapus secara permanen dari basis data.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Laporan */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#181622] p-6 shadow-2xl border border-white/60 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <Icon name="alert" style={{ width: 22, height: 22 }} />
            </div>
            <h3 className="text-base font-bold text-center text-gray-900 dark:text-white">
              Reset Semua Laporan?
            </h3>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 mb-6">
              Tindakan ini akan menghapus seluruh data laporan kerja harian. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isDeleting ? 'Mereset...' : 'Ya, Reset Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReportsView = LaporanView;
export default LaporanView;
