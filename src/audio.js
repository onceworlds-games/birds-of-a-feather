// Every sound is made here with Web Audio: wings, chirps, the hawk, bells, and a small sequencer that rises with the sunset.
// It starts on the first tap (phones need one) and never throws into the game.

const D_MAJOR_PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.music = { phase: 'title', step: 0, next: 0, lift: 0 };
    this.wingLevel = 0;
    this.windLevel = 0;
  }

  /** Call from a tap. */
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(ctx.destination);
      this.fx = ctx.createGain();
      this.fx.gain.value = 0.9;
      this.fx.connect(this.master);
      this.mus = ctx.createGain();
      this.mus.gain.value = 0.32;
      this.mus.connect(this.master);
      // a soft room for everything
      const rev = ctx.createConvolver();
      rev.buffer = this.impulse(1.8);
      this.rev = ctx.createGain();
      this.rev.gain.value = 0.25;
      this.rev.connect(rev);
      rev.connect(this.master);
      this.noise = this.noiseBuffer();
      // wingbeats: filtered noise, amplitude-modulated
      this.wing = this.loopNoise(1400, 2.2);
      this.wind = this.loopNoise(500, 0.7);
      this.ok = true;
      this.music.next = ctx.currentTime + 0.1;
    } catch {
      this.ctx = null;
      this.ok = false;
    }
  }

  impulse(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  noiseBuffer() {
    const ctx = this.ctx;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  loopNoise(freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.fx);
    src.start();
    return { src, f, g };
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(type, f0, f1, t, a, d, peak, dest = this.fx, rev = 0) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    const g = ctx.createGain();
    this.env(g, t, a, peak, d);
    o.connect(g).connect(dest);
    if (rev) {
      const s = ctx.createGain();
      s.gain.value = rev;
      g.connect(s).connect(this.rev);
    }
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  burst(t, freq, q, a, d, peak, type = 'bandpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, a, peak, d);
    src.connect(f).connect(g).connect(this.fx);
    src.start(t, Math.random());
    src.stop(t + a + d + 0.05);
  }

  safe(fn) {
    if (!this.ok) return;
    try {
      fn();
    } catch {
      /* sound is never worth a crash */
    }
  }

  /** A birdsong chirp: a short FM sweep on the pentatonic scale. */
  chirp(t, note, up = true, peak = 0.06) {
    const f = mtof(note + 12);
    this.tone('sine', up ? f * 0.8 : f * 1.25, up ? f * 1.3 : f * 0.75, t, 0.005, 0.07, peak, this.fx, 0.3);
  }

  gather(k) {
    this.safe(() => {
      const t = this.t;
      this.burst(t, 2400, 0.8, 0.003, 0.12, 0.12); // the wing-clap
      const n = Math.min(10, 2 + Math.floor(k / 3));
      for (let i = 0; i < n; i++) this.chirp(t + 0.05 + i * 0.045, D_MAJOR_PENTA[(i * 2 + Math.floor(Math.random() * 3)) % D_MAJOR_PENTA.length], true, 0.045);
    });
  }

  steal(gain, k) {
    this.safe(() => {
      const t = this.t;
      this.burst(t, 900, 0.6, 0.02, 0.3, 0.08, 'lowpass');
      const n = Math.min(8, 2 + Math.floor(k / 2));
      for (let i = 0; i < n; i++) {
        const idx = gain ? i : n - 1 - i;
        this.chirp(t + i * 0.05, D_MAJOR_PENTA[Math.min(D_MAJOR_PENTA.length - 1, idx + 2)], gain, 0.05);
      }
    });
  }

  boost() {
    this.safe(() => {
      const t = this.t;
      this.tone('sine', 140, 60, t, 0.005, 0.25, 0.25);
      this.burst(t, 600, 0.7, 0.02, 0.35, 0.12, 'lowpass');
    });
  }

  shed() {
    this.safe(() => {
      const t = this.t;
      this.tone('triangle', mtof(74), mtof(74), t, 0.01, 0.12, 0.05);
      this.tone('triangle', mtof(69), mtof(69), t + 0.12, 0.01, 0.2, 0.05);
    });
  }

  thermal() {
    this.safe(() => {
      const t = this.t;
      this.burst(t, 300, 0.5, 0.3, 0.9, 0.14, 'lowpass');
      this.tone('sine', mtof(62), mtof(74), t, 0.3, 0.8, 0.05, this.fx, 0.5);
    });
  }

  hawkCry(near) {
    this.safe(() => {
      const t = this.t;
      const p = near ? 0.16 : 0.07;
      this.tone('sawtooth', 2600, 1300, t, 0.02, 0.55, p * 0.5, this.fx, 0.6);
      this.tone('sine', 2900, 1500, t, 0.02, 0.6, p, this.fx, 0.6);
      this.burst(t, 3000, 2, 0.02, 0.5, p * 0.4);
    });
  }

  stoop() {
    this.safe(() => {
      const t = this.t;
      this.tone('sine', 700, 2400, t, 0.05, 1.1, 0.06);
      this.burst(t, 1500, 1.2, 0.6, 0.6, 0.1);
    });
  }

  strike() {
    this.safe(() => {
      const t = this.t;
      this.tone('sine', 120, 40, t, 0.003, 0.3, 0.4);
      this.burst(t, 1800, 0.5, 0.005, 0.4, 0.25);
      for (let i = 0; i < 6; i++) this.chirp(t + 0.05 + i * 0.03, D_MAJOR_PENTA[8 - i], false, 0.04);
    });
  }

  dodged() {
    this.safe(() => {
      const t = this.t;
      [74, 78, 81, 86].forEach((m, i) => this.tone('triangle', mtof(m), mtof(m), t + i * 0.06, 0.005, 0.25, 0.07, this.fx, 0.4));
    });
  }

  bell(last = false) {
    this.safe(() => {
      const t = this.t;
      const f = last ? mtof(50) : mtof(86);
      this.tone('sine', f, f, t, 0.003, last ? 3 : 0.6, last ? 0.25 : 0.06, this.fx, 0.8);
      this.tone('sine', f * 2.76, f * 2.76, t, 0.003, last ? 1.2 : 0.3, last ? 0.06 : 0.02, this.fx, 0.8);
    });
  }

  fanfare(win) {
    this.safe(() => {
      const t = this.t;
      const notes = win ? [62, 66, 69, 74, 78, 81] : [62, 66, 69, 74];
      notes.forEach((m, i) => {
        this.tone('sawtooth', mtof(m), mtof(m), t + i * 0.11, 0.02, win ? 0.7 : 1.2, 0.035, this.fx, 0.6);
        this.tone('triangle', mtof(m), mtof(m), t + i * 0.11, 0.02, win ? 0.7 : 1.2, 0.05, this.fx, 0.6);
      });
      if (win) for (let i = 0; i < 16; i++) this.chirp(t + 0.6 + Math.random() * 1.6, D_MAJOR_PENTA[Math.floor(Math.random() * D_MAJOR_PENTA.length)], Math.random() < 0.6, 0.04);
    });
  }

  tick() {
    this.safe(() => {
      const t = this.t;
      this.tone('square', 1800, 900, t, 0.001, 0.03, 0.03);
      this.burst(t, 2500, 3, 0.001, 0.04, 0.05);
    });
  }

  chime(i) {
    this.safe(() => {
      const t = this.t;
      const f = mtof(81 + i * 4);
      this.tone('sine', f, f, t, 0.003, 0.9, 0.08, this.fx, 0.7);
    });
  }

  /** A note of a Chorus: each gather in quick succession sings one step higher, in the music's key. */
  note(step) {
    this.safe(() => {
      const t = this.t;
      const i = Math.min(D_MAJOR_PENTA.length - 1, 1 + step);
      const m = D_MAJOR_PENTA[i] + 12;
      this.tone('sine', mtof(m) * 0.985, mtof(m), t, 0.008, 0.42, step > 1 ? 0.085 : 0.05, this.fx, 0.55);
      this.tone('triangle', mtof(m - 12), mtof(m - 12), t, 0.01, 0.3, 0.03, this.fx, 0.4);
      // a chord grows under it from the third note on
      if (step >= 3) this.tone('sine', mtof(m - 5), mtof(m - 5), t + 0.02, 0.01, 0.5, 0.04, this.fx, 0.6);
      if (step >= 5) this.tone('sine', mtof(m + 7), mtof(m + 7), t + 0.04, 0.01, 0.7, 0.035, this.fx, 0.7);
    });
  }

  tailwind() {
    this.safe(() => {
      const t = this.t;
      this.burst(t, 500, 0.4, 0.25, 1.4, 0.2, 'lowpass');
      this.burst(t + 0.1, 2200, 0.8, 0.4, 1.0, 0.06);
      [62, 66, 69, 74, 78].forEach((m, i) => this.tone('sine', mtof(m + 12), mtof(m + 12), t + i * 0.05, 0.01, 0.5, 0.05, this.fx, 0.7));
    });
  }

  /** A Tail cut: a snap and a run of falling chirps from the flock that lost it. */
  cut() {
    this.safe(() => {
      const t = this.t;
      this.tone('square', 900, 200, t, 0.002, 0.09, 0.08);
      this.burst(t, 3200, 1.2, 0.002, 0.18, 0.18);
      this.tone('sine', 90, 45, t, 0.003, 0.35, 0.3);
      for (let i = 0; i < 6; i++) this.chirp(t + 0.08 + i * 0.04, D_MAJOR_PENTA[3 + i], true, 0.05);
    });
  }

  scatter() {
    this.safe(() => {
      const t = this.t;
      this.tone('sine', 140, 40, t, 0.003, 0.6, 0.38);
      this.burst(t, 1200, 0.5, 0.005, 0.9, 0.24);
      for (let i = 0; i < 12; i++) this.chirp(t + 0.05 + Math.random() * 0.5, D_MAJOR_PENTA[Math.floor(Math.random() * D_MAJOR_PENTA.length)], Math.random() < 0.5, 0.045);
    });
  }

  slingshot() {
    this.safe(() => {
      const t = this.t;
      this.tone('sine', 180, 900, t, 0.01, 0.35, 0.12, this.fx, 0.3);
      this.burst(t, 900, 0.6, 0.05, 0.5, 0.14);
    });
  }

  /** A rare bird joins: a bell and a bright little song; a legendary one rings longer. */
  rare(rarity) {
    this.safe(() => {
      const t = this.t;
      const bells = rarity === 2 ? [74, 78, 81, 86, 90, 93] : rarity === 1 ? [74, 78, 81, 86] : [74, 81, 86];
      bells.forEach((m, i) => {
        this.tone('sine', mtof(m), mtof(m), t + i * 0.09, 0.003, 1.2, 0.07, this.fx, 0.8);
        this.tone('sine', mtof(m) * 2.76, mtof(m) * 2.76, t + i * 0.09, 0.003, 0.4, 0.015, this.fx, 0.8);
      });
      for (let i = 0; i < 8 + rarity * 6; i++) this.chirp(t + 0.3 + Math.random() * 0.9, D_MAJOR_PENTA[4 + Math.floor(Math.random() * 7)], Math.random() < 0.7, 0.04);
    });
  }

  goal() {
    this.safe(() => {
      const t = this.t;
      [69, 74, 78, 81].forEach((m, i) => this.tone('triangle', mtof(m), mtof(m), t + i * 0.08, 0.005, 0.5, 0.06, this.fx, 0.6));
    });
  }

  /** One line of the night's tally adding up (higher as it goes). */
  tally(i) {
    this.safe(() => {
      const t = this.t;
      const m = D_MAJOR_PENTA[Math.min(D_MAJOR_PENTA.length - 1, 2 + i)] + 12;
      this.tone('triangle', mtof(m), mtof(m), t, 0.003, 0.18, 0.05, this.fx, 0.3);
      this.burst(t, 4000, 2, 0.001, 0.04, 0.04);
    });
  }

  levelUp() {
    this.safe(() => {
      const t = this.t;
      [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => {
        this.tone('triangle', mtof(m), mtof(m), t + i * 0.07, 0.01, 0.9, 0.05, this.fx, 0.6);
        this.tone('sine', mtof(m + 12), mtof(m + 12), t + i * 0.07, 0.01, 0.6, 0.03, this.fx, 0.6);
      });
      this.tone('sine', mtof(50), mtof(50), t, 0.02, 1.8, 0.12, this.fx, 0.6);
    });
  }

  /** Each frame: wings by flock size, wind by speed, and the music. */
  update(dt, { birds = 0, speed = 14, boosting = false, phase = 'title', last30 = false, flying = false }) {
    if (!this.ok) return;
    this.safe(() => {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const wl = flying ? Math.min(0.32, 0.03 + Math.sqrt(birds) * 0.012) : 0.015;
      this.wing.g.gain.setTargetAtTime(wl, t, 0.3);
      this.wing.f.frequency.setTargetAtTime(1200 + Math.min(1200, birds * 2), t, 0.5);
      const wind = flying ? Math.min(0.3, 0.02 + Math.max(0, speed - 12) * 0.018 + (boosting ? 0.08 : 0)) : 0.01;
      this.wind.g.gain.setTargetAtTime(wind, t, 0.2);
      this.wind.f.frequency.setTargetAtTime(300 + speed * 25, t, 0.3);
      this.sequence(phase, last30);
    });
  }

  /** The sequencer: 88 BPM in D, a layer added as the light changes. */
  sequence(phase, last30) {
    const ctx = this.ctx;
    const m = this.music;
    const beat = 60 / 88 / 2; // eighth notes
    if (m.next < ctx.currentTime - 0.5) m.next = ctx.currentTime + 0.05;
    while (m.next < ctx.currentTime + 0.25) {
      this.playStep(m.step, m.next, phase, last30);
      m.step = (m.step + 1) % 64;
      m.next += beat;
    }
  }

  playStep(s, t, phase, last30) {
    const bar = Math.floor(s / 8) % 4;
    const chords = [
      [50, 57, 62, 66],
      [47, 54, 59, 62],
      [43, 50, 55, 59],
      [45, 52, 57, 61],
    ];
    const up = last30 ? 1 : 0;
    const ch = chords[bar].map((m) => m + up);
    const dest = this.mus;
    const order = ['title', 'gold', 'ember', 'rose', 'dusk', 'night'];
    const lvl = order.indexOf(phase);
    if (phase === 'night') {
      // a music-box lullaby
      if (s % 2 === 0) {
        const m = ch[(s / 2) % 4] + 24;
        this.tone('sine', mtof(m), mtof(m), t, 0.003, 0.8, 0.05, dest, 0.6);
      }
      return;
    }
    // the pad, every bar
    if (s % 8 === 0) for (const m of ch) this.tone('triangle', mtof(m + 12), mtof(m + 12), t, 0.6, 2.2, phase === 'title' ? 0.03 : 0.04, dest, 0.5);
    if (phase === 'title') {
      if (s % 16 === 6 && Math.random() < 0.6) this.chirp(t, D_MAJOR_PENTA[6 + Math.floor(Math.random() * 4)], true, 0.025);
      return;
    }
    // plucked arpeggio
    if (s % 2 === 0) {
      const m = ch[(s / 2) % 4] + 24;
      this.tone('triangle', mtof(m), mtof(m), t, 0.003, 0.25, 0.04, dest, 0.3);
    }
    if (lvl >= 2) {
      if (s % 4 === 0) this.tone('sine', mtof(ch[0] - 12), mtof(ch[0] - 12), t, 0.01, 0.35, 0.12, dest);
      if (s % 2 === 1) this.burst(t, 7000, 1, 0.002, 0.05, 0.025);
    }
    if (lvl >= 3 && s % 8 === 4) {
      // the whistled melody
      const m = D_MAJOR_PENTA[(s * 3 + bar * 2) % 7] + 12 + up;
      this.tone('sine', mtof(m), mtof(m) * 1.01, t, 0.05, 0.5, 0.035, dest, 0.5);
    }
    if (last30) {
      if (s % 4 === 0) this.tone('sine', 110, 45, t, 0.002, 0.18, 0.22, dest);
      if (s % 8 === 4) this.burst(t, 1800, 0.7, 0.002, 0.12, 0.08);
    }
  }
}
