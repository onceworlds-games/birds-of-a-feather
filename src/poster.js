// Store art: one staged frame drawn by the game's own renderer (`?poster=<name>`), with a fixed seed and no room or SDK.
// cover, action, win, multi (1280×720), icon (512×512) and badge-<id> (256×256, drawn in 2D).

import * as THREE from 'three';
import { View } from './render/view.js';
import { buildWorld } from './render/world.js';
import { Birds } from './render/birds.js';
import { Fx } from './render/fx.js';
import { Hud, symbolPath } from './hud.js';
import { Sky } from './sim/sky.js';
import { SLOTS, PALETTE } from './sim/config.js';
import { surfaceAt, wirePoint } from './sim/maps.js';
import { SPECIES } from './sim/species.js';

const DT = 1 / 30;
const HAWK_EDGE = new THREE.Color(0.22, 0.07, 0.03);

function arcAt(yaw0, speed, turn, t, out) {
  if (Math.abs(turn) < 1e-6) {
    out.x = Math.cos(yaw0) * speed * t;
    out.z = Math.sin(yaw0) * speed * t;
  } else {
    const R = speed / turn;
    out.x = R * (Math.sin(yaw0 + turn * t) - Math.sin(yaw0));
    out.z = -R * (Math.cos(yaw0 + turn * t) - Math.cos(yaw0));
  }
  return out;
}

/** A path whose head reaches (x, z) heading `yaw` at time T, flown at `speed` turning at `turn` rad/s, at height y (a function of t). */
function flight({ x, z, yaw, T, speed = 14, turn = 0, y }) {
  const yaw0 = yaw - turn * T;
  const end = arcAt(yaw0, speed, turn, T, {});
  const p = {};
  return (t) => {
    arcAt(yaw0, speed, turn, t, p);
    return { x: x + p.x - end.x, y: typeof y === 'function' ? y(t) : y, z: z + p.z - end.z, yaw: yaw0 + turn * t };
  };
}

function setup(W, H) {
  const canvas = document.getElementById('gl');
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const hudCanvas = document.getElementById('hud');
  hudCanvas.style.width = `${W}px`;
  hudCanvas.style.height = `${H}px`;
  const view = new View(canvas, { quality: 'high', pixelRatio: 1, poster: true });
  const birds = new Birds(view.scene);
  const fx = new Fx(view.scene);
  const hud = new Hud(hudCanvas);
  hud.resize(W, H, 1);
  return { view, birds, fx, hud, W, H };
}

