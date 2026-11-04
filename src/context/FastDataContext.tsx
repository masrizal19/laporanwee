import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Report, Activity } from '../types';
import { fetchWithCache } from '../utils/apiCache';
import { mapRawDailyReportToReport, normalizeFileUrl } from '../utils/api';

export interface FastCounters {
  total: number;
  selesai: number;
  review: number;
  sedang_berjalan: number;
}

export interface FastFileItem {
  id: number | string;
  name: string;
  url: string;
  thumbnail_url?: string;
  size?: number;
  kind?: 'image' | 'video' | 'doc';
  created_at?: string;
  project_id?: number | string;
}

export interface StoreState {
  reports: Report[];
  counters: FastCounters;
  activities: Activity[];
  files: FastFileItem[];
  lastFetch: Record<string, number>;
}

const DEFAULT_COUNTERS: FastCounters = {
  total: 94,
  selesai: 83,
  review: 5,
  sedang_berjalan: 6,
};

// Data awal persisten dari localStorage agar saat refresh (F5) langsung muncul tanpa jeda (0ms)
const getInitialStore = (): StoreState => {
  try {
    const rawReports =
      localStorage.getItem('lw_store_reports') ||
      localStorage.getItem('lw_reports_data_cache') ||
      localStorage.getItem('laporanwee_daily_reports_cache') ||
      '[]';
    const rawCounters =
      localStorage.getItem('lw_store_counters') ||
      localStorage.getItem('lw_reports_counters_cache') ||
      JSON.stringify(DEFAULT_COUNTERS);
    const rawActivities =
      localStorage.getItem('lw_store_activities') ||
      localStorage.getItem('cache_activities_120') ||
      localStorage.getItem('laporanwee_activities_cache') ||
      '[]';
    const rawFiles =
      localStorage.getItem('lw_store_files') ||
      localStorage.getItem('cache_project_documents') ||
      '[]';

    const parsedReports = JSON.parse(rawReports);
    const reportsList = Array.isArray(parsedReports)
      ? parsedReports.map((item: any) => (item.task && item.status ? item : mapRawDailyReportToReport(item)))
      : [];

    const parsedCounters = JSON.parse(rawCounters);
    const counters: FastCounters = {
      total: Number(parsedCounters?.total) || DEFAULT_COUNTERS.total,
      selesai: Number(parsedCounters?.selesai) || DEFAULT_COUNTERS.selesai,
      review: Number(parsedCounters?.review) || DEFAULT_COUNTERS.review,
      sedang_berjalan: Number(parsedCounters?.sedang_berjalan) || DEFAULT_COUNTERS.sedang_berjalan,
    };

    const parsedActivities = JSON.parse(rawActivities);
    const activitiesList = Array.isArray(parsedActivities) ? parsedActivities : [];

    const parsedFiles = JSON.parse(rawFiles);
    const filesList = Array.isArray(parsedFiles) ? parsedFiles : [];

    return {
      reports: reportsList,
      counters,
      activities: activitiesList,
      files: filesList,
      lastFetch: {},
    };
  } catch (_) {
    return {
      reports: [],
      counters: DEFAULT_COUNTERS,
      activities: [],
      files: [],
      lastFetch: {},
    };
  }
};

// Singleton in-memory store yang hidup di luar lifecycle React komponen
const globalMemoryStore: StoreState = getInitialStore();

export interface FastDataContextType {
  reports: Report[];
  counters: FastCounters;
  activities: Activity[];
  files: FastFileItem[];
  isReportsLoading: boolean;
  isActivitiesLoading: boolean;
  isFilesLoading: boolean;
  prefetchReports: () => void;
  prefetchActivities: () => void;
  prefetchChat: () => void;
  prefetchFiles: (projectId?: string | number) => void;
  refreshReports: (silent?: boolean) => Promise<Report[]>;
  refreshActivities: (silent?: boolean) => Promise<Activity[]>;
  refreshFiles: (projectId?: string | number, silent?: boolean) => Promise<FastFileItem[]>;
  setReports: (reports: Report[]) => void;
  setCounters: (counters: FastCounters) => void;
  deleteReportFromStore: (id: string | number) => void;
  resetReportsInStore: () => void;
}

