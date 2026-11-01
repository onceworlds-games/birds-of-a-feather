// The game: joins the room (or flies alone off the platform), runs the screens (the title, the sky and its nights, Migration),
// flies the player's lead bird, and draws the world, the birds, the HUD and the signs every frame.

import * as THREE from 'three';
import { View } from './render/view.js';
import { buildWorld } from './render/world.js';
import { Birds } from './render/birds.js';
import { Fx } from './render/fx.js';
import { phaseAt } from './render/look.js';
import { Hud } from './hud.js';
import { Screens, ordinal } from './screens.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Net, stubRoom } from './net.js';
import { Autopilot } from './autoplay.js';
import { newLeader, stepLeader } from './sim/flight.js';
import { Trail, newPuffs, shapeOf } from './sim/flock.js';
import { FLIGHT, FLOCK, ROUND, SLOTS, PALETTE, JOIN, SKILLS, HAWK } from './sim/config.js';
import { PLACES, MIGRATION_DAY, placeSky, feathersFor, unlocked, totalFeathers } from './sim/migration.js';
import { getMap, surfaceAt, wirePoint } from './sim/maps.js';
import { readPresence, cleanName } from './sim/wire.js';
import { clamp, angleDiff } from './sim/rng.js';

const ow = window.onceworlds ?? null;
const params = new URLSearchParams(location.search);
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost');
const AUTO = LOCAL && params.get('autoplay') === '1';
const SAVE_KEY = 'birds-of-a-feather:profile';

