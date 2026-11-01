// Effects over the world: trails behind every lead bird (streamers, petals, sparks, lanterns, a comet, a rainbow, feathers, an
// aurora), the Tailwind's rushing air, light pillars over rare birds and the flare when one is caught, the hawk's flight, its
// aim ring, a pulse ring that points out grey birds, feathers bursting and drifting, and the storm front. A few draw calls in
// all, no allocation per frame.

import * as THREE from 'three';
import { PALETTE, HAWK } from '../sim/config.js';

const FEATHERS = 320;

const WHITE = new THREE.Color('#FFFFFF');
const GOLD = new THREE.Color('#FFC24A');
const EMBER = new THREE.Color('#F05A3C');
const SPARK = new THREE.Color('#FFF1C8');
const LANTERN = new THREE.Color('#FFA040');
const PETAL_A = new THREE.Color('#F7A8BE');
const PETAL_B = new THREE.Color('#FFF0F2');
const WIND = new THREE.Color('#D8EEF2');
const RAINBOW = [0.0, 0.13, 0.48, 0.75];

/** Flat strips of quads, rebuilt every frame: one ribbon is `seg` + 1 pairs of points across its path. */
class RibbonSet {
  constructor(scene, pairs, additive) {
    this.max = pairs;
    this.pos = new Float32Array(pairs * 2 * 3);
    this.col = new Float32Array(pairs * 2 * 4);
    this.idx = new Uint32Array(pairs * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.g = g;
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: !additive,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 4 : 3;
    scene.add(this.mesh);
    this.used = 0;
    this.nIdx = 0;
  }

  begin() {
    this.used = 0;
    this.nIdx = 0;
  }

  /** Room for a ribbon of `seg` segments: its first pair, or −1 when full. */
  next(seg) {
    if (this.used + seg + 1 > this.max) return -1;
    const r = this.used;
    this.used += seg + 1;
    const I = this.idx;
    for (let i = 0; i < seg; i++) {
      const a = (r + i) * 2;
      I[this.nIdx++] = a;
      I[this.nIdx++] = a + 1;
      I[this.nIdx++] = a + 2;
      I[this.nIdx++] = a + 1;
      I[this.nIdx++] = a + 3;
      I[this.nIdx++] = a + 2;
    }
    return r;
  }

  put(r, i, ax, ay, az, bx, by, bz, c, alpha) {
    const v = (r + i) * 2;
    const P = this.pos;
    const C = this.col;
    P[v * 3] = ax;
    P[v * 3 + 1] = ay;
    P[v * 3 + 2] = az;
    P[v * 3 + 3] = bx;
    P[v * 3 + 4] = by;
    P[v * 3 + 5] = bz;
    for (let q = 0; q < 2; q++) {
      C[(v + q) * 4] = c.r;
      C[(v + q) * 4 + 1] = c.g;
      C[(v + q) * 4 + 2] = c.b;
      C[(v + q) * 4 + 3] = alpha;
    }
  }

  end() {
    this.g.setDrawRange(0, this.nIdx);
    this.g.attributes.position.needsUpdate = true;
    this.g.attributes.color.needsUpdate = true;
    this.g.index.needsUpdate = true;
  }
}

/** Small lights (sparks, lanterns, wind, glints) or petals: points that drift, fall and fade. */
class Motes {
  constructor(scene, max, glow) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('spin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
    this.g = g;
    this.uniforms = { scale: { value: 400 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      defines: glow ? { GLOW: '' } : {},
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute float spin;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vSpin;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vSpin = spin;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * scale / max(1.0, -mv.z), 0.0, 96.0);
          gl_Position = projectionMatrix * mv;
          if (alpha <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vSpin;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          #ifdef GLOW
          float d = length(q) * 2.0;
          float a = vAlpha * (pow(max(0.0, 1.0 - d), 2.0) + 0.6 * smoothstep(0.35, 0.0, d));
          gl_FragColor = vec4(mix(vColor, vec3(1.0), smoothstep(0.3, 0.0, d) * 0.6) * a, a);
          #else
          float c = cos(vSpin);
          float s = sin(vSpin);
          q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
          float e = length(q * vec2(2.0, 4.2));
          float a = vAlpha * smoothstep(1.0, 0.75, e);
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * (0.85 + 0.3 * (0.5 - q.y)), a);
          #endif
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.live = 0;
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life;
    this.age[i] = 0;
    this.grav[i] = grav;
    this.spin[i] = Math.random() * 6.28;
    this.alpha[i] = 0.001;
    this.live = Math.max(this.live, 1);
  }

  update(dt, camera, height) {
    if (camera) this.uniforms.scale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    if (!this.live) return;
    let any = 0;
    const P = this.pos;
    const V = this.vel;
    const drag = Math.exp(-dt * 1.6);
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      any++;
      this.age[i] += dt;
      V[i * 3] *= drag;
      V[i * 3 + 2] *= drag;
      V[i * 3 + 1] = V[i * 3 + 1] * drag + this.grav[i] * dt;
      P[i * 3] += V[i * 3] * dt + (this.grav[i] > -1 ? Math.sin(this.age[i] * 3 + i) * 0.4 * dt : 0);
      P[i * 3 + 1] += V[i * 3 + 1] * dt;
      P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.spin[i] += dt * 2.5;
      const k = this.age[i] / this.life[i];
      this.alpha[i] = Math.min(1, k * 12) * (1 - k * k);
    }
    this.live = any;
    for (const a of ['position', 'color', 'size', 'alpha', 'spin']) this.g.attributes[a].needsUpdate = true;
  }
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// feathers: a point each, drawn as a feather turning end over end and flipping as it falls (no texture: the vane and its shaft
// are worked out per pixel), lit on one face, darker on the other, fading at the end of its life
const featherVert = /* glsl */ `
attribute vec3 color;
attribute float sway;
attribute float life;
uniform float time;
uniform float scale;
varying vec3 vColor;
varying float vAngle;
varying float vFlip;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(1.9 * scale / max(1.0, -mv.z), 0.0, 80.0);
  vColor = color;
  vAngle = sway * 3.0 + time * (1.2 + fract(sway * 7.3) * 1.6) * (fract(sway * 3.1) > 0.5 ? 1.0 : -1.0);
  vFlip = cos(time * (2.0 + fract(sway * 5.7) * 2.5) + sway * 11.0);
  vAlpha = clamp(life * 1.5, 0.0, 1.0);
}`;

const featherFrag = /* glsl */ `
varying vec3 vColor;
varying float vAngle;
varying float vFlip;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos(vAngle), s = sin(vAngle);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  // seen edge-on as it flips, the feather narrows
  q.x /= max(0.22, abs(vFlip));
  float y = q.y / 0.46;
  if (abs(y) > 1.0) discard;
  // a vane, widest a little above the middle, with a quill at the foot
  float t = (y + 1.0) * 0.5;
  float w = 0.17 * pow(sin(3.14159 * clamp(t * 1.08 - 0.04, 0.0, 1.0)), 0.7) * (t < 0.12 ? 0.25 : 1.0);
  float side = q.x > 0.0 ? 1.0 : 0.82; // the two halves of the vane differ a little
  if (abs(q.x) > w * side) discard;
  // notches in the vane
  float notch = step(0.93, fract(t * 7.0 + q.x * 9.0)) * step(0.4, abs(q.x) / max(w, 1e-3));
  if (notch > 0.5) discard;
  float shaft = 1.0 - smoothstep(0.008, 0.02, abs(q.x));
  float face = vFlip > 0.0 ? 1.0 : 0.72;
  vec3 col = vColor * face * (0.85 + 0.3 * (1.0 - abs(q.x) / max(w, 1e-3)));
  col = mix(col, vColor * 0.45, shaft * 0.8);
  gl_FragColor = vec4(col, vAlpha);
}`;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    // trails: flat ribbons (one set blended, one glowing) and motes (glowing points, and petals)
    this.rib = new RibbonSet(scene, 3000, false);
    this.glowRib = new RibbonSet(scene, 2400, true);
    this.glow = new Motes(scene, 900, true);
    this.petals = new Motes(scene, 300, false);
    this.s0 = {};
    this.s1 = {};
    this.tmpC2 = new THREE.Color();
    this.frameDt = 1 / 60;
    this.shedAcc = 0;
    this.featherAcc = 0;
    this.windAcc = 0;

