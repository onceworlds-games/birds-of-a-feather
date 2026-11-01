// The four places, generated from a fixed seed each (so every page and every sunset flies the same place):
// the ground, the buildings, the wires, the perch slots, thermals, the grey wheels' loops, spawns and the roost.
// Pure data: rendering reads it, the rules read it, node tests check it.

import { makeNoise2, makeRng, clamp, lerp, smoothstep } from './rng.js';

export const HALF = 320; // the grid covers [-HALF, HALF] on x and z
export const RES = 2.5;
export const N = Math.round((HALF * 2) / RES) + 1; // 257 vertices a side
const PERCH_CELL = 8;
const PERCH_CELLS = Math.ceil((HALF * 2) / PERCH_CELL);

const idx = (i, j) => j * N + i;

/** Bilinear read of a height grid at a world point. */
export function sampleGrid(grid, x, z) {
  const fx = clamp((x + HALF) / RES, 0, N - 1.001);
  const fz = clamp((z + HALF) / RES, 0, N - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = grid[idx(i, j)];
  const b = grid[idx(i + 1, j)];
  const c = grid[idx(i, j + 1)];
  const d = grid[idx(i + 1, j + 1)];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

export const groundAt = (map, x, z) => sampleGrid(map.ground, x, z);
export const surfaceAt = (map, x, z) => sampleGrid(map.surface, x, z);

// ------------------------------------------------------------------ building blocks

function newMap(id, name, look) {
  return {
    id,
    name,
    look,
    hasSea: false,
    water: 0,
    center: { x: 0, z: 0 },
    radius: 290,
    ground: new Float32Array(N * N),
    surface: new Float32Array(N * N),
    tint: new Uint8Array(N * N * 3),
    buildings: [],
    trees: [],
    poles: [],
    wires: [],
    props: [],
    thermals: [],
    wheels: [],
    spawns: [],
    lamps: [], // window light quads: [x, y, z, yaw, w, h]
    streets: [],
    fieldSeeds: [],
    square: null, // a paved square { x, z, r }
    parks: [], // city parks { x0, z0, size }
    farms: [], // farmyards { x, z }
    groupsRaw: [],
    roost: null,
    title: null,
  };
}

function fillGround(map, fn) {
  for (let j = 0; j < N; j++) {
    const z = -HALF + j * RES;
    for (let i = 0; i < N; i++) {
      const x = -HALF + i * RES;
      map.ground[idx(i, j)] = fn(x, z);
    }
  }
}

function fillTint(map, fn) {
  const g = map.ground;
  for (let j = 0; j < N; j++) {
    const z = -HALF + j * RES;
    for (let i = 0; i < N; i++) {
      const x = -HALF + i * RES;
      const h = g[idx(i, j)];
      const hx = g[idx(Math.min(N - 1, i + 1), j)] - g[idx(Math.max(0, i - 1), j)];
      const hz = g[idx(i, Math.min(N - 1, j + 1))] - g[idx(i, Math.max(0, j - 1))];
      const slope = Math.sqrt(hx * hx + hz * hz) / (2 * RES);
      const c = fn(x, z, h, slope);
      const k = idx(i, j) * 3;
      map.tint[k] = clamp(Math.round(c[0]), 0, 255);
      map.tint[k + 1] = clamp(Math.round(c[1]), 0, 255);
      map.tint[k + 2] = clamp(Math.round(c[2]), 0, 255);
    }
  }
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** A building: footprint w × d centred at x, z, turned by yaw; walls h tall; a roof on top. */
function addBuilding(map, b) {
  const y = groundMin(map, b.x, b.z, b.w, b.d, b.yaw);
  const roofH = b.roof === 'gable' ? b.roofH ?? Math.min(b.w, b.d) * 0.42 : b.roof === 'pyramid' ? b.roofH ?? Math.min(b.w, b.d) * 0.9 : 0.4;
  const out = { ...b, y, roofH, top: y + b.h + roofH };
  map.buildings.push(out);
  return out;
}

function groundMin(map, x, z, w, d, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  let lo = Infinity;
  for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]]) {
    const px = x + c * u * w - s * v * d;
    const pz = z + s * u * w + c * v * d;
    lo = Math.min(lo, groundAt(map, px, pz));
  }
  return lo - 0.4;
}

/** The ground's slope over a footprint: too steep, no building. */
function slopeOver(map, x, z, r) {
  const hs = [groundAt(map, x - r, z), groundAt(map, x + r, z), groundAt(map, x, z - r), groundAt(map, x, z + r)];
  return Math.max(...hs) - Math.min(...hs);
}

function addPole(map, x, z, h) {
  const y = groundAt(map, x, z);
  const p = { x, z, y, h };
  map.poles.push(p);
  return p;
}

/** Wires between two poles: `count` wires at the top, 1.1 u apart, with a sag. */
function addSpan(map, a, b, count = 2, groups = true) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const sag = 0.35 + len * 0.025;
  for (let w = 0; w < count; w++) {
    const wire = { ax: a.x, ay: a.y + a.h - w * 1.1, az: a.z, bx: b.x, by: b.y + b.h - w * 1.1, bz: b.z, sag };
    map.wires.push(wire);
    if (groups) wirePerches(map, wire, 'wire');
  }
}

export function wirePoint(wire, s) {
  return [lerp(wire.ax, wire.bx, s), lerp(wire.ay, wire.by, s) - wire.sag * 4 * s * (1 - s), lerp(wire.az, wire.bz, s)];
}

function wirePerches(map, wire, kind) {
  const len = Math.hypot(wire.bx - wire.ax, wire.bz - wire.az);
  const yaw = Math.atan2(wire.bz - wire.az, wire.bx - wire.ax) + Math.PI / 2;
  const pts = [];
  const step = 0.85;
  for (let d = 1.2; d < len - 1.2; d += step) {
    const p = wirePoint(wire, d / len);
    pts.push([p[0], p[1] + 0.18, p[2], yaw]);
  }
  if (pts.length >= 4) map.groupsRaw.push({ kind, pts });
}

function ridgePerches(map, b) {
  if (b.roof !== 'gable') return;
  const long = b.w >= b.d ? b.w : b.d;
  const along = b.w >= b.d ? b.yaw : b.yaw + Math.PI / 2;
  const ca = Math.cos(along);
  const sa = Math.sin(along);
  const pts = [];
  for (let u = -long / 2 + 0.8; u <= long / 2 - 0.8; u += 0.95) {
    pts.push([b.x + ca * u, b.top + 0.12, b.z + sa * u, along + Math.PI / 2]);
  }
  if (pts.length >= 4) map.groupsRaw.push({ kind: 'roof', pts });
}

function edgePerches(map, b) {
  // flat roofs: birds line the parapet along one or two edges
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  const sides = [
    [-b.w / 2, -b.d / 2, b.w / 2, -b.d / 2],
    [-b.w / 2, b.d / 2, b.w / 2, b.d / 2],
  ];
  for (const [u0, v0, u1, v1] of sides) {
    const pts = [];
    const len = Math.hypot(u1 - u0, v1 - v0);
    for (let d = 0.8; d < len - 0.8; d += 0.95) {
      const u = lerp(u0, u1, d / len);
      const v = lerp(v0, v1, d / len);
      pts.push([b.x + c * u - s * v, b.top + 0.15, b.z + s * u + c * v, b.yaw + (v0 < 0 ? Math.PI : 0)]);
    }
    if (pts.length >= 4) map.groupsRaw.push({ kind: 'roof', pts });
  }
}

