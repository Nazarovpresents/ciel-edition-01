/* ------------------------------------------------------------------
   CIEL — Édition 01
   Scene engine v2: turntable frame sequences on a canvas.
   - drag / scroll / slider  → rotate the jacket (or the model) 360°
   - arrows / swatches / tiles → switch product (crossfade in place)
   - "See it on"              → crossfade to the on-model turntable
------------------------------------------------------------------- */
(() => {
  'use strict';

  /* ---------- Data ---------- */
  const PRODUCTS = [
    {
      id: 'celeste', name: 'Céleste', price: 179, ref: 'Ref. 0912-CEL', swatch: '#a8bfd5',
      tagline: 'Moon and fern, raised in tonal thread. The sky at the blue hour.',
      composition: 'Shell: 100% brushed cotton jacquard, 320 g. Lining: cupro. Ribbing: cotton–elastane. Zip: matte zinc, two-way.',
      care: 'Wash cold, inside out, gentle cycle. Dry flat away from direct sun. Warm iron on reverse. Do not tumble dry.',
      lowSizes: ['XL'],
    },
    {
      id: 'sable', name: 'Sable', price: 159, ref: 'Ref. 0913-SAB', swatch: '#e7e0d2',
      tagline: 'Sun-washed ivory with a soft, dry hand. Wears in, never out.',
      composition: 'Shell: 100% brushed cotton jacquard, 320 g. Lining: cupro. Ribbing: cotton–elastane. Zip: matte zinc, two-way.',
      care: 'Wash cold, inside out, gentle cycle. Dry flat away from direct sun. Warm iron on reverse. Do not tumble dry.',
      lowSizes: [],
    },
    {
      id: 'ardoise', name: 'Ardoise', price: 139, ref: 'Ref. 0914-ARD', swatch: '#7e8184',
      tagline: 'Mineral grey, cut for layered silhouettes. Quiet from any angle.',
      composition: 'Shell: 100% brushed cotton jacquard, 320 g. Lining: cupro. Ribbing: cotton–elastane. Zip: matte zinc, two-way.',
      care: 'Wash cold, inside out, gentle cycle. Dry flat away from direct sun. Warm iron on reverse. Do not tumble dry.',
      lowSizes: ['S'],
    },
  ];
  const N = PRODUCTS.length;
  const SIZES = ['S', 'M', 'L', 'XL'];
  const FRAMES = 40;                                   // frames per 360° sequence
  const VIEWS = ['rack', 'model'];
  // Two frame sets: 'std' (1440px JPEG) loads first everywhere; 'hi' (4K WebP) is layered on top
  // for large / high-density screens once it arrives.
  const SETS = { std: { dir: 'seq', ext: 'jpg' }, hi: { dir: 'seq4k', ext: 'webp' } };
  const wantHi = () => {
    const c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return false;
    return Math.min(window.devicePixelRatio || 1, 2) * window.innerWidth >= 1800;
  };
  const seqSrc = (p, v, i, set = 'std') => `assets/${SETS[set].dir}/${p.id}-${v}/${String(i).padStart(2, '0')}.${SETS[set].ext}`;
  const stillSrc = (p, v) => v === 'rack' ? `assets/img/rack-${p.id}.jpg` : `assets/img/model-${p.id}-front.jpg`;
  const money = (n) => `$${n.toFixed(2)}`;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap01 = (v) => ((v % 1) + 1) % 1;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Idle turntable: after IDLE_DELAY ms without input the figure keeps turning on its own.
  // 'loop' = continuous 360° (the sequences are seam-blended, so the loop point is invisible);
  // 'pingpong' = boomerang-style back and forth.
  const IDLE_MODE = 'pingpong';
  const IDLE_DELAY = 2600;
  const IDLE_TURN_MS = 12000;                          // one full turn every 12 s
  const FORCE_IDLE = /[?&]idle=1\b/.test(location.search);   // QA switch: idle turn even under reduced-motion / hidden tab
  // In pingpong mode the figure turns 0→360° and then back 360°→0, so it never jumps to frame 0.
  // S.pos is an unbounded position in turns; the shown angle is a triangle wave of it.
  const PING = IDLE_MODE === 'pingpong';
  const angleOf = (pos) => PING ? 1 - Math.abs((((pos % 2) + 2) % 2) - 1) : wrap01(pos);
  const frameOf = (angle) => {
    if (PING) { const f = clamp(angle, 0, 1) * (FRAMES - 1); const i0 = Math.floor(f); return { i0, i1: Math.min(i0 + 1, FRAMES - 1), frac: f - i0 }; }
    const f = wrap01(angle) * FRAMES; const i0 = Math.floor(f) % FRAMES; return { i0, i1: (i0 + 1) % FRAMES, frac: f - Math.floor(f) };
  };
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
  const FINE = window.matchMedia('(pointer: fine)').matches;

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    loader: $('loader'), loaderBar: $('loaderBar'),
    scene: $('scene'), inner: $('sceneInner'), canvas: $('canvas'),
    switcher: $('switcher'), swPrev: $('swPrev'), swNext: $('swNext'), swNum: $('swNum'),
    scrubHint: $('scrubHint'), scrubTrack: $('scrubTrack'), scrubFill: $('scrubFill'), scrubHandle: $('scrubHandle'),
    card: $('card'), cardIndex: $('cardIndex'), cardName: $('cardName'), cardPrice: $('cardPrice'),
    cardRef: $('cardRef'), cardSwatches: $('cardSwatches'), cardTagline: $('cardTagline'), sizes: $('sizes'),
    accComposition: $('accComposition'), accCare: $('accCare'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'), viewToggle: $('viewToggle'), viewToggleTop: $('viewToggleTop'),
    viewToggleLabel: $('viewToggleLabel'), addToBag: $('addToBag'), sizeGuide: $('sizeGuide'),
    openCollection: $('openCollection'), closeCollection: $('closeCollection'), collection: $('collection'),
    collectionGrid: $('collectionGrid'), openBag: $('openBag'), closeBag: $('closeBag'), bag: $('bag'),
    bagCount: $('bagCount'), bagTitleCount: $('bagTitleCount'), bagItems: $('bagItems'), bagSubtotal: $('bagSubtotal'),
    checkout: $('checkout'), scrim: $('scrim'), toast: $('toast'), brandLink: $('brandLink'),
    detailsTrigger: $('detailsTrigger'), sheet: $('sheet'), closeSheet: $('closeSheet'), sheetIndex: $('sheetIndex'),
    sheetName: $('sheetName'), sheetTagline: $('sheetTagline'), sheetAcc: $('sheetAcc'),
  };
  const ctx = el.canvas.getContext('2d', { alpha: false });

  /* ---------- State ---------- */
  const S = {
    view: 'rack', index: 0,
    pos: 0,                   // unbounded position in turns (angle shown = angleOf(pos))
    vel: 0,                   // turns per ms (inertia after release)
    dragging: false,
    size: 'M', bag: [],
    ready: false, dirty: true,
    intro: 1,
    par: { x: 0, y: 0, tx: 0, ty: 0 },
    xfade: null,              // { snap, start, dur }
    openPanel: null,
    wheelTimer: 0, lastInput: 0, autoDir: 1,
    W: 0, H: 0, dpr: 1, cardTop: 0,
  };

  /* ---------- Sequences ---------- */
  // Progressive load order: coarse rotation first, then refine.
  const ORDER = (() => {
    const out = []; const seen = new Set();
    for (let step = FRAMES; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < FRAMES; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
    }
    for (let i = 0; i < FRAMES; i++) if (!seen.has(i)) out.push(i);
    return out;
  })();

  class Seq {
    constructor(p, v, set = 'std') { this.p = p; this.v = v; this.set = set; this.imgs = new Array(FRAMES).fill(null); this.loaded = 0; this.started = false; this.done = false; this.still = null; }
    load(onProgress) {
      if (this.started) return this.promise;
      this.started = true;
      this.promise = new Promise((resolve) => {
        let settled = 0;
        const finish = () => { settled += 1; if (settled === FRAMES) { this.done = true; resolve(); } };
        ORDER.forEach((i, k) => {
          const im = new Image(); im.decoding = 'async';
          im.onload = () => { this.imgs[i] = im; this.loaded += 1; S.dirty = true; onProgress && onProgress(this.loaded / FRAMES); finish(); };
          im.onerror = finish;
          // stagger slightly so the first coarse frames win the connection race
          setTimeout(() => { im.src = seqSrc(this.p, this.v, i, this.set); }, Math.min(k, 12) * 8);
        });
      });
      return this.promise;
    }
    loadStill() {
      if (this.still !== null) return;
      this.still = false;
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { this.still = im; S.dirty = true; };
      im.src = stillSrc(this.p, this.v);
    }
    nearest(i) {
      if (this.imgs[i]) return this.imgs[i];
      for (let d = 1; d < FRAMES; d++) {
        const b = this.imgs[(i - d + FRAMES) % FRAMES]; if (b) return b;
        const a = this.imgs[(i + d) % FRAMES]; if (a) return a;
      }
      return this.still || null;
    }
  }
  const seqs = new Map();
  PRODUCTS.forEach((p) => VIEWS.forEach((v) => {
    seqs.set(`${p.id}:${v}:std`, new Seq(p, v, 'std'));
    seqs.set(`${p.id}:${v}:hi`, new Seq(p, v, 'hi'));
  }));
  const seqOf = (i, v, set = 'std') => seqs.get(`${PRODUCTS[i].id}:${v}:${set}`);
  const HI = wantHi();

  // Background queue: current rack (std, then 4K) → other racks → current model (std, 4K) → the rest
  async function loadQueue() {
    const order = [];
    const cur = S.index;
    order.push(seqOf(cur, 'rack', 'std'));
    if (HI) order.push(seqOf(cur, 'rack', 'hi'));
    for (let k = 1; k < N; k++) order.push(seqOf((cur + k) % N, 'rack', 'std'));
    order.push(seqOf(cur, 'model', 'std'));
    if (HI) order.push(seqOf(cur, 'model', 'hi'));
    for (let k = 1; k < N; k++) order.push(seqOf((cur + k) % N, 'model', 'std'));
    if (HI) for (let k = 1; k < N; k++) order.push(seqOf((cur + k) % N, 'rack', 'hi'));
    if (HI) for (let k = 1; k < N; k++) order.push(seqOf((cur + k) % N, 'model', 'hi'));
    for (const s of order) { if (!s.done) await s.load(); }
  }
  // Prefer the 4K frame when it has arrived, else the standard one (nearest loaded).
  function pickFrame(index, view, i, exact) {
    if (HI) { const h = seqOf(index, view, 'hi'); if (h.imgs[i]) return h.imgs[i]; }
    const sd = seqOf(index, view, 'std');
    return exact ? sd.imgs[i] : sd.nearest(i);
  }

  /* ---------- Canvas ---------- */
  function resize() {
    S.dpr = Math.min(window.devicePixelRatio || 1, HI ? 2 : 1.5);
    S.W = Math.round(el.scene.clientWidth * S.dpr);
    S.H = Math.round(el.scene.clientHeight * S.dpr);
    S.cardTop = isMobile() ? el.card.getBoundingClientRect().top : el.scene.clientHeight;
    if (el.canvas.width !== S.W || el.canvas.height !== S.H) { el.canvas.width = S.W; el.canvas.height = S.H; }
    S.dirty = true;
  }

  // Focal point per view (fraction of the frame kept in view when cropping): [desktop x,y], [mobile x,y]
  const FOCUS = {
    rack:  { d: [0.44, 0.42], m: [0.40, 0.50] },
    model: { d: [0.40, 0.50], m: [0.40, 0.50] },
  };

  // Rack view: plain cover. Model view: keep the whole figure visible — the frame's full height
  // fits the free area (above the bottom card on phones, below the top HUD), and any uncovered
  // strips are filled by stretching the frame's edge pixels (plaster wall / concrete floor).
  function cover(img, alpha, view) {
    view = view || S.view;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const mob = isMobile();
    const f = FOCUS[view][mob ? 'm' : 'd'];
    let bx = 0, by = 0, bw = S.W, bh = S.H;
    if (view === 'model' && mob) {
      by = Math.round(64 * S.dpr);
      bh = Math.max(Math.round(S.H * 0.45), Math.round(S.cardTop * S.dpr) - by);
    }
    let s = Math.max(bw / iw, bh / ih);
    if (view === 'model') { const fit = bh / ih; if (s > fit * 1.03) s = fit; }
    const dw = iw * s, dh = ih * s;
    const dx = bx + (bw - dw) * f[0], dy = by + (bh - dh) * f[1];
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    // edge fills
    const e = Math.max(2, Math.round(ih * 0.004));
    if (dy > 0) ctx.drawImage(img, 0, 0, iw, e, dx, 0, dw, dy + 1);
    if (dy + dh < S.H) ctx.drawImage(img, 0, ih - e, iw, e, dx, dy + dh - 1, dw, S.H - (dy + dh) + 1);
    if (dx > 0) ctx.drawImage(img, 0, 0, e, ih, 0, 0, dx + 1, S.H);
    if (dx + dw < S.W) ctx.drawImage(img, iw - e, 0, e, ih, dx + dw - 1, 0, S.W - (dx + dw) + 1, S.H);
    ctx.globalAlpha = 1;
  }

  function drawState(index, view, angle) {
    const { i0, i1, frac } = frameOf(angle);
    const a = pickFrame(index, view, i0, false), b = pickFrame(index, view, i1, true);
    const a0 = pickFrame(index, view, i0, true);
    if (!a) { ctx.fillStyle = '#cbc6bd'; ctx.fillRect(0, 0, S.W, S.H); return; }
    cover(a, 1, view);
    if (b && b !== a && frac > 0.02 && a0) cover(b, frac, view);
  }

  function snapshot() {
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H;
    c.getContext('2d').drawImage(el.canvas, 0, 0);
    return c;
  }

  function beginCrossfade(dur) {
    if (reduceMotion) return;
    S.xfade = { snap: snapshot(), start: performance.now(), dur };
    S.dirty = true;
  }

  function render(now) {
    drawState(S.index, S.view, angleOf(S.pos));
    if (S.xfade) {
      const p = clamp((now - S.xfade.start) / S.xfade.dur, 0, 1);
      ctx.globalAlpha = 1 - easeOut(p);
      ctx.drawImage(S.xfade.snap, 0, 0);
      ctx.globalAlpha = 1;
      if (p >= 1) S.xfade = null;
    }
  }

  /* ---------- Product / view ---------- */
  function setIndex(i) {
    i = (i + N) % N;
    if (i === S.index) return;
    beginCrossfade(260);
    S.index = i; S.pos = 0; S.vel = 0; S.autoDir = 1; S.lastInput = performance.now();
    seqOf(i, S.view).load(); if (HI) seqOf(i, S.view, 'hi').load();
    updateCard();
    S.dirty = true;
  }

  function setView(v) {
    if (v === S.view) return;
    beginCrossfade(380);
    S.view = v; S.pos = 0; S.vel = 0; S.autoDir = 1; S.lastInput = performance.now();
    seqOf(S.index, v).load(); if (HI) seqOf(S.index, v, 'hi').load();
    document.body.classList.toggle('view-model', v === 'model');
    el.viewToggleLabel.textContent = v === 'model' ? 'On model' : 'On rack';
    el.scrubHint.textContent = FINE ? (v === 'model' ? 'Move to turn' : 'Move to rotate') : (v === 'model' ? 'Drag to turn' : 'Drag to rotate');
    el.scrubHint.classList.remove('is-hidden');
    S.dirty = true;
  }
  const toggleView = () => setView(S.view === 'rack' ? 'model' : 'rack');

  /* ---------- Frame loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;

    // Inertia after release
    if (!S.dragging && Math.abs(S.vel) > 1e-6) {
      S.pos += S.vel * dt;
      S.vel *= Math.exp(-dt / 320);
      if (Math.abs(S.vel) < 2e-6) S.vel = 0;
      S.dirty = true;
    } else if (!S.dragging && S.ready && !S.openPanel && (FORCE_IDLE || (!document.hidden && !reduceMotion)) && now - S.lastInput > IDLE_DELAY) {
      // Idle turntable: keeps turning on its own (eases in over the first second).
      // In pingpong mode a growing pos already yields 0→360°→0, so a single direction is enough.
      const ease = Math.min(1, (now - S.lastInput - IDLE_DELAY) / 1000);
      S.pos += (dt / IDLE_TURN_MS) * ease * ease;
      S.dirty = true;
    } else if (!S.dragging && now - S.lastInput > 140) {
      // At rest: settle onto the nearest exact frame so the still image is crisp
      const steps = PING ? FRAMES - 1 : FRAMES;
      const a = angleOf(S.pos);
      const target = Math.round(a * steps) / steps;
      let diff = target - a;
      if (!PING) { if (diff > 0.5) diff -= 1; if (diff < -0.5) diff += 1; }
      const leg = PING && ((((S.pos % 2) + 2) % 2) > 1) ? -1 : 1;   // descending leg → pos moves opposite to angle
      if (Math.abs(diff) > 0.0004) { S.pos += leg * diff * (1 - Math.exp(-dt / 110)); S.dirty = true; }
      else if (diff !== 0) { S.pos += leg * diff; S.dirty = true; }
    }

    // Parallax + intro settle (CSS transform on the canvas wrapper)
    if (S.intro > 0) { S.intro = Math.max(0, S.intro - dt / 1900); S.dirty = true; }
    const pk = 1 - Math.exp(-dt / 400);
    const nx = S.par.x + (S.par.tx - S.par.x) * pk, ny = S.par.y + (S.par.ty - S.par.y) * pk;
    if (Math.abs(nx - S.par.x) > 0.01 || Math.abs(ny - S.par.y) > 0.01 || S.intro > 0) {
      S.par.x = nx; S.par.y = ny;
      const scale = 1.03 + (1 - easeOut(1 - S.intro)) * 0.04;
      el.inner.style.transform = `translate3d(${S.par.x.toFixed(2)}px, ${S.par.y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    }

    if (S.dirty || S.xfade) {
      render(now);
      S.dirty = !!S.xfade;
      const ang = angleOf(S.pos);
      const pct = (ang * 100).toFixed(2) + '%';
      el.scrubFill.style.width = pct;
      el.scrubHandle.style.left = pct;
      el.scrubTrack.setAttribute('aria-valuenow', String(Math.round(ang * 360)));
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Card ---------- */
  function swapText(node, text) {
    if (node.textContent === text) return;
    node.classList.add('is-out');
    setTimeout(() => { node.textContent = text; node.classList.remove('is-out'); }, 170);
  }

  function updateCard() {
    const p = PRODUCTS[S.index];
    swapText(el.cardName, p.name);
    swapText(el.cardPrice, money(p.price));
    swapText(el.cardRef, p.ref);
    swapText(el.cardTagline, p.tagline);
    swapText(el.cardIndex, `${pad(S.index + 1)} / ${pad(N)}`);
    swapText(el.swNum, pad(S.index + 1));
    el.accComposition.textContent = p.composition;
    el.accCare.textContent = p.care;
    [...el.cardSwatches.children].forEach((b, i) => b.classList.toggle('is-active', i === S.index));
    [...el.sizes.children].forEach((b) => b.classList.toggle('is-low', p.lowSizes.includes(b.dataset.size)));
    [...el.collectionGrid.children].forEach((t, i) => t.classList.toggle('is-active', i === S.index));
    document.title = `${p.name} — CIEL Édition 01`;
  }

  function buildCard() {
    [el.cardName, el.cardPrice, el.cardRef, el.cardTagline, el.cardIndex, el.swNum].forEach((n) => n.classList.add('text-swap'));
    PRODUCTS.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.style.background = p.swatch; b.title = p.name; b.setAttribute('aria-label', p.name);
      b.addEventListener('click', () => setIndex(i));
      el.cardSwatches.appendChild(b);
    });
    SIZES.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = s; b.dataset.size = s; b.setAttribute('role', 'radio');
      b.classList.toggle('is-active', s === S.size);
      b.addEventListener('click', () => {
        S.size = s;
        [...el.sizes.children].forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
      });
      el.sizes.appendChild(b);
    });
  }

  /* ---------- Collection ---------- */
  function buildCollection() {
    PRODUCTS.forEach((p, i) => {
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'tile';
      t.innerHTML = `
        <div class="tile__img"><img src="${stillSrc(p, 'rack')}" alt="${p.name}" loading="lazy" style="object-position:40% 50%"><span class="tile__num">${pad(i + 1)}</span></div>
        <div class="tile__row"><span class="tile__name">${p.name}</span><span class="tile__price">${money(p.price)}</span></div>
        <div class="tile__desc">${p.tagline}</div>`;
      t.addEventListener('click', () => { setView('rack'); setIndex(i); closePanels(); });
      el.collectionGrid.appendChild(t);
    });
  }

  /* ---------- Bag ---------- */
  function addToBag() {
    const p = PRODUCTS[S.index];
    const found = S.bag.find((it) => it.id === p.id && it.size === S.size);
    if (found) found.qty += 1; else S.bag.push({ id: p.id, size: S.size, qty: 1 });
    renderBag();
    el.bagCount.classList.add('is-bump'); setTimeout(() => el.bagCount.classList.remove('is-bump'), 320);
    el.addToBag.classList.add('is-added'); el.addToBag.firstElementChild.textContent = 'Added';
    setTimeout(() => { el.addToBag.classList.remove('is-added'); el.addToBag.firstElementChild.textContent = 'Add to bag'; }, 1300);
    toast(`Added to bag — ${p.name}, size ${S.size}`);
  }

  function renderBag() {
    const count = S.bag.reduce((a, b) => a + b.qty, 0);
    el.bagCount.textContent = String(count);
    el.bagTitleCount.textContent = count ? `— ${count} item${count > 1 ? 's' : ''}` : '— empty';
    if (!count) {
      el.bagItems.innerHTML = '<div class="drawer__empty">Nothing here yet. Pick a size and add a jacket.</div>';
      el.bagSubtotal.textContent = money(0);
      return;
    }
    let subtotal = 0;
    el.bagItems.innerHTML = S.bag.map((it, idx) => {
      const p = PRODUCTS.find((x) => x.id === it.id);
      subtotal += p.price * it.qty;
      return `
        <div class="bag-item" data-idx="${idx}">
          <div class="bag-item__img"><img src="${stillSrc(p, 'rack')}" alt="" style="object-position:38% 28%"></div>
          <div>
            <div class="bag-item__name">${p.name}</div>
            <div class="bag-item__meta">Size ${it.size} · ${p.ref}</div>
            <div class="bag-item__qty">
              <button type="button" data-act="dec" aria-label="Decrease">−</button>
              <span>${it.qty}</span>
              <button type="button" data-act="inc" aria-label="Increase">+</button>
            </div>
          </div>
          <div class="bag-item__right">
            <div class="bag-item__price">${money(p.price * it.qty)}</div>
            <button type="button" class="bag-item__remove" data-act="rm">Remove</button>
          </div>
        </div>`;
    }).join('');
    el.bagSubtotal.textContent = money(subtotal);
  }

  el.bagItems.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const row = e.target.closest('.bag-item'); const idx = Number(row.dataset.idx); const it = S.bag[idx];
    if (btn.dataset.act === 'inc') it.qty += 1;
    if (btn.dataset.act === 'dec') it.qty -= 1;
    if (btn.dataset.act === 'rm' || it.qty <= 0) S.bag.splice(idx, 1);
    renderBag();
  });

  /* ---------- Panels ---------- */
  function openPanel(name) {
    closePanels(true);
    S.openPanel = name;
    el[name].classList.add('is-open');
    el[name].setAttribute('aria-hidden', 'false');
    el.scrim.classList.add('is-open');
  }
  function closePanels(silent) {
    ['collection', 'bag', 'sheet'].forEach((n) => { el[n].classList.remove('is-open'); el[n].setAttribute('aria-hidden', 'true'); });
    el.scrim.classList.remove('is-open');
    S.openPanel = null;
    if (!silent) el.scene.focus?.();
  }

  function openSheet() {
    const p = PRODUCTS[S.index];
    el.sheetIndex.textContent = `${pad(S.index + 1)} / ${pad(N)}`;
    el.sheetName.textContent = p.name;
    el.sheetTagline.textContent = p.tagline;
    el.sheetAcc.innerHTML = [
      ['Composition', p.composition], ['Care', p.care],
      ['Shipping & returns', 'Complimentary shipping on every order. Dispatched within two business days from our Lisbon atelier. Returns within 30 days, unworn, tags on.'],
    ].map(([h, b], i) => `<details class="acc__item"${i === 0 ? ' open' : ''}><summary>${h}<span class="acc__plus"></span></summary><div class="acc__body">${b}</div></details>`).join('');
    openPanel('sheet');
  }

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2200);
  }

  /* ---------- Input: drag on the scene (rotate) ---------- */
  function hideHint() { el.scrubHint.classList.add('is-hidden'); }

  (function sceneDrag() {
    let startX = 0, startPos = 0, lastX = 0, lastT = 0, v = 0, moved = false;
    const turnPx = () => Math.max(420, window.innerWidth * 0.85);   // px for one full turn
    el.scene.addEventListener('pointerdown', (e) => {
      if (S.openPanel || !S.ready) return;
      if (e.button !== undefined && e.button !== 0) return;
      S.dragging = true; moved = false; S.vel = 0; S.lastInput = performance.now();
      el.scene.classList.add('is-dragging');
      startX = lastX = e.clientX; startPos = S.pos; lastT = performance.now(); v = 0;
      try { el.scene.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    });
    el.scene.addEventListener('pointermove', (e) => {
      if (!S.dragging) return;
      const now = performance.now();
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      S.pos = startPos - dx / turnPx(); S.lastInput = now;
      const dtm = Math.max(1, now - lastT);
      v = v * 0.5 + (-(e.clientX - lastX) / turnPx() / dtm) * 0.5;   // turns per ms
      lastX = e.clientX; lastT = now;
      S.par.tx = clamp(S.par.tx + (e.movementX || 0) * 0.015, -8, 8);
      S.dirty = true;
    });
    const end = () => {
      if (!S.dragging) return;
      S.dragging = false;
      el.scene.classList.remove('is-dragging');
      if (moved) { hideHint(); if (performance.now() - lastT < 80) S.vel = clamp(v, -0.004, 0.004) * 0.7; }
    };
    el.scene.addEventListener('pointerup', end);
    el.scene.addEventListener('pointercancel', end);
    el.scene.addEventListener('lostpointercapture', end);
  })();

  /* ---------- Input: hover-to-rotate (mouse, no button) ---------- */
  // On desktop the figure turns in place as the cursor moves across the scene: one scene width
  // of travel is one full turn. Relative to the last cursor position, so it never jumps after a
  // drag or an idle turn; the boomerang mapping handles travel beyond 360°.
  (function hoverRotate() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let lastX = null;
    const turnPx = () => Math.max(420, window.innerWidth * 0.85);
    el.scene.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') lastX = e.clientX; });
    el.scene.addEventListener('pointerleave', () => { lastX = null; });
    el.scene.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || S.dragging || S.openPanel || !S.ready) return;
      if (lastX === null) { lastX = e.clientX; return; }
      const dx = e.clientX - lastX; lastX = e.clientX;
      if (!dx) return;
      S.pos += dx / turnPx(); S.vel = 0; S.lastInput = performance.now(); S.dirty = true;
      hideHint();
    });
  })();

  /* ---------- Input: slider ---------- */
  (function scrubDrag() {
    let on = false;
    const setFromX = (x) => {
      const r = el.scrubTrack.getBoundingClientRect();
      const a = clamp((x - r.left) / r.width, 0, PING ? 1 : 0.9999);
      S.pos = PING ? 2 * Math.floor(((S.pos % 2) + 2) % 2 / 2) + a : a;   // stay on the ascending leg
      S.vel = 0; S.dirty = true; S.lastInput = performance.now();
    };
    el.scrubTrack.addEventListener('pointerdown', (e) => {
      on = true; setFromX(e.clientX); hideHint();
      try { el.scrubTrack.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    });
    el.scrubTrack.addEventListener('pointermove', (e) => { if (on) setFromX(e.clientX); });
    const end = () => { on = false; };
    el.scrubTrack.addEventListener('pointerup', end);
    el.scrubTrack.addEventListener('pointercancel', end);
    el.scrubTrack.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); S.pos += 1 / FRAMES; S.lastInput = performance.now(); S.dirty = true; hideHint(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); S.pos -= 1 / FRAMES; S.lastInput = performance.now(); S.dirty = true; hideHint(); }
    });
  })();

  /* ---------- Input: wheel / trackpad (rotate) ---------- */
  window.addEventListener('wheel', (e) => {
    if (S.openPanel || !S.ready || S.dragging) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    S.pos += d * 0.00045; S.vel = 0; S.dirty = true; S.lastInput = performance.now();
    hideHint();
  }, { passive: true });

  /* ---------- Input: keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePanels(); return; }
    if (S.openPanel || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { setIndex(S.index + 1); hideHint(); }
    if (e.key === 'ArrowLeft') { setIndex(S.index - 1); hideHint(); }
    if (e.key.toLowerCase() === 'm') toggleView();
    if (e.key.toLowerCase() === 'b') openPanel('bag');
  });

  /* ---------- Input: mouse parallax ---------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      if (S.dragging) return;
      S.par.tx = (e.clientX / window.innerWidth - 0.5) * 14;
      S.par.ty = (e.clientY / window.innerHeight - 0.5) * 8;
    }, { passive: true });
  }

  /* ---------- Wiring ---------- */
  el.prevBtn.addEventListener('click', () => setIndex(S.index - 1));
  el.nextBtn.addEventListener('click', () => setIndex(S.index + 1));
  el.swPrev.addEventListener('click', () => setIndex(S.index - 1));
  el.swNext.addEventListener('click', () => setIndex(S.index + 1));
  el.viewToggle.addEventListener('click', toggleView);
  el.viewToggleTop.addEventListener('click', toggleView);
  el.addToBag.addEventListener('click', addToBag);
  el.sizeGuide.addEventListener('click', () => toast(`${PRODUCTS[S.index].name} runs true to size. Model is 6′1″ and wears M.`));
  el.openCollection.addEventListener('click', () => openPanel('collection'));
  el.closeCollection.addEventListener('click', () => closePanels());
  el.openBag.addEventListener('click', () => openPanel('bag'));
  el.closeBag.addEventListener('click', () => closePanels());
  el.detailsTrigger.addEventListener('click', openSheet);
  el.closeSheet.addEventListener('click', () => closePanels());
  el.scrim.addEventListener('click', () => closePanels());
  el.checkout.addEventListener('click', () => toast('Checkout is not connected in this preview.'));
  el.brandLink.addEventListener('click', (e) => { e.preventDefault(); closePanels(); setView('rack'); setIndex(0); });
  window.addEventListener('resize', resize);

  (function sheetSwipe() {
    let y0 = null;
    el.sheet.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    el.sheet.addEventListener('touchend', (e) => {
      if (y0 !== null && e.changedTouches[0].clientY - y0 > 70 && el.sheet.scrollTop <= 0) closePanels();
      y0 = null;
    }, { passive: true });
  })();

  /* ---------- Boot ---------- */
  async function boot() {
    buildCard(); buildCollection(); renderBag(); updateCard();
    if (FINE) el.scrubHint.textContent = 'Move to rotate';
    resize();
    seqs.forEach((s) => { if (s.set === 'std') s.loadStill(); });

    const first = seqOf(0, 'rack');
    requestAnimationFrame(frame);
    await first.load((p) => { el.loaderBar.style.width = `${Math.round(p * 100)}%`; });

    S.ready = true; S.dirty = true; S.lastInput = performance.now();
    document.body.classList.add('is-ready');
    el.loader.classList.add('is-done');
    setTimeout(() => el.switcher.classList.add('is-visible'), 600);

    loadQueue();
  }

  boot();
})();
