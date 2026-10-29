import React, { useEffect, useRef } from 'react';

export interface PengajuanBarangViewProps {
  onAddToast?: (message: string) => void;
}

export const PengajuanBarangView: React.FC<PengajuanBarangViewProps> = ({ onAddToast }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Helper functions
    const $ = (s: string, r?: Element | Document | null) => (r || root).querySelector(s) as HTMLElement | null;
    const $$ = (s: string, r?: Element | Document | null) => [...(r || root).querySelectorAll(s)] as HTMLElement[];
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ESC = (s: any) =>
      String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
      );
    const IDR = new Intl.NumberFormat('id-ID');
    const rp = (n: number) => 'Rp ' + IDR.format(Math.round(n || 0));
    const uid = () => 'i' + Math.random().toString(36).slice(2, 9);
    const ico: Record<string, string> = {
      x: '<path d="M6 6l12 12M18 6 6 18"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      img: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
      box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
      check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
      doc: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
      pen: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
      tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
    };
    const svg = (n: string, sw?: number) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[n] || ''}</svg>`;

    let tt: any;
    const toast = (m: string) => {
      const e = $('#pb-toast');
      if (e) {
        e.textContent = m;
        e.classList.add('on');
        clearTimeout(tt);
        tt = setTimeout(() => e.classList.remove('on'), 2800);
      }
      if (onAddToast) {
        onAddToast(m);
      }
    };

    /* ── state ── */
    const KEY = 'pb.v1';
    const today = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    const DEF = () => ({
      meta: {
        instansi: '',
        alamat: '',
        judul: 'Pengajuan Pembelian Barang',
        keperluan: '',
        orient: 'landscape',
      },
      items: [] as any[],
      sign: {
        kota: 'Medan',
        tanggal: today(),
        kepala: { label: 'Kepala Sekolah', name: 'Lyly Rismaidy, S.Pd', sig: '' },
        waka: { label: 'Waka Sarana Prasarana', name: 'Faisal Azmi, Sp', sig: '' },
        pemohon: { label: 'PEMOHON', name: 'M. Rizqy Aditya Fahrezi, S.Ds', sig: '' },
      },
    });

    function merge(a: any, b: any) {
      for (const k in b) {
        if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') {
          merge(a[k], b[k]);
        } else {
          a[k] = b[k];
        }
      }
      return a;
    }

    let S = DEF();
    try {
      const t = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (t) S = merge(DEF(), t);
    } catch (_) {}

    S.items = (S.items || []).map((n: any) => ({
      id: n.id || uid(),
      name: n.name || '',
      spec: n.spec || '',
      price: +n.price || 0,
      qty: Math.max(1, +n.qty || 1),
      online: !!n.online,
      link: n.link || '',
      imgs: Array.isArray(n.imgs) ? n.imgs.slice(0, 3) : [],
    }));

    let sv: any;
    let warned = false;
    const save = () => {
      clearTimeout(sv);
      sv = setTimeout(() => {
        try {
          localStorage.setItem(KEY, JSON.stringify(S));
        } catch (_) {
          try {
            const l = JSON.parse(JSON.stringify(S));
            l.items.forEach((i: any) => (i.imgs = []));
            localStorage.setItem(KEY, JSON.stringify(l));
            if (!warned) {
              warned = true;
              toast('Penyimpanan penuh: gambar tidak ikut tersimpan otomatis');
            }
          } catch (_) {}
        }
      }, 350);
    };

    const get = (o: any, p: string) => p.split('.').reduce((a, k) => a && a[k], o);
    const set = (o: any, p: string, v: any) => {
      const k = p.split('.');
      const l = k.pop()!;
      k.reduce((a, x) => a[x], o)[l] = v;
    };
    const lineTot = (i: any) => (+i.price || 0) * (+i.qty || 0);
    const grand = () => S.items.reduce((s: number, i: any) => s + lineTot(i), 0);
    const urlOK = (u: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test((u || '').trim());

    /* ── terbilang ── */
    function terbilang(n: number) {
      n = Math.floor(Math.abs(n));
      const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
      const t = (n: number): string => {
        if (n < 12) return s[n];
        if (n < 20) return t(n - 10) + ' belas';
        if (n < 100) return t(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + t(n % 10) : '');
        if (n < 200) return 'seratus' + (n > 100 ? ' ' + t(n - 100) : '');
        if (n < 1e3) return t(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + t(n % 100) : '');
        if (n < 2e3) return 'seribu' + (n > 1e3 ? ' ' + t(n - 1e3) : '');
        if (n < 1e6) return t(Math.floor(n / 1e3)) + ' ribu' + (n % 1e3 ? ' ' + t(n % 1e3) : '');
        if (n < 1e9) return t(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + t(n % 1e6) : '');
        if (n < 1e12) return t(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + t(n % 1e9) : '');
        return t(Math.floor(n / 1e12)) + ' triliun' + (n % 1e12 ? ' ' + t(n % 1e12) : '');
      };
      const r = n === 0 ? 'nol' : t(n);
      return r.charAt(0).toUpperCase() + r.slice(1) + ' rupiah';
    }

    const longDate = (v: string) => {
      if (!v) return '';
      const [y, m, d] = v.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    /* ── gambar ── */
    const readImg = (f: File, max: number, png?: boolean) =>
      new Promise<string>((res, rej) => {
        if (!f || !f.type.startsWith('image/')) return rej(new Error('File harus berupa gambar'));
        if (f.size > 15 * 1048576) return rej(new Error('Ukuran gambar maksimal 15 MB'));
        const r = new FileReader();
        r.onerror = () => rej(new Error('Gagal membaca file'));
        r.onload = () => {
          const im = new Image();
          im.onerror = () => rej(new Error('Gambar tidak dapat dibuka'));
          im.onload = () => {
            const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(im.naturalWidth * k));
            c.height = Math.max(1, Math.round(im.naturalHeight * k));
            const g = c.getContext('2d')!;
            if (!png) {
              g.fillStyle = '#fff';
              g.fillRect(0, 0, c.width, c.height);
            }
            g.drawImage(im, 0, 0, c.width, c.height);
            res(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82));
          };
          im.src = r.result as string;
        };
        r.readAsDataURL(f);
      });

    /* ── tema ── */
    const setTheme = (t: string) => {
      root.dataset.theme = t;
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem('laporanwee_theme', t);
        localStorage.setItem('pb.theme', t);
      } catch (_) {}
    };

    const currentAppTheme = document.documentElement.dataset.theme || localStorage.getItem('laporanwee_theme') || 'light';
    setTheme(currentAppTheme === 'dark' ? 'dark' : 'light');

    const handleThemeClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('[data-theme-set]') as HTMLElement | null;
      if (b && b.dataset.themeSet) {
        setTheme(b.dataset.themeSet);
      }
    };
    root.addEventListener('click', handleThemeClick);

    /* ── tampilan Formulir / Pratinjau ── */
    let view = 'form';
    function moveInd() {
      const c = $('#pb-seg');
      if (!c) return;
      const i = $('.pb-ind', c);
      const b = $('button.on', c);
      if (i && b) {
        i.style.width = b.offsetWidth + 'px';
        i.style.height = b.offsetHeight + 'px';
        i.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`;
      }
    }

    function setView(v: string, noScroll?: boolean) {
      view = v;
      $$('#pb-seg button').forEach((b) => {
        const on = b.dataset.view === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      moveInd();
      const f = $('#pb-vform');
      const p = $('#pb-vprev');
      if (f) f.classList.toggle('pb-hide', v !== 'form');
      if (p) p.classList.toggle('pb-hide', v !== 'prev');
      const t = v === 'form' ? f : p;
      if (t) {
        t.classList.remove('pb-enter');
        void t.offsetWidth;
        t.classList.add('pb-enter');
      }
      if (v === 'prev') {
        renderDoc();
        fit();
      }
      if (!noScroll) {
        window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      }
    }

    const segEl = $('#pb-seg');
    const handleSegClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('button') as HTMLElement | null;
      if (b && b.dataset.view) setView(b.dataset.view);
    };
    segEl?.addEventListener('click', handleSegClick);

    const toPrevBtn = $('#pb-toprev');
    if (toPrevBtn) toPrevBtn.onclick = () => setView(view === 'form' ? 'prev' : 'form');

    /* ── daftar barang ── */
    const list = $('#pb-list');
    const fld = (f: string, label: string, val: any, extra?: any) =>
      `<div class="pb-fld"${extra && extra.cls ? ` data-w="${f}"` : ''}><input data-f="${f}" id="pb-${f}-%ID%" placeholder=" " value="${ESC(val)}"${extra && extra.attr || ''}><label for="pb-${f}-%ID%">${label}</label><div class="pb-err">${extra && extra.err || ''}</div></div>`;

    function itemHTML(it: any, i: number) {
      const id = it.id;
      const r = (s: string) => s.replace(/%ID%/g, id);
      return `<div class="pb-iw" data-id="${id}"><article class="pb-item" aria-label="Barang ${i + 1}">
      <div class="pb-ih"><span class="pb-no" data-no>${i + 1}</span><b data-title>${ESC(it.name || 'Barang baru')}</b><button type="button" class="pb-del" data-act="del" aria-label="Hapus barang">${svg('x')}</button></div>
      ${r(fld('name', 'Nama barang', it.name, { err: 'Nama barang wajib diisi.', attr: ' autocomplete="off"' }))}
      <div class="pb-fld"><textarea data-f="spec" id="pb-spec-${id}" rows="2" placeholder=" ">${ESC(it.spec)}</textarea><label for="pb-spec-${id}">Spesifikasi (merek, ukuran, warna, dll.)</label></div>
      <div class="pb-row3">
        <div class="pb-fld"><input data-f="price" id="pb-price-${id}" inputmode="numeric" placeholder=" " value="${it.price ? IDR.format(it.price) : ''}" autocomplete="off"><label for="pb-price-${id}">Harga satuan (Rp)</label><div class="pb-err">Harga satuan wajib diisi.</div></div>
        <div class="pb-qty"><span class="pb-lb">Jumlah</span><div class="pb-stepper"><button type="button" data-act="dec" aria-label="Kurangi jumlah">${svg('minus', 2.2)}</button><input data-f="qty" inputmode="numeric" value="${it.qty}" aria-label="Jumlah barang"><button type="button" data-act="inc" aria-label="Tambah jumlah">${svg('plus', 2.2)}</button></div></div>
        <div class="pb-tot"><span class="pb-lb">Harga × jumlah</span><b data-total>${rp(lineTot(it))}</b></div>
      </div>
      <div class="pb-online"><label class="pb-sw"><input type="checkbox" role="switch" data-f="online"${it.online ? ' checked' : ''}><span class="pb-track"></span>Beli online <small>— sertakan link produk</small></label>
        <div class="pb-collapse${it.online ? ' on' : ''}" data-col><div><div class="pb-fld" style="margin:0"><input data-f="link" id="pb-link-${id}" type="url" inputmode="url" placeholder=" " value="${ESC(it.link)}" autocomplete="off"><label for="pb-link-${id}">Link produk (https://…)</label><div class="pb-err">Masukkan link yang valid, diawali http:// atau https://</div></div></div></div></div>
      <div class="pb-imgs" data-imgs>${imgsHTML(it)}</div></article></div>`;
    }

    function imgsHTML(it: any) {
      return (
        it.imgs
          .map(
            (s: string, k: number) =>
              `<figure class="pb-th" style="margin:0"><img src="${s}" alt="Bukti barang ${k + 1}"><button type="button" class="pb-rm" data-act="rmimg" data-k="${k}" aria-label="Hapus gambar">${svg('x', 2.4)}</button></figure>`
          )
          .join('') +
        `<label class="pb-add${it.imgs.length >= 3 ? ' full' : ''}" data-drop>${svg('img', 1.8)}<span>${it.imgs.length ? 'Tambah gambar' : 'Bukti / gambar barang'}</span><input type="file" accept="image/*" multiple hidden data-act="img"></label>`
      );
    }

    const emptyHTML = () =>
      `<div class="pb-empty" id="pb-empty"><div class="pb-ei">${svg('box', 1.7)}</div><b>Belum ada barang</b><p>Tambahkan barang pertama yang ingin diajukan.</p><div style="margin-top:18px"><button type="button" class="pb-btn dark" data-act="add">${svg('plus', 2.2)}Tambah Barang</button></div></div>`;

    function renderList() {
      if (!list) return;
      list.innerHTML = S.items.length ? S.items.map(itemHTML).join('') : emptyHTML();
    }

    const byId = (id: string) => S.items.find((i: any) => i.id === id);
    const node = (id: string) => $(`.pb-iw[data-id="${id}"]`, list);

    function renumber() {
      $$('.pb-iw', list).forEach((w, i) => {
        const no = $('[data-no]', w);
        if (no) no.textContent = String(i + 1);
        const item = $('.pb-item', w);
        if (item) item.setAttribute('aria-label', 'Barang ' + (i + 1));
      });
    }

    function addItem() {
      if (!list) return;
      const it = { id: uid(), name: '', spec: '', price: 0, qty: 1, online: false, link: '', imgs: [] };
      S.items.push(it);
      const em = $('#pb-empty');
      if (em) em.remove();
      list.insertAdjacentHTML('beforeend', itemHTML(it, S.items.length - 1));
      const w = node(it.id);
      if (w && !RM) {
        w.classList.add('pb-new');
        void w.offsetWidth;
        requestAnimationFrame(() => w.classList.remove('pb-new'));
      }
      setTimeout(() => {
        if (w) {
          w.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
          const n = $('[data-f=name]', w) as HTMLInputElement | null;
          if (n) n.focus({ preventScroll: true });
        }
      }, RM ? 0 : 300);
      changed();
    }

    function delItem(id: string) {
      if (!list) return;
      const w = node(id);
      S.items = S.items.filter((i: any) => i.id !== id);
      const fin = () => {
        if (w) w.remove();
        if (!S.items.length) list.innerHTML = emptyHTML();
        renumber();
        changed();
      };
      if (w && !RM) {
        w.classList.add('pb-gone');
        setTimeout(fin, 520);
      } else {
        fin();
      }
      changed();
    }

    const addBtn = $('#pb-add');
    if (addBtn) addBtn.onclick = addItem;

    function fmtMoney(el: HTMLInputElement) {
      const pos = el.selectionStart || 0;
      const before = el.value.slice(0, pos).replace(/\D/g, '').length;
      const d = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
      const f = d ? IDR.format(+d) : '';
      el.value = f;
      let c = 0, i = 0;
      for (; i < f.length && c < before; i++) {
        if (/\d/.test(f[i])) c++;
      }
      try {
        el.setSelectionRange(i, i);
      } catch (_) {}
      return +d || 0;
    }

    function upd(w: HTMLElement, it: any) {
      const t = $('[data-total]', w);
      if (!t) return;
      const v = rp(lineTot(it));
      if (t.textContent !== v) {
        t.textContent = v;
        if (!RM) {
          t.classList.remove('pb-bump');
          void t.offsetWidth;
          t.classList.add('pb-bump');
        }
      }
    }

    const setBad = (el: HTMLElement, bad: boolean) => {
      const f = el.closest('.pb-fld');
      if (f) f.classList.toggle('bad', bad);
    };

    function setQty(w: HTMLElement, it: any, v: number) {
      it.qty = Math.min(9999, Math.max(1, Math.round(+v) || 1));
      const q = $('[data-f=qty]', w) as HTMLInputElement | null;
      if (q) q.value = String(it.qty);
      upd(w, it);
      changed();
    }

    const handleListInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      const w = el.closest('.pb-iw') as HTMLElement | null;
      if (!w) return;
      const it = byId(w.dataset.id || '');
      const f = el.dataset.f;
      if (!it || !f) return;
      if (f === 'name') {
        it.name = el.value;
        const dt = $('[data-title]', w);
        if (dt) dt.textContent = it.name.trim() || 'Barang baru';
        setBad(el, false);
      } else if (f === 'spec') {
        it.spec = el.value;
      } else if (f === 'price') {
        it.price = fmtMoney(el);
        setBad(el, false);
        upd(w, it);
      } else if (f === 'qty') {
        const d = el.value.replace(/\D/g, '');
        el.value = d.slice(0, 4);
        it.qty = Math.max(1, +d || 1);
        upd(w, it);
      } else if (f === 'link') {
        it.link = el.value;
        setBad(el, false);
      }
      changed();
    };

    const handleListFocusOut = (e: Event) => {
      const el = e.target as HTMLInputElement;
      const w = el.closest('.pb-iw') as HTMLElement | null;
      if (!w) return;
      const it = byId(w.dataset.id || '');
      const f = el.dataset.f;
      if (!it) return;
      if (f === 'name') setBad(el, !it.name.trim());
      if (f === 'price') setBad(el, !(it.price > 0));
      if (f === 'qty') el.value = String(it.qty);
      if (f === 'link' && it.online) setBad(el, !urlOK(it.link));
    };

    const handleListChange = async (e: Event) => {
      const el = e.target as HTMLInputElement;
      const w = el.closest('.pb-iw') as HTMLElement | null;
      if (!w) return;
      const it = byId(w.dataset.id || '');
      if (!it) return;
      if (el.dataset.f === 'online') {
        it.online = el.checked;
        const col = $('[data-col]', w);
        if (col) col.classList.toggle('on', it.online);
        const l = $('[data-f=link]', w) as HTMLInputElement | null;
        if (it.online && l) {
          setTimeout(() => l.focus({ preventScroll: true }), RM ? 0 : 260);
        } else if (l) {
          setBad(l, false);
        }
        changed();
      }
      if (el.dataset.act === 'img' && el.files) {
        await addImgs(it, w, [...el.files]);
        el.value = '';
      }
    };

    async function addImgs(it: any, w: HTMLElement, files: File[]) {
      const room = 3 - it.imgs.length;
      if (room <= 0) {
        toast('Maksimal 3 gambar per barang');
        return;
      }
      if (files.length > room) {
        toast('Hanya ' + room + ' gambar yang ditambahkan (maks. 3)');
      }
      for (const f of files.slice(0, room)) {
        try {
          it.imgs.push(await readImg(f, 720));
        } catch (err: any) {
          toast(err?.message || 'Gagal menambahkan gambar');
        }
      }
      const imgsContainer = $('[data-imgs]', w);
      if (imgsContainer) imgsContainer.innerHTML = imgsHTML(it);
      changed();
    }

    const handleListClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('[data-act]') as HTMLElement | null;
      if (!b || b.tagName === 'INPUT') return;
      const act = b.dataset.act;
      if (act === 'add') {
        addItem();
        return;
      }
      const w = b.closest('.pb-iw') as HTMLElement | null;
      if (!w) return;
      const it = byId(w.dataset.id || '');
      if (!it) return;
      if (act === 'del') delItem(it.id);
      else if (act === 'inc') setQty(w, it, it.qty + 1);
      else if (act === 'dec') setQty(w, it, it.qty - 1);
      else if (act === 'rmimg') {
        it.imgs.splice(+b.dataset.k!, 1);
        const imgsContainer = $('[data-imgs]', w);
        if (imgsContainer) imgsContainer.innerHTML = imgsHTML(it);
        changed();
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const d = (e.target as Element).closest('[data-drop]') as HTMLElement | null;
      if (d) {
        e.preventDefault();
        d.classList.add('over');
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      const d = (e.target as Element).closest('[data-drop]') as HTMLElement | null;
      if (d) d.classList.remove('over');
    };

    const handleDrop = (e: DragEvent) => {
      const d = (e.target as Element).closest('[data-drop]') as HTMLElement | null;
      if (!d) return;
      e.preventDefault();
      d.classList.remove('over');
      const w = d.closest('.pb-iw') as HTMLElement | null;
      const it = w ? byId(w.dataset.id || '') : null;
      if (it && w && e.dataTransfer?.files) {
        addImgs(it, w, [...e.dataTransfer.files]);
      }
    };

    if (list) {
      list.addEventListener('input', handleListInput);
      list.addEventListener('focusout', handleListFocusOut);
      list.addEventListener('change', handleListChange);
      list.addEventListener('click', handleListClick);
      list.addEventListener('dragover', handleDragOver);
      list.addEventListener('dragenter', handleDragOver);
      list.addEventListener('dragleave', handleDragLeave);
      list.addEventListener('drop', handleDrop);
    }

    /* ── field umum & tanda tangan ── */
    function bindAll() {
      $$('[data-bind]', root).forEach((el) => {
        (el as HTMLInputElement).value = get(S, (el as HTMLElement).dataset.bind || '') || '';
      });
    }

    const handleRootInput = (e: Event) => {
      const el = (e.target as Element).closest('[data-bind]') as HTMLInputElement | null;
      if (!el || !el.dataset.bind) return;
      set(S, el.dataset.bind, el.value);
      changed();
    };
    root.addEventListener('input', handleRootInput);

    type SigPerson = { label: string; name: string; sig: string };
    type SigKey = 'kepala' | 'waka' | 'pemohon';
    const SIG: [SigKey, string][] = [
      ['kepala', 'Kepala Sekolah'],
      ['waka', 'Waka Sarana Prasarana'],
      ['pemohon', 'Pemohon'],
    ];

    function renderSig() {
      const sgEl = $('#pb-sgrid');
      if (!sgEl) return;
      sgEl.innerHTML = SIG.map(
        ([k, t]) => {
          const person = S.sign[k] as SigPerson;
          return `<div class="pb-sc"><h3>${t}</h3>
      <div class="pb-fld"><input id="pb-${k}-l" data-bind="sign.${k}.label" placeholder=" " value="${ESC(person.label)}"><label for="pb-${k}-l">Jabatan / sebutan</label></div>
      <div class="pb-fld"><input id="pb-${k}-n" data-bind="sign.${k}.name" placeholder=" " value="${ESC(person.name)}"><label for="pb-${k}-n">Nama lengkap &amp; gelar</label></div>
      <div class="pb-sig">${
        person.sig
          ? `<div class="pb-sigimg" style="background-image:url('${person.sig}')"></div><button type="button" class="pb-btn soft sm" data-sig-rm="${k}">Hapus</button>`
          : ''
      }
      <label class="pb-btn soft sm" style="cursor:pointer">${svg('pen', 1.8)}${
        person.sig ? 'Ganti' : 'Gambar TTD'
      }<input type="file" accept="image/*" hidden data-sig="${k}"></label></div></div>`;
        }
      ).join('');
    }

    const sgridEl = $('#pb-sgrid');
    const handleSigChange = async (e: Event) => {
      const el = (e.target as Element).closest('[data-sig]') as HTMLInputElement | null;
      if (!el || !el.files || !el.files[0] || !el.dataset.sig) return;
      try {
        const k = el.dataset.sig as SigKey;
        (S.sign[k] as SigPerson).sig = await readImg(el.files[0], 420, true);
        renderSig();
        changed();
      } catch (err: any) {
        toast(err?.message || 'Gagal memuat gambar tanda tangan');
      }
      el.value = '';
    };

    const handleSigClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('[data-sig-rm]') as HTMLElement | null;
      if (b && b.dataset.sigRm) {
        const k = b.dataset.sigRm as SigKey;
        (S.sign[k] as SigPerson).sig = '';
        renderSig();
        changed();
      }
    };

    if (sgridEl) {
      sgridEl.addEventListener('change', handleSigChange);
      sgridEl.addEventListener('click', handleSigClick);
    }

    /* ── ringkasan, progres, dokumen ── */
    const tw: Record<string, number> = {};
    function tween(el: HTMLElement | null, to: number) {
      if (!el) return;
      const from = tw[el.id] != null ? tw[el.id] : 0;
      tw[el.id] = to;
      if (RM || from === to) {
        el.textContent = rp(to);
        return;
      }
      const t0 = performance.now();
      const d = 550;
      (function f(t) {
        const k = Math.min(1, (t - t0) / d);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = rp(from + (to - from) * e);
        if (k < 1 && tw[el.id] === to) requestAnimationFrame(f);
        else el.textContent = rp(to);
      })(t0);
    }

    const itemOK = (i: any) => i.name.trim() && i.price > 0 && i.qty >= 1 && (!i.online || urlOK(i.link));

    function steps() {
      const n = S.items.length;
      const a = n ? S.items.filter(itemOK).length / n : 0;
      const b = n ? S.items.filter((i: any) => i.imgs.length).length / n : 0;
      const sg = S.sign;
      const c = [sg.kota, sg.tanggal, sg.kepala.name, sg.waka.name, sg.pemohon.name].filter((v) => String(v || '').trim()).length / 5;
      const def: [string, string, string, number][] = [
        ['Data barang', 'Nama, harga, jumlah', 'box', a],
        ['Bukti gambar', 'Foto produk terlampir', 'img', b],
        ['Tanda tangan', 'Nama & tanggal lengkap', 'pen', c],
      ];
      const el = $('#pb-steps');
      if (!el) return;
      if (!el.children.length) {
        el.innerHTML = def
          .map(
            (d) =>
              `<div class="pb-step"><div class="pb-sh"><span class="pb-sico">${svg(d[2], 1.8)}<span class="pb-chk">${svg('check', 3)}</span></span><div><b>${d[0]}</b><small>${d[1]}</small></div></div><div class="pb-bar"><i></i></div></div>`
          )
          .join('');
      }
      $$('.pb-step', el).forEach((s, i) => {
        s.classList.toggle('done', def[i][3] >= 1);
        const bar = $('.pb-bar i', s);
        if (bar) bar.style.width = Math.round(def[i][3] * 100) + '%';
      });
    }

    function summary() {
      const n = S.items.length;
      const q = S.items.reduce((s: number, i: any) => s + i.qty, 0);
      const o = S.items.filter((i: any) => i.online).length;
      const im = S.items.filter((i: any) => i.imgs.length).length;
      const g = grand();
      const sn = $('#pb-s-n');
      if (sn) sn.textContent = String(n);
      const sq = $('#pb-s-q');
      if (sq) sq.textContent = IDR.format(q);
      const so = $('#pb-s-o');
      if (so) so.textContent = String(o);
      const si = $('#pb-s-i');
      if (si) si.textContent = `${im} / ${n}`;
      tween($('#pb-s-t'), g);
      const dt = $('#pb-d-t');
      if (dt) dt.textContent = rp(g);
      const stb = $('#pb-s-tb');
      if (stb) stb.textContent = g > 0 ? 'Terbilang: ' + terbilang(g) : '';
      steps();
    }

    function applyPage(land: boolean) {
      const p = $('#pb-paper');
      if (!p) return;
      p.style.setProperty('--pw', land ? '297mm' : '210mm');
      p.style.setProperty('--ph', land ? '210mm' : '297mm');
      p.style.setProperty('--th', land ? '27mm' : '16mm');
      p.style.setProperty(
        '--cols',
        land
          ? '13mm minmax(0,1.5fr) 26mm 11mm 30mm minmax(0,1.2fr)'
          : '11mm minmax(0,1.5fr) 24mm 9mm 27mm minmax(0,1.1fr)'
      );
      let st = document.getElementById('pb-pagecss') as HTMLStyleElement | null;
      if (!st) {
        st = document.createElement('style');
        st.id = 'pb-pagecss';
        document.head.appendChild(st);
      }
      st.textContent = `@page{size:A4 ${land ? 'landscape' : 'portrait'};margin:0}`;
    }

    function syncOri() {
      $$('[data-orient]', root).forEach((b) => {
        const on = (S.meta.orient || 'landscape') === b.dataset.orient;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
    }

    const handleOrientClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest('[data-orient]') as HTMLElement | null;
      if (b && b.dataset.orient) {
        S.meta.orient = b.dataset.orient;
        syncOri();
        changed();
      }
    };
    root.addEventListener('click', handleOrientClick);

    function renderDoc() {
      const m = S.meta;
      const sg = S.sign;
      const g = grand();
      const land = m.orient !== 'portrait';
      applyPage(land);

      const rowHTML = (i: any, k: number) => {
        const thumbs = i.imgs.length
          ? `<div class="pb-th2">${i.imgs.map((x: string) => `<img src="${x}" alt="">`).join('')}</div>`
          : '';
        const lk = i.online && i.link ? `<a class="pb-lk" href="${ESC(i.link)}" target="_blank" rel="noreferrer">${ESC(i.link)}</a>` : '';
        return `<div class="pb-rw"><div class="c1"><b>${k + 1}</b><span>Barang</span></div><div class="c2"><b class="nm">${ESC(
          i.name || '—'
        )}</b>${i.spec ? `<p class="sp">${ESC(i.spec)}</p>` : ''}<span class="bd2${i.online ? ' on' : ''}">${
          i.online ? 'Beli Online' : 'Beli Langsung'
        }</span></div>
        <div class="c3">${rp(i.price)}</div><div class="c4">${i.qty}</div><div class="c5">${rp(lineTot(i))}</div><div class="c6">${thumbs}${lk}${
          !thumbs && !lk ? '<span class="pb-dash">–</span>' : ''
        }</div></div>`;
      };

      const rows = S.items.length ? S.items.map(rowHTML) : ['<div class="pb-none">Belum ada barang yang diajukan.</div>'];
      const sig = (k: SigKey, top?: string) => {
        const p = S.sign[k] as SigPerson;
        return `<div><div class="pb-l1">${top || '&nbsp;'}</div><div class="pb-l2">${
          k === 'pemohon' ? '<u>' + ESC(p.label) + '</u>' : ESC(p.label)
        }</div><div class="pb-sg">${p.sig ? `<img src="${p.sig}" alt="">` : ''}</div><div class="pb-nm2">( ${ESC(
          p.name || '………………………'
        )} )</div></div>`;
      };

      const fin = `<div class="pb-fin"><div class="pb-gt2"><span>Total Pengajuan</span><b>${rp(g)}</b></div>${
        g > 0 ? `<p class="pb-tbl">Terbilang: ${ESC(terbilang(g))}</p>` : ''
      }
        <div class="pb-ttd">${sig('kepala')}${sig('waka')}${sig(
        'pemohon',
        `${ESC(sg.kota)}${sg.kota && sg.tanggal ? ', ' : ''}<u>${ESC(longDate(sg.tanggal))}</u>`
      )}</div></div>`;

      const ini = (sg.pemohon.name || '').toUpperCase();
      const n = S.items.length;
      const pageHTML = (o: any) =>
        `<section class="pb-pg"><header class="pb-hd"><div class="pb-hr1"><div class="pb-bd"><div class="pb-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div><div><b>WEE LAPORAN</b><small>${ESC(
          m.judul || 'Pengajuan Barang'
        )}</small></div></div>
        <div class="pb-org">${m.instansi ? `<b>${ESC(m.instansi)}</b>` : ''}${m.alamat ? ESC(m.alamat) : ''}</div></div>
        <div class="pb-hr2"><div><small>Pengajuan oleh</small><b>${ESC(sg.pemohon.name || '—')}</b><span>${ESC(
          sg.pemohon.label
        )}</span></div><div class="r"><small>Tanggal</small><b>${ESC(longDate(sg.tanggal) || '—')}</b><span>${n} barang</span></div></div></header>
        ${
          o.bar
            ? `<div class="pb-tb"><div>No</div><div>Nama Barang &amp; Spesifikasi</div><div>Harga Satuan</div><div>Qty</div><div>Jumlah</div><div>Link / Bukti</div></div>
        <div class="pb-sec"><b>Daftar Barang</b><span>${n} jenis · ${IDR.format(
                S.items.reduce((a: number, i: any) => a + i.qty, 0)
              )} unit</span></div>${m.keperluan ? `<p class="pb-kp">Keperluan: ${ESC(m.keperluan)}</p>` : ''}`
            : ''
        }
        <div class="pb-pbody">${o.body}</div><footer class="pb-ft">Halaman ${o.n} dari ${o.t} · ${ESC(ini)}</footer></section>`;

      /* ukur tinggi baris & ruang tersedia, lalu bagi ke beberapa halaman */
      const meas = document.createElement('div');
      meas.className = 'pb-paper';
      const paperEl = $('#pb-paper');
      if (!paperEl) return;
      meas.style.cssText = paperEl.style.cssText + ';position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none';
      meas.innerHTML = pageHTML({ n: 1, t: 1, bar: true, body: '' });
      document.body.appendChild(meas);

      const bd = $('.pb-pbody', meas);
      if (!bd) {
        document.body.removeChild(meas);
        return;
      }
      const H = bd.clientHeight - 8;
      bd.style.cssText = 'flex:none;height:auto;overflow:visible;margin:0 9mm';
      bd.innerHTML = rows.join('') + fin;

      const hs = [...bd.children].map((c) => c.getBoundingClientRect().height);
      document.body.removeChild(meas);

      const rh = hs.slice(0, rows.length);
      const fh = hs[rows.length] || 0;
      const pages: { rows: number[]; final?: boolean; only?: boolean }[] = [];
      let cur: number[] = [];
      let used = 0;

      rh.forEach((h, i) => {
        if (cur.length && used + h > H) {
          pages.push({ rows: cur });
          cur = [];
          used = 0;
        }
        cur.push(i);
        used += h;
      });

      if (used + fh <= H) {
        pages.push({ rows: cur, final: true });
      } else {
        pages.push({ rows: cur });
        pages.push({ rows: [], final: true, only: true });
      }

      const t = pages.length;
      let k = 0;
      paperEl.innerHTML = pages
        .map((pg) => {
          k++;
          return pageHTML({
            n: k,
            t,
            bar: !pg.only,
            body: pg.rows.map((i) => rows[i]).join('') + (pg.final ? fin : ''),
          });
        })
        .join('');
    }

    function fit() {
      const w = $('#pb-pw');
      const p = $('#pb-paper');
      if (!w || !p || !w.offsetParent) return;
      p.style.transform = 'none';
      const pw = p.offsetWidth;
      const k = Math.min(1, w.clientWidth / pw);
      p.style.transform = k < 1 ? `scale(${k})` : 'none';
      w.style.height = p.offsetHeight * k + 'px';
    }

    const ro = new ResizeObserver(() => {
      if (view === 'prev') fit();
    });
    const pwEl = $('#pb-pw');
    if (pwEl) ro.observe(pwEl);

    let rq = 0;
    const frame = () => {
      rq = 0;
      summary();
      if (view === 'prev') {
        renderDoc();
        fit();
      }
    };

    function changed() {
      if (!rq) rq = requestAnimationFrame(frame);
      save();
      document.dispatchEvent(new CustomEvent('pb:change', { detail: S }));
    }

    /* ── validasi & cetak ── */
    function validate() {
      if (!S.items.length) {
        toast('Tambahkan minimal satu barang dulu');
        addItem();
        return false;
      }
      let first: HTMLElement | null = null;
      S.items.forEach((i: any) => {
        const w = node(i.id);
        if (!w) return;
        const chk = (f: string, bad: boolean) => {
          const el = $(`[data-f=${f}]`, w);
          if (el) {
            setBad(el, bad);
            if (bad && !first) first = el;
          }
        };
        chk('name', !i.name.trim());
        chk('price', !(i.price > 0));
        if (i.online) chk('link', !urlOK(i.link));
      });
      if (first) {
        setView('form', true);
        setTimeout(() => {
          if (first) {
            first.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
            first.focus({ preventScroll: true });
          }
        }, 60);
        toast('Lengkapi isian yang ditandai merah');
        return false;
      }
      return true;
    }

    let oldTitle = '';
    function doPrint(btn?: HTMLElement) {
      if (!validate()) return;
      renderDoc();
      if (btn) btn.classList.add('load');
      const go = () => {
        oldTitle = document.title;
        document.title = 'Pengajuan Barang - ' + (longDate(S.sign.tanggal) || '');
        const vprev = $('#pb-vprev');
        const wasHide = vprev?.classList.contains('pb-hide');
        if (vprev) vprev.classList.remove('pb-hide');
        const p = $('#pb-paper');
        if (p) p.style.transform = 'none';

        const done = () => {
          document.title = oldTitle;
          if (wasHide && vprev) vprev.classList.add('pb-hide');
          fit();
          if (btn) btn.classList.remove('load');
          window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        setTimeout(() => {
          try {
            window.print();
          } catch (_) {
            toast('Cetak tidak tersedia di tampilan ini. Buka file di browser.');
            done();
          }
        }, 50);
      };
      setTimeout(go, RM ? 0 : 350);
    }

    const printBtn1 = $('#pb-print');
    if (printBtn1) printBtn1.onclick = (e) => doPrint(e.currentTarget as HTMLElement);
    const printBtn2 = $('#pb-print2');
    if (printBtn2) printBtn2.onclick = (e) => doPrint(e.currentTarget as HTMLElement);

    /* ── ekspor / impor / reset ── */
    function exportJSON() {
      const b = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'pengajuan-barang.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast('Data diekspor');
    }

    const expBtn = $('#pb-exp');
    if (expBtn) expBtn.onclick = exportJSON;
    const impBtn = $('#pb-imp');
    const impfInput = $('#pb-impf') as HTMLInputElement | null;
    if (impBtn && impfInput) impBtn.onclick = () => impfInput.click();

    function setState(o: any) {
      const n = merge(DEF(), o || {});
      n.items = (Array.isArray(n.items) ? n.items : []).map((x: any) => ({
        id: uid(),
        name: String(x.name || ''),
        spec: String(x.spec || ''),
        price: Math.max(0, +x.price || 0),
        qty: Math.min(9999, Math.max(1, +x.qty || 1)),
        online: !!x.online,
        link: String(x.link || ''),
        imgs: Array.isArray(x.imgs)
          ? x.imgs.filter((s: any) => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 3)
          : [],
      }));
      S = n;
      bindAll();
      syncOri();
      renderSig();
      renderList();
      changed();
    }

    if (impfInput) {
      impfInput.onchange = (e: any) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            setState(JSON.parse(r.result as string));
            toast('Data diimpor');
          } catch (_) {
            toast('File JSON tidak valid');
          }
        };
        r.readAsText(f);
      };
    }

    let rt: any;
    const rstBtn = $('#pb-rst');
    if (rstBtn) {
      rstBtn.onclick = (e) => {
        const b = e.currentTarget as HTMLElement;
        if (b.dataset.arm) {
          clearTimeout(rt);
          delete b.dataset.arm;
          b.textContent = 'Reset';
          setState(DEF());
          toast('Data direset');
          return;
        }
        b.dataset.arm = '1';
        b.textContent = 'Yakin reset? Klik lagi';
        rt = setTimeout(() => {
          delete b.dataset.arm;
          b.textContent = 'Reset';
        }, 3000);
      };
    }

    // Expose API
    (window as any).PB = {
      getState: () => JSON.parse(JSON.stringify(S)),
      setState,
      print: () => doPrint(),
      exportJSON,
      reset: () => setState(DEF()),
    };

    /* ── init ── */
    bindAll();
    syncOri();
    renderSig();
    renderList();
    summary();

    requestAnimationFrame(() => {
      moveInd();
    });

    const handleResize = () => {
      moveInd();
      if (view === 'prev') fit();
    };
    window.addEventListener('resize', handleResize);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        moveInd();
        if (view === 'prev') {
          renderDoc();
          fit();
        }
      });
    }

    return () => {
      clearTimeout(tt);
      clearTimeout(sv);
      clearTimeout(rt);
      if (rq) cancelAnimationFrame(rq);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      root.removeEventListener('click', handleThemeClick);
      segEl?.removeEventListener('click', handleSegClick);
      root.removeEventListener('input', handleRootInput);
      root.removeEventListener('click', handleOrientClick);
      if (sgridEl) {
        sgridEl.removeEventListener('change', handleSigChange);
        sgridEl.removeEventListener('click', handleSigClick);
      }
      if (list) {
        list.removeEventListener('input', handleListInput);
        list.removeEventListener('focusout', handleListFocusOut);
        list.removeEventListener('change', handleListChange);
        list.removeEventListener('click', handleListClick);
        list.removeEventListener('dragover', handleDragOver);
        list.removeEventListener('dragenter', handleDragOver);
        list.removeEventListener('dragleave', handleDragLeave);
        list.removeEventListener('drop', handleDrop);
      }
      const st = document.getElementById('pb-pagecss');
      if (st) st.remove();
      delete (window as any).PB;
    };
  }, [onAddToast]);

  return (
    <div className="pb-page-wrapper" style={{ width: '100%', minHeight: '100%' }}>
      {/* Scoped CSS from laporanwe-pengajuan-barang.html */}
      <style>{`
        .pb-root {
          --ink:#1f1d2b;--muted:#7d7a8c;--glass:rgba(255,255,255,.64);--solid:rgba(255,255,255,.95);--line:rgba(31,29,43,.1);
          --dark:#23212e;--on-dark:#fff;--lime:#d4ee6b;--lime-soft:#e9f5b8;--lav:#d9d3f5;--accent:#7a69d0;--bad:#c9443f;--ok:#3f8f5f;
          --blob1:rgba(176,160,240,.55);--blob2:rgba(244,214,170,.6);--bg1:#e6e5ec;--bg2:#f1f0f5;
          --shadow:0 1px 0 rgba(255,255,255,.9) inset,0 24px 48px -30px rgba(60,50,110,.42);
          --ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);
          position:relative;min-height:100vh;color:var(--ink);font-family:'Outfit',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;
          background:transparent;overflow-x:hidden;color-scheme:light;
        }
        .pb-root[data-theme=dark] {
          --ink:#f2f0fa;--muted:#9a97ad;--glass:rgba(40,38,54,.62);--solid:rgba(46,44,64,.95);--line:rgba(255,255,255,.1);--dark:#f2f0fa;--on-dark:#1f1d2b;--lime-soft:rgba(212,238,107,.18);
          --lav:#3b3560;--accent:#a99bf0;--bad:#ef7b77;--ok:#7fcf9c;--blob1:rgba(110,90,200,.42);--blob2:rgba(200,140,80,.22);--bg1:#14131b;--bg2:#1b1a24;
          --shadow:0 1px 0 rgba(255,255,255,.05) inset,0 26px 50px -30px rgba(0,0,0,.75);color-scheme:dark;
        }
        .pb-root *,.pb-root *::before,.pb-root *::after{box-sizing:border-box}
        .pb-root h1,.pb-root h2,.pb-root h3,.pb-root p{margin:0}
        .pb-root button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .pb-root svg{display:block}.pb-root :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
        .pb-hide{display:none!important}.pb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
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
        .pb-top h1{font-size:clamp(28px,3.6vw,40px);font-weight:600;letter-spacing:-.035em;line-height:1.05}
        .pb-top p{color:var(--muted);font-size:14px;margin-top:4px}
        .pb-seg{position:relative;display:inline-flex;padding:5px;border-radius:999px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        .pb-seg button{position:relative;z-index:1;display:flex;align-items:center;gap:8px;padding:9px 18px;border-radius:999px;font-size:14px;font-weight:500;color:var(--muted)}
        .pb-seg button.on{color:var(--on-dark)}.pb-seg svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
        .pb-seg .pb-ind{position:absolute;left:0;top:0;border-radius:999px;background:var(--dark);box-shadow:0 10px 20px -10px rgba(35,33,46,.6)}
        .pb-theme{display:flex;padding:4px;border-radius:999px;background:var(--glass);border:1px solid var(--line);position:relative}
        .pb-theme button{position:relative;z-index:1;width:36px;height:32px;display:grid;place-items:center;border-radius:999px;color:var(--muted)}
        .pb-theme svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .pb-theme .pb-knob{position:absolute;top:4px;left:4px;width:36px;height:32px;border-radius:999px;background:var(--solid);box-shadow:0 4px 10px -4px rgba(0,0,0,.25)}
        .pb-root[data-theme=dark] .pb-theme .pb-knob{transform:translateX(36px)}

        .pb-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;align-items:start}
        .pb-left{display:flex;flex-direction:column;gap:20px;min-width:0}
        .pb-card{background:var(--glass);backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);border:1px solid var(--line);border-radius:30px;padding:10px;box-shadow:var(--shadow)}
        .pb-card>.pb-in{background:var(--solid);border-radius:22px;padding:22px}
        .pb-ch{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px 14px;flex-wrap:wrap}
        .pb-ch h2{font-size:18px;font-weight:600;letter-spacing:-.015em}.pb-sub{color:var(--muted);font-size:13.5px;line-height:1.5;margin-top:2px}
        .pb-eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:var(--muted)}

        /* progres 3 tahap */
        .pb-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:6px 6px 2px}
        .pb-step{min-width:0}.pb-step .pb-sh{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .pb-sico{position:relative;width:34px;height:34px;border-radius:12px;background:var(--solid);border:1px solid var(--line);display:grid;place-items:center;flex:none}
        .pb-sico svg{width:18px;height:18px;stroke:var(--ink);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .pb-chk{position:absolute;right:-6px;top:-6px;width:18px;height:18px;border-radius:50%;background:var(--accent);display:grid;place-items:center;transform:scale(0)}
        .pb-step.done .pb-chk{transform:scale(1)}.pb-chk svg{width:10px;height:10px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
        .pb-sh b{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}.pb-sh small{color:var(--muted);font-size:12px}
        .pb-bar{height:9px;border-radius:99px;background:var(--line);overflow:hidden}.pb-bar i{display:block;height:100%;width:0;border-radius:99px;background:var(--lime)}

        /* field */
        .pb-fld{position:relative;margin-bottom:14px}
        .pb-fld input,.pb-fld textarea{width:100%;border-radius:18px;border:1.5px solid var(--line);background:var(--glass);padding:23px 16px 7px;font:inherit;font-size:15.5px;color:var(--ink);outline:0;resize:vertical}
        .pb-fld input{height:58px}.pb-fld textarea{min-height:84px;line-height:1.45}
        .pb-fld label{position:absolute;left:17px;top:18px;font-size:15px;color:var(--muted);pointer-events:none;transform-origin:left top}
        .pb-fld input:focus+label,.pb-fld input:not(:placeholder-shown)+label,.pb-fld textarea:focus+label,.pb-fld textarea:not(:placeholder-shown)+label{transform:translateY(-11px) scale(.78)}
        .pb-fld input:focus,.pb-fld textarea:focus{border-color:var(--accent);box-shadow:0 0 0 5px rgba(143,127,224,.2)}
        .pb-fld input[type=date]+label{transform:translateY(-11px) scale(.78)}
        .pb-err{font-size:12.5px;color:var(--bad);padding-left:8px;max-height:0;opacity:0;overflow:hidden}
        .pb-fld.bad input,.pb-fld.bad textarea{border-color:var(--bad)}.pb-fld.bad .pb-err{max-height:24px;opacity:1;margin-top:6px}
        .pb-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}

        /* kartu barang */
        .pb-list{display:flex;flex-direction:column}
        .pb-iw{display:grid;grid-template-rows:1fr}.pb-iw>.pb-item{min-height:0;margin-bottom:14px}
        .pb-item{position:relative;padding:18px;border-radius:24px;background:var(--solid);border:1px solid var(--line)}
        .pb-ih{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .pb-no{width:34px;height:34px;border-radius:12px;background:var(--lime);color:#23250a;font-weight:600;font-size:14px;display:grid;place-items:center;flex:none}
        .pb-ih b{flex:1;font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pb-del{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--glass);border:1px solid var(--line);color:var(--muted)}
        .pb-del svg,.pb-btn svg,.pb-add svg,.pb-rm svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
        .pb-del:hover{background:var(--bad);color:#fff;border-color:transparent}
        .pb-row3{display:grid;grid-template-columns:minmax(0,1.3fr) auto minmax(0,1fr);gap:14px;align-items:start}
        .pb-qty .pb-lb,.pb-tot .pb-lb{display:block;font-size:12px;color:var(--muted);margin:0 0 7px 4px}
        .pb-stepper{display:flex;align-items:center;height:58px;border-radius:18px;background:var(--glass);border:1.5px solid var(--line);padding:0 6px}
        .pb-stepper button{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--solid);border:1px solid var(--line)}
        .pb-stepper button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}
        .pb-stepper:focus-within{border-color:var(--accent);box-shadow:0 0 0 5px rgba(143,127,224,.2)}
        .pb-stepper input:focus-visible{outline:0}
        .pb-stepper input{width:54px;height:100%;border:0;background:none;text-align:center;font:inherit;font-weight:600;font-size:16px;color:var(--ink);outline:0;padding:0}
        .pb-tot{padding-top:0}.pb-tot b{display:flex;align-items:center;height:58px;padding:0 16px;border-radius:18px;background:var(--lime-soft);font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden}

        /* switch online */
        .pb-online{margin:2px 0 12px}
        .pb-sw{display:inline-flex;align-items:center;gap:12px;cursor:pointer;font-size:14.5px;font-weight:500;user-select:none;margin-bottom:12px}
        .pb-sw input{position:absolute;opacity:0;width:1px;height:1px}
        .pb-track{position:relative;width:48px;height:28px;border-radius:99px;background:var(--line);flex:none}
        .pb-track::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.3)}
        .pb-sw input:checked+.pb-track{background:var(--accent)}.pb-sw input:checked+.pb-track::after{transform:translateX(20px)}
        .pb-sw input:focus-visible+.pb-track{outline:2px solid var(--accent);outline-offset:3px}
        .pb-sw small{color:var(--muted);font-weight:400}
        .pb-collapse{display:grid;grid-template-rows:0fr}.pb-collapse.on{grid-template-rows:1fr}.pb-collapse>div{min-height:0;overflow:hidden}
        .pb-collapse.on>div{overflow:visible}

        /* gambar bukti */
        .pb-imgs{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .pb-th{position:relative;width:72px;height:72px;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:var(--line)}
        .pb-th img{width:100%;height:100%;object-fit:cover;display:block}
        .pb-rm{position:absolute;right:4px;top:4px;width:22px;height:22px;border-radius:50%;background:rgba(20,18,30,.7);color:#fff;display:grid;place-items:center}
        .pb-rm svg{width:11px;height:11px}
        .pb-add{display:inline-flex;align-items:center;gap:8px;height:72px;padding:0 18px;border-radius:16px;border:1.5px dashed var(--line);color:var(--muted);font-size:13.5px;font-weight:500;cursor:pointer;background:transparent}
        .pb-add:hover,.pb-add.over{border-color:var(--accent);color:var(--accent);background:rgba(143,127,224,.08)}
        .pb-add.full{display:none}
        .pb-empty{text-align:center;padding:38px 16px 30px;color:var(--muted)}
        .pb-empty b{display:block;color:var(--ink);font-size:17px;font-weight:600;margin-bottom:6px}
        .pb-empty .pb-ei{width:64px;height:64px;border-radius:22px;background:var(--lav);margin:0 auto 16px;display:grid;place-items:center}
        .pb-empty .pb-ei svg{width:28px;height:28px;stroke:var(--ink);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

        /* tombol */
        .pb-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;height:46px;padding:0 22px;border-radius:999px;font-weight:500;font-size:14.5px;white-space:nowrap;overflow:hidden}
        .pb-btn.dark{background:var(--dark);color:var(--on-dark);box-shadow:0 14px 26px -14px rgba(35,33,46,.7)}
        .pb-btn.soft{background:var(--solid);border:1px solid var(--line)}.pb-btn.lime{background:var(--lime);color:#23250a}
        .pb-btn.lg{height:56px;font-size:15.5px;width:100%}.pb-btn.sm{height:40px;padding:0 16px;font-size:13.5px}
        .pb-btn .pb-spn{position:absolute;width:20px;height:20px;border-radius:50%;border:2.5px solid transparent;border-top-color:currentColor;opacity:0}
        .pb-btn.load{pointer-events:none}.pb-btn.load>*:not(.pb-spn){opacity:0}.pb-btn.load .pb-spn{opacity:1}

        /* tanda tangan (editor) */
        .pb-sgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
        .pb-sc{padding:16px;border-radius:22px;background:var(--glass);border:1px solid var(--line)}
        .pb-sc h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:12px}
        .pb-sc .pb-fld{margin-bottom:10px}.pb-sig{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .pb-sigimg{width:64px;height:40px;border-radius:10px;border:1px solid var(--line);background:#fff center/contain no-repeat}

        /* ringkasan (kolom kanan) */
        .pb-right{position:sticky;top:20px}
        .pb-sum{padding:10px;border-radius:30px;background:var(--glass);border:1px solid var(--line);box-shadow:var(--shadow);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
        .pb-sum>.pb-in{background:var(--solid);border-radius:22px;padding:24px 22px}
        .pb-sum h2{font-size:26px;font-weight:600;letter-spacing:-.03em;margin-bottom:18px}
        .pb-r{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 0;border-top:1px solid var(--line);font-size:14.5px}
        .pb-r span{color:var(--muted)}.pb-r b{font-weight:500;font-variant-numeric:tabular-nums;text-align:right}
        .pb-gt{padding:18px 0 6px;border-top:1px solid var(--line);margin-top:6px}
        .pb-gt .pb-r{border:0;padding:0 0 6px;flex-direction:column;align-items:flex-start;gap:2px}.pb-gt .pb-r b{font-size:30px;font-weight:600;letter-spacing:-.03em;text-align:left}
        .pb-tb{font-size:12.5px;color:var(--muted);line-height:1.5;font-style:italic;margin-bottom:18px}
        .pb-sum .pb-btn+.pb-btn{margin-top:10px}
        .pb-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:16px}
        .pb-tools button{font-size:13px;color:var(--muted);padding:8px 12px;border-radius:999px}.pb-tools button:hover{background:var(--line);color:var(--ink)}
        .pb-tools button.warn{color:var(--bad)}
        .pb-dock{display:none}

        /* DOKUMEN CETAK A4 */
        .pb-paperwrap{width:100%;overflow:hidden;border-radius:6px}
        .pb-paper{--pw:297mm;--ph:210mm;--th:27mm;--cols:13mm minmax(0,1.5fr) 26mm 11mm 30mm minmax(0,1.2fr);--nv:#2f3b6b;--nv2:#44558f;--tx:#1c2340;--mu:#7c84a0;--ln:#cfd4e1;
          width:var(--pw);display:flex;flex-direction:column;gap:6mm;transform-origin:top left;font-family:'Poppins',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--tx);line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .pb-paper *,.pb-paper *::before,.pb-paper *::after{box-sizing:border-box;margin:0;color:inherit}
        .pb-pg{position:relative;flex:none;width:var(--pw);height:var(--ph);display:flex;flex-direction:column;background:#eceef3;overflow:hidden;box-shadow:0 30px 70px -30px rgba(40,30,90,.55)}
        .pb-hd{position:relative;flex:none;background:var(--nv);padding:8mm 9mm 17mm;border-bottom-right-radius:18mm;overflow:hidden}
        .pb-hd::before{content:"";position:absolute;right:-22mm;top:-50mm;width:108mm;height:108mm;border-radius:50%;background:var(--nv2);opacity:.85}
        .pb-hd::after{content:"";position:absolute;left:-26mm;bottom:-36mm;width:82mm;height:82mm;border-radius:50%;background:rgba(255,255,255,.08)}
        .pb-hd>*{position:relative;z-index:1}.pb-paper .pb-hd,.pb-paper .pb-hd *{color:#fff}
        .pb-hr1,.pb-hr2{display:flex;justify-content:space-between;gap:8mm}.pb-hr1{align-items:flex-start}.pb-hr2{align-items:flex-end;margin-top:7mm}
        .pb-bd{display:flex;align-items:center;gap:3mm}
        .pb-dots{display:grid;grid-template-columns:repeat(3,1.7mm);gap:.9mm}.pb-dots i{width:1.7mm;height:1.7mm;border-radius:50%;background:#ee5a73}
        .pb-bd b{display:block;font-size:17pt;font-weight:700;letter-spacing:.02em;line-height:1.05}
        .pb-bd small{display:block;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;font-weight:600;opacity:.85;margin-top:.6mm}
        .pb-org{text-align:right;font-size:7.5pt;line-height:1.55}.pb-org b{display:block;font-size:8.5pt;text-transform:uppercase;font-weight:700}
        .pb-hr2 small{display:block;font-size:7pt;opacity:.85}.pb-hr2 b{display:block;font-size:14pt;font-weight:700;line-height:1.2;margin:.6mm 0}
        .pb-hr2 span{display:block;font-size:6.5pt;text-transform:uppercase;letter-spacing:.05em;opacity:.9}.pb-hr2 .r{text-align:right}
        .pb-tb{position:relative;z-index:2;flex:none;margin:-9mm 9mm 0;display:grid;grid-template-columns:var(--cols);background:#f4f6fb;border-radius:6mm;box-shadow:0 2mm 6mm -2mm rgba(30,40,90,.28);padding:3.6mm 0;font-size:8pt;font-weight:600;text-align:center}
        .pb-tb div{padding:0 2mm;border-left:.3mm solid var(--ln)}.pb-tb div:first-child{border:0}
        .pb-sec{flex:none;margin:5mm 9mm 0;padding:0 2mm 1.6mm;border-bottom:.35mm solid var(--nv);display:flex;justify-content:space-between;align-items:baseline;gap:6mm}
        .pb-sec b{font-size:10pt;font-weight:700;color:var(--nv)}.pb-sec span{font-size:7.5pt;color:var(--mu);text-align:right}
        .pb-kp{flex:none;margin:1.6mm 11mm 0;font-size:7.5pt;color:#5b6483;font-style:italic;line-height:1.45}
        .pb-pbody{flex:1;min-height:0;margin:0 9mm;overflow:hidden}
        .pb-rw{display:grid;grid-template-columns:var(--cols);border-bottom:.3mm solid var(--ln)}
        .pb-rw>div{padding:3mm 2.5mm;border-left:.3mm solid var(--ln);min-width:0}.pb-rw>div:first-child{border-left:0}
        .pb-rw .c1{text-align:center}.pb-rw .c1 b{display:block;font-size:11pt;font-weight:700;color:var(--nv);line-height:1.2}.pb-rw .c1 span{font-size:6.5pt;color:var(--mu)}
        .pb-rw .nm{display:block;font-size:9.5pt;font-weight:600;line-height:1.3}.pb-rw .sp{font-size:7.5pt;color:var(--mu);white-space:pre-line;margin-top:.6mm;overflow-wrap:anywhere}
        .pb-rw .bd2{display:inline-block;margin-top:1.8mm;padding:.7mm 2.6mm;border-radius:99px;font-size:6.5pt;font-weight:600;background:#e3e6f5}.pb-paper .pb-rw .bd2{color:#3a4a86}
        .pb-rw .bd2.on{background:#d7f3e3}.pb-paper .pb-rw .bd2.on{color:#1c7a4a}
        .pb-rw .c3,.pb-rw .c5{text-align:right;font-size:8.5pt;font-weight:500;white-space:nowrap}.pb-rw .c5{font-weight:700}.pb-rw .c4{text-align:center;font-size:9pt;font-weight:600}
        .pb-th2{display:flex;gap:2mm;flex-wrap:wrap}.pb-th2 img{width:var(--th);height:calc(var(--th)*.72);object-fit:cover;border-radius:2mm;border:.4mm solid #fff;box-shadow:0 .8mm 2.6mm rgba(30,40,90,.28)}
        .pb-lk{display:block;font-size:6.5pt;color:#3a4a86;text-decoration:underline;overflow-wrap:anywhere;line-height:1.35;margin-top:1.6mm}.pb-th2+.pb-lk{margin-top:2mm}
        .pb-dash{color:var(--mu);font-size:8pt}
        .pb-none{padding:12mm 0;text-align:center;color:var(--mu);font-size:9pt;border-bottom:.3mm solid var(--ln)}
        .pb-fin{padding-top:5mm}
        .pb-gt2{display:flex;justify-content:space-between;align-items:center;gap:6mm;padding:3.4mm 6mm;background:var(--nv);border-radius:6mm}
        .pb-paper .pb-gt2,.pb-paper .pb-gt2 *{color:#fff}.pb-gt2 span{font-size:8pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase}.pb-gt2 b{font-size:13pt;font-weight:700;letter-spacing:-.01em}
        .pb-tbl{margin:2mm 3mm 0;font-size:7.5pt;font-style:italic;color:#4a5373}
        .pb-ttd{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:5mm;text-align:center;font-size:8.5pt}
        .pb-ttd .pb-l1,.pb-ttd .pb-l2{min-height:1.5em}.pb-ttd .pb-l2{font-weight:600}.pb-ttd .pb-sg{height:17mm;display:flex;align-items:center;justify-content:center}.pb-ttd .pb-sg img{max-height:16mm;max-width:42mm;object-fit:contain}
        .pb-ttd .pb-nm2{font-weight:700;font-size:8.5pt}.pb-ttd u{text-decoration:underline}
        .pb-ft{flex:none;margin:3mm 9mm 6mm;height:8mm;border-radius:99px;background:var(--nv);display:grid;place-items:center;font-size:7.5pt;font-weight:500;letter-spacing:.02em}.pb-paper .pb-ft{color:#fff}
        .pb-ori{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}.pb-ori span{font-size:13.5px;color:var(--muted);margin-right:4px}
        .pb-ori button{padding:9px 16px;border-radius:999px;font-size:13.5px;background:var(--glass);border:1.5px solid var(--line);transition:background .3s,border-color .3s,transform .4s var(--spring)}
        .pb-ori button:hover{transform:translateY(-2px)}.pb-ori button.on{background:var(--lime);border-color:var(--lime);color:#23250a}

        /* Responsif */
        @media(max-width:1060px){
          .pb-grid{grid-template-columns:1fr}.pb-right{position:static}
          .pb-dock{display:flex;position:fixed;z-index:30;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));align-items:center;gap:12px;padding:10px 10px 10px 20px;border-radius:999px;
            background:var(--glass);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--line);box-shadow:0 24px 50px -20px rgba(60,50,110,.6)}
          .pb-dock div{flex:1;min-width:0}.pb-dock small{display:block;color:var(--muted);font-size:11.5px}.pb-dock b{font-size:18px;font-weight:600;white-space:nowrap}.pb-dock .pb-btn{height:48px}
        }
        @media(max-width:720px){
          .pb-wrap{width:calc(100% - 24px);padding-top:16px}.pb-steps{grid-template-columns:1fr;gap:12px}.pb-cols{grid-template-columns:1fr}
          .pb-row3{grid-template-columns:1fr 1fr}.pb-row3 .pb-fld{grid-column:1/-1}.pb-card>.pb-in,.pb-sum>.pb-in{padding:16px}.pb-item{padding:14px}.pb-seg button{padding:9px 14px}
        }

        /* Motion & animations */
        .pb-root{transition:background .6s var(--ease),color .4s}
        .pb-amb i:nth-child(1){animation:pb-d1 22s ease-in-out infinite alternate}
        .pb-amb i:nth-child(2){animation:pb-d2 26s ease-in-out infinite alternate}
        .pb-amb i:nth-child(3){animation:pb-d2 30s ease-in-out infinite alternate-reverse}
        @keyframes pb-d1{to{transform:translate(120px,-80px) scale(1.15)}}
        @keyframes pb-d2{to{transform:translate(-110px,90px) scale(1.1)}}
        .pb-rv{opacity:0;transform:translateY(22px) scale(.985);filter:blur(8px);animation:pb-rise .9s var(--ease) forwards;animation-delay:calc(var(--i,0)*.08s + .05s)}
        @keyframes pb-rise{to{opacity:1;transform:none;filter:none}}
        .pb-view.pb-enter>*{animation:pb-rise .7s var(--ease) both}
        .pb-view.pb-enter>*:nth-child(2){animation-delay:.07s}
        .pb-view.pb-enter>*:nth-child(3){animation-delay:.14s}
        .pb-seg .pb-ind{transition:transform .55s var(--ease),width .45s var(--ease),height .45s var(--ease)}.pb-seg button{transition:color .3s}
        .pb-theme .pb-knob{transition:transform .5s var(--ease)}
        .pb-btn{transition:transform .35s var(--ease),box-shadow .35s var(--ease),background .3s,opacity .3s}
        .pb-btn:hover{transform:translateY(-2px)}.pb-btn:active{transform:scale(.97)}.pb-btn.dark:hover{box-shadow:0 20px 30px -14px rgba(35,33,46,.75)}
        .pb-btn .pb-spn{animation:pb-spin .8s linear infinite}@keyframes pb-spin{to{transform:rotate(360deg)}}
        .pb-fld input,.pb-fld textarea,.pb-fld label,.pb-err{transition:border-color .3s,box-shadow .45s var(--ease),transform .4s var(--ease),max-height .4s var(--ease),opacity .3s}
        .pb-fld.bad input,.pb-fld.bad textarea{animation:pb-shake .45s}@keyframes pb-shake{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
        .pb-iw{transition:grid-template-rows .55s var(--ease),opacity .45s var(--ease),transform .55s var(--ease)}
        .pb-iw.pb-new{grid-template-rows:0fr;opacity:0;transform:translateY(14px)}.pb-iw.pb-new>.pb-item,.pb-iw.pb-gone>.pb-item{overflow:hidden;margin-bottom:0}
        .pb-iw.pb-gone{grid-template-rows:0fr;opacity:0;transform:scale(.97)}
        .pb-iw>.pb-item{transition:margin .55s var(--ease)}
        .pb-item{transition:box-shadow .4s var(--ease)}.pb-item:focus-within{box-shadow:0 26px 44px -30px rgba(60,50,110,.5)}
        .pb-del,.pb-stepper button,.pb-rm{transition:transform .35s var(--spring),background .3s,color .3s}.pb-del:hover{transform:rotate(90deg)}
        .pb-stepper button:hover{transform:scale(1.1);background:var(--lime);color:#23250a}.pb-stepper button:active{transform:scale(.88)}
        .pb-collapse{transition:grid-template-rows .5s var(--ease)}.pb-collapse>div{transition:opacity .4s}.pb-collapse:not(.on)>div{opacity:0}
        .pb-track{transition:background .35s}.pb-track::after{transition:transform .45s var(--spring)}
        .pb-th{animation:pb-pop .5s var(--spring) both}@keyframes pb-pop{from{opacity:0;transform:scale(.6)}}
        .pb-add{transition:border-color .3s,color .3s,background .3s,transform .35s var(--spring)}.pb-add:hover{transform:translateY(-2px)}
        .pb-tot b.pb-bump{animation:pb-bump .5s var(--spring)}@keyframes pb-bump{40%{transform:scale(1.06)}}
        .pb-bar i{transition:width 1s var(--ease)}.pb-chk{transition:transform .5s var(--spring)}
        .pb-empty{animation:pb-rise .7s var(--ease) both}
        .pb-paper{transition:box-shadow .4s}
        .pb-toast{position:fixed;z-index:60;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translate(-50%,40px);padding:14px 22px;border-radius:999px;background:var(--dark);color:var(--on-dark);font-size:14px;opacity:0;pointer-events:none;max-width:90vw;text-align:center;
          transition:transform .6s var(--ease),opacity .4s}
        .pb-toast.on{transform:translate(-50%,0);opacity:1}
        @media(max-width:1060px){.pb-toast{bottom:calc(88px + env(safe-area-inset-bottom))}}
        @media(prefers-reduced-motion:reduce){
          .pb-root *,.pb-root *::before,.pb-root *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
          .pb-rv{opacity:1;transform:none;filter:none}
        }

        /* CETAK */
        @media print{
          html,body{background:#fff!important;margin:0!important}
          .pb-root{background:#fff!important;min-height:0!important;overflow:visible!important}
          .pb-amb,.pb-top,.pb-right,.pb-dock,.pb-toast,.pb-steps,#pb-vform{display:none!important}
          .pb-wrap,.pb-grid,.pb-left{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;gap:0!important}
          #pb-vprev{display:block!important}
          .pb-paperwrap{height:auto!important;overflow:visible!important;border-radius:0!important}
          .pb-paper{transform:none!important;display:block!important;gap:0!important}
          .pb-pg{box-shadow:none!important;break-after:page;page-break-after:always;height:calc(var(--ph) - .6mm)!important}
          .pb-pg:last-child{break-after:auto;page-break-after:auto}
          #app-shell > aside.rail, #app-shell > header.top-bar-shell, #app-shell > .ambient, .footer-tag {display:none!important}
        }
      `}</style>

      {/* #pb-root */}
      <div className="pb-root" id="pb-root" ref={rootRef} data-theme="light">
        <div className="pb-amb" aria-hidden="true"><i></i><i></i><i></i></div>
        <div className="pb-wrap">
          <header className="pb-top">
            <div className="pb-brand pb-rv">
              <div className="pb-logo">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              </div>
              <div>
                <h1>Pengajuan Barang</h1>
                <p>Susun daftar barang, lampirkan bukti, lalu cetak dokumennya.</p>
              </div>
            </div>
            <div className="pb-seg pb-rv" style={{ ['--i' as any]: 1 }} id="pb-seg" role="tablist" aria-label="Tampilan">
              <div className="pb-ind"></div>
              <button className="on" role="tab" data-view="form" aria-selected="true">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                Formulir
              </button>
              <button role="tab" data-view="prev" aria-selected="false">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3h7l5 5v13H7zM14 3v5h5" />
                </svg>
                Pratinjau
              </button>
            </div>
            <div className="pb-theme pb-rv" style={{ ['--i' as any]: 2 }} role="group" aria-label="Tema">
              <div className="pb-knob"></div>
              <button data-theme-set="light" aria-label="Tema terang">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </button>
              <button data-theme-set="dark" aria-label="Tema gelap">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
                </svg>
              </button>
            </div>
          </header>

          <div className="pb-grid">
            <main className="pb-left">
              <div className="pb-steps pb-rv" style={{ ['--i' as any]: 2 }} id="pb-steps" aria-label="Kelengkapan pengajuan"></div>

              <div id="pb-vform" className="pb-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section className="pb-card pb-rv" style={{ ['--i' as any]: 3 }}>
                  <div className="pb-ch">
                    <div>
                      <h2>Informasi Dokumen</h2>
                      <p className="pb-sub">Kop surat dan keperluan yang tampil pada hasil cetak.</p>
                    </div>
                  </div>
                  <div className="pb-in">
                    <div className="pb-cols">
                      <div className="pb-fld">
                        <input id="pb-m-instansi" data-bind="meta.instansi" placeholder=" " autoComplete="organization" />
                        <label htmlFor="pb-m-instansi">Nama sekolah / instansi</label>
                      </div>
                      <div className="pb-fld">
                        <input id="pb-m-judul" data-bind="meta.judul" placeholder=" " />
                        <label htmlFor="pb-m-judul">Judul dokumen</label>
                      </div>
                    </div>
                    <div className="pb-fld">
                      <input id="pb-m-alamat" data-bind="meta.alamat" placeholder=" " autoComplete="street-address" />
                      <label htmlFor="pb-m-alamat">Alamat (opsional)</label>
                    </div>
                    <div className="pb-fld" style={{ margin: 0 }}>
                      <textarea id="pb-m-kep" data-bind="meta.keperluan" rows={2} placeholder=" "></textarea>
                      <label htmlFor="pb-m-kep">Keperluan / alasan pengajuan (opsional)</label>
                    </div>
                    <div className="pb-ori" role="radiogroup" aria-label="Orientasi kertas">
                      <span>Orientasi kertas</span>
                      <button type="button" role="radio" data-orient="landscape">Landscape</button>
                      <button type="button" role="radio" data-orient="portrait">Portrait</button>
                    </div>
                  </div>
                </section>

                <section className="pb-card pb-rv" style={{ ['--i' as any]: 4 }}>
                  <div className="pb-ch">
                    <div>
                      <h2>Daftar Barang</h2>
                      <p className="pb-sub">Harga satuan × jumlah dihitung otomatis.</p>
                    </div>
                    <button className="pb-btn lime sm" id="pb-add" type="button">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Tambah Barang
                    </button>
                  </div>
                  <div className="pb-in" id="pb-list-wrap">
                    <div className="pb-list" id="pb-list"></div>
                  </div>
                </section>

                <section className="pb-card pb-rv" style={{ ['--i' as any]: 5 }}>
                  <div className="pb-ch">
                    <div>
                      <h2>Tanda Tangan &amp; Tanggal</h2>
                      <p className="pb-sub">Nama dan jabatan bisa diganti kapan saja. Gambar tanda tangan bersifat opsional.</p>
                    </div>
                  </div>
                  <div className="pb-in">
                    <div className="pb-cols">
                      <div className="pb-fld">
                        <input id="pb-s-kota" data-bind="sign.kota" placeholder=" " />
                        <label htmlFor="pb-s-kota">Kota</label>
                      </div>
                      <div className="pb-fld">
                        <input id="pb-s-tgl" type="date" data-bind="sign.tanggal" />
                        <label htmlFor="pb-s-tgl">Tanggal</label>
                      </div>
                    </div>
                    <div className="pb-sgrid" id="pb-sgrid"></div>
                  </div>
                </section>
              </div>

              <div id="pb-vprev" className="pb-view pb-hide">
                <div className="pb-paperwrap" id="pb-pw">
                  <div className="pb-paper" id="pb-paper"></div>
                </div>
              </div>
            </main>

            <aside className="pb-right pb-rv" style={{ ['--i' as any]: 3 }}>
              <div className="pb-sum">
                <div className="pb-in">
                  <h2>Ringkasan</h2>
                  <div className="pb-r"><span>Jenis barang</span><b id="pb-s-n">0</b></div>
                  <div className="pb-r"><span>Total unit</span><b id="pb-s-q">0</b></div>
                  <div className="pb-r"><span>Beli online</span><b id="pb-s-o">0</b></div>
                  <div className="pb-r"><span>Dengan bukti gambar</span><b id="pb-s-i">0 / 0</b></div>
                  <div className="pb-gt">
                    <div className="pb-r"><span>Total pengajuan</span><b id="pb-s-t" aria-live="polite">Rp 0</b></div>
                    <p className="pb-tb" id="pb-s-tb"></p>
                  </div>
                  <button className="pb-btn dark lg" id="pb-print" type="button">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
                    </svg>
                    <span>Cetak Dokumen</span>
                    <i className="pb-spn"></i>
                  </button>
                  <button className="pb-btn soft lg" id="pb-toprev" type="button">
                    <span>Lihat Pratinjau</span>
                  </button>
                  <div className="pb-tools">
                    <button id="pb-exp" type="button">Ekspor data</button>
                    <button id="pb-imp" type="button">Impor data</button>
                    <button id="pb-rst" type="button" className="warn">Reset</button>
                  </div>
                  <input id="pb-impf" type="file" accept="application/json,.json" className="pb-sr" />
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="pb-dock" id="pb-dock">
          <div><small>Total pengajuan</small><b id="pb-d-t">Rp 0</b></div>
          <button className="pb-btn dark" id="pb-print2" type="button">Cetak</button>
        </div>
        <div className="pb-toast" id="pb-toast" role="status" aria-live="polite"></div>
      </div>
    </div>
  );
};

export default PengajuanBarangView;
