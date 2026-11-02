// The canyon's train: a little steam engine, its tender, three boxcars, a tank car and a red caboose. It comes out of the west
// tunnel, crosses the trestle, stops at the halt, runs on into the east tunnel, and later comes back the other way. Built in
// its own frame (+x forward, y 0 on the rails' tops); the world moves it along the line and leaves a trail of steam.

import { Builder, SURF } from './worldmat.js';

/** A triangle with its own normals, turned to face along n (the winding then never matters). */
function triN(B, a, b, c, na, nb, nc, n) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (f[0] * n[0] + f[1] * n[1] + f[2] * n[2] < 0) {
    [b, c] = [c, b];
    [nb, nc] = [nc, nb];
  }
  B.vert(a, na);
  B.vert(b, nb);
  B.vert(c, nc);
}

/** A cylinder lying along x (or z) from p, smooth sides, flat ends. */
function cylAlong(B, p, axis, len, r, seg = 12, caps = true) {
  const P = (t, a) => (axis === 'x' ? [p[0] + t, p[1] + Math.sin(a) * r, p[2] + Math.cos(a) * r] : [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, p[2] + t]);
  const Nn = (a) => (axis === 'x' ? [0, Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a), 0]);
  const ax = axis === 'x' ? [1, 0, 0] : [0, 0, 1];
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    const n0 = Nn(a0);
    const n1 = Nn(a1);
    const mid = Nn((a0 + a1) / 2);
    triN(B, P(0, a0), P(len, a0), P(len, a1), n0, n0, n1, mid);
    triN(B, P(0, a0), P(len, a1), P(0, a1), n0, n1, n1, mid);
    if (caps) {
      const c0 = axis === 'x' ? [p[0], p[1], p[2]] : [p[0], p[1], p[2]];
      const c1 = axis === 'x' ? [p[0] + len, p[1], p[2]] : [p[0], p[1], p[2] + len];
      const back = ax.map((v) => -v);
      triN(B, c0, P(0, a0), P(0, a1), back, back, back, back);
      triN(B, c1, P(len, a0), P(len, a1), ax, ax, ax, ax);
    }
  }
}

/** A pair of wheels on an axle at x, radius r, either side of the track. */
function wheels(B, x, r, hex) {
  B.color(hex).surf(SURF.plain);
  for (const z of [-0.95, 0.95]) cylAlong(B, [x, r, z - 0.09], 'z', 0.18, r, 10, true);
}

/** A bogie: two axles under a car's end. */
function bogie(B, x) {
  B.color('#2A2428').surf(SURF.plain);
  B.box(x, 0.35, 0, 2.2, 0.35, 2.1, 0);
  wheels(B, x - 0.7, 0.42, '#2E2A2C');
  wheels(B, x + 0.7, 0.42, '#2E2A2C');
}

/** A boxcar of length L whose front is at x0 (it runs back toward -x). */
function boxcar(B, x0, L, hex, seed) {
  const cx = x0 - L / 2;
  B.color('#2A2428').surf(SURF.plain);
  B.box(cx, 0.8, 0, L, 0.3, 2.5, 0);
  B.color(hex).surf(SURF.wood, seed, [0, 0, 0, 0]);
  B.box(cx, 1.1, 0, L - 0.2, 2.5, 2.6, 0);
  B.color(hex, 0.78).surf(SURF.plain);
  B.box(cx, 3.6, 0, L + 0.1, 0.18, 2.9, 0);
  // the sliding doors, a shade darker, and their rails
  B.color(hex, 0.85).surf(SURF.wood, seed + 0.3);
  for (const z of [-1.32, 1.32]) B.box(cx, 1.3, z, 1.9, 2.1, 0.06, 0);
  B.color('#3A3236').surf(SURF.plain);
  for (const z of [-1.34, 1.34]) B.box(cx, 3.35, z, 3.2, 0.1, 0.06, 0);
  bogie(B, x0 - 1.4);
  bogie(B, x0 - L + 1.4);
}

