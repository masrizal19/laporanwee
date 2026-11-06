import React, { useEffect, useState } from 'react';

export const PengajuanBarangPratinjauView: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';

    if (id) {
      fetch(`https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data) setData(json.data);
        })
        .catch(e => console.error('Fetch error:', e));
    } else {
      const draft = localStorage.getItem('pb.v1');
      if (draft) setData(JSON.parse(draft));
    }
  }, []);

  if (!data) return <div className="p-8 text-center">Memuat dokumen...</div>;

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="bg-white p-8 shadow-lg max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Pratinjau Pengajuan Barang</h1>
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
        <div className="mt-6 flex gap-4">
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded">Cetak</button>
        </div>
      </div>
    </div>
  );
};
