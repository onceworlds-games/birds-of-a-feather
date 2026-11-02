// The things that make a place: boats that bob at their moorings, a lighthouse whose beam turns at dusk, windmills with
// turning sails, lattice pylons, silos, hay bales, water towers, cairns; in the canyon hoodoos, fallen boulders, a ranch's
// corrals and wind pump, the railway's track, tunnel portals and halt; in the harbour town a fountain, market stalls,
// street lamps and washing strung across the lanes. Static pieces go into the town's builder; moving ones are meshes.

import * as THREE from 'three';
import { Builder, SURF } from './worldmat.js';
import { makeRng } from '../sim/rng.js';
import { groundAt } from '../sim/maps.js';

const HULLS = ['#2D6C8A', '#C0563A', '#F2E6D0', '#3F7A5A', '#E0A840'];
const CLOTH = ['#C83A3A', '#2E6CA8', '#E8B83A', '#3E8A5A', '#E07A2E', '#8A3A8A'];
const LAUNDRY = ['#F4F0E6', '#E8566A', '#5A8AC8', '#F2C84A', '#FFFFFF', '#88C0A0', '#E8A0B0'];

/** Static props into builder B. Returns the moving ones' definitions. */
export function buildProps(B, map) {
  const rng = makeRng(`${map.id}:props`);
  const moving = { boats: [], sails: [], beams: [], smoke: [], fans: [] };
  for (const p of map.props) {
    switch (p.kind) {
      case 'boat':
        moving.boats.push(p);
        break;
      case 'lighthouse':
        lighthouse(B, p);
        moving.beams.push({ x: p.x, y: p.y + 22.8, z: p.z });
        break;
      case 'windmill':
        windmill(B, p);
        moving.sails.push(p);
        break;
      case 'hay':
        B.color('#D9B85E').surf(SURF.plain);
        B.cyl(p.x, p.y, p.z, 1.3, 1.25, 1.7, 9, false);
        B.color('#E8CC78');
        B.cyl(p.x, p.y + 1.7, p.z, 1.25, 0.9, 0.12, 9, true);
        break;
      case 'pylon':
        pylon(B, p);
        break;
      case 'silo':
        B.color('#C9C2B4').surf(SURF.stone, rng.next());
        B.cyl(p.x, p.y, p.z, 3, 3, 13, 14, false);
        B.color('#9A9286').surf(SURF.plain);
        for (const y of [3, 6.5, 10]) B.cyl(p.x, p.y + y, p.z, 3.06, 3.06, 0.22, 14, false);
        B.color('#8C8478');
        B.blob(p.x, p.y + 13, p.z, 3.05, 0.55, 0, 0.8);
        B.color('#5A5450');
        B.box(p.x + 3.05, p.y, p.z, 0.12, 13, 0.6, 0);
        break;
      case 'watertower': {
        B.color('#4A3E38').surf(SURF.plain);
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(p.x + u * 1.5, p.y, p.z + v * 1.5, 0.22, 3.6, 0.22);
        B.color('#8E6A50').surf(SURF.wood, rng.next());
        B.cyl(p.x, p.y + 3.5, p.z, 2.3, 2.3, 2.9, 10, false);
        B.color('#3E3840').surf(SURF.plain);
        for (const y of [0.5, 2.4]) B.cyl(p.x, p.y + 3.5 + y, p.z, 2.34, 2.34, 0.1, 10, false);
        B.color('#4C4652');
        B.cyl(p.x, p.y + 6.4, p.z, 2.5, 0, 1.2, 10, false);
        break;
      }
      case 'mark': {
        // a cairn of stacked stones on the butte top
        B.color('#B8865A').surf(SURF.plain);
        B.blob(p.x, p.y + 0.4, p.z, 1.5, 0.5, 0.25, 0.7);
        B.color('#C99A6A');
        B.blob(p.x + 0.2, p.y + 1.1, p.z - 0.1, 1.0, 0.55, 0.25, 0.7);
        B.color('#D9AA78');
        B.blob(p.x - 0.1, p.y + 1.7, p.z + 0.1, 0.6, 0.6, 0.2, 0.75);
        break;
      }
      case 'hoodoo':
        hoodoo(B, p);
        break;
      case 'boulder': {
        const k = 0.88 + 0.24 * p.seed;
        B.color(p.seed > 0.5 ? '#A9532F' : '#B8673E', k).surf(SURF.leaf, p.seed);
        B.blob(p.x, p.y - p.s * 0.25, p.z, p.s, 0.72, 0.22, 0.55);
        break;
      }
      case 'windpump':
        windpump(B, p);
        moving.fans.push({ x: p.x + Math.cos(p.yaw) * 0.5, y: p.y + 11.2, z: p.z + Math.sin(p.yaw) * 0.5, yaw: p.yaw });
        break;
      case 'trough':
        B.color('#7E8A8C').surf(SURF.plain);
        B.cyl(p.x, p.y - 0.2, p.z, 2.2, 2.2, 1.0, 16, false);
        B.color('#5E9AB0');
        B.cyl(p.x, p.y + 0.6, p.z, 2.12, 2.12, 0.05, 16, true);
        break;
      case 'corral':
        corral(B, p, rng);
        break;
      case 'track':
        track(B, p);
        break;
      case 'portal':
        portal(B, p);
        break;
      case 'platform':
        platform(B, p, map);
        break;
      case 'signal': {
        B.color('#3A3236').surf(SURF.plain);
        B.cyl(p.x, p.y, p.z, 0.13, 0.1, 6.4, 6, true);
        B.color('#C83A2E');
        B.box(p.x + 0.9, p.y + 5.6, p.z + 0.15, 1.8, 0.32, 0.08, 0.15);
        B.color('#F2E6D0');
        B.box(p.x + 1.45, p.y + 5.6, p.z + 0.16, 0.3, 0.32, 0.09, 0.15);
        B.color('#FFD890').surf(SURF.lamp);
        B.box(p.x - 0.05, p.y + 5.35, p.z + 0.2, 0.26, 0.26, 0.12, 0);
        break;
      }
      default:
        break;
    }
  }
  if (map.id === 'saltmere') harbourTown(B, map, rng, moving);
  if (map.id === 'lantern') cityStreets(B, map, rng);
  return moving;
}