function ringPerches(map, x, y, z, r, count, kind = 'special') {
  const pts = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r, a]);
  }
  map.groupsRaw.push({ kind, pts });
}

function addTree(map, x, z, h, r, kind) {
  const y = groundAt(map, x, z) - 0.3;
  const t = { x, z, y, h, r, kind };
  map.trees.push(t);
  return t;
}

/** Finish a map: the surface the birds fly over, the perch slots and their index. */
function finish(map, maxSlots, seed) {
  // objects stamped over the ground
  const obj = Float32Array.from(map.ground);
  if (map.hasSea) for (let k = 0; k < obj.length; k++) obj[k] = Math.max(obj[k], map.water);
  const stamp = (x, z, rx, rz, yaw, top) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const ext = Math.hypot(rx, rz);
    const i0 = Math.max(0, Math.floor((x - ext + HALF) / RES));
    const i1 = Math.min(N - 1, Math.ceil((x + ext + HALF) / RES));
    const j0 = Math.max(0, Math.floor((z - ext + HALF) / RES));
    const j1 = Math.min(N - 1, Math.ceil((z + ext + HALF) / RES));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = -HALF + i * RES - x;
        const pz = -HALF + j * RES - z;
        const u = c * px + s * pz;
        const v = -s * px + c * pz;
        if (Math.abs(u) <= rx + RES * 0.5 && Math.abs(v) <= rz + RES * 0.5) obj[idx(i, j)] = Math.max(obj[idx(i, j)], top);
      }
    }
  };
  for (const b of map.buildings) stamp(b.x, b.z, b.w / 2, b.d / 2, b.yaw, b.top);
  for (const t of map.trees) stamp(t.x, t.z, t.r, t.r, 0, t.y + t.h);
  for (const p of map.props) if (p.top) stamp(p.x, p.z, p.r ?? 3, p.r ?? 3, 0, p.top);
  // dilate, then soften: the flight floor rises a little before a roof and never dips into one
  let a = obj;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let m = -Infinity;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = clamp(j + dj, 0, N - 1);
          for (let di = -1; di <= 1; di++) m = Math.max(m, a[idx(clamp(i + di, 0, N - 1), jj)]);
        }
        b[idx(i, j)] = m;
      }
    }
    a = b;
  }
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = clamp(j + dj, 0, N - 1);
          for (let di = -1; di <= 1; di++) sum += a[idx(clamp(i + di, 0, N - 1), jj)];
        }
        b[idx(i, j)] = sum / 9;
      }
    }
    a = b;
  }
  for (let k = 0; k < a.length; k++) map.surface[k] = Math.max(a[k], obj[k] - 1.5, map.ground[k]);

  // perch slots: whole groups, picked so every kind is represented, up to maxSlots
  const rng = makeRng(`${seed}:perches`);
  // thermals inside the flying circle
  for (const th of map.thermals) {
    const dx = th.x - map.center.x;
    const dz = th.z - map.center.z;
    const d = Math.hypot(dx, dz);
    if (d > 235) {
      th.x = map.center.x + (dx / d) * 235;
      th.z = map.center.z + (dz / d) * 235;
    }
  }
  // grey wheels clear every roof and hill on their loop
  for (const w of map.wheels) {
    const base = sampleGrid(map.surface, w.cx, w.cz);
    let clear = Infinity;
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      clear = Math.min(clear, base + w.h - 2 - sampleGrid(map.surface, w.cx + Math.cos(a) * w.rx, w.cz + Math.sin(a) * w.rz));
    }
    if (clear < 6) w.h += 6 - clear;
  }
  // only perches a bird can reach without fighting the edge's turn home, and none sunk into a slope
  const reach = (p) => Math.hypot(p[0] - map.center.x, p[2] - map.center.z) < 262 && p[1] >= sampleGrid(map.ground, p[0], p[2]) - 0.3;
  const groups = rng.shuffle(
    map.groupsRaw
      .filter((g) => g.pts.every((p) => p.every(Number.isFinite)))
      .map((g) => ({ kind: g.kind, pts: g.pts.filter(reach) }))
      .filter((g) => g.pts.length >= 4),
  );
  const byKind = new Map();
  for (const g of groups) {
    if (!byKind.has(g.kind)) byKind.set(g.kind, []);
    byKind.get(g.kind).push(g);
  }
  const chosen = [];
  let total = 0;
  const kinds = [...byKind.keys()];
  let more = true;
  while (more && total < maxSlots) {
    more = false;
    for (const k of kinds) {
      const list = byKind.get(k);
      if (!list.length) continue;
      const g = list.shift();
      more = true;
      const take = Math.min(g.pts.length, maxSlots - total, 40);
      if (take < 4) continue;
      chosen.push({ kind: g.kind, pts: g.pts.slice(0, take) });
      total += take;
      if (total >= maxSlots) break;
    }
  }
  const count = total;
  const perches = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    yaw: new Float32Array(count),
    group: new Int32Array(count),
  };
  const groupList = [];
  let k = 0;
  for (const g of chosen) {
    const start = k;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const p of g.pts) {
      perches.x[k] = p[0];
      perches.y[k] = p[1];
      perches.z[k] = p[2];
      perches.yaw[k] = p[3];
      perches.group[k] = groupList.length;
      sx += p[0];
      sy += p[1];
      sz += p[2];
      k++;
    }
    groupList.push({ kind: g.kind, start, count: g.pts.length, x: sx / g.pts.length, y: sy / g.pts.length, z: sz / g.pts.length });
  }
  map.perches = perches;
  map.groups = groupList;
  // landmarks for rare birds: the first spot of every ring on a spire, a mast, a lighthouse, a mill, a butte, a tank
  map.landmarks = groups
    .filter((g) => g.kind === 'special')
    .map((g) => ({ x: g.pts[0][0], y: g.pts[0][1], z: g.pts[0][2] }))
    .sort((a, b) => a.x - b.x || a.z - b.z);
  delete map.groupsRaw;
  // perch index: slots by 8 u cell
  const cells = PERCH_CELLS * PERCH_CELLS;
  const counts = new Int32Array(cells + 1);
  const cellOf = new Int32Array(count);
  for (let s = 0; s < count; s++) {
    const ci = clamp(Math.floor((perches.x[s] + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
    const cj = clamp(Math.floor((perches.z[s] + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
    cellOf[s] = cj * PERCH_CELLS + ci;
    counts[cellOf[s] + 1]++;
  }
  for (let c = 0; c < cells; c++) counts[c + 1] += counts[c];
  const order = new Int32Array(count);
  const fillAt = counts.slice(0, cells);
  for (let s = 0; s < count; s++) order[fillAt[cellOf[s]]++] = s;
  map.perchIndex = { start: counts, order };
  return map;
}

/** Calls fn(slot) for every perch slot within r (horizontally) of x, z. */
export function forPerchesNear(map, x, z, r, fn) {
  const { start, order } = map.perchIndex;
  const i0 = clamp(Math.floor((x - r + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
  const i1 = clamp(Math.floor((x + r + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
  const j0 = clamp(Math.floor((z - r + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
  const j1 = clamp(Math.floor((z + r + HALF) / PERCH_CELL), 0, PERCH_CELLS - 1);
  const p = map.perches;
  const r2 = r * r;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const c = j * PERCH_CELLS + i;
      for (let q = start[c]; q < start[c + 1]; q++) {
        const s = order[q];
        const dx = p.x[s] - x;
        const dz = p.z[s] - z;
        if (dx * dx + dz * dz <= r2) fn(s);
      }
    }
  }
}

/** Which perch slots hold a wild bird at dawn: runs of 6-30 along wires and ridges, `count` in all. */
export function dealPerches(map, seed, count) {
  const rng = makeRng(`${seed}:deal`);
  const occ = new Uint8Array(map.perches.count);
  const want = Math.min(count, map.perches.count);
  let have = 0;
  for (let pass = 0; pass < 4 && have < want; pass++) {
    for (const g of rng.shuffle(map.groups)) {
      if (have >= want) break;
      const run = Math.min(g.count, rng.int(6, 30), want - have);
      const off = rng.int(0, g.count - run);
      for (let q = 0; q < run; q++) {
        const s = g.start + off + q;
        if (!occ[s]) {
          occ[s] = 1;
          have++;
        }
      }
    }
  }
  return occ;
}

// ------------------------------------------------------------------ Saltmere: the harbour town (the shared sky, Migration 1)

function saltmere() {
  const seed = 'saltmere';
  const noise = makeNoise2(seed);
  const map = newMap('saltmere', 'Saltmere Harbour', {
    sky: 'coast',
    grass: '#7E9A4E',
    grassDry: '#B7A25A',
    sand: '#E3C99A',
    rock: '#9C8270',
    stone: '#CDB9A0',
    sea: '#1E5866',
    walls: ['#F4EBDD', '#EFE2CC', '#F2D7A6', '#EBC08C', '#E8B4A0', '#F4E6B8', '#C9D9D0', '#F1DCC7', '#E9A884'],
    roofs: ['#C0563A', '#B04A30', '#CC6844', '#A9452F', '#D07650'],
    fields: ['#D9B35A', '#C9A44B', '#8DA556', '#A8B866', '#B8865A', '#E1C26B'],
  });
  map.hasSea = true;
  map.center = { x: 0, z: -10 };
  const coastS = (x) => 118 + 16 * Math.sin(x / 70) + 9 * Math.sin(x / 23 + 1);
  const coastW = (z) => -205 + 13 * Math.sin(z / 50) + 7 * Math.sin(z / 17);
  const bay = { x: -12, z: 122, r: 56 };
  const head = { x: -196, z: 128, r: 30 };
  const coast = (x, z) => {
    const ds = coastS(x) - z;
    const dw = x - coastW(z);
    let d = Math.min(ds, dw);
    let steep = dw < ds;
    const db = Math.hypot(x - bay.x, z - bay.z) - bay.r;
    if (db < d) {
      d = db;
      steep = false;
    }
    const dh = head.r - Math.hypot(x - head.x, z - head.z);
    if (dh > d) {
      d = dh;
      steep = true;
    }
    return { d, steep };
  };
  map.coast = coast;
  const land = (x, z) => {
    const base = 3 + 0.035 * Math.max(0, 120 - z);
    const hill = 22 * Math.exp(-((x - 20) ** 2 + (z + 10) ** 2) / (2 * 95 * 95));
    const north = 20 * Math.exp(-((x - 140) ** 2 + (z + 175) ** 2) / (2 * 55 * 55));
    const cliff = 13 * smoothstep(-110, -175, x);
    return base + hill + north + cliff + 2.4 * noise.fbm(x / 60, z / 60, 3);
  };
  fillGround(map, (x, z) => {
    const { d, steep } = coast(x, z);
    if (d <= 0) return -2 - Math.min(9, -d * 0.35);
    return lerp(-2, land(x, z), smoothstep(0, steep ? 3 : 26, d));
  });

  const rng = makeRng(`${seed}:build`);
  const square = { x: 20, z: -10 };
  map.square = { x: square.x, z: square.z, r: 22 };
  const inTown = (x, z) => Math.hypot(x - 10, z - 5) < 150;
  // streets: radial lines from the square and two rings
  const streets = [];
  for (const a of [-2.6, -1.9, -1.2, -0.45, 0.35, 1.2, 1.75, 2.35, 3.0]) {
    const pts = [];
    for (let r = 24; r < 160; r += 6) pts.push([square.x + Math.cos(a) * r + 6 * Math.sin(r / 30), square.z + Math.sin(a) * r]);
    streets.push(pts);
  }
  for (const R of [52, 98]) {
    const pts = [];
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.06) pts.push([square.x + Math.cos(a) * R, square.z + Math.sin(a) * R * 0.92]);
    streets.push(pts);
  }
  // harbour front
  {
    const pts = [];
    for (let a = Math.PI * 1.08; a <= Math.PI * 1.95; a += 0.05) pts.push([bay.x + Math.cos(a) * (bay.r + 9), bay.z + Math.sin(a) * (bay.r + 9)]);
    streets.push(pts);
  }
  map.streets = streets;
  const houses = [];
  const tooClose = (x, z, r) => houses.some((h) => Math.hypot(h.x - x, h.z - z) < r);
  const onStreet = (x, z) => streets.some((pts) => pts.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 5.5));
  for (const pts of streets) {
    for (let k = 1; k < pts.length - 1; k += 1) {
      const [x0, z0] = pts[k - 1];
      const [x1, z1] = pts[k + 1];
      const dirA = Math.atan2(z1 - z0, x1 - x0);
      for (const side of [-1, 1]) {
        const off = rng.range(8, 10.5);
        const x = pts[k][0] + Math.cos(dirA + (side * Math.PI) / 2) * off;
        const z = pts[k][1] + Math.sin(dirA + (side * Math.PI) / 2) * off;
        if (!inTown(x, z) || Math.hypot(x - square.x, z - square.z) < 24) continue;
        const dTown = Math.hypot(x - 10, z - 5);
        if (rng.next() > 1.6 - dTown / 130) continue;
        const { d } = coast(x, z);
        if (d < 7 || groundAt(map, x, z) < 1.2) continue;
        if (slopeOver(map, x, z, 4) > 3.5) continue;
        if (tooClose(x, z, 7.6) || onStreet(x, z)) continue;
        const w = rng.range(5.5, 8);
        const dd = rng.range(7, 10);
        const h = rng.range(4.5, 8.5) + (dTown < 60 ? 2 : 0);
        const b = addBuilding(map, {
          kind: 'house',
          x,
          z,
          w,
          d: dd,
          h,
          yaw: dirA,
          roof: 'gable',
          wall: rng.int(0, map.look.walls.length - 1),
          roofColor: rng.int(0, map.look.roofs.length - 1),
          chimney: rng.chance(0.4),
        });
        houses.push(b);
      }
    }
  }
  // the church and its tower in the square
  const nave = addBuilding(map, { kind: 'church', x: square.x - 4, z: square.z - 18, w: 11, d: 22, h: 11, yaw: 0.1, roof: 'gable', wall: 0, roofColor: 1 });
  const tower = addBuilding(map, { kind: 'tower', x: square.x - 4, z: square.z - 2, w: 7, d: 7, h: 26, yaw: 0.1, roof: 'pyramid', roofH: 7, wall: 0, roofColor: 1 });
  ringPerches(map, tower.x, tower.y + tower.h + 0.2, tower.z, 4.2, 12);
  for (const b of [...houses, nave]) ridgePerches(map, b);
  // breakwaters
  for (const [x, z, w, yaw] of [[-52, 168, 34, 0.5], [30, 172, 30, -0.6]]) {
    addBuilding(map, { kind: 'quay', x, z, w, d: 5, h: 2.2, yaw, roof: 'flat', wall: 3, roofColor: 0 });
  }
  // boats in the bay
  for (let k = 0; k < 9; k++) {
    const a = rng.range(Math.PI * 0.15, Math.PI * 0.85);
    const r = rng.range(14, 44);
    const x = bay.x + Math.cos(a) * r;
    const z = bay.z + Math.sin(a) * r * 0.8;
    const yaw = rng.range(0, Math.PI * 2);
    map.props.push({ kind: 'boat', x, z, y: 0, yaw, s: rng.range(0.9, 1.3), color: rng.int(0, 4) });
    ringPerches(map, x, 9.2, z, 1.4, 6);
  }
  // the lighthouse on the headland, the windmill on the north hill
  {
    const y = groundAt(map, head.x - 4, head.z + 2);
    map.props.push({ kind: 'lighthouse', x: head.x - 4, z: head.z + 2, y, yaw: 0, s: 1, top: y + 26, r: 3.5 });
    ringPerches(map, head.x - 4, y + 21.4, head.z + 2, 3.6, 14);
  }
  {
    const y = groundAt(map, 140, -175);
    map.props.push({ kind: 'windmill', x: 140, z: -175, y, yaw: 0.9, s: 1, top: y + 18, r: 4 });
    ringPerches(map, 140, y + 16.5, -175, 3.4, 10);
  }
  // poles and wires along most streets, and out across the fields
  for (const pts of streets) {
    let last = null;
    let run = 0;
    for (let k = 0; k < pts.length; k += 3) {
      const [sx, sz] = pts[k];
      const n = pts[Math.min(pts.length - 1, k + 1)];
      const dir = Math.atan2(n[1] - sz, n[0] - sx);
      const x = sx + Math.cos(dir + Math.PI / 2) * 4.2;
      const z = sz + Math.sin(dir + Math.PI / 2) * 4.2;
      if (coast(x, z).d < 3 || tooClose(x, z, 4.5)) {
        last = null;
        continue;
      }
      const p = addPole(map, x, z, 9);
      if (last && Math.hypot(last.x - x, last.z - z) < 30) addSpan(map, last, p, 2);
      last = p;
      run++;
    }
  }
  const fieldLine = (pts, h = 9.5) => {
    let last = null;
    for (const [x, z] of pts) {
      const p = addPole(map, x, z, h);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
  };
  const line = (x0, z0, x1, z1, step = 26) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const pts = [];
    for (let d = 0; d <= len; d += step) pts.push([lerp(x0, x1, d / len), lerp(z0, z1, d / len)]);
    return pts;
  };
  fieldLine(line(90, -80, 135, -160));
  fieldLine(line(-20, -110, 60, -230));
  fieldLine(line(-110, -40, -170, 60));
  fieldLine(line(-90, 70, -175, 110));
  fieldLine(line(140, -30, 240, -60));
  fieldLine(line(60, -150, 220, -170));
  fieldLine(line(-60, -150, -150, -200));

  // fields north and east: a patchwork, with hedgerows, hay bales and lines of trees
  const fieldSeeds = [];
  for (let k = 0; k < 70; k++) {
    const x = rng.range(-260, 280);
    const z = rng.range(-300, 40);
    if (Math.hypot(x - 10, z - 5) < 150) continue;
    fieldSeeds.push({ x, z, c: rng.int(0, map.look.fields.length - 1) });
  }
  map.fieldSeeds = fieldSeeds;
  for (const f of fieldSeeds) {
    if (coast(f.x, f.z).d < 10) continue;
    if (map.look.fields[f.c] === '#D9B35A' || map.look.fields[f.c] === '#E1C26B') {
      const bales = rng.int(2, 5);
      for (let b = 0; b < bales; b++) {
        const x = f.x + rng.range(-14, 14);
        const z = f.z + rng.range(-14, 14);
        const y = groundAt(map, x, z);
        map.props.push({ kind: 'hay', x, z, y, yaw: rng.range(0, 3), s: 1, top: y + 1.8, r: 1.4 });
        ringPerches(map, x, y + 1.85, z, 0.8, 4, 'hay');
      }
    }
  }
  for (let k = 0; k < 420; k++) {
    const x = rng.range(-280, 290);
    const z = rng.range(-300, 120);
    const dTown = Math.hypot(x - 10, z - 5);
    const { d } = coast(x, z);
    if (d < 8 || onStreet(x, z) || tooClose(x, z, 6)) continue;
    if (dTown < 140 && rng.next() > 0.25) continue;
    const cyp = dTown < 170 && rng.chance(0.55);
    const t = addTree(map, x, z, cyp ? rng.range(7, 11) : rng.range(5, 8), cyp ? 1.3 : rng.range(2.2, 3.4), cyp ? 'cypress' : 'round');
    if (k % 3 === 0) ringPerches(map, x, t.y + t.h * 0.92, z, t.r * 0.55, 4, 'tree');
  }

  // window lights for dusk: two windows on each house's long sides
  for (const b of houses) {
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    for (const side of [-1, 1]) {
      for (const u of [-0.22, 0.22]) {
        const lx = b.x + c * u * b.w - s * side * (b.d / 2 + 0.05);
        const lz = b.z + s * u * b.w + c * side * (b.d / 2 + 0.05);
        map.lamps.push([lx, b.y + b.h * 0.6, lz, b.yaw + (side > 0 ? 0 : Math.PI), 1.1, 1.4]);
      }
    }
  }
  // the town's chimney thermals, the cliffs, the quarry, the wheat, the headland
  const chimneys = houses.filter((h) => h.chimney && Math.hypot(h.x - 10, h.z - 5) < 90);
  const picks = [chimneys[3], chimneys[Math.floor(chimneys.length / 2)], chimneys[chimneys.length - 4]].filter(Boolean);
  for (const h of picks) map.thermals.push({ x: h.x, z: h.z, r: 9, top: 55, kind: 'chimney' });
  for (const [x, z, kind] of [[-178, -60, 'cliff'], [-182, 40, 'cliff'], [205, -25, 'quarry'], [55, -205, 'field'], [-192, 128, 'cliff']]) {
    map.thermals.push({ x, z, r: 9, top: 55, kind });
  }
  // grey wheels: fields, harbour, cliffs, the square, the east hill
  map.wheels = [
    { cx: 40, cz: -190, rx: 40, rz: 24, h: 14, speed: 0.24, phase: 0 },
    { cx: -10, cz: 112, rx: 30, rz: 20, h: 14, speed: -0.3, phase: 1 },
    { cx: -158, cz: -12, rx: 24, rz: 34, h: 15, speed: 0.27, phase: 2 },
    { cx: 22, cz: -8, rx: 28, rz: 26, h: 18, speed: -0.25, phase: 3 },
    { cx: 172, cz: -92, rx: 34, rz: 24, h: 14, speed: 0.22, phase: 4 },
  ];
  // spawns on a ring round the town, facing in
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.2;
    const x = map.center.x + Math.cos(a) * 215;
    const z = map.center.z + Math.sin(a) * 200;
    map.spawns.push({ x, z, yaw: Math.atan2(map.center.z - z, map.center.x - x) });
  }
  // the title's wire on the east hill, looking west over the town to the sea
  {
    const a = addPole(map, 150, -40, 9);
    const b = addPole(map, 150, 4, 9);
    addSpan(map, a, b, 1, false);
    const wire = map.wires[map.wires.length - 1];
    const y = wire.ay - wire.sag;
    map.title = { wire, camera: [158, y + 2.2, -20], look: [-180, 6, 40], spawn: { x: 145, z: -18, yaw: Math.PI } };
  }
  // the great wires: the roost
  roost(map, -82, -6, 52, Math.PI / 2, [34, 0, 0]);
  return finish(map, 1500, seed);
}

/** Two pylons with six wires, stacked; the camera looks at them from `cam` (offset from the middle). */
function roost(map, x, z, span, yaw, camOff) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const ax = x - (c * span) / 2;
  const az = z - (s * span) / 2;
  const bx = x + (c * span) / 2;
  const bz = z + (s * span) / 2;
  const ya = groundAt(map, ax, az);
  const yb = groundAt(map, bx, bz);
  const base = Math.max(ya, yb);
  const top = base + 27;
  map.props.push({ kind: 'pylon', x: ax, z: az, y: ya, yaw, s: 1, h: top - ya, top, r: 3 });
  map.props.push({ kind: 'pylon', x: bx, z: bz, y: yb, yaw, s: 1, h: top - yb, top, r: 3 });
  const wires = [];
  for (let k = 0; k < 6; k++) {
    const y = top - 1.5 - k * 2.6;
    const w = { ax, ay: y, az, bx, by: y, bz, sag: 1.6 };
    map.wires.push(w);
    wires.push(w);
  }
  const cy = top - 8;
  map.roost = { x, z, yaw, span, wires, camera: [x + camOff[0], cy + 1, z + camOff[2]], look: [x, cy - 0.5, z] };
}

// ------------------------------------------------------------------ Redrock Canyon

function redrock() {
  const seed = 'redrock';
  const noise = makeNoise2(seed);
  const map = newMap('redrock', 'Redrock Canyon', {
    sky: 'desert',
    rock: '#B4532A',
    rockLight: '#D9844A',
    ochre: '#E3A857',
    sage: '#8F9A6A',
    sand: '#E8C9A0',
    sea: '#25797E',
    walls: ['#C9A27A', '#B98B62', '#D8B48A'],
    roofs: ['#7A4A33', '#6A5A4A', '#8A5A3A'],
    fields: [],
  });
  map.hasSea = true;
  map.water = 1.2;
  map.seaDepth = 3.5; // a river: deep a few units in
  const cx = (z) => 40 * Math.sin(z / 90) + 22 * Math.sin(z / 37 + 0.6);
  map.canyonX = cx;
  const buttes = [];
  const rng = makeRng(`${seed}:build`);
  for (let k = 0; k < 9; k++) {
    const z = rng.range(-250, 250);
    const side = rng.chance(0.5) ? 1 : -1;
    buttes.push({ x: cx(z) + side * rng.range(70, 200), z, r: rng.range(12, 22), h: rng.range(14, 24) });
  }
  // two buttes inside the gorge
  buttes.push({ x: cx(-60), z: -60, r: 11, h: 34 });
  buttes.push({ x: cx(130), z: 130, r: 9, h: 30 });
  const plateau = (x, z) => 34 + 5 * noise.fbm(x / 80, z / 80, 3);
  fillGround(map, (x, z) => {
    const dx = Math.abs(x - cx(z));
    const wall = smoothstep(20, 66, dx + 7 * noise(x / 45, z / 45));
    let h = lerp(-1.5, plateau(x, z), wall);
    // terraces: ledges with walls between, the walls wide enough that the grid draws them as slopes, not steps
    const step = 7;
    const t = h / step;
    h = lerp(h, (Math.floor(t) + smoothstep(0.3, 1, t - Math.floor(t))) * step, 0.75);
    for (const b of buttes) {
      const d = Math.hypot(x - b.x, z - b.z);
      const inGorge = Math.abs(b.x - cx(b.z)) < 30;
      const baseH = inGorge ? 0 : h;
      const lift = smoothstep(b.r + 6, b.r, d) * b.h;
      h = Math.max(h, baseH + lift);
    }
    return h;
  });
  // the ranch on the east rim
  const rx = cx(-150) + 95;
  for (let k = 0; k < 6; k++) {
    const x = rx + (k % 3) * 14 + rng.range(-2, 2);
    const z = -150 + Math.floor(k / 3) * 16;
    const b = addBuilding(map, { kind: 'house', x, z, w: rng.range(7, 10), d: rng.range(8, 12), h: rng.range(4, 6), yaw: 0.05, roof: k === 2 ? 'gable' : 'flat', wall: rng.int(0, 2), roofColor: rng.int(0, 2) });
    if (b.roof === 'gable') ridgePerches(map, b);
    else edgePerches(map, b);
    map.lamps.push([b.x, b.y + b.h * 0.55, b.z + b.d / 2 + 0.05, 0, 1.2, 1.4]);
  }
  // the railway trestle across the gorge, and its line of poles
  {
    const z = 40;
    const x0 = cx(z) - 75;
    const x1 = cx(z) + 75;
    const y = plateau(cx(z), z) - 2;
    const b = addBuilding(map, { kind: 'trestle', x: (x0 + x1) / 2, z, w: x1 - x0, d: 5, h: y - 0.4, yaw: 0, roof: 'flat', wall: 1, roofColor: 1 });
    edgePerches(map, b);
    let last = null;
    for (let x = x0 - 130; x <= x1 + 130; x += 26) {
      const onTrestle = x > x0 && x < x1;
      const p = onTrestle ? { x, z: z + 3.5, y: b.top - 0.2, h: 6 } : addPole(map, x, z + 3.5, 8);
      if (onTrestle) map.poles.push(p);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
  }
  // a road along the west rim with its wires
  {
    let last = null;
    for (let z = -270; z <= 270; z += 25) {
      const x = cx(z) - 80 + 10 * Math.sin(z / 60);
      const p = addPole(map, x, z, 8);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
  }
  for (const b of buttes) {
    const y = groundAt(map, b.x, b.z);
    ringPerches(map, b.x, y + 0.2, b.z, b.r * 0.6, 14, 'special');
    map.props.push({ kind: 'mark', x: b.x, z: b.z, y, top: y + 1, r: b.r });
  }
  for (let k = 0; k < 360; k++) {
    const x = rng.range(-290, 290);
    const z = rng.range(-290, 290);
    const dx = Math.abs(x - cx(z));
    const river = dx < 20;
    if (!river && dx < 60) continue;
    if (river && rng.next() > 0.5) continue;
    const t = addTree(map, x, z, river ? rng.range(6, 9) : rng.range(2.5, 4.5), river ? rng.range(2.4, 3.4) : rng.range(1.4, 2.2), river ? 'round' : 'juniper');
    if (k % 2 === 0) ringPerches(map, x, t.y + t.h * 0.9, z, t.r * 0.55, 4, 'tree');
  }
  // twelve rim thermals, alternating sides down the gorge
  for (let k = 0; k < 12; k++) {
    const z = -255 + k * 46;
    const side = k % 2 ? 1 : -1;
    map.thermals.push({ x: cx(z) + side * 46, z, r: 9, top: 60, kind: 'cliff' });
  }
  map.wheels = [
    { cx: cx(-200), cz: -200, rx: 18, rz: 40, h: 16, speed: 0.26, phase: 0 },
    { cx: cx(-20), cz: -20, rx: 18, rz: 36, h: 18, speed: -0.24, phase: 1.5 },
    { cx: cx(180), cz: 180, rx: 18, rz: 40, h: 16, speed: 0.28, phase: 3 },
    { cx: cx(0) + 150, cz: 60, rx: 35, rz: 30, h: 14, speed: -0.22, phase: 4.5 },
  ];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = Math.cos(a) * 225;
    const z = Math.sin(a) * 225;
    map.spawns.push({ x, z, yaw: Math.atan2(-z, -x) });
  }
  {
    const a = addPole(map, 175, -30, 9);
    const b = addPole(map, 175, 14, 9);
    addSpan(map, a, b, 1, false);
    const wire = map.wires[map.wires.length - 1];
    map.title = { wire, camera: [183, wire.ay - wire.sag + 2.2, -8], look: [-150, 10, 20], spawn: { x: 170, z: -8, yaw: Math.PI } };
  }
  roost(map, cx(-100) - 70, -100, 52, Math.PI / 2, [34, 0, 0]);
  return finish(map, 1500, seed);
}

// ------------------------------------------------------------------ Stormfield

function stormfield() {
  const seed = 'stormfield';
  const noise = makeNoise2(seed);
  const map = newMap('stormfield', 'Stormfield', {
    sky: 'storm',
    grass: '#7F9650',
    grassDry: '#B9A35C',
    sand: '#D8C08A',
    rock: '#8C7A66',
    stone: '#BFAE92',
    sea: '#3E6470',
    walls: ['#EFE6D6', '#E7D9BF', '#F2ECE2'],
    roofs: ['#7E3B2C', '#5F4A3E', '#8E4632'],
    barn: '#9A3B2B',
    fields: ['#E2BC5E', '#D9B04F', '#EBC86C', '#CFA548', '#9DAE5C', '#B8875C'],
  });
  fillGround(map, (x, z) => 4 + 7 * noise.fbm(x / 140, z / 140, 3) + 3 * noise(x / 40, z / 40));
  const rng = makeRng(`${seed}:build`);
  // roads: a loose grid with poles and wires along every road
  const roadsX = [-200, -95, 10, 120, 215];
  const roadsZ = [-210, -100, 0, 105, 210];
  map.streets = [];
  for (const rx of roadsX) {
    const pts = [];
    let last = null;
    for (let z = -290; z <= 290; z += 25) {
      const x = rx + 9 * Math.sin(z / 50 + rx);
      pts.push([x, z]);
      const p = addPole(map, x + 4, z, 8.5);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
    map.streets.push(pts);
  }
  for (const rz of roadsZ) {
    const pts = [];
    let last = null;
    for (let x = -290; x <= 290; x += 27) {
      const z = rz + 8 * Math.sin(x / 45 + rz);
      pts.push([x, z]);
      if (Math.abs(x % 54) < 27) {
        const p = addPole(map, x, z + 4, 8.5);
        if (last) addSpan(map, last, p, 2);
        last = p;
      }
    }
    map.streets.push(pts);
  }
  // farmsteads
  const farms = [];
  for (let k = 0; k < 10; k++) {
    const x = rng.pick(roadsX) + rng.pick([-1, 1]) * rng.range(22, 34);
    const z = rng.range(-250, 250);
    if (farms.some((f) => Math.hypot(f.x - x, f.z - z) < 70)) continue;
    farms.push({ x, z });
    const yaw = rng.range(-0.2, 0.2);
    const house = addBuilding(map, { kind: 'house', x, z, w: 7, d: 10, h: 6, yaw, roof: 'gable', wall: rng.int(0, 2), roofColor: rng.int(0, 2), chimney: true });
    const barn = addBuilding(map, { kind: 'barn', x: x + 16, z: z + 4, w: 12, d: 18, h: 7, yaw, roof: 'gable', roofH: 6, wall: 0, roofColor: 0, barn: true });
    ridgePerches(map, house);
    ridgePerches(map, barn);
    map.props.push({ kind: 'silo', x: x + 8, z: z - 12, y: groundAt(map, x + 8, z - 12), s: 1, top: groundAt(map, x + 8, z - 12) + 15, r: 3 });
    ringPerches(map, x + 8, groundAt(map, x + 8, z - 12) + 15.4, z - 12, 2.4, 8);
    map.lamps.push([house.x, house.y + 3.6, house.z + 5.05, 0, 1.2, 1.4]);
  }
  map.farms = farms;
  for (const [x, z] of [[-150, -160], [170, 150]]) {
    const y = groundAt(map, x, z);
    map.props.push({ kind: 'windmill', x, z, y, yaw: 0.6, s: 1, top: y + 18, r: 4 });
    ringPerches(map, x, y + 16.5, z, 3.4, 10);
  }
  const fieldSeeds = [];
  for (let k = 0; k < 90; k++) fieldSeeds.push({ x: rng.range(-300, 300), z: rng.range(-300, 300), c: rng.int(0, map.look.fields.length - 1) });
  map.fieldSeeds = fieldSeeds;
  for (const f of fieldSeeds) {
    if (f.c > 3) continue;
    for (let b = 0; b < 3; b++) {
      const x = f.x + rng.range(-16, 16);
      const z = f.z + rng.range(-16, 16);
      const y = groundAt(map, x, z);
      map.props.push({ kind: 'hay', x, z, y, yaw: rng.range(0, 3), s: 1, top: y + 1.8, r: 1.4 });
      ringPerches(map, x, y + 1.85, z, 0.8, 4, 'hay');
    }
  }
  // tree lines along the roads
  for (const pts of map.streets) {
    for (let k = 0; k < pts.length; k++) {
      if (rng.next() > 0.45) continue;
      const [x, z] = pts[k];
      const t = addTree(map, x - 7 + rng.range(-1, 1), z + rng.range(-6, 6), rng.range(6, 9), rng.range(2.4, 3.4), 'round');
      if (k % 2 === 0) ringPerches(map, t.x, t.y + t.h * 0.92, t.z, t.r * 0.55, 4, 'tree');
    }
  }
  for (let k = 0; k < 6; k++) {
    const f = fieldSeeds[k * 7 + 3];
    map.thermals.push({ x: clamp(f.x, -240, 240), z: clamp(f.z, -240, 240), r: 9, top: 55, kind: 'field' });
  }
  map.wheels = [
    { cx: -150, cz: 60, rx: 34, rz: 26, h: 14, speed: 0.25, phase: 0 },
    { cx: 0, cz: -150, rx: 40, rz: 26, h: 14, speed: -0.23, phase: 1.3 },
    { cx: 60, cz: 60, rx: 30, rz: 30, h: 15, speed: 0.27, phase: 2.6 },
    { cx: 180, cz: -60, rx: 34, rz: 26, h: 14, speed: -0.24, phase: 3.9 },
    { cx: -60, cz: 200, rx: 36, rz: 24, h: 14, speed: 0.22, phase: 5.2 },
  ];
  // spawns on the east side mostly (the storm comes from the west), all facing in
  for (let k = 0; k < 12; k++) {
    const a = -Math.PI / 2 + (k / 11) * Math.PI;
    const x = 40 + Math.cos(a) * 190;
    const z = Math.sin(a) * 210;
    map.spawns.push({ x, z, yaw: Math.atan2(-z, -x) });
  }
  {
    const a = addPole(map, 175, -40, 9);
    const b = addPole(map, 175, 4, 9);
    addSpan(map, a, b, 1, false);
    const wire = map.wires[map.wires.length - 1];
    map.title = { wire, camera: [183, wire.ay - wire.sag + 2.2, -18], look: [-150, 8, 10], spawn: { x: 170, z: -18, yaw: Math.PI } };
  }
  roost(map, 240, 30, 52, Math.PI / 2, [-34, 0, 0]);
  return finish(map, 1500, seed);
}

// ------------------------------------------------------------------ Lantern City

function lantern() {
  const seed = 'lantern';
  const map = newMap('lantern', 'Lantern City', {
    sky: 'city',
    grass: '#6E7F5A',
    sand: '#C9B796',
    rock: '#7A6E66',
    stone: '#9E9184',
    street: '#5B5560',
    sea: '#22495A',
    walls: ['#B9664A', '#C98E62', '#D9C2A0', '#8E7F78', '#A9504A', '#CDB79A', '#6F6A72'],
    roofs: ['#4C4652', '#5E5560', '#3F3A46'],
    fields: [],
  });
  map.hasSea = true;
  const coastS = (x) => 150 + 12 * Math.sin(x / 80);
  map.coast = (x, z) => ({ d: coastS(x) - z, steep: false });
  fillGround(map, (x, z) => {
    const d = coastS(x) - z;
    if (d <= 0) return -2 - Math.min(8, -d * 0.4);
    return lerp(-2, 2.5, smoothstep(0, 8, d));
  });
  const rng = makeRng(`${seed}:build`);
  const block = 46;
  const street = 12;
  map.streets = [];
  const centre = { x: 0, z: -30 };
  for (let bx = -6; bx <= 6; bx++) {
    for (let bz = -6; bz <= 3; bz++) {
      const x0 = bx * block - block / 2 + street / 2;
      const z0 = bz * block - block / 2 + street / 2;
      const size = block - street;
      const mx = x0 + size / 2;
      const mz = z0 + size / 2;
      if (map.coast(mx, mz).d < 22) continue;
      if (Math.hypot(mx, mz) > 285) continue;
      const dc = Math.hypot(mx - centre.x, mz - centre.z);
      if ((bx === 1 && bz === -1) || (bx === -3 && bz === 1)) {
        // two parks
        map.parks.push({ x0, z0, size });
        for (let k = 0; k < 8; k++) {
          const t = addTree(map, x0 + rng.range(4, size - 4), z0 + rng.range(4, size - 4), rng.range(6, 9), rng.range(2.4, 3.4), 'round');
          ringPerches(map, t.x, t.y + t.h * 0.92, t.z, t.r * 0.55, 4, 'tree');
        }
        continue;
      }
      const splitX = rng.chance(0.5);
      const parts = rng.int(1, 3);
      for (let p = 0; p < parts; p++) {
        const w = splitX ? size / parts - 1.5 : size - 1.5;
        const d = splitX ? size - 1.5 : size / parts - 1.5;
        const x = splitX ? x0 + (p + 0.5) * (size / parts) : mx;
        const z = splitX ? mz : z0 + (p + 0.5) * (size / parts);
        const tall = Math.max(10, 64 - dc * 0.22) * rng.range(0.55, 1.1);
        const b = addBuilding(map, { kind: 'block', x, z, w, d, h: tall, yaw: 0, roof: 'flat', wall: rng.int(0, map.look.walls.length - 1), roofColor: rng.int(0, 2) });
        edgePerches(map, b);
        if (rng.chance(0.25)) {
          map.props.push({ kind: 'watertower', x: x + rng.range(-w / 4, w / 4), z: z + rng.range(-d / 4, d / 4), y: b.top, s: 1, top: b.top + 7, r: 2.4 });
          const wt = map.props[map.props.length - 1];
          ringPerches(map, wt.x, wt.top + 0.2, wt.z, 2, 8);
        }
        // windows: a grid of lit panes on two faces
        const floors = Math.floor(tall / 4);
        for (let f = 1; f < floors; f++) {
          for (let c = 0; c < 3; c++) {
            if (rng.next() < 0.45) continue;
            const u = (c - 1) * (w / 3.2);
            map.lamps.push([x + u, b.y + f * 4, z + d / 2 + 0.06, 0, 1.6, 2]);
            if (rng.next() < 0.6) map.lamps.push([x + u, b.y + f * 4, z - d / 2 - 0.06, Math.PI, 1.6, 2]);
          }
        }
      }
    }
  }
  // tram wires on the avenues
  for (const ax of [-2.5 * block + street / 2 - block / 2, 0.5 * block - block / 2 + street / 2 - street, 2.5 * block]) {
    let last = null;
    for (let z = -270; z <= 130; z += 23) {
      const p = addPole(map, ax, z, 9);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
  }
  for (const az of [-3 * block + block / 2 - street / 2, -block / 2 - street / 2 + block, 2 * block - block / 2 - street / 2]) {
    let last = null;
    for (let x = -280; x <= 280; x += 23) {
      const p = addPole(map, x, az, 9);
      if (last) addSpan(map, last, p, 2);
      last = p;
    }
  }
  // the waterfront: quays and boats
  for (let k = 0; k < 8; k++) {
    const x = -220 + k * 60 + rng.range(-10, 10);
    const z = coastS(x) + rng.range(14, 40);
    map.props.push({ kind: 'boat', x, z, y: 0, yaw: rng.range(0, 6), s: rng.range(1, 1.4), color: rng.int(0, 4) });
    ringPerches(map, x, 9.2, z, 1.4, 6);
  }
  const roofs = map.buildings.filter((b) => b.h > 30);
  for (let k = 0; k < 6; k++) {
    const b = roofs[Math.floor((k + 0.5) * (roofs.length / 6))];
    if (b) map.thermals.push({ x: b.x, z: b.z, r: 9, top: b.top + 30, kind: 'vent' });
  }
  map.wheels = [
    { cx: -100, cz: -150, rx: 36, rz: 26, h: 18, speed: 0.25, phase: 0 },
    { cx: 120, cz: -100, rx: 30, rz: 30, h: 18, speed: -0.25, phase: 1.5 },
    { cx: 30, cz: 100, rx: 40, rz: 22, h: 14, speed: 0.22, phase: 3 },
    { cx: -170, cz: 60, rx: 30, rz: 30, h: 16, speed: -0.27, phase: 4.5 },
  ];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 220;
    const z = -30 + Math.sin(a) * 200;
    map.spawns.push({ x, z, yaw: Math.atan2(-30 - z, -x) });
  }
  {
    const a = addPole(map, 200, -60, 9);
    const b = addPole(map, 200, -16, 9);
    addSpan(map, a, b, 1, false);
    const wire = map.wires[map.wires.length - 1];
    map.title = { wire, camera: [208, wire.ay - wire.sag + 2.2, -38], look: [-150, 30, 20], spawn: { x: 195, z: -38, yaw: Math.PI } };
  }
  roost(map, -60, 130, 52, 0, [0, 0, -34]);
  return finish(map, 2200, seed);
}

// ------------------------------------------------------------------ tints (ground colours), by place

function tintSaltmere(map) {
  const L = map.look;
  const grass = hex(L.grass);
  const dry = hex(L.grassDry);
  const sand = hex(L.sand);
  const rock = hex(L.rock);
  const stone = hex(L.stone);
  const fields = L.fields.map(hex);
  const seabed = hex('#2D6F78');
  const noise = makeNoise2('saltmere:tint');
  const streetsFlat = map.streets.flat();
  fillTint(map, (x, z, h, slope) => {
    if (h < 0) return mix(seabed, sand, smoothstep(-6, 0, h));
    const { d } = map.coast(x, z);
    let c = mix(grass, dry, smoothstep(-0.3, 0.6, noise.fbm(x / 70, z / 70, 3)) * 0.8);
    const dTown = Math.hypot(x - 10, z - 5);
    if (dTown > 140 && map.fieldSeeds.length) {
      let best = Infinity;
      let fc = 0;
      for (const f of map.fieldSeeds) {
        const dd = (f.x - x) ** 2 + (f.z - z) ** 2;
        if (dd < best) {
          best = dd;
          fc = f.c;
        }
      }
      c = mix(c, fields[fc], smoothstep(140, 165, dTown) * 0.9);
    }
    if (dTown < 150) {
      let near = Infinity;
      for (let k = 0; k < streetsFlat.length; k += 2) {
        const [sx, sz] = streetsFlat[k];
        const dd = Math.abs(sx - x) + Math.abs(sz - z);
        if (dd < near) near = dd;
      }
      c = mix(c, stone, smoothstep(9, 4, near) * 0.85);
    }
    c = mix(c, sand, smoothstep(10, 2, d));
    c = mix(c, rock, smoothstep(0.55, 1.1, slope));
    return shade(c, 0.92 + 0.12 * noise(x / 9, z / 9));
  });
}

function tintRedrock(map) {
  const L = map.look;
  const rock = hex(L.rock);
  const light = hex(L.rockLight);
  const ochre = hex(L.ochre);
  const sand = hex(L.sand);
  const dirt = hex('#C0683C');
  const pale = hex('#E9C58E');
  const bank = hex('#8C9A5E');
  const noise = makeNoise2('redrock:tint');
  fillTint(map, (x, z, h, slope) => {
    // walls: bands of red and pale rock by height
    const band = 0.5 + 0.5 * Math.sin(h * 0.9 + noise(x / 40, z / 40) * 2);
    const wall = mix(rock, light, band);
    // flats: pale sand and ochre, with patches of red dirt
    const patch = smoothstep(-0.15, 0.35, noise.fbm(x / 55, z / 55, 3));
    let flat = mix(mix(pale, ochre, 0.45 + 0.35 * noise(x / 18, z / 18)), dirt, patch * 0.7);
    if (h < 3.2) flat = mix(sand, bank, smoothstep(3.2, 1.6, h) * 0.75);
    const c = mix(wall, flat, smoothstep(0.62, 0.3, slope));
    return shade(c, 0.92 + 0.12 * noise(x / 7, z / 7));
  });
}

function tintFields(map) {
  const L = map.look;
  const fields = L.fields.map(hex);
  const grass = hex(L.grass);
  const road = hex('#BFA98A');
  const noise = makeNoise2(`${map.id}:tint`);
  const roads = map.streets.flat();
  fillTint(map, (x, z, h) => {
    let best = Infinity;
    let fc = 0;
    for (const f of map.fieldSeeds) {
      const dd = (f.x - x) ** 2 + (f.z - z) ** 2;
      if (dd < best) {
        best = dd;
        fc = f.c;
      }
    }
    let c = mix(fields[fc], grass, 0.12);
    // rows in the wheat
    c = shade(c, 0.94 + 0.08 * Math.sin((x + z) * 0.9));
    let near = Infinity;
    for (let k = 0; k < roads.length; k++) {
      const [sx, sz] = roads[k];
      const dd = Math.abs(sx - x) + Math.abs(sz - z);
      if (dd < near) near = dd;
    }
    c = mix(c, road, smoothstep(7, 3, near));
    return shade(c, 0.93 + 0.1 * noise(x / 8, z / 8) + 0.02 * h / 10);
  });
}

function tintCity(map) {
  const L = map.look;
  const street = hex(L.street);
  const stone = hex(L.stone);
  const sand = hex(L.sand);
  const seabed = hex('#2B5866');
  const noise = makeNoise2('lantern:tint');
  fillTint(map, (x, z, h) => {
    if (h < 0) return mix(seabed, sand, smoothstep(-6, 0, h));
    const gx = Math.abs((((x + 23) % 46) + 46) % 46 - 23);
    const gz = Math.abs((((z + 23) % 46) + 46) % 46 - 23);
    const onStreet = Math.max(gx, gz) > 17;
    const c = onStreet ? street : stone;
    return shade(mix(c, sand, smoothstep(8, 1, map.coast(x, z).d)), 0.92 + 0.1 * noise(x / 6, z / 6));
  });
}

// ------------------------------------------------------------------ the catalogue

const BUILDERS = {
  saltmere: () => {
    const m = saltmere();
    tintSaltmere(m);
    return m;
  },
  redrock: () => {
    const m = redrock();
    tintRedrock(m);
    return m;
  },
  stormfield: () => {
    const m = stormfield();
    tintFields(m);
    return m;
  },
  lantern: () => {
    const m = lantern();
    tintCity(m);
    return m;
  },
};

export const MAP_IDS = Object.keys(BUILDERS);
const cache = new Map();

/** The place by id (built once, then kept). */
export function getMap(id) {
  const key = BUILDERS[id] ? id : 'saltmere';
  if (!cache.has(key)) cache.set(key, BUILDERS[key]());
  return cache.get(key);
}

/** Where a grey wheel is at sunset time t. */
export function wheelPos(map, w, t, out = {}) {
  const def = map.wheels[w];
  const a = def.phase + def.speed * t;
  out.x = def.cx + Math.cos(a) * def.rx;
  out.z = def.cz + Math.sin(a) * def.rz;
  out.y = surfaceAt(map, def.cx, def.cz) + def.h + 2 * Math.sin(a * 2.3);
  out.vx = -Math.sin(a) * def.rx * def.speed;
  out.vz = Math.cos(a) * def.rz * def.speed;
  return out;
}
