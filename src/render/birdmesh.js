// The birds' bodies: a songbird (body, head, beak, two-jointed wings, tail, optional crest and tail streamers) and a raptor
// for the hawk, as small static geometries that the vertex shader flaps, banks and folds. Every flock bird, perched bird and
// lead bird is one instance of these. Colours come by region (back, belly, head, accent, beak): from the flock's colour for
// flock birds, from the species for lead birds.

import * as THREE from 'three';

// parts
const BODY = 0;
const INNER = 1;
const OUTER = 2;
const TAIL = 3;
const BEAK = 4;
const CREST = 5;
const STREAMER = 6;
// regions
const R_BACK = 0;
const R_BELLY = 1;
const R_HEAD = 2;
const R_ACCENT = 3;
const R_BEAK = 4;

export const SHOULDER = 0.06;
export const WRIST = 0.3;
export const TIP = 0.66;

class Geo {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.part = [];
    this.region = [];
    this.side = [];
  }
  v(p, n, part, region, side) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.part.push(part);
    this.region.push(region);
    this.side.push(side);
  }
  tri(a, b, c, part, ra, rb, rc, side = 0, flatN = null) {
    let n = flatN;
    if (!n) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
    }
    this.v(a, a.n ?? n, part, ra, side);
    this.v(b, b.n ?? n, part, rb, side);
    this.v(c, c.n ?? n, part, rc, side);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    const meta = [];
    for (let i = 0; i < this.part.length; i++) meta.push(this.part[i], this.region[i], this.side[i]);
    g.setAttribute('meta', new THREE.Float32BufferAttribute(meta, 3));
    return g;
  }
}

/** A lofted body: rings [x, y, ry, rz, regionTop, regionBottom], seg vertices round. Smooth normals. */
function loft(G, rings, seg, part) {
  const ringPts = rings.map(([x, y, ry, rz]) => {
    const pts = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const cy = Math.cos(a);
      const sz = Math.sin(a);
      const p = [x, y + cy * ry, sz * rz];
      const nl = Math.hypot(cy / Math.max(ry, 1e-3), sz / Math.max(rz, 1e-3)) || 1;
      p.n = [0, cy / Math.max(ry, 1e-3) / nl, sz / Math.max(rz, 1e-3) / nl];
      p.top = cy;
      pts.push(p);
    }
    return pts;
  });
  for (let r = 0; r < rings.length - 1; r++) {
    const A = ringPts[r];
    const B = ringPts[r + 1];
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      const reg = (p, ring) => (p.top > -0.25 ? ring[4] : ring[5]);
      G.tri(A[k], B[k], B[k2], part, reg(A[k], rings[r]), reg(B[k], rings[r + 1]), reg(B[k2], rings[r + 1]));
      G.tri(A[k], B[k2], A[k2], part, reg(A[k], rings[r]), reg(B[k2], rings[r + 1]), reg(A[k2], rings[r]));
    }
  }
}

