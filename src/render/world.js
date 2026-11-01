// A place, built into a handful of merged meshes: ground, sea, buildings, windows, trees, poles and wires, props, thermals.

import * as THREE from 'three';
import { HALF, RES, N } from '../sim/maps.js';

const col = new THREE.Color();

/** Collects flat-shaded triangles with vertex colours into one geometry. */
class Builder {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
  }
  color(hex, k = 1) {
    col.set(hex);
    this.r = col.r * k;
    this.g = col.g * k;
    this.b = col.b * k;
    return this;
  }
  tri(a, b, c) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx, ny, nz);
      this.c.push(this.r, this.g, this.b);
    }
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  /** A box w × h × d with its base centre at (x, y, z), turned by yaw. */
  box(x, y, z, w, h, d, yaw = 0, top = true) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (u, v, yy) => [x + c * u - s * v, y + yy, z + s * u + c * v];
    const hw = w / 2;
    const hd = d / 2;
    const b0 = P(-hw, -hd, 0);
    const b1 = P(hw, -hd, 0);
    const b2 = P(hw, hd, 0);
    const b3 = P(-hw, hd, 0);
    const t0 = P(-hw, -hd, h);
    const t1 = P(hw, -hd, h);
    const t2 = P(hw, hd, h);
    const t3 = P(-hw, hd, h);
    this.quad(b0, t0, t1, b1);
    this.quad(b1, t1, t2, b2);
    this.quad(b2, t2, t3, b3);
    this.quad(b3, t3, t0, b0);
    if (top) this.quad(t0, t3, t2, t1);
  }
  /** A gable roof over a w × d footprint, ridge along the longer side. */
  gable(x, y, z, w, d, h, yaw, overhang = 0.5) {
    const along = w >= d;
    const L = (along ? w : d) / 2 + overhang;
    const S = (along ? d : w) / 2 + overhang;
    const a = yaw + (along ? 0 : Math.PI / 2);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (u, v, yy) => [x + c * u - s * v, y + yy, z + s * u + c * v];
    const e0 = P(-L, -S, 0);
    const e1 = P(L, -S, 0);
    const e2 = P(L, S, 0);
    const e3 = P(-L, S, 0);
    const r0 = P(-L, 0, h);
    const r1 = P(L, 0, h);
    this.quad(e0, r0, r1, e1);
    this.quad(e2, r1, r0, e3);
    const k = this.r;
    const g = this.g;
    const bb = this.b;
    this.r *= 0.85;
    this.g *= 0.85;
    this.b *= 0.85;
    this.tri(e0, e3, r0);
    this.tri(e1, r1, e2);
    this.r = k;
    this.g = g;
    this.b = bb;
  }
  pyramid(x, y, z, w, d, h, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (u, v, yy) => [x + c * u - s * v, y + yy, z + s * u + c * v];
    const a = P(-w / 2 - 0.3, -d / 2 - 0.3, 0);
    const b = P(w / 2 + 0.3, -d / 2 - 0.3, 0);
    const cc = P(w / 2 + 0.3, d / 2 + 0.3, 0);
    const dd = P(-w / 2 - 0.3, d / 2 + 0.3, 0);
    const t = [x, y + h, z];
    this.tri(a, t, b);
    this.tri(b, t, cc);
    this.tri(cc, t, dd);
    this.tri(dd, t, a);
  }
  /** A cylinder (or a cone with r1 = 0) on its base centre. */
  cyl(x, y, z, r0, r1, h, seg = 8, cap = true) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2;
      const a1 = ((k + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0];
      const p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0];
      const q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1];
      const q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
      if (r1 > 0.001) this.quad(p0, q0, q1, p1);
      else this.tri(p0, q0, p1);
      if (cap && r1 > 0.001) this.tri([x, y + h, z], q1, q0);
    }
  }
  /** A low-poly blob (an icosahedron), squashed by sy. */
  blob(x, y, z, r, sy = 1, wobble = 0) {
    const g = BLOB;
    for (let i = 0; i < g.length; i += 9) {
      const v = [];
      for (let k = 0; k < 3; k++) {
        const vx = g[i + k * 3];
        const vy = g[i + k * 3 + 1];
        const vz = g[i + k * 3 + 2];
        const j = 1 + wobble * Math.sin(vx * 7.1 + vy * 3.3 + vz * 5.7 + x);
        v.push([x + vx * r * j, y + vy * r * sy * j, z + vz * r * j]);
      }
      this.tri(v[0], v[1], v[2]);
    }
  }
  /** A thin tube along points (triangular section). */
  tube(points, radius) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const l = Math.hypot(dx, dy, dz) || 1;
      // a frame round the segment
      let ux = -dz / l;
      let uz = dx / l;
      const ul = Math.hypot(ux, uz) || 1;
      ux /= ul;
      uz /= ul;
      const ring = (p) => [0, 1, 2].map((k) => {
        const ang = (k / 3) * Math.PI * 2;
        const cy = Math.cos(ang) * radius;
        const sy = Math.sin(ang) * radius;
        return [p[0] + ux * cy, p[1] + sy, p[2] + uz * cy];
      });
      const ra = ring(a);
      const rb = ring(b);
      for (let k = 0; k < 3; k++) this.quad(ra[k], rb[k], rb[(k + 1) % 3], ra[(k + 1) % 3]);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const BLOB = (() => {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  return Array.from(g.attributes.position.array);
})();

