// The ground of a place: the height grid, painted once onto a canvas (the place's tints, then fields with rows and hedges,
// paved streets and squares, city blocks with kerbs and crossings, soft shade under every building) and finished in the
// shader with fine detail (grass, cobbles, paving stones, rock strata) and the drifting cloud shadows.

import * as THREE from 'three';
import { HALF, RES, N, groundAt } from '../sim/maps.js';
import { makeRng } from '../sim/rng.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Paint the ground: returns { color, mask } canvases of `size` (mask at half), world [-HALF, HALF] on both axes, row 0 at
 * z = -HALF. Mask channels: R paving (cobbles or slabs), G natural ground (grass, scrub), B tarmac.
 */
export function paintGround(map, size) {
  const S = size / (2 * HALF); // px per world unit
  const color = canvas(size);
  const g = color.getContext('2d');
  const msize = size / 2;
  const mask = canvas(msize);
  const m = mask.getContext('2d');
  const L = map.look;

  // the tints, scaled up so grid vertex i lands on pixel i·(size/256)
  const tint = canvas(N);
  {
    const ctx = tint.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let k = 0; k < N * N; k++) {
      img.data[k * 4] = map.tint[k * 3];
      img.data[k * 4 + 1] = map.tint[k * 3 + 1];
      img.data[k * 4 + 2] = map.tint[k * 3 + 2];
      img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const cell = size / (N - 1);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(tint, -cell / 2, -cell / 2, cell * N, cell * N);

  // the natural-ground mask: land that isn't rock, sand or under water
  {
    const ctx = tint.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const h = map.ground[k];
        const wet = map.hasSea ? smooth(map.water + 0.2, map.water + 1.6, h) : 1;
        const hx = map.ground[j * N + Math.min(N - 1, i + 1)] - map.ground[j * N + Math.max(0, i - 1)];
        const hz = map.ground[Math.min(N - 1, j + 1) * N + i] - map.ground[Math.max(0, j - 1) * N + i];
        const slope = Math.hypot(hx, hz) / (2 * RES);
        const v = Math.round(255 * wet * (1 - smooth(0.5, 1.0, slope)));
        img.data[k * 4] = 0;
        img.data[k * 4 + 1] = v;
        img.data[k * 4 + 2] = 0;
        img.data[k * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const mc = msize / (N - 1);
    m.imageSmoothingEnabled = true;
    m.drawImage(tint, -mc / 2, -mc / 2, mc * N, mc * N);
  }

  // world → canvas transforms
  const W = (ctx, k) => ctx.setTransform(k, 0, 0, k, HALF * k, HALF * k);
  W(g, S);
  W(m, S / 2);

  if (map.fieldSeeds.length) paintFields(map, g, m, S);
  if (map.id === 'lantern') paintCity(map, g, m);
  else paintStreets(map, g, m);
  if (map.farms.length) {
    for (const f of map.farms) {
      blot(g, f.x + 8, f.z - 2, 22, 16, 'rgba(176,150,112,0.55)');
      m.fillStyle = 'rgba(0,0,0,0.6)';
      m.beginPath();
      m.ellipse(f.x + 8, f.z - 2, 18, 12, 0, 0, Math.PI * 2);
      m.fill();
    }
  }

  // soft shade under and round every building, and under trees
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (const b of map.buildings) {
    if (b.kind === 'trestle') continue;
    g.save();
    g.translate(b.x, b.z);
    g.rotate(b.yaw);
    g.shadowColor = 'rgba(40,30,30,0.55)';
    g.shadowBlur = 2.2 * S;
    g.fillStyle = 'rgba(90,80,76,1)';
    g.fillRect(-b.w / 2 - 0.3, -b.d / 2 - 0.3, b.w + 0.6, b.d + 0.6);
    g.restore();
  }
  g.shadowBlur = 0;
  for (const t of map.trees) blot(g, t.x, t.z, t.r * 1.2, t.r * 1.2, 'rgba(70,80,50,0.28)');
  g.restore();

  return { color, mask };
}

function blot(g, x, z, rx, rz, fill) {
  const grad = g.createRadialGradient(x, z, 0, x, z, Math.max(rx, rz));
  grad.addColorStop(0, fill);
  grad.addColorStop(1, fill.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, z, rx, rz, 0, 0, Math.PI * 2);
  g.fill();
}

/** Voronoi cells for the field seeds (clipped by half-planes), each a field with its own rows, edged by hedges. */
function fieldCells(seeds) {
  const B = HALF + 20;
  return seeds.map((f, i) => {
    let poly = [[-B, -B], [B, -B], [B, B], [-B, B]];
    for (let j = 0; j < seeds.length && poly.length; j++) {
      if (j === i) continue;
      const o = seeds[j];
      const nx = o.x - f.x;
      const nz = o.z - f.z;
      const mx = (o.x + f.x) / 2;
      const mz = (o.z + f.z) / 2;
      const side = (p) => (p[0] - mx) * nx + (p[1] - mz) * nz; // > 0: nearer o
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % poly.length];
        const sa = side(a);
        const sb = side(b);
        if (sa <= 0) out.push(a);
        if (sa <= 0 !== sb <= 0) {
          const t = sa / (sa - sb);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      poly = out;
    }
    return poly;
  });
}

function paintFields(map, g, m, S) {
  const L = map.look;
  const rng = makeRng(`${map.id}:fields`);
  const cells = fieldCells(map.fieldSeeds);
  // fields go on a layer of their own, then are cut to where fields belong (out of town, on dry flat land)
  const layer = canvas(g.canvas.width);
  const f = layer.getContext('2d');
  f.setTransform(S, 0, 0, S, HALF * S, HALF * S);
  const hedge = '#4E6234';
  for (let i = 0; i < cells.length; i++) {
    const poly = cells[i];
    if (poly.length < 3) continue;
    const seed = map.fieldSeeds[i];
    const base = L.fields[seed.c % L.fields.length];
    const path = new Path2D();
    poly.forEach((p, k) => (k ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath();
    f.fillStyle = base;
    f.fill(path);
    // rows, at the field's own angle
    f.save();
    f.clip(path);
    const ang = rng.range(0, Math.PI);
    const ploughed = seed.c === L.fields.length - 1;
    const gap = ploughed ? 1.6 : rng.range(1.8, 2.6);
    f.translate(seed.x, seed.z);
    f.rotate(ang);
    f.strokeStyle = ploughed ? 'rgba(60,36,20,0.35)' : 'rgba(70,60,20,0.2)';
    f.lineWidth = gap * 0.42;
    f.beginPath();
    for (let x = -90; x <= 90; x += gap) {
      f.moveTo(x, -90);
      f.lineTo(x, 90);
    }
    f.stroke();
    // a lighter strip of cut stubble along one edge, a tractor's turn
    f.fillStyle = 'rgba(255,240,200,0.12)';
    f.fillRect(-90, -90, 180, 6);
    f.restore();
    // patches: wetter or riper
    for (let k = 0; k < 3; k++) {
      const x = seed.x + rng.range(-20, 20);
      const z = seed.z + rng.range(-20, 20);
      f.save();
      f.clip(path);
      blot(f, x, z, rng.range(6, 14), rng.range(5, 12), rng.chance(0.5) ? 'rgba(255,245,200,0.14)' : 'rgba(40,60,10,0.12)');
      f.restore();
    }
  }
  // hedges: dark lines with bushes along them
  f.strokeStyle = hedge;
  f.lineJoin = 'round';
  f.lineCap = 'round';
  f.lineWidth = 1.5;
  f.globalAlpha = 0.85;
  for (const poly of cells) {
    if (poly.length < 3) continue;
    f.beginPath();
    poly.forEach((p, k) => (k ? f.lineTo(p[0], p[1]) : f.moveTo(p[0], p[1])));
    f.closePath();
    f.stroke();
  }
  f.globalAlpha = 1;
  f.fillStyle = '#425829';
  for (const poly of cells) {
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d < len; d += rng.range(2, 5)) {
        const t = d / len;
        f.beginPath();
        f.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, rng.range(0.9, 1.6), 0, Math.PI * 2);
        f.fill();
      }
    }
  }
  // where the fields go: on flat dry land, outside the town
  const keep = canvas(N);
  {
    const ctx = keep.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      const z = -HALF + j * RES;
      for (let i = 0; i < N; i++) {
        const x = -HALF + i * RES;
        const k = j * N + i;
        let a = 1;
        if (map.id === 'saltmere') {
          a = smooth(146, 162, Math.hypot(x - 10, z - 5));
          a *= smooth(6, 14, map.coast(x, z).d);
        }
        const h = map.ground[k];
        const hx = map.ground[j * N + Math.min(N - 1, i + 1)] - map.ground[j * N + Math.max(0, i - 1)];
        const hz = map.ground[Math.min(N - 1, j + 1) * N + i] - map.ground[Math.max(0, j - 1) * N + i];
        a *= 1 - smooth(0.35, 0.7, Math.hypot(hx, hz) / (2 * RES));
        if (map.hasSea) a *= smooth(map.water + 0.5, map.water + 2, h);
        img.data[k * 4 + 3] = Math.round(255 * a);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = 'destination-in';
  const cell = layer.width / (N - 1);
  f.imageSmoothingEnabled = true;
  f.drawImage(keep, -cell / 2, -cell / 2, cell * N, cell * N);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(layer, 0, 0);
  g.restore();
  // fields aren't wild grass: lower the natural mask where they are, so the shader draws stubble rather than tufts
  m.save();
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'source-over';
  m.globalAlpha = 0.55;
  const tmp = canvas(m.canvas.width);
  const t = tmp.getContext('2d');
  t.fillStyle = '#000';
  t.fillRect(0, 0, tmp.width, tmp.height);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(layer, 0, 0, tmp.width, tmp.height);
  m.drawImage(tmp, 0, 0);
  m.restore();
}

function strokePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, z], k) => (k ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
  ctx.stroke();
}

/** Streets: a darker gutter, then the paving; the square paved too. Country roads are packed earth with grass verges. */
function paintStreets(map, g, m) {
  const L = map.look;
  const town = map.id === 'saltmere';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  m.lineJoin = 'round';
  m.lineCap = 'round';
  const paving = town ? L.stone : '#BCA684';
  const edge = town ? '#9C8A74' : 'rgba(120,130,70,0.8)';
  const width = town ? 7.5 : 6;
  for (const pts of map.streets) {
    g.strokeStyle = edge;
    g.lineWidth = width + 1.6;
    strokePath(g, pts);
  }
  if (town && map.square) {
    g.fillStyle = edge;
    g.beginPath();
    g.arc(map.square.x, map.square.z, map.square.r + 0.8, 0, Math.PI * 2);
    g.fill();
  }
  for (const pts of map.streets) {
    g.strokeStyle = paving;
    g.lineWidth = width;
    strokePath(g, pts);
    if (!town) {
      // wheel ruts
      g.strokeStyle = 'rgba(120,96,70,0.35)';
      g.lineWidth = 0.7;
      g.save();
      g.setLineDash([]);
      strokePath(g, pts.map(([x, z]) => [x + 1.2, z + 0.4]));
      strokePath(g, pts.map(([x, z]) => [x - 1.2, z - 0.4]));
      g.restore();
    }
    m.strokeStyle = town ? 'rgb(255,0,0)' : 'rgb(0,0,0)';
    m.lineWidth = width;
    strokePath(m, pts);
  }
  if (town && map.square) {
    const { x, z, r } = map.square;
    g.fillStyle = paving;
    g.beginPath();
    g.arc(x, z, r, 0, Math.PI * 2);
    g.fill();
    // a ring of darker setts and a compass rose of light ones
    g.strokeStyle = 'rgba(110,90,70,0.45)';
    g.lineWidth = 0.9;
    for (const rr of [r * 0.45, r * 0.8]) {
      g.beginPath();
      g.arc(x, z, rr, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,250,240,0.35)';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r * 0.45, z + Math.sin(a) * r * 0.45);
      g.lineTo(x + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.8);
      g.stroke();
    }
    m.fillStyle = 'rgb(255,0,0)';
    m.beginPath();
    m.arc(x, z, r, 0, Math.PI * 2);
    m.fill();
  }
  // the quays are stone
  for (const b of map.buildings) {
    if (b.kind !== 'quay') continue;
    g.save();
    g.translate(b.x, b.z);
    g.rotate(b.yaw);
    g.fillStyle = L.stone ?? '#CDB9A0';
    g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d);
    g.restore();
  }
}