/** The songbird every flock bird and lead bird is made from. `lod`: 'high' or 'low'. */
export function songbirdGeometry(lod = 'high') {
  const G = new Geo();
  const seg = lod === 'low' ? 4 : 6;
  // body, head first; regions: top, bottom
  loft(
    G,
    [
      [0.335, 0.03, 0.035, 0.032, R_HEAD, R_HEAD],
      [0.3, 0.045, 0.062, 0.056, R_HEAD, R_HEAD],
      [0.22, 0.045, 0.07, 0.066, R_HEAD, R_BELLY],
      [0.12, 0.012, 0.085, 0.082, R_BACK, R_BELLY],
      [0.0, 0.0, 0.094, 0.09, R_BACK, R_BELLY],
      [-0.13, 0.004, 0.072, 0.07, R_BACK, R_BELLY],
      [-0.25, 0.012, 0.03, 0.04, R_ACCENT, R_BELLY],
    ],
    seg,
    BODY,
  );
  // beak: a little cone from the face
  {
    const base = [0.325, 0.022, 0, 0.02];
    const tip = [0.44, 0.012, 0];
    const bs = lod === 'low' ? 3 : 4;
    for (let k = 0; k < bs; k++) {
      const a0 = (k / bs) * Math.PI * 2;
      const a1 = ((k + 1) / bs) * Math.PI * 2;
      const p0 = [base[0], base[1] + Math.cos(a0) * base[3], Math.sin(a0) * base[3]];
      const p1 = [base[0], base[1] + Math.cos(a1) * base[3], Math.sin(a1) * base[3]];
      G.tri(p0, [tip[0], tip[1], tip[2]], p1, BEAK, R_BEAK, R_BEAK, R_BEAK);
    }
  }
  // tail: a forked fan
  {
    const bl = [-0.24, 0.016, -0.03];
    const br = [-0.24, 0.016, 0.03];
    const tl = [-0.5, 0.008, -0.1];
    const tr = [-0.5, 0.008, 0.1];
    const notch = [-0.43, 0.01, 0];
    const up = [0, 1, 0];
    G.tri(bl, br, notch, TAIL, R_ACCENT, R_ACCENT, R_ACCENT, 0, up);
    G.tri(bl, notch, tl, TAIL, R_ACCENT, R_ACCENT, R_ACCENT, 0, up);
    G.tri(br, tr, notch, TAIL, R_ACCENT, R_ACCENT, R_ACCENT, 0, up);
    // streamers: two long outer feathers (scaled to nothing unless the species has them)
    for (const s of [-1, 1]) {
      const a = [-0.47, 0.008, 0.085 * s];
      const b = [-0.47, 0.008, 0.06 * s];
      const c = [-1.05, 0.0, 0.13 * s];
      G.tri(a, b, c, STREAMER, R_ACCENT, R_ACCENT, R_ACCENT, 0, up);
    }
  }
  // crest: a fan on the crown (hidden in the head unless the species has one)
  {
    const side = [1, 0, 0];
    G.tri([0.31, 0.09, 0], [0.18, 0.1, 0], [0.2, 0.2, 0], CREST, R_ACCENT, R_ACCENT, R_ACCENT, 0, side);
    G.tri([0.3, 0.09, 0], [0.24, 0.24, 0], [0.2, 0.2, 0], CREST, R_ACCENT, R_ACCENT, R_ACCENT, 0, side);
  }
  // wings: inner (shoulder to wrist) and outer (wrist to tip), flat, pointed like a starling's
  for (const s of [-1, 1]) {
    const up = [0, 1, 0];
    const sf = [0.1, 0.03, SHOULDER * s];
    const sb = [-0.14, 0.02, SHOULDER * s];
    const wf = [0.075, 0.03, WRIST * s];
    const wb = [-0.12, 0.02, WRIST * s];
    G.tri(sf, wf, sb, INNER, R_BACK, R_BACK, R_BACK, s, up);
    G.tri(sb, wf, wb, INNER, R_BACK, R_BACK, R_BACK, s, up);
    const mid = [-0.17, 0.02, 0.47 * s];
    const tip = [-0.12, 0.02, TIP * s];
    const lead = [0.02, 0.025, 0.5 * s];
    G.tri(wf, lead, wb, OUTER, R_BACK, R_ACCENT, R_BACK, s, up);
    G.tri(wb, lead, mid, OUTER, R_BACK, R_ACCENT, R_ACCENT, s, up);
    G.tri(mid, lead, tip, OUTER, R_ACCENT, R_ACCENT, R_ACCENT, s, up);
  }
  return G.build();
}