    // light pillars over rare birds, and flares when one is caught
    const pillarGeo = new THREE.CylinderGeometry(1.5, 2.2, 70, 20, 1, true);
    pillarGeo.translate(0, 35, 0);
    this.pillars = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(
        pillarGeo,
        new THREE.ShaderMaterial({
          uniforms: { color: { value: new THREE.Color() }, time: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              vUv = uv;
              vec4 w = modelMatrix * vec4(position, 1.0);
              vN = normalize(mat3(modelMatrix) * normal);
              vV = normalize(cameraPosition - w.xyz);
              gl_Position = projectionMatrix * viewMatrix * w;
            }`,
          fragmentShader: /* glsl */ `
            uniform vec3 color;
            uniform float time;
            varying vec2 vUv;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
              float edge = pow(1.0 - abs(dot(normalize(vN), vV)), 1.5);
              float core = 1.0 - edge;
              float fade = pow(1.0 - vUv.y, 2.2);
              float flow = 0.75 + 0.25 * sin(vUv.y * 30.0 - time * 4.0);
              float a = (0.16 + core * 0.28) * fade * flow;
              gl_FragColor = vec4(mix(color, vec3(1.0), 0.35 * core) * a, a);
            }`,
        }),
      );
      m.visible = false;
      m.renderOrder = 5;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    const flareTex = glowTexture();
    this.flares = [0, 1, 2].map(() => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.visible = false;
      sp.renderOrder = 7;
      sp.userData.t = 0;
      scene.add(sp);
      return sp;
    });
    this.flareNext = 0;

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
    fg.setAttribute('sway', new THREE.BufferAttribute(this.fSway, 1).setUsage(THREE.DynamicDrawUsage));
    fg.setAttribute('life', new THREE.BufferAttribute(this.fLife, 1).setUsage(THREE.DynamicDrawUsage));
    this.fGeo = fg;
    this.featherUniforms = { time: { value: 0 }, scale: { value: 400 } };
    this.feathers = new THREE.Points(
      fg,
      new THREE.ShaderMaterial({ uniforms: this.featherUniforms, vertexShader: featherVert, fragmentShader: featherFrag, transparent: true, depthWrite: false }),
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

  // ---------------------------------------------------------------- trails

  beginRibbons() {
    this.rib.begin();
    this.glowRib.begin();
  }

  /**
   * The trail behind a lead bird, in a style (progress.js TRAILS): `trail` is its path (flock.js), `t` the newest time on it,
   * `L` the bird now, `color` its flock's colour. Ribbons are flat (the camera looks down on them); some styles shed motes.
   */
  addRibbons(trail, t, L, color, style = 0, scale = 6.4) {
    const k = scale / 6.4;
    const dt = this.frameDt;
    const tc = this.tmpColor;
    switch (style) {
      case 1: // Petals: rose streamers that shed petals
        this.streamers(trail, t, L, k, (u, side, out) => out.copy(PETAL_A).lerp(PETAL_B, u * 0.8 + (side > 0 ? 0.1 : 0)), 0.95, 0.75);
        this.shed(L, k, dt * 16, 'petal', (out) => out.copy(Math.random() < 0.5 ? PETAL_A : PETAL_B), 1.0 * k, 2.4);
        break;
      case 2: // Sparks: thin gold streamers, sparks falling from them
        this.streamers(trail, t, L, k, (u, side, out) => out.copy(GOLD).lerp(EMBER, u), 0.9, 0.5, this.glowRib);
        this.shed(L, k, dt * 34, 'spark', (out) => out.copy(Math.random() < 0.7 ? GOLD : SPARK), 0.55 * k, 0.9);
        break;
      case 3: // Lanterns: warm lights hanging in the air behind
        this.streamers(trail, t, L, k, (u, side, out) => out.copy(LANTERN).multiplyScalar(0.7), 0.5, 0.45, this.glowRib);
        this.shed(L, k, dt * 5, 'lantern', (out) => out.copy(LANTERN), 1.9 * k, 2.6);
        break;
      case 4: // Comet: one bright tail from the body, white into the flock's colour
        this.comet(trail, t, L, k, color);
        this.shed(L, k, dt * 18, 'spark', (out) => out.copy(color).lerp(WHITE, 0.5), 0.6 * k, 0.7, 0);
        break;
      case 5: // Rainbow: four bands side by side
        for (let b = 0; b < 4; b++) {
          const off = (b - 1.5) * 0.55;
          this.ribbon(trail, t, L, k, off, 0.3, 0, 1.0, (u, out) => out.setHSL((RAINBOW[b] + u * 0.08) % 1, 0.85, 0.6), 0.95, this.rib, 22, 0.05);
        }
        break;
      case 6: // Feathers: streamers in the flock's colour that drop real feathers
        this.streamers(trail, t, L, k, (u, side, out) => out.copy(color), 0.95, 0.7);
        this.featherAcc += dt * 7;
        while (this.featherAcc >= 1) {
          this.featherAcc--;
          const side = Math.random() < 0.5 ? -1 : 1;
          const c = Math.cos(L.yaw);
          const sn = Math.sin(L.yaw);
          this.burst(L.x - c * 2 * k - sn * side * 3 * k, L.y, L.z - sn * 2 * k + c * side * 3 * k, 1, tc.copy(color).lerp(WHITE, 0.25), 1.2);
        }
        break;
      case 7: // Aurora: wide, slow, waving light that drifts through green, teal and violet
        for (const side of [-1, 1]) {
          this.ribbon(trail, t, L, k, side * 1.6, 1.25, 1.6, 1.6, (u, out) => out.setHSL(0.38 + 0.32 * ((u + this.time * 0.12 + (side > 0 ? 0.2 : 0)) % 1), 0.8, 0.55), 0.7, this.glowRib, 24, 0.06);
        }
        this.shed(L, k, dt * 10, 'spark', (out) => out.setHSL(0.4 + Math.random() * 0.35, 0.8, 0.65), 0.5 * k, 1.4, 1.5);
        break;
      default: // Streamers: two ribbons from the wingtips in the flock's colour
        this.streamers(trail, t, L, k, (u, side, out) => out.copy(color), 0.95, 0.75);
    }
    if (L.wind) this.windAround(L, k);
  }

  /** Two ribbons from the wingtips. */
  streamers(trail, t, L, k, colorAt, alpha, width, set = this.rib) {
    for (const side of [-1, 1]) this.ribbon(trail, t, L, k, side * 3.1, width, 0.5, 0.9, (u, out) => colorAt(u, side, out), alpha, set, 18, 0.045, side);
  }

  /** A wide bright tail from the body. */
  comet(trail, t, L, k, color) {
    this.ribbon(trail, t, L, k, 0, 2.2, 0, 1.6, (u, out) => out.copy(WHITE).lerp(color, Math.min(1, u * 2.2)), 0.9, this.glowRib, 26, 0.05);
    this.ribbon(trail, t, L, k, 0, 0.8, 0, 1.6, (u, out) => out.copy(WHITE), 0.8, this.glowRib, 14, 0.05);
  }

  /**
   * One flat ribbon along the path: `off` sideways (× k), `w` its half-width at the bird (× k), `wave` how far it swings,
   * `drop` how far it sinks by its end, `seg` segments `step` seconds apart.
   */
  ribbon(trail, t, L, k, off, w, wave, drop, colorAt, alpha, set, seg, step, phase = 0) {
    const r = set.next(seg);
    if (r < 0) return;
    const s0 = this.s0;
    const s1 = this.s1;
    const c = this.tmpC2;
    for (let i = 0; i <= seg; i++) {
      const tq = t - i * step;
      if (i === 0) {
        s0.x = L.x - Math.cos(L.yaw) * 1.2 * k;
        s0.y = L.y;
        s0.z = L.z - Math.sin(L.yaw) * 1.2 * k;
      } else trail.sample(tq - 0.06, s0);
      trail.sample(tq - 0.12, s1);
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
      const nx = -dz;
      const nz = dx;
      const u = i / seg;
      const sway = Math.sin(this.time * 7 + i * 0.7 + phase * 1.3) * (0.25 + wave) * u * k;
      const o = (off * (1 - u * 0.25)) * k + sway;
      const hw = w * k * (1 - u * 0.8);
      const cx = s0.x + nx * o;
      const cy = s0.y - 0.2 * k - u * drop * k + Math.cos(this.time * 5 + i) * 0.15 * u * k;
      const cz = s0.z + nz * o;
      colorAt(u, c);
      set.put(r, i, cx - nx * hw, cy, cz - nz * hw, cx + nx * hw, cy, cz + nz * hw, c, alpha * (1 - u) * Math.min(1, i === 0 ? 0.6 : 1));
    }
  }

  endRibbons() {
    this.rib.end();
    this.glowRib.end();
  }

  /** Motes shed from the wingtips: `rate` this frame (fractions carry over), a kind, a colour, a size and a life. */
  shed(L, k, rate, kind, colorAt, size, life, spread = 0.6) {
    this.shedAcc += rate;
    const c = Math.cos(L.yaw);
    const sn = Math.sin(L.yaw);
    const sys = kind === 'petal' ? this.petals : this.glow;
    while (this.shedAcc >= 1) {
      this.shedAcc--;
      const side = Math.random() < 0.5 ? -1 : 1;
      const tip = kind === 'spark' && spread === 0 ? 0 : 3 * k;
      const x = L.x - c * 1.5 * k - sn * side * tip + (Math.random() - 0.5) * spread * k;
      const z = L.z - sn * 1.5 * k + c * side * tip + (Math.random() - 0.5) * spread * k;
      const y = L.y - 0.2 * k;
      colorAt(this.tmpC2);
      if (kind === 'spark') sys.emit(x, y, z, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2, this.tmpC2, size, life, -4);
      else if (kind === 'lantern') sys.emit(x, y, z, (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, this.tmpC2, size, life, 0.2);
      else sys.emit(x, y, z, (Math.random() - 0.5) * 2, -0.6, (Math.random() - 0.5) * 2, this.tmpC2, size, life, -0.8);
    }
  }

  /** A Tailwind: streaks of air rushing past the bird. */
  windAround(L, k) {
    this.windAcc += this.frameDt * 40;
    const c = Math.cos(L.yaw);
    const sn = Math.sin(L.yaw);
    while (this.windAcc >= 1) {
      this.windAcc--;
      const a = Math.random() * Math.PI * 2;
      const r = (4 + Math.random() * 7) * k;
      const ahead = (4 + Math.random() * 6) * k;
      this.glow.emit(L.x + c * ahead - sn * Math.cos(a) * r, L.y + Math.sin(a) * r * 0.5, L.z + sn * ahead + c * Math.cos(a) * r, -c * 34, 0, -sn * 34, WIND, 0.45 * k, 0.45, 0);
    }
  }

  // ---------------------------------------------------------------- rare birds and flares

  /** Light pillars over the rare birds still on their landmarks: [{ x, y, z, color }] (up to three). */
  setRares(list) {
    for (let i = 0; i < this.pillars.length; i++) {
      const p = this.pillars[i];
      const r = list[i];
      p.visible = !!r;
      if (!r) continue;
      p.position.set(r.x, r.y - 1, r.z);
      p.material.uniforms.color.value.set(r.color);
      // sparkles rising round it
      if (Math.random() < this.frameDt * 6) {
        const a = Math.random() * Math.PI * 2;
        this.glow.emit(r.x + Math.cos(a) * 1.6, r.y + Math.random() * 2, r.z + Math.sin(a) * 1.6, 0, 2 + Math.random() * 2, 0, p.material.uniforms.color.value, 0.7, 1.6, 0.5);
      }
    }
  }

  /** A burst of light (a rare bird caught). */
  flare(x, y, z, color) {
    const f = this.flares[this.flareNext];
    this.flareNext = (this.flareNext + 1) % this.flares.length;
    f.visible = true;
    f.position.set(x, y, z);
    f.material.color.set(color);
    f.userData.t = 0;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 0.3;
      const sp = 6 + Math.random() * 10;
      this.glow.emit(x, y, z, Math.cos(a) * sp, up * sp * 0.6, Math.sin(a) * sp, f.material.color, 0.9, 0.9 + Math.random() * 0.6, -3);
    }
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

  update(dt, light, scene, camera, height) {
    this.time += dt;
    this.frameDt = Math.min(0.1, dt);
    this.glow.update(dt, camera, height);
    this.petals.update(dt, camera, height);
    for (const p of this.pillars) if (p.visible) p.material.uniforms.time.value = this.time;
    for (const f of this.flares) {
      if (!f.visible) continue;
      f.userData.t += dt;
      const k = f.userData.t / 0.7;
      if (k >= 1) {
        f.visible = false;
        continue;
      }
      const sc = 6 + 30 * (1 - (1 - k) * (1 - k));
      f.scale.set(sc, sc, 1);
      f.material.opacity = (1 - k) * (1 - k);
    }
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
      const a = this.fGeo.attributes;
      a.position.needsUpdate = true;
      a.color.needsUpdate = true;
      a.sway.needsUpdate = true;
      a.life.needsUpdate = true;
    }
    this.featherUniforms.time.value = this.time;
    if (camera) this.featherUniforms.scale.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
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
