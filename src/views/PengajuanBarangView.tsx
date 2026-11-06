import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

interface ItemBarang {
  id: string;
  name: string;
  spec: string;
  price: number;
  qty: number;
  online: boolean;
  link: string;
  imgs: string[];
}

export const PengajuanBarangView: React.FC = () => {
  const navigate = useNavigate();

  // 1. Fungsi terbilang rupiah yang 100% aman (kebal terhadap NaN / undefined / rekursif)
  const terbilangRupiah = (val: any): string => {
    const n = Number(val);
    if (isNaN(n) || !isFinite(n) || n <= 0) return 'Nol rupiah';
    const kata = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    const konversi = (num: number): string => {
      if (num < 12) return kata[num];
      if (num < 20) return konversi(num - 10) + ' belas';
      if (num < 100) return konversi(Math.floor(num / 10)) + ' puluh' + (num % 10 ? ' ' + kata[num % 10] : '');
      if (num < 200) return 'seratus' + (num > 100 ? ' ' + konversi(num - 100) : '');
      if (num < 1000) return konversi(Math.floor(num / 100)) + ' ratus' + (num % 100 ? ' ' + konversi(num % 100) : '');
      if (num < 2000) return 'seribu' + (num > 1000 ? ' ' + konversi(num - 1000) : '');
      if (num < 1000000) return konversi(Math.floor(num / 1000)) + ' ribu' + (num % 1000 ? ' ' + konversi(num % 1000) : '');
      if (num < 1000000000) return konversi(Math.floor(num / 1000000)) + ' juta' + (num % 1000000 ? ' ' + konversi(num % 1000000) : '');
      if (num < 1000000000000) return konversi(Math.floor(num / 1000000000)) + ' miliar' + (num % 1000000000 ? ' ' + konversi(num % 1000000000) : '');
      return konversi(Math.floor(num / 1000000000000)) + ' triliun';
    };
    try {
      const res = konversi(Math.floor(n)).trim();
      return (res ? res.charAt(0).toUpperCase() + res.slice(1) : 'Nol') + ' rupiah';
    } catch {
      return 'Nol rupiah';
    }
  };

  const authToken = useMemo(() => {
    return localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
  }, []);

  // Form State
  const [instansi, setInstansi] = useState('SMK MULTI KARYA');
  const [judulDokumen, setJudulDokumen] = useState('Pengajuan Pembelian Barang');
  const [alamat, setAlamat] = useState('Jl. STM No. 10, Sitirejo II, Kec. Medan Amplas, Kota Medan, Sumatera Utara');
  const [keperluan, setKeperluan] = useState('');
  const [orientasi, setOrientasi] = useState<'landscape' | 'portrait'>('landscape');

  const [kota, setKota] = useState('Medan');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().substring(0, 10));
  const [kepalaLabel, setKepalaLabel] = useState('Kepala Sekolah');
  const [kepalaName, setKepalaName] = useState('Lyly Rismaidy, S.Pd');
  const [wakaLabel, setWakaLabel] = useState('Waka Sarana Prasarana');
  const [wakaName, setWakaName] = useState('Faisal Azmi, Sp');
  const [pemohonLabel, setPemohonLabel] = useState('PEMOHON');
  const [pemohonName, setPemohonName] = useState('M. Rizqy Aditya Fahrezi, S.Ds');

  const [items, setItems] = useState<ItemBarang[]>([
    { id: '1', name: '', spec: '', price: 0, qty: 1, online: false, link: '', imgs: [] }
  ]);

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Baca draf lokal jika ada secara aman
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pb.v1');
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          if (d.meta?.instansi) setInstansi(String(d.meta.instansi));
          if (d.meta?.alamat) setAlamat(String(d.meta.alamat));
          if (d.meta?.keperluan) setKeperluan(String(d.meta.keperluan));
          if (d.meta?.orient) setOrientasi(d.meta.orient);
          if (d.sign?.kota) setKota(String(d.sign.kota));
          if (d.sign?.tanggal) setTanggal(String(d.sign.tanggal));
          if (Array.isArray(d.items) && d.items.length > 0) {
            setItems(d.items.map((it: any, idx: number) => ({
              id: String(idx + 1),
              name: String(it?.name || ''),
              spec: String(it?.spec || ''),
              price: Number(it?.price) || 0,
              qty: Math.max(1, Number(it?.qty) || 1),
              online: Boolean(it?.online),
              link: String(it?.link || ''),
              imgs: Array.isArray(it?.imgs) ? it.imgs : []
            })));
          }
        }
      }
    } catch (e) {
      console.warn('Draft lokal kosong atau format lama:', e);
    }
  }, []);

  const totalBarang = useMemo(() => {
    return items.filter(it => (it.name && it.name.trim() !== '') || (Number(it.price) > 0)).length;
  }, [items]);

  const totalUnit = useMemo(() => {
    return items.reduce((acc, it) => acc + ((it.name && it.name.trim() !== '') || (Number(it.price) > 0) ? (Number(it.qty) || 1) : 0), 0);
  }, [items]);

  const totalOnline = useMemo(() => {
    return items.filter(it => it.online && ((it.name && it.name.trim() !== '') || (Number(it.price) > 0))).length;
  }, [items]);

  const countWithImages = useMemo(() => {
    return items.filter(it => Array.isArray(it.imgs) && it.imgs.length > 0 && ((it.name && it.name.trim() !== '') || (Number(it.price) > 0))).length;
  }, [items]);

  const totalPengajuan = useMemo(() => {
    return items.reduce((acc, it) => {
      const p = Number(it.price) || 0;
      const q = Number(it.qty) || 1;
      return acc + (p * q);
    }, 0);
  }, [items]);

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: String(Date.now()), name: '', spec: '', price: 0, qty: 1, online: false, link: '', imgs: [] }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ id: '1', name: '', spec: '', price: 0, qty: 1, online: false, link: '', imgs: [] }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof ItemBarang, value: any) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const getPayload = () => {
    const validItems = items
      .filter(it => (it.name && it.name.trim() !== '') || (Number(it.price) > 0))
      .map(it => ({
        name: String(it.name || ''),
        spec: String(it.spec || ''),
        price: Number(it.price) || 0,
        qty: Math.max(1, Number(it.qty) || 1),
        online: Boolean(it.online),
        link: String(it.link || ''),
        imgs: Array.isArray(it.imgs) ? it.imgs : []
      }));

    return {
      id: currentId || undefined,
      meta: { instansi, alamat, divisi: 'Kreatif', keperluan, orient: orientasi, judul: judulDokumen },
      items: validItems, // KOSONG MURNI jika formulir belum diisi
      sign: {
        kota,
        tanggal,
        kepala: { label: kepalaLabel, name: kepalaName, sig: '' },
        waka: { label: wakaLabel, name: wakaName, sig: '' },
        pemohon: { label: pemohonLabel, name: pemohonName, sig: '' }
      }
    };
  };

  // Simpan ke Database
  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    const payload = getPayload();

    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/create.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        const newId = json.data?.id || json.id;
        if (newId) setCurrentId(newId);
        localStorage.setItem('pb.v1', JSON.stringify(payload));
        alert('✓ Pengajuan barang berhasil disimpan ke database!');
      } else {
        alert(json.message || 'Gagal menyimpan.');
      }
    } catch {
      localStorage.setItem('pb.v1', JSON.stringify(payload));
      alert('✓ Draf berhasil disimpan di penyimpanan browser.');
    } finally {
      setIsSaving(false);
    }
  };

  // Buka Pratinjau Dokumen Internal
  const handleOpenPreview = () => {
    const payload = getPayload();
    localStorage.setItem('pb.v1', JSON.stringify(payload));

    const targetUrl = currentId
      ? `/pengajuan-barang/pratinjau-dokumen?id=${currentId}`
      : `/pengajuan-barang/pratinjau-dokumen`;

    window.open(targetUrl, '_blank');
  };

  // Riwayat & Soft Delete
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistoryList(json.data);
      }
    } catch (e) {
      console.warn('Gagal memuat riwayat:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSoftDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus pengajuan ini dari riwayat?')) return;
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        setHistoryList(prev => prev.filter(it => it.id !== id));
        if (currentId === id) setCurrentId(null);
      } else {
        alert(json.message || 'Gagal menghapus.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div className="flex-1 w-full min-w-0 h-screen overflow-y-auto bg-transparent px-4 md:px-8 py-6">
      <div className="max-w-[1240px] mx-auto pb-24">
        
        {/* HEADER ATAS */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1c2340] text-white flex items-center justify-center font-bold text-lg shadow-md">
              📦
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Pengajuan Barang
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Susun daftar barang, lampirkan bukti foto produk, lalu cetak dokumennya.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-gray-800 dark:text-white text-xs font-bold border border-black/10 dark:border-white/10 shadow-sm transition-all cursor-pointer"
            >
              <span>👁 Pratinjau Dokumen ↗</span>
            </button>
          </div>
        </div>

        {/* STEPPER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-white/60 dark:bg-[#1a1824]/60 border border-black/5 dark:border-white/10 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">DATA BARANG</p>
              <p className="text-[10px] text-gray-400">Nama, harga, jumlah</p>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/60 dark:bg-[#1a1824]/60 border border-black/5 dark:border-white/10 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">BUKTI GAMBAR</p>
              <p className="text-[10px] text-gray-400">Foto produk terlampir</p>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/60 dark:bg-[#1a1824]/60 border border-black/5 dark:border-white/10 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">TANDA TANGAN</p>
              <p className="text-[10px] text-gray-400">Nama &amp; tanggal lengkap</p>
            </div>
          </div>
        </div>

        {/* FORMULIR UTAMA */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          
          <div className="space-y-6 min-w-0">
            {/* INFORMASI DOKUMEN */}
            <div className="p-6 bg-white/80 dark:bg-[#1a1824]/80 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-white/10 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Informasi Dokumen</h3>
                <p className="text-xs text-gray-400">Kop surat dan keperluan yang tampil pada hasil cetak.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nama sekolah / instansi</label>
                  <input
                    type="text"
                    value={instansi}
                    onChange={e => setInstansi(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Judul dokumen</label>
                  <input
                    type="text"
                    value={judulDokumen}
                    onChange={e => setJudulDokumen(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Alamat (opsional)</label>
                <input
                  type="text"
                  value={alamat}
                  onChange={e => setAlamat(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Keperluan / alasan pengajuan (opsional)</label>
                <textarea
                  rows={2}
                  value={keperluan}
                  onChange={e => setKeperluan(e.target.value)}
                  placeholder="Contoh: Kebutuhan Alat Band / Studio..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-semibold text-gray-500">Orientasi kertas:</span>
                <div className="flex gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setOrientasi('landscape')}
                    className={`px-4 py-1.5 rounded-full font-bold transition-all ${
                      orientasi === 'landscape' ? 'bg-[#d4ee6b] text-[#1f1d2b] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientasi('portrait')}
                    className={`px-4 py-1.5 rounded-full font-bold transition-all ${
                      orientasi === 'portrait' ? 'bg-[#d4ee6b] text-[#1f1d2b] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Portrait
                  </button>
                </div>
              </div>
            </div>

            {/* DAFTAR BARANG */}
            <div className="p-6 bg-white/80 dark:bg-[#1a1824]/80 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-white/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Daftar Barang</h3>
                  <p className="text-xs text-gray-400">Harga satuan × jumlah dihitung otomatis.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 rounded-full bg-[#d4ee6b] text-[#1f1d2b] text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                  + Tambah Barang
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] space-y-3 relative"
                  >
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 text-xs font-bold flex items-center justify-center text-gray-700 dark:text-gray-300">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {item.name || 'Barang Baru'}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={item.name}
                      onChange={e => handleUpdateItem(index, 'name', e.target.value)}
                      placeholder="Nama barang..."
                      className="w-full px-4 py-2 rounded-xl text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white"
                    />

                    <textarea
                      rows={2}
                      value={item.spec}
                      onChange={e => handleUpdateItem(index, 'spec', e.target.value)}
                      placeholder="Spesifikasi (merek, ukuran, warna, dll.)..."
                      className="w-full px-4 py-2 rounded-xl text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 outline-none text-gray-900 dark:text-white resize-none"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Harga satuan (Rp)</label>
                        <input
                          type="number"
                          value={item.price || ''}
                          onChange={e => handleUpdateItem(index, 'price', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 outline-none font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Jumlah</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(index, 'qty', Math.max(1, (Number(item.qty) || 1) - 1))}
                            className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-6 text-center">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(index, 'qty', (Number(item.qty) || 1) + 1)}
                            className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Harga × jumlah</label>
                        <div className="px-3 py-2 rounded-xl bg-[#d4ee6b]/20 text-[#1f1d2b] dark:text-[#d4ee6b] font-bold text-xs">
                          Rp {((Number(item.price) || 0) * (Number(item.qty) || 1)).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TANDA TANGAN */}
            <div className="p-6 bg-white/80 dark:bg-[#1a1824]/80 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-white/10 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tanda Tangan &amp; Tanggal</h3>
                <p className="text-xs text-gray-400">Nama dan jabatan penandatangan dokumen.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Kota</label>
                  <input
                    type="text"
                    value={kota}
                    onChange={e => setKota(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Kepala Sekolah</p>
                  <input
                    type="text"
                    value={kepalaLabel}
                    onChange={e => setKepalaLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                  <input
                    type="text"
                    value={kepalaName}
                    onChange={e => setKepalaName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Waka Sarana Prasarana</p>
                  <input
                    type="text"
                    value={wakaLabel}
                    onChange={e => setWakaLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                  <input
                    type="text"
                    value={wakaName}
                    onChange={e => setWakaName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Pemohon</p>
                  <input
                    type="text"
                    value={pemohonLabel}
                    onChange={e => setPemohonLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                  <input
                    type="text"
                    value={pemohonName}
                    onChange={e => setPemohonName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-black/20 border border-black/10 outline-none"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RINGKASAN KANAN */}
          <div className="sticky top-6 space-y-4">
            <div className="p-6 bg-white/80 dark:bg-[#1a1824]/80 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-white/10 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Ringkasan</h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Jenis barang</span>
                  <b className="text-gray-900 dark:text-white">{totalBarang}</b>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Total unit</span>
                  <b className="text-gray-900 dark:text-white">{totalUnit}</b>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Beli online</span>
                  <b className="text-gray-900 dark:text-white">{totalOnline}</b>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Dengan bukti gambar</span>
                  <b className="text-gray-900 dark:text-white">{countWithImages}/{totalBarang || 1}</b>
                </div>
              </div>

              <div className="pt-3 border-t border-black/5 dark:border-white/5">
                <span className="block text-[11px] text-gray-400">Total pengajuan</span>
                <span className="block text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">
                  Rp {totalPengajuan.toLocaleString('id-ID')}
                </span>
                <p className="text-[10px] text-gray-400 italic mt-1 leading-tight">
                  Terbilang: {terbilangRupiah(totalPengajuan)}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  className="w-full py-3 px-5 rounded-2xl bg-[#d4ee6b] hover:bg-[#c3de58] text-[#1f1d2b] font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>💾</span>
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Database'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchHistory();
                    setShowHistoryModal(true);
                  }}
                  className="w-full py-2.5 px-5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>📜</span>
                  <span>Riwayat Pengajuan</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="w-full py-3 px-5 rounded-2xl bg-[#1c2340] hover:bg-[#253059] text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>👁</span>
                  <span>Pratinjau Dokumen ↗</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL RIWAYAT */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-[#1a1824] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Riwayat Pengajuan Barang</h3>
                <p className="text-xs text-gray-400">Daftar pengajuan aktif yang tersimpan.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {isLoadingHistory ? (
                <div className="text-center py-10 text-xs text-gray-400">Memuat riwayat...</div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">Belum ada riwayat pengajuan tersimpan.</div>
              ) : (
                historyList.map(hist => (
                  <div
                    key={hist.id}
                    className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {hist.nomor_pengajuan || `PB-#${hist.id}`} — {hist.judul || 'Pengajuan Barang'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        📅 {hist.tanggal} • Rp {Number(hist.total_pengajuan || 0).toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHistoryModal(false);
                          window.open(`/pengajuan-barang/pratinjau-dokumen?id=${hist.id}`, '_blank');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#1c2340] text-white text-[11px] font-bold"
                      >
                        Buka
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSoftDelete(hist.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white text-[11px] font-bold transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PengajuanBarangView;