/** A hoodoo: a spire of soft rock in faint bands on a scree foot, swelling and pinched, under a harder cap rock. */
function hoodoo(B, p) {
  const bands = ['#D4976C', '#C77A50', '#BA6B44', '#D9A47A'];
  const mottled = (seed) => B.surf(SURF.leaf, seed); // foliage's light-and-shade clumps read as weathered rock
  const n = 2 + Math.floor(p.seed * 3);
  const w = p.w * 1.15;
  const lean = (p.seed - 0.5) * 0.08;
  // the foot: a skirt of scree
  B.color('#B8653E', 0.95);
  mottled(p.seed);
  B.cyl(p.x, p.y - 0.8, p.z, w * 2.1, w * 1.05, 2.2, 8, false);
  let y = p.y + 1.2;
  const seg = (p.h - 1.0) / n;
  for (let k = 0; k < n; k++) {
    const ox = lean * (y - p.y);
    const fat = w * (1.05 - 0.12 * k);
    B.color(bands[(k + Math.floor(p.seed * 7)) % bands.length], 0.94 + 0.12 * ((p.seed * (k + 3) * 7.3) % 1));
    mottled(p.seed + k * 0.17);
    B.cyl(p.x + ox, y, p.z, fat * 0.92, fat, seg * 0.45, 8, false);
    B.cyl(p.x + ox, y + seg * 0.45, p.z, fat, fat * 0.72, seg * 0.55, 8, false);
    y += seg;
  }
  // the cap rock, a little wider than the neck under it
  const ox = lean * (y - p.y);
  B.color('#9A5E44');
  mottled(p.seed + 0.5);
  B.cyl(p.x + ox, y - 0.15, p.z, w * 0.8, w * 1.2, 0.5, 8, false);
  B.blob(p.x + ox, y + 0.35, p.z, w * 1.2, 0.42, 0.18, 0.6);
}

/** The ranch's wind pump: a tapering lattice tower with a platform; its wheel is a moving part (fanGeometry). */
function windpump(B, p) {
  const H = 10.6;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const wide = (y) => 1.7 - 1.35 * (y / H);
  const at = (u, v, y) => [p.x + u * wide(y), p.y + y, p.z + v * wide(y)];
  B.color('#6E6A6A').surf(SURF.plain);
  for (const [u, v] of legs) B.tube([at(u, v, -0.3), at(u, v, H)], 0.09);
  for (let y = 0; y < H - 1; y += 2.5) {
    const y2 = Math.min(H, y + 2.5);
    for (let k = 0; k < 4; k++) {
      const [u0, v0] = legs[k];
      const [u1, v1] = legs[(k + 1) % 4];
      B.tube([at(u0, v0, y2), at(u1, v1, y2)], 0.05);
      B.tube([at(u0, v0, y), at(u1, v1, y2)], 0.035);
    }
  }
  B.color('#8A6A4E').surf(SURF.wood, 0.3);
  B.box(p.x, p.y + H - 0.1, p.z, 1.3, 0.12, 1.3, 0);
  // the head and its tail vane, turned into the wind
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  B.color('#5A5658').surf(SURF.plain);
  B.box(p.x, p.y + H, p.z, 0.5, 0.7, 0.5, -p.yaw);
  B.tube([[p.x, p.y + H + 0.5, p.z], [p.x - c * 3.2, p.y + H + 0.6, p.z - s * 3.2]], 0.07);
  B.color('#C9C2B8');
  const tx = p.x - c * 3.2;
  const tz = p.z - s * 3.2;
  B.quad([tx, p.y + H - 0.2, tz], [tx + c * 1.4, p.y + H + 0.1, tz + s * 1.4], [tx + c * 1.4, p.y + H + 1.1, tz + s * 1.4], [tx, p.y + H + 1.5, tz]);
  B.quad([tx, p.y + H + 1.5, tz], [tx + c * 1.4, p.y + H + 1.1, tz + s * 1.4], [tx + c * 1.4, p.y + H + 0.1, tz + s * 1.4], [tx, p.y + H - 0.2, tz]);
  // the pump rod down the middle to a little pump house on the trough
  B.color('#4A4648');
  B.cyl(p.x, p.y, p.z, 0.05, 0.05, H, 4, false);
  B.color('#8A6A4E').surf(SURF.wood, 0.6);
  B.box(p.x, p.y - 0.2, p.z, 1.1, 1.0, 1.1, 0);
}

