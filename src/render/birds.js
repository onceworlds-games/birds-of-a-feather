// Every bird you see. The rules only know each flock's shape (8 puffs); here each drawn bird is given a place in that shape and
// flies to it, so what you see is what the host judges. Birds move on a fixed 30 Hz step (a spring to their place, a little
// separation for flocks near the camera from a spatial hash), are drawn instanced in one call, and flap in the vertex shader.
// Steals hand birds from one flock to the other starting at the contact point (a ripple of colour); gathered birds burst up
// from their perch; the hawk and boosting knock birds loose.

import * as THREE from 'three';
import { PUFF_SHARE, SLOTS, GATHER } from '../sim/config.js';
import { songbirdGeometry, raptorGeometry, birdUniforms, birdLayer } from './birdmesh.js';
import { SPECIES } from '../sim/species.js';
import { newPuffs } from '../sim/flock.js';
import { wheelPos } from '../sim/maps.js';

const MAX = 4096;
const FLOCK_CAP = 760;
const WHEEL_CAP = 70;
const CLOUD_CAP = 90;
const STEP = 1 / 30;
const SIZE = 1.85; // a flock bird's size (the mesh is about 0.95 u long, 1.3 u across)
const ASH = new THREE.Color('#6C6672');
const INK = new THREE.Color('#231A2E');
const LOOK_KEYS = ['back', 'belly', 'head', 'accent', 'beak'];
const SPECIES_LOOK = SPECIES.map((sp) => ({ c: sp.c.map((h) => new THREE.Color(h)), shape: sp.shape }));
const WILD_LOOK = { c: ['#68616F', '#8A8290', '#5A5462', '#3E3846', '#C8A050'].map((h) => new THREE.Color(h)), shape: [1, 0, 1, 0] };
const HAWK_LOOK = { c: ['#5A3626', '#E8D4B4', '#4A2C20', '#2E1C16', '#E8B83A'].map((h) => new THREE.Color(h)), shape: [1, 0, 1, 0] };
const FREE = 0;
const IN_FLOCK = 1;
const IN_WHEEL = 2;
const IN_CLOUD = 3;
const LEAVING = 4;
const CUM = (() => {
  const c = [];
  let s = 0;
  for (const w of PUFF_SHARE) c.push((s += w));
  return c;
})();

// ------------------------------------------------------------------ the birds

export class Birds {
  constructor(scene, { lod = 'high', shadows = true } = {}) {
    this.uniforms = birdUniforms();
    const geo = songbirdGeometry(lod);
    this.fly = birdLayer(geo, this.uniforms, MAX, { shadows });
    this.perch = birdLayer(geo, this.uniforms, 2400, { shadows });
    this.lead = birdLayer(songbirdGeometry('high'), this.uniforms, 120, { lead: true, shadows });
    this.hawk = birdLayer(raptorGeometry(), this.uniforms, 2, { lead: true, shadows });
    for (const l of [this.fly, this.perch, this.lead, this.hawk]) scene.add(l.mesh);
    this.flairOf = new Map(); // flock id → flair index

    // the pool
    const f = () => new Float32Array(MAX);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.qx = f();
    this.qy = f();
    this.qz = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.ox = f();
    this.oy = f();
    this.oz = f();
    this.puff = new Uint8Array(MAX);
    this.phase = f();
    this.rate = f();
    this.swirl = f();
    this.kind = new Uint8Array(MAX);
    this.owner = new Int32Array(MAX); // flock index, wheel index, or cloud id
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.tr = f();
    this.tg = f();
    this.tb = f();
    this.delay = f(); // seconds before the colour switches
    this.flash = f();
    this.age = f();
    this.scale = f();
    this.bank = f(); // roll into the turn, eased
    this.fx_ = f(); // facing, eased toward the velocity
    this.fy_ = f();
    this.fz_ = f();
    this.beat = f(); // 0 cruising → 1 hurrying (faster wingbeats, no glides)
    this.seat = new Int32Array(MAX); // a flock bird's index in its flock (its place on a roost wire)
    this.sat = new Uint8Array(MAX); // 1: sitting on a roost wire
    this.roost = null;
    this.roostAssign = null;
    this.roostN = { x: 1, z: 0 };
    this.freeList = [];
    for (let i = MAX - 1; i >= 0; i--) this.freeList.push(i);
    this.live = []; // indices in use
    this.flocks = new Map(); // id → { id, idx, color, birds: [], puffs, short, over, slot }
    this.flockList = [];
    this.wheels = []; // per wheel: [bird indices]
    this.clouds = new Map(); // cloud id → [bird indices]
    this.acc = 0;
    this.time = 0;
    this.stepNo = 0;
    this.perchSum = -1;
    this.perchRid = -1;
    this.perchPrev = null;
    this.rng = 12345;
    this.events = [];
    this.hash = new Int32Array(4096);
    this.next = new Int32Array(MAX);
    this.camPos = new THREE.Vector3();
    this.tmpPuffs = newPuffs();
    this.tmp = {};
  }