/** The whole train. Returns { geometry, length, chimney: [x, y, z] in its own frame }. */
export function trainGeometry() {
  const B = new Builder();
  const green = '#2F4A3E';
  const black = '#26242A';
  const brass = '#C9A040';
  const red = '#A83A2E';
  // ---- the engine: front at x 0
  B.color(black).surf(SURF.plain);
  B.box(-4.6, 0.75, 0, 9.4, 0.3, 2.5, 0);
  // the cowcatcher: a slatted wedge
  B.color(red);
  for (let k = 0; k < 5; k++) {
    const z = -1.0 + k * 0.5;
    B.tube([[0.95, 0.1, z], [0.05, 0.85, z * 0.85]], 0.07);
  }
  B.box(0.1, 0.6, 0, 0.3, 0.35, 2.4, 0);
  // the smokebox and the boiler
  B.color(black);
  cylAlong(B, [-1.3, 2.05, 0], 'x', 1.1, 1.02, 14, true);
  B.color(green).surf(SURF.plain);
  cylAlong(B, [-6.2, 2.05, 0], 'x', 4.9, 0.95, 14, false);
  B.color(brass);
  for (const x of [-2.4, -4.0, -5.6]) cylAlong(B, [x, 2.05, 0], 'x', 0.14, 0.98, 14, false);
  // the chimney (flared), the steam dome, the sand dome, a bell
  B.color(black);
  B.cyl(-0.75, 2.8, 0, 0.32, 0.3, 0.9, 10, false);
  B.cyl(-0.75, 3.7, 0, 0.3, 0.5, 0.45, 10, true);
  B.color(brass);
  B.blob(-3.2, 2.95, 0, 0.42, 1.0, 0, 0.7);
  B.cyl(-3.2, 2.7, 0, 0.42, 0.42, 0.3, 10, false);
  B.color(green);
  B.blob(-4.7, 2.95, 0, 0.36, 0.9, 0, 0.7);
  B.color(brass);
  B.blob(-2.2, 3.15, 0, 0.18, 1.2, 0, 0.7);
  // the headlamp: lights at dusk
  B.color('#FFE3A0').surf(SURF.lamp);
  B.box(-0.55, 3.0, 0, 0.5, 0.5, 0.5, 0);
  // the cab, its windows and roof
  B.color(green).surf(SURF.plain);
  B.box(-7.6, 1.0, 0, 2.8, 2.7, 2.7, 0);
  B.color('#141418');
  for (const z of [-1.36, 1.36]) B.box(-7.4, 2.3, z, 1.2, 0.9, 0.04, 0);
  B.box(-6.19, 2.3, -0.7, 0.04, 0.8, 0.7, 0);
  B.box(-6.19, 2.3, 0.7, 0.04, 0.8, 0.7, 0);
  B.color(black);
  B.box(-7.6, 3.7, 0, 3.3, 0.18, 3.1, 0);
  // the driving wheels (red, with a rod), small leading wheels
  for (const x of [-2.9, -4.5, -6.1]) wheels(B, x, 0.74, red);
  wheels(B, -1.1, 0.42, red);
  B.color('#8A8890');
  for (const z of [-1.08, 1.08]) B.box(-4.5, 0.55, z, 3.5, 0.12, 0.06, 0);
  // ---- the tender: a coal bunker on wheels
  const t0 = -9.6;
  B.color(black).surf(SURF.plain);
  B.box(t0 - 2.5, 0.75, 0, 5, 0.3, 2.5, 0);
  B.color(green);
  B.box(t0 - 2.5, 1.05, 0, 5, 1.9, 2.6, 0);
  B.color('#1A181C');
  B.blob(t0 - 2.3, 2.95, 0, 1.15, 0.35, 0.3, 0.8);
  B.blob(t0 - 3.4, 2.95, 0.2, 0.9, 0.3, 0.3, 0.8);
  bogie(B, t0 - 1.2);
  bogie(B, t0 - 3.8);
  // ---- three boxcars
  let x = t0 - 5.5;
  const cars = ['#8A3A2A', '#A0603A', '#6E4636'];
  for (let k = 0; k < 3; k++) {
    boxcar(B, x, 7, cars[k], 0.2 + k * 0.3);
    x -= 7.5;
  }
  // ---- a tank car
  {
    const L = 6.5;
    const cx = x - L / 2;
    B.color(black).surf(SURF.plain);
    B.box(cx, 0.8, 0, L, 0.3, 2.4, 0);
    B.color('#CFC8BC');
    cylAlong(B, [x - L + 0.3, 2.15, 0], 'x', L - 0.6, 1.1, 14, true);
    B.color('#3A3236');
    for (const xx of [cx - 1.6, cx + 1.6]) cylAlong(B, [xx, 2.15, 0], 'x', 0.12, 1.13, 14, false);
    B.cyl(cx, 3.2, 0, 0.35, 0.35, 0.3, 8, true);
    bogie(B, x - 1.3);
    bogie(B, x - L + 1.3);
    x -= L + 0.5;
  }
  // ---- the caboose: red, a cupola on its roof, lit windows
  {
    const L = 6;
    const cx = x - L / 2;
    B.color(black).surf(SURF.plain);
    B.box(cx, 0.8, 0, L + 0.6, 0.3, 2.5, 0);
    B.color('#B8402F').surf(SURF.wood, 0.7);
    B.box(cx, 1.1, 0, L - 0.6, 2.3, 2.5, 0);
    B.color('#7A2A22').surf(SURF.plain);
    B.box(cx, 3.4, 0, L, 0.16, 2.8, 0);
    B.color('#B8402F').surf(SURF.wood, 0.9);
    B.box(cx, 3.56, 0, 2.0, 1.0, 2.0, 0);
    B.color('#7A2A22').surf(SURF.plain);
    B.box(cx, 4.56, 0, 2.4, 0.14, 2.3, 0);
    B.color('#FFD890').surf(SURF.lamp);
    for (const z of [-1.27, 1.27]) for (const u of [-1.4, 0, 1.4]) B.box(cx + u, 2.2, z, 0.6, 0.6, 0.04, 0);
    for (const z of [-1.01, 1.01]) B.box(cx, 3.85, z, 0.9, 0.45, 0.04, 0);
    B.color('#3A3236').surf(SURF.plain);
    for (const xx of [cx - L / 2 + 0.05, cx + L / 2 - 0.05]) B.box(xx, 1.1, 0, 0.1, 1.2, 2.3, 0);
    bogie(B, x - 1.3);
    bogie(B, x - L + 1.3);
    x -= L;
  }
  return { geometry: B.build(), length: -x, chimney: [-0.75, 4.2, 0] };
}

