import React from 'react';
import { getStoredToken } from '../utils/api';

export const EditLaporanStandalone: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const month = searchParams.get('month') || (new Date().getMonth() + 1);
  const year = searchParams.get('year') || new Date().getFullYear();
  const token = getStoredToken() || localStorage.getItem('auth_token') || '';

  const srcUrl = `https://api-laporanwe.mkverse.my.id/api/analytics/export/edit-export/index.php?month=${month}&year=${year}&token=${token}`;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-[#1e2029] overflow-hidden flex flex-col">
      <iframe
        src={srcUrl}
        title="Edit Desain Laporan"
        className="w-full h-full border-0 block"
      />
    </div>
  );
};