  rand() {
    this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }

  alloc(x, y, z, kind, owner, color) {
    const i = this.freeList.pop();
    if (i === undefined) return -1;
    this.px[i] = this.qx[i] = x;
    this.py[i] = this.qy[i] = y;
    this.pz[i] = this.qz[i] = z;
    this.vx[i] = (this.rand() - 0.5) * 4;
    this.vy[i] = 2 + this.rand() * 3;
    this.vz[i] = (this.rand() - 0.5) * 4;
    // a random point in the unit ball
    let a;
    let b;
    let c;
    do {
      a = this.rand() * 2 - 1;
      b = this.rand() * 2 - 1;
      c = this.rand() * 2 - 1;
    } while (a * a + b * b + c * c > 1);
    this.ox[i] = a;
    this.oy[i] = b * 0.7;
    this.oz[i] = c;
    const r = this.rand();
    let k = 0;
    while (k < CUM.length - 1 && r > CUM[k]) k++;
    this.puff[i] = k;
    this.phase[i] = this.rand() * 6.283;
    this.rate[i] = 13 + this.rand() * 5;
    this.swirl[i] = (0.4 + this.rand() * 0.9) * (this.rand() < 0.5 ? -1 : 1);
    this.kind[i] = kind;
    this.owner[i] = owner;
    this.cr[i] = this.tr[i] = color.r;
    this.cg[i] = this.tg[i] = color.g;
    this.cb[i] = this.tb[i] = color.b;
    this.delay[i] = 0;
    this.flash[i] = 0;
    this.age[i] = 0;
    this.scale[i] = SIZE * (0.9 + this.rand() * 0.2);
    this.sat[i] = 0;
    this.bank[i] = 0;
    this.fx_[i] = this.vx[i];
    this.fy_[i] = this.vy[i] * 0.6;
    this.fz_[i] = this.vz[i];
    this.beat[i] = 0.5;
    this.live.push(i);
    return i;
  }

  recolor(i, color, delay, flash = true) {
    this.tr[i] = color.r;
    this.tg[i] = color.g;
    this.tb[i] = color.b;
    this.delay[i] = delay;
    if (flash) this.flash[i] = -1; // flashes when the switch happens
  }

  /** Events from the sky (the host's own, or the batches it sends). Applied on the next step. */
  push(events) {
    for (const e of events) if (e.type === 'steal' || e.type === 'shed' || e.type === 'strike' || e.type === 'scatter') this.events.push(e);
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
  }

  /** Clear everything (a new place, or a new sunset's dawn). */
  reset() {
    for (const i of this.live) {
      this.kind[i] = FREE;
      this.freeList.push(i);
    }
    this.live.length = 0;
    this.flocks.clear();
    this.wheels = [];
    this.clouds.clear();
    this.events.length = 0;
    this.perchSum = -1;
    this.perchPrev = null;
  }

  flockEntry(f) {
    let e = this.flocks.get(f.id);
    if (!e) {
      e = { id: f.id, birds: [], color: new THREE.Color(SLOTS[f.slot].hex), slot: f.slot, puffs: newPuffs(), short: 0, over: 0, fresh: true, far: false };
      this.flocks.set(f.id, e);
    }
    if (e.slot !== f.slot) {
      e.slot = f.slot;
      e.color.set(SLOTS[f.slot].hex);
      for (const i of e.birds) this.recolor(i, e.color, 0, false);
    }
    return e;
  }

  /** Move up to k birds of list `from` nearest P into `to`, with the colour switching outward from P. */
  handOver(from, to, k, x, y, z, color, speed = 22) {
    if (!from.length || k <= 0) return 0;
    const d = from.map((i) => [(this.px[i] - x) ** 2 + (this.py[i] - y) ** 2 + (this.pz[i] - z) ** 2, i]);
    d.sort((a, b) => a[0] - b[0]);
    const take = d.slice(0, Math.min(k, d.length));
    const set = new Set(take.map((t) => t[1]));
    for (let q = from.length - 1; q >= 0; q--) if (set.has(from[q])) from.splice(q, 1);
    for (const [dd, i] of take) {
      to.push(i);
      if (color) this.recolor(i, color, Math.sqrt(dd) / speed);
    }
    return take.length;
  }

