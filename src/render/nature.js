// Trees: rounded crowns made of clustered clumps that sway, tall flame-shaped cypresses, low wide junipers; tapered trunks.

import { Builder, SURF } from './worldmat.js';
import { makeRng } from '../sim/rng.js';

const CROWNS = {
  saltmere: { round: ['#5F7D3A', '#6A8A40', '#557334'], cypress: ['#3B5A2E', '#34502A'] },
  redrock: { round: ['#7E8A4E', '#8C9656', '#6F7C44'], juniper: ['#6E7C4C', '#7A8550', '#66724A'] },
  stormfield: { round: ['#5A7838', '#647F3C', '#4F6C32'] },
  lantern: { round: ['#5E7E3E', '#6B8A44', '#557236'] },
};

export function buildTrees(map, quality) {
  const B = new Builder();
  const rng = makeRng(`${map.id}:trees`);
  const pal = CROWNS[map.id] ?? CROWNS.saltmere;
  const rich = quality !== 'low';
  for (const t of map.trees) {
    const greens = pal[t.kind] ?? pal.round;
    const hex = greens[Math.floor(rng.next() * greens.length)];
    const k = 0.9 + rng.next() * 0.2;
    const sway = [0.022, t.y + t.h * 0.3, 0, 0];
    if (t.kind === 'cypress') {
      B.color('#5A4030').surf(SURF.wood, rng.next());
      B.cyl(t.x, t.y, t.z, 0.24, 0.16, t.h * 0.3, 5, false);
      B.color(hex, k).surf(SURF.leaf, rng.next(), sway);
      const r = t.r * 1.05;
      const sy = (t.h * 0.46) / r;
      B.blob(t.x, t.y + t.h * 0.54, t.z, r, sy, 0.1, 0.62);
      if (rich) {
        B.color(hex, k * 1.08);
        B.blob(t.x + rng.range(-0.3, 0.3), t.y + t.h * 0.42, t.z + rng.range(-0.3, 0.3), r * 0.85, sy * 0.7, 0.14, 0.6);
      }
      continue;
    }
    if (t.kind === 'juniper') {
      B.color('#6A5038').surf(SURF.wood, rng.next());
      B.cyl(t.x, t.y, t.z, 0.2, 0.12, t.h * 0.35, 5, false);
      B.color(hex, k).surf(SURF.leaf, rng.next(), sway);
      const n = rich ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = i ? t.r * 0.45 : 0;
        B.blob(t.x + Math.cos(a) * d, t.y + t.h * (i ? 0.38 : 0.5), t.z + Math.sin(a) * d, t.r * (i ? 0.7 : 0.95), 0.72, 0.18, 0.6);
      }
      continue;
    }
    // a broadleaf: a trunk that forks, a crown of clumps, the top ones lighter
    B.color('#6B4A34').surf(SURF.wood, rng.next());
    B.cyl(t.x, t.y, t.z, 0.3, 0.2, t.h * 0.5, 6, false);
    const crownY = t.y + t.h - t.r * 0.95;
    B.color(hex, k).surf(SURF.leaf, rng.next(), sway);
    B.blob(t.x, crownY, t.z, t.r * 0.95, 0.88, 0.12, 0.58);
    if (rich) {
      const n = 4;
      const a0 = rng.range(0, Math.PI * 2);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const d = t.r * rng.range(0.5, 0.65);
        B.color(hex, k * rng.range(0.92, 1.06));
        B.blob(t.x + Math.cos(a) * d, crownY - t.r * rng.range(0.15, 0.35), t.z + Math.sin(a) * d, t.r * rng.range(0.55, 0.7), 0.85, 0.15, 0.55);
      }
      B.color(hex, k * 1.12);
      B.blob(t.x + rng.range(-0.4, 0.4), crownY + t.r * 0.4, t.z + rng.range(-0.4, 0.4), t.r * 0.6, 0.8, 0.12, 0.7);
    }
  }
  return B.build();
}