/** The wind pump's wheel: a ring of sheet-metal blades round a hub, in its own frame (it turns about x). */
export function fanGeometry() {
  const S = new Builder();
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (u, v, w) => [w, c * u - s * v, s * u + c * v];
    S.color(k % 2 ? '#C9C2B8' : '#B0A89E').surf(SURF.plain);
    // each blade a little twisted, so the wheel reads as one at a glance
    S.quad(P(0.6, -0.18, -0.06), P(2.1, -0.32, -0.1), P(2.1, 0.32, 0.1), P(0.6, 0.18, 0.06));
    S.quad(P(0.6, 0.18, 0.06), P(2.1, 0.32, 0.1), P(2.1, -0.32, -0.1), P(0.6, -0.18, -0.06));
  }
  S.color('#5A5658');
  for (const r of [0.6, 2.1]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      pts.push([0, Math.cos(a) * r, Math.sin(a) * r]);
    }
    S.tube(pts, 0.04);
  }
  S.blob(0, 0, 0, 0.3, 1, 0, 0.8);
  return S.build();
}

const HIDES = ['#6A4030', '#3A3030', '#8A5A3A', '#E8DCCC', '#B07850'];

/** A corral: post-and-rail fence round a yard with a gate gap, and some cattle standing about in it. */
function corral(B, p, rng) {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const P = (u, v) => [p.x + c * u - s * v, p.z + s * u + c * v];
  const hw = p.w / 2;
  const hd = p.d / 2;
  const sides = [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]];
  sides.forEach(([u0, v0, u1, v1], k) => {
    const len = Math.hypot(u1 - u0, v1 - v0);
    const n = Math.max(2, Math.round(len / 2.6));
    const gate = k === 2 ? Math.floor(n / 2) : -1;
    for (let i = 0; i <= n; i++) {
      const [x, z] = P(lerpN(u0, u1, i / n), lerpN(v0, v1, i / n));
      B.color('#6E5440', 0.9 + 0.2 * rng.next()).surf(SURF.wood, rng.next());
      B.box(x, p.y - 0.3, z, 0.2, 1.75, 0.2, -p.yaw);
      if (i === n || i === gate) continue;
      const [x2, z2] = P(lerpN(u0, u1, (i + 1) / n), lerpN(v0, v1, (i + 1) / n));
      B.color('#8A6A4E').surf(SURF.wood, rng.next());
      for (const h of [0.65, 1.25]) B.tube([[x, p.y + h, z], [x2, p.y + h, z2]], 0.07);
    }
  });
  for (let k = 0; k < (p.cattle ?? 0); k++) {
    const u = rng.range(-hw + 2, hw - 2);
    const v = rng.range(-hd + 2, hd - 2);
    const [x, z] = P(u, v);
    const yaw = rng.range(0, Math.PI * 2);
    const hx = Math.cos(yaw);
    const hz = Math.sin(yaw);
    const hide = HIDES[Math.floor(rng.next() * HIDES.length)];
    B.color(hide).surf(SURF.plain);
    B.blob(x, p.y + 1.05, z, 0.62, 0.62, 0, 0.75);
    B.blob(x + hx * 0.55, p.y + 1.05, z + hz * 0.55, 0.58, 0.62, 0, 0.75);
    B.color(hide, 0.85);
    B.blob(x + hx * 1.25, p.y + 1.15 - 0.2 * rng.next(), z + hz * 1.25, 0.32, 0.85, 0, 0.75);
    B.color('#3A3030');
    for (const [a, b] of [[-0.35, -0.3], [-0.35, 0.3], [0.85, -0.3], [0.85, 0.3]]) {
      B.box(x + hx * a - hz * b, p.y - 0.1, z + hz * a + hx * b, 0.14, 0.75, 0.14, 0);
    }
  }
}

const lerpN = (a, b, t) => a + (b - a) * t;

/** Track across the flats: a bank of grey ballast, sleepers, two rails; level at y along z, from x0 to x1. */
function track(B, p) {
  const x0 = Math.min(p.x0, p.x1);
  const x1 = Math.max(p.x0, p.x1);
  const w = x1 - x0;
  B.color('#8A7A6C').surf(SURF.stone, 0.4);
  B.box((x0 + x1) / 2, p.y - 0.55, p.z, w, 0.55, 3.4, 0);
  B.color('#4A3426').surf(SURF.plain);
  for (let x = x0 + 0.5; x < x1; x += 1.15) B.box(x, p.y, p.z, 0.5, 0.14, 3.1, 0);
  B.color('#9A98A0');
  for (const v of [-0.72, 0.72]) B.box((x0 + x1) / 2, p.y + 0.14, p.z + v, w, 0.13, 0.13, 0);
}

