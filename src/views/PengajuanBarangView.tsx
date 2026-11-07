import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getStoredToken } from '../utils/api';

export interface PengajuanBarangViewProps {
  onAddToast?: (message: string) => void;
}

export interface Item {
  id: string;
  name: string;
  spec: string;
  price: number;
  qty: number;
  online: boolean;
  link: string;
  imgs: string[];
}

export interface Meta {
  instansi: string;
  alamat: string;
  judul: string;
  keperluan: string;
  orient: 'landscape' | 'portrait';
  divisi?: string;
  id?: string;
}

export interface SigPerson {
  label: string;
  name: string;
  sig: string;
}

export interface Sign {
  kota: string;
  tanggal: string;
  kepala: SigPerson;
  waka: SigPerson;
  pemohon: SigPerson;
}

const STORAGE_KEY = 'pb.v1';
const IDR = new Intl.NumberFormat('id-ID');
const uid = () => 'i' + Math.random().toString(36).slice(2, 9);
const rp = (n: number) => 'Rp ' + IDR.format(Math.round(n || 0));
const urlOK = (u: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test((u || '').trim());

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function terbilang(n: number) {
  n = Math.floor(Math.abs(n));
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const t = (num: number): string => {
    if (num < 12) return s[num];
    if (num < 20) return t(num - 10) + ' belas';
    if (num < 100) return t(Math.floor(num / 10)) + ' puluh' + (num % 10 ? ' ' + t(num % 10) : '');
    if (num < 200) return 'seratus' + (num > 100 ? ' ' + t(num - 100) : '');
    if (num < 1e3) return t(Math.floor(num / 100)) + ' ratus' + (num % 100 ? ' ' + t(num % 100) : '');
    if (num < 2e3) return 'seribu' + (num > 1e3 ? ' ' + t(num - 1e3) : '');
    if (num < 1e6) return t(Math.floor(num / 1e3)) + ' ribu' + (num % 1e3 ? ' ' + t(num % 1e3) : '');
    if (num < 1e9) return t(Math.floor(num / 1e6)) + ' juta' + (num % 1e6 ? ' ' + t(num % 1e6) : '');
    if (num < 1e12) return t(Math.floor(num / 1e9)) + ' miliar' + (num % 1e9 ? ' ' + t(num % 1e9) : '');
    return t(Math.floor(num / 1e12)) + ' triliun' + (num % 1e12 ? ' ' + t(num % 1e12) : '');
  };
  const r = n === 0 ? 'nol' : t(n);
  return r.charAt(0).toUpperCase() + r.slice(1) + ' rupiah';
}

export const PengajuanBarangView: React.FC<PengajuanBarangViewProps> = ({ onAddToast }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  /* ── Initial states ── */
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items) && parsed.items.length) {
          return parsed.items.map((n: any) => ({
            id: n.id || uid(),
            name: n.name || '',
            spec: n.spec || '',
            price: +n.price || 0,
            qty: Math.max(1, +n.qty || 1),
            online: !!n.online,
            link: n.link || '',
            imgs: Array.isArray(n.imgs) ? n.imgs.slice(0, 3) : [],
          }));
        }
      }
    } catch (_) {}
    return [
      {
        id: uid(),
        name: '',
        spec: '',
        price: 0,
        qty: 1,
        online: false,
        link: '',
        imgs: [],
      },
    ];
  });

  const [meta, setMeta] = useState<Meta>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.meta) {
          return {
            instansi: parsed.meta.instansi || '',
            alamat: parsed.meta.alamat || '',
            judul: parsed.meta.judul || 'Pengajuan Pembelian Barang',
            keperluan: parsed.meta.keperluan || '',
            orient: parsed.meta.orient === 'portrait' ? 'portrait' : 'landscape',
            divisi: parsed.meta.divisi || 'Kreatif',
            id: parsed.meta.id || '',
          };
        }
      }
    } catch (_) {}
    return {
      instansi: '',
      alamat: '',
      judul: 'Pengajuan Pembelian Barang',
      keperluan: '',
      orient: 'landscape',
      divisi: 'Kreatif',
    };
  });

  const [sign, setSign] = useState<Sign>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sign) {
          return {
            kota: parsed.sign.kota || 'Medan',
            tanggal: parsed.sign.tanggal || today(),
            kepala: {
              label: parsed.sign.kepala?.label || 'Kepala Sekolah',
              name: parsed.sign.kepala?.name || 'Lyly Rismaidy, S.Pd',
              sig: parsed.sign.kepala?.sig || '',
            },
            waka: {
              label: parsed.sign.waka?.label || 'Waka Sarana Prasarana',
              name: parsed.sign.waka?.name || 'Faisal Azmi, Sp',
              sig: parsed.sign.waka?.sig || '',
            },
            pemohon: {
              label: parsed.sign.pemohon?.label || 'PEMOHON',
              name: parsed.sign.pemohon?.name || 'M. Rizqy Aditya Fahrezi, S.Ds',
              sig: parsed.sign.pemohon?.sig || '',
            },
          };
        }
      }
    } catch (_) {}
    return {
      kota: 'Medan',
      tanggal: today(),
      kepala: { label: 'Kepala Sekolah', name: 'Lyly Rismaidy, S.Pd', sig: '' },
      waka: { label: 'Waka Sarana Prasarana', name: 'Faisal Azmi, Sp', sig: '' },
      pemohon: { label: 'PEMOHON', name: 'M. Rizqy Aditya Fahrezi, S.Ds', sig: '' },
    };
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('laporanwee_theme') || localStorage.getItem('pb.theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [badFields, setBadFields] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  /* ── Toast notification helper ── */
  const toastTimeoutRef = useRef<any>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    if (onAddToast) {
      onAddToast(msg);
    }
  };

  /* ── Browser URL sync ── */
  useEffect(() => {
    if (window.location.pathname !== '/pengajuan-barang') {
      window.history.pushState({}, '', '/pengajuan-barang');
    }
  }, []);

  /* ── Theme sync ── */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('laporanwee_theme', theme);
      localStorage.setItem('pb.theme', theme);
    } catch (_) {}
  }, [theme]);

  /* ── Auto-save to localStorage with quota protection ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ meta, items, sign }));
      } catch (_) {
        try {
          // If storage full due to base64 images, save without images
          const fallbackItems = items.map((i) => ({ ...i, imgs: [] }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ meta, items: fallbackItems, sign }));
        } catch (_) {}
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [meta, items, sign]);

  /* ── Load default settings from backend ── */
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token =
          localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('laporanwee_token') ||
          '';

        const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/settings.php', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json().catch(() => null);
          const settings = json?.data || json?.settings || json;
          if (settings && typeof settings === 'object') {
            setMeta((prev) => ({
              ...prev,
              instansi: settings.instansi || settings.meta?.instansi || prev.instansi,
              alamat: settings.alamat || settings.meta?.alamat || prev.alamat,
              judul: settings.judul || settings.meta?.judul || prev.judul,
              keperluan: settings.keperluan || settings.meta?.keperluan || prev.keperluan,
              orient: (settings.orient || settings.meta?.orient || prev.orient) as any,
              divisi: settings.divisi || settings.meta?.divisi || prev.divisi,
            }));

            if (settings.sign || settings.kepala || settings.waka || settings.pemohon) {
              setSign((prev) => ({
                ...prev,
                kota: settings.kota || settings.sign?.kota || prev.kota,
                tanggal: settings.tanggal || settings.sign?.tanggal || prev.tanggal,
                kepala: {
                  ...prev.kepala,
                  ...(settings.kepala || settings.sign?.kepala || {}),
                },
                waka: {
                  ...prev.waka,
                  ...(settings.waka || settings.sign?.waka || {}),
                },
                pemohon: {
                  ...prev.pemohon,
                  ...(settings.pemohon || settings.sign?.pemohon || {}),
                },
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Notice loading backend settings:', err);
      }
    };

    fetchSettings();
  }, []);

  /* ── Calculations & Summary ── */
  const summary = useMemo(() => {
    const n = items.length;
    const totalUnits = items.reduce((s, i) => s + (i.qty || 0), 0);
    const onlineCount = items.filter((i) => i.online).length;
    const withImgsCount = items.filter((i) => i.imgs && i.imgs.length > 0).length;
    const grandTotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

    const isItemValid = (i: Item) =>
      i.name.trim().length > 0 && i.price > 0 && i.qty >= 1 && (!i.online || urlOK(i.link));

    const step1Progress = n > 0 ? items.filter(isItemValid).length / n : 0;
    const step2Progress = n > 0 ? items.filter((i) => i.imgs.length > 0).length / n : 0;
    const signFields = [sign.kota, sign.tanggal, sign.kepala.name, sign.waka.name, sign.pemohon.name];
    const step3Progress = signFields.filter((v) => String(v || '').trim().length > 0).length / 5;

    return {
      n,
      totalUnits,
      onlineCount,
      withImgsCount,
      grandTotal,
      terbilangText: grandTotal > 0 ? terbilang(grandTotal) : '',
      step1Progress,
      step2Progress,
      step3Progress,
    };
  }, [items, sign]);

  /* ── Image Upload & Removal Handlers ── */
  const handleImageUpload = (itemId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast('File harus berupa gambar (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('Ukuran maksimal gambar adalah 10 MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target?.result as string;
        if (!base64Url) return;

        setItems((prevItems) =>
          prevItems.map((item) => {
            if (item.id === itemId) {
              if (item.imgs.length >= 3) {
                showToast('Maksimal 3 gambar per barang.');
                return item;
              }
              return {
                ...item,
                imgs: [...item.imgs, base64Url],
              };
            }
            return item;
          })
        );
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (itemId: string, imgIndex: number) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedImgs = [...item.imgs];
          updatedImgs.splice(imgIndex, 1);
          return { ...item, imgs: updatedImgs };
        }
        return item;
      })
    );
  };

  /* ── Item Handlers ── */
  const handleAddItem = () => {
    const newItem: Item = {
      id: uid(),
      name: '',
      spec: '',
      price: 0,
      qty: 1,
      online: false,
      link: '',
      imgs: [],
    };
    setItems((prev) => [...prev, newItem]);
    setTimeout(() => {
      const input = document.getElementById(`pb-name-${newItem.id}`);
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
      }
    }, 80);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof Item, val: any) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: val } : i))
    );
    if (field === 'name' && String(val).trim()) {
      setBadFields((prev) => ({ ...prev, [`name-${id}`]: false }));
    }
    if (field === 'price' && Number(val) > 0) {
      setBadFields((prev) => ({ ...prev, [`price-${id}`]: false }));
    }
    if (field === 'link' && urlOK(String(val))) {
      setBadFields((prev) => ({ ...prev, [`link-${id}`]: false }));
    }
  };

  /* ── Signature Handlers ── */
  const handleSigUpload = (role: 'kepala' | 'waka' | 'pemohon', file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;
      if (base64Url) {
        setSign((prev) => ({
          ...prev,
          [role]: { ...prev[role], sig: base64Url },
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSig = (role: 'kepala' | 'waka' | 'pemohon') => {
    setSign((prev) => ({
      ...prev,
      [role]: { ...prev[role], sig: '' },
    }));
  };

  /* ── Form Validation ── */
  const validateForm = (): boolean => {
    if (!items.length) {
      showToast('Tambahkan minimal satu barang dulu.');
      handleAddItem();
      return false;
    }

    const newBad: Record<string, boolean> = {};
    let firstBadField = '';

    items.forEach((item) => {
      if (!item.name.trim()) {
        newBad[`name-${item.id}`] = true;
        if (!firstBadField) firstBadField = `pb-name-${item.id}`;
      }
      if (!(item.price > 0)) {
        newBad[`price-${item.id}`] = true;
        if (!firstBadField) firstBadField = `pb-price-${item.id}`;
      }
      if (item.online && !urlOK(item.link)) {
        newBad[`link-${item.id}`] = true;
        if (!firstBadField) firstBadField = `pb-link-${item.id}`;
      }
    });

    setBadFields(newBad);

    if (firstBadField) {
      showToast('Lengkapi isian yang ditandai merah.');
      setTimeout(() => {
        const el = document.getElementById(firstBadField);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
      return false;
    }

    return true;
  };



  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  /* ── Auth Headers ── */
  const getAuthHeaders = () => {
    const token = getStoredToken() || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/read.php', {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistoryList(json.data);
      }
    } catch (e) {
      console.warn('Gagal memuat riwayat:', e);
    }
  };

  /* ── Save to Database API ── */
  const handleSaveToDatabase = async (): Promise<string | number | null> => {
    if (!validateForm()) return null;
    setSaving(true);
    const token = getStoredToken();
    if (!token) {
      showToast('Sesi login tidak ditemukan. Harap login terlebih dahulu.');
      setSaving(false);
      return null;
    }

    const payload = {
      id: meta.id || undefined,
      meta,
      items,
      sign,
    };

    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/create.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch (_) {
        throw new Error(`Server mengembalikan respon tidak valid (${res.status})`);
      }

      if (json.success) {
        const savedId =
          json.data?.id ||
          json.id ||
          json.submission_id ||
          json.data?.submission_id ||
          json.insert_id ||
          json.data?.insert_id ||
          meta.id;

        if (savedId) {
          setMeta(prev => ({ ...prev, id: String(savedId) }));
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, meta: { ...meta, id: String(savedId) } }));
          } catch (_) {}
        }
        showToast('✓ Pengajuan barang berhasil disimpan ke database!');
        fetchHistory();
        return savedId || meta.id || null;
      } else {
        showToast(json.message || 'Gagal menyimpan ke database.');
        return null;
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan jaringan saat menyimpan.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  /* ── Handle Open Pratinjau Action ── */
  const handleOpenPratinjau = (explicitId?: string | number) => {
    // 1. Simpan draf formulir aktif saat ini ke localStorage 'pb.v1'
    try {
      const payload = { meta, items, sign };
      localStorage.setItem('pb.v1', JSON.stringify(payload));
    } catch (e) {
      console.warn('Gagal menyimpan draf pratinjau:', e);
    }

    // 2. Arahkan pengguna ke rute resmi /pengajuan-barang/pratinjau
    const targetId = explicitId || meta.id;
    const targetUrl = targetId
      ? `/pengajuan-barang/pratinjau?id=${encodeURIComponent(String(targetId))}`
      : '/pengajuan-barang/pratinjau';

    window.location.href = targetUrl;
  };

  const handleSoftDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus pengajuan ini dari riwayat?')) return;
    try {
      const res = await fetch('https://api-laporanwe.mkverse.my.id/api/pengajuan-barang/delete.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        fetchHistory();
        showToast('✓ Pengajuan berhasil dihapus dari riwayat.');
      } else {
        showToast(json.message || 'Gagal menghapus.');
      }
    } catch {
      showToast('Gagal menghubungi server.');
    }
  };

  /* ── Print Document Action ── */
  const handlePrint = () => {
    if (!validateForm()) return;
    handleOpenPratinjau();
  };

  /* ── Export & Import JSON ── */
  const handleExportJSON = () => {
    const data = { meta, items, sign };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pengajuan-barang-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Data pengajuan berhasil diekspor.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.meta) setMeta((prev) => ({ ...prev, ...parsed.meta }));
        if (Array.isArray(parsed.items)) {
          setItems(
            parsed.items.map((n: any) => ({
              id: n.id || uid(),
              name: n.name || '',
              spec: n.spec || '',
              price: +n.price || 0,
              qty: Math.max(1, +n.qty || 1),
              online: !!n.online,
              link: n.link || '',
              imgs: Array.isArray(n.imgs) ? n.imgs.slice(0, 3) : [],
            }))
          );
        }
        if (parsed.sign) setSign((prev) => ({ ...prev, ...parsed.sign }));
        showToast('Data pengajuan berhasil diimpor.');
      } catch (_) {
        showToast('Format file JSON tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const [resetConfirm, setResetConfirm] = useState(false);
  const handleReset = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    setResetConfirm(false);
    setItems([
      {
        id: uid(),
        name: '',
        spec: '',
        price: 0,
        qty: 1,
        online: false,
        link: '',
        imgs: [],
      },
    ]);
    setMeta({
      instansi: '',
      alamat: '',
      judul: 'Pengajuan Pembelian Barang',
      keperluan: '',
      orient: 'landscape',
      divisi: 'Kreatif',
    });
    setSign({
      kota: 'Medan',
      tanggal: today(),
      kepala: { label: 'Kepala Sekolah', name: 'Lyly Rismaidy, S.Pd', sig: '' },
      waka: { label: 'Waka Sarana Prasarana', name: 'Faisal Azmi, Sp', sig: '' },
      pemohon: { label: 'PEMOHON', name: 'M. Rizqy Aditya Fahrezi, S.Ds', sig: '' },
    });
    showToast('Formulir berhasil direset.');
  };

  /* ── Global window.PB interface ── */
  useEffect(() => {
    (window as any).PB = {
      getState: () => ({ meta, items, sign }),
      setState: (st: any) => {
        if (st.meta) setMeta((prev) => ({ ...prev, ...st.meta }));
        if (st.items && Array.isArray(st.items)) setItems(st.items);
        if (st.sign) setSign((prev) => ({ ...prev, ...st.sign }));
      },
      save: () => handleSaveToDatabase(),
      pratinjau: handleOpenPratinjau,
      print: () => handlePrint(),
      reset: handleReset,
    };
    return () => {
      delete (window as any).PB;
    };
  }, [meta, items, sign]);

  return (
    <div className="pb-page-wrapper" ref={rootRef} style={{ width: '100%', minHeight: '100%' }}>
      {/* Scoped CSS from standard design */}
      <style>{`
        .pb-root {
          --ink:#1f1d2b;--muted:#7d7a8c;--glass:rgba(255,255,255,.64);--solid:rgba(255,255,255,.95);--line:rgba(31,29,43,.1);
          --dark:#23212e;--on-dark:#fff;--lime:#d4ee6b;--lime-soft:#e9f5b8;--lav:#d9d3f5;--accent:#7a69d0;--bad:#c9443f;--ok:#3f8f5f;
          --blob1:rgba(176,160,240,.55);--blob2:rgba(244,214,170,.6);--bg1:#e6e5ec;--bg2:#f1f0f5;
          --shadow:0 1px 0 rgba(255,255,255,.9) inset,0 24px 48px -30px rgba(60,50,110,.42);
          position:relative;min-height:100vh;color:var(--ink);font-family:'Outfit',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;
          background:transparent;overflow-x:hidden;color-scheme:light;
        }
        .pb-root[data-theme=dark] {
          --ink:#f2f0fa;--muted:#9a97ad;--glass:rgba(40,38,54,.62);--solid:rgba(46,44,64,.95);--line:rgba(255,255,255,.1);--dark:#f2f0fa;--on-dark:#1f1d2b;--lime-soft:rgba(212,238,107,.18);
          --lav:#3b3560;--accent:#a99bf0;--bad:#ef7b77;--ok:#7fcf9c;--blob1:rgba(110,90,200,.42);--blob2:rgba(200,140,80,.22);--bg1:#14131b;--bg2:#1b1a24;
          --shadow:0 1px 0 rgba(255,255,255,.05) inset,0 26px 50px -30px rgba(0,0,0,.75);color-scheme:dark;
        }
        .pb-root *,.pb-root *::before,.pb-root *::after{box-sizing:border-box}
        .pb-root button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .pb-root svg{display:block}
        .pb-amb{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
        .pb-amb i{position:absolute;border-radius:50%;filter:blur(90px)}
        .pb-amb i:nth-child(1){width:620px;height:620px;left:-160px;bottom:-200px;background:var(--blob1)}
        .pb-amb i:nth-child(2){width:560px;height:560px;right:-140px;top:-180px;background:var(--blob2)}
        .pb-amb i:nth-child(3){width:380px;height:380px;left:44%;top:40%;background:var(--blob1);opacity:.28}

        .pb-wrap{position:relative;z-index:1;width:min(1240px,100% - 40px);margin:0 auto;padding:26px 0 90px}
        .pb-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:26px}
        .pb-brand{display:flex;align-items:center;gap:14px;flex:1;min-width:240px}
        .pb-logo{width:46px;height:46px;border-radius:16px;background:var(--dark);display:grid;place-items:center;flex:none}
        .pb-logo svg{width:24px;height:24px;stroke:var(--on-dark);fill:none;stroke-width:2;stroke-linecap:round}
        .pb-top h1{font-size:clamp(28px,3.6vw,40px);font-weight:600;letter-spacing:-.035em;line-height:1.05;margin:0}
        .pb-top p{color:var(--muted);font-size:14px;margin:4px 0 0}

        .pb-theme{display:flex;padding:4px;border-radius:999px;background:var(--glass);border:1px solid var(--line);position:relative}
        .pb-theme button{width:36px;height:32px;display:grid;place-items:center;border-radius:999px;color:var(--muted);transition:all .2s ease}
        .pb-theme button.active{background:var(--solid);color:var(--ink);box-shadow:0 4px 10px -4px rgba(0,0,0,.25)}
        .pb-theme svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

        .pb-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}
        @media(max-width:960px){
          .pb-grid{grid-template-columns:1fr}
          .pb-right{display:none}
          .pb-dock{display:flex!important}
        }
        .pb-left{display:flex;flex-direction:column;gap:20px;min-width:0}
        .pb-card{background:var(--glass);backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);border:1px solid var(--line);border-radius:30px;padding:10px;box-shadow:var(--shadow)}
        .pb-card>.pb-in{background:var(--solid);border-radius:22px;padding:22px}
        .pb-ch{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px 14px;flex-wrap:wrap}
        .pb-ch h2{font-size:18px;font-weight:600;letter-spacing:-.015em;margin:0}.pb-sub{color:var(--muted);font-size:13.5px;line-height:1.5;margin:2px 0 0}

        /* Progres 3 Tahap */
        .pb-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:6px 6px 2px}
        .pb-step{min-width:0}
        .pb-step .pb-sh{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .pb-sico{position:relative;width:34px;height:34px;border-radius:12px;background:var(--solid);border:1px solid var(--line);display:grid;place-items:center;flex:none}
        .pb-sico svg{width:18px;height:18px;stroke:var(--ink);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .pb-chk{position:absolute;right:-6px;top:-6px;width:18px;height:18px;border-radius:50%;background:var(--accent);display:grid;place-items:center;transform:scale(0);transition:transform .3s ease}
        .pb-step.done .pb-chk{transform:scale(1)}
        .pb-chk svg{width:10px;height:10px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
        .pb-sh b{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}
        .pb-sh small{color:var(--muted);font-size:12px}
        .pb-bar{height:9px;border-radius:99px;background:var(--line);overflow:hidden}
        .pb-bar i{display:block;height:100%;border-radius:99px;background:var(--lime);transition:width .4s ease}

        /* Form Fields */
        .pb-fld{position:relative;margin-bottom:14px}
        .pb-fld input,.pb-fld textarea{width:100%;border-radius:18px;border:1.5px solid var(--line);background:var(--glass);padding:23px 16px 7px;font:inherit;font-size:15.5px;color:var(--ink);outline:0;resize:vertical}
        .pb-fld input{height:58px}.pb-fld textarea{min-height:84px;line-height:1.45}
        .pb-fld label{position:absolute;left:17px;top:18px;font-size:15px;color:var(--muted);pointer-events:none;transform-origin:left top;transition:all .2s ease}
        .pb-fld input:focus+label,.pb-fld input:not(:placeholder-shown)+label,.pb-fld textarea:focus+label,.pb-fld textarea:not(:placeholder-shown)+label{transform:translateY(-11px) scale(.78)}
        .pb-fld input:focus,.pb-fld textarea:focus{border-color:var(--accent);box-shadow:0 0 0 5px rgba(143,127,224,.2)}
        .pb-fld input[type=date]+label{transform:translateY(-11px) scale(.78)}
        .pb-err{font-size:12.5px;color:var(--bad);padding-left:8px;max-height:0;opacity:0;overflow:hidden;transition:all .2s ease}
        .pb-fld.bad input,.pb-fld.bad textarea{border-color:var(--bad)}
        .pb-fld.bad .pb-err{max-height:24px;opacity:1;margin-top:6px}
        .pb-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
        @media(max-width:640px){ .pb-cols{grid-template-columns:1fr} }

        /* Kartu Barang */
        .pb-list{display:flex;flex-direction:column;gap:14px}
        .pb-item{position:relative;padding:18px;border-radius:24px;background:var(--solid);border:1px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.03)}
        .pb-ih{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .pb-no{width:34px;height:34px;border-radius:12px;background:var(--lime);color:#23250a;font-weight:600;font-size:14px;display:grid;place-items:center;flex:none}
        .pb-ih b{flex:1;font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pb-del{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--glass);border:1px solid var(--line);color:var(--muted);transition:all .2s ease}
        .pb-del:hover{background:var(--bad);color:#fff;border-color:transparent}
        .pb-del svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}

        .pb-row3{display:grid;grid-template-columns:minmax(0,1.3fr) auto minmax(0,1fr);gap:14px;align-items:start}
        @media(max-width:640px){.pb-row3{grid-template-columns:1fr}}
        .pb-qty .pb-lb,.pb-tot .pb-lb{display:block;font-size:12px;color:var(--muted);margin:0 0 7px 4px}
        .pb-stepper{display:flex;align-items:center;height:58px;border-radius:18px;background:var(--glass);border:1.5px solid var(--line);padding:0 6px}
        .pb-stepper button{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--solid);border:1px solid var(--line)}
        .pb-stepper button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}
        .pb-stepper input{width:54px;height:100%;border:0;background:none;text-align:center;font:inherit;font-weight:600;font-size:16px;color:var(--ink);outline:0;padding:0}
        .pb-tot b{display:flex;align-items:center;height:58px;padding:0 16px;border-radius:18px;background:var(--lime-soft);font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden}

        /* Switch online */
        .pb-online{margin:2px 0 12px}
        .pb-sw{display:inline-flex;align-items:center;gap:12px;cursor:pointer;font-size:14.5px;font-weight:500;user-select:none;margin-bottom:12px}
        .pb-sw input{position:absolute;opacity:0;width:1px;height:1px}
        .pb-track{position:relative;width:48px;height:28px;border-radius:99px;background:var(--line);flex:none;transition:background .2s}
        .pb-track::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.3);transition:transform .2s}
        .pb-sw input:checked+.pb-track{background:var(--accent)}
        .pb-sw input:checked+.pb-track::after{transform:translateX(20px)}

        /* Tombol & Komponen */
        .pb-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;height:46px;padding:0 22px;border-radius:999px;font-weight:500;font-size:14.5px;white-space:nowrap;overflow:hidden;transition:all .2s ease}
        .pb-btn.dark{background:var(--dark);color:var(--on-dark);box-shadow:0 14px 26px -14px rgba(35,33,46,.7)}
        .pb-btn.soft{background:var(--solid);border:1px solid var(--line)}
        .pb-btn.lime{background:var(--lime);color:#23250a}
        .pb-btn.lg{height:56px;font-size:15.5px;width:100%}
        .pb-btn.sm{height:40px;padding:0 16px;font-size:13.5px}
        .pb-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

        /* Tanda Tangan */
        .pb-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
        .pb-sc{padding:16px;border-radius:22px;background:var(--glass);border:1px solid var(--line)}
        .pb-sc h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 12px}
        .pb-sig{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .pb-sigimg{width:64px;height:40px;border-radius:10px;border:1px solid var(--line);background:#fff center/contain no-repeat}

        /* Ringkasan */
        .pb-right{position:sticky;top:20px}
        .pb-sum{padding:10px;border-radius:30px;background:var(--glass);border:1px solid var(--line);box-shadow:var(--shadow);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
        .pb-sum>.pb-in{background:var(--solid);border-radius:22px;padding:24px 22px}
        .pb-sum h2{font-size:26px;font-weight:600;letter-spacing:-.03em;margin:0 0 18px}
        .pb-r{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 0;border-top:1px solid var(--line);font-size:14.5px}
        .pb-r span{color:var(--muted)}
        .pb-r b{font-weight:500;font-variant-numeric:tabular-nums;text-align:right}
        .pb-gt{padding:18px 0 6px;border-top:1px solid var(--line);margin-top:6px}
        .pb-gt .pb-r{border:0;padding:0 0 6px;flex-direction:column;align-items:flex-start;gap:2px}
        .pb-gt .pb-r b{font-size:30px;font-weight:600;letter-spacing:-.03em;text-align:left}
        .pb-tb-desc{font-size:12.5px;color:var(--muted);line-height:1.5;font-style:italic;margin-bottom:18px}
        .pb-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:16px}
        .pb-tools button{font-size:13px;color:var(--muted);padding:8px 12px;border-radius:999px;transition:all .2s}
        .pb-tools button:hover{background:var(--line);color:var(--ink)}
        .pb-tools button.warn{color:var(--bad)}

        /* Mobile Dock */
        .pb-dock{display:none;position:fixed;left:16px;right:16px;bottom:16px;z-index:90;padding:12px 18px;border-radius:24px;background:var(--solid);border:1px solid var(--line);box-shadow:0 16px 36px rgba(0,0,0,.15);align-items:center;justify-content:space-between}
        .pb-dock small{display:block;font-size:11px;color:var(--muted)}
        .pb-dock b{font-size:17px;font-weight:700}

        /* Toast */
        .pb-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(30px);opacity:0;pointer-events:none;z-index:999;padding:12px 24px;border-radius:999px;background:var(--dark);color:var(--on-dark);font-size:14px;font-weight:500;box-shadow:0 12px 30px rgba(0,0,0,.25);transition:all .3s cubic-bezier(.34,1.56,.64,1)}
        .pb-toast.on{transform:translateX(-50%) translateY(0);opacity:1}
        .pb-ori{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}
        .pb-ori span{font-size:13.5px;color:var(--muted);margin-right:4px}
        .pb-ori button{padding:9px 16px;border-radius:999px;font-size:13.5px;background:var(--glass);border:1.5px solid var(--line);transition:all .2s ease}
        .pb-ori button.on{background:var(--lime);border-color:var(--lime);color:#23250a;font-weight:600}
      `}</style>

      <div className="pb-root" data-theme={theme}>
        <div className="pb-amb" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>

        <div className="pb-wrap">
          {/* Header Bar */}
          <header className="pb-top">
            <div className="pb-brand">
              <div className="pb-logo">
                <svg viewBox="0 0 24 24">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              </div>
              <div>
                <h1>Pengajuan Barang</h1>
                <p>Susun daftar barang, lampirkan bukti foto produk, lalu cetak dokumennya.</p>
              </div>
            </div>

            {/* Tombol Pratinjau Dokumen ↗ */}
            <button
              type="button"
              onClick={() => handleOpenPratinjau()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1c2340] text-white text-xs font-bold shadow-md hover:bg-[#2f3b6b] transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Pratinjau Dokumen ↗</span>
            </button>

            {/* Theme Toggle */}
            <div className="pb-theme" role="group" aria-label="Tema">
              <button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                aria-label="Tema terang"
                onClick={() => setTheme('light')}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                aria-label="Tema gelap"
                onClick={() => setTheme('dark')}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
                </svg>
              </button>
            </div>
          </header>

          <div className="pb-grid">
            {/* Main Content Area */}
            <main className="pb-left">
              {/* 3 Step Progress Card */}
              <div className="pb-steps" aria-label="Kelengkapan pengajuan">
                <div className={`pb-step ${summary.step1Progress >= 1 ? 'done' : ''}`}>
                  <div className="pb-sh">
                    <span className="pb-sico">
                      <svg viewBox="0 0 24 24">
                        <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />
                      </svg>
                      <span className="pb-chk">
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7" />
                        </svg>
                      </span>
                    </span>
                    <div>
                      <b>Data barang</b>
                      <small>Nama, harga, jumlah</small>
                    </div>
                  </div>
                  <div className="pb-bar">
                    <i style={{ width: `${Math.round(summary.step1Progress * 100)}%` }}></i>
                  </div>
                </div>

                <div className={`pb-step ${summary.step2Progress >= 1 ? 'done' : ''}`}>
                  <div className="pb-sh">
                    <span className="pb-sico">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="m21 16-5-5-8 8" />
                      </svg>
                      <span className="pb-chk">
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7" />
                        </svg>
                      </span>
                    </span>
                    <div>
                      <b>Bukti gambar</b>
                      <small>Foto produk terlampir</small>
                    </div>
                  </div>
                  <div className="pb-bar">
                    <i style={{ width: `${Math.round(summary.step2Progress * 100)}%` }}></i>
                  </div>
                </div>

                <div className={`pb-step ${summary.step3Progress >= 1 ? 'done' : ''}`}>
                  <div className="pb-sh">
                    <span className="pb-sico">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                      </svg>
                      <span className="pb-chk">
                        <svg viewBox="0 0 24 24">
                          <path d="m5 12.5 4.5 4.5L19 7" />
                        </svg>
                      </span>
                    </span>
                    <div>
                      <b>Tanda tangan</b>
                      <small>Nama &amp; tanggal lengkap</small>
                    </div>
                  </div>
                  <div className="pb-bar">
                    <i style={{ width: `${Math.round(summary.step3Progress * 100)}%` }}></i>
                  </div>
                </div>
              </div>

              {/* View Formulir */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Informasi Dokumen */}
                <section className="pb-card">
                  <div className="pb-ch">
                    <div>
                      <h2>Informasi Dokumen</h2>
                      <p className="pb-sub">Kop surat dan keperluan yang tampil pada hasil cetak.</p>
                    </div>
                  </div>
                  <div className="pb-in">
                    <div className="pb-cols">
                      <div className="pb-fld">
                        <input
                          id="pb-m-instansi"
                          placeholder=" "
                          value={meta.instansi}
                          onChange={(e) => setMeta({ ...meta, instansi: e.target.value })}
                        />
                        <label htmlFor="pb-m-instansi">Nama sekolah / instansi</label>
                      </div>
                      <div className="pb-fld">
                        <input
                          id="pb-m-judul"
                          placeholder=" "
                          value={meta.judul}
                          onChange={(e) => setMeta({ ...meta, judul: e.target.value })}
                        />
                        <label htmlFor="pb-m-judul">Judul dokumen</label>
                      </div>
                    </div>
                    <div className="pb-fld">
                      <input
                        id="pb-m-alamat"
                        placeholder=" "
                        value={meta.alamat}
                        onChange={(e) => setMeta({ ...meta, alamat: e.target.value })}
                      />
                      <label htmlFor="pb-m-alamat">Alamat (opsional)</label>
                    </div>
                    <div className="pb-fld" style={{ margin: 0 }}>
                      <textarea
                        id="pb-m-kep"
                        rows={2}
                        placeholder=" "
                        value={meta.keperluan}
                        onChange={(e) => setMeta({ ...meta, keperluan: e.target.value })}
                      ></textarea>
                      <label htmlFor="pb-m-kep">Keperluan / alasan pengajuan (opsional)</label>
                    </div>
                    <div className="pb-ori" role="radiogroup" aria-label="Orientasi kertas">
                      <span>Orientasi kertas:</span>
                      <button
                        type="button"
                        className={meta.orient === 'landscape' ? 'on' : ''}
                        onClick={() => setMeta({ ...meta, orient: 'landscape' })}
                      >
                        Landscape
                      </button>
                      <button
                        type="button"
                        className={meta.orient === 'portrait' ? 'on' : ''}
                        onClick={() => setMeta({ ...meta, orient: 'portrait' })}
                      >
                        Portrait
                      </button>
                    </div>
                  </div>
                </section>

                {/* 2. Daftar Barang */}
                <section className="pb-card">
                  <div className="pb-ch">
                    <div>
                      <h2>Daftar Barang</h2>
                      <p className="pb-sub">Harga satuan × jumlah dihitung otomatis. Lampirkan foto bukti barang.</p>
                    </div>
                    <button className="pb-btn lime sm" type="button" onClick={handleAddItem}>
                      <svg viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Tambah Barang
                    </button>
                  </div>

                  <div className="pb-in">
                    <div className="pb-list">
                      {items.map((item, index) => {
                        const isNameBad = badFields[`name-${item.id}`];
                        const isPriceBad = badFields[`price-${item.id}`];
                        const isLinkBad = badFields[`link-${item.id}`];
                        const isDragOver = dragActiveId === item.id;

                        return (
                          <article key={item.id} className="pb-item" aria-label={`Barang ${index + 1}`}>
                            <div className="pb-ih">
                              <span className="pb-no">{index + 1}</span>
                              <b>{item.name.trim() || 'Barang baru'}</b>
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  className="pb-del"
                                  aria-label="Hapus barang"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M6 6l12 12M18 6 6 18" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {/* Nama Barang */}
                            <div className={`pb-fld ${isNameBad ? 'bad' : ''}`}>
                              <input
                                id={`pb-name-${item.id}`}
                                placeholder=" "
                                value={item.name}
                                autoComplete="off"
                                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                              />
                              <label htmlFor={`pb-name-${item.id}`}>Nama barang</label>
                              <div className="pb-err">Nama barang wajib diisi.</div>
                            </div>

                            {/* Spesifikasi */}
                            <div className="pb-fld">
                              <textarea
                                id={`pb-spec-${item.id}`}
                                rows={2}
                                placeholder=" "
                                value={item.spec}
                                onChange={(e) => handleItemChange(item.id, 'spec', e.target.value)}
                              ></textarea>
                              <label htmlFor={`pb-spec-${item.id}`}>Spesifikasi (merek, ukuran, warna, dll.)</label>
                            </div>

                            {/* Baris Harga, Qty, Total */}
                            <div className="pb-row3">
                              <div className={`pb-fld ${isPriceBad ? 'bad' : ''}`}>
                                <input
                                  id={`pb-price-${item.id}`}
                                  inputMode="numeric"
                                  placeholder=" "
                                  autoComplete="off"
                                  value={item.price ? IDR.format(item.price) : ''}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                                    handleItemChange(item.id, 'price', Number(digits) || 0);
                                  }}
                                />
                                <label htmlFor={`pb-price-${item.id}`}>Harga satuan (Rp)</label>
                                <div className="pb-err">Harga satuan wajib diisi.</div>
                              </div>

                              <div className="pb-qty">
                                <span className="pb-lb">Jumlah</span>
                                <div className="pb-stepper">
                                  <button
                                    type="button"
                                    aria-label="Kurangi jumlah"
                                    onClick={() => handleItemChange(item.id, 'qty', Math.max(1, item.qty - 1))}
                                  >
                                    <svg viewBox="0 0 24 24">
                                      <path d="M5 12h14" />
                                    </svg>
                                  </button>
                                  <input
                                    inputMode="numeric"
                                    value={item.qty}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                                      handleItemChange(item.id, 'qty', Math.max(1, Number(digits) || 1));
                                    }}
                                    aria-label="Jumlah barang"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Tambah jumlah"
                                    onClick={() => handleItemChange(item.id, 'qty', Math.min(9999, item.qty + 1))}
                                  >
                                    <svg viewBox="0 0 24 24">
                                      <path d="M12 5v14M5 12h14" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              <div className="pb-tot">
                                <span className="pb-lb">Harga × jumlah</span>
                                <b>{rp((item.price || 0) * (item.qty || 1))}</b>
                              </div>
                            </div>

                            {/* Beli Online Switch & Link */}
                            <div className="pb-online">
                              <label className="pb-sw">
                                <input
                                  type="checkbox"
                                  checked={item.online}
                                  onChange={(e) => handleItemChange(item.id, 'online', e.target.checked)}
                                />
                                <span className="pb-track"></span>
                                Beli online <small>— sertakan link produk</small>
                              </label>

                              {item.online && (
                                <div className={`pb-fld ${isLinkBad ? 'bad' : ''}`} style={{ marginTop: '8px' }}>
                                  <input
                                    id={`pb-link-${item.id}`}
                                    type="url"
                                    inputMode="url"
                                    placeholder=" "
                                    value={item.link}
                                    autoComplete="off"
                                    onChange={(e) => handleItemChange(item.id, 'link', e.target.value)}
                                  />
                                  <label htmlFor={`pb-link-${item.id}`}>Link produk (https://…)</label>
                                  <div className="pb-err">Masukkan link yang valid, diawali http:// atau https://</div>
                                </div>
                              )}
                            </div>

                            {/* ── BUKTI / GAMBAR BARANG ── */}
                            <div
                              className="pb-imgs"
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                alignItems: 'center',
                                marginTop: '12px',
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragActiveId(item.id);
                              }}
                              onDragLeave={() => setDragActiveId(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragActiveId(null);
                                if (e.dataTransfer?.files) {
                                  handleImageUpload(item.id, e.dataTransfer.files);
                                }
                              }}
                            >
                              {item.imgs &&
                                item.imgs.map((src, idx) => (
                                  <figure
                                    key={idx}
                                    className="pb-th"
                                    style={{
                                      margin: 0,
                                      position: 'relative',
                                      width: '72px',
                                      height: '72px',
                                      borderRadius: '16px',
                                      overflow: 'hidden',
                                      border: '1px solid rgba(31,29,43,0.1)',
                                      background: 'var(--line)',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <img
                                      src={src}
                                      alt={`Bukti ${idx + 1}`}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="pb-rm"
                                      aria-label="Hapus gambar"
                                      onClick={() => handleRemoveImage(item.id, idx)}
                                      style={{
                                        position: 'absolute',
                                        right: '4px',
                                        top: '4px',
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        background: 'rgba(20,18,30,0.75)',
                                        color: '#fff',
                                        border: 0,
                                        cursor: 'pointer',
                                        display: 'grid',
                                        placeItems: 'center',
                                        fontSize: '12px',
                                        lineHeight: 1,
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </figure>
                                ))}

                              {item.imgs.length < 3 && (
                                <label
                                  className="pb-add"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    height: '72px',
                                    padding: '0 18px',
                                    borderRadius: '16px',
                                    border: isDragOver
                                      ? '1.5px dashed var(--accent)'
                                      : '1.5px dashed rgba(31,29,43,0.2)',
                                    color: isDragOver ? 'var(--accent)' : '#7d7a8c',
                                    background: isDragOver ? 'rgba(143,127,224,0.08)' : 'transparent',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'all .2s ease',
                                  }}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      stroke: 'currentColor',
                                      fill: 'none',
                                      strokeWidth: 1.8,
                                    }}
                                  >
                                    <rect x="3" y="3" width="18" height="18" rx="4" />
                                    <circle cx="9" cy="10" r="2" />
                                    <path d="m21 16-5-5-8 8" />
                                  </svg>
                                  <span style={{ fontSize: '13.5px', fontWeight: 500 }}>
                                    {item.imgs.length > 0 ? '+ Tambah gambar' : 'Bukti / gambar barang'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/*"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      handleImageUpload(item.id, e.target.files);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 3. Tanda Tangan & Tanggal */}
                <section className="pb-card">
                  <div className="pb-ch">
                    <div>
                      <h2>Tanda Tangan &amp; Tanggal</h2>
                      <p className="pb-sub">Nama dan jabatan bisa diganti kapan saja. Gambar tanda tangan bersifat opsional.</p>
                    </div>
                  </div>
                  <div className="pb-in">
                    <div className="pb-cols">
                      <div className="pb-fld">
                        <input
                          id="pb-s-kota"
                          placeholder=" "
                          value={sign.kota}
                          onChange={(e) => setSign({ ...sign, kota: e.target.value })}
                        />
                        <label htmlFor="pb-s-kota">Kota</label>
                      </div>
                      <div className="pb-fld">
                        <input
                          id="pb-s-tgl"
                          type="date"
                          value={sign.tanggal}
                          onChange={(e) => setSign({ ...sign, tanggal: e.target.value })}
                        />
                        <label htmlFor="pb-s-tgl">Tanggal</label>
                      </div>
                    </div>

                    <div className="pb-sgrid">
                      {/* Kepala Sekolah */}
                      <div className="pb-sc">
                        <h3>Kepala Sekolah</h3>
                        <div className="pb-fld">
                          <input
                            id="pb-kepala-l"
                            placeholder=" "
                            value={sign.kepala.label}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                kepala: { ...sign.kepala, label: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-kepala-l">Jabatan / sebutan</label>
                        </div>
                        <div className="pb-fld">
                          <input
                            id="pb-kepala-n"
                            placeholder=" "
                            value={sign.kepala.name}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                kepala: { ...sign.kepala, name: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-kepala-n">Nama lengkap &amp; gelar</label>
                        </div>
                        <div className="pb-sig">
                          {sign.kepala.sig && (
                            <>
                              <div
                                className="pb-sigimg"
                                style={{ backgroundImage: `url('${sign.kepala.sig}')` }}
                              ></div>
                              <button
                                type="button"
                                className="pb-btn soft sm"
                                onClick={() => handleRemoveSig('kepala')}
                              >
                                Hapus
                              </button>
                            </>
                          )}
                          <label className="pb-btn soft sm" style={{ cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 1.8 }}>
                              <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                            </svg>
                            {sign.kepala.sig ? 'Ganti TTD' : 'Gambar TTD'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/*"
                              hidden
                              onChange={(e) => handleSigUpload('kepala', e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Waka Sarana Prasarana */}
                      <div className="pb-sc">
                        <h3>Waka Sarana Prasarana</h3>
                        <div className="pb-fld">
                          <input
                            id="pb-waka-l"
                            placeholder=" "
                            value={sign.waka.label}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                waka: { ...sign.waka, label: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-waka-l">Jabatan / sebutan</label>
                        </div>
                        <div className="pb-fld">
                          <input
                            id="pb-waka-n"
                            placeholder=" "
                            value={sign.waka.name}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                waka: { ...sign.waka, name: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-waka-n">Nama lengkap &amp; gelar</label>
                        </div>
                        <div className="pb-sig">
                          {sign.waka.sig && (
                            <>
                              <div
                                className="pb-sigimg"
                                style={{ backgroundImage: `url('${sign.waka.sig}')` }}
                              ></div>
                              <button
                                type="button"
                                className="pb-btn soft sm"
                                onClick={() => handleRemoveSig('waka')}
                              >
                                Hapus
                              </button>
                            </>
                          )}
                          <label className="pb-btn soft sm" style={{ cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 1.8 }}>
                              <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                            </svg>
                            {sign.waka.sig ? 'Ganti TTD' : 'Gambar TTD'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/*"
                              hidden
                              onChange={(e) => handleSigUpload('waka', e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Pemohon */}
                      <div className="pb-sc">
                        <h3>Pemohon</h3>
                        <div className="pb-fld">
                          <input
                            id="pb-pemohon-l"
                            placeholder=" "
                            value={sign.pemohon.label}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                pemohon: { ...sign.pemohon, label: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-pemohon-l">Jabatan / sebutan</label>
                        </div>
                        <div className="pb-fld">
                          <input
                            id="pb-pemohon-n"
                            placeholder=" "
                            value={sign.pemohon.name}
                            onChange={(e) =>
                              setSign({
                                ...sign,
                                pemohon: { ...sign.pemohon, name: e.target.value },
                              })
                            }
                          />
                          <label htmlFor="pb-pemohon-n">Nama lengkap &amp; gelar</label>
                        </div>
                        <div className="pb-sig">
                          {sign.pemohon.sig && (
                            <>
                              <div
                                className="pb-sigimg"
                                style={{ backgroundImage: `url('${sign.pemohon.sig}')` }}
                              ></div>
                              <button
                                type="button"
                                className="pb-btn soft sm"
                                onClick={() => handleRemoveSig('pemohon')}
                              >
                                Hapus
                              </button>
                            </>
                          )}
                          <label className="pb-btn soft sm" style={{ cursor: 'pointer' }}>
                            <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: 1.8 }}>
                              <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                            </svg>
                            {sign.pemohon.sig ? 'Ganti TTD' : 'Gambar TTD'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/*"
                              hidden
                              onChange={(e) => handleSigUpload('pemohon', e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </main>

            {/* Sidebar Ringkasan (Kanan) */}
            <aside className="pb-right">
              <div className="pb-sum">
                <div className="pb-in">
                  <h2>Ringkasan</h2>
                  <div className="pb-r">
                    <span>Jenis barang</span>
                    <b>{summary.n}</b>
                  </div>
                  <div className="pb-r">
                    <span>Total unit</span>
                    <b>{summary.totalUnits}</b>
                  </div>
                  <div className="pb-r">
                    <span>Beli online</span>
                    <b>{summary.onlineCount}</b>
                  </div>
                  <div className="pb-r">
                    <span>Dengan bukti gambar</span>
                    <b>
                      {summary.withImgsCount} / {summary.n}
                    </b>
                  </div>

                  <div className="pb-gt">
                    <div className="pb-r">
                      <span>Total pengajuan</span>
                      <b>{rp(summary.grandTotal)}</b>
                    </div>
                    {summary.grandTotal > 0 && (
                      <p className="pb-tb-desc">Terbilang: {summary.terbilangText}</p>
                    )}
                  </div>

                  {/* Tombol Simpan ke Database */}
                  <button
                    className={`pb-btn lime lg ${saving ? 'load' : ''}`}
                    type="button"
                    style={{ marginBottom: '10px' }}
                    onClick={handleSaveToDatabase}
                    disabled={saving}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    <span>{saving ? 'Menyimpan...' : 'Simpan ke Database'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { fetchHistory(); setShowHistoryModal(true); }}
                    className="w-full mt-2.5 py-3 px-5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>📜</span> Riwayat Pengajuan
                  </button>

                  {/* Tombol Pratinjau Dokumen ↗ */}
                  <button
                    type="button"
                    className="pb-btn dark lg mt-2.5"
                    onClick={() => handleOpenPratinjau()}
                  >
                    <svg style={{ width: '20px', height: '20px', marginRight: '6px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Pratinjau Dokumen ↗</span>
                  </button>

                  {/* Tombol Cetak Dokumen */}
                  <button
                    className={`pb-btn soft lg ${printing ? 'load' : ''}`}
                    type="button"
                    onClick={handlePrint}
                    disabled={printing}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
                    </svg>
                    <span>{printing ? 'Menyimpan & Mencetak...' : 'Cetak Dokumen'}</span>
                  </button>

                  {/* Alat Ekspor, Impor, Reset */}
                  <div className="pb-tools">
                    <button type="button" onClick={handleExportJSON}>
                      Ekspor data
                    </button>
                    <label style={{ cursor: 'pointer' }}>
                      <span className="pb-tools button" style={{ fontSize: '13px', color: 'var(--muted)', padding: '8px 12px', borderRadius: '999px' }}>
                        Impor data
                      </span>
                      <input
                        type="file"
                        accept="application/json,.json"
                        style={{ display: 'none' }}
                        onChange={handleImportJSON}
                      />
                    </label>
                    <button type="button" className="warn" onClick={handleReset}>
                      {resetConfirm ? 'Yakin reset? Klik lagi' : 'Reset'}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Mobile Sticky Dock */}
        <div className="pb-dock" id="pb-dock">
          <div>
            <small>Total pengajuan</small>
            <b>{rp(summary.grandTotal)}</b>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="pb-btn lime sm"
              type="button"
              onClick={handleSaveToDatabase}
              disabled={saving}
            >
              {saving ? 'Simpan...' : 'Simpan'}
            </button>
            <button
              className="pb-btn dark sm"
              type="button"
              onClick={() => handleOpenPratinjau()}
            >
              Pratinjau ↗
            </button>
            <button
              className="pb-btn soft sm"
              type="button"
              onClick={handlePrint}
              disabled={printing}
            >
              Cetak
            </button>
          </div>
        </div>

        {/* Toast Floating Notification */}
        <div
          className={`pb-toast ${toastMessage ? 'on' : ''}`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>

        {/* Modal Riwayat Pengajuan */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white dark:bg-[#1a1824] rounded-3xl p-6 shadow-2xl border border-white/10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">📜 Riwayat Pengajuan</h2>
                <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full">✕</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-3">
                {historyList.length === 0 && <p className="text-center text-muted">Belum ada riwayat.</p>}
                {historyList.map(item => (
                  <div key={item.id} className="p-4 rounded-xl border border-line bg-black/5 dark:bg-white/5 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{item.meta?.keperluan || 'Tanpa keperluan'}</p>
                      <p className="text-xs text-muted">{item.created_at}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleOpenPratinjau(item.id)} className="text-xs font-bold text-accent hover:underline cursor-pointer px-2 py-1">Pratinjau</button>
                      <button onClick={() => handleSoftDelete(Number(item.id))} className="text-xs font-bold text-bad">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
