// Trees: rounded crowns made of clustered clumps that sway, tall flame-shaped cypresses, low wide junipers, pale cottonwoods
// along the canyon's washes, silver dead snags; tapered trunks.

import { Builder, SURF } from './worldmat.js';
import { makeRng } from '../sim/rng.js';
import { groundAt } from '../sim/maps.js';

const CROWNS = {
  saltmere: { round: ['#5F7D3A', '#6A8A40', '#557334'], cypress: ['#3B5A2E', '#34502A'] },
  redrock: { round: ['#7E8A4E', '#8C9656', '#6F7C44'], juniper: ['#5F6E48', '#6E7A4C', '#56653F', '#7A8452'], cottonwood: ['#93A24C', '#A2AE58', '#87984A'] },
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
    if (t.kind === 'snag') {
      // a dead tree, bleached: a leaning trunk and a few bare limbs reaching up and out
      B.color('#A89C8C', k).surf(SURF.wood, rng.next());
      B.cyl(t.x, t.y, t.z, 0.32, 0.12, t.h * 0.82, 6, false);
      const n = rich ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2);
        const y0 = t.y + t.h * rng.range(0.35, 0.7);
        const len = t.h * rng.range(0.3, 0.45);
        const mid = [t.x + Math.cos(a) * len * 0.45, y0 + len * 0.45, t.z + Math.sin(a) * len * 0.45];
        const tip = [t.x + Math.cos(a + 0.4) * len * 0.8, y0 + len * 0.95, t.z + Math.sin(a + 0.4) * len * 0.8];
        B.color('#9A8E80', k);
        B.tube([[t.x, y0, t.z], mid, tip], 0.11);
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
  if (map.id === 'redrock') sagebrush(B, map, rng, rich ? 1500 : 600);
  return B.build();
}

/** The canyon's flats: low grey-green sage and rabbitbrush scattered everywhere the ground is level and open. */
function sagebrush(B, map, rng, count) {
  const greens = ['#8E9470', '#7E8664', '#A0A27E', '#9A9A6C', '#B4A86A'];
  const roads = map.streets.flat();
  const rail = map.rail;
  for (let k = 0, tries = 0; k < count && tries < count * 4; tries++) {
    const x = rng.range(-300, 300);
    const z = rng.range(-300, 300);
    const y = groundAt(map, x, z);
    if (y < 6) continue;
    const slope = Math.max(Math.abs(groundAt(map, x + 1.5, z) - groundAt(map, x - 1.5, z)), Math.abs(groundAt(map, x, z + 1.5) - groundAt(map, x, z - 1.5)));
    if (slope > 1.2) continue;
    if (rail && Math.abs(z - rail.z) < 6) continue;
    if (roads.some(([rx, rz]) => Math.abs(rx - x) + Math.abs(rz - z) < 8)) continue;
    if (map.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.d) / 2 + 2)) continue;
    const r = rng.range(0.45, 1.0);
    const hex = greens[Math.floor(rng.next() * greens.length)];
    B.color(hex, 0.9 + rng.next() * 0.2).surf(SURF.leaf, rng.next(), [0.015, y, 0, 0]);
    B.cyl(x, y - 0.15, z, r * 0.8, r, r * 0.55, 6, false);
    B.cyl(x, y + r * 0.4, z, r, r * 0.45, r * 0.45, 6, true);
    k++;
  }
}