/** The hawk: a heavy body, broad wings with fingered primaries, a fanned tail and a hooked beak. */
export function raptorGeometry() {
  const G = new Geo();
  loft(
    G,
    [
      [0.33, 0.03, 0.04, 0.036, R_HEAD, R_HEAD],
      [0.28, 0.05, 0.075, 0.07, R_HEAD, R_HEAD],
      [0.18, 0.04, 0.09, 0.085, R_HEAD, R_BELLY],
      [0.05, 0.0, 0.12, 0.115, R_BACK, R_BELLY],
      [-0.1, 0.0, 0.11, 0.105, R_BACK, R_BELLY],
      [-0.24, 0.01, 0.05, 0.06, R_ACCENT, R_BELLY],
    ],
    6,
    BODY,
  );
  // hooked beak
  G.tri([0.33, 0.045, -0.025], [0.42, 0.02, 0], [0.33, 0.045, 0.025], BEAK, R_BEAK, R_BEAK, R_BEAK);
  G.tri([0.33, 0.045, 0.025], [0.42, 0.02, 0], [0.36, 0.0, 0], BEAK, R_BEAK, R_BEAK, R_BEAK);
  G.tri([0.36, 0.0, 0], [0.42, 0.02, 0], [0.33, 0.045, -0.025], BEAK, R_BEAK, R_BEAK, R_BEAK);
  // fanned tail
  const up = [0, 1, 0];
  const fan = [];
  for (let k = 0; k <= 6; k++) {
    const a = -0.5 + (k / 6);
    fan.push([-0.24 - Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.26]);
  }
  for (let k = 0; k < 6; k++) G.tri([-0.22, 0.015, 0], fan[k + 1], fan[k], TAIL, R_ACCENT, R_ACCENT, R_ACCENT, 0, up);
  // broad wings with five fingers at the tip
  for (const s of [-1, 1]) {
    const sf = [0.12, 0.035, SHOULDER * s];
    const sb = [-0.18, 0.02, SHOULDER * s];
    const wf = [0.1, 0.035, WRIST * s];
    const wb = [-0.2, 0.02, WRIST * s];
    G.tri(sf, wf, sb, INNER, R_BACK, R_BACK, R_BACK, s, up);
    G.tri(sb, wf, wb, INNER, R_BACK, R_BACK, R_BACK, s, up);
    // the hand: a broad plate, then fingers
    const hf = [0.06, 0.03, 0.5 * s];
    const hb = [-0.17, 0.02, 0.5 * s];
    G.tri(wf, hf, wb, OUTER, R_BACK, R_BACK, R_BACK, s, up);
    G.tri(wb, hf, hb, OUTER, R_BACK, R_ACCENT, R_ACCENT, s, up);
    for (let f = 0; f < 5; f++) {
      const u = f / 4;
      const bx = 0.06 + (-0.17 - 0.06) * u;
      const bx2 = 0.06 + (-0.17 - 0.06) * Math.min(1, u + 0.2);
      const len = 0.17 - Math.abs(u - 0.3) * 0.08;
      const tipx = bx - 0.04 - u * 0.06;
      G.tri([bx, 0.03, 0.5 * s], [tipx, 0.025, (0.5 + len) * s], [bx2, 0.025, 0.5 * s], OUTER, R_ACCENT, R_ACCENT, R_ACCENT, s, up);
    }
  }
  return G.build();
}

// ------------------------------------------------------------------ the shader

