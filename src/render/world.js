// A place, built into a handful of merged meshes: the painted ground, the sea with its shallows and surf, the town (walls,
// roofs, windows that light at dusk), trees that sway, props, poles and wires, thermals; and the things that move: boats
// at their moorings, windmill sails, the lighthouse beam, chimney smoke. Everything lit by the sunset's light.

import * as THREE from 'three';
import { HALF, N, RES } from '../sim/maps.js';
import { Builder, SURF, worldMaterial, worldUniforms } from './worldmat.js';
import { buildTown } from './town.js';
import { buildTrees } from './nature.js';
import { buildProps, boatGeometry, sailGeometry } from './props.js';
import { buildGround, depthTexture } from './ground.js';

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
uniform vec3 shallow;
uniform vec3 sky;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float time;
uniform float dusk;
uniform float halfSize;
uniform sampler2D depthMap;
varying vec3 vWorld;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float wave(vec2 p) {
  return sin(p.x * 0.21 + time * 0.9) * 0.5 + sin(p.y * 0.17 - time * 0.7) * 0.5 + sin((p.x + p.y) * 0.53 + time * 1.7) * 0.25
    + sin((p.x - p.y) * 1.13 - time * 2.3) * 0.12 + sin(p.x * 2.3 + p.y * 1.7 + time * 3.1) * 0.05;
}
void main() {
  vec2 p = vWorld.xz;
  vec2 uv = (p + halfSize) / (2.0 * halfSize);
  float depth = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(depthMap, uv).r : 1.0;
  float far = clamp(length(fwidth(p)) * 1.2, 0.0, 1.0);
  float e = 0.6;
  float amp = mix(0.12, 0.35, smoothstep(0.0, 0.4, depth));
  vec3 n = normalize(vec3(-(wave(p + vec2(e, 0.0)) - wave(p - vec2(e, 0.0))) * amp, 1.0, -(wave(p + vec2(0.0, e)) - wave(p - vec2(0.0, e))) * amp));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 water = mix(shallow, deep, smoothstep(0.0, 0.55, depth));
  // caustic shimmer in the shallows
  float caust = vnoise(p * 0.9 + vec2(time * 0.4, -time * 0.3)) * vnoise(p * 1.3 - vec2(time * 0.3, time * 0.2));
  water += vec3(0.25, 0.3, 0.25) * smoothstep(0.25, 0.6, caust) * (1.0 - smoothstep(0.05, 0.35, depth)) * (1.0 - far);
  vec3 col = mix(water, sky, 0.12 + 0.6 * fres);
  vec3 r = reflect(-v, n);
  float g = pow(max(dot(r, sunDir), 0.0), 260.0);
  float glint = pow(max(dot(r, sunDir), 0.0), 16.0);
  col += sunColor * (g * 4.0 + glint * 0.3);
  // sparkle: tiny bright points on the wave crests facing the sun
  float sp = step(0.985, h21(floor(p * 2.5) + floor(time * 4.0))) * smoothstep(0.2, 0.8, wave(p)) * (1.0 - far);
  col += sunColor * sp * 0.6 * (1.0 - dusk);
  // surf: a line at the shore, and bands that roll in and fade
  float edge = 1.0 - smoothstep(0.0, 0.035, depth);
  float roll = sin(depth * 70.0 - time * 1.8 + vnoise(p * 0.15) * 6.0);
  float bands = smoothstep(0.6, 0.95, roll) * (1.0 - smoothstep(0.02, 0.16, depth));
  float broken = smoothstep(0.35, 0.7, vnoise(p * 1.4 + time * 0.2));
  float foam = clamp(edge * (0.6 + 0.4 * broken) + bands * broken * 0.8, 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.96, 0.92) * (0.7 + 0.3 * sky), foam * 0.9);
  float alpha = mix(0.5, 0.97, smoothstep(0.0, 0.3, depth));
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ------------------------------------------------------------------ smoke

const smokeVert = /* glsl */ `
attribute vec3 origin;
attribute float phase;
uniform float time;
uniform float scale;
uniform vec2 wind;
varying float vA;
varying float vT;
void main() {
  float t = fract(time * 0.075 + phase);
  vec3 p = origin + vec3(wind.x * t * 9.0, t * 8.0 + t * t * 3.0, wind.y * t * 9.0);
  p.x += sin(t * 6.0 + phase * 20.0) * 0.5 * t;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = mix(1.4, 6.5, sqrt(t));
  gl_PointSize = size * scale / -mv.z;
  vA = smoothstep(0.0, 0.08, t) * (1.0 - t);
  vT = t;
}`;

const smokeFrag = /* glsl */ `
uniform vec3 tint;
varying float vA;
varying float vT;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.3;
  gl_FragColor = vec4(tint * (0.95 - 0.15 * vT), a);
}`;