/** The city: pavements round every block, tarmac streets with kerbs, crossings and dashed lines, two parks with paths. */
function paintCity(map, g, m) {
  const L = map.look;
  const block = 46;
  const street = 12;
  const land = (x, z) => map.coast(x, z).d > 4;
  // tarmac over everything on land, then the blocks' pavements on top
  for (let bx = -7; bx <= 7; bx++) {
    for (let bz = -7; bz <= 4; bz++) {
      const x0 = bx * block - block / 2 + street / 2;
      const z0 = bz * block - block / 2 + street / 2;
      const size = block - street;
      const mx = x0 + size / 2;
      const mz = z0 + size / 2;
      if (!land(mx, mz - size / 2) || map.coast(mx, mz).d < 10) continue;
      // the street round this block
      g.fillStyle = L.street;
      g.fillRect(x0 - street / 2, z0 - street / 2, size + street, size + street);
      m.fillStyle = 'rgb(0,0,255)';
      m.fillRect(x0 - street / 2, z0 - street / 2, size + street, size + street);
    }
  }
  for (let bx = -7; bx <= 7; bx++) {
    for (let bz = -7; bz <= 4; bz++) {
      const x0 = bx * block - block / 2 + street / 2;
      const z0 = bz * block - block / 2 + street / 2;
      const size = block - street;
      const mx = x0 + size / 2;
      const mz = z0 + size / 2;
      if (!land(mx, mz - size / 2) || map.coast(mx, mz).d < 10) continue;
      const park = map.parks.find((p) => Math.abs(p.x0 - x0) < 1 && Math.abs(p.z0 - z0) < 1);
      // kerb, then pavement
      g.fillStyle = '#C8BEB0';
      g.fillRect(x0 - 0.3, z0 - 0.3, size + 0.6, size + 0.6);
      g.fillStyle = L.stone;
      g.fillRect(x0, z0, size, size);
      m.fillStyle = 'rgb(255,0,0)';
      m.fillRect(x0, z0, size, size);
      if (park) {
        g.fillStyle = L.grass;
        g.fillRect(x0 + 2.5, z0 + 2.5, size - 5, size - 5);
        m.fillStyle = 'rgb(0,255,0)';
        m.fillRect(x0 + 2.5, z0 + 2.5, size - 5, size - 5);
        g.strokeStyle = '#CDBB98';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x0 + 2.5, z0 + 2.5);
        g.lineTo(x0 + size - 2.5, z0 + size - 2.5);
        g.moveTo(x0 + size - 2.5, z0 + 2.5);
        g.lineTo(x0 + 2.5, z0 + size - 2.5);
        g.stroke();
        g.beginPath();
        g.arc(mx, mz, 5, 0, Math.PI * 2);
        g.fillStyle = '#CDBB98';
        g.fill();
        g.fillStyle = '#5A7F95';
        g.beginPath();
        g.arc(mx, mz, 3, 0, Math.PI * 2);
        g.fill();
      }
      // crossings at the block's corners, and a dashed centre line on its south and east streets
      g.fillStyle = 'rgba(240,236,226,0.85)';
      for (let k = 0; k < 6; k++) {
        g.fillRect(x0 + 1 + k * 1.2, z0 + size + 1.2, 0.6, street - 2.4);
        g.fillRect(x0 + size + 1.2, z0 + 1 + k * 1.2, street - 2.4, 0.6);
      }
      g.fillStyle = 'rgba(232,200,90,0.7)';
      for (let x = x0 + 9; x < x0 + size; x += 4) g.fillRect(x, z0 + size + street / 2 - 0.12, 2, 0.24);
      for (let z = z0 + 9; z < z0 + size; z += 4) g.fillRect(x0 + size + street / 2 - 0.12, z, 0.24, 2);
    }
  }
}