/** A quad turned to face `out` (so the winding never matters). */
function quadOut(B, q, out) {
  const [a, b, c] = q;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  B.quad(...(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? q.slice().reverse() : q));
}

/** A tunnel portal of dressed stone, its dark mouth just in front of the cliff face; dir: +1 faces +x. */
function portal(B, p) {
  const d = p.dir;
  const y = p.y - 0.4;
  const R = 3.1; // the arch's inner radius
  const T = 1.4; // its ring of stones
  const top = 4.2; // where it springs
  const u0 = -1.2; // back (in the hill) and front, along x from p.x
  const u1 = 2.2;
  const X = (u) => p.x + d * u;
  B.color('#C9A27A').surf(SURF.stone, 0.31);
  for (const v of [-1, 1]) B.box(X((u0 + u1) / 2), y, p.z + v * (R + 0.75), u1 - u0, top + 0.6, 1.5, 0);
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI;
    const a1 = ((k + 1) / n) * Math.PI;
    const am = (a0 + a1) / 2;
    const P = (a, r, u) => [X(u), y + top + Math.sin(a) * r, p.z + Math.cos(a) * r];
    B.color(k === 4 ? '#B38A62' : '#C9A27A', 0.95 + 0.1 * ((k * 0.37) % 1));
    quadOut(B, [P(a0, R, u1), P(a1, R, u1), P(a1, R + T, u1), P(a0, R + T, u1)], [d, 0, 0]);
    quadOut(B, [P(a0, R + T, u0), P(a1, R + T, u0), P(a1, R + T, u1), P(a0, R + T, u1)], [0, Math.sin(am), Math.cos(am)]);
    quadOut(B, [P(a0, R, u0), P(a1, R, u0), P(a1, R, u1), P(a0, R, u1)], [0, -Math.sin(am), -Math.cos(am)]);
  }
  // a parapet over it and wing walls holding back the cutting
  B.color('#B8956E').surf(SURF.stone, 0.62);
  B.box(X((u0 + u1) / 2), y + top + R + T - 0.3, p.z, u1 - u0 + 0.4, 1.2, 2 * (R + 1.6), 0);
  for (const v of [-1, 1]) B.box(X(u1 + 1.6), y - 0.5, p.z + v * (R + 2.3), 3.6, top, 1.2, -v * d * 0.4);
  // the mouth: black, just clear of the hillside, so the train runs into the dark
  B.color('#0E0A0C').surf(SURF.plain);
  const mx = X(0.2);
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * Math.PI;
    const a1 = ((k + 1) / 12) * Math.PI;
    const za = p.z + Math.cos(a0) * R;
    const zb = p.z + Math.cos(a1) * R;
    quadOut(B, [[mx, y, za], [mx, y, zb], [mx, y + top + Math.sin(a1) * R, zb], [mx, y + top + Math.sin(a0) * R, za]], [d, 0, 0]);
  }
}

/** The halt's platform: a raised edge of planks on a stone bank, a bench, a lamp, a board. */
function platform(B, p, map) {
  const y = p.y + 0.9;
  B.color('#B89A7A').surf(SURF.stone, 0.12);
  B.box(p.x, p.y - 1.4, p.z + 0.4, p.w, y - p.y + 1.4 - 0.15, p.d, 0);
  B.color('#8A6A4E').surf(SURF.wood, 0.4);
  B.box(p.x, y - 0.15, p.z + 0.4, p.w, 0.15, p.d, 0);
  B.color('#E8DCC4').surf(SURF.plain);
  B.box(p.x, y - 0.1, p.z - p.d / 2 + 0.55, p.w, 0.11, 0.25, 0);
  // a bench, a lamp at each end, the name board
  B.color('#6A4A34').surf(SURF.wood, 0.2);
  B.box(p.x - 6, y, p.z + 1.4, 2.2, 0.5, 0.6, 0);
  B.box(p.x - 6, y + 0.5, p.z + 1.7, 2.2, 0.5, 0.1, 0);
  for (const u of [-p.w / 2 + 1, p.w / 2 - 1]) {
    B.color('#2B2730').surf(SURF.plain);
    B.cyl(p.x + u, y, p.z + 1.6, 0.1, 0.07, 3.2, 5, false);
    B.box(p.x + u, y + 3.15, p.z + 1.6, 0.4, 0.08, 0.4, 0);
    B.color('#FFD890').surf(SURF.lamp);
    B.box(p.x + u, y + 2.7, p.z + 1.6, 0.28, 0.42, 0.28, 0);
  }
  B.color('#2B2730').surf(SURF.plain);
  for (const u of [-1.6, 1.6]) B.box(p.x + 4 + u, y, p.z + 1.5, 0.12, 2.4, 0.12, 0);
  B.color('#F2E6D0');
  B.box(p.x + 4, y + 2.0, p.z + 1.5, 3.6, 0.8, 0.12, 0);
  B.color('#3A2A22');
  B.box(p.x + 4, y + 2.25, p.z + 1.43, 2.6, 0.3, 0.02, 0);
  void map;
}

