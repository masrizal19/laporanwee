import React, { useState, useEffect, useMemo } from 'react';
import { Report, ViewType } from '../types';
import { Icon } from '../components/icons';
import { fetchWithFastCache, getCachedData, invalidateCache } from '../utils/apiCache';
import { useFastData } from '../context/FastDataContext';
import { AttachmentPreviewModal, AttachmentPreviewData } from '../components/AttachmentPreviewModal';

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
  const { reports: fastReports, counters: fastCounters, refreshReports } = useFastData();

  useEffect(() => {
    const handleOpen = () => setShowReportFilesModal(true);
    window.addEventListener('OPEN_REPORT_FILES_MODAL', handleOpen);
    return () => window.removeEventListener('OPEN_REPORT_FILES_MODAL', handleOpen);
  }, []);

  // 1. Initial State from Fast Data Store or Local Cache (0ms Instant Load)
  const [counters, setCounters] = useState<{
    total: number;
    selesai: number;
    review: number;
    sedang_berjalan: number;
  }>(() => {
    if (fastCounters && fastCounters.total > 0) {
      return fastCounters;
    }
    try {
      const cached =
        localStorage.getItem('lw_counters_cache') ||
        localStorage.getItem('lw_store_counters') ||
        localStorage.getItem('lw_reports_counters_cache');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return { total: 94, selesai: 83, review: 5, sedang_berjalan: 6 };
  });

  const [reportItems, setReportItems] = useState<DailyReportItem[]>(() => {
    if (Array.isArray(initialReportsProp) && initialReportsProp.length > 0) {
      return initialReportsProp.map(normalizeReport);
    }
    if (Array.isArray(fastReports) && fastReports.length > 0) {
      return fastReports.map(normalizeReport);
    }
    try {
      const cached =
        localStorage.getItem('lw_reports_cache') ||
        localStorage.getItem('lw_store_reports') ||
        localStorage.getItem('lw_reports_data_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : (parsed.data || []);
        if (Array.isArray(list) && list.length > 0) return list.map(normalizeReport);
      }
    } catch (_) {}
    return [];
  });

  const [filterTab, setFilterTab] = useState<'Semua' | 'In Review' | 'Sedang Berjalan' | 'Selesai'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportToDelete, setReportToDelete] = useState<DailyReportItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<AttachmentPreviewData | null>(null);

  // TITIK JANGKAR 1: STATE & EKSTRAKSI DATA BERKAS
  const [showReportFilesModal, setShowReportFilesModal] = useState<boolean>(false);
  const [searchFileQuery, setSearchFileQuery] = useState<string>('');

  // Modal File Laporan State & Data
  const [openFileModal, setOpenFileModal] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [reportFiles, setReportFiles] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('lw_report_files_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  useEffect(() => {
    fetch('https://api-laporanwe.mkverse.my.id/api/daily-reports/files.php')
      .then((r) => r.json())
      .then((json) => {
        if (json && json.success && Array.isArray(json.data)) {
          setReportFiles(json.data);
          try {
            localStorage.setItem('lw_report_files_cache', JSON.stringify(json.data));
          } catch (_) {}
        }
      })
      .catch((err) => console.warn('Fetch report files error:', err));
  }, []);

  // Ekstraksi otomatis seluruh berkas dari state 'reportItems' / 'initialReportsProp'
  const allReportFiles = useMemo(() => {
    const list: any[] = [];
    const source = Array.isArray(reportItems) && reportItems.length > 0 ? reportItems : Array.isArray(initialReportsProp) ? initialReportsProp : [];
    if (Array.isArray(source)) {
      source.forEach((r: any) => {
        const raw = r.raw_data || r;
        const fileUrl = r.file_url || raw.file_url || raw.evidence_url || raw.attachment || raw.file_path;
        if (fileUrl) {
          list.push({
            id: `file_${r.id}`,
            file_name: raw.file_name || raw.original_name || `${r.title || r.task || 'Berkas'}.jpg`,
            file_url: fileUrl,
            report_title: r.title || r.task || 'Laporan Kerja',
            report_date: r.created_at || r.report_date || r.date || 'Hari ini',
            worker_name: r.author_name || r.person || 'Tim LaporanWee',
            worker_avatar: r.avatar_url || raw.avatar_url || null
          });
        }
        const atts = raw.attachments || r.attachments || r.evidence_urls;
        if (Array.isArray(atts) && atts.length > 0) {
          atts.forEach((att: any, idx: number) => {
            const attUrl = typeof att === 'string' ? att : att.url || att.file_url;
            const attName = typeof att === 'string' ? `${r.title || r.task || 'Lampiran'} (${idx + 1})` : att.name || att.file_name || `${r.title || r.task || 'Lampiran'} (${idx + 1})`;
            if (attUrl && attUrl !== fileUrl) {
              list.push({
                id: `att_${r.id}_${idx}`,
                file_name: attName,
                file_url: attUrl,
                report_title: r.title || r.task || 'Laporan Kerja',
                report_date: r.created_at || r.report_date || r.date || 'Hari ini',
                worker_name: r.author_name || r.person || 'Tim LaporanWee',
                worker_avatar: r.avatar_url || raw.avatar_url || null
              });
            }
          });
        }
      });
    }
    if (Array.isArray(reportFiles) && reportFiles.length > 0) {
      reportFiles.forEach((f: any, idx: number) => {
        const fUrl = f.file_url || f.url || f.file_path;
        if (fUrl && !list.some((existing) => existing.file_url === fUrl)) {
          list.push({
            id: f.id || `api_file_${idx}`,
            file_name: f.file_name || f.original_name || f.name || `File_${idx + 1}`,
            file_url: fUrl,
            report_title: f.report_title || f.task || 'Laporan Kerja',
            report_date: f.report_date || f.created_at || f.date || 'Hari ini',
            worker_name: f.worker_name || f.author_name || f.person || 'Tim LaporanWee',
            worker_avatar: f.worker_avatar || f.avatar_url || null
          });
        }
      });
    }
    return list;
  }, [reportItems, initialReportsProp, reportFiles]);

  const activeReportFiles = useMemo(() => {
    if (reportFiles.length > 0) return reportFiles;
    const extracted: any[] = [];
    reportItems.forEach((r) => {
      const raw = r.raw_data || {};
      const fileUrl = raw.file_url || raw.evidence_url || raw.attachment || raw.file_path;
      if (fileUrl) {
        extracted.push({
          id: `ext_${r.id}`,
          file_name: raw.file_name || raw.original_name || `Bukti_${r.title}`,
          file_url: fileUrl,
          report_title: r.title,
          worker_name: r.author_name,
          worker_job: r.author_job,
          report_date: r.created_at || r.date || '',
        });
      }
    });
    return extracted;
  }, [reportFiles, reportItems]);

  // Sync saat global store atau initialReportsProp diperbarui
  useEffect(() => {
    if (Array.isArray(fastReports) && fastReports.length > 0) {
      setReportItems(fastReports.map(normalizeReport));
    } else if (Array.isArray(initialReportsProp) && initialReportsProp.length > 0) {
      setReportItems(initialReportsProp.map(normalizeReport));
    }
  }, [fastReports, initialReportsProp]);

  useEffect(() => {
    if (fastCounters && fastCounters.total > 0) {
      setCounters(fastCounters);
    }
  }, [fastCounters]);

  // 2. Di background (useEffect), panggil refreshReports() secara senyap di latar belakang (0ms UI delay)
  useEffect(() => {
    refreshReports(true).catch(() => {});

    // Silent background fetch dengan token sync dari localStorage
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      fetch(REPORT_ENDPOINT, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.json())
        .then((json) => {
          if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
            const norm = json.data.map(normalizeReport);
            setReportItems(norm);
            try {
              localStorage.setItem('lw_reports_cache', JSON.stringify(json.data));
              if (json.counters) {
                setCounters(json.counters);
                localStorage.setItem('lw_counters_cache', JSON.stringify(json.counters));
              }
            } catch (_) {}
          }
        })
        .catch(() => {});
    } catch (_) {}
  }, [refreshReports]);

  // Paksa trigger initial dispatch saat data siap agar viewport/observer langsung mendeteksi kartu
  useEffect(() => {
    if (reportItems && reportItems.length > 0) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
      });
    }
  }, [reportItems]);

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

          <button
            type="button"
            onClick={() => setOpenFileModal(true)}
            className="px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm bg-white/80 dark:bg-[#1f1d2b]/80 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-gray-800 dark:text-white flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Icon name="folder" style={{ width: 16, height: 16 }} />
            <span>File Laporan</span>
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
      {filteredReports.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-white/[0.02] rounded-3xl border border-dashed border-black/10 dark:border-white/10 p-6">
          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Tidak ada laporan ditemukan</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau ubah tab status di atas untuk melihat laporan lainnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReports.map((report, index) => {
            const badge = getStatusBadge(report.status);
            return (
              <div
                key={report.id}
                onClick={() => handleOpenDetail(report.id)}
                style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
                data-motion="none"
                className="group relative p-5 rounded-3xl bg-white/70 dark:bg-[#181622]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-card hover:shadow-xl hover:border-black/15 dark:hover:border-white/25 transition-all duration-300 flex flex-col justify-between cursor-pointer animate-fadeIn"
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

                  {/* Lampiran Bukti Pekerjaan (Thumbnail / Chip) */}
                  {(() => {
                    const raw = report.raw_data || {};
                    const fileUrl = raw.file_url || raw.evidence_url || raw.attachment || raw.file_path;
                    const fileName = raw.file_name || raw.original_name || raw.attachment_name || 'Lampiran Bukti Pekerjaan';
                    const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase() || '';
                    const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || fileUrl?.match(/\.(jpg|jpeg|png|webp)/i);
                    const isVid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext) || fileUrl?.match(/\.(mp4|mov|webm)/i);

                    if (!fileUrl) return null;

                    return (
                      <div className="mt-3">
                        {isImg ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPreview({
                                url: fileUrl,
                                name: fileName,
                                type: 'image',
                                extension: ext,
                              });
                            }}
                            className="group/att relative w-full h-24 rounded-2xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 cursor-pointer shadow-xs"
                          >
                            <img
                              src={fileUrl}
                              alt={fileName}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover/att:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                              <Icon name="search" style={{ width: 14, height: 14 }} />
                              <span>Pratinjau Bukti</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPreview({
                                url: fileUrl,
                                name: fileName,
                                type: isVid ? 'video' : 'document',
                                extension: ext,
                              });
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/10 dark:bg-violet-400/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-500/20 transition-all cursor-pointer truncate max-w-full"
                            title={`Klik untuk pratinjau ${fileName}`}
                          >
                            <span>{isVid ? '🎥' : '📄'}</span>
                            <span className="truncate">{fileName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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

      {/* Modal Berkas & Lampiran Laporan Kerja */}
      {openFileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setOpenFileModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] rounded-3xl bg-white/95 dark:bg-[#181622]/95 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl border border-white/60 dark:border-white/10 flex flex-col gap-5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-motion="none"
          >
            {/* Header Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-[#d4ee6b] flex items-center justify-center font-bold">
                    <Icon name="folder" style={{ width: 18, height: 18 }} />
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                    Berkas &amp; Lampiran Laporan
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Daftar seluruh dokumen dan bukti pekerjaan yang terlampir pada laporan tim ({activeReportFiles.length} berkas).
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search Bar Input */}
                <div className="relative min-w-[200px] sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Icon name="search" style={{ width: 14, height: 14 }} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari berkas, laporan, atau pengerja..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#22202e] text-gray-900 dark:text-white outline-none focus:border-[#d4ee6b]"
                  />
                  {fileSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFileSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenFileModal(false)}
                  className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <Icon name="x" style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            {/* List / Grid Berkas */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[280px]">
              {(() => {
                const filteredFiles = activeReportFiles.filter((file) => {
                  if (!fileSearchQuery.trim()) return true;
                  const q = fileSearchQuery.toLowerCase();
                  const nameMatch = (file.file_name || file.original_name || file.name || '').toLowerCase().includes(q);
                  const titleMatch = (file.report_title || file.task || '').toLowerCase().includes(q);
                  const workerMatch = (file.worker_name || file.author_name || file.person || '').toLowerCase().includes(q);
                  return nameMatch || titleMatch || workerMatch;
                });

                if (filteredFiles.length === 0) {
                  return (
                    <div className="py-16 text-center text-xs text-gray-400 dark:text-gray-500 bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6">
                      <Icon name="folder" style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.5 }} />
                      <p className="font-bold text-gray-700 dark:text-gray-300">Tidak ada berkas terlampir</p>
                      <p className="mt-1">Tidak ditemukan berkas laporan yang sesuai dengan pencarian.</p>
                    </div>
                  );
                }

                return filteredFiles.map((file, idx) => {
                  const fileUrl = file.file_url || file.url || file.file_path || '';
                  const fileName = file.file_name || file.original_name || file.name || `Berkas_Laporan_${idx + 1}`;
                  const reportTitle = file.report_title || file.task || file.title || 'Laporan Kerja Harian';
                  const workerName = file.worker_name || file.author_name || file.person || 'Anggota Tim';
                  const workerJob = file.worker_job || file.author_job || file.category || 'Divisi Kreatif';
                  const reportDate = file.report_date || file.created_at || file.date || '';
                  const ext = (fileName || fileUrl).split('.').pop()?.toLowerCase() || '';
                  const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || fileUrl.match(/\.(jpg|jpeg|png|webp)/i);
                  const isVid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext) || fileUrl.match(/\.(mp4|mov|webm)/i);

                  return (
                    <div
                      key={file.id || idx}
                      className="p-4 rounded-2xl bg-white/70 dark:bg-[#22202e]/80 border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 transition-all flex items-center justify-between gap-4 shadow-xs"
                    >
                      {/* Left Thumbnail / Icon */}
                      <div
                        onClick={() => {
                          setSelectedPreview({
                            url: fileUrl,
                            name: fileName,
                            type: isImg ? 'image' : isVid ? 'video' : 'document',
                            extension: ext,
                            size_formatted: file.file_size_formatted || file.size_formatted,
                          });
                        }}
                        className="w-14 h-14 rounded-xl overflow-hidden bg-black/5 dark:bg-white/10 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/10 cursor-pointer group/thumb relative"
                      >
                        {isImg ? (
                          <>
                            <img
                              src={fileUrl}
                              alt={fileName}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Icon name="search" style={{ width: 14, height: 14 }} />
                            </div>
                          </>
                        ) : (
                          <div className="text-xl">
                            {isVid ? '🎥' : '📄'}
                          </div>
                        )}
                      </div>

                      {/* Middle Metadata */}
                      <div className="flex-1 min-w-0">
                        <div
                          onClick={() => {
                            setSelectedPreview({
                              url: fileUrl,
                              name: fileName,
                              type: isImg ? 'image' : isVid ? 'video' : 'document',
                              extension: ext,
                              size_formatted: file.file_size_formatted || file.size_formatted,
                            });
                          }}
                          className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate cursor-pointer hover:text-violet-600 dark:hover:text-[#d4ee6b] transition-colors"
                          title={fileName}
                        >
                          {fileName}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20 truncate max-w-[200px]">
                            Laporan: {reportTitle}
                          </span>
                          {reportDate && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              🕒 {reportDate.substring(0, 10)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] flex items-center justify-center text-[9px] font-bold">
                            {workerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 truncate">
                            {workerName} <span className="text-[10px] text-gray-400">({workerJob})</span>
                          </span>
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPreview({
                              url: fileUrl,
                              name: fileName,
                              type: isImg ? 'image' : isVid ? 'video' : 'document',
                              extension: ext,
                              size_formatted: file.file_size_formatted || file.size_formatted,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#1e1d2b] dark:bg-[#d4ee6b] text-white dark:text-[#1e1d2b] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Icon name="search" style={{ width: 12, height: 12 }} />
                          <span className="hidden sm:inline">Pratinjau</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TITIK JANGKAR 3: MODAL POPUP BERKAS */}
      {showReportFilesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white/95 dark:bg-[#1a1824]/95 rounded-3xl border border-white/40 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden" data-motion="none">
            
            {/* Header Modal */}
            <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>📁</span> File Berkas Laporan ({allReportFiles.length})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Daftar seluruh dokumen dan bukti pekerjaan yang terlampir pada laporan kerja tim.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportFilesModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Bar Berkas */}
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <input
                type="text"
                value={searchFileQuery}
                onChange={(e) => setSearchFileQuery(e.target.value)}
                placeholder="Cari nama berkas, judul laporan, atau nama pengerja..."
                className="w-full py-2 px-4 rounded-xl text-xs bg-white dark:bg-[#252233] border border-black/10 dark:border-white/10 outline-none text-gray-800 dark:text-white"
              />
            </div>

            {/* Konten Daftar Berkas */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {allReportFiles
                .filter(f => 
                  (f.file_name || '').toLowerCase().includes(searchFileQuery.toLowerCase()) ||
                  (f.report_title || '').toLowerCase().includes(searchFileQuery.toLowerCase()) ||
                  (f.worker_name || '').toLowerCase().includes(searchFileQuery.toLowerCase())
                )
                .map((file) => (
                  <div
                    key={file.id}
                    className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-[#201d2d]/60 hover:bg-white dark:hover:bg-[#252233] transition-all flex items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#d4ee6b]/20 text-[#1f1d2b] dark:text-[#d4ee6b] flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden">
                        {file.file_url && file.file_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                        ) : (
                          '📄'
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {file.file_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[180px]">
                            📋 {file.report_title}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            🕒 {file.report_date ? String(file.report_date).substring(0, 10) : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                          <span>👤 Dikerjakan oleh:</span>
                          <b className="text-gray-700 dark:text-gray-300">{file.worker_name}</b>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const ext = (file.file_name || '').split('.').pop()?.toLowerCase() || '';
                          const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || (file.file_url || '').match(/\.(jpg|jpeg|png|webp)/i);
                          const isVid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext) || (file.file_url || '').match(/\.(mp4|mov|webm)/i);
                          setSelectedPreview({
                            url: file.file_url,
                            name: file.file_name,
                            type: isImg ? 'image' : isVid ? 'video' : 'document',
                            extension: ext,
                          });
                        }}
                        className="py-1.5 px-3 rounded-xl bg-[#d4ee6b] text-[#1f1d2b] text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer"
                      >
                        <span>Buka</span>
                        <span>↗</span>
                      </button>
                    </div>
                  </div>
                ))}

              {allReportFiles.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs">
                  Belum ada berkas lampiran yang diunggah pada laporan kerja.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Modal Lightbox Pratonton Langsung (In-App Preview Modal) */}
      <AttachmentPreviewModal
        preview={selectedPreview}
        onClose={() => setSelectedPreview(null)}
      />
    </div>
  );
};

export const ReportsView = LaporanView;
export default LaporanView;
