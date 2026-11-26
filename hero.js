// Hero: a field of strings you can strum with the cursor.
(function () {
  const hero = document.querySelector('.hero'), c = document.getElementById('waveCanvas'), x = c.getContext('2d');
  const btn = document.getElementById('heroSound');
  const N = 32, SCALE = [0, 3, 5, 7, 10], ROOT = 38;
  let W, H, dpr, strings = [], mouse = null, last = null, A = null, out, dly, soundOn = false;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function setup() {
    dpr = devicePixelRatio || 1; W = c.offsetWidth; H = c.offsetHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    strings = [...Array(N)].map((_, i) => { const deg = i % 5, oct = Math.floor(i / 5); return { x: W * (0.04 + 0.92 * i / (N - 1)), amp: 0, ph: Math.random() * 6, f: 0.9 + i * 0.12, midi: ROOT + SCALE[deg] + 12 * oct, lit: 0 }; });
  }
  function audio() {
    if (A) { A.state === 'suspended' && A.resume(); return; }
    A = new (window.AudioContext || window.webkitAudioContext)();
    const comp = A.createDynamicsCompressor(); out = A.createGain(); out.gain.value = .7; out.connect(comp); comp.connect(A.destination);
    dly = A.createDelay(1); dly.delayTime.value = .33; const fb = A.createGain(); fb.gain.value = .38; const lp = A.createBiquadFilter(); lp.frequency.value = 2200;
    dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(out);
  }
  function pluck(s, vel, bright) {
    s.amp = Math.min(26, s.amp + 10 + vel * 14); s.lit = 1;
    if (!soundOn || !A) return;
    const t = A.currentTime, o = A.createOscillator(), o2 = A.createOscillator(), f = A.createBiquadFilter(), g = A.createGain(), send = A.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = mtof(s.midi); o2.frequency.value = mtof(s.midi) * 1.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(400 + bright * 5000, t); f.frequency.exponentialRampToValueAtTime(220, t + 1.2); f.Q.value = 4;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(out); send.gain.value = .35; g.connect(send); send.connect(dly);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12 * (0.5 + vel), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
    o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
  }
  hero.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top];
    if (last) { const vel = Math.min(1, Math.abs(p[0] - last[0]) / 40); strings.forEach(s => { if ((last[0] - s.x) * (p[0] - s.x) < 0) pluck(s, vel, 1 - p[1] / H); }); }
    last = p; mouse = p;
  });
  hero.addEventListener('pointerleave', () => { last = null; mouse = null; });
  btn.addEventListener('click', e => { e.stopPropagation(); soundOn = !soundOn; if (soundOn) audio(); btn.classList.toggle('on', soundOn); btn.querySelector('span').textContent = soundOn ? 'sound on · strum the strings' : 'sound off · tap to play'; });
  function draw(ms) {
    const t = ms / 1000; x.clearRect(0, 0, W, H);
    strings.forEach((s, i) => {
      s.amp *= 0.965; s.lit *= 0.95; const idle = 1.2 + Math.sin(t * .6 + i * .4) * .8;
      x.beginPath(); x.lineWidth = 1 + s.lit * 1.2; x.strokeStyle = s.lit > .05 ? `rgba(0,194,203,${.25 + s.lit * .75})` : 'rgba(0,194,203,.16)';
      x.shadowColor = '#00C2CB'; x.shadowBlur = s.lit * 18;
      for (let y = 0; y <= H; y += 6) {
        const env = Math.sin(Math.PI * y / H); let dx = Math.sin(y * 0.02 * s.f + t * (8 + s.f * 4)) * (s.amp + idle) * env;
        if (mouse) { const d = Math.hypot(mouse[0] - s.x, mouse[1] - y); if (d < 120) dx += (s.x - mouse[0]) * (1 - d / 120) * .12; }
        y ? x.lineTo(s.x + dx, y) : x.moveTo(s.x + dx, y);
      }
      x.stroke();
    });
    x.shadowBlur = 0; requestAnimationFrame(draw);
  }
  setup(); addEventListener('resize', setup); requestAnimationFrame(draw);
})();