function lighthouse(B, p) {
  B.color('#B8A898').surf(SURF.stone, 0.3);
  B.cyl(p.x, p.y - 0.5, p.z, 3.6, 3.4, 1.4, 12, true);
  for (let k = 0; k < 6; k++) {
    B.color(k % 2 ? '#C0563A' : '#F4EBDD').surf(SURF.plain);
    B.cyl(p.x, p.y + k * 3.6, p.z, 2.6 - k * 0.18, 2.6 - (k + 1) * 0.18, 3.6, 14, false);
  }
  // the gallery (painted iron) and its rail
  B.color('#6E7884');
  B.cyl(p.x, p.y + 21.4, p.z, 3.4, 3.4, 0.25, 16, true);
  B.color('#2B2330');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    B.box(p.x + Math.cos(a) * 3.25, p.y + 21.65, p.z + Math.sin(a) * 3.25, 0.08, 0.8, 0.08, 0);
  }
  B.cyl(p.x, p.y + 22.4, p.z, 3.3, 3.3, 0.08, 16, false);
  B.color('#FFE7A8').surf(SURF.lamp);
  B.cyl(p.x, p.y + 21.65, p.z, 1.6, 1.6, 2.4, 10, false);
  // a red lantern roof and its finial
  B.color('#B8402F').surf(SURF.plain);
  B.cyl(p.x, p.y + 24, p.z, 2.1, 1.2, 0.9, 12, false);
  B.cyl(p.x, p.y + 24.9, p.z, 1.2, 0, 1.3, 12, false);
  B.color('#2B2330');
  B.cyl(p.x, p.y + 26.1, p.z, 0.08, 0.02, 1.2, 4, false);
  B.box(p.x, p.y + 26.3, p.z, 0.35, 0.35, 0.35, 0);
}

function windmill(B, p) {
  B.color('#E9DCC4').surf(SURF.wall, 0.4, [20, 14, 0, 8]);
  B.cyl(p.x, p.y, p.z, 3.2, 2.2, 14, 12, false);
  // a door and two little windows facing the sails
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  B.color('#4A3A30').surf(SURF.plain);
  B.box(p.x + c * 3.05, p.y, p.z + s * 3.05, 0.3, 2.2, 1.2, p.yaw);
  B.color('#2A2A34');
  B.box(p.x + c * 2.55, p.y + 7.5, p.z + s * 2.55, 0.3, 1.1, 0.8, p.yaw);
  B.color('#7E3B2C').surf(SURF.roof, 0.6);
  B.cyl(p.x, p.y + 14, p.z, 2.7, 0, 3.6, 12, false);
  B.color('#5A3A2C').surf(SURF.plain);
  B.cyl(p.x, p.y + 13.8, p.z, 2.5, 2.5, 0.35, 12, false);
}

/** The windmill's sails: four lattice blades with cloth, in the hub's own frame (it turns about x). */
export function sailGeometry() {
  const S = new Builder();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (u, v, w = 0) => [w, c * u - s * v, s * u + c * v];
    S.color('#5A4030').surf(SURF.plain);
    // the stock
    S.quad(P(0, -0.15, 0.1), P(8.5, -0.15, 0.1), P(8.5, 0.15, 0.1), P(0, 0.15, 0.1));
    S.quad(P(0, 0.15, 0.1), P(8.5, 0.15, 0.1), P(8.5, -0.15, 0.1), P(0, -0.15, 0.1));
    // the cloth, with its bars showing through
    S.color('#F2E6D0').surf(SURF.cloth, k, [0, 0, 0, 0]);
    S.quad(P(1.6, 0.15), P(8.4, 0.15), P(8.4, 1.6), P(1.6, 1.25), [[0, 0], [6.8, 0], [6.8, 1.4], [0, 1.1]]);
    S.quad(P(1.6, 1.25), P(8.4, 1.6), P(8.4, 0.15), P(1.6, 0.15), [[0, 1.1], [6.8, 1.4], [6.8, 0], [0, 0]]);
    S.color('#6A5040').surf(SURF.plain);
    for (let u = 2; u <= 8.4; u += 1.6) {
      S.quad(P(u, 0.15, 0.03), P(u + 0.12, 0.15, 0.03), P(u + 0.12, 1.5, 0.03), P(u, 1.5, 0.03));
    }
  }
  S.color('#3A2A22');
  S.blob(0, 0, 0, 0.5, 1, 0, 0.8);
  return S.build();
}

