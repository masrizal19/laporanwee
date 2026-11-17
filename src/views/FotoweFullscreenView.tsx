import React, { useEffect, useRef } from 'react';
import {
  fotoweApi,
  fetchPhotoBlobCorsSafe,
  rememberPhotoBlob,
  migrateIndexedDbProjects,
  FotoweArtboardPayload,
  FotowePermissionEntry,
  FotoweProjectDetail,
  FotoweProjectSummary,
  FotoweSlotPayload,
  UploadedFotowePhoto,
} from '../utils/fotoweApi';
import { getStoredUser, teamService } from '../utils/api';
import '../styles/fotowe.css';

export interface FotoweFullscreenViewProps {
  userId?: string | number;
  userEmail?: string;
  onBackToHub: () => void;
}

export const FotoweFullscreenView: React.FC<FotoweFullscreenViewProps> = ({
  userId,
  userEmail,
  onBackToHub,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const onBackToHubRef = useRef(onBackToHub);
  onBackToHubRef.current = onBackToHub;

  const stored = getStoredUser();
  const initialIdentityRef = useRef<string | number>(
    userId || userEmail || stored?.id || stored?.email || 'anon'
  );
  if (
    initialIdentityRef.current === 'anon' &&
    (userId || userEmail)
  ) {
    initialIdentityRef.current = userId || userEmail || 'anon';
  }
  const scopeIdentityRef = useRef<string | number>(initialIdentityRef.current);
  scopeIdentityRef.current = userId || userEmail || scopeIdentityRef.current;

  useEffect(() => {
    const rootNode = rootRef.current;
    if (!rootNode) return;
    const root: HTMLDivElement = rootNode;

    let disposed = false;
    const activeTimers = new Set<number>();
    const activeObjectUrls = new Set<string>();
    const modalCleanupFns = new Set<() => void>();
    let activePrintCleanup: (() => void) | null = null;
    let pollIntervalId = 0;

    function safeSetTimeout(fn: () => void, ms: number): number {
      const id = window.setTimeout(() => {
        activeTimers.delete(id);
        if (!disposed) fn();
      }, ms);
      activeTimers.add(id);
      return id;
    }

    function safeClearTimeout(id: number) {
      if (id) {
        window.clearTimeout(id);
        activeTimers.delete(id);
      }
    }

    function trackObjectUrl(url: string): string {
      activeObjectUrls.add(url);
      return url;
    }

    function $(id: string): HTMLElement {
      return root.querySelector(`[id="${id}"]`) as HTMLElement;
    }

    interface PaperSpec {
      w: number;
      h: number;
      d: string;
    }
    interface PhotoSizeSpec {
      l: string;
      w: number;
      h: number;
    }
    interface LayoutSpec {
      cols: number;
      rows: number;
      n: number;
      w: number;
      h: number;
      rot: boolean;
      x0: number;
      y0: number;
    }
    interface SlotState {
      img: HTMLImageElement | null;
      name: string;
      z: number;
      ox: number;
      oy: number;
      status: string;
      blob: Blob | null;
      photoId?: number | null;
      photoUrl?: string | null;
      corsUrl?: string | null;
      thumbUrl?: string | null;
      fileSize?: number;
      shown?: number;
      t0?: number;
      zv?: number;
      oxv?: number;
      oyv?: number;
    }
    interface Artboard {
      id: string;
      name: string;
      t: string;
      s: number;
      a: number;
      slots: SlotState[];
    }
    interface ProjectData {
      id: string;
      name: string;
      dpi: number;
      color: 'rgb' | 'gray';
      active: number;
      artboards: Artboard[];
      saved?: number;
      ownerUserId?: number;
      ownerName?: string;
      ownerEmail?: string;
      isOwner: boolean;
      isAdmin?: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canManagePermissions: boolean;
      accessRole: 'admin' | 'owner' | 'editor' | 'viewer';
      visibility: 'workspace' | 'private';
      version?: number;
      thumbnailUrl?: string | null;
      permissions: FotowePermissionEntry[];
      isRemotePersisted: boolean;
    }

    const P: Record<string, PaperSpec> = {
      '2R': { w: 63.5, h: 88.9, d: '2,5 × 3,5 inci' },
      '3R': { w: 88.9, h: 127, d: '3,5 × 5 inci' },
      '4R': { w: 101.6, h: 152.4, d: '4 × 6 inci' },
      '5R': { w: 127, h: 177.8, d: '5 × 7 inci' },
      '6R': { w: 152.4, h: 203.2, d: '6 × 8 inci' },
      '8R': { w: 203.2, h: 254, d: '8 × 10 inci' },
      A4: { w: 210, h: 297, d: '210 × 297 mm' },
    };
    const S: PhotoSizeSpec[] = [
      { l: '2 × 3 cm', w: 20, h: 30 },
      { l: '3 × 4 cm', w: 30, h: 40 },
      { l: '4 × 6 cm', w: 40, h: 60 },
    ];
    const MARGIN = 3;
    const GAP = 2;
    const st = { t: '4R', s: 1, a: 0 };
    let slots: SlotState[] = [];
    let sel: number[] = [0];

    function blank(): SlotState {
      return {
        img: null,
        name: '',
        z: 1,
        ox: 0,
        oy: 0,
        status: 'empty',
        blob: null,
        photoId: null,
        photoUrl: null,
        corsUrl: null,
        thumbUrl: null,
        fileSize: 0,
      };
    }
    function sl(i: number): SlotState {
      return slots[i] || (slots[i] = blank());
    }
    function fmt(n: number): string {
      return String(n).replace('.', ',');
    }

    /* Layout dalam milimeter */
    function layout(p: PaperSpec, s: PhotoSizeSpec): LayoutSpec {
      let best: LayoutSpec | null = null;
      [
        [s.w, s.h],
        [s.h, s.w],
      ].forEach((d) => {
        let c = Math.floor((p.w - 2 * MARGIN + GAP) / (d[0] + GAP));
        let r = Math.floor((p.h - 2 * MARGIN + GAP) / (d[1] + GAP));
        c = Math.max(0, c);
        r = Math.max(0, r);
        if (!best || c * r > best.n) {
          best = { cols: c, rows: r, n: c * r, w: d[0], h: d[1], rot: d[0] !== s.w, x0: 0, y0: 0 };
        }
      });
      if (
        s.w === 20 &&
        s.h === 30 &&
        p.w - 2 * MARGIN >= 4 * 20 + 3 * GAP &&
        p.h - 2 * MARGIN >= 4 * 30 + 3 * GAP
      ) {
        best = { cols: 4, rows: 4, n: 16, w: 20, h: 30, rot: false, x0: 0, y0: 0 };
      }
      const res = best!;
      res.x0 = (p.w - (res.cols * res.w + (res.cols - 1) * GAP)) / 2;
      res.y0 = (p.h - (res.rows * res.h + (res.rows - 1) * GAP)) / 2;
      return res;
    }

    function cur(): LayoutSpec {
      return layout(P[st.t], S[st.s]);
    }

    function rect(L: LayoutSpec, i: number) {
      return {
        x: L.x0 + (i % L.cols) * (L.w + GAP),
        y: L.y0 + Math.floor(i / L.cols) * (L.h + GAP),
        w: L.w,
        h: L.h,
      };
    }

    /* ---- Motion engine variables ---- */
    const RM =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const POP = 300;
    let HA: number[] = [];
    let HV: number[] = [];
    let FL: number[] = [];
    let GH: Array<{
      i: number;
      img: HTMLImageElement;
      z: number;
      ox: number;
      oy: number;
      t0: number;
    }> = [];
    let hov = -1;
    let raf = 0;
    let animReady = false;
    let cardAnim = false;

    /* ---- Project & Cloud Sync state variables ---- */
    let proj: ProjectData | null = null;
    let ab: Artboard | null = null;
    let plist: FotoweProjectSummary[] = [];
    let isLoadingList = true;
    let listError = '';
    let savedSig: string | null = null;
    let savedAt = '';
    let busy = '';
    let autoT = 0;
    let thT = 0;
    let hsz = 1;
    let isRefreshingList = false;

    // Deduplicated photo upload promise map keyed by Blob reference
    const blobUploadMap = new Map<Blob, Promise<UploadedFotowePhoto>>();
    // Sequential save queue lock per editor session so createProject never runs twice concurrently
    let activeSavePromise: Promise<void> | null = null;
    let trailingSaveRequested = false;

    function uid(): string {
      return 'ftw_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
    }
    function esc(t: string): string {
      return String(t).replace(/[&<>"']/g, (c) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c;
      });
    }
    function nowT(ts?: number): string {
      return new Date(ts || Date.now()).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    function newAb(name: string, t: string, s?: number): Artboard {
      return { id: 'ab_' + Math.random().toString(36).slice(2, 9), name, t, s: s == null ? 1 : s, a: 0, slots: [] };
    }
    function syncAb() {
      if (ab) {
        ab.t = st.t;
        ab.s = st.s;
        ab.a = st.a;
      }
    }
    function canModify(): boolean {
      return Boolean(proj && proj.canEdit);
    }
    function roleLabel(r: FotoweProjectSummary): string {
      if (r.is_owner) return 'Milik Anda';
      if (r.access_role === 'admin' || r.is_admin) return 'Admin';
      if (r.can_edit) return 'Editor';
      return 'Hanya Lihat';
    }

    /* ---- Toast & Feedback ---- */
    let lastT = '';
    let lastAt = 0;
    function toast(t: string, kind?: string) {
      if (disposed) return;
      const b = $('toasts');
      if (!b) return;
      const d = document.createElement('div');
      d.className = 'toast' + (kind === 'err' ? ' err' : '');
      d.textContent = t;
      b.appendChild(d);
      while (b.children.length > 3) b.removeChild(b.firstChild!);
      safeSetTimeout(() => {
        d.classList.add('out');
        safeSetTimeout(() => {
          d.remove();
        }, 220);
      }, 2800);
    }
    function say(t: string) {
      const m = $('msg');
      if (m) m.textContent = t;
      if (!t) return;
      const n = Date.now();
      if (t === lastT && n - lastAt < 1500) return;
      lastT = t;
      lastAt = n;
      toast(t, /tidak|gagal|belum|semua slot|pilih |penuh|baca saja|ditolak/i.test(t) ? 'err' : '');
    }

    /* ---- Home rendering ---- */
    function sizeBtns(el: HTMLElement, home?: boolean) {
      el.innerHTML = '';
      const c = home ? hsz : st.s;
      const ro = !home && !canModify();
      S.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'b' + (i === c ? ' on' : '');
        b.textContent = s.l;
        if (ro) b.disabled = true;
        b.onclick = () => {
          if (home) {
            hsz = i;
            renderHome();
          } else {
            if (!canModify()) return;
            st.s = i;
            st.a = 0;
            sel = [0];
            setup();
            ui();
          }
        };
        el.appendChild(b);
      });
    }

    function renderHome() {
      sizeBtns($('hs'), true);
      const g = $('tg');
      const an = cardAnim;
      cardAnim = false;
      g.innerHTML = '';
      Object.keys(P).forEach((k, ix) => {
        const p = P[k];
        const L = layout(p, S[hsz]);
        let sv = `<svg viewBox="0 0 ${p.w} ${p.h}"><rect width="${p.w}" height="${p.h}" fill="#fff"/>`;
        for (let i = 0; i < L.n; i++) {
          const r = rect(L, i);
          sv += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#c9d3e6"/>`;
        }
        sv += '</svg>';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tc' + (an ? ' in' : '');
        b.style.setProperty('--i', String(ix));
        b.innerHTML =
          `<div class="ill">${sv}</div>` +
          `<div class="tn">${k}</div>` +
          `<div class="td">${p.d}</div>` +
          `<div class="tf"><span>${L.n ? `${L.n} foto · ${S[hsz].l}` : 'Tidak muat'}</span><span class="go">Pilih →</span></div>`;
        b.onclick = () => {
          b.classList.add('pick');
          safeSetTimeout(() => newProject(k), RM ? 0 : 200);
        };
        g.appendChild(b);
      });
    }

    /* ---- Canvas & Viewport Drawing ---- */
    const cv = $('c') as HTMLCanvasElement;
    const cx = cv.getContext('2d')!;
    let KP = 5;

    function setup() {
      const p = P[st.t];
      KP = 1400 / Math.max(p.w, p.h);
      cv.width = Math.round(p.w * KP);
      cv.height = Math.round(p.h * KP);
      $('pp').style.setProperty('--r', String(p.w / p.h));
      sizeBtns($('es'));
    }

    function clamp(s: SlotState, w: number, h: number) {
      if (!s.img) return;
      s.z = Math.min(5, Math.max(1, s.z));
      const b = Math.max(w / s.img.width, h / s.img.height) * s.z;
      const mx = (s.img.width * b - w) / 2 / w;
      const my = (s.img.height * b - h) / 2 / h;
      s.ox = Math.min(mx, Math.max(-mx, s.ox));
      s.oy = Math.min(my, Math.max(-my, s.oy));
    }

    function view(s: SlotState, w: number, h: number, pv: boolean) {
      let z = s.z;
      let ox = s.ox;
      let oy = s.oy;
      if (pv && s.zv != null) {
        z = s.zv;
        ox = s.oxv ?? s.ox;
        oy = s.oyv ?? s.oy;
      }
      const b = Math.max(w / s.img!.width, h / s.img!.height) * z;
      const dw = s.img!.width * b;
      const dh = s.img!.height * b;
      const mx = (dw - w) / 2 / w;
      const my = (dh - h) / 2 / h;
      return {
        dw,
        dh,
        ox: Math.min(mx, Math.max(-mx, ox)),
        oy: Math.min(my, Math.max(-my, oy)),
      };
    }

    function paint(
      g: CanvasRenderingContext2D,
      img: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number,
      v: { dw: number; dh: number; ox: number; oy: number },
      a: number,
      sc: number
    ) {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      g.globalAlpha = a;
      if (sc !== 1) {
        const mx = x + w / 2;
        const my = y + h / 2;
        g.translate(mx, my);
        g.scale(sc, sc);
        g.translate(-mx, -my);
      }
      g.drawImage(
        img,
        x + w / 2 - v.dw / 2 + v.ox * w,
        y + h / 2 - v.dh / 2 + v.oy * h,
        v.dw,
        v.dh
      );
      g.restore();
    }

    function back(t: number): number {
      const c = 1.70158;
      t -= 1;
      return 1 + (c + 1) * t * t * t + c * t * t;
    }

    function draw(
      g: CanvasRenderingContext2D,
      k: number,
      pv: boolean,
      W: number,
      H: number,
      now: number,
      abx?: Artboard
    ) {
      const L = abx ? layout(P[abx.t], S[abx.s]) : cur();
      const gs = abx ? (i: number) => abx.slots[i] || blank() : sl;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      const u = k / 5;

      function R(i: number) {
        const m = rect(L, i);
        return [Math.round(m.x * k), Math.round(m.y * k), Math.round(m.w * k), Math.round(m.h * k)];
      }

      for (let i = 0; i < L.n; i++) {
        const q = R(i);
        const x = q[0];
        const y = q[1];
        const w = q[2];
        const h = q[3];
        const s = gs(i);

        if (s.img) {
          clamp(s, w, h);
          let a = 1;
          let sc = 1;
          if (pv && s.t0) {
            let p = (now - s.t0) / POP;
            if (p < 1) {
              p = Math.max(0, p);
              a = Math.min(1, p * 1.6);
              sc = 0.9 + 0.1 * back(p);
            }
          }
          paint(g, s.img, x, y, w, h, view(s, w, h, pv), a, sc);
        } else if (pv) {
          g.fillStyle = '#f1f2f6';
          g.fillRect(x, y, w, h);
          g.strokeStyle = '#c5c8d4';
          g.lineWidth = 1.5 * u;
          g.setLineDash([6 * u, 5 * u]);
          g.strokeRect(x + u, y + u, w - 2 * u, h - 2 * u);
          g.setLineDash([]);
          g.fillStyle = '#9aa0b4';
          g.font = `600 ${Math.max(9 * u, Math.min(w, h) / 5)}px Inter,sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(i + 1), x + w / 2, y + h / 2);
        }

        if (pv) {
          const ha = HA[i] === undefined ? (sel.indexOf(i) >= 0 ? 1 : 0) : HA[i];
          const hv = HV[i] || 0;
          g.strokeStyle = '#ff3d6e';
          if (hv > 0.01 && ha < 1) {
            g.globalAlpha = 0.5 * hv * (1 - ha);
            g.lineWidth = 2.5 * u;
            g.strokeRect(x - 1.25 * u, y - 1.25 * u, w + 2.5 * u, h + 2.5 * u);
          }
          if (ha > 0.01) {
            g.globalAlpha = ha;
            g.lineWidth = 3.5 * u;
            g.strokeRect(x - 1.75 * u, y - 1.75 * u, w + 3.5 * u, h + 3.5 * u);
          }
          g.globalAlpha = 1;
          const f = FL[i];
          if (f && now - f < 300 && now >= f) {
            g.fillStyle = `rgba(255,255,255,${0.5 * (1 - (now - f) / 300)})`;
            g.fillRect(x, y, w, h);
          }
        }
      }

      if (pv) {
        GH.forEach((o) => {
          const q = R(o.i);
          const p = Math.min(1, (now - o.t0) / 200);
          paint(
            g,
            o.img,
            q[0],
            q[1],
            q[2],
            q[3],
            view({ img: o.img, name: '', status: 'filled', blob: null, z: o.z, ox: o.ox, oy: o.oy }, q[2], q[3], false),
            1 - p,
            1 - 0.05 * p
          );
        });
      }
    }

    function filled(L: LayoutSpec): number {
      let n = 0;
      for (let i = 0; i < L.n; i++) if (sl(i).img) n++;
      return n;
    }

    function ui() {
      if (!proj || !ab || disposed) return;
      const L = cur();
      const p = P[st.t];
      const f = filled(L);
      const editable = canModify();

      sel = sel.filter((i) => i < L.n);
      if (sel.indexOf(st.a) < 0) sel = [st.a];
      markNew();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      frame();
      afterUi();

      const has = L.n > 0 && !!sl(st.a).img;
      $('sel').textContent = L.n ? `Slot ${st.a + 1}${has ? '' : ' (kosong)'}` : '–';
      ['zi', 'zo', 'rs', 'del', 'dup'].forEach((k) => {
        ($(k) as HTMLButtonElement).disabled = !has || !editable;
      });
      root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => {
        b.disabled = !has || !editable;
      });
      ($('up') as HTMLButtonElement).disabled = !L.n || !editable;
      ($('delsel') as HTMLButtonElement).disabled = !editable || !sel.some((i) => !!sl(i).img);
      ($('sv') as HTMLButtonElement).disabled = !editable;
      const shrBtn = $('shr') as HTMLButtonElement | null;
      if (shrBtn) {
        shrBtn.hidden = !proj.canManagePermissions;
      }

      ['abAdd', 'abDup', 'abRen', 'abDel'].forEach((k) => {
        ($(k) as HTMLButtonElement).disabled = !editable;
      });
      sizeBtns($('es'));

      status();
      const disOut = f === 0;
      ($('dl') as HTMLButtonElement).disabled = disOut;
      ($('pr') as HTMLButtonElement).disabled = disOut;
      ($('dla') as HTMLButtonElement).disabled = !proj.artboards.some((b) =>
        b.slots.some((x) => !!(x && x.img))
      );
      const ct = `${('0' + f).slice(-2)} / ${('0' + L.n).slice(-2)}`;
      const cntEl = $('cnt');
      if (cntEl.textContent !== ct) {
        cntEl.textContent = ct;
        if (animReady && !RM && cntEl.animate) {
          cntEl.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], {
            duration: 240,
            easing: 'cubic-bezier(.34,1.56,.64,1)',
          });
        }
      }
      $('ft').textContent = `Template ${st.t}${editable ? '' : ' · Mode Baca Saja'}`;
      $('inf').innerHTML =
        `<dt>Project</dt><dd>${esc(proj.name)}</dd>` +
        `<dt>Pemilik</dt><dd>${esc(proj.ownerName || proj.ownerEmail || 'Anda')}</dd>` +
        `<dt>Akses</dt><dd>${esc(
          proj.isOwner ? 'Pemilik' : proj.accessRole === 'admin' ? 'Admin' : proj.canEdit ? 'Editor' : 'Hanya Lihat'
        )}</dd>` +
        `<dt>Artboard</dt><dd>${proj.active + 1} / ${proj.artboards.length} · ${esc(ab.name)}</dd>` +
        `<dt>Output</dt><dd>${proj.dpi} DPI · ${proj.color === 'gray' ? 'Grayscale' : 'RGB'}</dd>` +
        `<dt>Template</dt><dd>${st.t}</dd>` +
        `<dt>Kertas</dt><dd>${p.d} (${fmt(p.w)} × ${fmt(p.h)} mm)</dd>` +
        `<dt>Foto</dt><dd>${S[st.s].l}${L.rot ? ' (diputar)' : ''}</dd>` +
        `<dt>Slot</dt><dd>${L.n}</dd>` +
        `<dt>Terisi</dt><dd>${f}</dd>`;
      if (!L.n) say('Ukuran foto tidak muat di kertas ini. Pilih ukuran foto yang lebih kecil.');
    }

    /* ---- Upload / Cloud Photo Operations ---- */
    function load(f: Blob, fallbackName?: string): Promise<{ img: HTMLImageElement; name: string; blob: Blob } | null> {
      return new Promise((res) => {
        const im = new Image();
        const url = trackObjectUrl(URL.createObjectURL(f));
        im.onload = () => res({ img: im, name: (f as File).name || fallbackName || 'foto.png', blob: f });
        im.onerror = () => res(null);
        im.src = url;
      });
    }

    function ensureBlobUpload(blob: Blob, name: string): Promise<UploadedFotowePhoto> {
      const existing = blobUploadMap.get(blob);
      if (existing) return existing;
      const promise = fotoweApi
        .uploadPhoto(blob, name)
        .then((res) => {
          rememberPhotoBlob(res.cors_url, blob);
          rememberPhotoBlob(res.file_url, blob);
          return res;
        })
        .catch((err) => {
          blobUploadMap.delete(blob);
          throw err;
        });
      blobUploadMap.set(blob, promise);
      return promise;
    }

    function applyUploadMetadataToAllMatchingSlots(blob: Blob, uploaded: UploadedFotowePhoto) {
      if (!proj) return;
      proj.artboards.forEach((b) => {
        b.slots.forEach((s) => {
          if (s && s.blob === blob) {
            s.photoId = uploaded.photo_id;
            s.photoUrl = uploaded.file_url;
            s.corsUrl = uploaded.cors_url;
            s.thumbUrl = uploaded.thumb_url;
            s.fileSize = uploaded.file_size;
          }
        });
      });
    }

    function put(i: number, o: { img: HTMLImageElement; name: string; blob: Blob }) {
      slots[i] = {
        img: o.img,
        name: o.name,
        blob: o.blob,
        z: 1,
        ox: 0,
        oy: 0,
        status: 'filled',
        photoId: null,
        photoUrl: null,
        corsUrl: null,
        thumbUrl: null,
        fileSize: o.blob.size,
      };
    }

    $('up').onclick = () => {
      if (!canModify()) {
        say('Anda hanya memiliki izin melihat project ini.');
        return;
      }
      ($('file') as HTMLInputElement).click();
    };

    ($('file') as HTMLInputElement).onchange = async (e) => {
      const inp = e.target as HTMLInputElement;
      const fs = [].slice
        .call(inp.files || [])
        .filter((f: File) => /^image\//.test(f.type));
      inp.value = '';
      if (!fs.length || !canModify()) return;

      const L = cur();
      const ims = (await Promise.all(fs.map((f: File) => load(f, f.name)))).filter(Boolean) as {
        img: HTMLImageElement;
        name: string;
        blob: Blob;
      }[];
      if (disposed) return;
      if (!ims.length) {
        say('File gambar tidak dapat dibaca.');
        return;
      }

      const placedBlobs: Array<{ blob: Blob; name: string }> = [];
      if (ims.length === 1 && sl(st.a).img) {
        put(st.a, ims[0]);
        placedBlobs.push({ blob: ims[0].blob, name: ims[0].name });
        say(`Foto slot ${st.a + 1} diganti.`);
        ui();
      } else {
        let emp: number[] = [];
        for (let i = 0; i < L.n; i++) if (!sl(i).img) emp.push(i);
        if (!emp.length) {
          say('Semua slot terisi. Pilih satu slot lalu upload 1 foto untuk menggantinya.');
          return;
        }
        if (emp.indexOf(st.a) > 0) emp = [st.a].concat(emp.filter((i) => i !== st.a));
        const n = Math.min(ims.length, emp.length);
        for (let j = 0; j < n; j++) {
          put(emp[j], ims[j]);
          placedBlobs.push({ blob: ims[j].blob, name: ims[j].name });
        }
        st.a = emp[0];
        say(
          ims.length > n
            ? `${n} foto masuk. ${ims.length - n} foto tidak dimuat karena slot penuh.`
            : `${n} foto dimasukkan ke slot berbeda.`
        );
        ui();
      }

      // Immediately start cloud upload in background so photo_id is ready cleanly
      placedBlobs.forEach(({ blob, name }) => {
        ensureBlobUpload(blob, name)
          .then((uploaded) => {
            if (!disposed) applyUploadMetadataToAllMatchingSlots(blob, uploaded);
          })
          .catch(() => {
            // saveProject() will retry upload cleanly before committing
          });
      });
    };

    $('dup').onclick = () => {
      if (!canModify()) return;
      const L = cur();
      const s = sl(st.a);
      if (!s.img) return;
      let t = -1;
      for (let i = st.a + 1; i < L.n; i++) {
        if (!sl(i).img) {
          t = i;
          break;
        }
      }
      if (t < 0) {
        for (let i = 0; i < st.a; i++) {
          if (!sl(i).img) {
            t = i;
            break;
          }
        }
      }
      if (t < 0) {
        say('Semua slot sudah terisi. Hapus satu foto untuk membuat ruang.');
        return;
      }
      slots[t] = {
        img: s.img,
        name: s.name,
        blob: s.blob,
        photoId: s.photoId,
        photoUrl: s.photoUrl,
        corsUrl: s.corsUrl,
        thumbUrl: s.thumbUrl,
        fileSize: s.fileSize,
        z: s.z,
        ox: s.ox,
        oy: s.oy,
        status: 'filled',
      };
      say(`Foto slot ${st.a + 1} diduplikat ke slot ${t + 1}.`);
      ui();
    };

    $('del').onclick = () => {
      if (!canModify()) return;
      kill(st.a);
      say(`Slot ${st.a + 1} dikosongkan.`);
      ui();
    };

    /* ---- Edit & Pointer Drag ---- */
    let drag: { x: number; y: number } | null = null;
    function mv(dx: number, dy: number) {
      if (!canModify()) return;
      const s = sl(st.a);
      if (s.img) {
        s.ox += dx;
        s.oy += dy;
        ui();
      }
    }
    $('zi').onclick = () => {
      if (!canModify()) return;
      sl(st.a).z *= 1.1;
      ui();
    };
    $('zo').onclick = () => {
      if (!canModify()) return;
      sl(st.a).z /= 1.1;
      ui();
    };
    $('rs').onclick = () => {
      if (!canModify()) return;
      const s = sl(st.a);
      s.z = 1;
      s.ox = s.oy = 0;
      ui();
    };
    root.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => {
      b.onclick = () => {
        const d = b.dataset.m!.split(',');
        mv(+d[0] * 0.04, +d[1] * 0.04);
      };
    });

    function hit(e: PointerEvent): number {
      const r = cv.getBoundingClientRect();
      const p = P[st.t];
      const L = cur();
      const x = ((e.clientX - r.left) / r.width) * p.w;
      const y = ((e.clientY - r.top) / r.height) * p.h;
      for (let i = 0; i < L.n; i++) {
        const m = rect(L, i);
        if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return i;
      }
      return -1;
    }

    cv.onpointerdown = (e) => {
      const i = hit(e);
      if (i < 0) return;
      if (e.shiftKey) {
        const q = sel.indexOf(i);
        if (q < 0) {
          sel.push(i);
          st.a = i;
        } else if (sel.length > 1) {
          sel.splice(q, 1);
          if (st.a === i) st.a = sel[sel.length - 1];
        }
        drag = null;
        ui();
        return;
      }
      st.a = i;
      sel = [i];
      if (canModify()) {
        drag = { x: e.clientX, y: e.clientY };
        cv.setPointerCapture(e.pointerId);
      } else {
        drag = null;
      }
      ui();
    };

    cv.onpointermove = (e) => {
      if (!drag || !canModify()) {
        const hh = hit(e);
        if (hh !== hov) {
          hov = hh;
          cv.style.cursor = hh < 0 ? 'default' : !canModify() ? 'pointer' : sl(hh).img ? 'grab' : 'pointer';
          kick();
        }
        return;
      }
      const r = cv.getBoundingClientRect();
      const f = P[st.t].w / r.width;
      const L = cur();
      const s = sl(st.a);
      if (s.img) {
        s.ox += ((e.clientX - drag.x) * f) / L.w;
        s.oy += ((e.clientY - drag.y) * f) / L.h;
      }
      drag = { x: e.clientX, y: e.clientY };
      ui();
    };

    cv.onpointerup = cv.onpointercancel = () => {
      drag = null;
      kick();
    };
    cv.onpointerleave = () => {
      if (hov !== -1) {
        hov = -1;
        cv.style.cursor = '';
        kick();
      }
    };

    /* ---- Export PNG (DPI pHYs) & ZIP ---- */
    let T: number[] | null = null;
    function crc(b: Uint8Array): number {
      if (!T) {
        T = [];
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          T[n] = c >>> 0;
        }
      }
      let c = 0xffffffff;
      for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }

    function gray(g: CanvasRenderingContext2D, W: number, H: number) {
      for (let y = 0; y < H; y += 512) {
        const hh = Math.min(512, H - y);
        const d = g.getImageData(0, y, W, hh);
        const a = d.data;
        for (let i = 0; i < a.length; i += 4) {
          const v = ((a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000) | 0;
          a[i] = a[i + 1] = a[i + 2] = v;
        }
        g.putImageData(d, 0, y);
      }
    }

    function tooBig(t: string, dpi: number): boolean {
      const k = dpi / 25.4;
      return Math.round(P[t].w * k) * Math.round(P[t].h * k) > 12e7;
    }

    function rend(a: Artboard): Promise<Uint8Array> {
      const p = P[a.t];
      const k = proj!.dpi / 25.4;
      const W = Math.round(p.w * k);
      const H = Math.round(p.h * k);
      if (W * H > 12e7) return Promise.reject(new Error('big'));
      const o = document.createElement('canvas');
      o.width = W;
      o.height = H;
      const g = o.getContext('2d')!;
      draw(g, k, false, W, H, 0, a);
      if (proj!.color === 'gray') gray(g, W, H);
      const ppm = Math.round(proj!.dpi / 0.0254);
      return new Promise((res, rej) => {
        o.toBlob(async (bl) => {
          if (!bl) return rej(new Error('blob'));
          const u = new Uint8Array(await bl.arrayBuffer());
          const c = new Uint8Array(13);
          const v = new DataView(c.buffer);
          c.set([112, 72, 89, 115], 0);
          v.setUint32(4, ppm);
          v.setUint32(8, ppm);
          c[12] = 1;
          const ck = new Uint8Array(21);
          const dv = new DataView(ck.buffer);
          dv.setUint32(0, 9);
          ck.set(c, 4);
          dv.setUint32(17, crc(c));
          const full = new Uint8Array(u.length + 21);
          full.set(u.subarray(0, 33), 0);
          full.set(ck, 33);
          full.set(u.subarray(33), 54);
          res(full);
        }, 'image/png');
      });
    }

    function slug(t: string): string {
      return (
        String(t)
          .trim()
          .replace(/[^\w-]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'x'
      );
    }

    function fname(a: Artboard): string {
      return `${slug(proj!.name)}-${slug(a.name)}-${a.t}-${proj!.dpi}dpi.png`;
    }

    function saveFile(name: string, data: Uint8Array, mime: string) {
      const url = URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      root.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function zip(fs: Array<{ name: string; data: Uint8Array }>): Uint8Array {
      const ch: Uint8Array[] = [];
      const cen: Uint8Array[] = [];
      let off = 0;
      const d = new Date();
      const dt = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
      const dd = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      const enc = new TextEncoder();

      fs.forEach((f) => {
        const nm = enc.encode(f.name);
        const c = crc(f.data);
        const n = f.data.length;
        const h = new Uint8Array(30 + nm.length);
        const v = new DataView(h.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 0x0800, true);
        v.setUint16(10, dt, true);
        v.setUint16(12, dd, true);
        v.setUint32(14, c, true);
        v.setUint32(18, n, true);
        v.setUint32(22, n, true);
        v.setUint16(26, nm.length, true);
        h.set(nm, 30);
        ch.push(h, f.data);

        const e = new Uint8Array(46 + nm.length);
        const w = new DataView(e.buffer);
        w.setUint32(0, 0x02014b50, true);
        w.setUint16(4, 20, true);
        w.setUint16(6, 20, true);
        w.setUint16(8, 0x0800, true);
        w.setUint16(12, dt, true);
        w.setUint16(14, dd, true);
        w.setUint32(16, c, true);
        w.setUint32(20, n, true);
        w.setUint32(24, n, true);
        w.setUint16(28, nm.length, true);
        w.setUint32(42, off, true);
        e.set(nm, 46);
        cen.push(e);
        off += h.length + n;
      });

      const cs = cen.reduce((a, b) => a + b.length, 0);
      const end = new Uint8Array(22);
      const x = new DataView(end.buffer);
      x.setUint32(0, 0x06054b50, true);
      x.setUint16(8, fs.length, true);
      x.setUint16(10, fs.length, true);
      x.setUint32(12, cs, true);
      x.setUint32(16, off, true);
      const all = ch.concat(cen, [end]);
      const o = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
      let p = 0;
      all.forEach((a) => {
        o.set(a, p);
        p += a.length;
      });
      return o;
    }

    async function doExport(all: boolean) {
      if (!proj || !ab) return;
      syncAb();
      try {
        if (!all) {
          const d = await rend(ab);
          saveFile(fname(ab), d, 'image/png');
          toast('PNG berhasil diekspor.');
        } else {
          const fs: Array<{ name: string; data: Uint8Array }> = [];
          const used: Record<string, number> = {};
          const bs = proj.artboards;
          for (let i = 0; i < bs.length; i++) {
            toast(`Mengekspor ${i + 1} / ${bs.length}…`);
            let n = fname(bs[i]);
            used[n] = (used[n] || 0) + 1;
            if (used[n] > 1) n = n.replace(/\.png$/, `-${used[n]}.png`);
            fs.push({ name: n, data: await rend(bs[i]) });
            await new Promise((r) => safeSetTimeout(() => r(undefined), 0));
          }
          saveFile(`${slug(proj.name)}-semua-artboard.zip`, zip(fs), 'application/zip');
          toast(`ZIP berisi ${fs.length} artboard berhasil diekspor.`);
        }
      } catch (e: any) {
        toast(
          e && e.message === 'big'
            ? 'Resolusi terlalu tinggi untuk ukuran kertas ini.'
            : 'Export gagal.',
          'err'
        );
      }
    }

    $('dl').onclick = () => doExport(false);
    $('dla').onclick = () => doExport(true);

    /* ---- Native Print Sheet (No Iframe) ---- */
    $('pr').onclick = async () => {
      if (!proj || !ab) return;
      toast('Menyiapkan cetak…');
      syncAb();
      let d: Uint8Array;
      try {
        d = await rend(ab);
      } catch {
        toast('Export gagal.', 'err');
        return;
      }
      if (disposed) return;

      if (activePrintCleanup) activePrintCleanup();

      const p = P[ab.t];
      const imgUrl = URL.createObjectURL(new Blob([d.buffer as ArrayBuffer], { type: 'image/png' }));

      const pageStyle = document.createElement('style');
      pageStyle.id = 'fotowe-print-page-css';
      pageStyle.textContent = `@page{size:${p.w}mm ${p.h}mm;margin:0}`;
      document.head.appendChild(pageStyle);

      const portal = document.createElement('div');
      portal.id = 'fotowe-print-portal';
      const img = document.createElement('img');
      img.src = imgUrl;
      img.style.cssText = `display:block;width:${p.w}mm;height:${p.h}mm;margin:0;padding:0`;
      portal.appendChild(img);
      document.body.appendChild(portal);
      document.body.classList.add('fotowe-printing');

      const cleanupPrint = () => {
        window.removeEventListener('afterprint', cleanupPrint);
        document.body.classList.remove('fotowe-printing');
        portal.remove();
        pageStyle.remove();
        URL.revokeObjectURL(imgUrl);
        if (activePrintCleanup === cleanupPrint) activePrintCleanup = null;
      };
      activePrintCleanup = cleanupPrint;

      const triggerPrint = () => {
        if (disposed) {
          cleanupPrint();
          return;
        }
        window.addEventListener('afterprint', cleanupPrint, { once: true });
        window.print();
      };

      if (img.complete) {
        triggerPrint();
      } else {
        img.onload = triggerPrint;
        img.onerror = cleanupPrint;
      }
    };

    /* ---- Motion Layer Helpers ---- */
    function enter(el: HTMLElement) {
      if (RM) return;
      el.classList.remove('enter');
      void el.offsetWidth;
      el.classList.add('enter');
    }

    function swap(a: string, b: string) {
      const el = $(a);
      const was = el.hidden;
      $(b).hidden = true;
      el.hidden = false;
      if (was) enter(el);
    }

    function kill(i: number) {
      const s = sl(i);
      if (s.img && !RM) {
        GH.push({
          i,
          img: s.img,
          z: s.zv == null ? s.z : s.zv,
          ox: s.oxv == null ? s.ox : s.oxv,
          oy: s.oyv == null ? s.oy : s.oyv,
          t0: performance.now(),
        });
      }
      slots[i] = blank();
    }

    function markNew() {
      const L = cur();
      const now = performance.now();
      let c = 0;
      for (let i = 0; i < L.n; i++) {
        const s = slots[i];
        if (s && s.img && !s.shown) {
          s.shown = 1;
          if (animReady && !RM) s.t0 = now + Math.min(c++, 10) * 40;
        }
      }
    }

    function step(now: number): boolean {
      const L = cur();
      let act = false;
      for (let i = 0; i < L.n; i++) {
        const ts = sel.indexOf(i) >= 0 ? 1 : 0;
        const th = i === hov ? 1 : 0;
        if (RM) {
          HA[i] = ts;
          HV[i] = th;
        } else {
          const d1 = ts - (HA[i] || 0);
          const d2 = th - (HV[i] || 0);
          if (Math.abs(d1) > 0.02 || Math.abs(d2) > 0.02) {
            HA[i] = (HA[i] || 0) + d1 * 0.3;
            HV[i] = (HV[i] || 0) + d2 * 0.3;
            act = true;
          } else {
            HA[i] = ts;
            HV[i] = th;
          }
        }
        const s = slots[i];
        if (!s || !s.img) continue;
        if (s.zv == null || RM || (drag && i === st.a)) {
          s.zv = s.z;
          s.oxv = s.ox;
          s.oyv = s.oy;
        } else {
          const dz = s.z - s.zv;
          const dx = s.ox - (s.oxv ?? s.ox);
          const dy = s.oy - (s.oyv ?? s.oy);
          if (Math.abs(dz) > 0.001 || Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
            s.zv += dz * 0.3;
            s.oxv = (s.oxv ?? s.ox) + dx * 0.3;
            s.oyv = (s.oyv ?? s.oy) + dy * 0.3;
            act = true;
          } else {
            s.zv = s.z;
            s.oxv = s.ox;
            s.oyv = s.oy;
          }
        }
        if (s.t0 && now - s.t0 < POP) act = true;
        if (FL[i] && now - FL[i] < 300) act = true;
      }
      GH = GH.filter((o) => now - o.t0 < 200);
      if (GH.length) act = true;
      return act;
    }

    function frame() {
      raf = 0;
      if (disposed) return;
      const now = performance.now();
      const act = step(now);
      draw(cx, KP, true, cv.width, cv.height, now);
      if (act) kick();
    }

    function kick() {
      if (!raf && !disposed) raf = requestAnimationFrame(frame);
    }

    const onPointerDownRipple = (e: PointerEvent) => {
      if (RM) return;
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.('.b,.pill,.tc') as HTMLButtonElement | null;
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect();
      const z = Math.max(r.width, r.height) * 2;
      const d = document.createElement('span');
      d.className = 'rip';
      d.style.cssText = `width:${z}px;height:${z}px;left:${e.clientX - r.left - z / 2}px;top:${
        e.clientY - r.top - z / 2
      }px`;
      el.appendChild(d);
      safeSetTimeout(() => d.remove(), 520);
    };
    root.addEventListener('pointerdown', onPointerDownRipple);

    /* ---- Multi-Select & Copy / Paste ---- */
    let clip: Array<{
      dr: number;
      dc: number;
      img: HTMLImageElement;
      name: string;
      blob: Blob | null;
      photoId?: number | null;
      photoUrl?: string | null;
      corsUrl?: string | null;
      thumbUrl?: string | null;
      fileSize?: number;
      z: number;
      ox: number;
      oy: number;
    }> | null = null;

    function delSel() {
      if (!canModify()) return;
      let n = 0;
      sel.forEach((i) => {
        if (sl(i).img) {
          kill(i);
          n++;
        }
      });
      say(n ? `${n} foto dihapus.` : 'Tidak ada foto terpilih.');
      ui();
    }
    $('delsel').onclick = delSel;

    function copySel() {
      const C = cur().cols;
      const ix = sel
        .slice()
        .sort((a, b) => a - b)
        .filter((i) => !!sl(i).img);
      if (!ix.length) {
        say('Pilih foto yang akan disalin.');
        return;
      }
      let mr = 1e9;
      let mc = 1e9;
      ix.forEach((i) => {
        mr = Math.min(mr, Math.floor(i / C));
        mc = Math.min(mc, i % C);
      });
      clip = ix.map((i) => {
        const s = sl(i);
        return {
          dr: Math.floor(i / C) - mr,
          dc: (i % C) - mc,
          img: s.img!,
          name: s.name,
          blob: s.blob,
          photoId: s.photoId,
          photoUrl: s.photoUrl,
          corsUrl: s.corsUrl,
          thumbUrl: s.thumbUrl,
          fileSize: s.fileSize,
          z: s.z,
          ox: s.ox,
          oy: s.oy,
        };
      });
      ix.forEach((i) => {
        FL[i] = performance.now();
      });
      kick();
      say(`${ix.length} foto disalin.`);
    }

    function pasteClip() {
      if (!canModify()) {
        say('Mode baca saja. Anda tidak dapat menempel foto di project ini.');
        return;
      }
      if (!clip) {
        say('Belum ada foto yang disalin (Ctrl + C).');
        return;
      }
      const L = cur();
      const C = L.cols;
      const emp: number[] = [];
      for (let i = 0; i < L.n; i++) if (!sl(i).img) emp.push(i);
      if (!emp.length) {
        say('Semua slot sudah terisi.');
        return;
      }
      let tg: number[] | null = null;
      let part = false;
      for (let i = 1; i <= L.n && !tg; i++) {
        const a = (st.a + i) % L.n;
        const ar = Math.floor(a / C);
        const ac = a % C;
        const t: number[] = [];
        let ok = true;
        for (let k = 0; k < clip.length; k++) {
          const r = ar + clip[k].dr;
          const c = ac + clip[k].dc;
          if (r >= L.rows || c >= C || sl(r * C + c).img) {
            ok = false;
            break;
          }
          t.push(r * C + c);
        }
        if (ok) tg = t;
      }
      if (!tg) {
        tg = emp.slice(0, clip.length);
        part = true;
      }
      tg.forEach((ix, k) => {
        const c = clip![k];
        slots[ix] = {
          img: c.img,
          name: c.name,
          blob: c.blob,
          photoId: c.photoId,
          photoUrl: c.photoUrl,
          corsUrl: c.corsUrl,
          thumbUrl: c.thumbUrl,
          fileSize: c.fileSize,
          z: c.z,
          ox: c.ox,
          oy: c.oy,
          status: 'filled',
        };
      });
      sel = tg.slice();
      st.a = tg[0];
      say(
        tg.length < clip.length
          ? `${tg.length} dari ${clip.length} foto ditempel (slot kosong tidak cukup).`
          : part
          ? `${clip.length} foto ditempel ke slot kosong berurutan.`
          : `${clip.length} foto ditempel.`
      );
      ui();
    }

    function useAb(i: number) {
      syncAb();
      proj!.active = i;
      ab = proj!.artboards[i];
      slots = ab.slots;
      st.t = ab.t;
      st.s = ab.s;
      st.a = ab.a || 0;
      sel = [st.a];
      HA = [];
      HV = [];
      FL = [];
      GH = [];
      hov = -1;
      slots.forEach((x) => {
        if (x && x.img) x.shown = 1;
      });
    }

    function sig(): string {
      syncAb();
      const a: Array<string | number> = [proj!.name, proj!.dpi, proj!.color, proj!.active];
      proj!.artboards.forEach((b) => {
        a.push(`#${b.id}${b.name}${b.t}${b.s}${b.a}`);
        b.slots.forEach((x) => {
          const sz = x && x.blob ? x.blob.size : x?.fileSize || 0;
          a.push(x && x.img ? [x.name, sz, Number(x.z.toFixed(5)), Number(x.ox.toFixed(5)), Number(x.oy.toFixed(5))].join('|') : '-');
        });
      });
      return a.join(';');
    }

    function status() {
      if (disposed) return;
      const el = $('svs');
      if (!el || !proj) return;
      if (!proj.canEdit) {
        el.textContent = 'Mode Baca Saja';
        return;
      }
      el.textContent =
        busy ||
        (autoT
          ? 'Menyimpan ke server…'
          : savedSig === null
          ? 'Belum tersinkron'
          : savedSig === sig()
          ? `Tersinkron ${savedAt}`
          : 'Ada perubahan belum disimpan');
    }

    function autoSched() {
      if (!proj || !proj.canEdit || disposed) return;
      if (sig() !== savedSig) {
        safeClearTimeout(autoT);
        autoT = safeSetTimeout(() => {
          autoT = 0;
          saveProject(false);
        }, 1200);
      }
      status();
    }

    function updThumb() {
      if (disposed) return;
      safeClearTimeout(thT);
      thT = safeSetTimeout(() => {
        const d = $('abl').children[proj ? proj.active : -1];
        if (d && proj) thumb(d.firstChild as HTMLCanvasElement, proj.artboards[proj.active]);
      }, 120);
    }

    function afterUi() {
      if (!proj || disposed) return;
      updThumb();
      if (proj.canEdit) autoSched();
    }

    function generateCoverThumbnail(targetProj: ProjectData): string | null {
      try {
        const activeAb = targetProj.artboards[targetProj.active] || targetProj.artboards[0];
        if (!activeAb) return null;
        const p = P[activeAb.t] || P['4R'];
        const k = 280 / Math.max(p.w, p.h);
        const w = Math.max(80, Math.round(p.w * k));
        const h = Math.max(80, Math.round(p.h * k));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        if (!g) return null;
        draw(g, k, false, w, h, 0, activeAb);
        if (targetProj.color === 'gray') {
          gray(g, w, h);
        }
        return c.toDataURL('image/jpeg', 0.78);
      } catch {
        return null;
      }
    }

    function buildSummaryFromProj(targetProj: ProjectData, savedTs: number, serverSummary?: FotoweProjectSummary): FotoweProjectSummary {
      let photoCount = 0;
      targetProj.artboards.forEach((b) => {
        b.slots.forEach((x) => {
          if (x && (x.img || x.status === 'filled')) photoCount++;
        });
      });
      return {
        id: targetProj.id,
        name: targetProj.name,
        dpi: targetProj.dpi,
        color: targetProj.color,
        active: targetProj.active,
        n: targetProj.artboards.length,
        photos: photoCount,
        thumbnail_url: serverSummary?.thumbnail_url ?? targetProj.thumbnailUrl ?? null,
        visibility: targetProj.visibility,
        version: serverSummary?.version ?? targetProj.version ?? 1,
        owner_user_id: serverSummary?.owner_user_id ?? targetProj.ownerUserId ?? 0,
        owner_name: serverSummary?.owner_name ?? targetProj.ownerName ?? 'Anda',
        owner_email: serverSummary?.owner_email ?? targetProj.ownerEmail ?? '',
        is_owner: serverSummary?.is_owner ?? targetProj.isOwner,
        is_admin: serverSummary?.is_admin ?? targetProj.isAdmin,
        can_edit: serverSummary?.can_edit ?? targetProj.canEdit,
        can_delete: serverSummary?.can_delete ?? targetProj.canDelete,
        can_manage_permissions: serverSummary?.can_manage_permissions ?? targetProj.canManagePermissions,
        access_role: serverSummary?.access_role ?? targetProj.accessRole,
        saved: savedTs,
      };
    }

    function upsertSummary(m: FotoweProjectSummary) {
      const idx = plist.findIndex((x) => x.id === m.id);
      if (idx < 0) plist.unshift(m);
      else plist[idx] = { ...plist[idx], ...m };
      plist.sort((a, b) => b.saved - a.saved);
    }

    async function ensureAllSlotsUploaded(targetProj: ProjectData): Promise<void> {
      const uploadsToWait: Array<Promise<void>> = [];
      for (const b of targetProj.artboards) {
        for (const s of b.slots) {
          if (s && s.img && !s.photoId && !s.photoUrl && s.blob) {
            const p = ensureBlobUpload(s.blob, s.name || 'foto.jpg').then((uploaded) => {
              s.photoId = uploaded.photo_id;
              s.photoUrl = uploaded.file_url;
              s.corsUrl = uploaded.cors_url;
              s.thumbUrl = uploaded.thumb_url;
              s.fileSize = uploaded.file_size;
              applyUploadMetadataToAllMatchingSlots(s.blob!, uploaded);
            });
            uploadsToWait.push(p);
          }
        }
      }
      if (uploadsToWait.length > 0) {
        await Promise.all(uploadsToWait);
      }
    }

    function serializeArtboards(targetProj: ProjectData): FotoweArtboardPayload[] {
      return targetProj.artboards.map((b) => {
        const L = layout(P[b.t] || P['4R'], S[b.s] || S[1]);
        const maxSlots = Math.max(L.n, b.slots.length);
        const mappedSlots: FotoweSlotPayload[] = [];
        for (let idx = 0; idx < maxSlots; idx++) {
          const s = b.slots[idx];
          if (s && s.img && (s.photoId || s.photoUrl)) {
            mappedSlots.push({
              slot_index: idx,
              photo_id: s.photoId ?? null,
              photo_url: s.photoUrl ?? null,
              thumb_url: s.thumbUrl ?? s.photoUrl ?? null,
              name: s.name || 'foto.jpg',
              file_size: s.fileSize || (s.blob ? s.blob.size : 0),
              z: s.z,
              ox: s.ox,
              oy: s.oy,
              status: 'filled',
            });
          } else {
            mappedSlots.push({
              slot_index: idx,
              photo_id: null,
              photo_url: null,
              thumb_url: null,
              name: '',
              file_size: 0,
              z: 1,
              ox: 0,
              oy: 0,
              status: 'empty',
            });
          }
        }
        return {
          id: b.id,
          name: b.name,
          t: b.t,
          s: b.s,
          a: b.a,
          slots: mappedSlots,
        };
      });
    }

    function saveProject(manual: boolean): Promise<void> {
      if (!proj || !proj.canEdit) return Promise.resolve();
      safeClearTimeout(autoT);
      autoT = 0;

      if (activeSavePromise) {
        trailingSaveRequested = true;
        return activeSavePromise;
      }

      const targetProj = proj;
      const runSave = async () => {
        do {
          trailingSaveRequested = false;
          syncAb();
          const sg = sig();
          const targetId = targetProj.id;

          busy = 'Menyimpan ke server…';
          status();

          try {
            await ensureAllSlotsUploaded(targetProj);
            const coverData = generateCoverThumbnail(targetProj);
            const artboardsPayload = serializeArtboards(targetProj);

            let resSummary: FotoweProjectSummary;
            if (!targetProj.isRemotePersisted) {
              resSummary = await fotoweApi.createProject({
                id: targetProj.id,
                name: targetProj.name,
                dpi: targetProj.dpi,
                color: targetProj.color,
                active: targetProj.active,
                thumbnail_data: coverData,
                visibility: targetProj.visibility,
                artboards: artboardsPayload,
              });
              targetProj.isRemotePersisted = true;
            } else {
              resSummary = await fotoweApi.updateProject({
                id: targetProj.id,
                name: targetProj.name,
                dpi: targetProj.dpi,
                color: targetProj.color,
                active: targetProj.active,
                thumbnail_data: coverData,
                visibility: targetProj.visibility,
                artboards: artboardsPayload,
              });
            }

            if (resSummary.thumbnail_url) {
              targetProj.thumbnailUrl = resSummary.thumbnail_url;
            }
            if (typeof resSummary.version === 'number') {
              targetProj.version = resSummary.version;
            }
            const savedTs = resSummary.saved || Date.now();
            targetProj.saved = savedTs;

            const mergedSummary = buildSummaryFromProj(targetProj, savedTs, resSummary);
            upsertSummary(mergedSummary);

            if (!disposed && proj && proj.id === targetId) {
              busy = '';
              savedSig = sg;
              savedAt = nowT(savedTs);
              status();
              if (manual && !trailingSaveRequested) {
                toast('Project tersinkron ke server workspace.');
              }
            }
          } catch (err: any) {
            const errMsg = err?.message || 'Gagal menyinkronkan project ke server.';
            if (!disposed) {
              busy = 'Gagal sinkron server';
              status();
              toast(errMsg, 'err');
              safeSetTimeout(() => {
                if (busy === 'Gagal sinkron server') {
                  busy = '';
                  status();
                }
              }, 3000);
            }
          }
        } while (trailingSaveRequested && !disposed && proj && proj.id === targetProj.id && proj.canEdit);
      };

      activeSavePromise = runSave().finally(() => {
        activeSavePromise = null;
      });
      return activeSavePromise;
    }

    async function hydrateServerDetail(detail: FotoweProjectDetail): Promise<{ project: ProjectData; missingCount: number }> {
      // Deduplicate fetching remote photos across all artboards/slots in this project
      const fetchPromises = new Map<string, Promise<{ img: HTMLImageElement; name: string; blob: Blob } | null>>();
      let missingCount = 0;

      const fetchSlotMedia = (s: FotoweSlotPayload): Promise<{ img: HTMLImageElement; name: string; blob: Blob } | null> => {
        const cacheKey = s.photo_id ? `id:${s.photo_id}` : `url:${s.photo_url || ''}`;
        let p = fetchPromises.get(cacheKey);
        if (!p) {
          p = (async () => {
            const blob = await fetchPhotoBlobCorsSafe({
              corsUrl: s.cors_url,
              photoUrl: s.photo_url,
              photoId: s.photo_id,
            });
            if (!blob) return null;
            return await load(blob, s.name || 'foto.jpg');
          })();
          fetchPromises.set(cacheKey, p);
        }
        return p;
      };

      const hydratedArtboards: Artboard[] = await Promise.all(
        (detail.artboards || []).map(async (b, abIdx) => {
          const tpl = P[b.t] ? b.t : '4R';
          const szIdx = S[b.s] ? b.s : 1;
          const hydratedSlots = await Promise.all(
            (b.slots || []).map(async (q) => {
              if (q && q.status === 'filled' && (q.photo_id || q.photo_url)) {
                const media = await fetchSlotMedia(q);
                if (media) {
                  return {
                    img: media.img,
                    name: q.name || media.name || 'foto.jpg',
                    blob: media.blob,
                    photoId: q.photo_id ?? null,
                    photoUrl: q.photo_url ?? null,
                    corsUrl: q.cors_url ?? null,
                    thumbUrl: q.thumb_url ?? q.photo_url ?? null,
                    fileSize: q.file_size || media.blob.size,
                    z: typeof q.z === 'number' ? q.z : 1,
                    ox: typeof q.ox === 'number' ? q.ox : 0,
                    oy: typeof q.oy === 'number' ? q.oy : 0,
                    status: 'filled',
                  } as SlotState;
                }
                missingCount++;
              }
              return blank();
            })
          );

          return {
            id: b.id || `ab_${abIdx + 1}`,
            name: b.name || `Artboard ${abIdx + 1}`,
            t: tpl,
            s: szIdx,
            a: typeof b.a === 'number' ? b.a : 0,
            slots: hydratedSlots,
          };
        })
      );

      if (!hydratedArtboards.length) {
        hydratedArtboards.push(newAb('Artboard 1', '4R', 1));
      }

      return {
        missingCount,
        project: {
          id: detail.id,
          name: detail.name,
          dpi: detail.dpi || 300,
          color: detail.color === 'gray' ? 'gray' : 'rgb',
          active: detail.active || 0,
          saved: detail.saved,
          ownerUserId: detail.owner_user_id,
          ownerName: detail.owner_name,
          ownerEmail: detail.owner_email,
          isOwner: Boolean(detail.is_owner),
          isAdmin: Boolean(detail.is_admin),
          canEdit: Boolean(detail.can_edit),
          canDelete: Boolean(detail.can_delete),
          canManagePermissions: Boolean(detail.can_manage_permissions),
          accessRole: detail.access_role || (detail.can_edit ? 'editor' : 'viewer'),
          visibility: detail.visibility === 'private' ? 'private' : 'workspace',
          version: detail.version || 1,
          thumbnailUrl: detail.thumbnail_url || null,
          permissions: Array.isArray(detail.permissions) ? detail.permissions : [],
          artboards: hydratedArtboards,
          isRemotePersisted: true,
        },
      };
    }

    async function openProject(id: string): Promise<void> {
      if (proj && proj.canEdit && sig() !== savedSig) {
        saveProject(false);
      }
      if (activeSavePromise) {
        await activeSavePromise.catch(() => {});
      }

      toast('Membuka project dari server…');
      try {
        const detail = await fotoweApi.getProjectDetail(id);
        if (disposed) return;
        const { project: hydrated, missingCount } = await hydrateServerDetail(detail);
        if (disposed) return;

        ab = null;
        proj = hydrated;
        useAb(Math.min(hydrated.active, hydrated.artboards.length - 1));
        savedSig = sig();
        savedAt = nowT(hydrated.saved);
        safeClearTimeout(autoT);
        autoT = 0;

        if (window.location.hash.slice(1) === 'editor') route();
        else window.location.hash = 'editor';

        if (missingCount > 0) {
          toast(`${missingCount} foto pada project ini tidak dapat dimuat dari server.`, 'err');
        } else if (!hydrated.canEdit) {
          toast('Mode baca saja: Anda dapat melihat, export PNG/ZIP, dan mencetak project ini.');
        }
      } catch (err: any) {
        if (!disposed) {
          toast(err?.message || 'Project tidak dapat dibuka dari server.', 'err');
        }
      }
    }

    async function refreshList(opts?: { silent?: boolean }): Promise<void> {
      if (disposed || isRefreshingList) return;
      isRefreshingList = true;
      const silent = Boolean(opts?.silent);
      if (!silent) {
        isLoadingList = true;
        listError = '';
        renderProjects();
      }
      try {
        const list = await fotoweApi.listProjects();
        if (disposed) return;
        plist = list;
        isLoadingList = false;
        listError = '';
      } catch (err: any) {
        if (disposed) return;
        isLoadingList = false;
        listError = err?.message || 'Gagal memuat project FOTOWE dari server.';
      } finally {
        isRefreshingList = false;
        if (!disposed) renderProjects();
      }
    }

    function renderProjects() {
      if (disposed) return;
      const sec = $('pj');
      const g = $('pl');
      const stateEl = $('pjState');
      g.innerHTML = '';

      if (isLoadingList && !plist.length) {
        sec.hidden = false;
        stateEl.hidden = false;
        stateEl.textContent = 'Memuat project shared workspace dari server…';
        return;
      }

      if (listError && !plist.length) {
        sec.hidden = false;
        stateEl.hidden = false;
        stateEl.textContent = listError;
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'b';
        retryBtn.textContent = 'Coba Lagi';
        retryBtn.onclick = () => refreshList({ silent: false });
        g.appendChild(retryBtn);
        return;
      }

      if (!plist.length) {
        sec.hidden = true;
        stateEl.hidden = true;
        return;
      }

      sec.hidden = false;
      if (listError) {
        stateEl.hidden = false;
        stateEl.textContent = `Gagal menyegarkan: ${listError}`;
      } else {
        stateEl.hidden = true;
      }

      plist.forEach((r) => {
        const d = document.createElement('div');
        d.className = 'tc pjc';
        d.tabIndex = 0;

        const thumbHtml = r.thumbnail_url
          ? `<div class="ill"><img src="${esc(r.thumbnail_url)}" alt="${esc(r.name)}" loading="lazy" /></div>`
          : `<div class="ill"><svg viewBox="0 0 101.6 152.4"><rect width="101.6" height="152.4" fill="#fff"/><rect x="18" y="22" width="30" height="40" fill="#c9d3e6"/><rect x="54" y="22" width="30" height="40" fill="#c9d3e6"/><rect x="18" y="68" width="30" height="40" fill="#c9d3e6"/><rect x="54" y="68" width="30" height="40" fill="#c9d3e6"/></svg></div>`;

        d.innerHTML =
          (r.can_delete
            ? '<button type="button" class="b pd" title="Hapus project" aria-label="Hapus project">✕</button>'
            : '') +
          thumbHtml +
          '<div class="tn"></div><div class="td"></div><div class="tf"><span></span><span class="go">Buka →</span></div>';

        d.querySelector('.tn')!.textContent = r.name;
        d.querySelector('.td')!.textContent =
          `${r.n} artboard · ${r.photos} foto · Oleh ${r.owner_name || r.owner_email || 'Tim'}`;
        d.querySelector('.tf span')!.textContent =
          `${r.dpi} DPI · ${r.color === 'gray' ? 'Grayscale' : 'RGB'} · ${roleLabel(r)}`;

        d.onclick = () => openProject(r.id);
        d.onkeydown = (e) => {
          if (e.key === 'Enter' && e.target === d) openProject(r.id);
        };

        const delBtn = d.querySelector('.pd') as HTMLButtonElement | null;
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            modal({
              title: 'Hapus project?',
              sub: `“${r.name}” beserta semua artboard dan fotonya akan dihapus permanen dari server workspace.`,
              okLabel: 'Hapus',
              ok: () => {
                fotoweApi
                  .deleteProject(r.id)
                  .then(() => {
                    if (disposed) return;
                    plist = plist.filter((x) => x.id !== r.id);
                    if (proj && proj.id === r.id) {
                      proj = null;
                      ab = null;
                      savedSig = null;
                    }
                    renderProjects();
                    toast('Project berhasil dihapus dari semua perangkat.');
                  })
                  .catch((err: any) => {
                    if (!disposed) toast(err?.message || 'Gagal menghapus project.', 'err');
                  });
              },
            });
          };
        }
        g.appendChild(d);
      });
    }

    /* ---- Modals ---- */
    interface ModalOpts {
      title: string;
      sub?: string;
      okLabel?: string;
      body?: string;
      onseg?: (ov: HTMLElement, k: string, v: string) => void;
      ok: (ov: HTMLElement) => string | void;
    }

    function seg(k: string, items: Array<[string, string]>, curVal: string): string {
      return (
        `<div class="row seg" data-k="${k}">` +
        items
          .map(
            (it) =>
              `<button type="button" class="b${it[0] === curVal ? ' on' : ''}" data-v="${it[0]}">${it[1]}</button>`
          )
          .join('') +
        '</div>'
      );
    }

    function sv(ov: HTMLElement, k: string): string {
      const b = ov.querySelector<HTMLElement>(`.seg[data-k="${k}"] .on`);
      return (b && b.dataset.v) || '';
    }

    function modal(o: ModalOpts): HTMLElement {
      const ov = document.createElement('div');
      ov.className = 'mo';
      ov.innerHTML =
        '<div class="md" role="dialog" aria-modal="true"><h2></h2><p class="desc" style="margin:4px 0 0"></p><div>' +
        (o.body || '') +
        '</div><div class="err" role="alert"></div><div class="act"><button type="button" class="b" data-x>Batal</button><button type="button" class="pill" data-ok></button></div></div>';
      ov.querySelector('h2')!.textContent = o.title;
      const ds = ov.querySelector('.desc')!;
      if (o.sub) ds.textContent = o.sub;
      else ds.remove();
      ov.querySelector('[data-ok]')!.textContent = o.okLabel || 'OK';

      const close = () => {
        document.removeEventListener('keydown', kd, true);
        modalCleanupFns.delete(forceRemove);
        ov.classList.add('out');
        safeSetTimeout(() => ov.remove(), 170);
      };
      const forceRemove = () => {
        document.removeEventListener('keydown', kd, true);
        ov.remove();
      };
      const submit = () => {
        const r = o.ok(ov);
        if (typeof r === 'string') {
          ov.querySelector('.err')!.textContent = r;
          return;
        }
        close();
      };
      const kd = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        } else if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
          e.preventDefault();
          submit();
        }
      };

      modalCleanupFns.add(forceRemove);
      document.addEventListener('keydown', kd, true);
      ov.addEventListener('mousedown', (e) => {
        if (e.target === ov) close();
      });
      (ov.querySelector('[data-x]') as HTMLButtonElement).onclick = close;
      (ov.querySelector('[data-ok]') as HTMLButtonElement).onclick = submit;
      ov.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        const b = target?.closest?.('.seg .b') as HTMLElement | null;
        if (!b) return;
        b.parentNode!.querySelectorAll('.b').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        ov.querySelector('.err')!.textContent = '';
        if (o.onseg) o.onseg(ov, (b.parentNode as HTMLElement).dataset.k!, b.dataset.v!);
      });
      root.appendChild(ov);
      const f = ov.querySelector<HTMLElement>('input');
      if (f) f.focus();
      else (ov.querySelector('[data-ok]') as HTMLElement).focus();
      return ov;
    }

    function sizeSeg(curVal: string): string {
      return (
        seg(
          'size',
          Object.keys(P).map((k) => [k, k]),
          curVal
        ) + `<div class="td" id="md" style="margin-top:6px">${P[curVal].d}</div>`
      );
    }

    function sizeHint(ov: HTMLElement, k: string, v: string) {
      if (k === 'size') ov.querySelector('#md')!.textContent = P[v].d;
    }

    function newProject(def: string) {
      if (proj && proj.canEdit && sig() !== savedSig) saveProject(false);
      modal({
        title: 'Project baru',
        sub: 'Atur nama, ukuran kertas, resolusi, dan mode warna.',
        okLabel: 'Buat Project',
        body:
          '<div class="lbl" style="margin-top:14px">Nama project</div>' +
          '<input type="text" id="mn" maxlength="60" placeholder="mis. Pas Foto Budi" autocomplete="off">' +
          '<div class="lbl">Ukuran template</div>' +
          sizeSeg(def) +
          '<div class="lbl">Resolusi (DPI)</div>' +
          seg(
            'dpi',
            [
              ['150', '150'],
              ['300', '300'],
              ['600', '600'],
              ['c', 'Custom'],
            ],
            '300'
          ) +
          '<input type="number" id="cd" min="72" max="1200" value="300" placeholder="72–1200" style="margin-top:8px" hidden>' +
          '<div class="lbl">Color mode</div>' +
          seg(
            'color',
            [
              ['rgb', 'RGB'],
              ['gray', 'Grayscale'],
            ],
            'rgb'
          ),
        onseg: (ov, k, v) => {
          sizeHint(ov, k, v);
          if (k === 'dpi') {
            const c = ov.querySelector<HTMLInputElement>('#cd')!;
            c.hidden = v !== 'c';
            if (v === 'c') c.focus();
          }
        },
        ok: (ov) => {
          const nm = ov.querySelector<HTMLInputElement>('#mn')!.value.trim();
          if (!nm) return 'Nama project wajib diisi.';
          const size = sv(ov, 'size');
          const dv = sv(ov, 'dpi');
          const dpi = dv === 'c' ? Math.round(+ov.querySelector<HTMLInputElement>('#cd')!.value) : +dv;
          if (!(dpi >= 72 && dpi <= 1200)) return 'DPI custom harus antara 72 dan 1200.';
          if (tooBig(size, dpi))
            return 'Resolusi terlalu tinggi untuk ukuran ini (maks. 120 megapiksel).';
          const me = getStoredUser();
          ab = null;
          proj = {
            id: uid(),
            name: nm,
            dpi,
            color: sv(ov, 'color') === 'gray' ? 'gray' : 'rgb',
            active: 0,
            artboards: [newAb('Artboard 1', size, hsz)],
            ownerUserId: me?.id ? Number(me.id) : undefined,
            ownerName: me?.name || me?.email || 'Anda',
            ownerEmail: me?.email || '',
            isOwner: true,
            canEdit: true,
            canDelete: true,
            canManagePermissions: true,
            accessRole: 'owner',
            visibility: 'workspace',
            permissions: [],
            isRemotePersisted: false,
          };
          useAb(0);
          savedSig = null;
          savedAt = '';
          window.location.hash = 'editor';
          saveProject(false);
        },
      });
    }

    /* ---- Collaborator Permissions Modal ---- */
    async function openShareModal() {
      if (!proj || !proj.canManagePermissions) {
        say('Hanya pemilik project atau Admin yang dapat mengelola izin.');
        return;
      }
      const targetProj = proj;
      let selectedVisibility: 'workspace' | 'private' = targetProj.visibility;
      const editorEmails = new Set<string>(
        (targetProj.permissions || [])
          .filter((p) => p.permission === 'editor')
          .map((p) => p.user_email.toLowerCase())
      );

      const ov = modal({
        title: 'Izin Akses Workspace',
        sub: `Atur anggota tim LaporanWe yang dapat mengedit “${targetProj.name}”.`,
        okLabel: 'Simpan Izin',
        body:
          '<div class="lbl" style="margin-top:14px">Visibilitas Project</div>' +
          seg(
            'vis',
            [
              ['workspace', 'Workspace Tim'],
              ['private', 'Hanya Yang Diizinkan'],
            ],
            selectedVisibility
          ) +
          '<div class="lbl">Anggota Tim LaporanWe</div>' +
          '<div id="permBox" class="perm-list"><div class="td">Memuat daftar anggota tim…</div></div>',
        onseg: (_ov, k, v) => {
          if (k === 'vis') {
            selectedVisibility = v === 'private' ? 'private' : 'workspace';
          }
        },
        ok: () => {
          const nextPermissions: FotowePermissionEntry[] = [];
          const listEl = ov.querySelector('#permBox');
          if (listEl) {
            listEl.querySelectorAll<HTMLButtonElement>('[data-email]').forEach((btn) => {
              const email = (btn.dataset.email || '').toLowerCase();
              const uidAttr = btn.dataset.uid ? Number(btn.dataset.uid) : null;
              if (email && editorEmails.has(email)) {
                nextPermissions.push({
                  user_id: uidAttr,
                  user_email: email,
                  permission: 'editor',
                });
              }
            });
          }

          fotoweApi
            .updateProject({
              id: targetProj.id,
              visibility: selectedVisibility,
              permissions: nextPermissions,
            })
            .then(() => {
              if (disposed) return;
              targetProj.visibility = selectedVisibility;
              targetProj.permissions = nextPermissions;
              toast('Izin akses project diperbarui.');
            })
            .catch((err: any) => {
              if (!disposed) toast(err?.message || 'Gagal memperbarui izin akses.', 'err');
            });
        },
      });

      try {
        const { members } = await teamService.fetchTeamMembers();
        if (disposed || !ov.isConnected) return;
        const box = ov.querySelector('#permBox');
        if (!box) return;
        const ownerEmailLower = (targetProj.ownerEmail || '').toLowerCase();
        const others = members.filter(
          (m) => Boolean(m.email && m.email.toLowerCase() !== ownerEmailLower)
        );
        if (!others.length) {
          box.innerHTML = '<div class="td">Tidak ada anggota tim lain yang terdaftar.</div>';
          return;
        }
        box.innerHTML = '';
        others.forEach((m) => {
          const emailVal = String(m.email || '').trim();
          const emailLower = emailVal.toLowerCase();
          const row = document.createElement('div');
          row.className = 'perm-item';
          row.innerHTML =
            '<div class="perm-meta"><div class="perm-name"></div><div class="perm-email"></div></div>' +
            '<button type="button" class="b"></button>';
          row.querySelector('.perm-name')!.textContent = m.name || emailVal;
          row.querySelector('.perm-email')!.textContent = emailVal;
          const btn = row.querySelector('button')!;
          btn.dataset.email = emailLower;
          if (m.id) btn.dataset.uid = String(m.id);

          const renderToggle = () => {
            const active = editorEmails.has(emailLower);
            btn.className = 'b' + (active ? ' on' : '');
            btn.textContent = active ? 'Editor ✓' : 'Hanya Lihat';
          };
          renderToggle();
          btn.onclick = () => {
            if (editorEmails.has(emailLower)) editorEmails.delete(emailLower);
            else editorEmails.add(emailLower);
            renderToggle();
          };
          box.appendChild(row);
        });
      } catch {
        const box = ov.querySelector('#permBox');
        if (box) box.innerHTML = '<div class="td">Gagal memuat daftar anggota tim.</div>';
      }
    }

    /* ---- Artboards Strip & Actions ---- */
    function thumb(c: HTMLCanvasElement, a: Artboard) {
      syncAb();
      const p = P[a.t];
      const k = 130 / Math.max(p.w, p.h);
      c.width = Math.round(p.w * k);
      c.height = Math.round(p.h * k);
      draw(c.getContext('2d')!, k, false, c.width, c.height, 0, a);
    }

    function renderStrip() {
      const b = $('abl');
      b.innerHTML = '';
      proj!.artboards.forEach((a, i) => {
        const d = document.createElement('div');
        d.className = 'ab' + (i === proj!.active ? ' on' : '');
        d.title = `${a.name} · ${a.t}`;
        const c = document.createElement('canvas');
        const n = document.createElement('span');
        n.textContent = a.name;
        d.appendChild(c);
        d.appendChild(n);
        thumb(c, a);
        d.onclick = () => {
          if (i !== proj!.active) switchAb(i);
        };
        d.ondblclick = () => {
          if (canModify()) renAb();
        };
        b.appendChild(d);
      });
      $('hd').textContent = `${proj!.name} · ${proj!.artboards.length} artboard`;
      $('hr').textContent = `${proj!.dpi} DPI · ${proj!.color === 'gray' ? 'Grayscale' : 'RGB'}`;
      const on = b.children[proj!.active] as HTMLElement | undefined;
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function switchAb(i: number) {
      useAb(i);
      setup();
      ui();
      renderStrip();
    }

    function addAb() {
      if (!canModify()) return;
      modal({
        title: 'Artboard baru',
        okLabel: 'Tambah',
        body:
          '<div class="lbl" style="margin-top:14px">Nama (opsional)</div>' +
          `<input type="text" id="mn" maxlength="60" placeholder="Artboard ${
            proj!.artboards.length + 1
          }" autocomplete="off">` +
          '<div class="lbl">Ukuran template</div>' +
          sizeSeg(ab!.t),
        onseg: sizeHint,
        ok: (ov) => {
          const size = sv(ov, 'size');
          if (tooBig(size, proj!.dpi)) return 'Resolusi project terlalu tinggi untuk ukuran ini.';
          const nm =
            ov.querySelector<HTMLInputElement>('#mn')!.value.trim() ||
            `Artboard ${proj!.artboards.length + 1}`;
          proj!.artboards.push(newAb(nm, size, ab!.s));
          switchAb(proj!.artboards.length - 1);
          toast(`Artboard “${nm}” ditambahkan.`);
        },
      });
    }

    function dupAb() {
      if (!canModify()) return;
      syncAb();
      const c: Artboard = {
        id: 'ab_' + Math.random().toString(36).slice(2, 9),
        name: `${ab!.name} (salinan)`,
        t: ab!.t,
        s: ab!.s,
        a: ab!.a,
        slots: ab!.slots.map((x) =>
          x && x.img
            ? {
                img: x.img,
                name: x.name,
                blob: x.blob,
                photoId: x.photoId,
                photoUrl: x.photoUrl,
                corsUrl: x.corsUrl,
                thumbUrl: x.thumbUrl,
                fileSize: x.fileSize,
                z: x.z,
                ox: x.ox,
                oy: x.oy,
                status: 'filled',
              }
            : blank()
        ),
      };
      proj!.artboards.splice(proj!.active + 1, 0, c);
      switchAb(proj!.active + 1);
      toast('Artboard diduplikasi beserta semua foto.');
    }

    function renAb() {
      if (!canModify()) return;
      const m = modal({
        title: 'Ganti nama artboard',
        okLabel: 'Simpan',
        body: '<input type="text" id="mn" maxlength="60" autocomplete="off" style="margin-top:14px">',
        ok: (ov) => {
          const nm = ov.querySelector<HTMLInputElement>('#mn')!.value.trim();
          if (!nm) return 'Nama tidak boleh kosong.';
          ab!.name = nm;
          renderStrip();
          ui();
          toast('Nama artboard diganti.');
        },
      });
      (m.querySelector('#mn') as HTMLInputElement).value = ab!.name;
    }

    function delAb() {
      if (!canModify()) return;
      if (proj!.artboards.length < 2) {
        toast('Project harus memiliki minimal 1 artboard.', 'err');
        return;
      }
      modal({
        title: 'Hapus artboard?',
        sub: `“${ab!.name}” beserta semua foto di dalamnya akan dihapus.`,
        okLabel: 'Hapus',
        ok: () => {
          const i = proj!.active;
          proj!.artboards.splice(i, 1);
          ab = null;
          useAb(Math.min(i, proj!.artboards.length - 1));
          setup();
          ui();
          renderStrip();
          toast('Artboard dihapus.');
        },
      });
    }

    $('abAdd').onclick = addAb;
    $('abDup').onclick = dupAb;
    $('abRen').onclick = renAb;
    $('abDel').onclick = delAb;
    $('sv').onclick = () => saveProject(true);
    const shrButton = $('shr');
    if (shrButton) shrButton.onclick = openShareModal;
    const pjRefreshBtn = $('pjRef');
    if (pjRefreshBtn) pjRefreshBtn.onclick = () => refreshList({ silent: false });

    /* ---- Internal FOTOWE Sub-Routing (Home <-> Editor) ---- */
    function route() {
      if (disposed) return;
      if (!/^\/aplikasi\/fotowe/i.test(window.location.pathname)) return;
      const h = window.location.hash.slice(1);
      if (h === 'editor' && proj) {
        if (st.a >= cur().n) st.a = 0;
        swap('editor', 'home');
        $('editor').classList.toggle('gray', proj.color === 'gray');
        setup();
        ui();
        renderStrip();
        say('');
      } else {
        if (proj && proj.canEdit && sig() !== savedSig) {
          saveProject(false).then(() => {
            if (!disposed) refreshList({ silent: true });
          });
        } else if (proj) {
          refreshList({ silent: true });
        }
        cardAnim = Boolean($('home').hidden);
        swap('home', 'editor');
        $('hd').textContent = 'Studio Pas Foto Digital';
        $('hr').textContent = 'Shared Workspace';
        renderHome();
        renderProjects();
      }
    }

    window.addEventListener('hashchange', route);
    $('lg').onclick = $('bk').onclick = () => {
      window.location.hash = 'home';
    };

    const backBtn = root.querySelector<HTMLAnchorElement>('.back-laporanwe');
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        if (proj && proj.canEdit && sig() !== savedSig) saveProject(false);
        onBackToHubRef.current();
      };
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (proj && proj.canEdit && sig() !== savedSig) saveProject(false);
      } else if (!$('home').hidden && !root.querySelector('.mo')) {
        refreshList({ silent: true });
      }
    };
    const onWindowFocus = () => {
      if (!disposed && !$('home').hidden && !root.querySelector('.mo')) {
        refreshList({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const onKeyDown = (e: KeyboardEvent) => {
      if (disposed || $('editor').hidden || root.querySelector('.mo')) return;
      const t = e.target as HTMLElement | null;
      const tg = t && t.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (t && t.isContentEditable)) {
        return;
      }
      const k = (e.key || '').toLowerCase();
      const m = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
      if (m && k === 's') {
        e.preventDefault();
        if (!e.repeat && canModify()) saveProject(true);
        return;
      }
      if (m && k === 'e') {
        e.preventDefault();
        if (!e.repeat && !($('dl') as HTMLButtonElement).disabled) $('dl').click();
        return;
      }
      if (m && k === 'c') {
        if (window.getSelection && String(window.getSelection())) return;
        e.preventDefault();
        copySel();
        return;
      }
      if (m && k === 'v') {
        e.preventDefault();
        pasteClip();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (k === 'delete' || k === 'backspace')) {
        if (!canModify()) return;
        e.preventDefault();
        delSel();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    /* ---- Boot Sequence ---- */
    const bt = performance.now();
    let bd = false;
    function hideBoot() {
      if (bd || disposed) return;
      bd = true;
      safeSetTimeout(() => {
        const h = !$('home').hidden;
        cardAnim = h;
        if (h) renderHome();
        enter(h ? $('home') : $('editor'));
        animReady = true;
        const bootEl = $('boot');
        if (bootEl) {
          bootEl.classList.add('off');
          safeSetTimeout(() => bootEl.remove(), 400);
        }
      }, Math.max(0, 450 - (performance.now() - bt)));
    }

    async function init() {
      await refreshList({ silent: false });
      if (disposed) return;

      // Safe IndexedDB -> MySQL migration (never deletes local data unless server confirms 100%)
      migrateIndexedDbProjects(scopeIdentityRef.current)
        .then(async ({ migratedCount, failedCount }) => {
          if (disposed) return;
          if (migratedCount > 0) {
            toast(`${migratedCount} project lama berhasil dimigrasikan ke cloud workspace.`);
            await refreshList({ silent: true });
          }
          if (failedCount > 0) {
            toast(`${failedCount} project lokal belum dapat dimigrasikan dan tetap aman di browser.`, 'err');
          }
        })
        .catch(() => {});

      if (window.location.hash.slice(1) === 'editor') {
        if (plist.length) return openProject(plist[0].id);
        window.location.hash = 'home';
      }
    }

    // Periodic cross-device workspace refresh every 15s while on Home view
    pollIntervalId = window.setInterval(() => {
      if (!disposed && !document.hidden && !$('home').hidden && !root.querySelector('.mo')) {
        refreshList({ silent: true });
      }
    }, 15000);

    route();
    const fr =
      document.fonts && document.fonts.ready
        ? Promise.race([
            document.fonts.ready,
            new Promise((r) => safeSetTimeout(() => r(undefined), 1500)),
          ])
        : Promise.resolve();
    Promise.all([init(), fr]).then(hideBoot, hideBoot);

    return () => {
      if (proj && proj.canEdit && sig() !== savedSig) {
        saveProject(false);
      }
      disposed = true;
      if (pollIntervalId) window.clearInterval(pollIntervalId);
      if (raf) cancelAnimationFrame(raf);
      activeTimers.forEach((id) => window.clearTimeout(id));
      activeTimers.clear();
      modalCleanupFns.forEach((fn) => fn());
      modalCleanupFns.clear();
      if (activePrintCleanup) activePrintCleanup();
      window.removeEventListener('hashchange', route);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerdown', onPointerDownRipple);
      activeObjectUrls.forEach((u) => URL.revokeObjectURL(u));
      activeObjectUrls.clear();
    };
  }, []);

  return (
    <div ref={rootRef} className="fotowe-fullscreen-shell">
      <div className="app">
        <header>
          <a
            className="back-laporanwe"
            href="/Aplikasi"
            aria-label="Kembali ke aplikasi LaporanWe"
            title="Kembali ke aplikasi LaporanWe"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span className="back-label">Kembali ke LaporanWe</span>
          </a>
          <button type="button" className="logo" id="lg">
            fotowe<b>.</b>
          </button>
          <span id="hd">Studio Pas Foto Digital</span>
          <span id="hr">Shared Workspace</span>
        </header>

        <section id="home">
          <div className="hero">
            <div className="lbl" style={{ marginTop: 0 }}>
              FOTOWE
            </div>
            <h1>
              Studio Pas Foto
              <br />
              Digital
            </h1>
            <p className="desc">
              Pilih ukuran kertas dan template pas foto sesuai kebutuhan cetak Anda.
            </p>
            <div className="lbl">Ukuran foto</div>
            <div className="row" id="hs" />
          </div>
          <div id="pj" hidden style={{ marginBottom: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className="lbl" style={{ margin: 0 }}>
                Workspace Project Tersimpan
              </div>
              <button
                type="button"
                className="b"
                id="pjRef"
                style={{ height: 30, fontSize: 11, padding: '0 12px' }}
              >
                Segarkan
              </button>
            </div>
            <div id="pjState" className="td" style={{ marginBottom: 10 }} hidden />
            <div className="grid" id="pl" />
          </div>
          <div className="lbl" style={{ marginTop: 0 }}>
            Template baru
          </div>
          <div className="grid" id="tg" />
        </section>

        <section id="editor" hidden>
          <div className="ed">
            <div className="side">
              <button type="button" className="b" id="bk">
                ← Kembali ke Home
              </button>
              <div className="lbl">Ukuran foto</div>
              <div className="row" id="es" />
              <input id="file" type="file" accept="image/*" multiple hidden />
              <div className="row" style={{ marginTop: 20 }}>
                <button type="button" className="pill" id="up">
                  Upload Foto
                </button>
                <button type="button" className="b" id="del">
                  Hapus Foto
                </button>
                <button type="button" className="b" id="dup">
                  Duplikat Foto
                </button>
                <button type="button" className="b" id="delsel" title="Delete / Backspace">
                  Hapus Pilihan
                </button>
              </div>
              <p className="note" id="msg" aria-live="polite" />
              <div className="lbl">
                Slot aktif: <b id="sel">–</b>
              </div>
              <div className="row">
                <button type="button" className="b" id="zi">
                  ＋ Zoom
                </button>
                <button type="button" className="b" id="zo">
                  － Zoom
                </button>
              </div>
              <div className="lbl">Geser gambar</div>
              <div className="pad">
                <span />
                <button type="button" className="b" data-m="0,-1" title="Atas">
                  ↑
                </button>
                <span />
                <button type="button" className="b" data-m="-1,0" title="Kiri">
                  ←
                </button>
                <button
                  type="button"
                  className="b"
                  id="rs"
                  title="Reset"
                  style={{ fontSize: 12 }}
                >
                  ⟲
                </button>
                <button type="button" className="b" data-m="1,0" title="Kanan">
                  →
                </button>
                <span />
                <button type="button" className="b" data-m="0,1" title="Bawah">
                  ↓
                </button>
                <span />
              </div>
              <div className="lbl">Export</div>
              <div className="row">
                <button type="button" className="pill" id="dl">
                  Download PNG
                </button>
                <button type="button" className="b" id="pr">
                  Print
                </button>
                <button type="button" className="b" id="dla">
                  Export All (ZIP)
                </button>
              </div>
              <div className="lbl">Project</div>
              <div className="row" style={{ alignItems: 'center' }}>
                <button type="button" className="b" id="sv" title="Ctrl + S">
                  Save Project
                </button>
                <button type="button" className="b" id="shr" title="Kelola izin editor" hidden>
                  Izin Akses
                </button>
                <span
                  id="svs"
                  style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 600 }}
                />
              </div>
              <dl className="info" id="inf" />
            </div>

            <div className="main">
              <div className="stage">
                <div className="paper" id="pp">
                  <canvas id="c" />
                </div>
              </div>
              <div className="strip">
                <div className="sa">
                  <button type="button" className="b" id="abAdd">
                    ＋ Artboard
                  </button>
                  <button type="button" className="b" id="abDup">
                    Duplicate Artboard
                  </button>
                  <button type="button" className="b" id="abRen">
                    Ganti Nama
                  </button>
                  <button type="button" className="b" id="abDel">
                    Hapus Artboard
                  </button>
                </div>
                <div className="abl" id="abl" />
              </div>
            </div>
          </div>

          <footer>
            <span id="ft">Template</span>
            <span id="cnt">00 / 00</span>
            <span>Klik slot · Shift + klik pilih banyak · seret untuk menggeser</span>
          </footer>
        </section>
      </div>

      <div id="boot">
        <div className="bl">
          fotowe<b>.</b>
        </div>
        <div className="bar">
          <i />
        </div>
      </div>

      <div id="toasts" role="status" aria-live="polite" />
    </div>
  );
};

export default FotoweFullscreenView;