const vert = /* glsl */ `
attribute vec3 meta; // part, region, side
attribute vec3 iPos;
attribute vec3 iFwd;
attribute vec3 iColor;
attribute vec4 iAnim;   // phase, flap rate (< 0: perched, 0: wings held), scale, bank
attribute vec4 iFx;     // flash, flair, glide bias, hawk fold (0..1)
#ifdef LEAD
attribute vec3 iBack;
attribute vec3 iBelly;
attribute vec3 iHead;
attribute vec3 iAccent;
attribute vec3 iBeak;
attribute vec4 iShape;  // beak, crest, tail, streamers
#endif
uniform float time;
uniform vec3 ink;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFlash;
varying float vFlair;
varying float vRegion;
#ifndef DEPTH
#include <fog_pars_vertex>
#endif

vec2 rot(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }

void main() {
  float part = meta.x;
  float region = meta.y;
  float side = meta.z;
  vec3 p = position;
  vec3 n = normal;
  float perched = step(iAnim.y, -0.5);
  float held = step(abs(iAnim.y), 0.001);
  float t = time * abs(iAnim.y) + iAnim.x;
  // glides come and go in waves through a flock
  float glide = clamp(smoothstep(0.5, 0.92, sin(time * 0.41 + iAnim.x * 2.3)) + iFx.z, 0.0, 1.0);
  glide = max(glide, held);
  float fold = iFx.w;
  #ifdef LEAD
  if (part == 4.0) p.x = 0.325 + (p.x - 0.325) * iShape.x;
  if (part == 5.0) p.y = mix(0.03, p.y, iShape.y);
  if (part == 3.0) p.x = -0.24 + (p.x + 0.24) * iShape.z;
  if (part == 6.0) { p.x = -0.47 + (p.x + 0.47) * iShape.w * iShape.z; p.z *= mix(0.6, 1.0, iShape.w); }
  #else
  if (part == 5.0) p = vec3(0.25, 0.03, 0.0);
  if (part == 6.0) p = vec3(-0.47, 0.008, 0.07 * sign(p.z));
  #endif
  if (part == 1.0 || part == 2.0) {
    float zs = abs(p.z);
    float s = sin(t);
    // the stroke: the shoulder sweeps, the wrist lags behind it and bends further on the upstroke
    float a1 = mix(0.95 * s + 0.1, 0.07 + 0.03 * sin(time * 1.3 + iAnim.x), glide);
    float a2 = mix(0.6 * sin(t - 0.9) + 0.12, 0.05, glide);
    // a hawk stooping folds its wings back against its body
    a1 = mix(a1, 0.18, fold);
    a2 = mix(a2, -0.35, fold);
    vec2 q = vec2(zs - ${SHOULDER.toFixed(3)}, p.y);
    float na = a1;
    if (part == 2.0) {
      vec2 w = rot(vec2(zs - ${WRIST.toFixed(3)}, p.y), a2);
      q = vec2(${(WRIST - SHOULDER).toFixed(3)} + w.x, w.y);
      na += a2;
      // the hand sweeps back on the upstroke, and folds far back in a stoop
      float k = (zs - ${WRIST.toFixed(3)}) / ${(TIP - WRIST).toFixed(3)};
      p.x -= (max(0.0, -cos(t)) * 0.1 * (1.0 - glide) + fold * 0.45) * k;
    }
    q = rot(q, a1);
    p.z = side * (${SHOULDER.toFixed(3)} + q.x * (1.0 - fold * 0.45));
    p.y = q.y;
    n = vec3(0.0, cos(na), -side * sin(na));
    // perched: wings folded along the back
    if (perched > 0.5) {
      float u = clamp((zs - ${SHOULDER.toFixed(3)}) / ${(TIP - SHOULDER).toFixed(3)}, 0.0, 1.0);
      p = vec3(position.x - 0.36 * u, 0.06 + 0.02 * u, side * (0.06 + 0.025 * u));
      n = vec3(0.0, 1.0, 0.0);
    }
  }
  // the body rides each wingbeat; a perched bird bobs and looks about
  p.y -= 0.035 * sin(t) * (1.0 - glide) * (1.0 - perched);
  if (perched > 0.5) {
    float look = sin(time * 0.7 + iAnim.x * 7.0) * 0.5 * step(0.15, position.x);
    p.z += look * (position.x - 0.15) * 0.6;
    p.y += 0.012 * sin(time * 2.1 + iAnim.x * 5.0);
  }
  if (part == 3.0 || part == 6.0) p.y += 0.03 * sin(t + 1.2) * (1.0 - glide);
  float sc = iAnim.z;
  p *= sc;
  // the frame: forward, and the bank rolled in
  vec3 f = normalize(iFwd + vec3(1e-5, 0.0, 0.0));
  vec3 r = cross(f, vec3(0.0, 1.0, 0.0));
  float rl = length(r);
  r = rl < 1e-3 ? vec3(0.0, 0.0, 1.0) : r / rl;
  vec3 u = cross(r, f);
  float cb = cos(iAnim.w);
  float sb = sin(iAnim.w);
  vec3 r2 = r * cb + u * sb;
  vec3 u2 = u * cb - r * sb;
  vec3 world = iPos + f * p.x + u2 * p.y + r2 * p.z;
  vNormal = normalize(f * n.x + u2 * n.y + r2 * n.z);
  vWorld = world;
  // colour by region
  #ifdef LEAD
  vec3 back = iBack; vec3 belly = iBelly; vec3 head = iHead; vec3 accent = iAccent; vec3 beak = iBeak;
  #else
  vec3 back = iColor;
  vec3 belly = mix(ink, iColor, 0.38);
  vec3 head = iColor * 0.8;
  vec3 accent = mix(iColor, ink, 0.5);
  vec3 beak = vec3(0.92, 0.7, 0.26);
  if (iFx.y > 4.5 && iFx.y < 5.5) accent = vec3(1.0, 0.78, 0.3);
  #endif
  vec3 c = back;
  if (region > 0.5 && region < 1.5) c = belly;
  else if (region > 1.5 && region < 2.5) c = head;
  else if (region > 2.5 && region < 3.5) c = accent;
  else if (region > 3.5) c = beak;
  vColor = c;
  vRegion = region;
  vFlash = iFx.x;
  vFlair = iFx.y;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #ifndef DEPTH
  #include <fog_vertex>
  #endif
}`;