function pylon(B, p) {
  const h = p.h ?? p.top - p.y;
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const at = (u, v, y) => [p.x + c * u - s * v, p.y + y, p.z + s * u + c * v];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const wide = (y) => 1.9 - 1.0 * (y / h);
  B.color('#6F6A72').surf(SURF.plain);
  for (const [u, v] of legs) B.tube([at(u * wide(0), v * wide(0), 0), at(u * wide(h), v * wide(h), h)], 0.16);
  // braces: rings and crosses up the tower
  for (let y = 0; y < h - 1; y += 3) {
    const y2 = Math.min(h, y + 3);
    for (let k = 0; k < 4; k++) {
      const [u0, v0] = legs[k];
      const [u1, v1] = legs[(k + 1) % 4];
      B.tube([at(u0 * wide(y2), v0 * wide(y2), y2), at(u1 * wide(y2), v1 * wide(y2), y2)], 0.07);
      B.tube([at(u0 * wide(y), v0 * wide(y), y), at(u1 * wide(y2), v1 * wide(y2), y2)], 0.05);
    }
  }
  // a cap and insulators where the six wires leave
  B.color('#55505A');
  B.box(p.x, p.top - 0.2, p.z, 2.4, 0.3, 2.4, p.yaw);
  B.color('#D8D4CC');
  for (let k = 0; k < 6; k++) {
    for (const side of [-1, 1]) {
      const q = at(side * 1.0, 0, p.top - 1.5 - k * 2.6 - p.y - 0.35);
      B.cyl(q[0], q[1], q[2], 0.2, 0.2, 0.5, 6, true);
    }
  }
}

/** A boat: a hull with a pointed bow, a stripe, a deck, a wheelhouse and a mast with a yard to perch on. Local frame, bow +x. */
export function boatGeometry(p, waterY) {
  const B = new Builder();
  const s = p.s ?? 1;
  const hull = HULLS[p.color % HULLS.length];
  const L = 3.1 * s;
  const seg = 10;
  const deckY = 0.95 * s;
  const keelY = -0.55 * s;
  const half = (t) => {
    // t from 0 (stern) to 1 (bow)
    const w = 1.12 * s;
    if (t < 0.55) return w * (0.82 + 0.18 * Math.sin((t / 0.55) * Math.PI * 0.5));
    const k = (t - 0.55) / 0.45;
    return w * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const X = (t) => -L + t * 2 * L;
  const rise = (t) => (t > 0.7 ? (t - 0.7) * 1.2 * s : 0); // the bow sweeps up
  const top = [];
  const bot = [];
  const stripe = [];
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const w = half(t);
    top.push([X(t), deckY + rise(t), w]);
    stripe.push([X(t), deckY + rise(t) - 0.28 * s, w * 0.99]);
    bot.push([X(t) + (t > 0.95 ? -0.2 * s : 0), keelY + rise(t) * 0.5, w * 0.32]);
  }
  for (const side of [1, -1]) {
    for (let k = 0; k < seg; k++) {
      const a = (q) => [q[0], q[1], q[2] * side];
      const quad = side > 0 ? (p0, p1, p2, p3) => B.quad(p0, p1, p2, p3) : (p0, p1, p2, p3) => B.quad(p1, p0, p3, p2);
      B.color(hull).surf(SURF.wood, 0.2, [0, 0, 0, 0]);
      quad(a(bot[k]), a(bot[k + 1]), a(stripe[k + 1]), a(stripe[k]));
      B.color('#F4EEE2').surf(SURF.plain);
      quad(a(stripe[k]), a(stripe[k + 1]), a(top[k + 1]), a(top[k]));
    }
  }
  // the transom
  B.color(hull, 0.85).surf(SURF.plain);
  B.quad([X(0), keelY, -half(0) * 0.32], [X(0), keelY, half(0) * 0.32], [X(0), deckY, half(0)], [X(0), deckY, -half(0)]);
  // the deck
  B.color('#B08A5E').surf(SURF.wood, 0.5);
  for (let k = 0; k < seg; k++) {
    const a = top[k];
    const b = top[k + 1];
    B.quad([a[0], a[1] - 0.05, -a[2]], [a[0], a[1] - 0.05, a[2]], [b[0], b[1] - 0.05, b[2]], [b[0], b[1] - 0.05, -b[2]]);
  }
  // the wheelhouse
  B.color('#F2EEE6').surf(SURF.plain);
  B.box(-L * 0.45, deckY - 0.05, 0, 1.7 * s, 1.25 * s, 1.5 * s, 0);
  B.color('#2A3440');
  B.box(-L * 0.45 + 0.86 * s, deckY + 0.55 * s, 0, 0.04, 0.45 * s, 1.2 * s, 0);
  B.color(hull, 0.8);
  B.box(-L * 0.45, deckY + 1.2 * s, 0, 1.95 * s, 0.14, 1.75 * s, 0);
  // the mast to the perch height, a yard across its top, a furled sail on the boom
  const mastTop = 9.15 - waterY;
  const mx = L * 0.15;
  B.color('#6A5040').surf(SURF.wood, 0.7);
  B.cyl(mx, deckY, 0, 0.11, 0.07, mastTop - deckY, 6, false);
  B.box(mx, mastTop - 0.18, 0, 0.14, 0.14, 3.0, 0);
  B.box(mx - 1.6, deckY + 1.6, 0, 3.2, 0.12, 0.12, 0);
  B.color('#E8DCC4').surf(SURF.cloth, 0.3);
  B.box(mx - 1.6, deckY + 1.72, 0, 3.0, 0.3, 0.32, 0);
  // a buoy and some crates
  B.color('#E8B83A').surf(SURF.plain);
  B.box(L * 0.45, deckY - 0.05, 0.3 * s, 0.6, 0.45, 0.6, 0.3);
  return B.build();
}

