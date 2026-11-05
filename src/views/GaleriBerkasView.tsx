import React from 'react';

export const GaleriBerkasView: React.FC = () => {
  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col min-w-0 bg-transparent">
      {/* IFRAME FULL WEB TANPA BORDER ATAU ROUNDED GANDA */}
      <iframe
        src="https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php"
        title="Lampiran & Berkas Proyek"
        className="w-full h-full border-0 block flex-1 bg-transparent"
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default GaleriBerkasView;