/** Fly the flocks along their paths for T seconds (the rules running, the birds following), then draw one frame. */
function stage(ctx, { mapId = 'saltmere', flocks, T, s, cam, look, fov = 50, steal = false, after, leadScale = 4 }) {
  const { view, birds, fx } = ctx;
  const sky = new Sky({ mapId, seed: 11, autoRivals: false, hawkFirst: 9999, wild: 1000 });
  const world = buildWorld(sky.map, 'high');
  view.scene.add(world.group);
  const camera = view.camera;
  camera.fov = fov;
  camera.position.set(cam[0], cam[1], cam[2]);
  camera.lookAt(look[0], look[1], look[2]);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  for (const fl of flocks) {
    const p = fl.path(0);
    const f = sky.addFlock(fl.id, { kind: 'player', name: fl.name ?? fl.id, slot: fl.slot, n: fl.n, spawn: { x: p.x, y: p.y, z: p.z, yaw: p.yaw } });
    if (steal) f.shieldUntil = -1;
  }
  sky.drainEvents();
  const steps = Math.round(T / DT);
  for (let k = 0; k <= steps; k++) {
    const t = k * DT;
    for (const fl of flocks) {
      const p = fl.path(t);
      sky.feed(fl.id, p.x, p.y, p.z, p.yaw, false);
      if (!steal) sky.flocks.get(fl.id).n = fl.n;
    }
    sky.advance(DT);
    birds.push(sky.drainEvents());
    birds.update(DT, sky, camera, null, null);
  }
  after?.(sky);
  const lead = [];
  fx.beginRibbons();
  for (const fl of flocks) {
    const p = fl.path(T);
    const f = sky.flocks.get(fl.id);
    const color = new THREE.Color(SLOTS[fl.slot].hex);
    lead.push({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, color, scale: leadScale, flap: 11, phase: lead.length, species: fl.species ?? 0, flair: fl.flair ?? 0 });
    fx.addRibbons(f.trail, sky.clock, { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, color, fl.trail ?? 0, leadScale);
  }
  fx.endRibbons();
  return { sky, world, lead };
}

function light(ctx, world, s, focus) {
  const { view, birds, fx } = ctx;
  view.setLight(s, focus, 3.1);
  world.update(view.light, 3.1, 0);
  birds.setLight(view.light, view.scene);
  fx.update(0, view.light, view.scene);
}

function tagsFor(ctx, sky, flocks, opts = {}) {
  const { view, hud } = ctx;
  const tags = [];
  const v = new THREE.Vector3();
  for (const fl of flocks) {
    const f = sky.flocks.get(fl.id);
    // over the body of the flock, where the eye finds it
    const h = f.puffs[Math.min(3, f.puffs.length - 1)];
    v.set(h.x, h.y + h.r * 0.6 + 1.5, h.z).project(view.camera);
    if (v.z > 1) continue;
    tags.push({
      x: (v.x * 0.5 + 0.5) * ctx.W,
      y: (-v.y * 0.5 + 0.5) * ctx.H,
      n: f.n,
      slot: fl.slot,
      size: opts.size ?? 44,
      alpha: 1,
      kind: 'prey',
      name: opts.names ? fl.name : '',
      me: false,
    });
  }
  hud.draw(0, { tags, layout: { hintY: 0 }, why: false });
}

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function fonts() {
  await Promise.race([
    Promise.all([document.fonts.load('900 40px "Big Shoulders Display"'), document.fonts.load('800 40px "Bricolage Grotesque"')]).catch(() => {}),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  await document.fonts.ready;
}

// ------------------------------------------------------------------ the posters

const POSTERS = {
  // two murmurations colliding in front of the setting sun, the smaller one slicing the bigger one's tail
  cover(ctx) {
    const T = 4.4;
    const flocks = [
      { id: 'pa', slot: 0, n: 430, name: 'Cobalt', path: flight({ x: -16, z: 26, yaw: Math.PI / 2 + 0.5, T, turn: 0.16, y: 57 }) },
      { id: 'pb', slot: 1, n: 240, name: 'Vermilion', path: flight({ x: -36, z: 16, yaw: -Math.PI / 2 - 0.3, T, speed: 15, turn: -0.1, y: (t) => 58 + t * 0.3 }) },
    ];
    const { sky, world, lead } = stage(ctx, { flocks, T, steal: true, cam: [14, 61, 22], look: [-86, 50, 22], fov: 50 });
    ctx.birds.setLeaders(lead);
    light(ctx, world, 0.45, new THREE.Vector3(-20, 56, 20));
    ctx.view.render();
    tagsFor(ctx, sky, flocks, { size: 58 });
    const name = document.createElement('div');
    name.className = 'poster-name';
    for (const word of ['Birds', 'of a', 'Feather']) {
      const sp = document.createElement('span');
      sp.textContent = word;
      name.appendChild(sp);
    }
    document.getElementById('ui').appendChild(name);
  },

  // the hawk mid-stoop into a flock, birds bursting
  action(ctx) {
    const T = 3.6;
    const H = { x: 30, y: 60, z: -70 };
    const flocks = [{ id: 'pa', slot: 2, n: 340, path: flight({ x: H.x, z: H.z, yaw: 0.1, T, turn: 0.12, y: H.y }) }];
    let aim = null;
    const { world, lead } = stage(ctx, {
      flocks,
      T,
      cam: [H.x - 12, H.y + 12, H.z + 26],
      look: [H.x - 2, H.y - 2, H.z],
      fov: 55,
      after: (sky) => {
        const f = sky.flocks.get('pa');
        const head = f.puffs[1];
        aim = { x: head.x, y: head.y, z: head.z };
        sky.strike(aim, f);
        ctx.birds.push(sky.drainEvents());
        for (let k = 0; k < 8; k++) ctx.birds.update(DT, sky, ctx.view.camera, null, null);
        ctx.fx.burst(aim.x, aim.y + 1, aim.z, 40, PALETTE.ash, 9);
        ctx.fx.burst(aim.x, aim.y + 1, aim.z, 24, SLOTS[2].hex, 8);
        ctx.fx.update(0.25, { glow: 0 }, ctx.view.scene);
      },
    });
    // the hawk, wings half folded, stooping through the flock
    ctx.birds.setHawk({ x: aim.x - 2, y: aim.y + 4.5, z: aim.z + 5, yaw: -0.9, pitch: -0.75, bank: 0.25, scale: 9, flap: 0, fold: 0.55, phase: 0.35, color: HAWK_EDGE });
    ctx.birds.setLeaders(lead);
    light(ctx, world, 0.5, new THREE.Vector3(aim.x, aim.y, aim.z));
    ctx.view.render();
  },

  // your flock on the top wire at sundown, the others below in order
  win(ctx) {
    const T = 2;
    const r = ctx.sky0.roost;
    const names = ['You', 'Kestrel', 'Magpie', 'Swift', 'Plover', 'Gull'];
    const counts = [412, 306, 228, 171, 118, 64];
    const slots = [0, 7, 1, 2, 3, 4];
    const flocks = counts.map((n, k) => ({
      id: `p${k}`,
      slot: slots[k],
      n,
      name: names[k],
      path: flight({ x: r.x + 20 + k * 4, z: r.z - 20 + k * 8, yaw: Math.PI, T, turn: 0.2, y: r.look[1] + 4 }),
    }));
    let assign = null;
    const dir = new THREE.Vector3(r.camera[0] - r.look[0], 0, r.camera[2] - r.look[2]).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const camAt = new THREE.Vector3(r.look[0], r.look[1] - 3, r.look[2]).addScaledVector(dir, 22).addScaledVector(side, 14);
    const lookAt = new THREE.Vector3(r.look[0], r.look[1] + 1, r.look[2]).addScaledVector(side, -6);
    const { sky, world } = stage(ctx, {
      flocks,
      T,
      cam: camAt.toArray(),
      look: lookAt.toArray(),
      fov: 55,
      after: (sky) => {
        sky.sundown();
        assign = new Map(sky.standings.map((s, k) => [s.id, k]));
        ctx.birds.setRoost(r, assign);
        for (let k = 0; k < 420; k++) ctx.birds.update(DT, sky, ctx.view.camera, null, null);
      },
    });
    const cam = ctx.view.camera;
    const perched = [];
    for (const s of sky.standings) {
      const w = r.wires[assign.get(s.id)];
      const p = wirePoint(w, 0.03);
      const yaw = Math.atan2(dir.z, dir.x);
      perched.push({ x: p[0], y: p[1] + 0.3, z: p[2], yaw, color: new THREE.Color(SLOTS[s.slot].hex), scale: 2.4, flap: -1, phase: perched.length });
    }
    ctx.birds.setLeaders(perched);
    const top = r.wires[0];
    const mid = (a, b, u) => a + (b - a) * u;
    ctx.fx.shower(mid(top.ax, top.bx, 0.35), top.ay, mid(top.az, top.bz, 0.35), mid(top.ax, top.bx, 0.75), top.by, mid(top.az, top.bz, 0.75), 60, SLOTS[slots[0]].hex);
    ctx.fx.update(1.2, { glow: 1 }, ctx.view.scene);
    light(ctx, world, 0.96, new THREE.Vector3(r.x, r.look[1], r.z));
    ctx.view.render();
    // the labels at the head of every wire
    const v = new THREE.Vector3();
    const labels = sky.standings.map((s, k) => {
      const p = wirePoint(r.wires[assign.get(s.id)], 0.06);
      v.set(p[0], p[1] + 0.7, p[2]).project(cam);
      return { x: Math.min(ctx.W - 230, Math.max(40, (v.x * 0.5 + 0.5) * ctx.W)), y: (-v.y * 0.5 + 0.5) * ctx.H, place: k + 1, slot: s.slot, name: s.name, n: s.n, me: s.name === 'You', alpha: 1 };
    });
    ctx.hud.draw(0, { labels, layout: { hintY: 0 }, why: false });
  },

  // the game as it plays: the high camera over the town, my flock cutting the tail of a bigger one, a rare bird in its light,
  // the counts, the chorus and the callouts
  multi(ctx) {
    const T = 4.2;
    const map = ctx.sky0;
    const b = Number.isFinite(map.look.bearing) ? map.look.bearing : Math.PI + 0.32 + Math.PI / 4;
    const fwd = new THREE.Vector3(Math.cos(b), 0, Math.sin(b));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const C = { x: 4, z: -2 };
    const at = (u, v) => ({ x: C.x + fwd.x * u + right.x * v, z: C.z + fwd.z * u + right.z * v });
    const yawOf = (du, dv) => Math.atan2(fwd.z * du + right.z * dv, fwd.x * du + right.x * dv);
    const me = at(-2, -6);
    const rival = at(10, 6);
    const third = at(30, -34);
    const flocks = [
      { id: 'pme', slot: 0, n: 296, species: 4, trail: 4, path: flight({ x: me.x, z: me.z, yaw: yawOf(1, 0.5), T, turn: -0.1, y: 47 }) },
      { id: 'pr', slot: 1, n: 352, name: 'Gull', path: flight({ x: rival.x, z: rival.z, yaw: yawOf(-0.15, 1), T, turn: 0.12, y: 50 }) },
      { id: 'p3', slot: 2, n: 118, name: 'Swift', path: flight({ x: third.x, z: third.z, yaw: yawOf(0.6, -1), T, turn: 0.2, y: 45 }) },
    ];
    const head = flocks[0].path(T);
    const D = 50 + 1.75 * Math.sqrt(296);
    const pitch = (54 * Math.PI) / 180;
    const look = new THREE.Vector3(head.x + fwd.x * 10 + right.x * 6, head.y - 3, head.z + fwd.z * 10 + right.z * 6);
    const cam = look.clone().addScaledVector(fwd, -Math.cos(pitch) * D).setY(look.y + Math.sin(pitch) * D);
    const { sky, world, lead } = stage(ctx, { flocks, T, steal: true, cam: cam.toArray(), look: look.toArray(), fov: 44, leadScale: 7.2 });
    // a rare bird on the nearest landmark, in its column of light
    const v = new THREE.Vector3();
    let rare = null;
    let best = Infinity;
    for (const r of sky.rares ?? []) {
      v.set(r.x, r.y, r.z).project(ctx.view.camera);
      const d = Math.hypot(v.x - 0.45, v.y + 0.4);
      if (v.z < 1 && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8 && d < best) {
        best = d;
        rare = r;
      }
    }
    if (rare) {
      lead.push({ x: rare.x, y: rare.y + 0.3, z: rare.z, yaw: 2.4, color: new THREE.Color('#FFB547'), scale: 4.6, flap: -1, phase: 1, species: rare.species, flair: 0 });
      ctx.fx.setRares([{ x: rare.x, y: rare.y, z: rare.z, color: PALETTE.gold }]);
    }
    ctx.birds.setLeaders(lead);
    light(ctx, world, 0.38, look);
    ctx.view.render();
    // the HUD: counts, my chorus, two callouts, the board and the sun clock
    const mine = sky.flocks.get('pme');
    const tags = [];
    for (const fl of flocks) {
      const f = sky.flocks.get(fl.id);
      const h = fl.id === 'pme' ? head : f.puffs[0];
      v.set(h.x, h.y + (fl.id === 'pme' ? 5.2 : (f.puffs[0].r || 2) + 2), h.z).project(ctx.view.camera);
      tags.push({ x: (v.x * 0.5 + 0.5) * ctx.W, y: (-v.y * 0.5 + 0.5) * ctx.H - (fl.id === 'pme' ? 12 : 0), n: f.n, slot: fl.slot, size: fl.id === 'pme' ? 48 : 38, alpha: 1, kind: fl.id === 'pme' ? 'me' : f.n > mine.n * 1.15 ? 'danger' : 'prey', name: fl.id === 'pme' ? '' : fl.name, me: fl.id === 'pme' });
    }
    const rares = [];
    if (rare) {
      v.set(rare.x, rare.y + 2.5, rare.z).project(ctx.view.camera);
      rares.push({ x: (v.x * 0.5 + 0.5) * ctx.W, y: (-v.y * 0.5 + 0.5) * ctx.H, name: SPECIES[rare.species].name, color: PALETTE.gold, alpha: 1 });
    }
    ctx.hud.addCallout({ title: 'Chorus ×4', song: 24, color: PALETTE.gold, size: 34 });
    ctx.hud.addCallout({ title: 'Tail cut', song: 50, color: PALETTE.cream, size: 38 });
    const standings = [...sky.flocks.values()].sort((a, c) => c.n - a.n);
    const names = { pme: 'You', pr: 'Gull', p3: 'Swift' };
    const board = standings.map((f, k) => ({ place: k + 1, slot: f.slot, name: names[f.id], n: f.n, me: f.id === 'pme' }));
    board.push({ place: 4, slot: 3, name: 'Plover', n: 64, me: false }, { place: 5, slot: 4, name: 'Shrike', n: 41, me: false });
    const layout = { clockX: ctx.W / 2, top: 10, boardW: 240, right: ctx.W - 14, boardTop: 8, rows: 5, hintY: 0 };
    ctx.hud.draw(0.32, { tags, rares, chorus: { chain: 4, left: 0.8 }, board, clock: { share: 0.38, left: 112, sunColor: '#FFD79A', label: '' }, layout, why: false });
  },

  // one flock curling behind its lead bird against the sun's disc
  icon(ctx) {
    const T = 4.5;
    const flocks = [{ id: 'pa', slot: 0, n: 300, path: flight({ x: -120, z: 40, yaw: -1.2, T, speed: 14, turn: 1.5, y: 80 }) }];
    const { sky, world, lead } = stage(ctx, { flocks, T, cam: [0, 90, 0], look: [-120, 80, 40], fov: 36 });
    ctx.view.skyUniforms.discCos.value = 0.99;
    ctx.birds.setLeaders(lead);
    // the camera on the line through the flock to the sun
    light(ctx, world, 0.45, new THREE.Vector3(-120, 80, 40));
    const sun = ctx.view.light.sunDir;
    const c = ctx.view.camera;
    const f = sky.flocks.get('pa');
    const mid = f.puffs[2];
    c.position.set(mid.x - sun.x * 54, mid.y - sun.y * 54, mid.z - sun.z * 54);
    c.lookAt(mid.x, mid.y, mid.z);
    c.updateMatrixWorld();
    light(ctx, world, 0.45, new THREE.Vector3(mid.x, mid.y, mid.z));
    if (ctx.view.bloom) ctx.view.bloom.strength = 0;
    ctx.view.render();
  },
};

// ------------------------------------------------------------------ badges: a bold symbol on a coloured disc

const BIRD = (g, x, y, s, color = PALETTE.ink) => {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(-1, -0.15);
  g.quadraticCurveTo(-0.5, -0.65, 0, 0.05);
  g.quadraticCurveTo(0.5, -0.65, 1, -0.15);
  g.quadraticCurveTo(0.5, -0.35, 0, 0.3);
  g.quadraticCurveTo(-0.5, -0.35, -1, -0.15);
  g.fillStyle = color;
  g.fill();
  g.restore();
};

const BADGES = {
  'first-flock': [PALETTE.gold, (g) => {
    wireLine(g);
    for (let k = 0; k < 5; k++) perched(g, -56 + k * 28, 6 + Math.sin((k / 4) * Math.PI) * 10);
  }],
  'hundred-birds': [SLOTS[0].hex, (g) => {
    const V = [[0, -46], [-30, -20], [30, -20], [-60, 6], [60, 6], [-88, 32], [88, 32]];
    for (const [x, y] of V) BIRD(g, x, y + 10, 24, PALETTE.cream);
  }],
  murmuration: [PALETTE.teal, (g) => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 420; k++) {
      const a = rnd() * Math.PI * 2;
      const cx = Math.cos(a) * 72;
      const cy = Math.sin(a * 2) * 30 - Math.cos(a) * 10;
      const spread = 6 + 12 * (0.5 + 0.5 * Math.sin(a * 3 + 1));
      const r = Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * spread * 0.5;
      const b = rnd() * Math.PI * 2;
      g.fillStyle = PALETTE.cream;
      g.beginPath();
      g.arc(cx + Math.cos(b) * r, cy + Math.sin(b) * r * 0.8, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }],
  'tail-cutter': [SLOTS[1].hex, (g) => {
    for (let k = 0; k < 6; k++) BIRD(g, -78 + k * 30, -44 + k * 18, 15, k >= 4 ? PALETTE.gold : PALETTE.cream);
    g.strokeStyle = PALETTE.ink;
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 80);
    g.lineTo(62, -70);
    g.stroke();
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = 6;
    g.stroke();
  }],
  'hawk-dodger': [PALETTE.ember, (g) => {
    hawk(g, 0, -34, 44);
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = 11;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, 4, 62, Math.PI * 0.95, Math.PI * 0.2, true);
    g.stroke();
    // the arrowhead
    const a = Math.PI * 0.2;
    const x = Math.cos(a) * 62;
    const y = 4 + Math.sin(a) * 62;
    g.fillStyle = PALETTE.cream;
    g.beginPath();
    g.moveTo(x + 22, y - 18);
    g.lineTo(x - 6, y - 26);
    g.lineTo(x + 6, y + 8);
    g.closePath();
    g.fill();
  }],
  'sundown-king': [PALETTE.rose, (g) => {
    g.fillStyle = PALETTE.gold;
    g.beginPath();
    g.arc(0, 18, 50, Math.PI, 0);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = PALETTE.ink;
    g.stroke();
    g.fillRect(-80, 16, 160, 8);
    g.fillStyle = PALETTE.ink;
    g.fillRect(-84, 18, 168, 6);
    for (let k = 0; k < 3; k++) BIRD(g, -26 + k * 26, -50 - (k === 1 ? 10 : 0), 13);
  }],
  'thermal-rider': [PALETTE.terracotta, (g) => {
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k <= 80; k++) {
      const u = k / 80;
      const a = u * Math.PI * 6;
      const x = Math.cos(a) * (14 + u * 40);
      const y = 70 - u * 130 + Math.sin(a) * 9;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    BIRD(g, 34, -66, 16, PALETTE.ink);
  }],
  migration: [SLOTS[10].hex, (g) => {
    g.setLineDash([2, 13]);
    g.lineCap = 'round';
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(-74, 50);
    g.bezierCurveTo(-30, -60, 20, 70, 70, -40);
    g.stroke();
    g.setLineDash([]);
    for (const [x, y] of [[-74, 50], [-20, 6], [26, 18], [70, -40]]) {
      g.fillStyle = PALETTE.gold;
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = PALETTE.ink;
      g.stroke();
    }
    BIRD(g, 52, -70, 15);
  }],
  'twelve-feathers': [PALETTE.gold, (g) => {
    for (const k of [-1, 1, 0]) {
      g.save();
      g.translate(0, 74);
      g.rotate(k * 0.5);
      g.translate(0, -74);
      feather(g, 0, -4, k === 0 ? 0.95 : 0.8);
      g.restore();
    }
  }],
};

Object.assign(BADGES, {
  // six gathers, one after another: birds rising like a run of notes
  'full-chorus': [SLOTS[8].hex, (g) => {
    g.strokeStyle = PALETTE.cream;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.setLineDash([2, 11]);
    g.beginPath();
    g.moveTo(-86, 58);
    g.quadraticCurveTo(-10, 40, 74, -62);
    g.stroke();
    g.setLineDash([]);
    for (let k = 0; k < 6; k++) {
      const u = k / 5;
      BIRD(g, -84 + u * 156, 46 - u * 104 - Math.sin(u * Math.PI) * 14, 13 + k * 2.4, k === 5 ? PALETTE.gold : PALETTE.cream);
    }
  }],
  // a bird on its landmark, in its own column of light
  'rare-bird': [PALETTE.teal, (g) => {
    const beam = g.createLinearGradient(0, -110, 0, 60);
    beam.addColorStop(0, 'rgba(255,241,220,0)');
    beam.addColorStop(1, 'rgba(255,241,220,0.55)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(-26, 60);
    g.lineTo(-44, -110);
    g.lineTo(44, -110);
    g.lineTo(26, 60);
    g.fill();
    g.fillStyle = PALETTE.ink;
    g.beginPath();
    g.moveTo(-58, 96);
    g.lineTo(-34, 54);
    g.lineTo(30, 50);
    g.lineTo(60, 96);
    g.fill();
    perched(g, 0, 52, 1.6, PALETTE.gold);
    star(g, 46, -48, 16, PALETTE.cream);
    star(g, -50, -18, 9, PALETTE.cream);
  }],
  // wings flung wide in gold against a burst of rays
  legendary: [SLOTS[4].hex, (g) => {
    g.fillStyle = 'rgba(255,241,220,0.32)';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 4);
      g.lineTo(Math.cos(a - 0.12) * 130, 4 + Math.sin(a - 0.12) * 130);
      g.lineTo(Math.cos(a + 0.12) * 130, 4 + Math.sin(a + 0.12) * 130);
      g.fill();
    }
    g.save();
    g.lineWidth = 0.16;
    g.lineJoin = 'round';
    g.translate(0, 16);
    g.scale(80, 80);
    g.beginPath();
    g.moveTo(-1, -0.15);
    g.quadraticCurveTo(-0.5, -0.65, 0, 0.05);
    g.quadraticCurveTo(0.5, -0.65, 1, -0.15);
    g.quadraticCurveTo(0.5, -0.35, 0, 0.3);
    g.quadraticCurveTo(-0.5, -0.35, -1, -0.15);
    g.strokeStyle = PALETTE.ink;
    g.stroke();
    g.fillStyle = PALETTE.gold;
    g.fill();
    g.restore();
  }],
  // a full perch: twelve birds in rows, each its own colour
  'aviary-12': [PALETTE.terracotta, (g) => {
    const cols = [PALETTE.cream, PALETTE.gold, SLOTS[5].hex, SLOTS[2].hex];
    for (let r = 0; r < 3; r++) {
      g.strokeStyle = PALETTE.ink;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-96, -36 + r * 52);
      g.lineTo(96, -36 + r * 52);
      g.stroke();
      for (let c = 0; c < 4; c++) perched(g, -63 + c * 42, -36 + r * 52, 0.95, cols[(r + c) % 4]);
    }
  }],
  // ten, over a full bar
  'level-ten': [SLOTS[0].hex, (g) => {
    g.font = '900 150px "Big Shoulders Display", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16;
    g.strokeStyle = PALETTE.ink;
    g.strokeText('10', 0, -14);
    g.fillStyle = PALETTE.cream;
    g.fillText('10', 0, -14);
    g.fillStyle = PALETTE.ink;
    g.fillRect(-76, 56, 152, 24);
    g.fillStyle = PALETTE.gold;
    g.fillRect(-70, 61, 140, 14);
  }],
  // seven suns in a row, a day each
  'seven-days': [PALETTE.rose, (g) => {
    g.fillStyle = PALETTE.ink;
    g.fillRect(-120, 40, 240, 80);
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (0.92 - (k / 6) * 0.84);
      const x = Math.cos(a) * 84;
      const y = 40 - Math.sin(a) * 84;
      g.beginPath();
      g.arc(x, y, 11 + (k === 6 ? 6 : 0), 0, Math.PI * 2);
      g.fillStyle = PALETTE.gold;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = PALETTE.ink;
      g.stroke();
    }
    BIRD(g, 0, -6, 18, PALETTE.cream);
  }],
  // the sun half down, the same one for everyone
  'daily-sunset': [PALETTE.ember, (g) => {
    g.save();
    g.beginPath();
    g.rect(-130, -130, 260, 150);
    g.clip();
    g.beginPath();
    g.arc(0, 20, 66, 0, Math.PI * 2);
    g.fillStyle = PALETTE.gold;
    g.fill();
    g.fillStyle = PALETTE.ember;
    for (let k = 0; k < 4; k++) g.fillRect(-80, 20 - 12 - k * 15, 160, 4 + k * 0.5);
    g.restore();
    g.fillStyle = PALETTE.ink;
    g.fillRect(-130, 20, 260, 110);
    BIRD(g, -46, -70, 16, PALETTE.ink);
    BIRD(g, -12, -86, 12, PALETTE.ink);
    BIRD(g, 22, -66, 14, PALETTE.ink);
  }],
});

