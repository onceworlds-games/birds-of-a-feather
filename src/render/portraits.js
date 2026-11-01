// Portraits for the Aviary: every species drawn once with the game's own bird (the lead bird's mesh and shader), gliding with
// its wings out, seen from above and in front, in colour and as a dark shadow for the ones not caught yet. One small renderer, one
// draw, then it's thrown away; the pictures are plain canvases.

import * as THREE from 'three';
import { birdLayer, birdUniforms, songbirdGeometry } from './birdmesh.js';
import { SPECIES } from '../sim/species.js';

const SHADOW = '#3A3044';

/** { [species id]: canvas, [`${id}:dark`]: canvas }, or null if there's no WebGL to spare. */
export function speciesPortraits(px = 200) {
  const n = SPECIES.length;
  const cols = 8;
  const rows = Math.ceil((n * 2) / cols);
  const canvas = document.createElement('canvas');
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  const out = {};
  const geo = songbirdGeometry('high');
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(cols * px, rows * px, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const u = birdUniforms();
    u.sunDir.value.set(0.45, 0.75, 0.6).normalize();
    u.sunColor.value.setRGB(1.0, 0.92, 0.8).multiplyScalar(1.5);
    u.hemiSky.value.setRGB(0.62, 0.68, 0.82);
    u.hemiGround.value.setRGB(0.42, 0.34, 0.3);
    const L = birdLayer(geo, u, n * 2, { lead: true, shadows: false });
    scene.add(L.mesh);
    // an orthographic camera a little above, tiles laid out in its plane
    const W = 1.3;
    const cam = new THREE.OrthographicCamera(0, cols * W, 0, -rows * W, 0.1, 80);
    const dir = new THREE.Vector3(0, 0.85, 0.55).normalize();
    cam.position.copy(dir).multiplyScalar(30);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const fwd = new THREE.Vector3(0.72, 0, 0.7).normalize();
    const dark = new THREE.Color(SHADOW);
    const p = new THREE.Vector3();
    for (let i = 0; i < n * 2; i++) {
      const sp = SPECIES[i % n];
      const shade = i >= n;
      const c = i % cols;
      const r = Math.floor(i / cols);
      const size = 1.02 / Math.pow(sp.shape[4] ?? 1, 0.5) / (1 + (sp.shape[2] - 1) * 0.18 + sp.shape[3] * 0.12);
      // long tails push the bird forward in its tile
      const tail = (sp.shape[2] - 1) * 0.1 + sp.shape[3] * 0.12;
      p.copy(cam.position)
        .addScaledVector(right, c * W + W / 2)
        .addScaledVector(up, -(r * W + W * 0.58))
        .addScaledVector(dir, -30)
        .addScaledVector(fwd, (tail + 0.02) * size);
      L.pos.array.set([p.x, p.y, p.z], i * 3);
      L.fwd.array.set([fwd.x, 0.25, fwd.z], i * 3);
      L.color.array.set([0, 0, 0], i * 3);
      // wings held out in a glide, banking a little toward the light
      L.anim.array.set([1.2, 0, size, -0.25], i * 4);
      L.fx.array.set([0, 0, 0, 0], i * 4);
      ['back', 'belly', 'head', 'accent', 'beak'].forEach((k, j) => {
        const col = shade ? dark : new THREE.Color(sp.c[j]);
        L[k].array.set([col.r, col.g, col.b], i * 3);
      });
      L.shape.array.set([sp.shape[0], sp.shape[1], sp.shape[2], sp.shape[3]], i * 4);
    }
    L.g.instanceCount = n * 2;
    for (const a of L.attrs) a.needsUpdate = true;
    renderer.render(scene, cam);
    for (let i = 0; i < n * 2; i++) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = px;
      const g = tile.getContext('2d');
      g.drawImage(canvas, (i % cols) * px, Math.floor(i / cols) * px, px, px, 0, 0, px, px);
      out[i < n ? SPECIES[i].id : `${SPECIES[i - n].id}:dark`] = tile;
    }
    L.mesh.material.dispose();
    L.mesh.customDepthMaterial?.dispose();
    L.g.dispose();
  } catch {
    return null;
  } finally {
    geo.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return out;
}
