import React from 'react';

export const GaleriBerkasView: React.FC = () => {
  return (
    <div className="flex-1 h-[calc(100vh-24px)] my-3 mr-4 ml-2 flex flex-col min-w-0">
      <div className="w-full h-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/40 dark:bg-[#181622]/40 backdrop-blur-2xl shadow-xl flex-1 flex flex-col min-h-0">
        <iframe
          src="https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php"
          title="Galeri Lampiran & Berkas Proyek"
          className="w-full h-full border-none block flex-1"
          allow="clipboard-write; camera; microphone"
        />
      </div>
    </div>
  );
};

export default GaleriBerkasView;
