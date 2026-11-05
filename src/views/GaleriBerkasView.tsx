import React, { useState, useEffect } from 'react';

export const GaleriBerkasView: React.FC = () => {
  // Tambahkan timestamp dinamis agar browser tidak pernah meng-cache tampilan lama
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());

  useEffect(() => {
    // Refresh otomatis saat komponen diakses ulang
    setCacheBuster(Date.now());
  }, []);

  return (
    <div 
      className="flex-1 w-full min-w-0 bg-[#efefef] overflow-hidden flex flex-col"
      style={{ height: '100vh', minHeight: '100vh', width: '100%' }}
    >
      {/* LIVE SYNC IFRAME: Setiap perubahan CSS/HTML di PHP server langsung tampil di sini */}
      <iframe
        key={cacheBuster}
        src={`https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php?t=${cacheBuster}`}
        title="Galeri Berkas"
        className="w-full h-full border-0 block flex-1 bg-[#efefef]"
        style={{ width: '100%', height: '100%', minHeight: '100vh', border: 'none' }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default GaleriBerkasView;
