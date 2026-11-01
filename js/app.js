/* ------------------------------------------------------------------
   CIEL — Édition 01
   Scene engine + UI. Vanilla JS, no dependencies.
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
      tag: { rack: [0.505, 0.135], model: [0.545, 0.245] },
    },
    {
      id: 'sable', name: 'Sable', price: 159, ref: 'Ref. 0913-SAB', swatch: '#e7e0d2',
      tagline: 'Sun-washed ivory with a soft, dry hand. Wears in, never out.',
      composition: 'Shell: 100% brushed cotton jacquard, 320 g. Lining: cupro. Ribbing: cotton–elastane. Zip: matte zinc, two-way.',
      care: 'Wash cold, inside out, gentle cycle. Dry flat away from direct sun. Warm iron on reverse. Do not tumble dry.',
      lowSizes: [],
      tag: { rack: [0.50, 0.125], model: [0.545, 0.245] },
    },
    {
      id: 'ardoise', name: 'Ardoise', price: 139, ref: 'Ref. 0914-ARD', swatch: '#7e8184',
      tagline: 'Mineral grey, cut for layered silhouettes. Quiet from any angle.',
      composition: 'Shell: 100% brushed cotton jacquard, 320 g. Lining: cupro. Ribbing: cotton–elastane. Zip: matte zinc, two-way.',
      care: 'Wash cold, inside out, gentle cycle. Dry flat away from direct sun. Warm iron on reverse. Do not tumble dry.',
      lowSizes: ['S'],
      tag: { rack: [0.51, 0.135], model: [0.545, 0.245] },
    },
  ];
  const N = PRODUCTS.length;
  const SIZES = ['S', 'M', 'L', 'XL'];
  const KINDS = ['rack', 'front', 'back'];
  const src = (p, kind) => kind === 'rack' ? `assets/img/rack-${p.id}.jpg` : `assets/img/model-${p.id}-${kind}.jpg`;
  const money = (n) => `$${n.toFixed(2)}`;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    loader: $('loader'), loaderBar: $('loaderBar'),
    scene: $('scene'), layers: $('layers'), tag: $('tag'), tagNum: $('tagNum'), tagName: $('tagName'),
    scrub: $('scrub'), scrubHint: $('scrubHint'), scrubTrack: $('scrubTrack'), scrubFill: $('scrubFill'),
    scrubTicks: $('scrubTicks'), scrubHandle: $('scrubHandle'),
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

  /* ---------- State ---------- */
  const S = {
    view: 'rack',            // 'rack' | 'model'
    index: 0,                // current product
    t: 0, tTarget: 0,        // scrub position 0..1
    dragging: false,
    size: 'M',
    bag: [],
    ready: false,
    intro: 1,                // 1 → 0 settle-in scale
    par: { x: 0, y: 0, tx: 0, ty: 0 },
    tagPos: { x: -999, y: -999 },
    wheelTimer: 0,
    openPanel: null,
  };

  /* ---------- Layers ---------- */
  const layers = new Map(); // key -> {el, cur, desired, tx, sc}
  PRODUCTS.forEach((p) => KINDS.forEach((k) => {
    const img = document.createElement('img');
    img.alt = k === 'rack' ? `${p.name} jacket on the rack` : `${p.name} jacket worn, ${k} view`;
    img.decoding = 'async';
    img.draggable = false;
    img.dataset.key = `${p.id}:${k}`;
    el.layers.appendChild(img);
    layers.set(`${p.id}:${k}`, { el: img, cur: 0, desired: 0, tx: 0, sc: 1, p, k });
  }));
  const L = (p, k) => layers.get(`${p.id}:${k}`);

  function loadImage(img, url) {
    return new Promise((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = url;
    });
  }

  /* ---------- Keys / snapping ---------- */
  const keys = () => S.view === 'rack' ? PRODUCTS.map((_, i) => i / (N - 1)) : [0, 1];
  const nearestKey = (t) => keys().reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a);

  function snap(vx = 0) {
    const ks = keys();
    let target = nearestKey(S.tTarget);
    if (Math.abs(vx) > 0.6) {               // flick → next key in flick direction
      const dir = vx < 0 ? 1 : -1;
      const next = ks.find((k) => dir > 0 ? k > S.tTarget + 0.02 : false) ??
                   (dir < 0 ? [...ks].reverse().find((k) => k < S.tTarget - 0.02) : undefined);
      if (next !== undefined) target = next;
    }
    S.tTarget = clamp(target, 0, 1);
  }

  /* ---------- Product / view ---------- */
  function setIndex(i, { jump = false } = {}) {
    i = (i + N) % N;
    if (S.view === 'rack') {
      const adjacent = Math.abs(i - S.index) === 1;
      S.tTarget = i / (N - 1);
      if (jump || !adjacent) S.t = S.tTarget;   // non-adjacent: crossfade instead of scrubbing through
    }
    if (i !== S.index) { S.index = i; updateCard(); }
  }

  function setView(v) {
    if (v === S.view) return;
    S.view = v;
    S.t = S.tTarget = v === 'rack' ? S.index / (N - 1) : 0;
    document.body.classList.toggle('view-model', v === 'model');
    el.viewToggleLabel.textContent = v === 'model' ? 'On model' : 'On rack';
    el.scrubHint.textContent = v === 'model' ? 'Drag to turn' : 'Drag to explore';
    el.scrubHint.classList.remove('is-hidden');
    renderTicks();
  }
  const toggleView = () => setView(S.view === 'rack' ? 'model' : 'rack');

  /* ---------- Frame loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;

    // Scrub easing
    if (!S.dragging) {
      const k = 1 - Math.exp(-dt / (reduceMotion ? 1 : 170));
      S.t = Math.abs(S.tTarget - S.t) < 0.0005 ? S.tTarget : lerp(S.t, S.tTarget, k);
    }

    // Derive product from scrub position in rack view
    if (S.view === 'rack') {
      const i = Math.round(S.t * (N - 1));
      if (i !== S.index) { S.index = i; updateCard(); }
    }

    // Desired weights per layer
    layers.forEach((l) => { l.desired = 0; l.tx = 0; l.sc = 1; });
    if (S.view === 'rack') {
      const p = S.t * (N - 1);
      PRODUCTS.forEach((pr, i) => {
        const l = L(pr, 'rack');
        l.desired = clamp(1 - Math.abs(p - i), 0, 1);
        l.tx = -(p - i) * 3.2;                // slide along the rail
      });
    } else {
      const pr = PRODUCTS[S.index];
      const f = L(pr, 'front'), b = L(pr, 'back');
      f.desired = 1 - S.t; b.desired = S.t;
      f.tx = -S.t * 2.2; b.tx = (1 - S.t) * 2.2;
      const bulge = 1 + Math.sin(Math.PI * S.t) * 0.025;   // a hint of depth mid-turn
      f.sc = bulge; b.sc = bulge;
    }

    // Compositing: incoming on top; outgoing layers hold until incoming is opaque
    const list = [...layers.values()];
    const incoming = list.reduce((a, b) => (b.desired > a.desired ? b : a), list[0]);
    const incomingOpaque = incoming.cur >= 0.985 || incoming.desired < 0.001;
    const tau = S.dragging ? 110 : 240;
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt / tau);
    list.sort((a, b) => a.desired - b.desired).forEach((l, z) => {
      let target = l.desired;
      if (l === incoming) target = l.desired;
      else if (l.desired < l.cur && !incomingOpaque) target = l.cur;   // hold
      else if (l.desired < l.cur && incomingOpaque) target = 0;
      l.cur = Math.abs(target - l.cur) < 0.002 ? target : lerp(l.cur, target, k);
      const vis = l.cur > 0.002;
      l.el.style.opacity = vis ? l.cur.toFixed(3) : '0';
      l.el.style.zIndex = String(z + 1);
      l.el.style.transform = vis ? `translate3d(${l.tx.toFixed(3)}%,0,0) scale(${l.sc.toFixed(4)})` : '';
    });

    // Parallax + intro settle
    if (S.intro > 0) S.intro = Math.max(0, S.intro - dt / 1900);
    const ease = 1 - Math.pow(1 - (1 - S.intro), 3);
    const pk = 1 - Math.exp(-dt / 400);
    S.par.x = lerp(S.par.x, S.par.tx, pk); S.par.y = lerp(S.par.y, S.par.ty, pk);
    const scale = 1 + (1 - ease) * 0.045;
    el.layers.style.transform = `translate3d(${S.par.x.toFixed(2)}px, ${S.par.y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

    // Scrub UI
    const pct = (S.t * 100).toFixed(2) + '%';
    el.scrubFill.style.width = pct;
    el.scrubHandle.style.left = pct;
    el.scrubTrack.setAttribute('aria-valuenow', String(Math.round(S.t * 100)));

    // Tag follows the hanger / shoulder
    updateTag(dt);

    requestAnimationFrame(frame);
  }

  /* ---------- Tag positioning (object-fit: cover math) ---------- */
  function imagePointToScreen(u, v) {
    const any = L(PRODUCTS[0], 'rack').el;
    const iw = any.naturalWidth || 2048, ih = any.naturalHeight || 1360;
    const r = el.layers.getBoundingClientRect();
    const cs = getComputedStyle(any).objectPosition.split(' ');
    const px = parseFloat(cs[0]) / 100, py = parseFloat(cs[1] || '50%') / 100;
    const s = Math.max(r.width / iw, r.height / ih);
    const dw = iw * s, dh = ih * s;
    const ox = (r.width - dw) * px, oy = (r.height - dh) * py;
    return { x: r.left + ox + u * dw, y: r.top + oy + v * dh };
  }

  function updateTag(dt) {
    const pr = PRODUCTS[S.index];
    const [u, v] = pr.tag[S.view === 'rack' ? 'rack' : 'model'];
    const pt = imagePointToScreen(u, v);
    const minY = 84, maxY = window.innerHeight - 120;
    const minX = 90, maxX = window.innerWidth - 90;
    const tx = clamp(pt.x, minX, maxX), ty = clamp(pt.y, minY, maxY);
    if (S.tagPos.x < -500) { S.tagPos.x = tx; S.tagPos.y = ty; }
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt / 160);
    S.tagPos.x = lerp(S.tagPos.x, tx, k); S.tagPos.y = lerp(S.tagPos.y, ty, k);
    el.tag.style.transform = `translate3d(${S.tagPos.x.toFixed(1)}px, ${S.tagPos.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
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
    el.accComposition.textContent = p.composition;
    el.accCare.textContent = p.care;
    el.tagNum.textContent = pad(S.index + 1);
    swapText(el.tagName, p.name);
    [...el.cardSwatches.children].forEach((b, i) => b.classList.toggle('is-active', i === S.index));
    [...el.sizes.children].forEach((b) => b.classList.toggle('is-low', p.lowSizes.includes(b.dataset.size)));
    [...el.collectionGrid.children].forEach((t, i) => t.classList.toggle('is-active', i === S.index));
    document.title = `${p.name} — CIEL Édition 01`;
  }

  function buildCard() {
    [el.cardName, el.cardPrice, el.cardRef, el.cardTagline, el.cardIndex, el.tagName].forEach((n) => n.classList.add('text-swap'));
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

  function renderTicks() {
    el.scrubTicks.innerHTML = keys().map((k) => `<i style="left:${k * 100}%"></i>`).join('');
  }

  /* ---------- Collection ---------- */
  function buildCollection() {
    PRODUCTS.forEach((p, i) => {
      const t = document.createElement('button');
      t.type = 'button'; t.className = 'tile';
      t.innerHTML = `
        <div class="tile__img"><img src="${src(p, 'rack')}" alt="${p.name}" loading="lazy" style="object-position:40% 50%"><span class="tile__num">${pad(i + 1)}</span></div>
        <div class="tile__row"><span class="tile__name">${p.name}</span><span class="tile__price">${money(p.price)}</span></div>
        <div class="tile__desc">${p.tagline}</div>`;
      t.addEventListener('click', () => { setView('rack'); setIndex(i, { jump: true }); closePanels(); });
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
          <div class="bag-item__img"><img src="${src(p, 'rack')}" alt="" style="object-position:38% 28%"></div>
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

  /* ---------- Input: drag on scene ---------- */
  function hideHint() { el.scrubHint.classList.add('is-hidden'); }

  (function sceneDrag() {
    let startX = 0, startT = 0, lastX = 0, lastTime = 0, vx = 0, moved = false;
    const span = () => window.innerWidth * (S.view === 'rack' ? 0.9 : 0.62);
    el.scene.addEventListener('pointerdown', (e) => {
      if (S.openPanel || !S.ready) return;
      if (e.button !== undefined && e.button !== 0) return;
      S.dragging = true; moved = false;
      el.scene.classList.add('is-dragging');
      startX = lastX = e.clientX; startT = S.t; lastTime = performance.now(); vx = 0;
      try { el.scene.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    });
    el.scene.addEventListener('pointermove', (e) => {
      if (!S.dragging) return;
      const now = performance.now();
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      S.t = clamp(startT - dx / span(), 0, 1);
      S.tTarget = S.t;
      const dtm = Math.max(1, now - lastTime);
      vx = lerp(vx, (e.clientX - lastX) / dtm, 0.5);     // px per ms
      lastX = e.clientX; lastTime = now;
      S.par.tx = clamp(S.par.tx + (e.movementX || 0) * 0.02, -8, 8);
    });
    const end = () => {
      if (!S.dragging) return;
      S.dragging = false;
      el.scene.classList.remove('is-dragging');
      if (moved) { hideHint(); snap(vx); }
    };
    el.scene.addEventListener('pointerup', end);
    el.scene.addEventListener('pointercancel', end);
    el.scene.addEventListener('lostpointercapture', end);
  })();

  /* ---------- Input: scrub track ---------- */
  (function scrubDrag() {
    const setFromX = (x) => {
      const r = el.scrubTrack.getBoundingClientRect();
      S.t = S.tTarget = clamp((x - r.left) / r.width, 0, 1);
    };
    el.scrubTrack.addEventListener('pointerdown', (e) => {
      S.dragging = true; setFromX(e.clientX); hideHint();
      try { el.scrubTrack.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    });
    el.scrubTrack.addEventListener('pointermove', (e) => { if (S.dragging) setFromX(e.clientX); });
    const end = () => { if (!S.dragging) return; S.dragging = false; snap(0); };
    el.scrubTrack.addEventListener('pointerup', end);
    el.scrubTrack.addEventListener('pointercancel', end);
    el.scrubTrack.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepKey(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepKey(-1); }
    });
  })();

  function stepKey(dir) {
    const ks = keys();
    const cur = nearestKey(S.tTarget);
    const i = ks.indexOf(cur);
    const next = ks[clamp(i + dir, 0, ks.length - 1)];
    S.tTarget = next;
    hideHint();
  }

  /* ---------- Input: wheel / trackpad ---------- */
  window.addEventListener('wheel', (e) => {
    if (S.openPanel || !S.ready || S.dragging) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    S.tTarget = clamp(S.tTarget + d * 0.0007, 0, 1);
    hideHint();
    clearTimeout(S.wheelTimer);
    S.wheelTimer = setTimeout(() => snap(0), 160);
  }, { passive: true });

  /* ---------- Input: keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePanels(); return; }
    if (S.openPanel || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { S.view === 'rack' ? setIndex(S.index + 1) : (S.tTarget = 1); hideHint(); }
    if (e.key === 'ArrowLeft') { S.view === 'rack' ? setIndex(S.index - 1) : (S.tTarget = 0); hideHint(); }
    if (e.key.toLowerCase() === 'm') toggleView();
    if (e.key.toLowerCase() === 'b') openPanel('bag');
  });

  /* ---------- Input: mouse parallax ---------- */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      if (S.dragging) return;
      S.par.tx = (e.clientX / window.innerWidth - 0.5) * 16;
      S.par.ty = (e.clientY / window.innerHeight - 0.5) * 9;
    }, { passive: true });
  }

  /* ---------- Wiring ---------- */
  el.prevBtn.addEventListener('click', () => setIndex(S.index - 1));
  el.nextBtn.addEventListener('click', () => setIndex(S.index + 1));
  el.viewToggle.addEventListener('click', toggleView);
  el.viewToggleTop.addEventListener('click', toggleView);
  el.tag.addEventListener('click', toggleView);
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
  el.brandLink.addEventListener('click', (e) => { e.preventDefault(); closePanels(); setView('rack'); setIndex(0, { jump: true }); });

  // Swipe-down closes the mobile sheet
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
    buildCard(); buildCollection(); renderTicks(); renderBag(); updateCard();
    L(PRODUCTS[0], 'rack').cur = 0;

    // Priority: the three rack shots, then the on-model views in the background
    const first = PRODUCTS.map((p) => L(p, 'rack'));
    let done = 0;
    const tick = () => { done += 1; el.loaderBar.style.width = `${Math.round((done / first.length) * 100)}%`; };
    await Promise.all(first.map((l) => loadImage(l.el, src(l.p, 'rack')).then(tick)));

    requestAnimationFrame(frame);
    S.ready = true;
    document.body.classList.add('is-ready');
    el.loader.classList.add('is-done');
    setTimeout(() => el.tag.classList.add('is-visible'), 700);

    PRODUCTS.forEach((p) => ['front', 'back'].forEach((k) => loadImage(L(p, k).el, src(p, k))));
  }

  boot();
})();
