import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const PengajuanBarangPratinjauView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idParam = searchParams.get('id');

  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape');
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>({
    meta: { instansi: 'SMK MULTI KARYA', alamat: 'Jl. STM No. 10, Medan', judul: 'PENGAJUAN BARANG', keperluan: '', orient: 'landscape' },
    items: [],
    sign: { kota: 'Medan', tanggal: new Date().toISOString().substring(0, 10), kepala: {}, waka: {}, pemohon: {} }
  });

  const authToken = useMemo(() => {
    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // 1. Jika ada ID di parameter URL, ambil dari server
      if (idParam) {
        try {
          const res = await fetch(`https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php?id=${idParam}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          });
          const json = await res.json();
          if (json.success && json.data) {
            setDoc(json.data);
            if (json.data.meta?.orient) setOrient(json.data.meta.orient);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Gagal memuat dari API:', e);
        }
      }

      // 2. Jika tidak ada ID, baca draf formulir lokal
      try {
        const raw = localStorage.getItem('pb.v1');
        if (raw) {
          const d = JSON.parse(raw);
          if (d && typeof d === 'object') {
            setDoc(d);
            if (d.meta?.orient) setOrient(d.meta.orient);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}

      // Data awal kosong murni (tanpa dummy data)
      setLoading(false);
    };

    loadData();
  }, [idParam, authToken]);

  const totalPengajuan = useMemo(() => {
    const list = Array.isArray(doc?.items) ? doc.items : [];
    return list.reduce((acc: number, it: any) => acc + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
  }, [doc]);

  const totalUnit = useMemo(() => {
    const list = Array.isArray(doc?.items) ? doc.items : [];
    return list.reduce((acc: number, it: any) => acc + (Number(it.qty) || 1), 0);
  }, [doc]);

  return (
    <div className="min-h-screen bg-[#eceef3] text-[#1c2340] flex flex-col font-sans">
      {/* TOOLBAR ATAS */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-6 py-3 bg-white/90 backdrop-blur-md border-b border-black/10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pengajuan-barang')}
            className="px-4 py-2 rounded-full border border-black/10 bg-white hover:bg-black/5 text-xs font-bold cursor-pointer transition-all"
          >
            ← Kembali ke Formulir
          </button>
          <div>
            <b className="block text-sm font-bold text-gray-900">Dokumen Pengajuan Barang</b>
            <small className="text-xs text-gray-500">
              {doc.items?.length || 0} jenis · {totalUnit} unit
            </small>
          </div>
        </div>

        {/* SWITCHER ORIENTASI */}
        <div className="flex items-center gap-1 p-1 bg-black/5 rounded-full text-xs font-bold">
          <button
            type="button"
            onClick={() => setOrient('landscape')}
            className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
              orient === 'landscape' ? 'bg-[#2f3b6b] text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            Landscape
          </button>
          <button
            type="button"
            onClick={() => setOrient('portrait')}
            className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
              orient === 'portrait' ? 'bg-[#2f3b6b] text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            Portrait
          </button>
        </div>

        {/* CETAK & UNDUH */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2 rounded-full bg-[#2f3b6b] text-white text-xs font-bold shadow-md hover:bg-[#253059] transition-all cursor-pointer"
          >
            🖨 Cetak Dokumen
          </button>
        </div>
      </header>

      {/* KERTAS DOKUMEN RESMI A4 */}
      <main className="flex-1 max-w-[1100px] w-full mx-auto my-8 px-4 flex justify-center">
        {loading ? (
          <div className="py-20 text-xs text-gray-400">Memuat pratinjau dokumen...</div>
        ) : (
          <div
            className={`bg-white rounded-2xl shadow-xl overflow-hidden border border-black/5 transition-all ${
              orient === 'landscape' ? 'w-[1020px] min-h-[720px]' : 'w-[760px] min-h-[1020px]'
            }`}
          >
            {/* KOP DOKUMEN BIRU */}
            <div className="bg-[#2f3b6b] text-white p-7 relative overflow-hidden rounded-b-3xl">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-2xl font-black tracking-wider uppercase">PENGAJUAN BARANG</h2>
                  <p className="text-[11px] opacity-80 uppercase tracking-widest mt-0.5">by WEE LAPORAN</p>
                </div>
                <div className="text-right text-xs">
                  <b className="block font-bold">{doc.meta?.instansi || 'SMK MULTI KARYA'}</b>
                  <span className="opacity-80 text-[11px]">{doc.meta?.alamat || 'Medan, Sumatera Utara'}</span>
                </div>
              </div>

              <div className="flex justify-between items-end mt-6 relative z-10 text-xs">
                <div>
                  <span className="opacity-70 text-[11px] block">Pengajuan oleh:</span>
                  <b className="text-base font-bold">{doc.sign?.pemohon?.name || 'M. Rizqy Aditya Fahrezi, S.Ds'}</b>
                </div>
                <div className="text-right">
                  <span className="opacity-70 text-[11px] block">Tanggal:</span>
                  <b className="text-sm font-bold">{doc.sign?.tanggal || new Date().toISOString().substring(0, 10)}</b>
                </div>
              </div>
            </div>

            {/* TABEL BARANG */}
            <div className="p-7 space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 border-b border-black/10 pb-2">
                <span>Daftar Barang</span>
                <span>{doc.items?.length || 0} jenis · {totalUnit} unit</span>
              </div>

              {(!doc.items || doc.items.length === 0) ? (
                <div className="py-16 text-center text-xs text-gray-400 border border-dashed border-black/10 rounded-xl">
                  Belum ada barang yang diajukan. Silakan tambahkan barang di formulir.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-black/10 text-gray-400 text-[11px]">
                        <th className="py-2.5 w-10">No</th>
                        <th className="py-2.5">Nama Barang &amp; Spesifikasi</th>
                        <th className="py-2.5 text-right">Harga Satuan</th>
                        <th className="py-2.5 text-center w-14">Qty</th>
                        <th className="py-2.5 text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {doc.items.map((it: any, i: number) => (
                        <tr key={i} className="hover:bg-black/[0.01]">
                          <td className="py-3 font-bold text-gray-400">{i + 1}</td>
                          <td className="py-3">
                            <b className="block text-gray-900">{it.name || 'Barang'}</b>
                            <p className="text-[11px] text-gray-500">{it.spec || '-'}</p>
                          </td>
                          <td className="py-3 text-right">Rp {Number(it.price || 0).toLocaleString('id-ID')}</td>
                          <td className="py-3 text-center font-bold">{it.qty || 1}</td>
                          <td className="py-3 text-right font-bold text-gray-900">
                            Rp {(Number(it.price || 0) * Number(it.qty || 1)).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TOTAL PENGAJUAN */}
              <div className="p-4 bg-[#2f3b6b] text-white rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold tracking-wider uppercase">Total Pengajuan</span>
                <span className="text-lg font-black tracking-tight">Rp {totalPengajuan.toLocaleString('id-ID')}</span>
              </div>

              {/* TANDA TANGAN */}
              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs">
                <div>
                  <p className="font-semibold text-gray-500">{doc.sign?.kepala?.label || 'Kepala Sekolah'}</p>
                  <div className="h-14"></div>
                  <b className="block text-gray-900">( {doc.sign?.kepala?.name || 'Lyly Rismaidy, S.Pd'} )</b>
                </div>
                <div>
                  <p className="font-semibold text-gray-500">{doc.sign?.waka?.label || 'Waka Sarana Prasarana'}</p>
                  <div className="h-14"></div>
                  <b className="block text-gray-900">( {doc.sign?.waka?.name || 'Faisal Azmi, Sp'} )</b>
                </div>
                <div>
                  <p className="font-semibold text-gray-500">{doc.sign?.pemohon?.label || 'PEMOHON'}</p>
                  <div className="h-14"></div>
                  <b className="block text-gray-900">( {doc.sign?.pemohon?.name || 'M. Rizqy Aditya Fahrezi, S.Ds'} )</b>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PengajuanBarangPratinjauView;