/** The harbour town's square and lanes: a fountain, market stalls, lamps along the streets, washing across the lanes. */
function harbourTown(B, map, rng, moving) {
  const sq = map.square;
  // the fountain
  {
    const a = 2.4;
    const x = sq.x + Math.cos(a) * 9;
    const z = sq.z + Math.sin(a) * 9;
    const y = groundAt(map, x, z);
    B.color('#D6C6AE').surf(SURF.stone, 0.2);
    B.cyl(x, y - 0.2, z, 3.0, 3.0, 0.9, 16, false);
    B.color('#C4B49C').surf(SURF.plain);
    B.cyl(x, y + 0.7, z, 3.0, 2.75, 0.05, 16, false);
    B.color('#5E9AB0').surf(SURF.plain);
    B.cyl(x, y + 0.5, z, 2.8, 2.8, 0.1, 16, true);
    B.color('#D6C6AE').surf(SURF.stone, 0.4);
    B.cyl(x, y, z, 0.45, 0.35, 2.2, 8, false);
    B.cyl(x, y + 2.2, z, 0.3, 1.2, 0.5, 10, true);
    B.color('#8EC4D8').surf(SURF.plain);
    B.blob(x, y + 2.85, z, 0.32, 1.2, 0, 0.9);
    moving.fountain = { x, y: y + 2.9, z };
  }
  // market stalls in an arc on the square's south-east side
  for (let k = 0; k < 6; k++) {
    const a = -0.35 + k * 0.3;
    const x = sq.x + Math.cos(a) * 15.5;
    const z = sq.z + Math.sin(a) * 15.5;
    const yaw = a + Math.PI / 2;
    const y = groundAt(map, x, z);
    stall(B, x, y, z, yaw, CLOTH[k % CLOTH.length], rng);
  }
  // lamps along the streets, on alternate sides
  B.color('#2B2730').surf(SURF.plain);
  const lamps = [];
  for (const pts of map.streets) {
    for (let k = 2; k < pts.length - 1; k += 3) {
      const [x0, z0] = pts[k - 1];
      const [x1, z1] = pts[k + 1];
      const dir = Math.atan2(z1 - z0, x1 - x0);
      const side = k % 2 ? 1 : -1;
      const x = pts[k][0] + Math.cos(dir + (side * Math.PI) / 2) * 4.6;
      const z = pts[k][1] + Math.sin(dir + (side * Math.PI) / 2) * 4.6;
      if (map.coast(x, z).d < 4) continue;
      if (map.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < Math.max(b.w, b.d) / 2 + 0.8)) continue;
      lamps.push([x, groundAt(map, x, z), z]);
    }
  }
  for (const [x, y, z] of lamps) {
    B.color('#2B2730').surf(SURF.plain);
    B.cyl(x, y, z, 0.12, 0.08, 3.6, 5, false);
    B.box(x, y + 3.55, z, 0.42, 0.08, 0.42, 0);
    B.color('#FFD890').surf(SURF.lamp);
    B.box(x, y + 3.1, z, 0.3, 0.45, 0.3, 0);
    B.color('#2B2730').surf(SURF.plain);
    B.cyl(x, y + 3.6, z, 0.28, 0.02, 0.3, 4, false);
  }
  moving.lamps = lamps;
  // washing strung across the lanes between facing houses
  const houses = map.buildings.filter((b) => b.kind === 'house');
  for (const pts of map.streets) {
    for (let k = 1; k < pts.length - 1; k += 2) {
      if (rng.next() > 0.4) continue;
      const [sx, sz] = pts[k];
      const [x0, z0] = pts[k - 1];
      const [x1, z1] = pts[k + 1];
      const dir = Math.atan2(z1 - z0, x1 - x0);
      const nx = -Math.sin(dir);
      const nz = Math.cos(dir);
      let left = null;
      let right = null;
      for (const h of houses) {
        const dx = h.x - sx;
        const dz = h.z - sz;
        const d = Math.hypot(dx, dz);
        if (d > 12) continue;
        const side = dx * nx + dz * nz;
        const along = Math.abs(dx * Math.cos(dir) + dz * Math.sin(dir));
        if (along > 3) continue;
        if (side > 0 && (!left || d < left.d)) left = { h, d };
        if (side < 0 && (!right || d < right.d)) right = { h, d };
      }
      if (!left || !right) continue;
      const y = Math.min(left.h.y + left.h.h, right.h.y + right.h.h) - 1.4;
      const a = [sx + nx * (left.d - left.h.d / 2 - 0.05), y, sz + nz * (left.d - left.h.d / 2 - 0.05)];
      const b = [sx - nx * (right.d - right.h.d / 2 - 0.05), y, sz - nz * (right.d - right.h.d / 2 - 0.05)];
      const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (span < 4 || span > 16) continue;
      const pts2 = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts2.push([a[0] + (b[0] - a[0]) * t, y - Math.sin(t * Math.PI) * 0.5, a[2] + (b[2] - a[2]) * t]);
      }
      B.color('#3A3438').surf(SURF.plain);
      B.tube(pts2, 0.03);
      const ux = (b[0] - a[0]) / span;
      const uz = (b[2] - a[2]) / span;
      for (let t = 0.12; t < 0.9; t += rng.range(0.1, 0.16)) {
        const px = a[0] + (b[0] - a[0]) * t;
        const pz = a[2] + (b[2] - a[2]) * t;
        const py = y - Math.sin(t * Math.PI) * 0.5;
        const w = rng.range(0.45, 0.8);
        const h = rng.range(0.5, 0.9);
        B.color(LAUNDRY[Math.floor(rng.next() * LAUNDRY.length)]).surf(SURF.plain);
        const q0 = [px - ux * w / 2, py, pz - uz * w / 2];
        const q1 = [px + ux * w / 2, py, pz + uz * w / 2];
        const q2 = [q1[0], py - h, q1[2]];
        const q3 = [q0[0], py - h, q0[2]];
        B.quad(q3, q2, q1, q0);
        B.quad(q0, q1, q2, q3);
      }
    }
  }
}

