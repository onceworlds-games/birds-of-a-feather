// The buildings of a place, built from the map's footprints into one merged geometry: plastered walls with windows, shutters
// and doors (drawn by the surface shader), tiled gable and pyramid roofs with fascias and ridge caps, chimneys with caps,
// balconies and flower boxes, flat roofs with parapets and rooftop clutter, barns of planks, a stone quay.
// Adds to builder B; returns the places chimney smoke rises from.

import { SURF } from './worldmat.js';
import { makeRng } from '../sim/rng.js';

const SHUTTERS = 5;
const FLOWERS = ['#E8566A', '#F2A33A', '#D84A8C', '#F4E04A', '#E8E4F0', '#C83A3A'];

export function buildTown(map, B) {
  const smoke = [];
  const rng = makeRng(`${map.id}:town`);
  const L = map.look;
  let k = 0;
  for (const b of map.buildings) {
    k++;
    const seed = (k * 0.6180339) % 1;
    const wallHex = b.barn && L.barn ? L.barn : L.walls[b.wall % L.walls.length];
    const roofHex = b.barn ? L.barnRoof ?? '#6E6A66' : L.roofs[b.roofColor % L.roofs.length];
    if (b.kind === 'quay' || b.kind === 'trestle') {
      B.color(b.kind === 'quay' ? L.stone ?? '#CDB9A0' : '#7A5A40').surf(b.kind === 'quay' ? SURF.stone : SURF.wood, seed);
      B.box(b.x, b.y, b.z, b.w, b.h, b.d, b.yaw);
      if (b.kind === 'quay') quayDressing(B, b, rng);
      continue;
    }
    const shutter = Math.floor(rng.next() * SHUTTERS);
    walls(B, b, wallHex, seed, shutter);
    if (b.roof === 'gable') gableRoof(B, b, roofHex, seed);
    else if (b.roof === 'pyramid') pyramidRoof(B, b, roofHex, seed);
    else flatRoof(B, b, wallHex, roofHex, seed, rng);
    // chimneys
    if (b.roof === 'gable' && (b.chimney || rng.next() < 0.3)) {
      const along = b.w >= b.d;
      const c = Math.cos(b.yaw);
      const s = Math.sin(b.yaw);
      const u = (along ? b.w : b.d) * (rng.next() < 0.5 ? -0.28 : 0.28);
      const v = (along ? b.d : b.w) * 0.12 * (rng.next() < 0.5 ? -1 : 1);
      const lu = along ? u : v;
      const lv = along ? v : u;
      const cx = b.x + c * lu + s * lv;
      const cz = b.z + s * lu - c * lv;
      const base = b.y + b.h;
      const ch = b.roofH + 1.3;
      B.color(wallHex, 0.92).surf(SURF.wall, seed, [1, ch, 0, 8]);
      B.box(cx, base, cz, 0.85, ch, 0.85, b.yaw);
      B.color('#6A5048').surf(SURF.plain);
      B.box(cx, base + ch, cz, 1.05, 0.22, 1.05, b.yaw);
      B.color('#3A2E2A');
      B.box(cx, base + ch + 0.22, cz, 0.5, 0.05, 0.5, b.yaw);
      if (b.chimney && rng.next() < 0.4) smoke.push([cx, base + ch + 0.4, cz]);
    }
    if (b.kind === 'house' && b.roof === 'gable') houseDressing(B, b, rng);
  }
  return { smoke };
}

const frame = (b) => {
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return (u, v, yy) => [b.x + c * u + s * v, b.y + yy, b.z + s * u - c * v];
};

/** Four walls (and the gable ends' triangles), plaster with windows; a house's doors face the street (its v sides). */
function walls(B, b, hex, seed, shutter) {
  const P = frame(b);
  const hw = b.w / 2;
  const hd = b.d / 2;
  const h = b.h;
  const corners = [P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, hd, 0), P(-hw, hd, 0)];
  const lens = [b.w, b.d, b.w, b.d];
  const along = b.w >= b.d;
  const style = b.barn ? 8 : b.kind === 'block' ? 5 : b.kind === 'church' ? 6 : b.kind === 'tower' ? 7 : shutter;
  for (let f = 0; f < 4; f++) {
    const a = corners[f];
    const c = corners[(f + 1) % 4];
    const len = lens[f];
    const street = f % 2 === 0;
    const gableEnd = along ? !street : street;
    const door = (b.kind === 'house' && street) || (b.kind === 'church' && !along && f === 0) || (b.kind === 'church' && along && f === 1) ? 1 : 0;
    B.color(hex).surf(b.barn ? SURF.wood : SURF.wall, seed + f * 0.13, [len, h, door, style]);
    const at = [a[0], a[1] + h, a[2]];
    const ct = [c[0], c[1] + h, c[2]];
    B.quad(a, c, ct, at, [[0, 0], [len, 0], [len, h], [0, h]]);
    // gable ends: the triangle up to the ridge, plain (no windows above the top storey)
    if (b.roof === 'gable' && gableEnd) {
      const apex = [(a[0] + c[0]) / 2, a[1] + h + b.roofH - 0.1, (a[2] + c[2]) / 2];
      B.surf(b.barn ? SURF.wood : SURF.wall, seed + f * 0.13, [len, h, 0, 8]);
      B.tri(at, ct, apex, [0, h], [len, h], [len / 2, h + b.roofH]);
    }
  }
}

