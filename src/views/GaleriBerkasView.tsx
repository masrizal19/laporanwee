import React from 'react';

export const GaleriBerkasView: React.FC = () => {
  return (
    <div 
      className="flex-1 w-full min-w-0 bg-[#efefef] overflow-hidden flex flex-col"
      style={{ height: '100vh', minHeight: '100vh' }}
    >
      <iframe
        src="https://api-laporanwe.mkverse.my.id/api/galeri-berkas.php"
        title="Galeri Berkas"
        className="w-full h-full border-0 block flex-1 bg-[#efefef]"
        style={{ width: '100%', height: '100%', minHeight: '100vh' }}
        allow="clipboard-write; camera; microphone"
      />
    </div>
  );
};

export default GaleriBerkasView;
