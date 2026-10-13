import React from 'react';
import { getStoredToken } from '../utils/api';

export const ExportLaporanStandalone: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const month = searchParams.get('month') || (new Date().getMonth() + 1);
  const year = searchParams.get('year') || new Date().getFullYear();
  const format = searchParams.get('format');
  const token = getStoredToken() || localStorage.getItem('auth_token') || '';

  const srcUrl = format === 'jpg'
    ? `https://api-laporanwe.mkverse.my.id/api/analytics/export.php?format=jpg&month=${month}&year=${year}&token=${token}`
    : `https://api-laporanwe.mkverse.my.id/api/analytics/export/index.php?month=${month}&year=${year}`;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-[#8a8c93] overflow-hidden flex flex-col">
      <iframe
        src={srcUrl}
        title="Ekspor Laporan"
        className="w-full h-full border-0 block"
      />
    </div>
  );
};