/** A gable roof with a little overhang, a fascia under its eaves and a ridge cap; barrel tiles on both slopes. */
function gableRoof(B, b, hex, seed) {
  const along = b.w >= b.d;
  const yaw = b.yaw + (along ? 0 : Math.PI / 2);
  const Lh = (along ? b.w : b.d) / 2 + 0.45;
  const Sh = (along ? b.d : b.w) / 2 + 0.55;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const base = b.y + b.h - 0.12;
  const P = (u, v, yy) => [b.x + c * u + s * v, base + yy, b.z + s * u - c * v];
  const H = b.roofH + 0.12;
  const e0 = P(-Lh, -Sh, 0);
  const e1 = P(Lh, -Sh, 0);
  const e2 = P(Lh, Sh, 0);
  const e3 = P(-Lh, Sh, 0);
  const r0 = P(-Lh, 0, H);
  const r1 = P(Lh, 0, H);
  const slope = Math.hypot(Sh, H);
  B.color(hex).surf(SURF.roof, seed);
  B.quad(e0, e1, r1, r0, [[0, slope], [2 * Lh, slope], [2 * Lh, 0], [0, 0]]);
  B.quad(e2, e3, r0, r1, [[2 * Lh, slope], [0, slope], [0, 0], [2 * Lh, 0]]);
  // fascias
  B.color(hex, 0.62).surf(SURF.plain);
  const drop = 0.2;
  B.quad(P(-Lh, -Sh, -drop), P(Lh, -Sh, -drop), e1, e0);
  B.quad(P(Lh, Sh, -drop), P(-Lh, Sh, -drop), e3, e2);
  // the gable edges' thickness
  B.tri(P(-Lh, -Sh, -drop), e0, r0);
  B.tri(P(-Lh, -Sh, -drop), r0, P(-Lh, 0, H - drop));
  B.tri(P(-Lh, Sh, -drop), P(-Lh, 0, H - drop), r0);
  B.tri(P(-Lh, Sh, -drop), r0, e3);
  B.tri(P(Lh, -Sh, -drop), r1, e1);
  B.tri(P(Lh, -Sh, -drop), P(Lh, 0, H - drop), r1);
  B.tri(P(Lh, Sh, -drop), r1, P(Lh, 0, H - drop));
  B.tri(P(Lh, Sh, -drop), e2, r1);
  // ridge cap
  B.color(hex, 0.78);
  const w = 0.2;
  const k = w / Sh;
  B.quad(P(-Lh, -w, H - k * H + 0.04), P(Lh, -w, H - k * H + 0.04), P(Lh, 0, H + 0.14), P(-Lh, 0, H + 0.14));
  B.quad(P(Lh, w, H - k * H + 0.04), P(-Lh, w, H - k * H + 0.04), P(-Lh, 0, H + 0.14), P(Lh, 0, H + 0.14));
}

function pyramidRoof(B, b, hex, seed) {
  const P = frame(b);
  const hw = b.w / 2 + 0.35;
  const hd = b.d / 2 + 0.35;
  const y = b.h - 0.1;
  const corners = [P(-hw, -hd, y), P(hw, -hd, y), P(hw, hd, y), P(-hw, hd, y)];
  const apex = P(0, 0, y + b.roofH);
  B.color(hex).surf(SURF.roof, seed);
  for (let f = 0; f < 4; f++) {
    const a = corners[f];
    const c = corners[(f + 1) % 4];
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const slant = Math.hypot(len / 2, b.roofH);
    B.tri(a, c, apex, [0, slant], [len, slant], [len / 2, 0]);
  }
  B.color('#C8A050').surf(SURF.plain);
  B.cyl(apex[0], apex[1] - 0.2, apex[2], 0.12, 0.02, 1.6, 5, false);
}

