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
      this.master.gain.value = 0.95;
      // a gentle limiter, so a big gather's chirps never clip
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(comp).connect(ctx.destination);
      this.fx = ctx.createGain();
      this.fx.gain.value = 0.9;
      this.fx.connect(this.master);
      this.mus = ctx.createGain();
      this.mus.gain.value = 0.4;
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

  /** The sequencer: 92 BPM in D with a little swing; a layer comes in as the light changes, the last half minute lifts a tone. */
  sequence(phase, last30) {
    const ctx = this.ctx;
    const m = this.music;
    const beat = 60 / 92 / 2; // eighth notes
    if (m.next < ctx.currentTime - 0.5) m.next = ctx.currentTime + 0.05;
    while (m.next < ctx.currentTime + 0.25) {
      // the off-beats lean late
      const swing = m.step % 2 === 1 ? beat * 0.16 : 0;
      this.playStep(m.step, m.total ?? 0, m.next + swing, phase, last30);
      m.step = (m.step + 1) % 64;
      m.total = (m.total ?? 0) + 1;
      m.next += beat;
    }
  }

  playStep(s, total, t, phase, last30) {
    const bar = Math.floor(s / 8);
    const half = Math.floor(total / 64) % 2; // the two tunes take turns
    const night = phase === 'night';
    const song = night ? LULLABY : SONGS[last30 ? 0 : half];
    const key = last30 ? 2 : 0;
    const ch = CHORDS[song.chords[bar]].map((n) => n + key);
    const dest = this.mus;
    const lvl = ORDER.indexOf(phase);
    if (night) {
      // a music box over a low pad, slower
      if (s % 8 === 0) this.pad(ch, t, 2.6, 600, 0.6);
      for (const [at, n, len] of song.notes) if (at === s) this.musicBox(n, t, len * 0.33);
      return;
    }
    const bright = 700 + Math.max(0, lvl) * 260 + (last30 ? 500 : 0);
    if (s % 8 === 0) this.pad(ch, t, 2.7, bright, phase === 'title' ? 0.75 : 1);
    if (phase === 'title') {
      // a tine now and then, and the birds on the wire
      if (s % 4 === 0) this.kalimba(ch[1 + ((s / 4) % 3)] + 24, t, 0.035);
      if (s % 16 === 6 && Math.random() < 0.6) this.chirp(t, D_MAJOR_PENTA[6 + Math.floor(Math.random() * 4)], true, 0.025);
      return;
    }
    // the tines: an arpeggio that walks the chord
    const arp = ARP[(bar + half) % ARP.length][s % 8];
    if (arp >= 0 && (s % 2 === 0 || lvl >= 2)) this.kalimba(ch[arp] + 24, t, s % 2 === 0 ? 0.06 : 0.035);
    // the shaker on the off-beats, then on every step at the end
    if (s % 2 === 1 || last30) this.shaker(t, s % 4 === 3 ? 0.03 : 0.018);
    if (lvl >= 2 || last30) {
      // the bass: root on the beat, a bounce to the fifth
      if (s % 4 === 0) this.bass(ch[0] - 12, t, 0.5);
      else if (s % 4 === 3 && lvl >= 3) this.bass(ch[0] - 5, t, 0.2);
      else if (last30 && s % 2 === 0) this.bass(ch[0] - 12, t, 0.18);
    }
    if (lvl >= 3 || last30) {
      // the whistled tune
      const up = last30 ? 12 : 0;
      for (const [at, n, len] of song.notes) if (at === s) this.whistle(n + key + up - 12, t, len * 0.33, last30 ? 0.1 : 0.09);
    }
    if (lvl >= 4 || last30) {
      // a soft kick, then four to the floor
      if (s % 8 === 0 || s % 8 === 4 || (last30 && s % 2 === 0)) this.kick(t, last30 ? 0.24 : 0.16);
    }
  }

  // ---- the band

  /** A warm pad: two detuned saws a note, through a lowpass, swelling in. */
  pad(ch, t, len, cutoff, k = 1) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff * 0.6, t);
    f.frequency.linearRampToValueAtTime(cutoff, t + len * 0.5);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022 * k, t + 0.7);
    g.gain.setValueAtTime(0.022 * k, t + len - 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.5);
    f.connect(g).connect(this.mus);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    g.connect(send).connect(this.rev);
    for (const n of ch) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n + 12);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.6);
      }
    }
  }

  /** A tine: a sine and its bright, quick overtone. */
  kalimba(n, t, peak) {
    this.tone('sine', mtof(n), mtof(n), t, 0.002, 0.55, peak, this.mus, 0.35);
    this.tone('sine', mtof(n) * 4.2, mtof(n) * 4.2, t, 0.001, 0.06, peak * 0.35, this.mus, 0.2);
  }

  musicBox(n, t, len) {
    this.tone('sine', mtof(n), mtof(n), t, 0.003, 0.9 + len, 0.05, this.mus, 0.6);
    this.tone('sine', mtof(n) * 3, mtof(n) * 3, t, 0.002, 0.25, 0.012, this.mus, 0.5);
  }

  bass(n, t, d) {
    this.tone('sine', mtof(n), mtof(n), t, 0.008, d, 0.13, this.mus);
    this.tone('triangle', mtof(n + 12), mtof(n + 12), t, 0.008, d * 0.6, 0.025, this.mus);
  }

  /** The whistle: a sine with a breath of vibrato that slides in from the last note. */
  whistle(n, t, len, peak) {
    const ctx = this.ctx;
    const m = this.music;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = mtof(n);
    const from = m.lastWhistle && t - m.lastWhistleT < 1.2 ? m.lastWhistle : f;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, len));
    lfo.connect(depth).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.setValueAtTime(peak, t + Math.max(0.05, len - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.18);
    o.connect(g).connect(this.mus);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    g.connect(send).connect(this.rev);
    o.start(t);
    lfo.start(t);
    o.stop(t + len + 0.25);
    lfo.stop(t + len + 0.25);
    m.lastWhistle = f;
    m.lastWhistleT = t + len;
  }

  shaker(t, peak) {
    this.burst(t, 7500, 0.9, 0.004, 0.05, peak, 'highpass');
  }

  kick(t, peak) {
    this.tone('sine', 130, 42, t, 0.002, 0.22, peak, this.mus);
  }
}

