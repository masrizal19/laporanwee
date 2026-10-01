/* ==========================================================================
   LaporanWee — Motion Layer (JS)
   Menambahkan animasi halus tanpa mengubah kode aplikasi:
   - transisi masuk saat pindah halaman / dashboard / tab
   - reveal bertahap (stagger) untuk kartu, panel, grafik
   - pop untuk modal, dropdown, toast + fade untuk backdrop
   - ripple klik, count-up angka, bar progres saat navigasi
   Semua selector bisa diganti lewat window.LW_MOTION (sebelum script ini).
   Tandai elemen yang tidak ingin dianimasikan dengan data-motion="none".
   ========================================================================== */
(() => {
  'use strict';
  if (typeof window === 'undefined' || window.__lwMotion) return;
  window.__lwMotion = true;

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  if (mq && mq.matches) return; // hormati preferensi pengguna

  const cfg = Object.assign({
    // elemen yang di-reveal bertahap saat muncul
    reveal: '[data-motion~="reveal"], [class*="card"], [class*="panel"], [class*="widget"], [class*="tile"], ' +
            '[class*="kpi"], [class*="metric"], [class*="stat-"], [class*="-stat"], [class*="chart"], ' +
            '[class*="hero"] > *, [class*="grid"] > *, table, form',
    // container halaman/dashboard (dipakai saat URL berubah). Grup pertama yang cocok dipakai.
    viewRoots: ['[data-view]', 'main', '[role="main"]', '.page', '.view', '.main-content', '.content'],
    // panel yang tampil/sembunyi (tab, dashboard bergantian)
    panels: '[role="tabpanel"], .tab-pane, [data-view], [data-page], [data-panel], .page, .view, .screen',
    // induk tempat halaman baru biasanya dipasang oleh router
    swapParents: '#app, #root, #__next, main, [role="main"], [data-view]',
    overlays: '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"], ' +
              '[role="tooltip"], [class*="modal"], [class*="popover"], [class*="dropdown-menu"], ' +
              '[class*="dropdown-content"], [class*="toast"], [class*="snackbar"]',
    backdrops: '[class*="backdrop"], [class*="overlay"], [class*="scrim"]',
    counters: '[data-countup], [class*="stat"] [class*="value"], [class*="metric"] [class*="value"], ' +
              '[class*="kpi"] [class*="value"], [class*="stat"] [class*="number"], [class*="kpi"] [class*="number"], ' +
              '[class*="stat-chip"] .num, [class*="stat"] .num, [class*="kpi"] .num',
    rippleTargets: 'button, [role="button"], [role="tab"], [role="menuitem"], [class*="btn"], summary, ' +
                   'nav a, aside a, [class*="sidebar"] a, [class*="nav"] a',
    exclude: '[data-motion~="none"]',
    rippleMax: [420, 96],     // ripple tidak dipasang pada elemen yang lebih besar dari ini
    stagger: 50,              // ms antar elemen (30-70ms)
    maxSteps: 8,              // batas jumlah langkah stagger (max around 8 items)
    intentWindow: 2500,       // ms setelah aksi pengguna/halaman dimuat di mana elemen baru dianimasikan
    ripple: true, progressBar: true, countUp: true
  }, window.LW_MOTION || {});

  const root = document.documentElement;
  const qsa = (n, s) => (n && n.querySelectorAll ? Array.from(n.querySelectorAll(s)) : []);
  const now = () => performance.now();

  /* ---------- "Intent": animasikan hanya perubahan yang dipicu pengguna ----------
     Update latar belakang (polling, realtime, mengetik) tidak akan berkedip. */
  let intentAt = now();
  const markIntent = () => { intentAt = now(); };
  const hasIntent = () => now() - intentAt < cfg.intentWindow;
  const isTyping = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  /* ---------- Util animasi sekali jalan ---------- */
  const ownAnimation = (el) => {
    const n = getComputedStyle(el).animationName;
    return n && n !== 'none' && !/(^|,\s*)lw-/.test(n);
  };
  function play(el, cls, ms = 800) {
    if (!el || el.nodeType !== 1 || el.closest(cfg.exclude)) return;
    if (el.classList.contains(cls)) { el.classList.remove(cls); void el.offsetWidth; }
    else if (ownAnimation(el)) return; // jangan menimpa animasi bawaan situs
    el.classList.add(cls);
    setTimeout(() => el && el.classList && el.classList.remove(cls), ms);
  }
  const isVisible = (el) => {
    if (!el) return false;
    return el.checkVisibility
      ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };

  /* ---------- Reveal bertahap (offset & delay + parenting) ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    let i = 0;
    entries.filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      .forEach((e) => {
        const el = e.target;
        revealIO.unobserve(el);
        const delay = Math.min(i++, cfg.maxSteps) * cfg.stagger;
        el.style.setProperty('--lw-d', delay + 'ms');
        el.classList.add('lw-in');
        const done = () => {
          if (!el || !el.classList) return;
          el.classList.remove('lw-reveal', 'lw-in');
          el.style.removeProperty('--lw-d');
          el.removeEventListener('animationend', onEnd);
        };
        const onEnd = (ev) => { if (ev.target === el && ev.animationName === 'lw-reveal') done(); };
        el.addEventListener('animationend', onEnd);
        setTimeout(done, 1200 + delay);
      });
  }, { threshold: 0.05, rootMargin: '0px 0px -4% 0px' });

  function prepare(el) {
    if (!el || el.nodeType !== 1 || el.classList.contains('lw-reveal') || !el.matches(cfg.reveal)) return;
    if (el.closest(cfg.exclude)) return;
    const p = el.parentElement;
    if (p && (p.closest('.lw-reveal') || p.closest(cfg.overlays))) return; // hanya elemen terluar
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display === 'inline' || (cs.animationName && cs.animationName !== 'none')) return;
    el.classList.add('lw-reveal');
    revealIO.observe(el);
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    prepare(node);
    qsa(node, cfg.reveal).forEach(prepare);
    if (cfg.countUp) { prepareCounter(node); qsa(node, cfg.counters).forEach(prepareCounter); }
  }
  const replay = (node) => { if (node) { scan(node); } };

  /* ---------- Count-up angka (value change) ---------- */
  const running = new WeakSet();
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      counterIO.unobserve(e.target);
      runCounter(e.target);
    });
  }, { threshold: 0.3 });

  function parseNum(txt) {
    if (!txt) return null;
    txt = txt.trim();
    if (txt.length > 20) return null;
    // Don't animate dates, times, ids, phone numbers, or pagination
    if (/[\/-]/.test(txt) && /\d/.test(txt)) return null;
    if (/(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|oct|aug|rabu|kamis|jumat|sabtu|minggu|senin|selasa|wib|gmt)/i.test(txt)) return null;
    const m = txt.match(/^([^\d]*?)(\d[\d.,]*)([^\d]*)$/);
    if (!m) return null;
    const [, pre, num, suf] = m;
    let dec = null, th = null;
    const last = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','));
    if (last > -1) {
      const ch = num[last], other = ch === '.' ? ',' : '.';
      const count = num.split(ch).length - 1;
      if (num.includes(other)) { dec = ch; th = other; }
      else if (count > 1 || num.length - last - 1 === 3) th = ch;
      else dec = ch;
    }
    let clean = th ? num.split(th).join('') : num;
    if (dec) clean = clean.replace(dec, '.');
    const value = parseFloat(clean);
    if (!isFinite(value) || value <= 0 || value > 1e9) return null;
    return { pre, suf, value, th, dec, decimals: dec ? num.length - num.lastIndexOf(dec) - 1 : 0, text: txt };
  }

  function prepareCounter(el) {
    if (!el || el.nodeType !== 1 || !el.matches(cfg.counters) || el.children.length || el.closest(cfg.exclude)) return;
    if (running.has(el) || !parseNum(el.textContent)) return;
    counterIO.observe(el);
  }

  function runCounter(el) {
    if (!el || running.has(el)) return;
    const spec = parseNum(el.textContent);
    if (!spec) return;
    const original = el.textContent;
    running.add(el);
    const fmt = (v) => {
      const [i, d] = v.toFixed(spec.decimals).split('.');
      const grouped = spec.th ? i.replace(/\B(?=(\d{3})+(?!\d))/g, spec.th) : i;
      return spec.pre + grouped + (d ? (spec.dec || '.') + d : '') + spec.suf;
    };
    const dur = 850, t0 = now();
    const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)); // easeOutExpo
    (function tick() {
      if (!el.isConnected) { running.delete(el); return; }
      const t = Math.min((now() - t0) / dur, 1);
      el.textContent = t < 1 ? fmt(spec.value * ease(t)) : original;
      if (t < 1) requestAnimationFrame(tick); else running.delete(el);
    })();
  }

  /* ---------- Overlay: modal, dropdown, toast (overlay + obscuration) ---------- */
  function playOverlay(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches(cfg.backdrops)) {
      play(el, 'lw-fade');
      const inner = el.querySelector(cfg.overlays);
      if (inner) play(inner, 'lw-pop');
    } else if (el.matches(cfg.overlays)) {
      const outer = el.parentElement && el.parentElement.closest(cfg.overlays);
      if (outer && !outer.matches(cfg.backdrops)) return; // hanya modal terluar
      play(el, 'lw-pop');
    }
  }

  /* ---------- Pindah halaman / dashboard (dolly & zoom halus) ---------- */
  function pickViews() {
    for (const sel of cfg.viewRoots) {
      const els = qsa(document, sel).filter((e) => isVisible(e) && !e.parentElement.closest(sel));
      if (els.length) return els;
    }
    return [];
  }

  function bar() {
    if (!cfg.progressBar) return;
    let b = document.querySelector('.lw-bar');
    if (!b) { b = document.createElement('div'); b.className = 'lw-bar'; document.body.appendChild(b); }
    b.classList.remove('run'); void b.offsetWidth; b.classList.add('run');
  }

  function enterView() {
    pickViews().forEach((v) => { play(v, 'lw-view-in'); replay(v); });
    bar();
  }

  let lastHref = location.href, routeTimer;
  function routeChanged() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    markIntent();
    clearTimeout(routeTimer);
    routeTimer = setTimeout(enterView, 60);
  }
  ['pushState', 'replaceState'].forEach((k) => {
    const orig = history[k];
    history[k] = function () { const r = orig.apply(this, arguments); routeChanged(); return r; };
  });
  addEventListener('popstate', routeChanged);
  addEventListener('hashchange', routeChanged);

  /* ---------- Panel/tab/modal yang hanya di-toggle (tanpa menambah node) ---------- */
  const seen = new WeakMap();
  const toggleSel = [cfg.panels, cfg.overlays, cfg.backdrops].join(',');
  function seed(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(toggleSel)) seen.set(node, isVisible(node));
    qsa(node, toggleSel).forEach((e) => seen.set(e, isVisible(e)));
  }
  function checkToggle(el) {
    if (!el.isConnected || !el.matches(toggleSel)) return;
    const vis = isVisible(el), was = seen.get(el);
    seen.set(el, vis);
    if (!vis || was !== false) return;
    if (el.matches(cfg.overlays) || el.matches(cfg.backdrops)) playOverlay(el);
    else { play(el, 'lw-view-in'); replay(el); }
  }

  /* ---------- Observer DOM ---------- */
  const mo = new MutationObserver((muts) => {
    const toggled = new Set();
    for (const m of muts) {
      if (m.type === 'attributes') { toggled.add(m.target); continue; }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || /^(SCRIPT|STYLE|LINK|META)$/.test(n.tagName)) continue;
        if (n.classList.contains('lw-ripple') || n.classList.contains('lw-bar')) continue;
        if (n.matches(cfg.overlays) || n.matches(cfg.backdrops)) playOverlay(n);
        else if (hasIntent() && m.target.matches && m.target.matches(cfg.swapParents) &&
                 !n.matches(cfg.reveal) && n.offsetWidth > 240 && n.offsetHeight > 120) play(n, 'lw-view-in');
        seed(n);
        if (hasIntent()) scan(n);
      }
    }
    if (toggled.size) requestAnimationFrame(() => toggled.forEach(checkToggle));
  });

  /* ---------- Ripple klik ---------- */
  function ripple(e) {
    if (!cfg.ripple || e.button > 0) return;
    const t = e.target.closest && e.target.closest(cfg.rippleTargets);
    if (!t || t.disabled || t.closest(cfg.exclude) || t.matches('[aria-disabled="true"]')) return;
    const r = t.getBoundingClientRect();
    if (r.width < 8 || r.width > cfg.rippleMax[0] || r.height > cfg.rippleMax[1]) return;
    const cs = getComputedStyle(t);
    const wrap = document.createElement('span');
    wrap.className = 'lw-ripple';
    Object.assign(wrap.style, {
      left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
      borderRadius: cs.borderRadius, color: cs.color
    });
    const size = Math.hypot(r.width, r.height) * 2;
    const dot = document.createElement('i');
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    wrap.appendChild(dot);
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 600);
  }

  addEventListener('pointerdown', (e) => {
    if (!isTyping(e.target)) markIntent();
    ripple(e);
  }, { capture: true, passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'Enter' && !isTyping(e.target)) markIntent(); }, true);
  addEventListener('load', markIntent);

  /* ---------- Parallax opsional: data-parallax="0.10" ---------- */
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      document.querySelectorAll('[data-parallax]').forEach((el) => {
        const k = parseFloat(el.dataset.parallax) || 0.08;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--lw-py', ((innerHeight / 2 - (r.top + r.height / 2)) * k).toFixed(1) + 'px');
      });
    });
  }, { passive: true });

  /* ---------- Start ---------- */
  function init() {
    root.classList.add('lw-motion');
    scan(document.body);
    seed(document.body);
    mo.observe(root, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'aria-hidden', 'open']
    });
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });

  window.LWMotion = {
    replay: (t) => replay(typeof t === 'string' ? document.querySelector(t) : t || document.body),
    enterView,
    disable() { mo.disconnect(); root.classList.remove('lw-motion'); }
  };
})();