const GROUND_DECL = /* glsl */ `
uniform sampler2D groundMask;
uniform vec2 uCloud;
uniform float uCloudAmt;
uniform float uTime;
varying vec3 vWPos;
varying vec3 vWNormal;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm3(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.28 + vnoise(p * 4.07 + 3.3) * 0.17; }
`;

const GROUND_DETAIL = /* glsl */ `
{
  vec2 wp = vWPos.xz;
  vec4 gm = texture2D(groundMask, vMapUv);
  float far = clamp(length(fwidth(wp)) * 2.0, 0.0, 1.0);
  vec3 c = diffuseColor.rgb;
  // broad variation everywhere
  c *= 0.93 + 0.14 * fbm3(wp * 0.045);
  // natural ground: clumps of grass and scrub, small dark tufts
  float clump = fbm3(wp * 0.42);
  float tuft = vnoise(wp * 2.6);
  c *= mix(1.0, (0.84 + 0.26 * clump) * mix(1.0, 0.86 + 0.24 * tuft, 1.0 - far), gm.g);
  // stubble or crop texture where it isn't grass (fields): fine streaks
  c *= mix(1.0, 0.94 + 0.1 * vnoise(wp * vec2(3.1, 0.7)), (1.0 - gm.g) * (1.0 - gm.r) * (1.0 - gm.b) * (1.0 - far));
  // paving: cobbles in rows, each a little different, darker joints
  if (gm.r > 0.02) {
    vec2 q = wp / vec2(0.62, 0.48);
    q.x += floor(q.y) * 0.5;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float stone = h21(id);
    float joint = smoothstep(0.5, 0.36, max(abs(f.x), abs(f.y)));
    vec3 pave = c * (0.86 + 0.24 * stone) * mix(0.68, 1.0, joint);
    c = mix(c, mix(pave, c * 0.97, far), gm.r);
  }
  // tarmac: fine grit and patches
  if (gm.b > 0.02) c *= mix(1.0, 0.9 + 0.12 * vnoise(wp * 4.0) * (1.0 - far) + 0.06 * fbm3(wp * 0.2), gm.b);
  // steep ground: strata
  float steep = 1.0 - smoothstep(0.55, 0.85, normalize(vWNormal).y);
  c *= 1.0 - steep * (0.12 * step(0.5, fract(vWPos.y * 0.6 + fbm3(wp * 0.15) * 1.5)) - 0.04);
  diffuseColor.rgb = c;
}
`;

