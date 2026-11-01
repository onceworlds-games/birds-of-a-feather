// The flock's shape: the rules don't follow birds one by one. A flock of n birds trails its leader by T seconds of the path the
// leader just flew, as 8 puffs (spheres) with a dense head and a thin tail. Stealing, the hawk's strike and the drawing of every
// bird all use this same shape.

import { FLOCK, PUFF_SHARE } from './config.js';

/** The leader's recent path: positions sampled at FLOCK.trailHz, kept FLOCK.trailSeconds. */
export class Trail {
  constructor() {
    this.cap = Math.ceil(FLOCK.trailHz * FLOCK.trailSeconds) + 4;
    this.t = new Float64Array(this.cap);
    this.x = new Float32Array(this.cap);
    this.y = new Float32Array(this.cap);
    this.z = new Float32Array(this.cap);
    this.n = 0;
    this.head = 0; // index of the newest
  }

  clear() {
    this.n = 0;
    this.head = 0;
  }

  /**
   * Add a point (time must not go back). Kept points are at least a sample apart: the newest follows the leader until it is a
   * sample past the point before it, and the next push after that starts a new newest. Any push rate keeps trailSeconds.
   */
  push(t, x, y, z) {
    if (this.n > 0) {
      const lt = this.t[this.head];
      if (t < lt) return;
      const settled = this.n > 1 ? lt - this.t[(this.head - 1 + this.cap) % this.cap] >= 1 / FLOCK.trailHz : t - lt >= 1e-6;
      if (!settled || t - lt < 1e-6) {
        this.t[this.head] = t;
        this.x[this.head] = x;
        this.y[this.head] = y;
        this.z[this.head] = z;
        return;
      }
    }
    this.head = (this.head + 1) % this.cap;
    this.t[this.head] = t;
    this.x[this.head] = x;
    this.y[this.head] = y;
    this.z[this.head] = z;
    if (this.n < this.cap) this.n++;
  }

  /** Start the path again at one point (a spawn, a teleport). */
  reset(t, x, y, z) {
    this.clear();
    this.push(t, x, y, z);
  }

  newest(out) {
    out.x = this.x[this.head];
    out.y = this.y[this.head];
    out.z = this.z[this.head];
    out.t = this.t[this.head];
    return out;
  }

  /** The position at time tq (interpolated; clamped to the oldest and newest points). */
  sample(tq, out) {
    if (this.n === 0) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      return out;
    }
    let i = this.head;
    if (tq >= this.t[i] || this.n === 1) {
      out.x = this.x[i];
      out.y = this.y[i];
      out.z = this.z[i];
      return out;
    }
    for (let k = 1; k < this.n; k++) {
      const j = (i - 1 + this.cap) % this.cap;
      if (this.t[j] <= tq) {
        const span = this.t[i] - this.t[j];
        const a = span > 1e-6 ? (tq - this.t[j]) / span : 0;
        out.x = this.x[j] + (this.x[i] - this.x[j]) * a;
        out.y = this.y[j] + (this.y[i] - this.y[j]) * a;
        out.z = this.z[j] + (this.z[i] - this.z[j]) * a;
        return out;
      }
      i = j;
    }
    out.x = this.x[i];
    out.y = this.y[i];
    out.z = this.z[i];
    return out;
  }
}

/** How many seconds of path the flock trails over. A boosting leader strings it out by itself: the same seconds cover more sky. */
export function flockLength(n) {
  return FLOCK.lengthBase + FLOCK.lengthPerSqrt * Math.sqrt(Math.max(0, n));
}

export const puffRadius = (birds) => FLOCK.puffRadiusBase + FLOCK.puffRadiusPerSqrt * Math.sqrt(Math.max(0, birds));

/** Fill `puffs` (an array of 8 { x, y, z, r, birds }) for a flock of n trailing `trail`, its head at time t. */
export function shapeOf(trail, n, t, puffs) {
  const T = flockLength(n);
  for (let k = 0; k < FLOCK.puffs; k++) {
    const u = (k + 0.5) / FLOCK.puffs;
    const p = puffs[k];
    trail.sample(t - u * T, p);
    p.birds = n * PUFF_SHARE[k];
    p.r = puffRadius(p.birds);
  }
  return puffs;
}

export const newPuffs = () => Array.from({ length: FLOCK.puffs }, () => ({ x: 0, y: 0, z: 0, r: 0, birds: 0 }));

/** Distance with the vertical counted at FLOCK.vertical. */
export function dist3(ax, ay, az, bx, by, bz) {
  const dx = ax - bx;
  const dy = (ay - by) * FLOCK.vertical;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** A flock's birds near point P: each puff's birds × max(0, 1 − distance / kernel). */
export function localCount(puffs, px, py, pz, kernel) {
  let sum = 0;
  for (let k = 0; k < puffs.length; k++) {
    const p = puffs[k];
    const d = dist3(p.x, p.y, p.z, px, py, pz);
    if (d < kernel) sum += p.birds * (1 - d / kernel);
  }
  return sum;
}

/**
 * The deepest overlap between two flocks' puffs: { depth, x, y, z } (the contact point, between the two puffs' centres in
 * proportion to their radii), or null when they don't touch.
 */
export function contactOf(a, b, out) {
  let best = 0;
  let found = false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    if (p.birds <= 0.05) continue;
    for (let j = 0; j < b.length; j++) {
      const q = b[j];
      if (q.birds <= 0.05) continue;
      const d = dist3(p.x, p.y, p.z, q.x, q.y, q.z);
      const depth = p.r + q.r - d;
      if (depth > best) {
        best = depth;
        found = true;
        const w = p.r / (p.r + q.r);
        out.x = p.x + (q.x - p.x) * w;
        out.y = p.y + (q.y - p.y) * w;
        out.z = p.z + (q.z - p.z) * w;
      }
    }
  }
  if (!found) return null;
  out.depth = best;
  return out;
}

/** A bounding sphere of a flock's puffs (a quick test before contactOf). */
export function boundsOf(puffs, out) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of puffs) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  x /= puffs.length;
  y /= puffs.length;
  z /= puffs.length;
  let r = 0;
  for (const p of puffs) r = Math.max(r, dist3(p.x, p.y, p.z, x, y, z) + p.r);
  out.x = x;
  out.y = y;
  out.z = z;
  out.r = r;
  return out;
}