  /** One step of the birds for the sky (and own flock `myId`, drawn with no delay, its shape from `myShape`). */
  update(dt, sky, cam, myId, myShape) {
    this.time += dt;
    this.uniforms.time.value = this.time;
    this.camPos.copy(cam.position);
    this.acc += Math.min(dt, 0.25);
    let stepped = false;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(sky, myId, myShape);
      stepped = true;
    }
    this.draw(this.acc / STEP, sky, stepped);
  }

  step(sky, myId, myShape) {
    this.stepNo++;
    const h = STEP;
    // flocks in and out
    const seen = new Set();
    for (const f of sky.flocks.values()) {
      const e = this.flockEntry(f);
      seen.add(f.id);
      if (f.id === myId && myShape) {
        for (let k = 0; k < 8; k++) Object.assign(e.puffs[k], myShape[k]);
      } else {
        for (let k = 0; k < 8; k++) Object.assign(e.puffs[k], f.puffs[k]);
      }
      e.n = Math.min(FLOCK_CAP, f.n);
      e.head = e.puffs[0];
      e.yaw = f.leader.yaw;
      const dx = e.head.x - this.camPos.x;
      const dz = e.head.z - this.camPos.z;
      e.far = dx * dx + dz * dz > 150 * 150;
    }
    for (const [id, e] of this.flocks) {
      if (seen.has(id)) continue;
      // gone: its birds wander off (a leaver's scatter event has already loosed them)
      for (const i of e.birds) this.leave(i);
      this.flocks.delete(id);
    }
    // events
    for (const e of this.events) this.apply(e, sky);
    this.events.length = 0;
    // perched birds taken: they burst up and join the flock that took them
    this.perches(sky);
    // counts
    for (const e of this.flocks.values()) this.reconcileFlock(e, sky);
    this.reconcileWild(sky);
    // every flock bird knows its flock by its index in this step's list
    this.flockList.length = 0;
    for (const e of this.flocks.values()) {
      const j = this.flockList.length;
      this.flockList.push(e);
      for (const i of e.birds) {
        this.kind[i] = IN_FLOCK;
        this.owner[i] = j;
      }
      e.wire = this.roost && this.roostAssign ? this.roostAssign.get(e.id) ?? -1 : -1;
      for (let q = 0; q < e.birds.length; q++) this.seat[e.birds[q]] = q;
    }
    // move
    this.buildHash();
    for (let q = 0; q < this.live.length; q++) {
      const i = this.live[q];
      this.qx[i] = this.px[i];
      this.qy[i] = this.py[i];
      this.qz[i] = this.pz[i];
      this.moveBird(i, h, sky);
    }
    // free the birds that have left
    let w = 0;
    for (let q = 0; q < this.live.length; q++) {
      const i = this.live[q];
      if (this.kind[i] === FREE) this.freeList.push(i);
      else this.live[w++] = i;
    }
    this.live.length = w;
  }

  leave(i) {
    this.kind[i] = LEAVING;
    this.age[i] = 0;
    this.recolor(i, ASH, 0.15, false);
  }

  apply(ev, sky) {
    if (ev.type === 'steal') {
      const a = this.flocks.get(ev.from);
      const b = this.flocks.get(ev.to);
      if (!a || !b) return;
      this.handOver(a.birds, b.birds, ev.k, ev.x, ev.y, ev.z, b.color);
    } else if (ev.type === 'shed' || ev.type === 'scatter') {
      const a = this.flocks.get(ev.id);
      if (!a) return;
      const moved = [];
      this.handOver(a.birds, moved, ev.k, ev.x, ev.y, ev.z, ASH, 30);
      for (const i of moved) {
        this.kind[i] = IN_CLOUD;
        this.owner[i] = -1; // adopted by the nearest cloud in reconcileWild
        this.vy[i] += 3;
      }
    } else if (ev.type === 'strike') {
      for (const [id, loss] of Object.entries(ev.losses)) {
        const a = this.flocks.get(id);
        if (!a || loss <= 0) continue;
        const moved = [];
        this.handOver(a.birds, moved, loss, ev.x, ev.y, ev.z, ASH, 60);
        for (const i of moved) {
          this.kind[i] = IN_CLOUD;
          this.owner[i] = -1;
          const dx = this.px[i] - ev.x;
          const dy = this.py[i] - ev.y;
          const dz = this.pz[i] - ev.z;
          const l = Math.hypot(dx, dy, dz) || 1;
          this.vx[i] += (dx / l) * 14;
          this.vy[i] += (dy / l) * 14 + 4;
          this.vz[i] += (dz / l) * 14;
        }
      }
    }
  }

  perches(sky) {
    const P = sky.map.perches;
    const cur = sky.perched;
    let sum = 0;
    for (let s = 0; s < cur.length; s++) if (cur[s]) sum += s + 1;
    if (sum === this.perchSum && this.perchRid === sky.rid) return;
    const prev = this.perchPrev;
    const fresh = !prev || prev.length !== cur.length || this.perchRid !== sky.rid;
    this.perchSum = sum;
    this.perchRid = sky.rid;
    if (!fresh) {
      for (let s = 0; s < cur.length; s++) {
        if (!prev[s] || cur[s]) continue;
        // taken: by the flock whose head is nearest
        let best = null;
        let bestD = 18 * 18;
        for (const e of this.flocks.values()) {
          const d = (e.head.x - P.x[s]) ** 2 + (e.head.z - P.z[s]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (!best || best.birds.length >= FLOCK_CAP) continue;
        const i = this.alloc(P.x[s], P.y[s] + 0.1, P.z[s], IN_FLOCK, 0, ASH);
        if (i < 0) break;
        this.vy[i] = 6 + this.rand() * 4;
        best.birds.push(i);
        this.recolor(i, best.color, 0.25 + this.rand() * 0.25);
      }
    }
    this.perchPrev = Uint8Array.from(cur);
    this.rebuildPerched(sky);
  }

  rebuildPerched(sky) {
    const P = sky.map.perches;
    const L = this.perch;
    let k = 0;
    const cap = L.pos.count;
    for (let s = 0; s < sky.perched.length && k < cap; s++) {
      if (!sky.perched[s]) continue;
      L.pos.array[k * 3] = P.x[s];
      L.pos.array[k * 3 + 1] = P.y[s] + 0.06;
      L.pos.array[k * 3 + 2] = P.z[s];
      // facing along the perch, a little random
      const yaw = P.yaw[s] + Math.PI / 2 + (((s * 7919) % 100) / 100 - 0.5) * 0.6 + ((s & 1) ? Math.PI : 0);
      L.fwd.array[k * 3] = Math.cos(yaw);
      L.fwd.array[k * 3 + 1] = 0.25;
      L.fwd.array[k * 3 + 2] = Math.sin(yaw);
      L.color.array[k * 3] = ASH.r;
      L.color.array[k * 3 + 1] = ASH.g;
      L.color.array[k * 3 + 2] = ASH.b;
      L.anim.array[k * 4] = (s * 1.618) % 6.283;
      L.anim.array[k * 4 + 1] = -1;
      L.anim.array[k * 4 + 2] = SIZE * 0.92;
      L.anim.array[k * 4 + 3] = 0;
      L.fx.array[k * 4] = 0;
      L.fx.array[k * 4 + 1] = 0;
      L.fx.array[k * 4 + 2] = 0;
      L.fx.array[k * 4 + 3] = 0;
      k++;
    }
    L.g.instanceCount = k;
    for (const a of L.attrs) a.needsUpdate = true;
  }

  /** Bring a flock's drawn birds to its count, from what's near (wheels, clouds) before making any from nothing. */
  reconcileFlock(e, sky) {
    const want = e.n;
    const have = e.birds.length;
    if (e.fresh) {
      e.fresh = false;
      e.short = 1;
    }
    if (have < want) {
      e.over = 0;
      e.short += STEP;
      // from a grey wheel or a loose cloud the head is in
      const need = want - have;
      let got = 0;
      for (let w = 0; w < this.wheels.length && got < need; w++) {
        const list = this.wheels[w];
        if (!list.length) continue;
        const p = wheelPos(sky.map, w, sky.clock, this.tmp);
        const r = GATHER.wheelRadiusBase + GATHER.wheelRadiusPerSqrt * Math.sqrt(sky.wheels[w]?.n ?? 0) + 6;
        if ((p.x - e.head.x) ** 2 + (p.z - e.head.z) ** 2 > r * r) continue;
        got += this.handOver(list, e.birds, need - got, e.head.x, e.head.y, e.head.z, e.color, 30);
      }
      for (const [id, list] of this.clouds) {
        if (got >= need) break;
        if (!list.length) continue;
        const i0 = list[0];
        if ((this.px[i0] - e.head.x) ** 2 + (this.pz[i0] - e.head.z) ** 2 > 20 * 20) continue;
        got += this.handOver(list, e.birds, need - got, e.head.x, e.head.y, e.head.z, e.color, 30);
        if (!list.length) this.clouds.delete(id);
      }
      for (let k = e.birds.length; k < want; k++) {
        if (got >= need) break;
        // nothing near to take them from: wait a moment for the event that explains them, then make them at the tail
        if (e.short < 0.3 && need < 40) break;
        const t = e.puffs[7];
        const i = this.alloc(t.x + (this.rand() - 0.5) * 3, t.y + (this.rand() - 0.5) * 2, t.z + (this.rand() - 0.5) * 3, IN_FLOCK, 0, e.color);
        if (i < 0) break;
        e.birds.push(i);
        got++;
      }
    } else if (have > want) {
      e.short = 0;
      e.over += STEP;
      if (e.over < 0.3 && have - want < 40) return;
      // birds the flock no longer has: the tail-most go
      const extra = have - want;
      const loose = e.birds.splice(e.birds.length - extra, extra);
      for (const i of loose) this.leave(i);
    } else {
      e.short = 0;
      e.over = 0;
    }
  }

  reconcileWild(sky) {
    // grey wheels
    while (this.wheels.length < sky.wheels.length) this.wheels.push([]);
    for (let w = 0; w < sky.wheels.length; w++) {
      const list = this.wheels[w];
      const want = Math.min(WHEEL_CAP, sky.wheels[w].n);
      if (list.length > want) for (const i of list.splice(want)) this.leave(i);
      if (list.length < want) {
        const p = wheelPos(sky.map, w, sky.clock, this.tmp);
        for (let k = list.length; k < want; k++) {
          const i = this.alloc(p.x + (this.rand() - 0.5) * 10, p.y + (this.rand() - 0.5) * 4, p.z + (this.rand() - 0.5) * 10, IN_WHEEL, w, ASH);
          if (i < 0) break;
          list.push(i);
        }
      }
    }
    // loose clouds: birds knocked loose (owner -1) join the nearest cloud
    const ids = new Set();
    for (const c of sky.loose) {
      ids.add(c.id);
      if (!this.clouds.has(c.id)) this.clouds.set(c.id, []);
    }
    for (const [id, list] of this.clouds) {
      if (ids.has(id)) continue;
      for (const i of list) this.leave(i);
      this.clouds.delete(id);
    }
    for (const i of this.live) {
      if (this.kind[i] !== IN_CLOUD || this.owner[i] !== -1) continue;
      let best = null;
      let bestD = Infinity;
      for (const c of sky.loose) {
        const p = sky.looseAt(c, this.tmp);
        const d = (p.x - this.px[i]) ** 2 + (p.z - this.pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best || bestD > 40 * 40) {
        this.age[i] += STEP;
        if (this.age[i] > 0.6) this.leave(i);
        continue;
      }
      this.owner[i] = best.id;
      this.clouds.get(best.id).push(i);
    }
    for (const c of sky.loose) {
      const list = this.clouds.get(c.id);
      const want = Math.min(CLOUD_CAP, c.n);
      if (list.length > want) for (const i of list.splice(want)) this.leave(i);
      if (list.length < want) {
        const p = sky.looseAt(c, this.tmp);
        for (let k = list.length; k < want; k++) {
          const i = this.alloc(p.x + (this.rand() - 0.5) * 6, p.y + (this.rand() - 0.5) * 3, p.z + (this.rand() - 0.5) * 6, IN_CLOUD, c.id, ASH);
          if (i < 0) break;
          list.push(i);
        }
      }
    }
  }

  buildHash() {
    this.hash.fill(-1);
    for (const e of this.flocks.values()) {
      if (e.far) continue;
      for (const i of e.birds) {
        const key = this.cell(this.px[i], this.py[i], this.pz[i]);
        this.next[i] = this.hash[key];
        this.hash[key] = i;
      }
    }
  }

  cell(x, y, z) {
    const cx = Math.floor(x / 1.4);
    const cy = Math.floor(y / 1.4);
    const cz = Math.floor(z / 1.4);
    return ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & 4095;
  }

  moveBird(i, h, sky) {
    const kind = this.kind[i];
    let tx;
    let ty;
    let tz;
    let k1 = 7;
    let near = false;
    const t = this.time * this.swirl[i];
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    // the bird's place, swirling slowly round its puff's centre
    const ox = this.ox[i] * cs - this.oz[i] * sn;
    const oz = this.ox[i] * sn + this.oz[i] * cs;
    const oy = this.oy[i] + 0.25 * Math.sin(t * 1.7 + this.phase[i]);
    if (kind === IN_FLOCK) {
      const e = this.flockById(i);
      if (!e) {
        this.leave(i);
        return;
      }
      if (e.far && this.stepNo % 2) return;
      if (e.far) h *= 2;
      near = !e.far;
      if (e.wire >= 0) {
        // night: a place on its roost wire, in two staggered rows when the flock is long
        const w = this.roost.wires[e.wire];
        const m = e.birds.length;
        const q = this.seat[i];
        const s = 0.05 + 0.9 * ((q + 0.5) / Math.max(1, m));
        const side = m > 90 ? ((q & 1) ? 0.22 : -0.22) : 0;
        tx = w.ax + (w.bx - w.ax) * s + this.roostN.x * side;
        ty = w.ay + (w.by - w.ay) * s - w.sag * 4 * s * (1 - s) + 0.2;
        tz = w.az + (w.bz - w.az) * s + this.roostN.z * side;
        const d2 = (tx - this.px[i]) ** 2 + (ty - this.py[i]) ** 2 + (tz - this.pz[i]) ** 2;
        if (this.sat[i] || d2 < 0.6) {
          this.sat[i] = 1;
          this.px[i] = tx;
          this.py[i] = ty;
          this.pz[i] = tz;
          this.vx[i] = this.vy[i] = this.vz[i] = 0;
          this.colorStep(i, h);
          return;
        }
        k1 = 2.2;
        near = false;
      } else {
        this.sat[i] = 0;
        const p = e.puffs[this.puff[i]];
        // a slow wave of breathing runs back through the flock, puff after puff
        const r = Math.max(1.4, p.r * 1.02) * (1 + 0.14 * Math.sin(this.time * 1.7 - this.puff[i] * 0.9));
        tx = p.x + ox * r;
        ty = p.y + oy * r;
        tz = p.z + oz * r;
      }
    } else if (kind === IN_WHEEL) {
      const p = wheelPos(sky.map, this.owner[i], sky.clock, this.tmp);
      const r = GATHER.wheelRadiusBase * 0.9;
      tx = p.x + ox * r;
      ty = p.y + oy * r * 0.6;
      tz = p.z + oz * r;
      k1 = 3;
    } else if (kind === IN_CLOUD) {
      const c = this.owner[i] >= 0 ? this.cloudById(this.owner[i], sky) : null;
      if (c) {
        const p = sky.looseAt(c, this.tmp);
        const r = GATHER.looseRadius * 0.8;
        tx = p.x + ox * r;
        ty = p.y + oy * r;
        tz = p.z + oz * r;
        k1 = 2.5;
      } else {
        tx = this.px[i] + this.vx[i] * 0.2;
        ty = this.py[i] - 0.5;
        tz = this.pz[i] + this.vz[i] * 0.2;
        k1 = 1;
      }
    } else if (kind === LEAVING) {
      this.age[i] += h;
      this.scale[i] = SIZE * Math.max(0, 1 - this.age[i] / 1.4);
      tx = this.px[i] + this.vx[i] * 0.5 + ox * 4;
      ty = this.py[i] + 3;
      tz = this.pz[i] + this.vz[i] * 0.5 + oz * 4;
      k1 = 1.5;
      if (this.age[i] > 1.4) {
        this.kind[i] = FREE;
        return;
      }
    } else return;
    // spring to the place (a little under-damped: birds overshoot and swirl)
    const kd = 2 * Math.sqrt(k1) * 0.8;
    let ax = (tx - this.px[i]) * k1 - this.vx[i] * kd;
    let ay = (ty - this.py[i]) * k1 - this.vy[i] * kd;
    let az = (tz - this.pz[i]) * k1 - this.vz[i] * kd;
    // keep a little apart from neighbours (near flocks only)
    if (near) {
      const x = this.px[i];
      const y = this.py[i];
      const z = this.pz[i];
      let j = this.hash[this.cell(x, y, z)];
      let guard = 0;
      while (j >= 0 && guard++ < 12) {
        if (j !== i) {
          const dx = x - this.px[j];
          const dy = y - this.py[j];
          const dz = z - this.pz[j];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 1.69 && d2 > 1e-6) {
            const s = (1.3 - Math.sqrt(d2)) * 16;
            ax += dx * s;
            ay += dy * s;
            az += dz * s;
          }
        }
        j = this.next[j];
      }
    }
    this.vx[i] += ax * h;
    this.vy[i] += ay * h;
    this.vz[i] += az * h;
    const sp = Math.hypot(this.vx[i], this.vy[i], this.vz[i]);
    if (sp > 45) {
      const k = 45 / sp;
      this.vx[i] *= k;
      this.vy[i] *= k;
      this.vz[i] *= k;
    }
    // facing eases after the velocity; the bird rolls into the turn and beats harder when it hurries or climbs
    this.fx_[i] += (this.vx[i] - this.fx_[i]) * 0.3;
    this.fy_[i] += (this.vy[i] * 0.5 - this.fy_[i]) * 0.3;
    this.fz_[i] += (this.vz[i] - this.fz_[i]) * 0.3;
    const hs = Math.hypot(this.vx[i], this.vz[i]) + 1e-3;
    const lat = (-ax * this.vz[i] + az * this.vx[i]) / hs;
    const tb = Math.max(-1.1, Math.min(1.1, -lat * 0.035));
    this.bank[i] += (tb - this.bank[i]) * 0.18;
    const want = Math.max(0, Math.min(1, (sp - 15) / 18 + Math.max(0, this.vy[i]) / 10));
    this.beat[i] += (want - this.beat[i]) * 0.1;
    this.px[i] += this.vx[i] * h;
    this.py[i] += this.vy[i] * h;
    this.pz[i] += this.vz[i] * h;
    this.colorStep(i, h);
  }

  /** Colour: switches after its delay, with a flash. */
  colorStep(i, h) {
    if (this.delay[i] > 0) this.delay[i] -= h;
    else {
      if (this.flash[i] < 0) this.flash[i] = this.noFlash ? 0 : 1;
      const a = Math.min(1, h * 10);
      this.cr[i] += (this.tr[i] - this.cr[i]) * a;
      this.cg[i] += (this.tg[i] - this.cg[i]) * a;
      this.cb[i] += (this.tb[i] - this.cb[i]) * a;
    }
    if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - h * 3);
  }

  /** Night: the flocks in `assign` (id → wire index) land on the roost's wires; null takes them back to the sky. */
  setRoost(roost, assign = null) {
    this.roost = roost;
    this.roostAssign = assign;
    if (roost) {
      const dx = roost.camera[0] - roost.x;
      const dz = roost.camera[2] - roost.z;
      const l = Math.hypot(dx, dz) || 1;
      this.roostN.x = dx / l;
      this.roostN.z = dz / l;
    } else {
      for (const i of this.live) this.sat[i] = 0;
    }
  }

  flockById(i) {
    return this.flockList[this.owner[i]] ?? null;
  }

  cloudById(id, sky) {
    for (const c of sky.loose) if (c.id === id) return c;
    return null;
  }

  draw(alpha, sky, stepped) {
    const L = this.fly;
    let k = 0;
    const P = L.pos.array;
    const F = L.fwd.array;
    const C = L.color.array;
    const A = L.anim.array;
    const X = L.fx.array;
    for (let q = 0; q < this.live.length; q++) {
      const i = this.live[q];
      if (this.kind[i] === FREE || this.scale[i] <= 0.02) continue;
      P[k * 3] = this.qx[i] + (this.px[i] - this.qx[i]) * alpha;
      P[k * 3 + 1] = this.qy[i] + (this.py[i] - this.qy[i]) * alpha;
      P[k * 3 + 2] = this.qz[i] + (this.pz[i] - this.qz[i]) * alpha;
      if (stepped) {
        const sat = this.sat[i] && this.kind[i] === IN_FLOCK;
        F[k * 3] = sat ? this.roostN.x : this.fx_[i];
        F[k * 3 + 1] = sat ? 0.25 : this.fy_[i];
        F[k * 3 + 2] = sat ? this.roostN.z : this.fz_[i];
        C[k * 3] = this.cr[i];
        C[k * 3 + 1] = this.cg[i];
        C[k * 3 + 2] = this.cb[i];
        A[k * 4] = this.phase[i];
        A[k * 4 + 1] = sat ? -1 : this.rate[i] * (1 + this.beat[i]);
        A[k * 4 + 2] = this.scale[i];
        A[k * 4 + 3] = sat ? 0 : this.bank[i];
        X[k * 4] = this.flash[i];
        X[k * 4 + 1] = this.kind[i] === IN_FLOCK ? this.flairOf.get(this.flockList[this.owner[i]]?.id) ?? 0 : 0;
        X[k * 4 + 2] = this.beat[i] > 0.15 ? -1 : 0;
        X[k * 4 + 3] = 0;
      }
      k++;
    }
    L.g.instanceCount = k;
    L.pos.needsUpdate = true;
    if (stepped) for (const a of L.attrs) a.needsUpdate = true;
  }

  /** Light the birds like the scene. */
  setLight(light, scene) {
    const u = this.uniforms;
    u.sunDir.value.copy(light.sunDir);
    u.sunColor.value.copy(light.sun).multiplyScalar(light.sunI * 0.5);
    u.hemiSky.value.copy(light.hemiSky).multiplyScalar(light.hemiI);
    u.hemiGround.value.copy(light.hemiGround).multiplyScalar(light.hemiI);
    u.glow.value = light.glow;
    u.fogColor.value.copy(scene.fog.color);
    u.fogDensity.value = scene.fog.density;
  }

  /**
   * The lead birds and rare birds: [{ x, y, z, yaw, pitch, bank, color, scale, flap, species, fold, flash }]. Each is drawn as
   * its species (the starling unless it says).
   */
  setLeaders(list) {
    this.fillLead(this.lead, list);
  }

  /** The hawk (or nothing): { x, y, z, yaw, pitch, bank, scale, flap, fold }. */
  setHawk(h) {
    this.fillLead(this.hawk, h ? [h] : [], HAWK_LOOK);
  }

  fillLead(L, list, look = null) {
    let k = 0;
    for (const b of list) {
      if (k >= L.count) break;
      L.pos.array[k * 3] = b.x;
      L.pos.array[k * 3 + 1] = b.y;
      L.pos.array[k * 3 + 2] = b.z;
      const cp = Math.cos(b.pitch ?? 0);
      L.fwd.array[k * 3] = Math.cos(b.yaw) * cp;
      L.fwd.array[k * 3 + 1] = Math.sin(b.pitch ?? 0);
      L.fwd.array[k * 3 + 2] = Math.sin(b.yaw) * cp;
      L.color.array[k * 3] = b.color?.r ?? 1;
      L.color.array[k * 3 + 1] = b.color?.g ?? 1;
      L.color.array[k * 3 + 2] = b.color?.b ?? 1;
      L.anim.array[k * 4] = b.phase ?? k;
      L.anim.array[k * 4 + 1] = b.flap ?? 11;
      L.anim.array[k * 4 + 2] = b.scale ?? 4;
      L.anim.array[k * 4 + 3] = b.bank ?? 0;
      L.fx.array[k * 4] = b.flash ?? 0;
      L.fx.array[k * 4 + 1] = b.flair ?? 0;
      L.fx.array[k * 4 + 2] = b.glide ?? 0;
      L.fx.array[k * 4 + 3] = b.fold ?? 0;
      const sp = look ?? (b.species === -1 ? WILD_LOOK : SPECIES_LOOK[b.species ?? 0] ?? SPECIES_LOOK[0]);
      for (let c = 0; c < 5; c++) {
        const arr = L[LOOK_KEYS[c]].array;
        arr[k * 3] = sp.c[c].r;
        arr[k * 3 + 1] = sp.c[c].g;
        arr[k * 3 + 2] = sp.c[c].b;
      }
      L.shape.array[k * 4] = sp.shape[0];
      L.shape.array[k * 4 + 1] = sp.shape[1];
      L.shape.array[k * 4 + 2] = sp.shape[2];
      L.shape.array[k * 4 + 3] = sp.shape[3];
      k++;
    }
    L.g.instanceCount = k;
    for (const a of L.attrs) a.needsUpdate = true;
  }

  /** How many birds of a flock are drawn (for tests and the poster). */
  drawn(id) {
    return this.flocks.get(id)?.birds.length ?? 0;
  }
}

