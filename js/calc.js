/* Abadis savings calculator — scroll-driven inputs, plain JS + rAF */
(() => {
  'use strict';
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = rmQuery.matches;
  if (rmQuery.addEventListener) rmQuery.addEventListener('change', (e) => { reduced = e.matches; });

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

  /* ---------- formulas (exactly as on the live abadis-med.com calculator) ---------- */
  const F = {
    surgery: ({ n }) => ({
      water: n * 1.6 * 9.3,
      cost: n * 2.5 * 85000,
      hours: n * 1.7 / 60 * 2.2 * 7.1,
    }),
    beds: ({ a, b }) => ({
      water: ((a * 254) + (b * 67)) * 1.6 * 9.3,
      cost: ((a * 200) + (b * 50)) * 2.5 * 85000,
      hours: ((a * 254) + (b * 67)) * 1.7 * 2.2 * 7.1 / 60,
    }),
  };
  window.ABADIS_FORMULAS = F; // exposed for verification

  /* ---------- rolling-digit odometer ---------- */
  /* advance widths (em) of Persian digits ۰-۹ in Kalameh FaNum Black, measured from the font file */
  const DIGIT_ADV = [0.473, 0.264, 0.507, 0.705, 0.621, 0.768, 0.573, 0.641, 0.641, 0.526];
  const CELL_EM = 1.2, COL_PAD = 0.02;
  class Odo {
    constructor(el, digits) {
      this.el = el; this.digits = digits; this.cols = []; this.seps = []; this.v = -1;
      const frag = document.createDocumentFragment();
      for (let i = digits - 1; i >= 0; i--) {
        const col = document.createElement('span'); col.className = 'odo-col'; col.setAttribute('aria-hidden', 'true');
        const strip = document.createElement('span'); strip.className = 'odo-strip';
        for (let d = 0; d < 10; d++) { const s = document.createElement('span'); s.textContent = FA_DIGITS[d]; strip.appendChild(s); }
        const win = document.createElement('span'); win.className = 'odo-win';
        win.appendChild(strip); col.appendChild(win); frag.appendChild(col);
        this.cols[i] = { col, strip, d: -1, off: null };
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
    /* what is visually shown once transitions settle (for verification) */
    shown() { let s = ''; for (let i = this.digits - 1; i >= 0; i--) { const c = this.cols[i]; if (!c.off) s += FA_DIGITS[c.d]; if (this.seps[i] && !this.seps[i].off) s += '٬'; } return s; }
  }

  /* ---------- visuals ---------- */
  let uid = 0;
  function buildTank(host) {
    const id = 'tk' + (++uid);
    let wave = 'M-60 0';
    for (let x = -60; x < 240; x += 30) wave += ' q7.5 -4.5 15 0 t15 0';
    wave += ' V220 H-60 Z';
    let ticks = '';
    for (let y = 48, k = 0; y <= 200; y += 19, k++) ticks += '<line x1="' + (k % 2 ? 98 : 92) + '" y1="' + y + '" x2="106" y2="' + y + '"/>';
    host.innerHTML =
      '<svg class="tank" viewBox="0 0 120 220" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fdcdd"/><stop offset="1" stop-color="#05686b"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><rect x="14" y="32" width="92" height="180" rx="14"/></clipPath></defs>' +
      '<rect class="lid" x="32" y="3" width="56" height="12" rx="4"/><rect class="lid" x="22" y="14" width="76" height="12" rx="5" opacity=".85"/>' +
      '<rect class="glass" x="12" y="30" width="96" height="184" rx="16"/>' +
      '<g clip-path="url(#' + id + 'c)"><g class="water" style="transform:translateY(214px)">' +
      '<path class="wave2" d="' + wave + '" fill="#2ec4c6" transform="translate(0,-3)"/>' +
      '<path class="wave" d="' + wave + '" fill="url(#' + id + 'g)"/>' +
      '</g></g>' +
      '<g class="ticks">' + ticks + '</g>' +
      '<rect class="shine" x="22" y="42" width="6" height="150" rx="3"/>' +
      '</svg>';
    const water = host.querySelector('.water');
    let last = -1;
    return (f) => {
      const y = f > 0 ? 212 - f * 178 : 222;
      const r = Math.round(y * 10) / 10;
      if (r !== last) { last = r; water.style.transform = 'translateY(' + r + 'px)'; }
    };
  }
  /* stylised banknote stacks: two bundles of 14 notes, front bundle fills first */
  const PER_STACK = 14, STACKS = 2, NOTES = PER_STACK * STACKS, NOTE_STEP = 4.5;
  function buildMoney(host) {
    const box = document.createElement('div'); box.className = 'money-box'; box.setAttribute('aria-hidden', 'true');
    const wrap = document.createElement('div'); wrap.className = 'money'; box.appendChild(wrap);
    const list = [], stacks = [];
    for (let s = 0; s < STACKS; s++) {
      const st = document.createElement('div'); st.className = 'stack stack-' + s;
      st.innerHTML = '<div class="stack-shadow"></div>';
      for (let l = 0; l < PER_STACK; l++) {
        const b = document.createElement('div'); b.className = 'bill';
        b.style.bottom = (l * NOTE_STEP) + 'px';
        b.style.left = (((l * 37) % 5) - 2) + 'px'; /* slight deterministic jitter so edges read as separate notes */
        b.innerHTML = '<div class="note"><i></i><b>تومان</b>' + (l === PER_STACK - 1 ? '<u></u>' : '') + '</div>';
        st.appendChild(b); list.push(b);
      }
      wrap.appendChild(st); stacks.push(st);
    }
    host.appendChild(box);
    let last = -1;
    return (f) => {
      const n = f > 0 ? Math.max(1, Math.round(f * NOTES)) : 0;
      if (n === last) return; last = n;
      list.forEach((b, i) => b.classList.toggle('on', i < n));
      stacks.forEach((st, s) => st.classList.toggle('has', n > s * PER_STACK));
    };
  }
  const PEOPLE = 10;
  function buildPeople(host) {
    const wrap = document.createElement('div'); wrap.className = 'people'; wrap.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let i = 0; i < PEOPLE; i++) html += '<svg class="person" viewBox="0 0 24 34"><use href="#i-person"/></svg>';
    wrap.innerHTML = html; host.appendChild(wrap);
    const list = [...wrap.children];
    let last = -1;
    return (f) => {
      const n = f > 0 ? Math.max(1, Math.ceil(f * PEOPLE - 0.001)) : 0;
      if (n === last) return; last = n;
      list.forEach((p, i) => p.classList.toggle('on', i < n));
    };
  }
  const visCurve = (f) => (f > 0 ? Math.max(0.035, Math.pow(clamp(f, 0, 1), 0.6)) : 0);

  /* ---------- scroll helpers ---------- */
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
    window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { auto.until = 0; }, { passive: true }));
  const autoActive = () => {
    if (!auto.until) return false;
    if (performance.now() > auto.until || Math.abs(window.scrollY - auto.y) < 4) { auto.until = 0; return false; }
    return true;
  };

  /* ---------- calculator engine ---------- */
  function makeCalc(root, cfg) {
    const track = root.querySelector('.calc-track');
    const odos = {};
    root.querySelectorAll('[data-odo]').forEach((el) => { odos[el.dataset.odo] = new Odo(el, +el.dataset.digits || 6); });
    const vis = {
      tank: buildTank(root.querySelector('[data-vis="tank"]')),
      money: buildMoney(root.querySelector('[data-vis="money"]')),
      people: buildPeople(root.querySelector('[data-vis="people"]')),
    };
    const subs = {};
    root.querySelectorAll('[data-sub]').forEach((el) => { subs[el.dataset.sub] = el; });
    const sumEl = root.querySelector('[data-sum]');
    const sumBox = root.querySelector('.calc-sum');
    const progs = {};
    root.querySelectorAll('[data-prog]').forEach((el) => { progs[el.dataset.prog] = el; });
    const chips = [...root.querySelectorAll('.chip')];
    const shown = {}, target = {}, disp = {};
    cfg.inputs.forEach((inp) => { shown[inp.key] = 0; target[inp.key] = 0; disp[inp.key] = -1; });
    const api = { root, track, cfg, disp, odos, state: { lockedA: null, phase: 'a' } };
    let lastSig = '', endState = null;

    function render() {
      const out = cfg.formula(disp);
      odos.water.set(out.water); odos.cost.set(out.cost); odos.hours.set(out.hours);
      cfg.inputs.forEach((inp) => {
        odos[inp.key].set(disp[inp.key]);
        if (progs[inp.key]) progs[inp.key].style.transform = 'scaleX(' + (disp[inp.key] / inp.max).toFixed(4) + ')';
      });
      const fr = cfg.fractions(disp);
      vis.tank(visCurve(fr.water)); vis.money(visCurve(fr.cost)); vis.people(visCurve(fr.hours));
      const W = Math.round(out.water), C = Math.round(out.cost), H = Math.round(out.hours);
      subs.tubs.innerHTML = W > 0 ? '≈ <b>' + fa(W / 200) + '</b> وان حمام ۲۰۰ لیتری <span class="approx">(تقریبی)</span>' : '<span class="approx">معادل وان حمام ۲۰۰ لیتری (تقریبی)</span>';
      subs.read.textContent = C >= 1e6 ? '≈ ' + readableToman(C) : '';
      subs.shifts.innerHTML = H > 0 ? '≈ <b>' + fa(H / 8) + '</b> شیفت کاری ۸ ساعته' : '<span class="approx">معادل شیفت کاری ۸ ساعته</span>';
      sumEl.innerHTML = cfg.summary(disp, W, C, H);
      chips.forEach((c) => c.classList.toggle('on', cfg.chipMatch(c, disp)));
      if (cfg.afterRender) cfg.afterRender(api);
    }

    api.update = (dt, force) => {
      const p = progressOf(track);
      cfg.targets(p, target, api);
      const k = reduced || force ? 1 : 1 - Math.exp(-dt / 110);
      let busy = false, changed = !!force;
      cfg.inputs.forEach((inp) => {
        const key = inp.key;
        let s = shown[key] + (target[key] - shown[key]) * k;
        if (Math.abs(target[key] - s) < inp.step * 0.5) s = target[key]; else busy = true;
        shown[key] = s;
        const d = clamp(Math.round(s / inp.step) * inp.step, 0, inp.max);
        if (d !== disp[key]) { disp[key] = d; changed = true; }
      });
      const sig = api.state.phase + '|' + api.state.lockedA + '|' + !!api.state.pendingUnlock + '|' + autoActive();
      if (sig !== lastSig) { lastSig = sig; changed = true; }
      if (changed) render();
      const end = p >= cfg.inputs[cfg.inputs.length - 1].r1 - 0.001;
      if (end !== endState) { endState = end; sumBox.classList.toggle('end', end); }
      return busy;
    };
    return api;
  }

  /* ---------- calculator 1: surgeries per year ---------- */
  const c1Root = document.getElementById('calc1');
  const N_IN = { key: 'n', max: 30000, step: 100, r0: 0.04, r1: 0.94, presets: [1000, 5000, 10000, 15000, 20000, 25000], w: 900 };
  const calc1 = makeCalc(c1Root, {
    inputs: [N_IN],
    formula: F.surgery,
    fractions: ({ n }) => ({ water: n / 30000, cost: n / 30000, hours: n / 30000 }),
    targets: (p, t) => { t.n = rawValue(N_IN, p); },
    chipMatch: (c, d) => +c.dataset.n === d.n,
    summary: (d, W, C, H) => d.n <= 0
      ? 'برای شروع، اسکرول کنید تا تعداد عمل جراحی در سال افزایش یابد.'
      : '<span class="sum-long">با <b>' + fa(d.n) + '</b> عمل جراحی در سال: صرفه‌جویی حدود <b>' + fa(W) + '</b> لیتر آب، <b>' + fa(C) + '</b> تومان هزینه شست‌وشو و ضدعفونی و <b>' + fa(H) + '</b> ساعت از زمان کادر درمان.</span>' +
        '<span class="sum-note">* محاسبات بر اساس فرمول‌های محاسبه‌گر فعلی آبادیس</span>',
  });
  c1Root.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    const P = +c.dataset.n;
    scrollToProgress(calc1.track, N_IN.r0 + (P / N_IN.max) * (N_IN.r1 - N_IN.r0));
  }));

  /* ---------- calculator 2: beds (two-step) ---------- */
  const c2Root = document.getElementById('calc2');
  const A_IN = { key: 'a', max: 700, step: 1, r0: 0.03, r1: 0.47, presets: [10, 20, 50, 100, 200, 300, 500], w: 7 };
  const B_IN = { key: 'b', max: 700, step: 1, r0: 0.53, r1: 0.95, presets: [10, 20, 50, 100, 200, 300, 500], w: 7 };
  const bedA = c2Root.querySelector('[data-bed="a"]'), bedB = c2Root.querySelector('[data-bed="b"]');
  const hint = c2Root.querySelector('[data-hint] span');
  const confirmBtn = c2Root.querySelector('[data-confirm]');
  const calc2 = makeCalc(c2Root, {
    inputs: [A_IN, B_IN],
    formula: F.beds,
    fractions: ({ a, b }) => ({ water: (a * 254 + b * 67) / (321 * 700), cost: (a * 200 + b * 50) / (250 * 700), hours: (a * 254 + b * 67) / (321 * 700) }),
    targets: (p, t, api) => {
      const st = api.state;
      const rawA = rawValue(A_IN, p), rawB = rawValue(B_IN, p);
      st.phase = p < (A_IN.r1 + B_IN.r0) / 2 ? 'a' : 'b';
      /* a chosen value (chip / confirm) holds until the user scrolls back above it */
      if (st.lockedA != null && !autoActive() && (rawA < st.lockedA || st.pendingUnlock)) { st.lockedA = null; st.pendingUnlock = false; }
      t.a = st.lockedA != null ? st.lockedA : rawA;
      t.b = rawB;
    },
    chipMatch: (c, d) => +c.dataset.a === d.a && +c.dataset.b === d.b,
    summary: (d, W, C, H) => (d.a + d.b) <= 0
      ? 'برای شروع، اسکرول کنید تا تعداد تخت اتاق عمل افزایش یابد.'
      : '<span class="sum-long">با <b>' + fa(d.a) + '</b> تخت اتاق عمل و <b>' + fa(d.b) + '</b> تخت ICU|CCU: صرفه‌جویی حدود <b>' + fa(W) + '</b> لیتر آب، <b>' + fa(C) + '</b> تومان هزینه شست‌وشو و ضدعفونی و <b>' + fa(H) + '</b> ساعت از زمان کادر درمان.</span>' +
        '<span class="sum-note">* محاسبات بر اساس فرمول‌های محاسبه‌گر فعلی آبادیس</span>',
    afterRender: (api) => {
      const st = api.state, d = api.disp;
      bedA.classList.toggle('active', st.phase === 'a');
      bedB.classList.toggle('active', st.phase === 'b');
      bedA.classList.toggle('held', st.phase === 'b' || st.lockedA != null);
      hint.textContent = st.phase === 'a'
        ? 'مرحله ۱: با اسکرول، تعداد تخت اتاق عمل را تنظیم کنید'
        : 'مرحله ۲: با اسکرول، تعداد تخت ICU|CCU را تنظیم کنید';
      let mode = '';
      if (st.phase === 'a' && st.lockedA == null && d.a > 0 && d.a < 700) mode = 'confirm';
      else if (st.phase === 'a' && st.lockedA != null && !autoActive()) mode = 'release';
      else if (st.phase === 'b' && st.lockedA != null && !st.pendingUnlock) mode = 'edit';
      confirmBtn.hidden = !mode;
      confirmBtn.dataset.mode = mode;
      if (mode === 'confirm') confirmBtn.textContent = 'ثبت ' + fa(d.a) + ' تخت اتاق عمل و رفتن به مرحله ۲ ←';
      else if (mode === 'release') { confirmBtn.textContent = 'تنظیم دوباره تخت اتاق عمل با اسکرول'; hint.textContent = 'تخت اتاق عمل روی ' + fa(st.lockedA) + ' ثابت است؛ برای تغییر، دکمه زیر را بزنید'; }
      else if (mode === 'edit') confirmBtn.textContent = '↑ تغییر تعداد تخت اتاق عمل';
    },
  });
  c2Root.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
    const A = +c.dataset.a, B = +c.dataset.b;
    calc2.state.lockedA = A < 700 ? A : null; calc2.state.pendingUnlock = false;
    scrollToProgress(calc2.track, B_IN.r0 + (B / B_IN.max) * (B_IN.r1 - B_IN.r0));
    kick();
  }));
  confirmBtn.addEventListener('click', () => {
    const st = calc2.state, mode = confirmBtn.dataset.mode;
    if (mode === 'confirm') {
      st.lockedA = calc2.disp.a;
      scrollToProgress(calc2.track, B_IN.r0);
    } else if (mode === 'release') {
      st.lockedA = null;
    } else if (mode === 'edit' && st.lockedA != null) {
      st.pendingUnlock = true; /* keep holding during the scroll-back, then hand control to the scroll */
      scrollToProgress(calc2.track, A_IN.r0 + (st.lockedA / A_IN.max) * (A_IN.r1 - A_IN.r0));
    }
    kick();
  });

  /* ---------- loop ---------- */
  const calcs = [calc1, calc2];
  window.ABADIS_CALCS = { calc1, calc2 };
  let raf = 0, last = performance.now();
  function tick(now) {
    raf = 0;
    const dt = Math.min(64, Math.max(0, now - last)); last = now;
    let busy = autoActive();
    calcs.forEach((c) => { busy = c.update(dt) || busy; });
    if (busy) kick();
  }
  function kick() { if (!raf) { raf = requestAnimationFrame(tick); } }
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);

  document.documentElement.classList.add('no-anim');
  calcs.forEach((c) => c.update(0, true));
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('no-anim')));

  /* ---------- template header + anchors ---------- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
    });
  });

  /* ---------- light / night mode ---------- */
  (() => {
    const KEY = 'abadis-theme';
    const root = document.documentElement;
    const btn = document.getElementById('themeToggle');
    const meta = document.querySelector('meta[name="theme-color"]');
    const sys = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const saved = () => { try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; } };
    let animTimer = 0;
    function apply(theme, animate) {
      if (animate && !reduced) {
        root.classList.add('theme-anim');
        clearTimeout(animTimer);
        animTimer = setTimeout(() => root.classList.remove('theme-anim'), 520);
      }
      root.setAttribute('data-theme', theme);
      const dark = theme === 'dark';
      if (meta) meta.setAttribute('content', dark ? '#071d20' : '#e8f3f3');
      if (btn) {
        const label = dark ? 'حالت روز' : 'حالت شب';
        btn.setAttribute('aria-label', label); btn.title = label;
        btn.setAttribute('aria-pressed', String(dark));
      }
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
})();
