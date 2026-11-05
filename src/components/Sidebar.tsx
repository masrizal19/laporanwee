import React from 'react';
import { ViewType } from '../types';
import { useFastData } from '../context/FastDataContext';

export interface NavMenuItem {
  id: string;
  view?: ViewType;
  label: string;
  path: string;
  icon: React.ReactNode;
}

export interface SidebarProps {
  currentPath?: string;
  currentView?: ViewType;
  onNavigate?: (pathOrView: string) => void;
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string | null;
  logoUrl?: string | null;
}

export const NAV_MENU_ITEMS: NavMenuItem[] = [
  {
    id: 'dashboard',
    view: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    id: 'proyek',
    view: 'projects',
    label: 'Proyek',
    path: '/proyek',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    id: 'lampiran',
    view: 'galeri-lampiran',
    label: 'Lampiran & Berkas',
    path: '/galeri-lampiran',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: 'laporan',
    view: 'reports',
    label: 'Laporan',
    path: '/laporan',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
  {
    id: 'tugas',
    view: 'tasks',
    label: 'Tugas',
    path: '/tugas',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    ),
  },
  {
    id: 'chat',
    view: 'chat',
    label: 'Pesan Tim',
    path: '/chat',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'sosial-media',
    view: 'social-media',
    label: 'Sosial Media',
    path: '/sosial-media',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
    ),
  },
  {
    id: 'tim',
    view: 'team',
    label: 'Tim',
    path: '/tim',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
        <circle cx="17" cy="8" r="2.6" />
        <path d="M16 14.3c2.6.5 4.5 2.6 4.5 5.7" />
      </svg>
    ),
  },
  {
    id: 'kalender',
    view: 'calendar',
    label: 'Kalender',
    path: '/kalender',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: 'analitik',
    view: 'analytics',
    label: 'Analitik',
    path: '/analitik',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    id: 'pengajuan-barang',
    view: 'pengajuan-barang',
    label: 'Pengajuan Barang',
    path: '/pengajuan-barang',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    id: 'profil',
    view: 'profil',
    label: 'Pengaturan Profil',
    path: '/profil',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    id: 'ui-settings',
    view: 'ui_settings',
    label: 'UI Setting',
    path: '/ui-settings',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath = '/dashboard',
  currentView,
  onNavigate,
  onLogout,
  logoUrl,
}) => {
  const { prefetchReports, prefetchActivities, prefetchChat } = useFastData();

  const handleHoverPrefetch = (itemId: string, view?: ViewType) => {
    if (itemId === 'laporan' || view === 'reports') {
      prefetchReports();
    } else if (itemId === 'tim' || view === 'team') {
      prefetchActivities();
    } else if (itemId === 'chat' || view === 'chat') {
      prefetchChat();
    }
  };

  return (
    <aside className="w-64 h-full bg-white/80 backdrop-blur-md border-r border-black/10 flex flex-col p-4">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-3 py-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-[#1e1d2b] flex items-center justify-center text-white shadow-md flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13c3-6 11-6 14 0M8 17c2-3 6-3 8 0" />
            </svg>
          )}
        </div>
        <div className="font-bold text-lg text-gray-900 tracking-tight">
          Laporan<span className="text-violet-600">Wee</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
        {NAV_MENU_ITEMS.map((item) => {
          const isActive =
            (item.path && currentPath === item.path) ||
            (item.view && currentView === item.view) ||
            (item.id === 'chat' && (currentPath === '/chat' || currentPath === '/chat/preview-file' || currentView === 'chat'));

          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => handleHoverPrefetch(item.id, item.view)}
              onClick={() => {
                if (onNavigate) {
                  onNavigate(item.view || item.path);
                }
              }}
              className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-200 text-left w-full cursor-pointer ${
                isActive
                  ? 'bg-[#1e1d2b] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sign Out */}
      {onLogout && (
        <div className="pt-4 border-t border-black/5 mt-auto">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-red-600 hover:bg-red-50 transition-all duration-200 w-full text-left cursor-pointer"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            <span className="text-sm font-medium">Keluar</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
