import React from 'react';

export const GaleriBerkasView: React.FC = () => {
  return (
    <div 
      className="w-full flex-1 min-w-0 pr-4 pl-1 py-3"
      style={{ minHeight: 'calc(100vh - 24px)' }}
    >
      <div 
        className="w-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#1a1824]/70 backdrop-blur-2xl shadow-xl flex flex-col"
        style={{ height: 'calc(100vh - 28px)', minHeight: 'calc(100vh - 28px)' }}
      >
        <iframe
          src="https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php"
          title="Lampiran & Berkas Proyek"
          className="w-full h-full border-0 block bg-transparent"
          style={{ height: '100%', minHeight: '100%', width: '100%' }}
          allow="clipboard-write; camera; microphone"
        />
      </div>
    </div>
  );
};

export default GaleriBerkasView;
