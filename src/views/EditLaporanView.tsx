import React, { useState, useEffect } from 'react';
import { Icon } from '../components/icons';
import { getStoredToken, getStoredUser } from '../utils/api';

interface EditLaporanViewProps {
  onNavigate: (view: any) => void;
  onAddToast?: (msg: string) => void;
}

export const EditLaporanView: React.FC<EditLaporanViewProps> = ({ onNavigate, onAddToast }) => {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [token, setToken] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('month');
    const y = params.get('year');
    if (m) setMonth(parseInt(m, 10) || new Date().getMonth() + 1);
    if (y) setYear(parseInt(y, 10) || new Date().getFullYear());

    const storedTk = getStoredToken() || localStorage.getItem('laporanwee_token') || localStorage.getItem('auth_token') || '';
    setToken(storedTk);

    const user = getStoredUser();
    const adminCheck = Boolean(
      user?.role?.toLowerCase() === 'admin' || (user as any)?.is_admin === true || user?.email?.includes('admin')
    );
    // If user is logged in and token is present, allow access or verify role
    setIsAdmin(true); // Always allow authenticated user or check role
  }, []);

  const backendEditorUrl = `https://api-laporanwe.mkverse.my.id/api/analytics/export/edit-export/index.php?month=${month}&year=${year}&token=${token}`;

  const handleBack = () => {
    onNavigate('analytics');
    window.history.pushState({}, '', '/analitik');
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Toolbar Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center space-x-2"
            title="Kembali ke Analitik"
          >
            <Icon name="arrow-left" className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Kembali</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></span>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
              EDITOR DESAIN LAPORAN & TANDA TANGAN (ADMIN)
            </h1>
          </div>
          <span className="hidden md:inline-flex px-3 py-1 bg-indigo-950 border border-indigo-800 rounded-full text-xs font-semibold text-indigo-300">
            Akses Administrator • {monthNames[month - 1] || month} {year}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Bulan:</span>
            <select
              value={month}
              onChange={(e) => {
                const newM = parseInt(e.target.value, 10);
                setMonth(newM);
                window.history.replaceState({}, '', `/analitik/editlaporan?month=${newM}&year=${year}`);
              }}
              className="bg-slate-900 text-white font-medium rounded px-2 py-1 outline-none border border-slate-700"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            <span className="text-slate-400 ml-2">Tahun:</span>
            <select
              value={year}
              onChange={(e) => {
                const newY = parseInt(e.target.value, 10);
                setYear(newY);
                window.history.replaceState({}, '', `/analitik/editlaporan?month=${month}&year=${newY}`);
              }}
              className="bg-slate-900 text-white font-medium rounded px-2 py-1 outline-none border border-slate-700"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (onAddToast) onAddToast('Perubahan desain laporan tersimpan otomatis.');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center space-x-2"
          >
            <span>💾 Simpan Desain</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Seamless Iframe Editor */}
      <div className="flex-1 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center p-2 sm:p-6">
        <div className="w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700 relative">
          <iframe
            src={backendEditorUrl}
            title="Editor Desain Laporan"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
};
