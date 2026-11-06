import React, { useEffect, useState } from 'react';

interface SubmissionItem {
  name: string;
  spec: string;
  price: number;
  qty: number;
  online: boolean;
  link: string;
  img: string;
}

interface SubmissionData {
  items: SubmissionItem[];
  submitter?: string;
  date?: string;
  department?: string;
}

export const PengajuanBarangPratinjauView: React.FC = () => {
  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';

    const handleData = (json: any) => {
        if (json && json.items) {
            setData(json);
        } else if (json && json.data && json.data.items) {
            setData(json.data);
        } else {
            setData({ items: [] });
        }
        setLoading(false);
    };

    if (id) {
      fetch(`https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            handleData(json);
          } else {
            setData({ items: [] });
            setLoading(false);
          }
        })
        .catch(e => {
            console.error('Fetch error:', e);
            setData({ items: [] });
            setLoading(false);
        });
    } else {
      const draft = localStorage.getItem('pb.v1');
      if (draft) {
        try {
          handleData(JSON.parse(draft));
        } catch {
          setData({ items: [] });
          setLoading(false);
        }
      } else {
        setData({ items: [] });
        setLoading(false);
      }
    }
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat pratinjau...</div>;

  const total = data?.items?.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0) || 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-900">
      <div className="bg-white p-10 shadow-sm max-w-3xl mx-auto border border-gray-200">
        <header className="mb-8 border-b pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wide">Formulir Pengajuan Barang</h1>
            <p className="text-sm text-gray-500">Pratinjau Dokumen Internal</p>
        </header>

        {(!data?.items || data.items.length === 0) ? (
            <div className="py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <p>Belum ada barang yang diajukan.</p>
            </div>
        ) : (
            <table className="w-full text-left mb-8">
                <thead>
                    <tr className="border-b">
                        <th className="py-2">Nama Barang</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Harga</th>
                        <th className="py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                            <td className="py-3">
                                <div>{item.name}</div>
                                <div className="text-xs text-gray-500">{item.spec}</div>
                            </td>
                            <td className="py-3 text-right">{item.qty}</td>
                            <td className="py-3 text-right">{Number(item.price).toLocaleString('id-ID')}</td>
                            <td className="py-3 text-right">{(Number(item.price) * item.qty).toLocaleString('id-ID')}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={3} className="py-4 font-bold text-right">Total Pengajuan:</td>
                        <td className="py-4 font-bold text-right border-t">Rp {total.toLocaleString('id-ID')}</td>
                    </tr>
                </tfoot>
            </table>
        )}

        <div className="mt-12 flex justify-end gap-4 print:hidden">
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Cetak Dokumen</button>
        </div>
      </div>
    </div>
  );
};
