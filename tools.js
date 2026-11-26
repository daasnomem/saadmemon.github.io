// Playable sketches for the tools section. All sound is synthesized in the browser.
(function () {
  const C = '#00C2CB', D = '#1A4A4D', M = '#4A5E70', L = '#1A2330';
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const ftom = f => 69 + 12 * Math.log2(f / 440);
  const nn = m => NOTE[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);

  // ---------- audio engine ----------
  let A = null, out, verbSend, dly;
  function audio() {
    if (A) { if (A.state === 'suspended') A.resume(); return A; }
    A = new (window.AudioContext || window.webkitAudioContext)();
    const comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out = A.createGain(); out.gain.value = 0.8; out.connect(comp); comp.connect(A.destination);
    dly = A.createDelay(1); dly.delayTime.value = 0.375;
    const fb = A.createGain(); fb.gain.value = 0.45; const lp = A.createBiquadFilter(); lp.frequency.value = 1800;
    dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(out);
    verbSend = A.createGain(); verbSend.gain.value = 1; verbSend.connect(dly);
    return A;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(f, t, { type = 'sine', dur = 0.4, vol = 0.3, cutoff = 4000, send = 0, partials = null } = {}) {
    const a = audio(); t = t || a.currentTime;
    const g = a.createGain(), filt = a.createBiquadFilter(); filt.frequency.value = cutoff; filt.Q.value = 1;
    const srcs = (partials || [1]).map((p, i) => { const o = a.createOscillator(); o.type = partials ? 'sine' : type; o.frequency.value = f * (partials ? i + 1 : 1); const pg = a.createGain(); pg.gain.value = partials ? p : 1; o.connect(pg); pg.connect(filt); o.start(t); o.stop(t + dur + 0.1); return o; });
    filt.connect(g); g.connect(out); if (send) { const s = a.createGain(); s.gain.value = send; g.connect(s); s.connect(verbSend); }
    env(g, t, 0.006, vol, dur); return srcs;
  }
  function noiseBuf(a, len) { const b = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function drum(kind, t, vol = 0.6) {
    const a = audio(); t = t || a.currentTime; const g = a.createGain(); g.connect(out);
    if (kind === 'kick') { const o = a.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); env(g, t, 0.002, vol, 0.35); o.start(t); o.stop(t + 0.5); }
    else { const n = a.createBufferSource(); n.buffer = noiseBuf(a, 0.3); const f = a.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; n.connect(f); f.connect(g); env(g, t, 0.001, kind === 'hat' ? vol * 0.35 : vol * 0.7, kind === 'hat' ? 0.05 : 0.18); n.start(t); n.stop(t + 0.3); }
  }

  // ---------- canvas plumbing ----------
  const cards = {};
  document.querySelectorAll('canvas[data-viz]').forEach(c => {
    const k = c.dataset.viz; const box = c.parentElement;
    const st = { c, k, w: 0, h: 0, x: null, mouse: null, vis: false };
    box.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); st.mouse = [e.clientX - r.left, e.clientY - r.top]; });
    box.addEventListener('pointerleave', () => st.mouse = null);
    c.addEventListener('click', e => { const r = c.getBoundingClientRect(); demos[k].click && demos[k].click(st, e.clientX - r.left, e.clientY - r.top); });
    cards[k] = st;
  });
  function fit() { Object.values(cards).forEach(s => { const r = s.c.getBoundingClientRect(), d = devicePixelRatio || 1; s.c.width = r.width * d; s.c.height = r.height * d; s.x = s.c.getContext('2d'); s.x.setTransform(d, 0, 0, d, 0, 0); s.w = r.width; s.h = r.height; }); }
  const io = new IntersectionObserver(es => es.forEach(e => { const s = Object.values(cards).find(s => s.c === e.target); if (s) s.vis = e.isIntersecting; }));
  Object.values(cards).forEach(s => io.observe(s.c));
  function ctrl(k, html) { const el = document.querySelector(`[data-ctrl="${k}"]`); if (el) el.innerHTML = html; return el; }
  function on(k, sel, fn) { const el = document.querySelector(`[data-ctrl="${k}"]`); el && el.addEventListener('click', e => { const b = e.target.closest(sel); if (b) { e.preventDefault(); e.stopPropagation(); fn(b); } }); }
  const txt = (x, s, X, Y, col = M, size = 9, align = 'left') => { x.save(); x.shadowBlur = 0; x.globalCompositeOperation = 'source-over'; x.fillStyle = col; x.font = size + 'px "Courier Prime",monospace'; x.textAlign = align; x.fillText(s, X, Y); x.restore(); };

  // ---------- demos ----------
  const demos = {};

  // 1. Instrument practice: mic pitch detection + target notes
  const P = { inst: 'bass', target: 40, hits: 0, streak: 0, hist: [], mic: null, an: null, buf: null, hold: 0, flash: 0, cur: null };
  const RANGE = { bass: [28, 55], keys: [48, 72], voice: [45, 67] };
  function newTarget() { const [lo, hi] = RANGE[P.inst]; let m; do { m = lo + Math.floor(Math.random() * (hi - lo)); } while (NOTE[m % 12].includes('#')); P.target = m; P.hold = 0; }
  function acf(buf, sr) {
    let rms = 0; for (const v of buf) rms += v * v; rms = Math.sqrt(rms / buf.length); if (rms < 0.012) return -1;
    const n = buf.length, c = new Float32Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += buf[j] * buf[j + i];
    let d = 0; while (d < n - 1 && c[d] > c[d + 1]) d++;
    let mx = -1, mp = -1; for (let i = d; i < n; i++) if (c[i] > mx) { mx = c[i]; mp = i; }
    if (mp <= 0) return -1; const x1 = c[mp - 1], x2 = c[mp], x3 = c[mp + 1] || x2, a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
    return sr / (a ? mp - b / (2 * a) : mp);
  }
  async function startMic() {
    const a = audio();
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); P.mic = a.createMediaStreamSource(s); P.an = a.createAnalyser(); P.an.fftSize = 2048; P.buf = new Float32Array(2048); P.mic.connect(P.an); renderPractice(); }
    catch (e) { P.err = 'mic blocked: use "hear it" instead'; renderPractice(); }
  }
  function hearTarget() { const f = mtof(P.target); P.inst === 'bass' ? tone(f, 0, { type: 'sawtooth', cutoff: 700, dur: 0.9, vol: 0.35 }) : P.inst === 'keys' ? tone(f, 0, { partials: [1, .5, .25, .12, .06], dur: 1.2, vol: 0.25 }) : tone(f, 0, { type: 'triangle', dur: 1, vol: 0.3, cutoff: 2000 }); }
  function renderPractice() {
    ctrl('practice', ['bass', 'keys', 'voice'].map(i => `<button class="tb ${P.inst === i ? 'on' : ''}" data-i="${i}">${i}</button>`).join('') +
      `<span class="tsep"></span><button class="tb hot" data-a="mic">${P.mic ? '● listening' : '🎤 use mic'}</button><button class="tb" data-a="hear">♪ hear it</button><button class="tb" data-a="skip">skip</button>${P.err ? `<span class="tnote">${P.err}</span>` : ''}`);
  }
  demos.practice = {
    init() { newTarget(); renderPractice(); on('practice', 'button', b => { audio(); if (b.dataset.i) { P.inst = b.dataset.i; newTarget(); renderPractice(); } else if (b.dataset.a === 'mic') { if (!P.mic) startMic(); } else if (b.dataset.a === 'hear') hearTarget(); else { newTarget(); } }); },
    click() { audio(); hearTarget(); },
    draw(s, x, w, h, t) {
      const [lo, hi] = RANGE[P.inst], yOf = m => h - 16 - ((m - lo) / (hi - lo)) * (h - 40);
      if (P.an) { P.an.getFloatTimeDomainData(P.buf); const f = acf(P.buf, A.sampleRate); P.cur = f > 30 && f < 1500 ? ftom(f) : null; }
      else if (P.demoUntil > t) P.cur = P.target + Math.sin(t * 9) * 0.3; else P.cur = null;
      P.hist.push(P.cur); if (P.hist.length > 140) P.hist.shift();
      for (let m = lo; m <= hi; m++) if (!NOTE[m % 12].includes('#')) { x.strokeStyle = L; x.beginPath(); x.moveTo(30, yOf(m)); x.lineTo(w - 8, yOf(m)); x.stroke(); if (m % 12 === 0 || m % 12 === 4 || m % 12 === 7) txt(x, nn(m), 4, yOf(m) + 3, '#2A3A4A', 8); }
      const ty = yOf(P.target); x.fillStyle = P.flash > t ? C : 'rgba(0,194,203,.18)'; x.fillRect(30, ty - 5, w - 38, 10);
      x.strokeStyle = C; x.lineWidth = 2; x.beginPath(); let started = false;
      P.hist.forEach((m, i) => { const px = 30 + i / 140 * (w * 0.62); if (m == null || m < lo - 3 || m > hi + 3) { started = false; return; } const y = yOf(m); started ? x.lineTo(px, y) : x.moveTo(px, y); started = true; }); x.stroke(); x.lineWidth = 1;
      if (P.cur != null) {
        const ok = Math.round(P.cur) % 12 === P.target % 12; P.hold = ok ? P.hold + 1 : Math.max(0, P.hold - 2);
        if (P.hold > 14) { P.hits++; P.streak++; P.flash = t + 0.4; tone(1320, 0, { dur: 0.15, vol: 0.12 }); tone(1980, audio().currentTime + 0.06, { dur: 0.2, vol: 0.1 }); newTarget(); }
        txt(x, nn(P.cur), w * 0.62 + 40, h / 2 + 6, ok ? C : M, 20);
      }
      txt(x, 'PLAY ' + nn(P.target), w - 10, 22, C, 14, 'right');
      txt(x, `HITS ${P.hits}`, w - 10, 38, M, 9, 'right');
      if (!P.mic) txt(x, 'plug in or sing: tap 🎤', w * 0.62 + 40, h - 12, '#2A3A4A', 8);
    }
  };

  // 2. ear.io: interval quiz with additive synthesis
  const IV = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
  const E = { q: null, opts: [], xp: 0, rank: 0, last: null, glow: 0 };
  const RANKS = ['tone-deaf', 'listener', 'hummer', 'player', 'golden ear'];
  function playIv() { if (!E.q) return; const a = audio(), t = a.currentTime, f = mtof(E.q.root); const p = [1, .5, .33, .25, .2, .16]; tone(f, t, { partials: p, dur: 0.7, vol: 0.22 }); tone(mtof(E.q.root + E.q.iv), t + 0.55, { partials: p, dur: 0.9, vol: 0.22 }); }
  function newQ() { const pool = [3, 4, 5, 7, 9, 12, 2, 10]; const iv = pool[Math.floor(Math.random() * pool.length)]; E.q = { root: 55 + Math.floor(Math.random() * 10), iv }; const o = new Set([iv]); while (o.size < 4) o.add(pool[Math.floor(Math.random() * pool.length)]); E.opts = [...o].sort((a, b) => a - b); E.last = null; renderEar(); playIv(); }
  function renderEar() { ctrl('ear', `<button class="tb hot" data-a="new">▶ ${E.q ? 'next' : 'start'}</button><button class="tb" data-a="again">↻ replay</button><span class="tsep"></span>` + E.opts.map(i => `<button class="tb ${E.last != null ? (i === E.q.iv ? 'on' : (i === E.last ? 'bad' : '')) : ''}" data-v="${i}">${IV[i]}</button>`).join('')); }
  demos.ear = {
    init() { renderEar(); on('ear', 'button', b => { audio(); if (b.dataset.a === 'new') newQ(); else if (b.dataset.a === 'again') playIv(); else if (b.dataset.v && E.last == null && E.q) { const v = +b.dataset.v; E.last = v; if (v === E.q.iv) { E.xp += 25; E.glow = performance.now() / 1000 + .6; tone(1568, 0, { dur: .2, vol: .1 }); } else { tone(110, 0, { type: 'square', dur: .2, vol: .08, cutoff: 600 }); } E.rank = Math.min(4, Math.floor(E.xp / 100)); renderEar(); setTimeout(newQ, 1100); } }); },
    click() { audio(); E.q ? playIv() : newQ(); },
    draw(s, x, w, h, t) {
      const cx = w / 2, cy = h / 2 - 4, r = Math.min(h * 0.36, 70);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 - 1.57, isAns = E.q && E.last != null && i === E.q.iv % 12, isRoot = i === 0; x.fillStyle = isAns || isRoot ? C : L; x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, isAns ? 6 : 3.5, 0, 7); x.fill(); txt(x, IV[i], cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14) + 3, '#2A3A4A', 7, 'center'); }
      if (E.q && E.last != null) { const a = (E.q.iv % 12) / 12 * 6.283 - 1.57; x.strokeStyle = C; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); }
      txt(x, E.q ? (E.last != null ? IV[E.q.iv] : '?') : 'tap ▶', cx, cy + 5, E.glow > t ? '#fff' : C, 15, 'center');
      x.fillStyle = L; x.fillRect(10, h - 14, 100, 4); x.fillStyle = C; x.fillRect(10, h - 14, (E.xp % 100), 4);
      txt(x, `XP ${E.xp} · ${RANKS[E.rank]}`, 10, h - 19, M, 8);
    }
  };

  // 3. Sample chopper: synthesized loop, 8 pads, flip
  const S = { buf: null, peaks: null, slice: -1, flipping: false, seq: [], step: 0, nextT: 0, playOrig: 0 };
  const BPM = 100, SPB = 60 / BPM, LEN = SPB * 4;
  async function makeLoop() {
    const a = audio(), sr = a.sampleRate, oc = new OfflineAudioContext(1, Math.ceil(sr * LEN), sr);
    const o = oc.createGain(); o.gain.value = 0.8; o.connect(oc.destination);
    const nb = (() => { const b = oc.createBuffer(1, sr * .3, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const e = (g, t, p, d) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(p, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + d); };
    const kick = t => { const k = oc.createOscillator(), g = oc.createGain(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(40, t + .12); k.connect(g); g.connect(o); e(g, t, .9, .4); k.start(t); k.stop(t + .5); };
    const nz = (t, ty, f, v, d) => { const n = oc.createBufferSource(); n.buffer = nb; const fl = oc.createBiquadFilter(); fl.type = ty; fl.frequency.value = f; const g = oc.createGain(); n.connect(fl); fl.connect(g); g.connect(o); e(g, t, v, d); n.start(t); n.stop(t + .3); };
    const stab = (t, ns) => ns.forEach(m => { const s = oc.createOscillator(), g = oc.createGain(), fl = oc.createBiquadFilter(); s.type = 'sawtooth'; s.frequency.value = mtof(m); fl.frequency.value = 1400; s.connect(fl); fl.connect(g); g.connect(o); e(g, t, .12, .35); s.start(t); s.stop(t + .5); });
    const s16 = SPB / 4;
    [0, 6, 10].forEach(i => kick(i * s16)); [4, 12].forEach(i => nz(i * s16, 'bandpass', 1900, .6, .2));
    for (let i = 0; i < 16; i++) nz(i * s16 + (i % 2 ? s16 * .15 : 0), 'highpass', 7500, i % 4 === 2 ? .3 : .15, .05);
    stab(2 * s16, [57, 60, 64]); stab(9 * s16, [55, 59, 62]); stab(14 * s16, [53, 57, 60]);
    S.buf = await oc.startRendering();
    const d = S.buf.getChannelData(0), N = 300; S.peaks = []; for (let i = 0; i < N; i++) { let m = 0; const a0 = Math.floor(i / N * d.length), a1 = Math.floor((i + 1) / N * d.length); for (let j = a0; j < a1; j++) m = Math.max(m, Math.abs(d[j])); S.peaks.push(m); }
  }
  function playSlice(i, t) { const a = audio(); if (!S.buf) return; const src = a.createBufferSource(); src.buffer = S.buf; const g = a.createGain(); g.connect(out); src.connect(g); const st = i * LEN / 8; src.start(t || a.currentTime, st, LEN / 8); S.slice = i; S.sliceAt = performance.now(); }
  function renderChop() { ctrl('chop', `<button class="tb" data-a="orig">▶ loop</button><button class="tb hot" data-a="flip">${S.flipping ? '■ stop' : '🎲 flip it'}</button><span class="tsep"></span>` + [...Array(8)].map((_, i) => `<button class="tb pad" data-p="${i}">${i + 1}</button>`).join('') + `<span class="tnote">or keys 1–8</span>`); }
  function schedFlip() { if (!S.flipping) return; const a = audio(); while (S.nextT < a.currentTime + 0.1) { const i = S.seq[S.step % S.seq.length]; const t = S.nextT; setTimeout(() => { S.slice = i; S.sliceAt = performance.now(); }, Math.max(0, (t - a.currentTime) * 1000)); playSlice(i, t); S.nextT += LEN / 8; S.step++; } setTimeout(schedFlip, 25); }
  demos.chop = {
    async init() { renderChop(); on('chop', 'button', async b => { audio(); if (!S.buf) await makeLoop(); if (b.dataset.p) playSlice(+b.dataset.p); else if (b.dataset.a === 'orig') { S.flipping = false; [...Array(8)].forEach((_, i) => playSlice(i, audio().currentTime + i * LEN / 8)); S.playOrig = performance.now(); renderChop(); } else { S.flipping = !S.flipping; if (S.flipping) { S.seq = [...Array(8)].map(() => Math.floor(Math.random() * 8)); S.seq[0] = 0; S.step = 0; S.nextT = audio().currentTime + .05; schedFlip(); } renderChop(); } });
      addEventListener('keydown', async e => { const n = +e.key; if (n >= 1 && n <= 8 && cards.chop.vis && !/input|textarea/i.test(document.activeElement.tagName)) { audio(); if (!S.buf) await makeLoop(); playSlice(n - 1); } }); },
    async click(s, mx) { audio(); if (!S.buf) await makeLoop(); playSlice(Math.min(7, Math.floor((mx - 10) / ((s.w - 20) / 8)))); },
    draw(s, x, w, h, t) {
      const pk = S.peaks || [...Array(300)].map((_, i) => .15 + .7 * Math.exp(-(i % 37) / 6) * (i % 37 < 10 ? 1 : .3)), bw = (w - 20) / pk.length, mid = h * 0.42, live = performance.now() - (S.sliceAt || 0) < LEN / 8 * 1000;
      pk.forEach((v, i) => { const sl = Math.floor(i / pk.length * 8); x.fillStyle = live && sl === S.slice ? C : D; const a = v * h * 0.34; x.fillRect(10 + i * bw, mid - a, Math.max(bw - .4, .5), a * 2); });
      for (let j = 0; j <= 8; j++) { const px = 10 + j * (w - 20) / 8; x.strokeStyle = live && (j === S.slice) ? C : '#2A3A4A'; x.beginPath(); x.moveTo(px, 10); x.lineTo(px, h * .78); x.stroke(); }
      if (live) { const p = (performance.now() - S.sliceAt) / (LEN / 8 * 1000), px = 10 + (S.slice + p) * (w - 20) / 8; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(px, 10); x.lineTo(px, h * .78); x.stroke(); }
      for (let j = 0; j < 8; j++) { const pw = (w - 20) / 8; x.strokeStyle = live && j === S.slice ? C : L; x.strokeRect(10 + j * pw + 2, h - 22, pw - 4, 14); txt(x, String(j + 1), 10 + j * pw + pw / 2, h - 12, live && j === S.slice ? C : '#2A3A4A', 8, 'center'); }
      if (!S.buf) txt(x, 'tap a slice to load the loop', w / 2, 20, M, 8, 'center');
    }
  };

  // 4. Generative system: probabilistic sequencer + reactive nodes
  const gr = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const G = { on: false, nodes: [...Array(26)].map(() => ({ x: gr(), y: gr(), e: 0 })), step: 0, nextT: 0, density: .5, bright: .5, scale: [0, 3, 5, 7, 10], root: 50 };
  function genTick() {
    if (!G.on) return; const a = audio(), s16 = 60 / 104 / 4;
    while (G.nextT < a.currentTime + .12) {
      const t = G.nextT, st = G.step;
      if (st % 16 === 0) { const ch = [0, 7, 10, 15].map(i => G.root + i + (Math.floor(st / 64) % 2 ? 5 : 0)); ch.forEach(m => tone(mtof(m), t, { type: 'triangle', dur: 2.2, vol: .045, cutoff: 900 + G.bright * 1200, send: .25 })); }
      if (st % 8 === 0) drum('kick', t, .35); if (st % 4 === 2) drum('hat', t, .5);
      if (gr() < .2 + G.density * .6) {
        const deg = G.scale[Math.floor(gr() * 5)], oct = gr() < .3 ? 24 : 12, m = G.root + deg + oct;
        tone(mtof(m), t, { type: 'sawtooth', dur: .18 + gr() * .3, vol: .07, cutoff: 600 + G.bright * 4000, send: .35 });
        const ni = Math.floor(gr() * G.nodes.length); setTimeout(() => { G.nodes[ni].e = 1; }, Math.max(0, (t - a.currentTime) * 1000));
      }
      G.nextT += s16; G.step++;
    }
    setTimeout(genTick, 30);
  }
  function renderGen() { ctrl('gen', `<button class="tb hot" data-a="go">${G.on ? '■ stop' : '▶ start the system'}</button><button class="tb" data-a="mut">↻ mutate</button><span class="tnote">move over it: ← → density · ↑ ↓ brightness</span>`); }
  demos.gen = {
    init() { renderGen(); on('gen', 'button', b => { audio(); if (b.dataset.a === 'go') { G.on = !G.on; if (G.on) { G.nextT = audio().currentTime + .05; genTick(); } } else { G.root = 45 + Math.floor(gr() * 10); G.scale = gr() < .5 ? [0, 3, 5, 7, 10] : [0, 2, 3, 7, 8]; } renderGen(); }); },
    click() { audio(); if (!G.on) { G.on = true; G.nextT = audio().currentTime + .05; genTick(); renderGen(); } },
    draw(s, x, w, h, t) {
      if (s.mouse) { G.density = s.mouse[0] / w; G.bright = 1 - s.mouse[1] / h; }
      const P2 = G.nodes.map((n, i) => { n.e *= .94; return [10 + n.x * (w - 20) + Math.sin(t + i) * 5, 10 + n.y * (h - 20) + Math.cos(t * 1.2 + i) * 5, n.e]; });
      P2.forEach(([px, py, e], i) => P2.forEach(([qx, qy, f], j) => { if (j <= i) return; const d = Math.hypot(px - qx, py - qy), lim = 45 + (e + f) * 60; if (d < lim) { x.strokeStyle = C; x.globalAlpha = (1 - d / lim) * (.15 + (e + f) * .5); x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); } }));
      x.globalAlpha = 1; P2.forEach(([px, py, e]) => { x.fillStyle = C; x.beginPath(); x.arc(px, py, 1.5 + e * 5, 0, 7); x.fill(); });
      txt(x, `DENSITY ${Math.round(G.density * 100)}  ·  BRIGHT ${Math.round(G.bright * 100)}`, w - 10, h - 8, M, 8, 'right');
      if (!G.on) txt(x, 'tap to start', w / 2, h / 2, M, 9, 'center');
    }
  };

  // 5. music.worlds: click a world to hear its feel
  const wr = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const WD = [
    { n: 'KINETIC HYPNOSIS', x: .2, y: .32 }, { n: 'LIQUID GROOVE', x: .52, y: .5 }, { n: 'STRANGE ATTRACTOR', x: .82, y: .3 }, { n: 'DUBBED HORIZONS', x: .28, y: .75 }, { n: 'NIGHT TRANSIT', x: .75, y: .76 }
  ].map(o => ({ ...o, p: [...Array(14)].map(() => [wr() * 6.28, .04 + wr() * .07, wr()]), e: 0 }));
  const W = { sel: -1, step: 0, nextT: 0 };
  function worldTick() {
    if (W.sel < 0) return; const a = audio(), k = W.sel, s16 = 60 / 122 / 4;
    while (W.nextT < a.currentTime + .12) {
      const t = W.nextT, s = W.step; let hit = false;
      if (k === 0) { if (s % 4 === 0) drum('kick', t, .4); const arp = [62, 65, 69, 72]; tone(mtof(arp[s % 4] - 12), t, { type: 'square', dur: .09, vol: .05, cutoff: 1400 + Math.sin(s / 8) * 900 }); hit = true; }
      if (k === 1) { const sw = s % 2 ? s16 * .28 : 0; if (s % 4 === 0) drum('kick', t, .3); if (s % 2) drum('hat', t + sw, .5); if ([0, 3, 6, 10, 11].includes(s % 16)) { tone(mtof([38, 41, 43, 45, 41][[0, 3, 6, 10, 11].indexOf(s % 16)]), t + sw, { type: 'sine', dur: .22, vol: .3 }); hit = true; } }
      if (k === 2) { if (Math.random() < .35) { tone(200 + Math.random() * 2600, t, { type: ['square', 'sawtooth', 'sine'][s % 3], dur: .03 + Math.random() * .08, vol: .06, cutoff: 6000 }); hit = true; } if (s % 6 === 0) drum('kick', t, .3); }
      if (k === 3) { if (s % 16 === 0) { [48, 55, 58, 63].forEach(m => tone(mtof(m), t, { type: 'sawtooth', dur: .25, vol: .05, cutoff: 900, send: .9 })); hit = true; } if (s % 8 === 4) drum('snare', t, .25); }
      if (k === 4) { if (s % 4 === 0) drum('kick', t, .45); if (s % 4 === 2) drum('hat', t, .6); tone(mtof([33, 33, 45, 33][s % 4]), t, { type: 'sawtooth', dur: .1, vol: .12, cutoff: 500 }); if (s % 32 === 8) { [57, 60, 64].forEach(m => tone(mtof(m), t, { type: 'triangle', dur: .5, vol: .05, send: .5 })); } hit = s % 4 === 0; }
      if (hit) setTimeout(() => WD[k].e = 1, Math.max(0, (t - a.currentTime) * 1000));
      W.nextT += s16; W.step++;
    }
    setTimeout(worldTick, 30);
  }
  demos.worlds = {
    init() { ctrl('worlds', `<span class="tnote">tap a world to hear how it feels · tap again to stop</span><a class="tb hot" href="https://daasnomem.github.io/music-worlds/" target="_blank">open music.worlds ↗</a>`); },
    click(s, mx, my) { audio(); let best = -1, bd = 1e9; WD.forEach((d, i) => { const dd = Math.hypot(mx - d.x * s.w, my - d.y * s.h); if (dd < bd) { bd = dd; best = i; } }); if (bd > 70) return; if (W.sel === best) { W.sel = -1; return; } const was = W.sel; W.sel = best; W.step = 0; W.nextT = audio().currentTime + .05; if (was < 0) worldTick(); },
    draw(s, x, w, h, t) {
      WD.forEach((W2, k) => { const cx = W2.x * w, cy = W2.y * h, act = W.sel === k; W2.e *= .9; const bloom = 1 + W2.e * .8 + (act ? .4 : 0);
        W2.p.forEach(([ph, sp, r], i) => { let px, py; const a = ph + t * sp * (k + 1) * 3 * (act ? 1.8 : 1);
          if (k === 0) { px = cx + Math.cos(a) * 18 * r * bloom; py = cy + Math.sin(a * 2) * 9 * r * bloom; } else if (k === 1) { px = cx + Math.sin(a + i) * 22 * r * bloom; py = cy + Math.sin(a * .5) * 10 * bloom; } else if (k === 2) { px = cx + (Math.random() - .5) * 16 * r * bloom; py = cy + (Math.random() - .5) * 16 * r * bloom; } else if (k === 3) { px = cx + Math.cos(a * .4) * 26 * r * bloom; py = cy + Math.sin(a * .4) * 7 * bloom; } else { px = cx + ((t * 30 * r * (act ? 2 : 1) + i * 5) % 34) - 17; py = cy + Math.sin(i) * 8 * bloom; }
          x.fillStyle = C; x.globalAlpha = (act ? .55 : .3) + r * .45; x.beginPath(); x.arc(px, py, 1.3 + r * 1.6 + W2.e, 0, 7); x.fill(); });
        x.globalAlpha = 1; txt(x, W2.n, cx, cy + 28, act ? C : M, 8, 'center'); });
    }
  };

  // 6. DIRECTOR: command → parsed plan → bots move (simulated sketch)
  const COLS = 9, ROWS = 5, WALLS = new Set(['3,0', '3,1', '3,3', '5,2', '5,3', '5,4', '7,1']);
  const AREAS = { A: [8, 0], B: [8, 4], MID: [4, 2], CT: [6, 2] };
  const CMDS = [
    { c: 'hold B site, rotate on contact', area: 'B', beh: 'hold' }, { c: 'rush A with 3, no utility', area: 'A', beh: 'rush' }, { c: 'retake mid, slow and quiet', area: 'MID', beh: 'retake' }
  ];
  const Dr = { cmd: null, bots: [], t0: 0, plan: '' };
  function bfs(s, g) { const k = p => p.join(','), q = [s], prev = { [k(s)]: null }; while (q.length) { const c = q.shift(); if (k(c) === k(g)) break; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = [c[0] + dx, c[1] + dy]; if (n[0] < 0 || n[1] < 0 || n[0] >= COLS || n[1] >= ROWS || WALLS.has(k(n)) || k(n) in prev) return; prev[k(n)] = c; q.push(n); }); } const path = []; let c = g; while (c) { path.unshift(c); c = prev[k(c)]; } return path; }
  function runCmd(i) { const C2 = CMDS[i]; Dr.cmd = C2; Dr.t0 = performance.now() / 1000; const g = AREAS[C2.area]; Dr.bots = [[0, 1], [0, 2], [0, 3]].map((s, j) => ({ path: bfs(s, [g[0], Math.max(0, Math.min(ROWS - 1, g[1] + (j - 1) * (C2.beh === 'hold' ? 0 : 1)))]), last: -1 }));
    Dr.plan = `objective: ${C2.area} · behavior: ${C2.beh} · bots: 3`; tone(880, 0, { dur: .08, vol: .08 }); tone(1320, audio().currentTime + .07, { dur: .1, vol: .08 }); }
  demos.director = {
    init() { ctrl('director', CMDS.map((c, i) => `<button class="tb" data-c="${i}">"${c.c}"</button>`).join('')); on('director', 'button', b => { audio(); runCmd(+b.dataset.c); }); },
    click() { audio(); runCmd(Math.floor(Math.random() * CMDS.length)); },
    draw(s, x, w, h, t) {
      const gx = i => 20 + i * (w - 40) / (COLS - 1), gy = j => 26 + j * (h - 56) / (ROWS - 1);
      for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) { const wl = WALLS.has(i + ',' + j); x.fillStyle = wl ? '#2A3A4A' : L; x.fillRect(gx(i) - (wl ? 5 : 1.5), gy(j) - (wl ? 5 : 1.5), wl ? 10 : 3, wl ? 10 : 3); }
      Object.entries(AREAS).forEach(([n, [i, j]]) => txt(x, n, gx(i), gy(j) - 8, Dr.cmd && Dr.cmd.area === n ? C : '#2A3A4A', 8, 'center'));
      const el = performance.now() / 1000 - Dr.t0, spd = Dr.cmd && Dr.cmd.beh === 'rush' ? 5 : Dr.cmd && Dr.cmd.beh === 'retake' ? 1.6 : 2.6;
      Dr.bots.forEach((b, bi) => { const f = Math.min(b.path.length - 1, Math.max(0, (el - .5 - bi * .25) * spd)), i = Math.floor(f), u = f - i, a = b.path[i], c = b.path[Math.min(i + 1, b.path.length - 1)];
        x.strokeStyle = C; x.globalAlpha = .3; x.beginPath(); b.path.forEach(([pi, pj], k) => k ? x.lineTo(gx(pi), gy(pj)) : x.moveTo(gx(pi), gy(pj))); x.stroke(); x.globalAlpha = 1;
        if (i !== b.last && f > 0) { b.last = i; tone(220 + bi * 40, 0, { type: 'square', dur: .03, vol: .03, cutoff: 900 }); }
        x.fillStyle = C; x.beginPath(); x.arc(gx(a[0]) + (gx(c[0]) - gx(a[0])) * u, gy(a[1]) + (gy(c[1]) - gy(a[1])) * u, 4, 0, 7); x.fill(); });
      txt(x, Dr.cmd ? '> ' + Dr.plan : '> pick an order below', 10, h - 8, Dr.cmd ? C : M, 8);
    }
  };

  // ---------- loop ----------
  Object.values(demos).forEach(d => d.init && d.init());
  fit(); addEventListener('resize', fit);
  function loop(ms) {
    const t = ms / 1000;
    Object.values(cards).forEach(s => { if (!s.vis || !s.x) return; const x = s.x, tr = s.k === 'gen' || s.k === 'worlds';
      if (tr) { x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, s.w, s.h); x.globalCompositeOperation = 'lighter'; } else x.clearRect(0, 0, s.w, s.h);
      x.shadowColor = C; x.shadowBlur = 10; try { demos[s.k].draw(s, x, s.w, s.h, t); } catch (e) { console.error(e); } x.shadowBlur = 0; x.globalCompositeOperation = 'source-over'; });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
