import React, { useMemo } from 'react';

export const PengajuanBarangExportView: React.FC = () => {
  const id = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('id');
  }, []);

  const token = useMemo(() => {
    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }, []);

  const iframeSrc = useMemo(() => {
    const base = 'https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/index.php';
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    if (token) params.set('token', token);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [id, token]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#eceef3] flex flex-col m-0 p-0">
      <iframe
        src={iframeSrc}
        title="Dokumen Pengajuan Barang"
        className="w-full h-full border-0 block flex-1"
        style={{ width: '100%', height: '100vh', border: 'none' }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default PengajuanBarangExportView;
