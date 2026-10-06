/* Shared logic for the Abadis savings calculator designs: formulas, rolling digits, scroll engine, theme. Plain JS, no build. */
(() => {
  'use strict';
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const A = { reduced: rmQuery.matches };
  if (rmQuery.addEventListener) rmQuery.addEventListener('change', (e) => { A.reduced = e.matches; });

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fa = (n) => Math.round(n).toLocaleString('fa-IR');
  const fa1 = (x) => x.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
  function readableToman(t) {
    if (t >= 1e12) return fa1(t / 1e12) + ' هزار میلیارد تومان';
    if (t >= 1e9) return fa1(t / 1e9) + ' میلیارد تومان';
    if (t >= 1e6) return fa1(t / 1e6) + ' میلیون تومان';
    return fa(t) + ' تومان';
  }
  Object.assign(A, { clamp, fa, fa1, readableToman });

  /* formulas exactly as on the live abadis-med.com calculator */
  const F = {
    surgery: ({ n }) => ({ water: n * 1.6 * 9.3, cost: n * 2.5 * 85000, hours: n * 1.7 / 60 * 2.2 * 7.1 }),
    beds: ({ a, b }) => ({
      water: ((a * 254) + (b * 67)) * 1.6 * 9.3,
      cost: ((a * 200) + (b * 50)) * 2.5 * 85000,
      hours: ((a * 254) + (b * 67)) * 1.7 * 2.2 * 7.1 / 60,
    }),
  };
  A.F = F; window.ABADIS_FORMULAS = F;

  /* rolling-digit odometer (Kalameh FaNum Black advances; 1.2em cell; clipping window wider than column) */
  const DIGIT_ADV = [0.473, 0.264, 0.507, 0.705, 0.621, 0.768, 0.573, 0.641, 0.641, 0.526];
  const CELL_EM = 1.2, COL_PAD = 0.02;
  class Odo {
    constructor(el, digits) {
      this.el = el; this.digits = digits; this.cols = []; this.seps = []; this.v = -1;
      const frag = document.createDocumentFragment();
      for (let i = digits - 1; i >= 0; i--) {
        const col = document.createElement('span'); col.className = 'odo-col'; col.setAttribute('aria-hidden', 'true');
        const win = document.createElement('span'); win.className = 'odo-win';
        const strip = document.createElement('span'); strip.className = 'odo-strip';
        for (let d = 0; d < 10; d++) { const s = document.createElement('span'); s.textContent = FA_DIGITS[d]; strip.appendChild(s); }
        win.appendChild(strip); col.appendChild(win); frag.appendChild(col);
        this.cols[i] = { col, strip, d: -1, off: null, w: '' };
        if (i > 0 && i % 3 === 0) {
          const sep = document.createElement('span'); sep.className = 'odo-sep'; sep.textContent = '٬'; sep.setAttribute('aria-hidden', 'true');
          frag.appendChild(sep); this.seps[i] = { el: sep, off: null };
        }
      }
      this.sr = document.createElement('span'); this.sr.className = 'sr-only';
      el.textContent = ''; el.appendChild(frag); el.appendChild(this.sr);
      this.set(0);
    }
    set(v) {
      v = Math.max(0, Math.round(v));
      if (v === this.v) return;
      this.v = v;
      const s = String(v), len = s.length;
      for (let i = 0; i < this.digits; i++) {
        const c = this.cols[i];
        const d = i < len ? s.charCodeAt(len - 1 - i) - 48 : 0;
        const off = i >= len && i > 0;
        if (d !== c.d) { c.d = d; c.strip.style.transform = 'translateY(' + (-d * CELL_EM).toFixed(2) + 'em)'; }
        if (off !== c.off) { c.off = off; c.col.classList.toggle('off', off); }
        const w = off ? '0em' : (DIGIT_ADV[d] + COL_PAD).toFixed(3) + 'em';
        if (w !== c.w) { c.w = w; c.col.style.width = w; }
        const sp = this.seps[i];
        if (sp) { const so = len <= i; if (so !== sp.off) { sp.off = so; sp.el.classList.toggle('off', so); } }
      }
      this.el.dataset.value = String(v);
      this.sr.textContent = fa(v);
    }
    shown() { let s = ''; for (let i = this.digits - 1; i >= 0; i--) { const c = this.cols[i]; if (!c.off) s += FA_DIGITS[c.d]; if (this.seps[i] && !this.seps[i].off) s += '٬'; } return s; }
  }
  A.Odo = Odo;
  A.visCurve = (f) => (f > 0 ? Math.max(0.035, Math.pow(clamp(f, 0, 1), 0.6)) : 0);

  /* scroll helpers */
  function progressOf(track) {
    const r = track.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  }
  function detent(v, presets, w) {
    for (const P of presets) { const d = v - P; if (Math.abs(d) < w) return P + d * Math.abs(d) / w; }
    return v;
  }
  function rawValue(inp, p) {
    const t = clamp((p - inp.r0) / (inp.r1 - inp.r0), 0, 1);
    const v = detent(t * inp.max, inp.presets, inp.w);
    return clamp(Math.round(v / inp.step) * inp.step, 0, inp.max);
  }
  const auto = { until: 0, y: null };
  function scrollToProgress(track, p) {
    const r = track.getBoundingClientRect();
    const y = Math.round(window.scrollY + r.top + p * (r.height - window.innerHeight)) + 1;
    auto.until = performance.now() + 3000; auto.y = y;
    window.scrollTo({ top: y, behavior: A.reduced ? 'auto' : 'smooth' });
  }
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { auto.until = 0; }, { passive: true }));
  const autoActive = () => {
    if (!auto.until) return false;
    if (performance.now() > auto.until || Math.abs(window.scrollY - auto.y) < 4) { auto.until = 0; return false; }
    return true;
  };
  Object.assign(A, { progressOf, rawValue, scrollToProgress, autoActive });

  /* input definitions (same as the main design) */
  const PRE_BEDS = [10, 20, 50, 100, 200, 300, 500];
  const IN = {
    n: { key: 'n', max: 30000, step: 100, r0: 0.04, r1: 0.94, presets: [1000, 5000, 10000, 15000, 20000, 25000], w: 900 },
    a: { key: 'a', max: 700, step: 1, r0: 0.03, r1: 0.47, presets: PRE_BEDS, w: 7 },
    b: { key: 'b', max: 700, step: 1, r0: 0.53, r1: 0.95, presets: PRE_BEDS, w: 7 },
  };
  A.IN = IN;

  /* calculator engine: section#calcX > .calc-track > .calc-pin; [data-odo] counters; chips [data-n] or [data-a][data-b]; optional [data-confirm] */
  const calcs = [];
  let lastScroll = 0, idleTimer = 0;
  function createCalc(root, kind, render) {
    const track = root.querySelector('.calc-track');
    const inputs = kind === 'surgery' ? [IN.n] : [IN.a, IN.b];
    const odos = {}, odoList = [];
    root.querySelectorAll('[data-odo]').forEach((el) => {
      const o = new Odo(el, +el.dataset.digits || 6); odoList.push([el.dataset.odo, o]);
      if (!odos[el.dataset.odo]) odos[el.dataset.odo] = o;
    });
    const chips = [...root.querySelectorAll('.chip')];
    const confirmBtn = root.querySelector('[data-confirm]');
    const shown = {}, target = {}, disp = {};
    inputs.forEach((inp) => { shown[inp.key] = 0; target[inp.key] = 0; disp[inp.key] = -1; });
    const state = { phase: kind === 'surgery' ? 'n' : 'a', lockedA: null, pendingUnlock: false, mode: '' };
    const api = { root, track, kind, disp, odos, state, inputs };
    let lastSig = '';

    function targets(p) {
      if (kind === 'surgery') { target.n = rawValue(IN.n, p); return; }
      const rawA = rawValue(IN.a, p), rawB = rawValue(IN.b, p);
      state.phase = p < (IN.a.r1 + IN.b.r0) / 2 ? 'a' : 'b';
      if (state.lockedA != null && !autoActive() && (rawA < state.lockedA || state.pendingUnlock)) { state.lockedA = null; state.pendingUnlock = false; }
      target.a = state.lockedA != null ? state.lockedA : rawA;
      target.b = rawB;
    }
    function confirmMode() {
      if (!confirmBtn || kind === 'surgery') return '';
      if (state.phase === 'a' && state.lockedA == null && disp.a > 0 && disp.a < 700) return 'confirm';
      if (state.phase === 'a' && state.lockedA != null && !autoActive()) return 'release';
      if (state.phase === 'b' && state.lockedA != null && !state.pendingUnlock) return 'edit';
      return '';
    }
    api.update = (dt, force) => {
      const now = performance.now();
      const p = progressOf(track);
      targets(p);
      const k = A.reduced || force ? 1 : 1 - Math.exp(-dt / 110);
      let busy = false, changed = !!force;
      inputs.forEach((inp) => {
        const key = inp.key;
        let s = shown[key] + (target[key] - shown[key]) * k;
        if (Math.abs(target[key] - s) < inp.step * 0.5) s = target[key]; else busy = true;
        shown[key] = s;
        const d = clamp(Math.round(s / inp.step) * inp.step, 0, inp.max);
        if (d !== disp[key]) { disp[key] = d; changed = true; }
      });
      const end = p >= inputs[inputs.length - 1].r1 - 0.001;
      const settled = !busy && now - lastScroll > 480;
      state.mode = confirmMode();
      const sig = [state.phase, state.lockedA, state.pendingUnlock, state.mode, end, settled, Math.floor(p * 400)].join('|');
      if (sig !== lastSig) { lastSig = sig; changed = true; }
      if (changed) {
        const out = kind === 'surgery' ? F.surgery(disp) : F.beds(disp);
        const W = Math.round(out.water), C = Math.round(out.cost), H = Math.round(out.hours);
        const vals = { n: disp.n, a: disp.a, b: disp.b, water: W, cost: C, hours: H };
        odoList.forEach(([key, o]) => { if (vals[key] != null) o.set(vals[key]); });
        const fr = kind === 'surgery'
          ? { water: disp.n / 30000, cost: disp.n / 30000, hours: disp.n / 30000, input: disp.n / 30000 }
          : { water: (disp.a * 254 + disp.b * 67) / (321 * 700), cost: (disp.a * 200 + disp.b * 50) / (250 * 700), hours: (disp.a * 254 + disp.b * 67) / (321 * 700), a: disp.a / 700, b: disp.b / 700 };
        chips.forEach((c) => c.classList.toggle('on', c.dataset.n != null ? +c.dataset.n === disp.n : (+c.dataset.a === disp.a && +c.dataset.b === disp.b)));
        if (confirmBtn) {
          confirmBtn.hidden = !state.mode; confirmBtn.dataset.mode = state.mode;
          if (state.mode === 'confirm') confirmBtn.textContent = 'ثبت ' + fa(disp.a) + ' تخت اتاق عمل و رفتن به مرحله ۲ ←';
          else if (state.mode === 'release') confirmBtn.textContent = 'تنظیم دوباره تخت اتاق عمل با اسکرول';
          else if (state.mode === 'edit') confirmBtn.textContent = '↑ تغییر تعداد تخت اتاق عمل';
        }
        render && render({ disp, W, C, H, fr, p, end, settled, started: p > 0.002, phase: state.phase, lockedA: state.lockedA, api });
      }
      return busy;
    };
    /* chips */
    chips.forEach((c) => c.addEventListener('click', () => {
      if (c.dataset.n != null) {
        const P = +c.dataset.n;
        scrollToProgress(track, IN.n.r0 + (P / IN.n.max) * (IN.n.r1 - IN.n.r0));
      } else {
        const a = +c.dataset.a, b = +c.dataset.b;
        state.lockedA = a < 700 ? a : null; state.pendingUnlock = false;
        scrollToProgress(track, IN.b.r0 + (b / IN.b.max) * (IN.b.r1 - IN.b.r0));
      }
      kick();
    }));
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      const mode = confirmBtn.dataset.mode;
      if (mode === 'confirm') { state.lockedA = disp.a; scrollToProgress(track, IN.b.r0); }
      else if (mode === 'release') { state.lockedA = null; }
      else if (mode === 'edit' && state.lockedA != null) {
        state.pendingUnlock = true;
        scrollToProgress(track, IN.a.r0 + (state.lockedA / IN.a.max) * (IN.a.r1 - IN.a.r0));
      }
      kick();
    });
    calcs.push(api);
    return api;
  }
  A.createCalc = createCalc;

  let raf = 0, last = performance.now();
  function tick(now) {
    raf = 0;
    const dt = Math.min(64, Math.max(0, now - last)); last = now;
    let busy = autoActive();
    calcs.forEach((c) => { busy = c.update(dt) || busy; });
    if (busy) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  A.kick = kick;
  window.addEventListener('scroll', () => { lastScroll = performance.now(); clearTimeout(idleTimer); idleTimer = setTimeout(kick, 520); kick(); }, { passive: true });
  window.addEventListener('resize', kick);

  /* start: call after all createCalc() */
  A.start = () => {
    window.ABADIS_CALCS = {};
    calcs.forEach((c) => { if (c.root.id) window.ABADIS_CALCS[c.root.id] = c; });
    document.documentElement.classList.add('no-anim');
    calcs.forEach((c) => c.update(0, true));
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('no-anim')));
  };

  /* header + anchors */
  const header = document.getElementById('header');
  if (header) { const onS = () => header.classList.toggle('scrolled', window.scrollY > 50); window.addEventListener('scroll', onS, { passive: true }); onS(); }
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: A.reduced ? 'auto' : 'smooth', block: 'start' }); }
  }));

  /* light / night mode (same key as the main design, so the choice carries across pages) */
  (() => {
    const KEY = 'abadis-theme', root = document.documentElement;
    const btn = document.getElementById('themeToggle');
    const meta = document.querySelector('meta[name="theme-color"]');
    const sys = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const saved = () => { try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; } };
    let tmr = 0;
    function apply(theme, animate) {
      if (animate && !A.reduced) { root.classList.add('theme-anim'); clearTimeout(tmr); tmr = setTimeout(() => root.classList.remove('theme-anim'), 520); }
      root.setAttribute('data-theme', theme);
      const dark = theme === 'dark';
      if (meta) meta.setAttribute('content', dark ? '#071d20' : '#e8f3f3');
      if (btn) { const l = dark ? 'حالت روز' : 'حالت شب'; btn.setAttribute('aria-label', l); btn.title = l; btn.setAttribute('aria-pressed', String(dark)); }
      document.dispatchEvent(new CustomEvent('abadis-theme', { detail: theme }));
    }
    apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
    if (btn) btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next, true);
    });
    const onSys = (e) => { if (!saved()) apply(e.matches ? 'dark' : 'light', true); };
    if (sys) { if (sys.addEventListener) sys.addEventListener('change', onSys); else if (sys.addListener) sys.addListener(onSys); }
  })();

  window.Abadis = A;
})();