/** Read the SDK without ever throwing into the game. */
function sdk(fn, fallback) {
  if (!ow) return fallback;
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
async function sdkAsync(fn, fallback = null) {
  if (!ow) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
const quality = () => {
  const q = sdk(() => ow.settings.quality, 'medium');
  return ['low', 'medium', 'high'].includes(q) ? q : 'medium';
};
const reducedMotion = () => sdk(() => !!ow.settings.reducedMotion, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
const pixelRatio = () => sdk(() => ow.settings.pixelRatio(2), Math.min(window.devicePixelRatio || 1, 2));
const touch = () => sdk(() => !!ow.controls.touch, false);

// ------------------------------------------------------------------ the pieces

const canvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const uiRoot = document.getElementById('ui');

const view = new View(canvas, { quality: quality(), pixelRatio: pixelRatio() });
const { scene, camera } = view;
const birds = new Birds(scene);
const fx = new Fx(scene);
fx.setQuality(view.quality);
const hud = new Hud(hudCanvas);
const audio = new Audio();
const screens = new Screens(uiRoot, audio);
const input = new Input(canvas, ow);
const autopilot = AUTO ? new Autopilot('hunter') : null;

let world = null;
function setWorld(mapId) {
  if (world && world.map.id === mapId) return;
  if (world) {
    scene.remove(world.group);
    world.dispose();
  }
  world = buildWorld(getMap(mapId), view.quality);
  scene.add(world.group);
  setBearing(world.map);
}

// ------------------------------------------------------------------ the profile (ow.save)

const PROFILE0 = () => ({ v: 1, best: 0, biggest: 0, sunsets: 0, wins: 0, gathered: 0, stolen: 0, feathers: [0, 0, 0, 0], skill: 'normal', hints: [] });
let profile = PROFILE0();

function cleanProfile(p) {
  const o = PROFILE0();
  if (!p || typeof p !== 'object') return o;
  for (const k of ['best', 'biggest', 'sunsets', 'wins', 'gathered', 'stolen']) if (Number.isFinite(p[k]) && p[k] >= 0) o[k] = Math.floor(Math.min(p[k], 1e9));
  if (Array.isArray(p.feathers)) o.feathers = [0, 1, 2, 3].map((i) => (Number.isInteger(p.feathers[i]) ? clamp(p.feathers[i], 0, 3) : 0));
  if (SKILLS.includes(p.skill)) o.skill = p.skill;
  if (Array.isArray(p.hints)) o.hints = p.hints.filter((h) => typeof h === 'string' && h.length < 20).slice(0, 30);
  return o;
}

async function loadProfile() {
  let raw = null;
  if (ow?.save) raw = await sdkAsync(() => ow.save.get('profile'));
  else {
    try {
      raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    } catch {
      raw = null;
    }
  }
  return cleanProfile(raw);
}

function saveProfile() {
  if (AUTO) return;
  if (ow?.save) sdkAsync(() => ow.save.set('profile', profile));
  else {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
    } catch {
      /* private window */
    }
  }
}

/** What the player flies as: the lead bird's species, the trail behind it and the flock's flair. */
const equipped = { species: 0, trail: 0, flair: 0 };

const awarded = new Set();
function award(id) {
  if (AUTO || awarded.has(id)) return;
  awarded.add(id);
  sdkAsync(() => ow.badges.award(id));
}
function submit(board, value) {
  if (AUTO || !(value > 0)) return;
  sdkAsync(() => ow.leaderboards.submit(board, value));
}

// ------------------------------------------------------------------ the room

let room = null;
let net = null;
let ffOffset = 0; // the trailer's fast-forward (autoplay only)
const now = () => sdk(() => ow.now(), Date.now()) + ffOffset;

function makeNet(r) {
  net?.dispose();
  net = new Net(r, {
    now,
    on: {
      events: (list) => {
        if (!S.mig) onEvents(list, net.sky);
      },
      spawn: (f) => {
        // a new sunset: this page's bird starts again at its spawn
        if (me.L && !S.mig && (S.mode === 'sky' || S.mode === 'takeoff')) placeLeader(f.spawn.x, f.spawn.z, f.spawn.yaw, f.spawn.y, net.sky.map);
      },
      dawn: () => {
        if (!S.mig) newSunsetView();
      },
    },
  });
  net.setSkill(profile.skill);
  birds.reset();
}

async function joinRoom() {
  if (!ow?.rooms) {
    room = stubRoom('You');
    makeNet(room);
    return true;
  }
  try {
    const r = await ow.rooms.join({ maxPlayers: JOIN.maxPlayers });
    room = r;
    makeNet(r);
    r.on('close', (reason) => onClose(reason));
    r.on('join', () => onPlayersChanged());
    r.on('leave', () => onPlayersChanged());
    return true;
  } catch {
    return false;
  }
}

function onClose(reason) {
  if (reason === 'left' || reason === 'moved') return;
  const text = reason === 'kicked' ? 'You were removed' : reason === 'replaced' ? 'Playing in another tab' : 'Connection lost';
  const button = reason === 'kicked' ? 'Play' : reason === 'replaced' ? 'Play here' : 'Rejoin';
  closeRoom(text, button);
}

function closeRoom(text, button) {
  endMigration();
  me.L = null;
  setMode('closed');
  controls(false);
  // the title's view carries on with a sky of our own until the player rejoins
  room = stubRoom('You');
  makeNet(room);
  screens.notice({ text, button, onClick: rejoin });
}

async function rejoin() {
  screens.clear();
  const ok = await joinRoom();
  if (!ok) {
    closeRoom('Connection lost', 'Rejoin');
    return;
  }
  fly();
}

// ------------------------------------------------------------------ state

const S = {
  mode: 'boot', // boot | title | takeoff | sky | route | intro | mig | migresult | notice | closed
  t: 0,
  mig: null, // { index, sky, seed, endedAt }
  paused: false,
  nightRid: -1, // the sunset whose night is on screen
  nightAt: 0,
  nightShown: false,
  nightResults: false,
  alone: true,
  flyT: 0, // seconds flying this sunset
  sunset: null, // what happened to me this sunset
  hintAt: -99,
  lastGather: 0,
  trauma: 0,
  slowmo: 0,
  lastLeft: 999,
  hawkPhase: 'wait',
  hawkTarget: null,
  nightBest: false,
  nightWon: false,
  roostMap: null,
  stormHintAt: -99,
  shakeDir: { x: 0, z: 0 },
};

function newSunsetStats() {
  return { gathered: 0, stolen: 0, rides: 0, maxN: 8, peak: 0 };
}
S.sunset = newSunsetStats();

function setMode(m) {
  S.mode = m;
  S.t = 0;
}

// ------------------------------------------------------------------ my own lead bird

const me = {
  L: null,
  trail: new Trail(),
  puffs: newPuffs(),
  t: 0,
  acc: 0,
  fev: [],
  n: 8,
  stick: { turn: 0, climb: 0, boost: false },
};
const STEP = 1 / 60;
let titleLeader = null;

function placeLeader(x, z, yaw, y, map) {
  me.L = newLeader(x, z, yaw, map);
  if (Number.isFinite(y)) me.L.y = Math.max(y, surfaceAt(map, x, z) + FLIGHT.floor);
  me.t = 0;
  me.acc = 0;
  me.trail.reset(0, me.L.x, me.L.y, me.L.z);
  shapeOf(me.trail, me.n, me.t, me.puffs);
}

function activeSky() {
  return S.mig ? S.mig.sky : net.sky;
}
function myId() {
  return S.mig ? 'pme' : net.myId;
}
function myFlock() {
  return activeSky().flocks.get(myId()) ?? null;
}
function flying() {
  return !!me.L && (S.mode === 'sky' || S.mode === 'takeoff' || (S.mode === 'mig' && !S.paused));
}
function status() {
  if (S.mig || S.mode === 'route' || S.mode === 'intro' || S.mode === 'migresult') return 'mig';
  if (me.L && (S.mode === 'sky' || S.mode === 'takeoff')) return 'fly';
  return 'title';
}

/** Steering for this frame: the autopilot, the night's glide home, or the player. */
function steer(dt, sky) {
  const L = me.L;
  if (sky.phase === 'night') {
    const r = sky.map.roost;
    const want = Math.atan2(r.z - L.z, r.x - L.x);
    const d = Math.hypot(r.x - L.x, r.z - L.z);
    me.stick.turn = clamp(angleDiff(L.yaw, want) / 0.5, -1, 1) * (d > 30 ? 1 : 0.6);
    me.stick.climb = 0;
    me.stick.boost = false;
    return me.stick;
  }
  if (S.mode === 'takeoff' && S.t < 0.5) {
    me.stick.turn = 0;
    me.stick.climb = 0;
    me.stick.boost = false;
    return me.stick;
  }
  if (autopilot) {
    const f = sky.flocks.get(myId());
    const a = autopilot.input(sky, f, L);
    me.stick.turn = a.turn;
    me.stick.climb = 0;
    me.stick.boost = a.boost;
    return me.stick;
  }
  // point where to fly: the cursor's spot on the bird's level, or a direction on screen from the keys or the stick
  const s = input.read(dt);
  let want = null;
  if (s.has) {
    if (s.mouse) {
      if (screenToLevel(s.sx, s.sy, L.y, gpt)) {
        const dx = gpt.x - L.x;
        const dz = gpt.z - L.z;
        if (dx * dx + dz * dz > 6) want = Math.atan2(dz, dx);
      }
    } else {
      const wx = camRight.x * s.sx - camFwd.x * s.sy;
      const wz = camRight.z * s.sx - camFwd.z * s.sy;
      want = Math.atan2(wz, wx);
    }
  }
  me.stick.turn = want === null ? 0 : clamp(angleDiff(L.yaw, want) / 0.32, -1, 1);
  me.stick.climb = 0;
  me.stick.boost = s.boost;
  return me.stick;
}

function flyOwn(dt, sky) {
  const stick = steer(dt, sky);
  const map = sky.map;
  me.acc += dt;
  let steps = 0;
  while (me.acc >= STEP && steps < 8) {
    me.acc -= STEP;
    steps++;
    me.fev.length = 0;
    stepLeader(me.L, stick, STEP, map, me.fev, me.n);
    me.t += STEP;
    me.trail.push(me.t, me.L.x, me.L.y, me.L.z);
    for (const e of me.fev) {
      if (e === 'boost') {
        audio.boost();
        if (!reducedMotion()) S.trauma = Math.max(S.trauma, 0.12);
      } else if (e === 'thermal-in') audio.thermal();
      else if (e === 'ride') {
        S.sunset.rides++;
        if (S.sunset.rides >= 5) award('thermal-rider');
      }
    }
  }
  if (me.acc > STEP * 8) me.acc = 0;
  shapeOf(me.trail, me.n, me.t, me.puffs);
}

// ------------------------------------------------------------------ the camera

const cam = {
  pos: new THREE.Vector3(150, 30, -20),
  look: new THREE.Vector3(0, 10, 0),
  wantPos: new THREE.Vector3(),
  wantLook: new THREE.Vector3(),
  fromPos: new THREE.Vector3(),
  fromLook: new THREE.Vector3(),
  fov: 60,
  roll: 0,
  boostKick: 0,
  punch: 1, // < 1 leans in on a big moment
  punchT: 0,
  punchTo: 1,
  chase: 0, // 0 → 1 as the play camera takes over
};
const tmpV = new THREE.Vector3();
const pa = { x: 0, y: 0, behind: false };
const pb = { x: 0, y: 0, behind: false };
const pv = new THREE.Vector3();

function project(x, y, z, out) {
  pv.set(x, y, z).project(camera);
  out.behind = pv.z > 1;
  out.x = (pv.x * 0.5 + 0.5) * view.width;
  out.y = (-pv.y * 0.5 + 0.5) * view.height;
  return out;
}

const portrait = () => view.height > view.width * 1.1;
const baseFov = () => {
  const aspect = view.width / view.height;
  if (aspect >= 1.1) return 60;
  // keep about 50° across on a phone held upright
  return clamp((2 * Math.atan(Math.tan((50 * Math.PI) / 360) / aspect) * 180) / Math.PI, 60, 84);
};

// The play camera: high over the town on a fixed bearing for the place (the sun off the top-left corner), looking down at the
// flock, leading it, and pulling back as the flock grows.
const PITCH = (54 * Math.PI) / 180;
const camFwd = new THREE.Vector3(1, 0, 0); // up the screen, on the ground
const camRight = new THREE.Vector3(0, 0, 1);
const gpt = { x: 0, z: 0 };
const ray = new THREE.Vector3();
let camBearing = 0;

function setBearing(map) {
  camBearing = Number.isFinite(map.look.bearing) ? map.look.bearing : Math.PI + 0.32 + Math.PI / 4;
  camFwd.set(Math.cos(camBearing), 0, Math.sin(camBearing));
  camRight.set(-camFwd.z, 0, camFwd.x);
}

const playFov = () => {
  const aspect = view.width / view.height;
  if (aspect >= 1.1) return 44;
  // keep about 48° across on a phone held upright
  return clamp((2 * Math.atan(Math.tan((48 * Math.PI) / 360) / aspect) * 180) / Math.PI, 44, 82);
};

/** How far the play camera stands from what it looks at, for a flock of n. */
const chaseDistance = (n) => (50 + 1.75 * Math.sqrt(Math.max(0, n))) * (portrait() ? 1.12 : 1);

function chaseWant(L, n, out, look) {
  // between the lead bird and the middle of its flock, a little ahead of it
  const mid = me.puffs[3];
  const D = chaseDistance(n) * (1 + cam.boostKick) * cam.punch;
  const ahead = 4 + D * 0.08;
  look.set(L.x * 0.62 + mid.x * 0.38 + Math.cos(L.yaw) * ahead, L.y - 3, L.z * 0.62 + mid.z * 0.38 + Math.sin(L.yaw) * ahead);
  const c = Math.cos(PITCH) * D;
  out.set(look.x - camFwd.x * c, look.y + Math.sin(PITCH) * D, look.z - camFwd.z * c);
}

/** The point on the level y under a spot on the screen (px), or false if the ray misses it. */
function screenToLevel(px, py, y, out) {
  ray.set((px / view.width) * 2 - 1, -(py / view.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  if (ray.y > -0.02) return false;
  const t = (y - camera.position.y) / ray.y;
  out.x = camera.position.x + ray.x * t;
  out.z = camera.position.z + ray.z * t;
  return true;
}

function roostWant(map, out, look) {
  const r = map.roost;
  look.set(r.look[0], r.look[1], r.look[2]);
  tmpV.set(r.camera[0] - r.look[0], r.camera[1] - r.look[1], r.camera[2] - r.look[2]);
  const base = tmpV.length();
  tmpV.normalize();
  const hfov = 2 * Math.atan(Math.tan((baseFov() * Math.PI) / 360) * (view.width / view.height));
  const need = (r.span / 2 + 5) / Math.tan(hfov / 2);
  out.copy(look).addScaledVector(tmpV, Math.max(base, need));
  out.y += portrait() ? 4 : 0;
}

function titleWant(map, out, look) {
  const T = map.title;
  const t = performance.now() / 1000;
  out.set(T.camera[0], T.camera[1], T.camera[2]);
  look.set(T.look[0] + Math.sin(t * 0.07) * 14, T.look[1] + Math.sin(t * 0.05) * 3, T.look[2] + Math.cos(t * 0.06) * 14);
  // upright phones: tilt up, so the sky and the roofs fill the tall frame instead of the dark field
  if (portrait()) {
    out.x += 6;
    look.y += 90;
  }
}

function routeWant(map, out, look) {
  const t = performance.now() / 1000;
  const a = 0.4 + t * 0.02;
  out.set(map.center.x + Math.cos(a) * 230, 150, map.center.z + Math.sin(a) * 230);
  look.set(map.center.x, 0, map.center.z);
}

function updateCamera(dt, sky) {
  const map = sky.map;
  const rm = reducedMotion();
  let rate = 3.5;
  let lookRate = 6;
  let chasing = false;
  const night = sky.phase === 'night' && !sky.parked && me.L && (S.mode === 'sky' || S.mode === 'mig' || S.mode === 'migresult');
  // the moment's lean-in eases back out
  cam.punchT = Math.max(0, cam.punchT - dt);
  const wantPunch = cam.punchT > 0 && !rm ? cam.punchTo : 1;
  cam.punch += (wantPunch - cam.punch) * (1 - Math.exp(-dt * (wantPunch < cam.punch ? 9 : 2.2)));
  if (S.mode === 'title' || S.mode === 'boot' || ((S.mode === 'closed' || S.mode === 'notice') && !me.L)) {
    titleWant(map, cam.wantPos, cam.wantLook);
    rate = 2;
    lookRate = 2;
  } else if (S.mode === 'route') {
    routeWant(map, cam.wantPos, cam.wantLook);
    rate = 1.5;
    lookRate = 1.5;
  } else if (night || (S.mode === 'migresult' && S.mig)) {
    roostWant(map, cam.wantPos, cam.wantLook);
    rate = 1.2;
    lookRate = 1.4;
  } else if (me.L) {
    chaseWant(me.L, me.n, cam.wantPos, cam.wantLook);
    chasing = true;
  }
  const kick = chasing && !rm && me.L.boosting ? 0.07 : 0;
  cam.boostKick += (kick - cam.boostKick) * (1 - Math.exp(-dt * 3));
  if (S.mode === 'takeoff' || S.mode === 'intro') {
    // a swoop from where the camera was into the chase
    const T = S.mode === 'takeoff' ? 1.4 : 2.2;
    const k = clamp(S.t / T, 0, 1);
    const e = k * k * k * (k * (k * 6 - 15) + 10);
    cam.pos.lerpVectors(cam.fromPos, cam.wantPos, e);
    cam.look.lerpVectors(cam.fromLook, cam.wantLook, e);
    if (S.mode === 'intro') cam.pos.y += Math.sin(k * Math.PI) * 25;
  } else if (chasing) {
    // the high camera keeps its angle: what it looks at glides after the flock, and the camera rides with it
    cam.look.lerp(cam.wantLook, 1 - Math.exp(-dt * 3.2));
    tmpV.copy(cam.wantPos).sub(cam.wantLook).add(cam.look);
    cam.pos.lerp(tmpV, 1 - Math.exp(-dt * 10));
  } else {
    cam.pos.lerp(cam.wantPos, 1 - Math.exp(-dt * rate));
    cam.look.lerp(cam.wantLook, 1 - Math.exp(-dt * lookRate));
  }
  // never into the ground
  const floor = surfaceAt(map, cam.pos.x, cam.pos.z) + 2;
  if (cam.pos.y < floor) cam.pos.y = floor;
  camera.position.copy(cam.pos);
  // shake: decaying trauma, squared, smooth, leaning the way the hit came from
  S.trauma = Math.max(0, S.trauma - dt * 1.6);
  let sx = 0;
  let sy = 0;
  let sz = 0;
  if (!rm && S.trauma > 0) {
    const t = performance.now() / 1000;
    const a = S.trauma * S.trauma * (chasing ? 1.4 : 0.7);
    sx = a * ((Math.sin(t * 31) + Math.sin(t * 17.3)) * 0.5 + S.shakeDir.x * 0.6);
    sy = a * (Math.sin(t * 27.1) + Math.sin(t * 13.7)) * 0.5;
    sz = a * ((Math.sin(t * 23.9) + Math.sin(t * 19.1)) * 0.5 + S.shakeDir.z * 0.6);
    camera.position.x += sx;
    camera.position.y += sy;
    camera.position.z += sz;
  }
  camera.up.set(0, 1, 0);
  tmpV.set(cam.look.x + sx * 0.5, cam.look.y + sy * 0.5, cam.look.z + sz * 0.5);
  camera.lookAt(tmpV);
  cam.chase += ((chasing || S.mode === 'takeoff' ? 1 : 0) - cam.chase) * (1 - Math.exp(-dt * 3));
  const fov = baseFov() + (playFov() - baseFov()) * cam.chase;
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

/** Lean in on a big moment: the camera closes to k of its distance for t seconds. */
function punchIn(k = 0.86, t = 0.5) {
  cam.punchTo = Math.min(cam.punchT > 0 ? cam.punchTo : 1, k);
  cam.punchT = Math.max(cam.punchT, t);
}

function startSwoop() {
  cam.fromPos.copy(cam.pos);
  cam.fromLook.copy(cam.look);
}

// ------------------------------------------------------------------ hints (2-5 words, by device)

const HINTS = {
  steer: () => (input.last === 'touch' || touch() ? 'Point the stick to fly' : input.last === 'keys' ? 'Fly with WASD' : 'Point where to fly'),
  gather: () => 'Gather the grey birds',
  goal: () => 'Biggest flock at sundown wins',
  boost: () => (input.last === 'touch' || touch() ? 'Hold Boost to speed up' : input.last === 'keys' ? 'Hold Space to boost' : 'Hold the mouse to boost'),
  cut: () => 'Cut through smaller flocks',
  avoid: () => 'Avoid bigger flocks',
  thermal: () => 'Ride the thermal',
  hawk: () => 'Hawk! Turn hard',
  storm: () => 'Stay out of the storm',
};

function hint(id, { again = false, force = false } = {}) {
  if (AUTO) return false;
  if (!again && profile.hints.includes(id)) return false;
  if (!force && performance.now() / 1000 - S.hintAt < 4.5) return false;
  S.hintAt = performance.now() / 1000;
  hud.showHint(HINTS[id]());
  if (!profile.hints.includes(id)) profile.hints.push(id);
  return true;
}

function hintsFor(sky, dt) {
  if (!me.L || sky.phase !== 'day') return;
  const L = me.L;
  const t = S.flyT;
  if (t > 1.5) hint('steer');
  if (t > 5 && S.sunset.gathered === 0) hint('gather');
  if (t > 12) hint('goal');
  // stuck: no birds for a while
  if (t - S.lastGather > 20 && me.n < 20 && hint('gather', { again: true })) S.lastGather = t - 5;
  let nearSmaller = false;
  let nearBigger = false;
  for (const f of sky.flocks.values()) {
    if (f.id === myId()) continue;
    const h = f.puffs[0];
    const dx = h.x - L.x;
    const dz = h.z - L.z;
    const d = Math.hypot(dx, dz);
    if (d < 70 && f.n < me.n * 0.8 && f.n >= 8 && (dx * Math.cos(L.yaw) + dz * Math.sin(L.yaw)) / (d || 1) > 0.5) nearSmaller = true;
    if (d < 38 && f.n > me.n * 1.3 && f.n >= 20) nearBigger = true;
  }
  if (nearSmaller && me.n >= 15) hint('cut');
  if (nearBigger) hint('avoid');
  if ((nearSmaller && t > 15) || t > 26) hint('boost');
  for (const th of sky.map.thermals) {
    const dx = th.x - L.x;
    const dz = th.z - L.z;
    const d = Math.hypot(dx, dz);
    if (d < 55 && d > th.r && (dx * Math.cos(L.yaw) + dz * Math.sin(L.yaw)) / d > 0.7) {
      hint('thermal');
      break;
    }
  }
  const front = sky.storm ? sky.stormFront() : null;
  const tt = performance.now() / 1000;
  if (front !== null && L.x < front + 40 && tt - (S.stormHintAt ?? -99) > 12 && hint('storm', { again: true })) S.stormHintAt = tt;
}

/** A pulse ring on the nearest roof of grey birds, for a player who hasn't gathered yet. */
function gatherPulse(sky) {
  if (!me.L || sky.phase !== 'day' || S.sunset.gathered > 0 || S.flyT < 4 || profile.sunsets > 2 || AUTO) {
    fx.setPulse(null);
    return;
  }
  const L = me.L;
  let best = null;
  let bestD = Infinity;
  const groups = sky.map.groups;
  for (let g = 0; g < groups.length; g++) {
    if (sky.groupLive[g] < 4) continue;
    const G = groups[g];
    const d = Math.hypot(G.x - L.x, G.z - L.z);
    if (d < bestD) {
      bestD = d;
      best = G;
    }
  }
  if (best) {
    pulseAt.x = best.x;
    pulseAt.y = best.y;
    pulseAt.z = best.z;
    pulseAt.r = 5;
    fx.setPulse(pulseAt);
  } else fx.setPulse(null);
}
const pulseAt = { x: 0, y: 0, z: 0, r: 5 };

// ------------------------------------------------------------------ what happened in the sky

function near(x, z, r) {
  const dx = x - camera.position.x;
  const dz = z - camera.position.z;
  return dx * dx + dz * dz < r * r;
}

function onEvents(list, sky) {
  birds.push(list);
  const id = myId();
  const L = me.L;
  for (const e of list) {
    switch (e.type) {
      case 'join':
        if (e.id === id && L) {
          const y = Number.isFinite(e.y) ? e.y : L.y - 4;
          project(e.x, y, e.z, pb);
          if (!pb.behind) hud.addFloat(pb.x, pb.y, e.k, true);
          audio.gather(e.k);
          S.sunset.gathered += e.k;
          S.lastGather = S.flyT;
          if (S.sunset.gathered >= 50) award('first-flock');
        }
        break;
      case 'steal':
        if (e.to === id || e.from === id) {
          const gain = e.to === id;
          project(e.x, e.y, e.z, pb);
          if (gain) {
            if (!pb.behind) hud.addFloat(pb.x, pb.y, e.k, true);
            S.sunset.stolen += e.k;
            if (e.pass >= 10 && e.bigger) award('tail-cutter');
          } else {
            hud.addFloat(0, 0, e.k, false);
            if (!reducedMotion()) S.trauma = Math.min(1, S.trauma + Math.min(0.35, e.k / 30));
          }
          if (!pb.behind) hud.addWhy(pb.x, pb.y - 30, gain ? e.lw : e.ll, gain ? e.ll : e.lw, !gain);
          audio.steal(gain, e.k);
        }
        break;
      case 'shed':
        if (e.id === id) {
          hud.addFloat(0, 0, e.k, false);
          audio.shed();
        }
        break;
      case 'strike': {
        const mine = e.losses?.[id] ?? 0;
        if (near(e.x, e.z, 140) || mine) {
          audio.strike();
          fx.burst(e.x, e.y, e.z, 26, PALETTE.ash, 9);
          if (!reducedMotion()) S.slowmo = 0.09;
        }
        if (mine) {
          hud.addFloat(0, 0, mine, false);
          if (!reducedMotion()) S.trauma = Math.min(1, S.trauma + 0.6);
          const f = sky.flocks.get(id);
          if (f) fx.burst(e.x, e.y, e.z, 16, SLOTS[f.slot].hex, 7);
        }
        if (e.target === id && e.dodged) {
          audio.dodged();
          hud.showHint('Dodged!', 1.6);
          S.hintAt = performance.now() / 1000;
          award('hawk-dodger');
        }
        break;
      }
      case 'scatter':
        if (near(e.x, e.z, 120)) fx.burst(e.x, e.y, e.z, 12, PALETTE.ash, 6);
        break;
      default:
        break;
    }
  }
}

/** The hawk's circle and stoop, read from the sky (the host's and every mirror's alike). */
function watchHawk(sky) {
  const H = sky.hawk;
  if (H.phase !== S.hawkPhase) {
    const mine = H.target === myId();
    if (H.phase === 'circle') {
      audio.hawkCry(mine);
      if (mine && me.L) hint('hawk', { again: true, force: true });
    } else if (H.phase === 'stoop' && mine) audio.stoop();
    S.hawkPhase = H.phase;
  }
}

// ------------------------------------------------------------------ sunsets, nights and dawns

/** The light's share of the sunset for a sky (0 gold → 1 sundown → 1.12 night; a dawn sweeps back to 0). */
function lightShare(sky) {
  const day = sky.opts.day;
  const start = S.mig ? PLACES[S.mig.index].light : 0;
  if (sky.parked) return 0.58; // a waiting sky shows the low ember sun
  if (sky.phase === 'day') return start + (1 - start) * clamp(sky.time / day, 0, 1);
  const n = sky.time - day;
  if (n < ROUND.sundown) return 1 + 0.12 * (n / ROUND.sundown);
  if (S.mig || n < ROUND.results) return 1.12;
  return 1.12 * clamp(1 - (n - ROUND.results) / (ROUND.night - ROUND.results), 0, 1);
}

/** A new sunset in the shared sky: fresh birds, the camera back behind the bird. */
function newSunsetView() {
  birds.reset();
  birds.setRoost(null);
  fx.clearFeathers();
  S.nightRid = -1;
  S.nightShown = false;
  S.nightResults = false;
  S.flyT = 0;
  S.lastGather = 0;
  S.lastLeft = 999;
  S.sunset = newSunsetStats();
  if (S.mode === 'sky' && screens.current === 'night') screens.clear();
}

/** Which flocks land on which roost wire: the top five, plus mine. */
function roostAssign(standings, mine) {
  const m = new Map();
  let w = 0;
  for (const s of standings) {
    if (w >= 6) break;
    if (w === 5 && s.id !== mine && standings.findIndex((x) => x.id === mine) >= 5) continue;
    m.set(s.id, w++);
  }
  return m;
}

/** The sky reached sundown: the roost, the results, saves and badges. */
function enterNight(sky) {
  S.nightRid = sky.rid;
  S.nightAt = performance.now() / 1000;
  S.nightShown = false;
  S.nightResults = false;
  S.nightBest = false;
  S.nightWon = false;
  const standings = sky.standings ?? [];
  S.roostMap = roostAssign(standings, myId());
  birds.setRoost(sky.map.roost, S.roostMap);
  fx.setPulse(null);
  hud.quiet();
  if (!me.L) return;
  audio.bell(true);
  if (S.mig) return; // a place's result is its own screen
  const mine = standings.findIndex((s) => s.id === myId());
  if (mine < 0) return;
  const n = standings[mine].n;
  const won = n > 0 && n === standings[0].n;
  profile.sunsets++;
  profile.gathered += S.sunset.gathered;
  profile.stolen += S.sunset.stolen;
  const best = n > profile.best;
  if (best) profile.best = n;
  if (won) profile.wins++;
  S.nightBest = best;
  S.nightWon = won;
  saveProfile();
  submit('biggest-flock', n);
  if (won) submit('sundowns', profile.wins);
  if (won && standings.length >= 4) award('sundown-king');
}

function nightLines(sky) {
  const st = sky.standings ?? [];
  const lines = [];
  const top = st[0];
  const id = myId();
  if (top) {
    const who = top.id === id ? 'You' : top.name;
    lines.push([`${who}: biggest flock at sundown, ${top.n}`, top.id === id ? 'win' : 'top']);
  }
  const k = st.findIndex((s) => s.id === id);
  if (k > 0) lines.push([`You: ${ordinal(k + 1)}, ${st[k].n}`, 'me']);
  return lines;
}

function showNight(sky) {
  S.nightShown = true;
  const hostRivals = net.authority && [...sky.flocks.values()].some((f) => f.kind === 'rival');
  screens.night({
    lines: nightLines(sky),
    best: S.nightBest,
    migration: S.alone,
    skill: hostRivals ? net.skillPick : null,
    onMigration: openRoute,
    onSkill: (id) => {
      net.setSkill(id);
      profile.skill = id;
      saveProfile();
      showNight(sky);
    },
    dawnIn: ROUND.day + ROUND.night - sky.time,
  });
}

function nightTick(sky) {
  const since = performance.now() / 1000 - S.nightAt;
  if (!S.nightResults && since > 3) {
    S.nightResults = true;
    const st = sky.standings ?? [];
    const top = st[0];
    if (me.L && top) {
      const won = top.id === myId() && top.n > 0;
      if (!S.mig) audio.fanfare(won);
      const w = S.roostMap?.get(top.id);
      if (w !== undefined) {
        const wire = sky.map.roost.wires[w];
        fx.shower(wire.ax, wire.ay, wire.az, wire.bx, wire.by, wire.bz, 70, SLOTS[top.slot].hex);
      }
    }
  }
  if (S.mig) return;
  if (me.L && S.mode === 'sky') {
    if (!S.nightShown && since > 3.2) showNight(sky);
    if (S.nightShown) screens.setDawn(ROUND.day + ROUND.night - sky.time);
  }
}

// ------------------------------------------------------------------ screens and flow

function controls(on) {
  if (on) {
    sdk(() => ow.controls.set({ stick: 'analog', zone: 'wide', buttons: [{ id: 'boost', label: 'Boost', key: ' ' }] }));
  } else sdk(() => ow.controls.set(null));
}

function showTitle() {
  setMode('title');
  me.L = null;
  controls(false);
  screens.title({ best: profile.best, onFly: fly });
}

/** Fly: into the shared sky from the title's wire. */
function fly() {
  audio.start();
  if (S.mode === 'takeoff' || S.mode === 'sky') return;
  endMigration();
  const map = net.sky.map;
  const T = map.title.spawn;
  startSwoop();
  // until the host's count arrives, a new flock is its first eight
  if (!myFlock()) me.n = FLOCK.start;
  placeLeader(T.x, T.z, T.yaw, undefined, map);
  launchTitleBirds();
  setMode('takeoff');
  S.flyT = 0;
  S.lastGather = 0;
  screens.clear();
  controls(true);
}

/** Back into the shared sky from anywhere (a Migration, a notice): at the spawn farthest from other flocks. */
function backToSky() {
  endMigration();
  screens.clear();
  const sky = net.sky;
  const sp = sky.pickSpawn();
  if (!myFlock()) me.n = FLOCK.start;
  // what happened in a Migration place isn't this sunset's
  S.sunset = newSunsetStats();
  placeLeader(sp.x, sp.z, sp.yaw, undefined, sky.map);
  startSwoop();
  setMode('takeoff');
  S.flyT = 0;
  S.lastGather = 0;
  S.nightShown = false;
  controls(true);
}

function openRoute() {
  if (!S.alone) return;
  audio.start();
  setMode('route');
  me.L = null;
  controls(false);
  birds.setRoost(null);
  screens.route({
    feathers: profile.feathers,
    open: unlocked(profile.feathers),
    onPick: startPlace,
    onBack: backToSky,
  });
}

function startPlace(index) {
  if (!S.alone) return;
  audio.start();
  const seed = (Math.floor(now()) ^ (index * 7919)) >>> 0;
  const sky = placeSky(index, seed, 'pme', 'You');
  S.mig = { index, sky, seed, endedAt: 0 };
  S.paused = false;
  setWorld(PLACES[index].map);
  birds.reset();
  birds.setRoost(null);
  fx.clearFeathers();
  fx.setStorm(!!sky.storm);
  const f = sky.flocks.get('pme');
  me.n = f.n;
  placeLeader(f.leader.x, f.leader.z, f.leader.yaw, f.leader.y, sky.map);
  // the camera starts high over the place and swoops down behind the bird
  const c = sky.map.center;
  cam.pos.set(c.x + 60, 140, c.z + 160);
  cam.look.set(c.x, 0, c.z);
  startSwoop();
  S.sunset = newSunsetStats();
  S.flyT = 0;
  S.lastGather = 0;
  S.nightRid = -1;
  setMode('intro');
  screens.intro({ index });
  controls(false);
}

/** Leave a Migration place (if one is running) and put the shared sky's world back. */
function endMigration() {
  if (!S.mig && world?.map.id === 'saltmere') return;
  S.mig = null;
  S.paused = false;
  fx.setStorm(false);
  setWorld('saltmere');
  birds.reset();
  birds.setRoost(null);
  fx.clearFeathers();
  S.nightRid = -1;
}

function migTick(dt) {
  const M = S.mig;
  const sky = M.sky;
  if (S.mode === 'intro') {
    if (S.t > 2.2) {
      setMode('mig');
      screens.clear();
      controls(true);
    }
    return;
  }
  if ((S.mode !== 'mig' && S.mode !== 'migresult') || S.paused) return;
  const L = me.L;
  sky.feed('pme', L.x, L.y, L.z, L.yaw, L.boosting);
  sky.advance(dt);
  const events = sky.drainEvents();
  if (events.length) onEvents(events, sky);
  if (sky.phase === 'night' && !M.endedAt) M.endedAt = performance.now() / 1000;
  if (S.mode === 'mig' && M.endedAt && performance.now() / 1000 - M.endedAt > 3.4) showPlaceResult();
}

function showPlaceResult() {
  const M = S.mig;
  const sky = M.sky;
  const P = PLACES[M.index];
  const st = sky.standings ?? [];
  const k = Math.max(0, st.findIndex((s) => s.id === 'pme'));
  const n = st[k]?.n ?? 0;
  const rank = k + 1;
  const earned = feathersFor(P, rank, n);
  const before = profile.feathers[M.index];
  profile.feathers[M.index] = Math.max(before, earned);
  const total = totalFeathers(profile.feathers);
  if (profile.feathers.every((f) => f > 0)) award('migration');
  if (total >= 12) award('twelve-feathers');
  if (earned > before) submit('feathers', total);
  saveProfile();
  setMode('migresult');
  controls(false);
  const open = unlocked(profile.feathers);
  const hasNext = M.index < PLACES.length - 1 && open[M.index + 1] && S.alone;
  if (earned > 0 || rank === 1) audio.fanfare(true);
  screens.result({
    index: M.index,
    rank,
    n,
    earned,
    before,
    hasNext,
    onNext: () => startPlace(M.index + 1),
    onAgain: () => startPlace(M.index),
    onBack: backToSky,
  });
}

function pauseMig() {
  if (S.mode !== 'mig' || S.paused) return;
  S.paused = true;
  controls(false);
  screens.pause({
    onResume: () => {
      S.paused = false;
      screens.clear();
      controls(true);
    },
    onLeave: backToSky,
  });
}

/** Someone came or went: Migration is only for a player alone in the room. */
function onPlayersChanged() {
  const alone = net.othersOnline() === 0;
  if (alone === S.alone) return;
  S.alone = alone;
  const inMig = S.mig || S.mode === 'route' || S.mode === 'migresult';
  if (!alone && inMig) {
    // never two sunsets at once in one room: back to the shared sky
    let name = 'A flock';
    for (const p of room.players.values()) if (p.id !== room.me.id && p.connected !== false) name = cleanName(p.name) || name;
    endMigration();
    me.L = null;
    setMode('notice');
    controls(false);
    screens.notice({ text: `${name} flew in`, button: 'Fly', onClick: backToSky });
  } else if (S.mode === 'sky' && S.nightShown && screens.current === 'night') {
    showNight(net.sky);
  }
}

function onKey(k) {
  if (screens.key(k)) return;
  if (k === 'Escape' && S.mode === 'mig') pauseMig();
}

// ------------------------------------------------------------------ the title's wire birds

const TITLE_BIRDS = [];
function seatTitleBirds() {
  const map = getMap('saltmere');
  const w = map.title.wire;
  TITLE_BIRDS.length = 0;
  for (let k = 0; k < 16; k++) {
    const s = 0.3 + k * 0.026 + ((k * 37) % 7) * 0.002;
    const p = wirePoint(w, s);
    TITLE_BIRDS.push({ x: p[0], y: p[1] + 0.22, z: p[2], vx: 0, vy: 0, vz: 0, yaw: Math.PI + ((k * 13) % 5) * 0.08 - 0.16, phase: k * 1.7, flying: false, t: 0 });
  }
}
seatTitleBirds();

function launchTitleBirds() {
  TITLE_BIRDS.forEach((b, k) => {
    b.flying = true;
    b.t = 0;
    const a = Math.PI + (k / 16 - 0.5) * 1.6;
    b.vx = Math.cos(a) * (8 + (k % 4) * 2);
    b.vz = Math.sin(a) * (8 + (k % 4) * 2);
    b.vy = 5 + (k % 5) * 1.2;
    b.yaw = a;
  });
  audio.gather(16);
}

function stepTitleBirds(dt) {
  for (const b of TITLE_BIRDS) {
    if (!b.flying) continue;
    b.t += dt;
    b.vy -= dt * 2;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
  }
}

// ------------------------------------------------------------------ the HUD

const tagPool = Array.from({ length: 13 }, () => ({}));
const rowPool = Array.from({ length: 7 }, () => ({}));
const labelPool = Array.from({ length: 6 }, () => ({}));
const ptrPool = Array.from({ length: 3 }, () => ({}));
const tags = [];
const rows = [];
const labels = [];
const pointers = [];
const sorted = [];
const byN = (a, b) => b.n - a.n || (a.id < b.id ? -1 : 1);
const lay = { clockX: 0, top: 8, right: 0, boardW: 240, boardTop: 8, hintY: 200 };
const hs = { ring: null, tags, labels, clock: null, board: rows, pointers, layout: lay, why: true };
const ring = { x: 0, y: 0, r: 24, squash: 0.45, stamina: 1 };
const clockS = { share: 0, left: 180, sunColor: '#FFE6B0', label: '' };

function reserved() {
  const r = sdk(() => ow.ui.reserved, null);
  return Array.isArray(r) ? r : null;
}
/** How far down the platform's own buttons reach over [x0, x1] at the top of the screen. */
function topClear(x0, x1) {
  const rs = reserved();
  if (!rs) return x0 < 150 ? 70 : 0;
  let b = 0;
  for (const r of rs) if (r && r.y < 140 && r.x < x1 && r.x + r.w > x0) b = Math.max(b, r.y + r.h);
  return b;
}

function layout() {
  const w = view.width;
  const h = view.height;
  const narrow = w < 640;
  lay.clockX = w / 2;
  lay.top = 10 + topClear(w / 2 - 80, w / 2 + 80);
  lay.boardW = narrow ? Math.min(200, w * 0.52) : 240;
  lay.right = w - 14;
  lay.boardTop = narrow ? lay.top + 92 : 8 + topClear(w - 30 - lay.boardW, w);
  lay.rows = narrow ? 3 : 5;
  lay.hintY = Math.max(h * 0.3, narrow ? lay.boardTop + 4 * 30 + 36 : 140);
}

function pointerTo(x, y, z, kind, slot, n, danger) {
  if (pointers.length >= ptrPool.length) return;
  project(x, y, z, pb);
  const w = view.width;
  const h = view.height;
  const inside = !pb.behind && pb.x > 0 && pb.x < w && pb.y > 0 && pb.y < h;
  if (inside) return;
  let dx = pb.x - w / 2;
  let dy = pb.y - h / 2;
  if (pb.behind) {
    dx = -dx;
    dy = -dy;
  }
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const m = 46;
  const top = lay.top + 80;
  const bottom = h - (touch() ? 170 : m);
  const k = Math.min(Math.abs((w / 2 - m) / (dx || 1e-6)), Math.abs(((dy < 0 ? h / 2 - top : bottom - h / 2)) / (dy || 1e-6)));
  const p = ptrPool[pointers.length];
  p.x = w / 2 + dx * k;
  p.y = h / 2 + dy * k;
  p.angle = Math.atan2(dy, dx);
  p.kind = kind;
  p.slot = slot;
  p.n = n;
  p.danger = danger;
  pointers.push(p);
}

function buildHud(sky) {
  layout();
  tags.length = 0;
  rows.length = 0;
  labels.length = 0;
  pointers.length = 0;
  hs.ring = null;
  hs.clock = null;
  const playing = me.L && (S.mode === 'sky' || S.mode === 'mig' || S.mode === 'takeoff');
  if (!playing) return;
  const id = myId();
  const narrow = view.width < 640;
  const night = sky.phase === 'night';
  const H = sky.hawk;
  const hunting = H.phase === 'circle' || H.phase === 'stoop';
  // the clock
  const day = sky.opts.day;
  clockS.share = sky.phase === 'day' ? clamp(sky.time / day, 0, 1) : 1;
  clockS.left = sky.phase === 'day' ? Math.max(0, day - sky.time) : 0;
  clockS.sunColor = view.light ? `#${view.light.disc.getHexString()}` : PALETTE.gold;
  clockS.label = '';
  hs.clock = night ? null : clockS;
  if (night) {
    // labels on the roost wires
    const st = sky.standings ?? [];
    for (let k = 0; k < st.length; k++) {
      const w = S.roostMap?.get(st[k].id);
      if (w === undefined || labels.length >= labelPool.length) continue;
      const wire = sky.map.roost.wires[w];
      const p = wirePoint(wire, 0.06);
      project(p[0], p[1] + 0.6, p[2], pb);
      if (pb.behind) continue;
      const l = labelPool[labels.length];
      l.x = clamp(pb.x, 40, view.width - 220);
      l.y = pb.y;
      l.place = k + 1;
      l.slot = st[k].slot;
      l.name = st[k].id === id ? 'You' : st[k].name;
      l.n = st[k].n;
      l.me = st[k].id === id;
      l.alpha = clamp((performance.now() / 1000 - S.nightAt - 1.5) / 0.6, 0, 1);
      labels.push(l);
    }
    return;
  }
  // over every flock: its count and symbol
  const myN = me.n;
  sorted.length = 0;
  for (const f of sky.flocks.values()) {
    sorted.push(f);
    if (tags.length >= tagPool.length) continue;
    const mine = f.id === id;
    const head = mine ? me.L : f.puffs[0];
    const up = mine ? 2.6 : (f.puffs[0].r || 2) + 2;
    project(head.x, head.y + up, head.z, pb);
    if (pb.behind || pb.x < -40 || pb.x > view.width + 40 || pb.y < -40 || pb.y > view.height + 40) continue;
    const d = Math.hypot(head.x - camera.position.x, head.z - camera.position.z);
    if (!mine && d > 280) continue;
    const t = tagPool[tags.length];
    t.x = pb.x;
    t.y = mine ? pb.y - 6 : pb.y;
    t.n = f.n;
    t.slot = f.slot;
    t.me = mine;
    const scale = narrow ? 0.82 : 1;
    t.size = mine ? 48 * scale : Math.max(18, (d < 40 ? 40 : 40 - (d - 40) * 0.1) * scale);
    t.alpha = mine ? 1 : d > 220 ? clamp(1 - (d - 220) / 60, 0, 1) : 1;
    t.kind = mine ? 'me' : f.n > myN * 1.15 && f.n >= 10 ? 'danger' : 'prey';
    t.name = mine ? '' : f.name;
    t.hunted = hunting && H.target === f.id;
    tags.push(t);
  }
  // the board: places
  sorted.sort(byN);
  let myPlace = 0;
  for (let k = 0; k < sorted.length; k++) if (sorted[k].id === id) myPlace = k;
  const show = lay.rows;
  for (let k = 0; k < sorted.length && rows.length < show + 1; k++) {
    if (k >= show && k !== myPlace) continue;
    if (k === show - 1 && myPlace >= show) continue; // the last row is mine
    const f = sorted[k];
    const r = rowPool[rows.length];
    r.place = k + 1;
    r.slot = f.slot;
    r.name = f.id === id ? 'You' : f.name;
    r.n = f.n;
    r.me = f.id === id;
    rows.push(r);
  }
  // the stamina ring under my bird
  const L = me.L;
  project(L.x, L.y - 0.5, L.z, pb);
  if (!pb.behind) {
    ring.x = pb.x;
    ring.y = pb.y;
    ring.r = narrow ? 20 : 26;
    ring.stamina = L.stamina / FLIGHT.stamina;
    hs.ring = ring;
  }
  // edge pointers: the biggest rival and the hawk hunting me
  const big = sorted[0]?.id === id ? sorted[1] : sorted[0];
  if (big && big.n > 0) pointerTo(big.puffs[0].x, big.puffs[0].y, big.puffs[0].z, 'flock', big.slot, big.n, big.n > myN * 1.15);
  if (hunting && H.target === id) {
    fx.hawkPose(sky, hawkAt);
    if (hawkAt.visible) pointerTo(hawkAt.x, hawkAt.y, hawkAt.z, 'hawk', 0, 0, true);
  }
}

// ------------------------------------------------------------------ drawing

const leaders = Array.from({ length: 48 }, () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, color: new THREE.Color(), scale: 4.4, flap: 11, phase: 0, species: 0, flair: 0 }));
const leaderList = [];
const hawkAt = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, folded: false, visible: false };
const hawkDraw = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bank: 0, scale: 9, flap: 7, fold: 0, phase: 0 };
const ASH = new THREE.Color(PALETTE.ash);
const slotColors = SLOTS.map((s) => new THREE.Color(s.hex));
const focus = new THREE.Vector3();
const LEAD_SCALE = 4.4;

function addLeader(x, y, z, yaw, color, o = {}) {
  if (leaderList.length >= leaders.length) return;
  const b = leaders[leaderList.length];
  b.x = x;
  b.y = y;
  b.z = z;
  b.yaw = yaw;
  b.pitch = o.pitch ?? 0;
  b.bank = o.bank ?? 0;
  b.color.copy(color);
  b.scale = o.scale ?? LEAD_SCALE;
  b.flap = o.flap ?? 11;
  b.phase = o.phase ?? leaderList.length * 1.3;
  b.species = o.species ?? 0;
  b.flair = o.flair ?? 0;
  leaderList.push(b);
}

/** A flock's look: its lead bird's species and its flair (mine from the profile, others' from what their page says). */
function lookOf(f) {
  if (f.id === myId()) return { species: equipped.species, flair: equipped.flair, trail: equipped.trail };
  return f.look ?? DEFAULT_LOOK;
}
const DEFAULT_LOOK = { species: 0, flair: 0, trail: 0 };

function drawLeaders(sky) {
  leaderList.length = 0;
  fx.beginRibbons();
  const id = myId();
  const night = sky.phase === 'night';
  for (const f of sky.flocks.values()) {
    const mine = f.id === id && me.L;
    const color = slotColors[f.slot];
    const look = lookOf(f);
    birds.flairOf.set(f.id, look.flair);
    const w = night ? S.roostMap?.get(f.id) : undefined;
    if (w !== undefined) {
      // roosting: the lead bird sits at the head of its wire
      const p = wirePoint(sky.map.roost.wires[w], 0.03);
      const r = sky.map.roost;
      const yaw = Math.atan2(r.camera[2] - r.z, r.camera[0] - r.x);
      addLeader(p[0], p[1] + 0.25, p[2], yaw, color, { flap: -1, species: look.species, flair: look.flair });
      continue;
    }
    const L = mine ? me.L : f.leader;
    const pitch = mine ? Math.atan2(L.vy, Math.max(4, L.speed)) * 0.8 : 0;
    addLeader(L.x, L.y, L.z, L.yaw, color, { pitch, bank: L.bank ?? 0, flap: L.boosting ? 17 : 11, species: look.species, flair: look.flair });
    if (mine) fx.addRibbons(me.trail, me.t, L, color, look.trail);
    else fx.addRibbons(f.trail, sky.clock, L, color, look.trail);
  }
  fx.endRibbons();
  // the hawk
  fx.hawkPose(sky, hawkAt);
  if (hawkAt.visible) {
    Object.assign(hawkDraw, { x: hawkAt.x, y: hawkAt.y, z: hawkAt.z, yaw: hawkAt.yaw, pitch: hawkAt.pitch, bank: hawkAt.bank });
    hawkDraw.fold += ((hawkAt.folded ? 1 : 0) - hawkDraw.fold) * 0.2;
    hawkDraw.flap = hawkAt.folded ? 0 : 6;
    birds.setHawk(hawkDraw);
  } else birds.setHawk(null);
  // the aim ring on my flock while the hawk hunts it
  const H = sky.hawk;
  if ((H.phase === 'circle' || H.phase === 'stoop') && H.target === id && me.L) fx.setAim(me.puffs[0], me.puffs[0].r || 3);
  else fx.setAim(null);
  // the title's wire birds
  if (!S.mig && (S.mode === 'title' || S.mode === 'takeoff' || S.mode === 'boot' || (S.mode === 'closed' && !me.L))) {
    for (const b of TITLE_BIRDS) {
      if (b.flying && b.t > 2) continue;
      addLeader(b.x, b.y, b.z, b.yaw, ASH, { scale: 2.3, flap: b.flying ? 15 : -1, phase: b.phase, species: -1 });
    }
  }
  birds.setLeaders(leaderList);
}

function draw(dt) {
  const sky = activeSky();
  updateCamera(dt, sky);
  // the light: the sunset's share
  const s = lightShare(sky);
  if (me.L) focus.set(me.L.x, me.L.y, me.L.z);
  else focus.copy(cam.look);
  const t = performance.now() / 1000;
  view.setLight(s, focus, t);
  world.update(view.light, t, dt);
  birds.setLight(view.light, scene);
  // the birds: a moment of slow motion on a hawk strike
  const bdt = S.slowmo > 0 ? dt * 0.3 : dt;
  S.slowmo = Math.max(0, S.slowmo - dt);
  const own = me.L && !(sky.phase === 'night') ? me.puffs : null;
  birds.update(bdt, sky, camera, myId(), own);
  drawLeaders(sky);
  fx.setStormX(sky.storm ? sky.stormFront() : null);
  fx.update(dt, view.light, scene);
  view.render();
  // the HUD
  buildHud(sky);
  hud.draw(dt, hs);
}

// ------------------------------------------------------------------ the frame

function tick(dt) {
  S.t += dt;
  for (const k of input.takePresses()) onKey(k);
  const sky = activeSky();
  // my flock's size (the host's count, or the place's)
  const f = myFlock();
  me.n = f ? f.n : me.n;
  if (flying()) {
    flyOwn(dt, sky);
    if (sky.phase === 'day') S.flyT += dt;
    if (me.n > S.sunset.maxN) S.sunset.maxN = me.n;
    if (me.n >= 100) award('hundred-birds');
    if (me.n >= 400) award('murmuration');
    if (me.n > profile.biggest && !AUTO) profile.biggest = me.n;
  }
  if (S.mode === 'takeoff' && S.t > 1.3) setMode('sky');
  stepTitleBirds(dt);
  // the room, always (presence, and the shared sky for everyone else when this page is the host)
  if (titleLeader === null) {
    const T = net.sky.map.title.spawn;
    titleLeader = newLeader(T.x, T.z, T.yaw, net.sky.map);
  }
  net.update(dt, { st: status(), leader: me.L && !S.mig ? me.L : titleLeader, nw: profile.sunsets === 0 });
  if ((net.othersOnline() === 0) !== S.alone) onPlayersChanged();
  if (S.mig) migTick(dt);
  // nights
  const shown = activeSky();
  if (shown.phase === 'night' && !shown.parked && shown.standings && S.nightRid !== shown.rid) enterNight(shown);
  if (shown.phase === 'night' && S.nightRid === shown.rid) nightTick(shown);
  if (shown.phase === 'day' && S.nightRid !== -1 && !S.mig) newSunsetView();
  // the clock's last seconds
  if (me.L && shown.phase === 'day' && !shown.parked) {
    const left = shown.opts.day - shown.time;
    if (left <= 10 && left > 0 && Math.ceil(left) < Math.ceil(S.lastLeft)) audio.bell(false);
    S.lastLeft = left;
  }
  watchHawk(shown);
  if (flying()) {
    hintsFor(shown, dt);
    gatherPulse(shown);
  } else fx.setPulse(null);
  // sound
  const L = me.L;
  audio.update(dt, {
    birds: me.n,
    speed: L ? L.speed : 14,
    boosting: !!L?.boosting,
    phase: S.mode === 'title' || S.mode === 'boot' || !L ? 'title' : shown.phase === 'night' ? 'night' : phaseAt(lightShare(shown)),
    last30: !!L && shown.phase === 'day' && shown.opts.day - shown.time <= 30,
    flying: flying(),
  });
}

let last = performance.now();
function loop(t) {
  requestAnimationFrame(loop);
  const dt = clamp((t - last) / 1000, 0, 0.1);
  last = t;
  if (document.hidden) return;
  frameStats(t);
  tick(dt);
  draw(dt);
}

// frame times, for tests at phone sizes (?stats=1 logs them)
const stats = { n: 0, sum: 0, worst: 0, at: 0 };
function frameStats(t) {
  if (!params.has('stats')) return;
  if (stats.at) {
    const ms = t - stats.at;
    stats.n++;
    stats.sum += ms;
    stats.worst = Math.max(stats.worst, ms);
    if (stats.n % 120 === 0) {
      console.log(`frame ${(stats.sum / stats.n).toFixed(1)} ms avg, ${stats.worst.toFixed(1)} worst, ${renderInfo()}`);
      stats.n = 0;
      stats.sum = 0;
      stats.worst = 0;
    }
  }
  stats.at = t;
}
const renderInfo = () => `${view.renderer.info.render.calls} calls, ${view.renderer.info.render.triangles} tris`;

// a hidden page keeps the room going slowly (it may be the host), and pauses a Migration
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    pauseMig();
  } else last = performance.now();
});
setInterval(() => {
  if (!document.hidden || !net) return;
  const t = performance.now();
  const dt = Math.min(1, (t - hiddenAt) / 1000);
  hiddenAt = t;
  tick(dt);
}, 500);