const CLOUD_SHADOWS = /* glsl */ `
{
  float cl = fbm3(vWPos.xz / 95.0 + uCloud);
  reflectedLight.directDiffuse *= mix(1.0, 0.55, smoothstep(0.52, 0.7, cl) * uCloudAmt);
}
`;

/** The ground mesh: the height grid with its painted texture and detail shader. */
export function buildGround(map, U, quality) {
  const size = quality === 'high' ? 2048 : quality === 'medium' ? 2048 : 1024;
  const { color, mask } = paintGround(map, size);
  const colorTex = new THREE.CanvasTexture(color);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.flipY = false;
  colorTex.anisotropy = 4;
  colorTex.generateMipmaps = true;
  colorTex.minFilter = THREE.LinearMipmapLinearFilter;
  const maskTex = new THREE.CanvasTexture(mask);
  maskTex.flipY = false;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * N * 3);
  const uv = new Float32Array(N * N * 2);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      pos[k * 3] = -HALF + i * RES;
      pos[k * 3 + 1] = map.ground[k];
      pos[k * 3 + 2] = -HALF + j * RES;
      uv[k * 2] = i / (N - 1);
      uv[k * 2 + 1] = j / (N - 1);
    }
  }
  const index = new Uint32Array((N - 1) * (N - 1) * 6);
  let q = 0;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      index[q++] = a;
      index[q++] = c;
      index[q++] = b;
      index[q++] = b;
      index[q++] = c;
      index[q++] = d;
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: colorTex });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, { groundMask: { value: maskTex } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROUND_DECL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${GROUND_DETAIL}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${CLOUD_SHADOWS}`);
  };
  mat.customProgramCacheKey = () => 'ground-detail';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return { mesh, colorTex, maskTex, color };
}

/** Depth below the water line as a texture (R: 0 at the shore, 1 at 10 units down), for the sea's colour and surf. */
export function depthTexture(map) {
  const data = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) {
    const d = (map.water - map.ground[k]) / 10;
    data[k] = Math.round(255 * Math.min(1, Math.max(0, d)));
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export { groundAt };