// ------------------------------------------------------------------ the lighthouse beam

const beamVert = /* glsl */ `
varying float vL;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vL = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const beamFrag = /* glsl */ `
uniform float strength;
varying float vL;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  float edge = pow(abs(dot(normalize(vN), v)), 1.5);
  float a = (1.0 - vL) * edge * strength * 0.35;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.65) * a, a);
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
  float bands = 0.6 + 0.4 * sin(vH * 40.0 - time * 3.0 + sin(a * 5.0 + time) * 1.5);
  // soft at the foot and the top too: from a distance it reads as a shimmer, never a pale block
  float fade = smoothstep(0.0, 0.3, vH) * (1.0 - smoothstep(0.35, 0.95, vH));
  float alpha = bands * fade * 0.075 * strength * facing * facing;
  #ifdef USE_FOG
  alpha *= smoothstep(16.0, 45.0, vFogDepth) * (1.0 - smoothstep(50.0, 140.0, vFogDepth));
  #endif
  gl_FragColor = vec4(tint, alpha);
  #include <fog_fragment>
}`;

/** Build a place. Returns { group, map, update(light, time, dt, view), dispose }. */
export function buildWorld(map, quality = 'medium') {
  const group = new THREE.Group();
  const look = map.look;
  const U = worldUniforms();
  const shadows = quality !== 'low';
  const mat = worldMaterial(U);
  const disposables = [];

  // the ground, and a skirt of land (or sea) beyond it so the edge never shows
  const ground = buildGround(map, U, quality);
  group.add(ground.mesh);
  disposables.push(ground.colorTex, ground.maskTex);
  {
    const skirt = new THREE.Mesh(
      new THREE.RingGeometry(HALF * 1.3, 1300, 48, 1).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: map.hasSea ? look.sea : look.grass ?? look.sand }),
    );
    skirt.position.y = map.hasSea ? map.water - 0.05 : -2;
    group.add(skirt);
  }

  // the sea (or the river)
  let seaUniforms = null;
  if (map.hasSea) {
    const depth = depthTexture(map);
    depth.unpackAlignment = 1;
    disposables.push(depth);
    const deep = new THREE.Color(look.sea);
    seaUniforms = {
      deep: { value: deep },
      shallow: { value: deep.clone().lerp(new THREE.Color('#5FC4BC'), 0.55) },
      sky: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
      time: { value: 0 },
      dusk: { value: 0 },
      halfSize: { value: HALF },
      depthMap: { value: depth },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600, 1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: seaUniforms, vertexShader: seaVert, fragmentShader: seaFrag, fog: true, transparent: true, depthWrite: true }),
    );
    sea.position.y = map.water;
    sea.renderOrder = 1;
    group.add(sea);
  }

  // the town and the props, one mesh
  const B = new Builder();
  const { smoke } = buildTown(map, B);
  const moving = buildProps(B, map);
  const town = new THREE.Mesh(B.build(), mat);
  town.castShadow = shadows;
  town.receiveShadow = true;
  group.add(town);

  // trees
  const trees = new THREE.Mesh(buildTrees(map, quality), mat);
  trees.castShadow = shadows;
  trees.receiveShadow = true;
  group.add(trees);

  // poles and wires: wooden poles with a crossarm and two insulators; thin dark wires
  {
    const P = new Builder();
    for (const p of map.poles) {
      P.color('#5A4636').surf(SURF.wood, (p.x * 0.13) % 1);
      P.cyl(p.x, p.y, p.z, 0.16, 0.12, p.h + 0.3, 5, true);
      P.color('#4A3A2E').surf(SURF.plain);
      P.box(p.x, p.y + p.h - 0.45, p.z, 1.9, 0.16, 0.16, 0);
      P.color('#D8D2C4');
      P.cyl(p.x - 0.7, p.y + p.h - 0.3, p.z, 0.08, 0.06, 0.22, 5, true);
      P.cyl(p.x + 0.7, p.y + p.h - 0.3, p.z, 0.08, 0.06, 0.22, 5, true);
    }
    P.color('#2B2330').surf(SURF.plain);
    for (const w of map.wires) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const s = k / 12;
        pts.push([w.ax + (w.bx - w.ax) * s, w.ay + (w.by - w.ay) * s - w.sag * 4 * s * (1 - s), w.az + (w.bz - w.az) * s]);
      }
      P.tube(pts, 0.055);
    }
    const m = new THREE.Mesh(P.build(), mat);
    m.castShadow = shadows;
    m.receiveShadow = true;
    group.add(m);
  }

  // boats bob at their moorings
  const boats = [];
  for (const p of moving.boats) {
    const baseY = map.water - 0.25;
    const m = new THREE.Mesh(boatGeometry(p, baseY), mat);
    m.position.set(p.x, baseY, p.z);
    m.rotation.order = 'YXZ';
    m.rotation.y = -p.yaw;
    m.castShadow = shadows;
    m.receiveShadow = true;
    group.add(m);
    boats.push({ m, baseY, phase: (p.x * 0.37 + p.z * 0.11) % 6.28 });
  }

  // windmill sails turn about the hub
  const sails = [];
  if (moving.sails.length) {
    const g = sailGeometry();
    for (const p of moving.sails) {
      const m = new THREE.Mesh(g, mat);
      m.position.set(p.x + Math.cos(p.yaw) * 2.7, p.y + 15.2, p.z + Math.sin(p.yaw) * 2.7);
      m.rotation.order = 'YXZ';
      m.rotation.y = -p.yaw;
      m.castShadow = shadows;
      group.add(m);
      sails.push(m);
    }
  }

  // the lighthouse beam at dusk
  const beamUniforms = { strength: { value: 0 } };
  const beams = [];
  for (const b of moving.beams) {
    const g = new THREE.CylinderGeometry(6, 0.5, 80, 18, 1, true).translate(0, 40, 0).rotateZ(-Math.PI / 2);
    const m2 = new THREE.Group();
    for (const turn of [0, Math.PI]) {
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: beamUniforms, vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.rotation.y = turn;
      m2.add(m);
    }
    m2.position.set(b.x, b.y, b.z);
    m2.rotation.z = -0.06;
    m2.renderOrder = 6;
    m2.visible = false;
    group.add(m2);
    beams.push(m2);
  }

  // chimney smoke
  const smokeUniforms = { time: { value: 0 }, scale: { value: 600 }, wind: { value: new THREE.Vector2(0.6, 0.25) }, tint: { value: new THREE.Color('#EDE6E0') } };
  if (smoke.length) {
    const per = quality === 'low' ? 5 : 9;
    const origin = new Float32Array(smoke.length * per * 3);
    const phase = new Float32Array(smoke.length * per);
    let k = 0;
    for (const [x, y, z] of smoke) {
      const off = ((x * 0.31 + z * 0.17) % 1 + 1) % 1;
      for (let i = 0; i < per; i++, k++) {
        origin[k * 3] = x;
        origin[k * 3 + 1] = y;
        origin[k * 3 + 2] = z;
        phase[k] = off + i / per;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(origin, 3));
    g.setAttribute('origin', new THREE.BufferAttribute(origin, 3));
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: smokeUniforms, vertexShader: smokeVert, fragmentShader: smokeFrag, transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    group.add(pts);
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

  const white = new THREE.Color('#FFFFFF');
  const cloudWind = new THREE.Vector2(0.006, 0.0025);
  return {
    group,
    map,
    uniforms: U,
    update(light, time, dt, view) {
      U.uTime.value = time;
      U.uDusk.value = Math.min(1, light.glow * 1.1);
      U.uCloud.value.addScaledVector(cloudWind, dt);
      U.uCloudAmt.value = 1 - Math.min(1, light.glow) * 0.7;
      if (seaUniforms) {
        seaUniforms.sky.value.copy(light.horizon).lerp(light.zenith, 0.35);
        seaUniforms.sunColor.value.copy(light.sun).multiplyScalar(Math.max(0.2, light.sunI / 2));
        seaUniforms.sunDir.value.copy(light.sunDir);
        seaUniforms.time.value = time;
        seaUniforms.dusk.value = light.glow;
      }
      thermUniforms.time.value = time;
      thermUniforms.tint.value.copy(light.sun).lerp(white, 0.4);
      thermUniforms.strength.value = Math.max(0, 1 - light.glow * 0.4);
      for (const b of boats) {
        b.m.position.y = b.baseY + Math.sin(time * 1.1 + b.phase) * 0.12;
        b.m.rotation.x = Math.sin(time * 0.9 + b.phase * 1.7) * 0.035;
        b.m.rotation.z = Math.sin(time * 0.7 + b.phase) * 0.025;
      }
      for (const s of sails) s.rotation.x += dt * 0.6;
      beamUniforms.strength.value = Math.max(0, (light.glow - 0.3) / 0.7);
      for (const b of beams) {
        b.visible = beamUniforms.strength.value > 0.01;
        b.rotation.y = time * 0.5;
      }
      smokeUniforms.time.value = time;
      smokeUniforms.tint.value.copy(light.hemiSky).lerp(white, 0.55);
      if (view) smokeUniforms.scale.value = (view.height * view.pixelRatio * 0.5) / Math.tan((view.camera.fov * Math.PI) / 360);
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      for (const d of disposables) d.dispose();
    },
  };
}