// ------------------------------------------------------------------ the sea

const seaVert = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const seaFrag = /* glsl */ `
uniform vec3 deep;
uniform vec3 sky;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float time;
varying vec3 vWorld;
#include <fog_pars_fragment>
float wave(vec2 p) {
  return sin(p.x * 0.21 + time * 0.9) * 0.5 + sin(p.y * 0.17 - time * 0.7) * 0.5 + sin((p.x + p.y) * 0.53 + time * 1.7) * 0.25 + sin((p.x - p.y) * 1.13 - time * 2.3) * 0.12;
}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.6;
  vec3 n = normalize(vec3(-(wave(p + vec2(e, 0.0)) - wave(p - vec2(e, 0.0))) * 0.35, 1.0, -(wave(p + vec2(0.0, e)) - wave(p - vec2(0.0, e))) * 0.35));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(deep, sky, 0.25 + 0.65 * fres);
  vec3 r = reflect(-v, n);
  float g = pow(max(dot(r, sunDir), 0.0), 220.0);
  float glint = pow(max(dot(r, sunDir), 0.0), 18.0);
  col += sunColor * (g * 3.5 + glint * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ------------------------------------------------------------------ thermals

const thermVert = /* glsl */ `
attribute float hgt;
attribute vec2 rim;
varying float vH;
varying vec3 vWorld;
varying vec2 vRim;
#include <fog_pars_vertex>
void main() {
  vH = hgt;
  vRim = rim;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const thermFrag = /* glsl */ `
uniform float time;
uniform vec3 tint;
uniform float strength;
varying float vH;
varying vec3 vWorld;
varying vec2 vRim;
#include <fog_pars_fragment>
void main() {
  float a = atan(vWorld.z, vWorld.x);
  // fade toward the column's silhouette, so it never shows a hard edge
  vec3 toCam = cameraPosition - vWorld;
  float facing = abs(dot(normalize(toCam.xz), normalize(vRim)));
  float bands = 0.5 + 0.5 * sin(vH * 40.0 - time * 3.0 + sin(a * 5.0 + time) * 1.5);
  float fade = smoothstep(0.0, 0.08, vH) * (1.0 - smoothstep(0.55, 1.0, vH));
  float alpha = bands * fade * 0.06 * strength * smoothstep(0.0, 0.6, facing);
  #ifdef USE_FOG
  alpha *= smoothstep(18.0, 50.0, vFogDepth) * (1.0 - smoothstep(60.0, 170.0, vFogDepth));
  #endif
  gl_FragColor = vec4(tint, alpha);
  #include <fog_fragment>
}`;

/** Build a place. Returns { group, update(light, time), glow(k) }. */
export function buildWorld(map, quality = 'medium') {
  const group = new THREE.Group();
  const look = map.look;

  // ground
  {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * N * 3);
    const colors = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        pos[k * 3] = -HALF + i * RES;
        pos[k * 3 + 1] = map.ground[k];
        pos[k * 3 + 2] = -HALF + j * RES;
        col.setRGB(map.tint[k * 3] / 255, map.tint[k * 3 + 1] / 255, map.tint[k * 3 + 2] / 255, THREE.SRGBColorSpace);
        colors[k * 3] = col.r;
        colors[k * 3 + 1] = col.g;
        colors[k * 3 + 2] = col.b;
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
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    group.add(m);
    // a skirt of land beyond the grid, so the edge never shows
    const skirt = new THREE.Mesh(
      new THREE.RingGeometry(HALF * 1.3, 1300, 48, 1).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: map.hasSea ? look.sea : look.grass ?? look.sand }),
    );
    skirt.position.y = map.hasSea ? map.water - 0.05 : -2;
    group.add(skirt);
  }

  // sea (or a river)
  let seaUniforms = null;
  if (map.hasSea) {
    seaUniforms = {
      deep: { value: new THREE.Color(look.sea) },
      sky: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
      time: { value: 0 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600, 1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: seaUniforms, vertexShader: seaVert, fragmentShader: seaFrag, fog: true }),
    );
    sea.position.y = map.water;
    group.add(sea);
  }

  // buildings
  const B = new Builder();
  for (const b of map.buildings) {
    const wall = look.walls[b.wall % look.walls.length];
    const roof = b.barn && look.barn ? look.barn : look.roofs[b.roofColor % look.roofs.length];
    B.color(b.barn && look.barn ? look.barn : wall);
    B.box(b.x, b.y, b.z, b.w, b.h, b.d, b.yaw, b.roof === 'flat');
    if (b.roof === 'gable') {
      B.color(roof);
      B.gable(b.x, b.y + b.h, b.z, b.w, b.d, b.roofH, b.yaw);
    } else if (b.roof === 'pyramid') {
      B.color(roof);
      B.pyramid(b.x, b.y + b.h, b.z, b.w, b.d, b.roofH, b.yaw);
    } else {
      B.color(roof, 0.9);
      B.box(b.x, b.y + b.h, b.z, b.w + 0.2, 0.4, b.d + 0.2, b.yaw);
    }
    if (b.chimney || (b.kind === 'house' && b.roof === 'gable' && (b.x * 7 + b.z * 3) % 3 < 1.2)) {
      B.color('#8C5A44');
      const c = Math.cos(b.yaw);
      const s = Math.sin(b.yaw);
      B.box(b.x + c * b.w * 0.25, b.y + b.h, b.z + s * b.w * 0.25, 0.9, b.roofH + 1.2, 0.9, b.yaw);
    }
  }
  // props
  for (const p of map.props) prop(B, p, map);
  const bMesh = new THREE.Mesh(B.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  bMesh.castShadow = quality !== 'low';
  bMesh.receiveShadow = true;
  group.add(bMesh);

  // windows: dark glass by day, warm lamps at dusk
  let windowMat = null;
  if (map.lamps.length) {
    const W = new Builder().color('#3A3448');
    for (const [x, y, z, yaw, w, h] of map.lamps) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      // the quad faces along (sin yaw, cos yaw) turned: its normal is the wall's outward side
      const nx = -s;
      const nz = c;
      const ox = x + nx * 0.06;
      const oz = z + nz * 0.06;
      const P = (u, v) => [ox + c * u, y + v, oz + s * u];
      W.quad(P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), P(-w / 2, h));
      W.quad(P(-w / 2, h), P(w / 2, h), P(w / 2, 0), P(-w / 2, 0));
    }
    windowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#FFB050'), emissiveIntensity: 0 });
    group.add(new THREE.Mesh(W.build(), windowMat));
  }

  // trees
  const T = new Builder();
  for (const t of map.trees) {
    T.color('#6B4A34');
    T.box(t.x, t.y, t.z, 0.45, t.h * 0.45, 0.45, 0, false);
    const shadeK = 0.85 + ((t.x * 13.1 + t.z * 7.7) % 1 + 1) % 1 * 0.3;
    if (t.kind === 'cypress') {
      T.color('#3E5A2C', shadeK);
      T.cyl(t.x, t.y + t.h * 0.15, t.z, t.r, 0, t.h * 0.9, 6, false);
    } else if (t.kind === 'juniper') {
      T.color('#7A8550', shadeK);
      T.blob(t.x, t.y + t.h * 0.45, t.z, t.r, 0.8, 0.15);
    } else {
      T.color(map.id === 'redrock' ? '#7E8A4E' : '#5F7D3A', shadeK);
      T.blob(t.x, t.y + t.h * 0.62, t.z, t.r, 0.9, 0.12);
    }
  }
  const tMesh = new THREE.Mesh(T.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  tMesh.castShadow = quality !== 'low';
  tMesh.receiveShadow = true;
  group.add(tMesh);

  // poles and wires
  const Wr = new Builder();
  Wr.color('#5A4636');
  for (const p of map.poles) {
    Wr.box(p.x, p.y, p.z, 0.26, p.h + 0.3, 0.26);
    Wr.box(p.x, p.y + p.h - 0.4, p.z, 1.8, 0.16, 0.16);
  }
  Wr.color('#2B2330');
  for (const w of map.wires) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const s = k / 12;
      pts.push([w.ax + (w.bx - w.ax) * s, w.ay + (w.by - w.ay) * s - w.sag * 4 * s * (1 - s), w.az + (w.bz - w.az) * s]);
    }
    Wr.tube(pts, 0.05);
  }
  const wMesh = new THREE.Mesh(Wr.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(wMesh);

  // windmill sails turn
  const sails = [];
  for (const p of map.props) {
    if (p.kind !== 'windmill') continue;
    const S = new Builder().color('#F2E6D0');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const P = (u, v) => [0, c * u - s * v, s * u + c * v];
      S.quad(P(0.8, -0.7), P(8, -1.2), P(8, 1.2), P(0.8, 0.7));
      S.quad(P(0.8, 0.7), P(8, 1.2), P(8, -1.2), P(0.8, -0.7));
    }
    const m = new THREE.Mesh(S.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set(p.x + Math.cos(p.yaw) * 2.6, p.y + 15.5, p.z + Math.sin(p.yaw) * 2.6);
    m.rotation.y = -p.yaw;
    m.castShadow = quality !== 'low';
    group.add(m);
    sails.push(m);
  }

  // thermals
  const thermUniforms = { time: { value: 0 }, tint: { value: new THREE.Color('#FFF4DC') }, strength: { value: 1 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
  {
    const pos = [];
    const hgt = [];
    const rim = [];
    for (const th of map.thermals) {
      const base = Math.max(0, map.ground[Math.round((th.z + HALF) / RES) * N + Math.round((th.x + HALF) / RES)] ?? 0);
      const seg = 14;
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < seg; k++) {
          const a0 = (k / seg) * Math.PI * 2;
          const a1 = ((k + 1) / seg) * Math.PI * 2;
          const h0 = r / rows;
          const h1 = (r + 1) / rows;
          const rad = (h) => th.r * (0.8 + 0.35 * h);
          const P = (a, h) => [th.x + Math.cos(a) * rad(h), base + h * th.top, th.z + Math.sin(a) * rad(h)];
          const v = [P(a0, h0), P(a1, h0), P(a1, h1), P(a0, h0), P(a1, h1), P(a0, h1)];
          const hs = [h0, h0, h1, h0, h1, h1];
          const as = [a0, a1, a1, a0, a1, a0];
          v.forEach((p, i) => {
            pos.push(...p);
            hgt.push(hs[i]);
            rim.push(Math.cos(as[i]), Math.sin(as[i]));
          });
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('hgt', new THREE.Float32BufferAttribute(hgt, 1));
    g.setAttribute('rim', new THREE.Float32BufferAttribute(rim, 2));
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        uniforms: thermUniforms,
        vertexShader: thermVert,
        fragmentShader: thermFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
    );
    m.renderOrder = 5;
    group.add(m);
  }

  return {
    group,
    map,
    update(light, time, dt) {
      if (seaUniforms) {
        seaUniforms.sky.value.copy(light.horizon).lerp(light.zenith, 0.35);
        seaUniforms.sunColor.value.copy(light.sun).multiplyScalar(Math.max(0.2, light.sunI / 2));
        seaUniforms.sunDir.value.copy(light.sunDir);
        seaUniforms.time.value = time;
      }
      thermUniforms.time.value = time;
      thermUniforms.tint.value.copy(light.sun).lerp(new THREE.Color('#FFFFFF'), 0.4);
      thermUniforms.strength.value = Math.max(0, 1 - light.glow * 0.4);
      if (windowMat) windowMat.emissiveIntensity = light.glow * 2.2;
      for (const s of sails) s.rotation.x += dt * 0.6;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}

function prop(B, p, map) {
  const s = p.s ?? 1;
  switch (p.kind) {
    case 'boat': {
      const colors = ['#2D6C8A', '#C0563A', '#F2E6D0', '#3F7A5A', '#E0A840'];
      const c = Math.cos(p.yaw);
      const sn = Math.sin(p.yaw);
      const y = map.water - 0.3;
      B.color(colors[p.color % colors.length]);
      B.box(p.x, y, p.z, 6 * s, 1.3 * s, 2.2 * s, p.yaw);
      B.color('#F2E6D0');
      B.box(p.x - c * 0.8 * s, y + 1.3 * s, p.z - sn * 0.8 * s, 2 * s, 1.2 * s, 1.6 * s, p.yaw);
      B.color('#5A4636');
      B.box(p.x + c * 0.8 * s, y + 1.3 * s, p.z + sn * 0.8 * s, 0.18, 5.5 * s, 0.18, p.yaw);
      break;
    }
    case 'lighthouse': {
      for (let k = 0; k < 6; k++) {
        B.color(k % 2 ? '#C0563A' : '#F4EBDD');
        B.cyl(p.x, p.y + k * 3.6, p.z, 2.6 - k * 0.18, 2.6 - (k + 1) * 0.18, 3.6, 10, false);
      }
      B.color('#FFE7A8');
      B.cyl(p.x, p.y + 21.6, p.z, 1.6, 1.6, 2.4, 8);
      B.color('#2B2330');
      B.cyl(p.x, p.y + 24, p.z, 2, 0, 2.2, 8, false);
      break;
    }
    case 'windmill': {
      B.color('#E9DCC4');
      B.cyl(p.x, p.y, p.z, 3.2, 2.2, 14, 8);
      B.color('#7E3B2C');
      B.cyl(p.x, p.y + 14, p.z, 2.6, 0, 3.6, 8, false);
      break;
    }
    case 'hay': {
      B.color('#E1C26B');
      B.cyl(p.x, p.y, p.z, 1.3, 1.2, 1.7, 7);
      break;
    }
    case 'pylon': {
      const h = p.h ?? p.top - p.y;
      B.color('#6F6A72');
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const c = Math.cos(p.yaw);
        const sn = Math.sin(p.yaw);
        B.box(p.x + c * u * 1.2 - sn * v * 1.2, p.y, p.z + sn * u * 1.2 + c * v * 1.2, 0.35, h, 0.35, p.yaw);
      }
      for (let k = 0; k < 6; k++) B.box(p.x, p.top - 1.6 - k * 2.6, p.z, 0.3, 0.3, 7, p.yaw);
      break;
    }
    case 'silo': {
      B.color('#C9C2B4');
      B.cyl(p.x, p.y, p.z, 3, 3, 13, 10, false);
      B.color('#8C8478');
      B.blob(p.x, p.y + 13, p.z, 3.05, 0.6);
      break;
    }
    case 'watertower': {
      B.color('#5A4A40');
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(p.x + u * 1.4, p.y, p.z + v * 1.4, 0.25, 3.5, 0.25);
      B.color('#8E6A50');
      B.cyl(p.x, p.y + 3.5, p.z, 2.3, 2.3, 2.8, 8);
      B.color('#4C4652');
      B.cyl(p.x, p.y + 6.3, p.z, 2.5, 0, 1.2, 8, false);
      break;
    }
    case 'mark': {
      B.color('#A9724A');
      B.blob(p.x, p.y + 0.6, p.z, 1.4, 0.7, 0.2);
      break;
    }
    default:
      break;
  }
}
