// Effects over the world: ribbon streamers behind every lead bird, the hawk's flight, its aim ring, a pulse ring that points
// out grey birds, feathers bursting and drifting, and the storm front. A few draw calls in all, no allocation per frame.

import * as THREE from 'three';
import { PALETTE, HAWK } from '../sim/config.js';

const SEG = 9; // ribbon segments
const RIB_MAX = 26; // two ribbons for each of 13 leaders
const FEATHERS = 260;

function featherTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.rotate(-0.6);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -28);
  g.quadraticCurveTo(13, -8, 2, 26);
  g.lineTo(-2, 26);
  g.quadraticCurveTo(-13, -8, 0, -28);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -24);
  g.lineTo(0, 28);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    // ribbons: one mesh, a strip of quads per ribbon
    const vCount = RIB_MAX * (SEG + 1) * 2;
    this.ribPos = new Float32Array(vCount * 3);
    this.ribCol = new Float32Array(vCount * 4);
    const idx = [];
    for (let r = 0; r < RIB_MAX; r++) {
      const base = r * (SEG + 1) * 2;
      for (let k = 0; k < SEG; k++) {
        const a = base + k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.ribPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.ribCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.ribGeo = g;
    this.ribbons = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.ribbons.frustumCulled = false;
    this.ribbons.renderOrder = 3;
    scene.add(this.ribbons);
    this.ribCount = 0;
    this.s0 = {};
    this.s1 = {};

    // the hawk's aim ring and the pulse ring
    const ringGeo = new THREE.RingGeometry(0.82, 1, 56);
    ringGeo.rotateX(-Math.PI / 2);
    this.aim = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.ember, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.aim.visible = false;
    this.aim.renderOrder = 6;
    scene.add(this.aim);
    this.pulseRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    this.pulseRing.visible = false;
    this.pulseRing.renderOrder = 6;
    scene.add(this.pulseRing);
    this.pulseAt = null;

    // feathers
    this.fPos = new Float32Array(FEATHERS * 3);
    this.fCol = new Float32Array(FEATHERS * 3);
    this.fVel = new Float32Array(FEATHERS * 3);
    this.fLife = new Float32Array(FEATHERS);
    this.fSway = new Float32Array(FEATHERS);
    this.fNext = 0;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(this.fPos, 3).setUsage(THREE.DynamicDrawUsage));
    fg.setAttribute('color', new THREE.BufferAttribute(this.fCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.fGeo = fg;
    this.feathers = new THREE.Points(
      fg,
      new THREE.PointsMaterial({ size: 1.6, map: featherTexture(), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.2, sizeAttenuation: true }),
    );
    this.feathers.frustumCulled = false;
    scene.add(this.feathers);
    for (let i = 0; i < FEATHERS; i++) this.fPos[i * 3 + 1] = -9999;
    this.featherScale = 1;

    // the storm front: a dark wall of rain
    this.storm = null;
    this.tmpColor = new THREE.Color();
  }

  setQuality(q) {
    this.featherScale = q === 'low' ? 0.5 : 1;
  }

  /** The storm wall for a place that has one (null removes it). */
  setStorm(on) {
    if (on && !this.storm) {
      const geo = new THREE.BoxGeometry(600, 90, 700);
      geo.translate(-300, 45, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        vertexShader: /* glsl */ `
          varying vec3 vP;
          #include <fog_pars_vertex>
          void main() {
            vP = position;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform float time;
          varying vec3 vP;
          #include <fog_pars_fragment>
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            float edge = smoothstep(0.0, -18.0, vP.x);
            float streak = step(0.82, h(vec2(floor(vP.z * 1.3), floor(vP.y * 0.12 + time * 3.0))));
            vec3 col = mix(vec3(0.23, 0.21, 0.31), vec3(0.62, 0.62, 0.72), streak * 0.5);
            float a = 0.38 * edge + streak * 0.08 * edge;
            gl_FragColor = vec4(col, a);
            #include <fog_fragment>
          }`,
      });
      this.storm = new THREE.Mesh(geo, mat);
      this.storm.renderOrder = 4;
      this.scene.add(this.storm);
    } else if (!on && this.storm) {
      this.scene.remove(this.storm);
      this.storm.geometry.dispose();
      this.storm.material.dispose();
      this.storm = null;
    }
  }

  // ---------------------------------------------------------------- ribbons

  beginRibbons() {
    this.ribCount = 0;
  }

  /**
   * Two streamers behind a lead bird, sampled from its path: `trail` (flock.js), `t` the newest time on it, `L` the bird now.
   */
  addRibbons(trail, t, L, color) {
    for (const side of [-1, 1]) {
      if (this.ribCount >= RIB_MAX) return;
      const r = this.ribCount++;
      const base = r * (SEG + 1) * 2;
      const P = this.ribPos;
      const C = this.ribCol;
      const s0 = this.s0;
      const s1 = this.s1;
      for (let k = 0; k <= SEG; k++) {
        const tq = t - k * 0.028;
        if (k === 0) {
          s0.x = L.x - Math.cos(L.yaw) * 0.5;
          s0.y = L.y;
          s0.z = L.z - Math.sin(L.yaw) * 0.5;
        } else trail.sample(tq - 0.04, s0);
        trail.sample(tq - 0.08, s1);
        let dx = s0.x - s1.x;
        let dz = s0.z - s1.z;
        const l = Math.hypot(dx, dz);
        if (l < 1e-3) {
          dx = Math.cos(L.yaw);
          dz = Math.sin(L.yaw);
        } else {
          dx /= l;
          dz /= l;
        }
        // across the path, sideways; the two ribbons sit apart and flutter
        const nx = -dz;
        const nz = dx;
        const u = k / SEG;
        const flutter = Math.sin(this.time * 9 + k * 0.9 + side) * 0.12 * u;
        const off = side * (0.2 + u * 0.3) + flutter;
        const w = 0.09 * (1 - u * 0.7);
        const cx = s0.x + nx * off;
        const cy = s0.y - 0.05 - u * 0.4 + Math.cos(this.time * 7 + k) * 0.08 * u;
        const cz = s0.z + nz * off;
        const v = base + k * 2;
        P[v * 3] = cx - nx * w;
        P[v * 3 + 1] = cy;
        P[v * 3 + 2] = cz - nz * w;
        P[v * 3 + 3] = cx + nx * w;
        P[v * 3 + 4] = cy;
        P[v * 3 + 5] = cz + nz * w;
        const a = 0.95 * (1 - u);
        for (let q = 0; q < 2; q++) {
          C[(v + q) * 4] = color.r;
          C[(v + q) * 4 + 1] = color.g;
          C[(v + q) * 4 + 2] = color.b;
          C[(v + q) * 4 + 3] = a;
        }
      }
    }
  }

  endRibbons() {
    this.ribGeo.setDrawRange(0, this.ribCount * SEG * 6);
    this.ribGeo.attributes.position.needsUpdate = true;
    this.ribGeo.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the hawk

  /**
   * Where the hawk is drawn for the sky's hawk state (fills `out`: x, y, z, yaw, pitch, folded, visible). Its circle is drawn
   * lower than the rules' 55 u so the hunted player sees it.
   */
  hawkPose(sky, out) {
    const H = sky.hawk;
    out.visible = false;
    if (H.phase === 'wait') return out;
    const clock = sky.clock;
    if (H.phase === 'circle') {
      const f = sky.flocks.get(H.target);
      if (!f) return out;
      const head = f.puffs[0];
      const a = clock * 1.3;
      const enter = Math.min(1, (clock - H.t0) / 1.2);
      const r = 18;
      out.x = head.x + Math.cos(a) * r;
      out.z = head.z + Math.sin(a) * r;
      out.y = head.y + 26 + (1 - enter) * 40;
      out.yaw = a + Math.PI / 2;
      out.pitch = 0;
      out.bank = -0.5;
      out.folded = false;
      out.visible = true;
      return out;
    }
    const aim = H.aim;
    if (!aim) return out;
    const a0 = H.t0 * 1.3;
    if (H.phase === 'stoop') {
      const k = Math.min(1, (clock - H.t0) / HAWK.stoop);
      const e = k * k;
      const sx = aim.x + Math.cos(a0) * 18;
      const sz = aim.z + Math.sin(a0) * 18;
      const sy = aim.y + 26;
      out.x = sx + (aim.x - sx) * e;
      out.y = sy + (aim.y - sy) * e;
      out.z = sz + (aim.z - sz) * e;
      out.yaw = Math.atan2(aim.z - sz, aim.x - sx);
      out.pitch = -Math.atan2(26, 18);
      out.bank = 0;
      out.folded = true;
      out.visible = true;
      return out;
    }
    // leave: up and away
    const k = Math.min(1, (clock - H.t0) / HAWK.leave);
    const yaw = a0 + Math.PI;
    out.x = aim.x + Math.cos(yaw) * k * 60;
    out.z = aim.z + Math.sin(yaw) * k * 60;
    out.y = aim.y + k * k * 45;
    out.yaw = yaw;
    out.pitch = 0.5;
    out.bank = 0;
    out.folded = false;
    out.visible = k < 1;
    return out;
  }

  /** The aim ring on the hunted flock's head (null hides it). */
  setAim(p, r) {
    if (!p) {
      this.aim.visible = false;
      return;
    }
    this.aim.visible = true;
    this.aim.position.set(p.x, p.y - 0.5, p.z);
    const s = r * (1.5 + 0.15 * Math.sin(this.time * 12));
    this.aim.scale.set(s, 1, s);
  }

  /** A ring that pulses round a point (grey birds worth gathering); null hides it. */
  setPulse(p) {
    this.pulseAt = p;
    this.pulseRing.visible = !!p;
    if (p) this.pulseRing.position.set(p.x, p.y + 0.3, p.z);
  }

  // ---------------------------------------------------------------- feathers

  /** Feathers burst from a point. */
  burst(x, y, z, count, color, speed = 6) {
    const n = Math.round(count * this.featherScale);
    const c = this.tmpColor.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.fNext;
      this.fNext = (this.fNext + 1) % FEATHERS;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.fPos[i * 3] = x + (Math.random() - 0.5);
      this.fPos[i * 3 + 1] = y + (Math.random() - 0.5);
      this.fPos[i * 3 + 2] = z + (Math.random() - 0.5);
      this.fVel[i * 3] = Math.cos(a) * sp;
      this.fVel[i * 3 + 1] = up * sp * 0.8;
      this.fVel[i * 3 + 2] = Math.sin(a) * sp;
      const shade = 0.75 + Math.random() * 0.35;
      this.fCol[i * 3] = c.r * shade;
      this.fCol[i * 3 + 1] = c.g * shade;
      this.fCol[i * 3 + 2] = c.b * shade;
      this.fLife[i] = 2.5 + Math.random() * 2;
      this.fSway[i] = Math.random() * 6.28;
    }
  }

  /** Feathers drifting down over a span (the winner's wire). */
  shower(ax, ay, az, bx, by, bz, count, color) {
    const n = Math.round(count * this.featherScale);
    const c = this.tmpColor.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.fNext;
      this.fNext = (this.fNext + 1) % FEATHERS;
      const s = Math.random();
      this.fPos[i * 3] = ax + (bx - ax) * s + (Math.random() - 0.5) * 4;
      this.fPos[i * 3 + 1] = ay + (by - ay) * s + 6 + Math.random() * 10;
      this.fPos[i * 3 + 2] = az + (bz - az) * s + (Math.random() - 0.5) * 4;
      this.fVel[i * 3] = (Math.random() - 0.5) * 1.5;
      this.fVel[i * 3 + 1] = -0.5;
      this.fVel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      const shade = 0.8 + Math.random() * 0.3;
      this.fCol[i * 3] = c.r * shade;
      this.fCol[i * 3 + 1] = c.g * shade;
      this.fCol[i * 3 + 2] = c.b * shade;
      this.fLife[i] = 4 + Math.random() * 3;
      this.fSway[i] = Math.random() * 6.28;
    }
  }

  clearFeathers() {
    for (let i = 0; i < FEATHERS; i++) {
      this.fLife[i] = 0;
      this.fPos[i * 3 + 1] = -9999;
    }
    this.fGeo.attributes.position.needsUpdate = true;
  }

  update(dt, light, scene) {
    this.time += dt;
    // feathers: drag, a slow fall and a sway
    const P = this.fPos;
    const V = this.fVel;
    const drag = Math.exp(-dt * 2.2);
    let any = false;
    for (let i = 0; i < FEATHERS; i++) {
      if (this.fLife[i] <= 0) continue;
      any = true;
      this.fLife[i] -= dt;
      V[i * 3] *= drag;
      V[i * 3 + 2] *= drag;
      V[i * 3 + 1] = V[i * 3 + 1] * drag - 1.2 * dt;
      if (V[i * 3 + 1] < -1.6) V[i * 3 + 1] = -1.6;
      const sw = Math.sin(this.time * 2.5 + this.fSway[i]) * 0.9;
      P[i * 3] += (V[i * 3] + sw) * dt;
      P[i * 3 + 1] += V[i * 3 + 1] * dt;
      P[i * 3 + 2] += (V[i * 3 + 2] + Math.cos(this.time * 2 + this.fSway[i]) * 0.6) * dt;
      if (this.fLife[i] <= 0) P[i * 3 + 1] = -9999;
    }
    if (any || this.featherDirty) {
      this.fGeo.attributes.position.needsUpdate = true;
      this.fGeo.attributes.color.needsUpdate = true;
    }
    this.featherDirty = any;
    // rings
    if (this.pulseRing.visible && this.pulseAt) {
      const k = (this.time * 0.8) % 1;
      const s = this.pulseAt.r * (0.6 + k * 1.4);
      this.pulseRing.scale.set(s, 1, s);
      this.pulseRing.material.opacity = 0.85 * (1 - k);
    }
    if (this.storm) {
      this.storm.material.uniforms.time.value = this.time;
      this.storm.material.uniforms.fogColor.value.copy(scene.fog.color);
      this.storm.material.uniforms.fogDensity.value = scene.fog.density;
    }
  }

  /** Move the storm wall to its front's x (or hide it). */
  setStormX(x) {
    if (this.storm) {
      this.storm.visible = x !== null;
      if (x !== null) this.storm.position.x = x;
    }
  }
}