/** A flat roof: a slab, a parapet, and on bigger roofs a water tank, a skylight or a vent. */
function flatRoof(B, b, wallHex, roofHex, seed, rng) {
  const P = frame(b);
  const top = b.h;
  B.color('#B8AA98').surf(SURF.stone, seed);
  B.box(b.x, b.y + top - 0.05, b.z, b.w - 0.2, 0.12, b.d - 0.2, b.yaw);
  B.color(wallHex, 0.95).surf(SURF.plain);
  const t = 0.3;
  const ph = 0.55;
  for (const [u, v, w, d] of [
    [0, -b.d / 2 + t / 2, b.w, t],
    [0, b.d / 2 - t / 2, b.w, t],
    [-b.w / 2 + t / 2, 0, t, b.d],
    [b.w / 2 - t / 2, 0, t, b.d],
  ]) {
    const p = P(u, v, 0);
    B.box(p[0], b.y + top, p[2], w, ph, d, b.yaw);
  }
  if (b.w * b.d > 60 && rng.next() < 0.7) {
    const p = P((rng.next() - 0.5) * b.w * 0.4, (rng.next() - 0.5) * b.d * 0.4, 0);
    if (rng.next() < 0.5) {
      B.color('#6A5A50').surf(SURF.wood, seed);
      B.cyl(p[0], b.y + top + 1.1, p[2], 1.1, 1.1, 1.6, 8, true);
      B.color('#4A3E38').surf(SURF.plain);
      B.cyl(p[0], b.y + top + 2.7, p[2], 1.2, 0.2, 0.5, 8, false);
      for (const [du, dv] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) {
        const q = P(0, 0, 0);
        B.box(p[0] + du, b.y + top, p[2] + dv, 0.12, 1.15, 0.12, b.yaw);
        void q;
      }
    } else {
      B.color(roofHex, 0.9).surf(SURF.plain);
      B.box(p[0], b.y + top, p[2], 1.8, 0.9, 1.4, b.yaw);
      B.color('#3A4A58').surf(SURF.lamp);
      B.box(p[0], b.y + top + 0.9, p[2], 1.3, 0.08, 0.9, b.yaw);
    }
  }
}

/** Flower boxes under some upper windows on the street sides, and now and then a balcony. */
function houseDressing(B, b, rng) {
  const P = frame(b);
  const W = b.w;
  const n = Math.max(1, Math.floor(W / 2.5));
  const sp = W / n;
  for (const side of [-1, 1]) {
    if (rng.next() < 0.3) continue;
    const out = side * (b.d / 2 + 0.2);
    for (let level = 1; level * 2.9 + 2.1 < b.h - 0.55; level++) {
      for (let col = 0; col < n; col++) {
        if (rng.next() < 0.45) continue;
        const u0 = -W / 2 + (col + 0.5) * sp;
        // the far wall's u runs the other way; mirror so the box sits under the shader's window
        const u = side < 0 ? u0 : -u0;
        const y = level * 2.9 + 0.85 - 0.42;
        const pt = P(u, out, y);
        B.color('#7A5A44').surf(SURF.wood, rng.next());
        B.box(pt[0], pt[1], pt[2], 1.0, 0.3, 0.38, b.yaw);
        B.color(FLOWERS[Math.floor(rng.next() * FLOWERS.length)]).surf(SURF.leaf, rng.next(), [0, 0, 0, 0]);
        for (let f = 0; f < 3; f++) {
          const q = P(u + (f - 1) * 0.3, out, y + 0.42);
          B.blob(q[0], q[1], q[2], 0.2, 0.8, 0.2, 0.8);
        }
      }
    }
    // a balcony on a house of two storeys or more
    if (b.h > 6.6 && rng.next() < 0.35) {
      const col = Math.floor(rng.next() * n);
      const u0 = -W / 2 + (col + 0.5) * sp;
      const u = side < 0 ? u0 : -u0;
      const y = 2.9 + 0.7;
      const c = P(u, side * (b.d / 2 + 0.55), y);
      B.color('#D8CCBC').surf(SURF.stone, rng.next());
      B.box(c[0], c[1], c[2], 1.9, 0.16, 1.1, b.yaw);
      B.color('#2E2A30').surf(SURF.plain);
      const r = P(u, side * (b.d / 2 + 1.05), y + 0.16);
      B.box(r[0], r[1], r[2], 1.9, 0.75, 0.06, b.yaw);
      for (const e of [-0.92, 0.92]) {
        const q = P(u + e, side * (b.d / 2 + 0.6), y + 0.16);
        B.box(q[0], q[1], q[2], 0.06, 0.75, 0.95, b.yaw);
      }
    }
  }
}

function quayDressing(B, b, rng) {
  const P = frame(b);
  for (let i = 0; i < 4; i++) {
    const p = P((rng.next() - 0.5) * b.w * 0.8, (rng.next() - 0.5) * b.d * 0.5, b.h);
    if (rng.next() < 0.5) {
      B.color('#8A6040').surf(SURF.wood, rng.next());
      B.cyl(p[0], p[1], p[2], 0.42, 0.42, 0.9, 7, true);
    } else {
      B.color('#9A7A52').surf(SURF.wood, rng.next());
      B.box(p[0], p[1], p[2], 0.9, 0.8, 0.9, rng.next() * 3);
    }
  }
  // bollards along the edge
  B.color('#3A3438').surf(SURF.plain);
  for (let u = -b.w / 2 + 2; u < b.w / 2 - 1; u += 4) {
    const p = P(u, b.d / 2 - 0.5, b.h);
    B.cyl(p[0], p[1], p[2], 0.2, 0.24, 0.5, 6, true);
  }
}