const FastDataContext = createContext<FastDataContextType | null>(null);

const PREFETCH_THROTTLE_MS = 15000; // 15 detik validitas prefetch

export const FastDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reports, setReportsState] = useState<Report[]>(globalMemoryStore.reports);
  const [counters, setCountersState] = useState<FastCounters>(globalMemoryStore.counters);
  const [activities, setActivitiesState] = useState<Activity[]>(globalMemoryStore.activities);
  const [files, setFilesState] = useState<FastFileItem[]>(globalMemoryStore.files);

  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);

  const inFlightRef = useRef<Record<string, boolean>>({});

  // Helper untuk update state dan cache lokal sinkron
  const updateReports = useCallback((newReports: Report[]) => {
    globalMemoryStore.reports = newReports;
    setReportsState(newReports);
    try {
      localStorage.setItem('lw_store_reports', JSON.stringify(newReports));
      localStorage.setItem('lw_reports_data_cache', JSON.stringify(newReports));
    } catch (_) {}
  }, []);

  const updateCounters = useCallback((newCounters: FastCounters) => {
    globalMemoryStore.counters = newCounters;
    setCountersState(newCounters);
    try {
      localStorage.setItem('lw_store_counters', JSON.stringify(newCounters));
      localStorage.setItem('lw_reports_counters_cache', JSON.stringify(newCounters));
    } catch (_) {}
  }, []);

  const updateActivities = useCallback((newActivities: Activity[]) => {
    globalMemoryStore.activities = newActivities;
    setActivitiesState(newActivities);
    try {
      localStorage.setItem('lw_store_activities', JSON.stringify(newActivities));
      localStorage.setItem('cache_activities_120', JSON.stringify(newActivities));
    } catch (_) {}
  }, []);

  const updateFiles = useCallback((newFiles: FastFileItem[]) => {
    globalMemoryStore.files = newFiles;
    setFilesState(newFiles);
    try {
      localStorage.setItem('lw_store_files', JSON.stringify(newFiles));
    } catch (_) {}
  }, []);

  // 1. Refresh Reports (Silent Stale-While-Revalidate)
  const refreshReports = useCallback(async (silent = true): Promise<Report[]> => {
    if (inFlightRef.current['reports']) {
      return globalMemoryStore.reports;
    }
    inFlightRef.current['reports'] = true;
    if (!silent && globalMemoryStore.reports.length === 0) {
      setIsReportsLoading(true);
    }

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('laporanwee_token') ||
            ''
          : '';

      const res: any = await fetchWithCache(
        'https://api-laporanwe.mkverse.my.id/api/daily-reports/list.php',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
        'daily_reports'
      );

      if (res) {
        let items: any[] = [];
        if (Array.isArray(res.data)) items = res.data;
        else if (Array.isArray(res.reports)) items = res.reports;
        else if (Array.isArray(res)) items = res;

        if (items.length > 0) {
          const mapped = items.map((item: any) =>
            item.task && item.status ? item : mapRawDailyReportToReport(item)
          );
          updateReports(mapped);

          const total = res.counters?.total ?? mapped.length;
          const selesai = res.counters?.selesai ?? mapped.filter((r: any) => r.status === 'Completed').length;
          const review = res.counters?.review ?? mapped.filter((r: any) => r.status === 'In Review').length;
          const sedang_berjalan =
            res.counters?.sedang_berjalan ??
            mapped.filter(
              (r: any) =>
                (r.status as string) === 'In Progress' ||
                (r.status as string) === 'Sedang Berjalan' ||
                r.status === 'To Do'
            ).length;

          const computedCounters: FastCounters = { total, selesai, review, sedang_berjalan };
          updateCounters(computedCounters);
          globalMemoryStore.lastFetch['reports'] = Date.now();
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[FastData] Silent refreshReports error:', err);
    } finally {
      inFlightRef.current['reports'] = false;
      setIsReportsLoading(false);
    }
    return globalMemoryStore.reports;
  }, [updateReports, updateCounters]);

  // 2. Refresh Activities (Silent Stale-While-Revalidate)
  const refreshActivities = useCallback(async (silent = true): Promise<Activity[]> => {
    if (inFlightRef.current['activities']) {
      return globalMemoryStore.activities;
    }
    inFlightRef.current['activities'] = true;
    if (!silent && globalMemoryStore.activities.length === 0) {
      setIsActivitiesLoading(true);
    }

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('laporanwee_token') ||
            ''
          : '';

      const res: any = await fetchWithCache(
        'https://api-laporanwe.mkverse.my.id/api/activities/list.php',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
        'activities_120'
      );

      if (res && (Array.isArray(res.data) || Array.isArray(res))) {
        const rawList = Array.isArray(res.data) ? res.data : res;
        if (rawList.length > 0) {
          updateActivities(rawList);
          globalMemoryStore.lastFetch['activities'] = Date.now();
          return rawList;
        }
      }
    } catch (err) {
      console.warn('[FastData] Silent refreshActivities error:', err);
    } finally {
      inFlightRef.current['activities'] = false;
      setIsActivitiesLoading(false);
    }
    return globalMemoryStore.activities;
  }, [updateActivities]);

  // 3. Refresh Files (36 Berkas Proyek)
  const refreshFiles = useCallback(async (projectId?: string | number, silent = true): Promise<FastFileItem[]> => {
    const key = `files_${projectId || 'all'}`;
    if (inFlightRef.current[key]) {
      return globalMemoryStore.files;
    }
    inFlightRef.current[key] = true;
    if (!silent && globalMemoryStore.files.length === 0) {
      setIsFilesLoading(true);
    }

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('laporanwee_token') ||
            ''
          : '';

      const endpoint = projectId
        ? `https://api-laporanwe.mkverse.my.id/api/project-documents/list.php?project_id=${projectId}`
        : 'https://api-laporanwe.mkverse.my.id/api/files/list.php';

      const res: any = await fetchWithCache(
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
        'files_list'
      );

      if (res && Array.isArray(res.data) && res.data.length > 0) {
        const mappedFiles: FastFileItem[] = res.data.map((doc: any, idx: number) => {
          const rawUrl =
            doc.file_url ||
            doc.url ||
            doc.preview_url ||
            `https://api-laporanwe.mkverse.my.id/api/project-documents/original.php?id=${doc.id}`;
          const normUrl = normalizeFileUrl(rawUrl);
          const name = doc.original_name || doc.file_name || doc.name || `Berkas #${idx + 1}`;
          const isImg = /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(name) || doc.mime_type?.startsWith('image/') || doc.type === 'Gambar';
          const isVid = /\.(mp4|webm|mov|m4v)$/i.test(name) || doc.mime_type?.startsWith('video/') || doc.type === 'Video';

          return {
            id: doc.id || `file_${idx}`,
            name,
            url: normUrl,
            thumbnail_url: isImg ? normUrl : doc.thumbnail_url ? normalizeFileUrl(doc.thumbnail_url) : undefined,
            size: Number(doc.file_size || doc.size) || 0,
            kind: isImg ? 'image' : isVid ? 'video' : 'doc',
            created_at: doc.created_at || doc.upload_date || '',
            project_id: doc.project_id,
          };
        });

        if (mappedFiles.length > 0) {
          updateFiles(mappedFiles);
          try {
            localStorage.setItem('lw_files_list_cache', JSON.stringify(res.data));
            if (res.counters) {
              localStorage.setItem('lw_files_counters_cache', JSON.stringify(res.counters));
            }
          } catch (_) {}
          globalMemoryStore.lastFetch[key] = Date.now();
          return mappedFiles;
        }
      }
    } catch (err) {
      console.warn('[FastData] Silent refreshFiles error:', err);
    } finally {
      inFlightRef.current[key] = false;
      setIsFilesLoading(false);
    }
    return globalMemoryStore.files;
  }, [updateFiles]);

  // 4. Hover Prefetching Actions: Triggered on Mouse Enter di Navigasi Sidebar (~150ms prefetch buffer)
  const prefetchReports = useCallback(() => {
    const last = globalMemoryStore.lastFetch['reports'] || 0;
    if (Date.now() - last > PREFETCH_THROTTLE_MS) {
      refreshReports(true);
    }
  }, [refreshReports]);

  const prefetchActivities = useCallback(() => {
    const last = globalMemoryStore.lastFetch['activities'] || 0;
    if (Date.now() - last > PREFETCH_THROTTLE_MS) {
      refreshActivities(true);
    }
  }, [refreshActivities]);

  const prefetchChat = useCallback(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          ''
        : '';
    if (!token) return;

    const last = globalMemoryStore.lastFetch['chat'] || 0;
    if (Date.now() - last > PREFETCH_THROTTLE_MS) {
      globalMemoryStore.lastFetch['chat'] = Date.now();
      // Prefetch obrolan kontak & percakapan secara pasif
      fetch('https://api-laporanwe.mkverse.my.id/api/chat/contacts.php', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, []);

  const prefetchFiles = useCallback((projectId?: string | number) => {
    const key = `files_${projectId || 'all'}`;
    const last = globalMemoryStore.lastFetch[key] || 0;
    if (Date.now() - last > PREFETCH_THROTTLE_MS) {
      refreshFiles(projectId, true);
    }
  }, [refreshFiles]);

  const deleteReportFromStore = useCallback((id: string | number) => {
    const targetId = String(id).trim();
    const updated = globalMemoryStore.reports.filter((r) => String(r.id).trim() !== targetId);
    updateReports(updated);
    const updatedCounters = {
      ...globalMemoryStore.counters,
      total: Math.max(0, globalMemoryStore.counters.total - 1),
    };
    updateCounters(updatedCounters);
  }, [updateReports, updateCounters]);

  const resetReportsInStore = useCallback(() => {
    updateReports([]);
    const clearedCounters = { total: 0, selesai: 0, review: 0, sedang_berjalan: 0 };
    updateCounters(clearedCounters);
  }, [updateReports, updateCounters]);

  // Initial passive hydration sync on mount
  useEffect(() => {
    refreshReports(true);
    refreshActivities(true);
  }, [refreshReports, refreshActivities]);

  const value: FastDataContextType = {
    reports,
    counters,
    activities,
    files,
    isReportsLoading,
    isActivitiesLoading,
    isFilesLoading,
    prefetchReports,
    prefetchActivities,
    prefetchChat,
    prefetchFiles,
    refreshReports,
    refreshActivities,
    refreshFiles,
    setReports: updateReports,
    setCounters: updateCounters,
    deleteReportFromStore,
    resetReportsInStore,
  };

  return <FastDataContext.Provider value={value}>{children}</FastDataContext.Provider>;
};

export const useFastData = (): FastDataContextType => {
  const context = useContext(FastDataContext);
  if (!context) {
    // Fallback safe context if called outside provider
    return {
      reports: globalMemoryStore.reports,
      counters: globalMemoryStore.counters,
      activities: globalMemoryStore.activities,
      files: globalMemoryStore.files,
      isReportsLoading: false,
      isActivitiesLoading: false,
      isFilesLoading: false,
      prefetchReports: () => {},
      prefetchActivities: () => {},
      prefetchChat: () => {},
      prefetchFiles: () => {},
      refreshReports: async () => globalMemoryStore.reports,
      refreshActivities: async () => globalMemoryStore.activities,
      refreshFiles: async () => globalMemoryStore.files,
      setReports: () => {},
      setCounters: () => {},
      deleteReportFromStore: () => {},
      resetReportsInStore: () => {},
    };
  }
  return context;
};

// Global direct export functions for usage anywhere
export const getGlobalFastStore = (): StoreState => globalMemoryStore;