function resize() {
  view.setPixelRatio(pixelRatio());
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  hud.resize(view.width, view.height, pr);
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ boot

async function boot() {
  // let the page paint its own title first: the world's build and the shaders' compile come after
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  setWorld('saltmere');
  resize();
  // a sky of our own flies behind the title until the room answers
  room = stubRoom('You');
  makeNet(room);
  showTitle();
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('900 40px "Big Shoulders Display"'), document.fonts.load('800 40px "Bricolage Grotesque"')]).catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  cam.pos.fromArray(net.sky.map.title.camera);
  cam.look.fromArray(net.sky.map.title.look);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  // compile the shaders before the first frame, off the page's thread where the browser can
  try {
    await view.renderer.compileAsync(scene, camera);
  } catch {
    // the first frame compiles them instead
  }
  requestAnimationFrame(loop);
  if (ow) {
    sdk(() => ow.ui.setLook({ accent: PALETTE.gold, panel: PALETTE.ink, text: PALETTE.cream }));
    sdk(() =>
      ow.settings.on('change', () => {
        view.setQuality(quality());
        fx.setQuality(view.quality);
        resize();
      }),
    );
    sdk(() => ow.on('pause', () => pauseMig()));
    sdk(() => ow.on('reserved', () => layout()));
  }
  profile = await loadProfile();
  if (S.mode === 'title') screens.title({ best: profile.best, onFly: fly });
  const ok = await joinRoom();
  await fontsReady;
  if (!ok) {
    closeRoom('Connection lost', 'Rejoin');
    return;
  }
  // a reload mid-sunset carries on flying where it was
  const p = readPresence(room.me?.presence);
  if (p && p.st === 'fly' && S.mode === 'title') {
    placeLeader(p.x, p.z, p.yaw, p.y, net.sky.map);
    setMode('sky');
    screens.clear();
    controls(true);
    cam.pos.set(p.x - Math.cos(p.yaw) * 16, p.y + 6, p.z - Math.sin(p.yaw) * 16);
    screens.tapForSound(() => audio.start());
  }
  if (AUTO) {
    const skill = params.get('skill');
    if (SKILLS.includes(skill)) net.setSkill(skill);
    window.__bird = { fly, ff, jump, state: () => ({ mode: S.mode, n: me.n, time: net.sky.time, phase: net.sky.phase }) };
    if (params.get('fly') !== '0') setTimeout(() => S.mode === 'title' && fly(), 600);
  }
}

/** Autoplay only: run the game fast for `sec` seconds without drawing (the trailer jumps to its moments). */
function ff(sec) {
  const n = Math.round(sec * 30);
  const ok = audio.ok;
  audio.ok = false;
  for (let k = 0; k < n; k++) {
    ffOffset += 1000 / 30;
    tick(1 / 30);
  }
  audio.ok = ok;
  birds.reset();
  if (activeSky().phase === 'night') birds.setRoost(activeSky().map.roost, S.roostMap);
}
/** Autoplay only: the shared sky's clock to `sec` (the host's page). */
function jump(sec) {
  if (!net.authority) return;
  net.dawnAt = now() - sec * 1000;
}

boot();