// the timetable: legs of [from, to, seconds, ease] for the front of the engine, `null` legs wait out of sight
const cruise = (u, p = 0.62) => (u < p ? (u * 2) / (1 + p) : (2 * p) / (1 + p) + ((1 - p) / (1 + p)) * (1 - ((1 - u) / (1 - p)) ** 2));
const EASE = { stop: (u) => cruise(u), start: (u) => 1 - cruise(1 - u) };

/** The train's timetable on a line from x0 (west portal) to x1 (east portal), stopping with its engine at the halt. */
export function timetable(rail, length) {
  const inW = rail.x0 - 30; // engine well inside the west tunnel
  const inE = rail.x1 + length + 6; // the whole train inside the east tunnel
  const outW = rail.x0 - length - 6;
  const inE2 = rail.x1 + 30;
  const legs = [
    { from: inW, to: rail.halt + 12, dur: 38, ease: 'stop', dir: 1 },
    { from: rail.halt + 12, to: rail.halt + 12, dur: 11, dir: 1, stopped: true },
    { from: rail.halt + 12, to: inE, dur: 15, ease: 'start', dir: 1 },
    { wait: 22, dir: 1, at: inE },
    { from: inE2, to: rail.halt - 26, dur: 12, ease: 'stop', dir: -1 },
    { from: rail.halt - 26, to: rail.halt - 26, dur: 11, dir: -1, stopped: true },
    { from: rail.halt - 26, to: outW, dur: 36, ease: 'start', dir: -1 },
    { wait: 22, dir: -1, at: outW },
  ];
  const period = legs.reduce((s, l) => s + (l.dur ?? l.wait), 0);
  /** Where the engine is at time t: { x, dir, speed (0-1), stopped }. */
  return (t, out = {}) => {
    let u = ((t % period) + period) % period;
    for (const l of legs) {
      const d = l.dur ?? l.wait;
      if (u > d) {
        u -= d;
        continue;
      }
      if (l.wait) {
        out.x = l.at;
        out.dir = l.dir;
        out.speed = 0;
        out.stopped = true;
        out.hidden = true;
        return out;
      }
      const k = u / d;
      const f = l.stopped ? 0 : EASE[l.ease](k);
      const f2 = l.stopped ? 0 : EASE[l.ease](Math.min(1, k + 0.01));
      out.x = l.from + (l.to - l.from) * f;
      out.dir = l.dir;
      out.speed = Math.min(1, (Math.abs(f2 - f) * Math.abs(l.to - l.from)) / (0.01 * d) / 16);
      out.stopped = !!l.stopped;
      out.hidden = false;
      return out;
    }
    return out;
  };
}