// ---- the tunes: chords a bar each, notes as [step, midi, length in steps]

const ORDER = ['title', 'gold', 'ember', 'rose', 'dusk', 'night'];
const CHORDS = {
  D: [50, 57, 62, 66],
  A: [45, 52, 57, 61],
  Bm: [47, 54, 59, 62],
  G: [43, 50, 55, 59],
  Em: [40, 47, 52, 55],
};
// which chord tone each eighth plays (-1 rests)
const ARP = [
  [0, 2, 1, 3, 2, 1, 3, 2],
  [1, 2, 3, 2, 1, 3, 2, -1],
  [0, 1, 2, 3, 3, 2, 1, 2],
];
const SONGS = [
  {
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
    notes: [
      [0, 78, 2], [2, 81, 2], [4, 83, 1], [5, 81, 1], [6, 78, 2],
      [8, 76, 3], [12, 76, 1], [13, 78, 1], [14, 76, 2],
      [16, 74, 2], [18, 78, 2], [20, 83, 2], [22, 81, 2],
      [24, 83, 6], [30, 81, 1], [31, 83, 1],
      [32, 81, 2], [34, 78, 2], [36, 81, 1], [37, 83, 1], [38, 86, 2],
      [40, 88, 2], [42, 86, 2], [44, 83, 2], [46, 81, 2],
      [48, 83, 2], [50, 81, 2], [52, 78, 2], [54, 76, 2],
      [56, 76, 4], [62, 74, 2],
    ],
  },
  {
    chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'],
    notes: [
      [0, 83, 3], [3, 86, 2], [5, 83, 1], [6, 81, 2],
      [8, 83, 4], [12, 81, 2], [14, 78, 2],
      [16, 81, 2], [18, 78, 2], [20, 74, 2], [22, 78, 1], [23, 81, 1],
      [24, 76, 6],
      [32, 78, 2], [34, 81, 2], [36, 83, 2], [38, 86, 2],
      [40, 88, 2], [42, 86, 2], [44, 83, 4],
      [48, 79, 2], [50, 83, 2], [52, 86, 4],
      [56, 85, 4], [60, 81, 4],
    ],
  },
];
const LULLABY = {
  chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D'],
  notes: [
    [0, 86, 2], [2, 81, 2], [4, 83, 2], [6, 78, 2],
    [8, 81, 2], [10, 76, 2], [12, 78, 4],
    [16, 79, 2], [18, 83, 2], [20, 81, 2], [22, 78, 2],
    [24, 76, 4], [28, 78, 2], [30, 76, 2],
    [32, 86, 2], [34, 81, 2], [36, 83, 2], [38, 86, 2],
    [40, 88, 2], [42, 86, 2], [44, 83, 4],
    [48, 83, 2], [50, 81, 2], [52, 79, 2], [54, 76, 2],
    [56, 74, 8],
  ],
};