const frag = /* glsl */ `
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 hemiSky;
uniform vec3 hemiGround;
uniform float glow;
uniform float time;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFlash;
varying float vFlair;
varying float vRegion;
#include <fog_pars_fragment>
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  if (dot(n, v) < 0.0) n = -n;
  vec3 base = vColor;
  // flair: 1 shimmer (a starling's oil-slick sheen), 2 dusk glow, 3 stardust, 4 night lights, 5 gilded tips, 6 ember
  float flair = vFlair;
  float sheen = pow(1.0 - abs(dot(n, v)), 1.5);
  if (flair > 0.5 && flair < 1.5) base = mix(base, hue(fract(sheen * 1.3 + vWorld.x * 0.02 + time * 0.05)) * 0.9, 0.35 * sheen + 0.12);
  // light: a wrapped sun, the sky above and the warm ground below, and the sunset catching the edges
  float ndl = dot(n, sunDir);
  float wrap = max(0.0, (ndl + 0.35) / 1.35);
  vec3 amb = mix(hemiGround, hemiSky, n.y * 0.5 + 0.5);
  vec3 col = base * (amb * 0.8 + sunColor * wrap * 0.9);
  float rim = pow(1.0 - abs(dot(n, v)), 3.0) * (0.35 + 0.65 * max(0.0, dot(-v, sunDir)));
  col += sunColor * rim * 0.55;
  // flock colours stay strong at dusk
  col += vColor * (0.12 + glow * 0.22);
  if (flair > 1.5 && flair < 2.5) col += vColor * glow * 0.9 + vColor * 0.15;
  if (flair > 2.5 && flair < 3.5) col += vec3(1.0, 0.95, 0.85) * step(0.985, fract(sin(dot(floor(vWorld * 3.0), vec3(12.9, 78.2, 37.7))) * 43758.5)) * (0.6 + 0.4 * sin(time * 9.0 + vWorld.x));
  if (flair > 3.5 && flair < 4.5) col += vec3(1.0, 0.85, 0.4) * (0.25 + glow * 0.8) * step(2.5, vRegion) * step(vRegion, 3.5);
  if (flair > 5.5 && flair < 6.5) col += vec3(1.0, 0.45, 0.15) * (0.2 + 0.25 * sin(time * 6.0 + vWorld.z)) * sheen;
  col = mix(col, vec3(1.0, 0.98, 0.92), clamp(vFlash, 0.0, 1.0) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const depthFrag = /* glsl */ `
#include <packing>
void main() { gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`;

/** Shared uniforms for every bird material (light, time, fog). */
export function birdUniforms() {
  return {
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color() },
    hemiSky: { value: new THREE.Color() },
    hemiGround: { value: new THREE.Color() },
    ink: { value: new THREE.Color('#231A2E') },
    glow: { value: 0 },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  };
}

/** The bird material and its shadow-depth twin. */
export function birdMaterials(uniforms, { lead = false } = {}) {
  const defines = lead ? { LEAD: '' } : {};
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, fog: true, side: THREE.DoubleSide, defines });
  const depth = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: depthFrag, side: THREE.DoubleSide, defines: { ...defines, DEPTH: '' } });
  return { mat, depth };
}

/** An instanced layer of birds: attributes to fill, a mesh to add. */
export function birdLayer(geometry, uniforms, count, { lead = false, shadows = true } = {}) {
  const g = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'normal', 'meta']) g.setAttribute(k, geometry.getAttribute(k));
  const mk = (n) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * n), n);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  const L = { g, count, pos: mk(3), fwd: mk(3), color: mk(3), anim: mk(4), fx: mk(4) };
  g.setAttribute('iPos', L.pos);
  g.setAttribute('iFwd', L.fwd);
  g.setAttribute('iColor', L.color);
  g.setAttribute('iAnim', L.anim);
  g.setAttribute('iFx', L.fx);
  if (lead) {
    for (const k of ['back', 'belly', 'head', 'accent', 'beak']) {
      L[k] = mk(3);
      g.setAttribute(`i${k[0].toUpperCase()}${k.slice(1)}`, L[k]);
    }
    L.shape = mk(4);
    g.setAttribute('iShape', L.shape);
  }
  g.instanceCount = 0;
  const { mat, depth } = birdMaterials(uniforms, { lead });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = shadows;
  mesh.customDepthMaterial = depth;
  L.mesh = mesh;
  L.attrs = lead ? [L.pos, L.fwd, L.color, L.anim, L.fx, L.back, L.belly, L.head, L.accent, L.beak, L.shape] : [L.pos, L.fwd, L.color, L.anim, L.fx];
  return L;
}