function star(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 ? r * 0.32 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function wireLine(g) {
  g.strokeStyle = PALETTE.ink;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(-110, 10);
  g.quadraticCurveTo(0, 50, 110, 10);
  g.stroke();
}

function perched(g, x, y, k = 1, color = PALETTE.ink) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.translate(-x, -y);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y - 14, 10, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x + 3, y - 30, 7, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x + 9, y - 31);
  g.lineTo(x + 16, y - 29);
  g.lineTo(x + 9, y - 27);
  g.fill();
  g.beginPath();
  g.moveTo(x - 6, y - 4);
  g.lineTo(x - 14, y + 8);
  g.lineTo(x - 2, y - 2);
  g.fill();
  if (color !== PALETTE.ink) {
    g.lineWidth = 2.5 / k;
    g.strokeStyle = PALETTE.ink;
    g.beginPath();
    g.ellipse(x, y - 14, 10, 14, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x + 3, y - 30, 7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = PALETTE.ink;
    g.beginPath();
    g.arc(x + 5, y - 31, 1.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function hawk(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.fillStyle = PALETTE.ink;
  g.beginPath();
  g.moveTo(-s * 1.6, -s * 0.1);
  g.quadraticCurveTo(-s * 0.7, -s * 0.8, 0, -s * 0.1);
  g.quadraticCurveTo(s * 0.7, -s * 0.8, s * 1.6, -s * 0.1);
  g.lineTo(s * 0.35, s * 0.3);
  g.lineTo(0, s * 0.95);
  g.lineTo(-s * 0.35, s * 0.3);
  g.closePath();
  g.fill();
  g.restore();
}

function feather(g, x, y, k) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.beginPath();
  g.moveTo(0, -78);
  g.quadraticCurveTo(34, -20, 6, 70);
  g.lineTo(-6, 70);
  g.quadraticCurveTo(-34, -20, 0, -78);
  g.fillStyle = PALETTE.cream;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = PALETTE.ink;
  g.stroke();
  g.beginPath();
  g.moveTo(0, -66);
  g.lineTo(0, 84);
  g.stroke();
  g.restore();
}

function drawBadge(id, W, H) {
  const def = BADGES[id] ?? [PALETTE.gold, () => {}];
  const c = document.getElementById('hud');
  c.width = W;
  c.height = H;
  c.style.width = `${W}px`;
  c.style.height = `${H}px`;
  document.getElementById('gl').style.display = 'none';
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.ink;
  g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2);
  const R = W * 0.46;
  // the disc, with a darker rim
  g.fillStyle = def[0];
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(35,26,46,0.35)';
  g.beginPath();
  g.arc(0, 0, R - 8, 0, Math.PI * 2);
  g.stroke();
  g.save();
  g.beginPath();
  g.arc(0, 0, R - 12, 0, Math.PI * 2);
  g.clip();
  g.scale(W / 256, W / 256);
  def[1](g);
  g.restore();
  void symbolPath;
}

export async function renderPoster(name) {
  // the same picture every time: the effects' randomness from a fixed seed
  let seed = 20261101;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const W = window.innerWidth;
  const H = window.innerHeight;
  document.getElementById('boot')?.remove();
  document.body.style.background = PALETTE.ink;
  await fonts();
  if (name.startsWith('badge-')) {
    drawBadge(name.slice(6), W, H);
  } else {
    const fn = POSTERS[name] ?? POSTERS.cover;
    const ctx = setup(W, H);
    const { getMap } = await import('./sim/maps.js');
    ctx.sky0 = getMap('saltmere');
    const style = document.createElement('style');
    style.textContent = `.poster-name{position:absolute;left:0;right:0;bottom:7%;text-align:center;font:800 118px/0.9 var(--txt);letter-spacing:-0.025em;color:var(--cream);-webkit-text-stroke:0.11em var(--ink);paint-order:stroke fill;filter:drop-shadow(0 6px 0 var(--ink))}.poster-name span{margin:0 0.12em}.poster-name span:nth-child(2){font-size:0.62em;color:var(--gold)}`;
    document.head.appendChild(style);
    fn(ctx);
  }
  await tick();
  document.body.dataset.ready = '1';
}
