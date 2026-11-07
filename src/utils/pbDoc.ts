const ESC = (s: any) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const IDR = new Intl.NumberFormat('id-ID');
const rp = (n: number) => 'Rp ' + IDR.format(Math.round(n || 0));
const lineTot = (i: any) => (+i.price || 0) * (+i.qty || 1);

export function terbilang(n: number): string {
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

export function longDate(v: any): string {
  if (!v) return '';
  const parts = String(v).split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function applyPage(land: boolean, host: HTMLElement) {
  host.dataset.land = land ? '1' : '0';
  host.style.setProperty('--pw', land ? '297mm' : '210mm');
  host.style.setProperty('--ph', land ? '210mm' : '297mm');
  host.style.setProperty('--th', land ? '24mm' : '14mm');
  host.style.setProperty('--cols', land ? '12mm minmax(0,1.3fr) 25mm 10mm 28mm minmax(0,1fr) minmax(0,1fr)' : '9mm minmax(0,1.25fr) 21mm 8mm 24mm minmax(0,.95fr) minmax(0,.95fr)');
  let st = document.getElementById('pd-pagecss');
  if (!st) {
    st = document.createElement('style');
    st.id = 'pd-pagecss';
    document.head.appendChild(st);
  }
  st.textContent = `@page{size:A4 ${land ? 'landscape' : 'portrait'};margin:0}`;
}

export function render(data: any, host: HTMLElement) {
  const m = (data && data.meta) || {}, sg = (data && data.sign) || {}, items = ((data && data.items) || []).map((i: any) => ({ name: String(i.name || ''), spec: String(i.spec || ''), price: +i.price || 0, qty: Math.max(1, +i.qty || 1), online: !!i.online, link: String(i.link || ''), imgs: Array.isArray(i.imgs) ? i.imgs : [] }));
  const P = (k: string) => Object.assign({ label: '', name: '', sig: '' }, sg[k]), kepala = P('kepala'), waka = P('waka'), pem = P('pemohon'), land = m.orient !== 'portrait', g = items.reduce((s: number, i: any) => s + lineTot(i), 0), n = items.length;
  applyPage(land, host);
  const dv = String(m.divisi || '').trim(), dvt = dv ? (/^divisi\b/i.test(dv) ? dv : 'Divisi ' + dv) : '';
  const rowHTML = (i: any, k: number) => {
    const th = i.imgs.length ? `<div class="pd-th">${i.imgs.map((x: string) => `<img src="${x}" alt="">`).join('')}</div>` : '<span class="pd-dash">–</span>';
    const lk = i.online && i.link ? `<a class="pd-lk" href="${ESC(i.link)}">${ESC(i.link)}</a>` : '<span class="pd-dash">–</span>';
    return `<div class="pd-rw"><div class="c1"><b>${k + 1}</b><span>Barang</span></div><div class="c2"><b class="nm">${ESC(i.name || '—')}</b>${i.spec ? `<p class="sp">${ESC(i.spec)}</p>` : ''}<span class="bg${i.online ? ' on' : ''}">${i.online ? 'Beli Online' : 'Beli Langsung'}</span></div>
    <div class="c3">${rp(i.price)}</div><div class="c4">${i.qty}</div><div class="c5">${rp(lineTot(i))}</div><div class="c6">${lk}</div><div class="c7">${th}</div></div>`;
  };
  const rows = n ? items.map(rowHTML) : ['<div class="pd-none">Belum ada barang yang diajukan.</div>'];
  const sig = (p: any, top?: string, ul?: boolean) => `<div><div class="l1">${top || '&nbsp;'}</div><div class="l2">${ul ? '<u>' + ESC(p.label) + '</u>' : ESC(p.label)}</div><div class="sg">${p.sig ? `<img src="${p.sig}" alt="">` : ''}</div><div class="nm2">( ${ESC(p.name || '………………………')} )</div></div>`;
  const fin = `<div class="pd-fin"><div class="pd-gt"><div><span>Total Pengajuan</span>${g > 0 ? `<em>Terbilang: ${ESC(terbilang(g))}</em>` : ''}</div><b>${rp(g)}</b></div>
    <div class="pd-ttd">${sig(kepala)}${sig(waka)}${sig(pem, `${ESC(sg.kota || '')}${sg.kota && sg.tanggal ? ', ' : ''}<u>${ESC(longDate(sg.tanggal))}</u>`, true)}</div></div>`;
  const foot = ESC((pem.name || '').toUpperCase()), units = IDR.format(items.reduce((a: number, i: any) => a + i.qty, 0));
  const pageHTML = (o: any) => `<section class="pd-pg"><header class="pd-hd"><div class="pd-hr1"><div class="pd-bd"><div class="pd-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div><div><b>PENGAJUAN BARANG</b><small>by WEE LAPORAN</small></div></div>
    <div class="pd-org">${m.instansi ? `<b>${ESC(m.instansi)}</b>` : ''}${m.alamat ? ESC(m.alamat) : ''}</div></div>
    <div class="pd-hr2"><div><small>Pengajuan oleh</small><b>${ESC(pem.name || '—')}</b><span>${ESC(pem.label)}${dvt ? `<i class="pd-dv">${ESC(dvt)}</i>` : ''}</span></div><div class="r"><small>Tanggal</small><b>${ESC(longDate(sg.tanggal) || '—')}</b><span>${n} barang</span></div></div></header>
    ${o.bar ? `<div class="pd-tb"><div>No</div><div>Nama Barang &amp; Spesifikasi</div><div>Harga Satuan</div><div>Qty</div><div>Jumlah</div><div>Link</div><div>Bukti</div></div>
    <div class="pd-sec"><b>Daftar Barang</b><span>${n} jenis · ${units} unit</span></div>${m.keperluan ? `<p class="pd-kp">Keperluan: ${ESC(m.keperluan)}</p>` : ''}` : ''}
    <div class="pd-body">${o.body}</div><footer class="pd-ft">Halaman ${o.n} dari ${o.t} · ${foot}</footer></section>`;

  const meas = document.createElement('div');
  meas.className = 'pd-paper';
  meas.style.cssText = host.style.cssText + ';position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none';
  meas.innerHTML = pageHTML({ n: 1, t: 1, bar: true, body: '' });
  document.body.appendChild(meas);
  const bd = meas.querySelector('.pd-body') as HTMLElement, H = bd.clientHeight - 8;
  bd.style.cssText = 'flex:none;height:auto;overflow:visible;margin:0 9mm';
  bd.innerHTML = rows.join('') + fin;
  const hs = [...bd.children].map(c => c.getBoundingClientRect().height);
  document.body.removeChild(meas);
  const rh = hs.slice(0, rows.length), fh = hs[rows.length] || 0, pages: any[] = [];
  let cur: number[] = [], used = 0;
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
  host.innerHTML = pages.map(pg => {
    k++;
    return pageHTML({ n: k, t, bar: !pg.only, body: pg.rows.map((i: number) => rows[i]).join('') + (pg.final ? fin : '') });
  }).join('');
  return { pages: t, land };
}

export function fit(wrap: HTMLElement, host: HTMLElement) {
  if (!wrap || !wrap.offsetParent) return;
  host.style.transform = 'none';
  const k = Math.min(1, wrap.clientWidth / host.offsetWidth);
  host.style.transform = k < 1 ? `scale(${k})` : 'none';
  wrap.style.height = (host.offsetHeight * k) + 'px';
}

/* ── Ekspor JPEG & PDF ── */
const getStylesCSS = () => ['pd-css', 'pd-fonts', 'pd-pagecss'].map(i => {
  const e = document.getElementById(i);
  return e ? e.textContent : '';
}).join('\n');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function pageCanvas(host: HTMLElement, pg: HTMLElement, scale: number) {
  const W = pg.offsetWidth, H = pg.offsetHeight, wrap = document.createElement('div');
  wrap.className = 'pd-paper';
  wrap.style.cssText = host.style.cssText;
  wrap.style.transform = 'none';
  wrap.appendChild(pg.cloneNode(true));
  const x = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style><![CDATA[${getStylesCSS()}\n.pd-pg{box-shadow:none!important;height:${H}px!important}.pd-paper{display:block!important;gap:0!important;transform:none!important}]]></style><foreignObject x="0" y="0" width="${W}" height="${H}">${x}</foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('Browser tidak dapat merender halaman. Gunakan Cetak → Simpan sebagai PDF.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  await sleep(80);
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#eceef3';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c;
}

const blobOf = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => {
    try {
      c.toBlob(b => b ? res(b) : rej(new Error('Gagal membuat gambar')), 'image/jpeg', q);
    } catch (_) {
      rej(new Error('Browser memblokir ekspor gambar. Gunakan Cetak → Simpan sebagai PDF.'));
    }
  });

async function jpegs(host: HTMLElement, o: any) {
  o = o || {};
  const sc = o.scale || 2, q = o.quality || 0.92, out = [];
  const pgs = host.querySelectorAll('.pd-pg');
  for (let i = 0; i < pgs.length; i++) {
    const pg = pgs[i] as HTMLElement;
    const c = await pageCanvas(host, pg, sc);
    const b = await blobOf(c, q);
    out.push({ w: c.width, h: c.height, data: new Uint8Array(await b.arrayBuffer()) });
  }
  return out;
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function crc32(u: Uint8Array): number {
  if (!(crc32 as any).t) {
    (crc32 as any).t = [];
    for (let n = 0, c; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      (crc32 as any).t[n] = c >>> 0;
    }
  }
  let c = -1;
  for (let i = 0; i < u.length; i++) c = (crc32 as any).t[(c ^ u[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder(), parts: any[] = [], cd: any[] = [];
  let off = 0;
  files.forEach(f => {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, sz, true);
    lh.setUint32(22, sz, true);
    lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, sz, true);
    ch.setUint32(24, sz, true);
    ch.setUint16(28, nm.length, true);
    ch.setUint32(42, off, true);
    cd.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + sz;
  });
  const cs = cd.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cs, true);
  e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

function pdf(js: any[], wpt: number, hpt: number): Blob {
  const enc = new TextEncoder(), ch: any[] = [], of: number[] = [];
  let pos = 0;
  const push = (u: Uint8Array) => { ch.push(u); pos += u.length; };
  const tx = (s: string) => push(enc.encode(s));
  const n = js.length;
  const obj = (id: number, fn: () => void) => {
    of[id] = pos;
    tx(id + ' 0 obj\n');
    fn();
    tx('\nendobj\n');
  };
  tx('%PDF-1.4\n');
  push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  obj(1, () => tx('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => tx(`<< /Type /Pages /Count ${n} /Kids [${js.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ')}] >>`));
  js.forEach((j, i) => {
    const pg = 3 + 3 * i, ct = 4 + 3 * i, im = 5 + 3 * i, c = `q ${wpt} 0 0 ${hpt} 0 0 cm /Im0 Do Q`;
    obj(pg, () => tx(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wpt} ${hpt}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(ct, () => tx(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`));
    obj(im, () => {
      tx(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.data.length} >>\nstream\n`);
      push(j.data);
      tx('\nendstream');
    });
  });
  const xr = pos, tot = 3 * n + 3;
  tx(`xref\n0 ${tot}\n0000000000 65535 f \n`);
  for (let i = 1; i < tot; i++) tx(String(of[i]).padStart(10, '0') + ' 00000 n \n');
  tx(`trailer\n<< /Size ${tot} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  return new Blob(ch, { type: 'application/pdf' });
}

export async function downloadJPEG(host: HTMLElement, o?: { name?: string; scale?: number; quality?: number }) {
  o = o || {};
  const name = o.name || 'Pengajuan-Barang';
  const js = await jpegs(host, o);
  if (js.length === 1) {
    saveBlob(new Blob([js[0].data], { type: 'image/jpeg' }), name + '.jpg');
  } else {
    saveBlob(zip(js.map((j, i) => ({ name: `${name}-halaman-${i + 1}.jpg`, data: j.data }))), name + '-jpeg.zip');
  }
  return js.length;
}

export async function downloadPDF(host: HTMLElement, o?: { name?: string; scale?: number; quality?: number }) {
  o = o || {};
  const name = o.name || 'Pengajuan-Barang';
  const js = await jpegs(host, o);
  const land = host.dataset.land === '1';
  const w = +((land ? 297 : 210) * 72 / 25.4).toFixed(2);
  const h = +((land ? 210 : 297) * 72 / 25.4).toFixed(2);
  saveBlob(pdf(js, w, h), name + '.pdf');
  return js.length;
}