function stall(B, x, y, z, yaw, cloth, rng) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const P = (u, v, h) => [x + c * u + s * v, y + h, z + s * u - c * v];
  B.color('#8A6444').surf(SURF.wood, rng.next());
  B.box(x, y, z, 3.2, 0.9, 1.4, yaw);
  for (const [u, v] of [[-1.5, -0.6], [1.5, -0.6], [1.5, 0.9], [-1.5, 0.9]]) {
    const q = P(u, v, 0);
    B.box(q[0], q[1], q[2], 0.1, 2.5, 0.1, yaw);
  }
  // the awning: two slopes of striped cloth
  B.color(cloth).surf(SURF.cloth, rng.next());
  B.quad(P(-1.75, -1.0, 2.25), P(1.75, -1.0, 2.25), P(1.75, 0.15, 2.75), P(-1.75, 0.15, 2.75), [[0, 0], [3.5, 0], [3.5, 1], [0, 1]]);
  B.quad(P(1.75, 1.2, 2.45), P(-1.75, 1.2, 2.45), P(-1.75, 0.15, 2.75), P(1.75, 0.15, 2.75), [[3.5, 0], [0, 0], [0, 1], [3.5, 1]]);
  // produce
  const fruit = ['#E8662C', '#D83A2E', '#8AB83A', '#F2C82E', '#7A3A8A'];
  for (let k = 0; k < 5; k++) {
    const q = P(-1.2 + k * 0.6, -0.2, 0.9);
    B.color('#B08A5E').surf(SURF.wood, rng.next());
    B.box(q[0], q[1], q[2], 0.5, 0.18, 0.7, yaw);
    B.color(fruit[(k + Math.floor(rng.next() * 5)) % fruit.length]).surf(SURF.plain);
    B.blob(q[0], q[1] + 0.22, q[2], 0.26, 0.6, 0.3, 0.7);
  }
}

/** The city's parks: a fountain in the middle and benches round it. */
function cityStreets(B, map, rng) {
  for (const p of map.parks) {
    const cx = p.x0 + p.size / 2;
    const cz = p.z0 + p.size / 2;
    const y = groundAt(map, cx, cz);
    B.color('#B8AA94').surf(SURF.stone, 0.1);
    B.cyl(cx, y - 0.1, cz, 3.4, 3.4, 0.6, 14, false);
    B.color('#4F86A0').surf(SURF.plain);
    B.cyl(cx, y + 0.3, cz, 3.1, 3.1, 0.1, 14, true);
    B.color('#B8AA94').surf(SURF.stone, 0.3);
    B.cyl(cx, y, cz, 0.35, 0.3, 1.6, 8, false);
    B.blob(cx, y + 1.7, cz, 0.6, 0.5, 0, 0.8);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = cx + Math.cos(a) * 7;
      const z = cz + Math.sin(a) * 7;
      B.color('#6A4A34').surf(SURF.wood, rng.next());
      B.box(x, y + 0.4, z, 1.8, 0.1, 0.5, -a);
      B.color('#2E2A30').surf(SURF.plain);
      B.box(x, y, z, 1.6, 0.4, 0.4, -a);
    }
  }
}
