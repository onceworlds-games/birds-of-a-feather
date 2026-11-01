// The renderer, the scene, the sky dome and the light rig, set from the sunset's share each frame.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { lightAt } from './look.js';

const SHADOW = { low: 0, medium: 1024, high: 2048 };

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`;

const skyFrag = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 haze;
uniform vec3 sunColor;
uniform vec3 disc;
uniform vec3 sunDir;
uniform float night;
uniform float time;
uniform float discCos;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, -0.2);
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(horizon, zenith, t);
  // the band of haze at the horizon, warmer toward the sun
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
  col = mix(col, haze, exp(-abs(h) * 9.0) * (0.55 + 0.45 * toward));
  float c = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(c, 10.0) * 0.22 + pow(c, 120.0) * 0.5) * (1.0 - night * 0.6);
  // the disc
  float discMask = smoothstep(discCos, discCos + (1.0 - discCos) * 0.5, c);
  col = mix(col, disc * 1.6, discMask);
  // stars at night
  if (night > 0.0 && d.y > 0.05) {
    vec3 q = floor(d * 380.0);
    float s = step(0.9965, hash(q));
    col += vec3(s) * night * smoothstep(0.05, 0.4, d.y) * (0.6 + 0.4 * sin(time * 2.0 + hash(q + 3.0) * 30.0));
  }
  if (d.y < 0.0) col = mix(col, haze * 0.8, clamp(-d.y * 6.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// the last touch on screen colours: a little more contrast and colour, the sky's warmth pooled in the corners, a vignette
const Grade = {
  uniforms: {
    tDiffuse: { value: null },
    warm: { value: new THREE.Color('#3A1E2E') },
    amount: { value: 1 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 warm;
uniform float amount;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // colour: a touch more, kept off the near-whites and the deep shadows
  c = mix(vec3(l), c, 1.0 + 0.1 * amount * smoothstep(0.08, 0.3, l) * (1.0 - smoothstep(0.75, 1.0, l)));
  // contrast: a little, about a low pivot so evenings don't sink into the dark
  c = max(c + (c - 0.32) * 0.1 * amount, c * 0.9);
  // vignette: the corners a shade darker, tinted with the sky
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  float v = smoothstep(0.4, 1.1, length(q) / max(0.75, sqrt(aspect * aspect + 1.0) * 0.5));
  vec3 tint = warm / max(max(warm.r, warm.g), max(warm.b, 1e-3));
  c = mix(c, c * mix(vec3(1.0), tint, 0.35) * 0.78, v * amount);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};

export class View {
  constructor(canvas, { quality = 'medium', pixelRatio = 1, poster = false } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
      preserveDrawingBuffer: poster,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1400);
    this.scene.fog = new THREE.FogExp2(0xffd0a0, 0.0028);

    // sky dome
    this.skyUniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      haze: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      disc: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      night: { value: 0 },
      time: { value: 0 },
      discCos: { value: 0.9993 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.dome = dome;
    this.scene.add(dome);

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.focus = new THREE.Vector3();

    this.light = null;
    this.nightness = 0;
    this.pixelRatio = pixelRatio;
    this.composer = null;
    this.setQuality(quality);
  }

  setQuality(q) {
    this.quality = SHADOW[q] === undefined ? 'medium' : q;
    const size = SHADOW[this.quality];
    const r = this.renderer;
    r.shadowMap.enabled = size > 0;
    this.sun.castShadow = size > 0;
    if (size > 0) {
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
      this.sun.shadow.mapSize.set(size, size);
      const cam = this.sun.shadow.camera;
      const half = this.quality === 'high' ? 70 : 55;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 1;
      cam.far = 400;
      cam.updateProjectionMatrix();
    }
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    // bloom on medium and high only
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.quality !== 'low') {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 0.88);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.grade = new ShaderPass(Grade);
      this.composer.addPass(this.grade);
    }
    this.resize();
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
      this.grade.uniforms.aspect.value = w / h;
    }
  }

  /** Light the scene for share s of the sunset (beyond 1: night), with `focus` the point shadows follow. */
  setLight(s, focus, time) {
    const L = lightAt(s);
    this.light = L;
    const u = this.skyUniforms;
    u.zenith.value.copy(L.zenith);
    u.horizon.value.copy(L.horizon);
    u.haze.value.copy(L.haze);
    u.sunColor.value.copy(L.sun);
    u.disc.value.copy(L.disc);
    u.sunDir.value.copy(L.sunDir);
    u.night.value = Math.max(0, Math.min(1, (s - 1) / 0.08));
    u.time.value = time;
    this.nightness = u.night.value;
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.scene.fog.color.copy(L.haze).lerp(L.horizon, 0.35);
    this.focus.copy(focus);
    const d = L.sunDir;
    // the light itself never drops below a low angle: long shadows, but the ground still lit to play on
    this.sun.position.set(focus.x + d.x * 180, focus.y + Math.max(0.14, d.y) * 180, focus.z + d.z * 180);
    this.sun.target.position.copy(focus);
    this.dome.position.copy(this.camera.position);
    if (this.bloom) this.bloom.strength = 0.22 + L.glow * 0.38;
    // open up a little as the light goes, so the last minute stays bright enough to play
    this.renderer.toneMappingExposure = 0.92 + L.glow * 0.18;
    if (this.grade) this.grade.uniforms.warm.value.copy(L.haze).lerp(L.zenith, 0.4 + 0.5 * u.night.value);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
