import React from 'react';

export const GaleriBerkasView: React.FC = () => {
  return (
    <div className="flex-1 h-[calc(100vh-24px)] my-3 mr-4 ml-2 flex flex-col min-w-0">
      {/* HANYA SATU CONTAINER ROUNDED UTAMA SESUAI STANDAR WEB KITA */}
      <div className="w-full h-full rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#1a1824]/70 backdrop-blur-2xl shadow-xl flex flex-col min-h-0">
        <iframe
          src="https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php"
          title="Lampiran & Berkas Proyek"
          className="w-full h-full border-0 block flex-1 bg-transparent"
          allow="clipboard-write; camera; microphone"
        />
      </div>
    </div>
  );
};

export default GaleriBerkasView;
