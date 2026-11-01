// One whole sky: flocks, wild birds, the hawk, the sunset clock and the rival flocks, stepped at a fixed rate.
// The host's page runs it for the shared sky; a Migration runs it on the player's own page; node tests run thousands.
// Players' lead birds are fed in from outside (`feed`); rivals fly here. Everything that happens is pushed to `events`.
// Every other page keeps a mirror (`authority` false): the host's counts and wild birds are copied in, every leader is fed from
// presence, and only the flocks' shapes are worked out here (to draw them). A mirror becomes the real thing with `takeOver`.

import { FLOCK, GATHER, STEAL, PEEL, HAWK, ROUND, SKY, FLIGHT, PERSONALITIES, PERSONALITY_ORDER, SLOTS, RARE, ROTATION, PLACE_TWIST } from './config.js';
import { SPECIES, dealSpecies } from './species.js';
import { getMap, forPerchesNear, dealPerches, wheelPos, surfaceAt } from './maps.js';
import { makeRng, hashString, clamp, angleDiff } from './rng.js';
import { Trail, shapeOf, newPuffs, localCount, contactOf, boundsOf, dist3, puffRadius } from './flock.js';
import { newLeader, stepLeader, band } from './flight.js';
import { makeBrain, rivalInput } from './rivals.js';

const STEP = 1 / SKY.flightHz;
const RULE = 1 / SKY.ruleHz;

export class Sky {
  constructor(opts = {}) {
    this.opts = {
      mapId: 'saltmere',
      seed: 1,
      rid: 1,
      skill: 'normal',
      day: ROUND.day,
      night: ROUND.night,
      wild: 1000,
      wheelBirds: 40,
      hawkFirst: HAWK.first,
      hawkEvery: HAWK.every,
      hawkLateEvery: HAWK.lateEvery,
      twist: null,
      judgeDelay: 0,
      rivalTarget: SKY.flocks,
      autoRivals: true,
      loop: true, // a new dawn follows the night (false: the sky stops at sundown, as a Migration does)
      rotate: false, // each dawn moves the sky to the next place (the shared sky)
      rares: RARE.perSunset,
      ...opts,
    };
    this.map = getMap(this.opts.mapId);
    this.baseSeed = this.opts.seed;
    this.rid = this.opts.rid;
    this.skill = this.opts.skill;
    this.clock = 0;
    this.time = 0;
    this.parked = false;
    this.phase = 'day';
    this.flocks = new Map();
    this.order = [];
    this.events = [];
    this.pairs = new Map();
    this.loose = [];
    this.cloudSeq = 1;
    this.spawnSeq = 1;
    this.protected = new Set();
    this.standings = null;
    this.stepAcc = 0;
    this.ruleAcc = 0;
    this.storm = this.opts.twist === 'storm' ? { front: -330, depth: 80, speed: 4 } : null;
    this.authority = opts.authority ?? true;
    this.reseed();
    this.deal();
    this.resetHawk();
  }

  reseed() {
    this.seed = hashString(`${this.baseSeed}:${this.rid}`);
    this.rng = makeRng(`${this.seed}:rules`);
    this.rivalRng = makeRng(`${this.seed}:rivals`);
  }

  /** Wild birds for a new sunset: perched runs, and the grey wheels. */
  deal() {
    const map = this.map;
    this.perched = dealPerches(map, this.seed, this.opts.wild);
    this.groupLive = new Int16Array(map.groups.length);
    for (let s = 0; s < map.perches.count; s++) if (this.perched[s]) this.groupLive[map.perches.group[s]]++;
    this.wheels = map.wheels.map(() => ({ n: this.opts.wheelBirds }));
    this.loose = [];
    this.dealRares();
  }

  /** Rare birds on landmarks for this sunset: { species, x, y, z, n (the greys with it), by (who caught it, or null) }. */
  dealRares() {
    const rng = makeRng(`${this.seed}:rares`);
    const spots = rng.shuffle(this.map.landmarks ?? []).slice(0, this.opts.rares);
    this.rares = spots.map((p) => {
      const species = dealSpecies(rng);
      return { species, x: p.x, y: p.y, z: p.z, n: RARE.birds[SPECIES[species].rarity], by: null };
    });
  }

  /** Move the sky to another place (a new dawn follows; the shared sky's turn, or a mirror catching up with its host). */
  setMap(mapId) {
    if (mapId === this.opts.mapId) return;
    this.opts.mapId = mapId;
    this.map = getMap(mapId);
    this.opts.twist = PLACE_TWIST[mapId] ?? null;
    this.storm = this.opts.twist === 'storm' ? { front: -330, depth: 80, speed: 4 } : null;
    this.deal();
  }

  resetHawk() {
    this.hawk = { phase: 'wait', target: null, t0: 0, circleStart: -1, aim: null, nextAt: this.opts.hawkFirst };
  }

  // ---------------------------------------------------------------- flocks

  freeSlot() {
    const used = new Set([...this.flocks.values()].map((f) => f.slot));
    for (let s = 0; s < SLOTS.length; s++) if (!used.has(s)) return s;
    return 0;
  }

  /** The spawn point farthest from every other flock. */
  pickSpawn() {
    let best = this.map.spawns[0];
    let bestD = -1;
    for (const sp of this.map.spawns) {
      let near = Infinity;
      for (const f of this.flocks.values()) near = Math.min(near, Math.hypot(f.leader.x - sp.x, f.leader.z - sp.z));
      if (near > bestD) {
        bestD = near;
        best = sp;
      }
    }
    return best;
  }

  addFlock(id, o = {}) {
    if (this.flocks.has(id)) return this.flocks.get(id);
    if (this.flocks.size >= SKY.maxFlocks) return null;
    const sp = o.spawn ?? this.pickSpawn();
    const leader = newLeader(sp.x, sp.z, sp.yaw, this.map);
    if (Number.isFinite(sp.y)) leader.y = sp.y;
    const f = {
      id,
      kind: o.kind === 'rival' ? 'rival' : 'player',
      name: String(o.name ?? id).slice(0, 24),
      slot: Number.isInteger(o.slot) && !this.slotTaken(o.slot) ? o.slot : this.freeSlot(),
      n: o.n ?? FLOCK.start,
      trail: new Trail(),
      lag: o.kind === 'rival' || o.local ? this.opts.judgeDelay : 0,
      leader,
      brain: o.kind === 'rival' ? makeBrain(o.personality, o.skill ?? this.skill) : null,
      personality: o.kind === 'rival' ? o.personality : null,
      shieldUntil: this.clock + STEAL.shield,
      away: false,
      peelAcc: 0,
      stormAcc: 0,
      shedCloud: null,
      acc: {},
      puffs: newPuffs(),
      head: { x: leader.x, y: leader.y, z: leader.z },
      spawn: { x: sp.x, z: sp.z, yaw: sp.yaw, y: leader.y, token: this.spawnSeq++ },
      lastFeed: null,
      stats: { maxN: o.n ?? FLOCK.start, gathered: 0, stolen: 0, lostSteal: 0, lostHawk: 0, shed: 0, rares: 0 },
    };
    f.trail.reset(this.clock, leader.x, leader.y, leader.z);
    this.flocks.set(id, f);
    this.order = [...this.flocks.keys()].sort();
    this.shape(f);
    this.events.push({ type: 'spawn', id, x: sp.x, z: sp.z, yaw: sp.yaw, token: f.spawn.token });
    return f;
  }

  slotTaken(slot) {
    for (const f of this.flocks.values()) if (f.slot === slot) return true;
    return false;
  }

  /** Take a flock out. Its birds burst into a loose cloud where it was. */
  removeFlock(id, disperse = true) {
    const f = this.flocks.get(id);
    if (!f) return;
    if (disperse && f.n > 0) {
      const c = this.addCloud(f.head.x, f.head.y, f.head.z, 0, 0, f.n);
      this.events.push({ type: 'scatter', id, k: f.n, cloud: c.id, x: f.head.x, y: f.head.y, z: f.head.z });
    }
    this.flocks.delete(id);
    this.order = [...this.flocks.keys()].sort();
    for (const key of [...this.pairs.keys()]) if (key.split('|').includes(id)) this.pairs.delete(key);
  }

  /** Rivals keep the sky at `rivalTarget` flocks: added any time, taken away only at dawn (or `now`). */
  fillRivals(removeNow = false, disperse = true) {
    if (!this.opts.autoRivals) return;
    const players = [...this.flocks.values()].filter((f) => f.kind === 'player').length;
    const rivals = [...this.flocks.values()].filter((f) => f.kind === 'rival');
    const want = clamp(this.opts.rivalTarget - players, 0, SKY.maxFlocks - players);
    if (rivals.length < want) {
      for (let k = rivals.length; k < want; k++) this.addRival();
    } else if (removeNow && rivals.length > want) {
      const extra = rivals.sort((a, b) => a.n - b.n).slice(0, rivals.length - want);
      for (const r of extra) this.removeFlock(r.id, disperse);
    }
  }

  addRival(o = {}) {
    let k = 1;
    while (this.flocks.has(`r${k}`)) k++;
    const id = `r${k}`;
    const personality = o.personality ?? PERSONALITY_ORDER[(k - 1) % PERSONALITY_ORDER.length];
    const used = new Set([...this.flocks.values()].map((f) => f.name));
    const pool = PERSONALITIES[personality].names;
    const name = o.name ?? pool.find((n) => !used.has(n)) ?? `${pool[0]} ${k}`;
    return this.addFlock(id, { kind: 'rival', name, personality, skill: o.skill ?? this.skill, spawn: o.spawn });
  }

  setSkill(skill) {
    this.skill = skill;
    for (const f of this.flocks.values()) if (f.brain) f.brain.skill = skill;
  }

  /** A lead bird where its page says it is (already validated). The real sky takes only players this way; a mirror takes all. */
  feed(id, x, y, z, yaw, boosting) {
    const f = this.flocks.get(id);
    if (!f || (this.authority && f.kind !== 'player')) return;
    if (![x, y, z, yaw].every(Number.isFinite)) return;
    const L = f.leader;
    const last = f.lastFeed;
    const t = this.clock;
    if (last) {
      const dt = Math.max(1e-3, t - last.t);
      const d = Math.hypot(x - last.x, z - last.z);
      if (d > FLIGHT.teleport) {
        f.trail.reset(t, x, y, z);
      } else {
        const max = FLIGHT.maxLegalSpeed * dt + 1;
        if (d > max) {
          x = last.x + ((x - last.x) / d) * max;
          z = last.z + ((z - last.z) / d) * max;
        }
        L.speed = L.speed * 0.7 + (Math.min(d, max) / dt) * 0.3;
      }
      L.boostTime = boosting ? L.boostTime + dt : 0;
    }
    f.trail.push(t, x, y, z);
    L.x = x;
    L.y = y;
    L.z = z;
    L.yaw = yaw;
    L.boosting = !!boosting;
    f.lastFeed = { t, x, z };
  }

  /**
   * This page becomes the host: rival flocks fly on from where this mirror last drew them (their paths kept, so their shapes
   * don't jump), with fresh minds.
   */
  takeOver() {
    if (this.authority) return;
    this.authority = true;
    const p0 = {};
    const p1 = {};
    for (const f of this.flocks.values()) {
      f.lastFeed = null;
      if (f.kind !== 'rival') continue;
      f.trail.newest(p0);
      f.trail.sample(p0.t - 0.2, p1);
      const yaw = Math.hypot(p0.x - p1.x, p0.z - p1.z) > 0.2 ? Math.atan2(p0.z - p1.z, p0.x - p1.x) : f.leader.yaw;
      const L = newLeader(p0.x, p0.z, Number.isFinite(yaw) ? yaw : 0, this.map);
      L.y = p0.y;
      f.leader = L;
      f.brain = makeBrain(f.personality, this.skill);
      f.lag = this.opts.judgeDelay;
    }
    this.pairs.clear();
  }

  /** This page stops being the host. */
  becomeMirror() {
    this.authority = false;
    for (const f of this.flocks.values()) {
      f.lag = 0;
      f.lastFeed = null;
    }
  }

  // ---------------------------------------------------------------- time

  /** Step by dt seconds (fixed steps inside). */
  advance(dt) {
    this.stepAcc += clamp(dt, 0, 0.5);
    while (this.stepAcc >= STEP - 1e-9) {
      this.stepAcc -= STEP;
      this.fixedStep(STEP);
    }
  }

  /** A mirror: the host's clock, and the flocks' shapes for drawing. */
  mirrorTo(clock, parked, phase) {
    this.clock = clock;
    this.parked = parked;
    this.time = parked ? ROUND.parkedTime : clock;
    this.phase = phase;
    for (const id of this.order) this.shape(this.flocks.get(id));
  }

  /** Step until the clock reads `clock` (a big gap jumps instead). */
  advanceTo(clock) {
    const gap = clock - this.clock;
    if (gap > 1.5) {
      this.clock = clock - 0.1;
      if (!this.parked) this.time = this.clock;
      this.advance(0.1);
    } else if (gap > 0) this.advance(gap);
  }

  fixedStep(h) {
    this.clock += h;
    if (!this.parked) this.time = this.clock;
    if (!this.authority) return;
    for (const id of this.order) {
      const f = this.flocks.get(id);
      if (f.kind === 'rival') {
        const input = this.phase === 'night' ? this.roostInput(f) : rivalInput(this, f, this.rivalRng);
        stepLeader(f.leader, input, h, this.map, null, f.n);
      } else if (f.away) {
        // a player whose connection dropped: their flock circles where it was until they're back
        stepLeader(f.leader, AWAY_INPUT, h, this.map, null, f.n);
      } else continue;
      f.trail.push(this.clock, f.leader.x, f.leader.y, f.leader.z);
    }
    this.ruleAcc += h;
    if (this.ruleAcc >= RULE - 1e-9) {
      this.ruleAcc -= RULE;
      this.ruleTick(RULE);
    }
  }

  /** At night rivals glide home toward the roost. */
  roostInput(f) {
    const r = this.map.roost;
    const want = Math.atan2(r.z - f.leader.z, r.x - f.leader.x);
    const d = Math.hypot(r.x - f.leader.x, r.z - f.leader.z);
    return { turn: clamp(angleDiff(f.leader.yaw, want) / 0.5, -1, 1) * (d > 30 ? 1 : 0.6), climb: 0, boost: false };
  }

  park() {
    if (this.parked) return;
    this.parked = true;
    this.time = ROUND.parkedTime;
    this.resetHawk();
  }

  /** A parked sky wakes with a fresh dawn. */
  unpark() {
    if (!this.parked) return;
    this.parked = false;
    this.dawn();
  }

  shape(f) {
    const t = this.clock - f.lag;
    f.trail.sample(t, f.head);
    shapeOf(f.trail, f.n, t, f.puffs);
  }

  ruleTick(dt) {
    for (const id of this.order) {
      this.shape(this.flocks.get(id));
    }
    if (this.phase === 'day') {
      this.gather(dt);
      this.steals(dt);
      this.peel(dt);
      this.looseClouds(dt);
      if (this.storm && !this.parked) this.stormTick(dt);
      if (!this.parked) this.hawkTick();
    } else {
      this.looseClouds(dt);
    }
    for (const id of this.order) {
      const f = this.flocks.get(id);
      if (f.n > f.stats.maxN) f.stats.maxN = f.n;
    }
    if (!this.parked) {
      if (this.phase === 'day' && this.time >= this.opts.day) this.sundown();
      else if (this.phase === 'night' && this.opts.loop && this.time >= this.opts.day + this.opts.night) this.dawn();
    }
  }

  // ---------------------------------------------------------------- gathering

  gather(dt) {
    const map = this.map;
    const P = map.perches;
    const take = [];
    for (const id of this.order) {
      const f = this.flocks.get(id);
      if (f.away) continue;
      const h = f.head;
      take.length = 0;
      if (canGather(map, h)) {
        forPerchesNear(map, h.x, h.z, GATHER.radius, (s) => {
          if (this.perched[s] && P.y[s] <= h.y + GATHER.over) take.push(s);
        });
      }
      if (take.length) {
        for (const s of take) {
          this.perched[s] = 0;
          this.groupLive[P.group[s]]--;
        }
        f.n += take.length;
        f.stats.gathered += take.length;
        this.events.push({ type: 'join', id, k: take.length, perches: take.slice(), x: h.x, y: h.y, z: h.z });
      }
      for (const r of this.rares) {
        if (r.by || Math.hypot(h.x - r.x, h.z - r.z) > RARE.radius || h.y < r.y - RARE.below || h.y > r.y + RARE.above) continue;
        r.by = id;
        const k = r.n;
        r.n = 0;
        f.n += k;
        f.stats.gathered += k;
        f.stats.rares = (f.stats.rares ?? 0) + 1;
        this.events.push({ type: 'rare', id, species: r.species, k, x: r.x, y: r.y, z: r.z });
      }
      for (let w = 0; w < this.wheels.length; w++) {
        const W = this.wheels[w];
        if (W.n <= 0) continue;
        const p = wheelPos(map, w, this.clock, tmpA);
        const r = GATHER.wheelRadiusBase + GATHER.wheelRadiusPerSqrt * Math.sqrt(W.n);
        const key = `w${w}`;
        if (dist3(h.x, h.y, h.z, p.x, p.y, p.z) < r) {
          f.acc[key] = (f.acc[key] ?? 0) + GATHER.wheelRate * dt;
          const k = Math.min(W.n, Math.floor(f.acc[key]));
          if (k > 0) {
            f.acc[key] -= k;
            W.n -= k;
            f.n += k;
            f.stats.gathered += k;
            this.events.push({ type: 'join', id, k, wheel: w, x: p.x, y: p.y, z: p.z });
          }
        } else f.acc[key] = 0;
      }
    }
  }

  addCloud(x, y, z, vx, vz, n, owners = null) {
    const c = { id: this.cloudSeq++, x, y, z, vx, vz, t0: this.clock, n, owners };
    this.loose.push(c);
    return c;
  }

  /** Where a loose cloud is now. */
  looseAt(c, out) {
    const age = this.clock - c.t0;
    out.x = c.x + c.vx * age;
    out.z = c.z + c.vz * age;
    const floor = surfaceAt(this.map, out.x, out.z) + 3;
    out.y = Math.max(floor, c.y - GATHER.looseSink * age);
    return out;
  }

  looseClouds(dt) {
    if (!this.loose.length) return;
    const keep = [];
    for (const c of this.loose) {
      const p = this.looseAt(c, tmpA);
      if (this.phase === 'day') {
        for (const id of this.order) {
          const f = this.flocks.get(id);
          if (f.away || c.n <= 0) continue;
          if (c.owners && c.owners.includes(id) && this.clock - c.t0 < GATHER.ownerShy) continue;
          const key = `c${c.id}`;
          if (dist3(f.head.x, f.head.y, f.head.z, p.x, p.y, p.z) < GATHER.looseRadius + Math.sqrt(c.n) * 0.3) {
            f.acc[key] = (f.acc[key] ?? 0) + GATHER.looseRate * dt;
            const k = Math.min(c.n, Math.floor(f.acc[key]));
            if (k > 0) {
              f.acc[key] -= k;
              c.n -= k;
              f.n += k;
              f.stats.gathered += k;
              this.events.push({ type: 'join', id, k, cloud: c.id, x: p.x, y: p.y, z: p.z });
            }
          }
        }
      }
      if (c.n <= 0) continue;
      if (this.clock - c.t0 >= GATHER.looseLife) this.rePerch(c, p);
      else keep.push(c);
    }
    this.loose = keep;
  }

  /** A cloud's last birds land on the nearest free perches. */
  rePerch(c, p) {
    const map = this.map;
    const P = map.perches;
    const found = [];
    for (let r = 24; r <= 200 && found.length < c.n; r *= 2) {
      found.length = 0;
      forPerchesNear(map, p.x, p.z, r, (s) => {
        if (!this.perched[s]) found.push(s);
      });
    }
    found.sort((a, b) => Math.hypot(P.x[a] - p.x, P.z[a] - p.z) - Math.hypot(P.x[b] - p.x, P.z[b] - p.z));
    const land = found.slice(0, c.n);
    for (const s of land) {
      this.perched[s] = 1;
      this.groupLive[P.group[s]]++;
    }
    const rest = c.n - land.length;
    if (rest > 0) {
      let w = 0;
      for (let k = 1; k < this.wheels.length; k++) if (this.wheels[k].n < this.wheels[w].n) w = k;
      if (this.wheels.length) this.wheels[w].n += rest;
    }
    this.events.push({ type: 'perch', cloud: c.id, perches: land, k: c.n });
    c.n = 0;
  }

  // ---------------------------------------------------------------- stealing

  steals(dt) {
    const ids = this.order;
    for (let i = 0; i < ids.length; i++) {
      const A = this.flocks.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const B = this.flocks.get(ids[j]);
        if (A.n < 1 && B.n < 1) continue;
        if (A.shieldUntil > this.clock || B.shieldUntil > this.clock) continue;
        boundsOf(A.puffs, bA);
        boundsOf(B.puffs, bB);
        if (dist3(bA.x, bA.y, bA.z, bB.x, bB.y, bB.z) > bA.r + bB.r) continue;
        const c = contactOf(A.puffs, B.puffs, tmpC);
        if (!c) continue;
        const res = resolveContact(A.puffs, B.puffs, c);
        const key = `${A.id}|${B.id}`;
        let pair = this.pairs.get(key);
        if (!pair) this.pairs.set(key, (pair = { acc: 0, last: -9, total: 0, dir: 0, startA: A.n, startB: B.n }));
        if (this.clock - pair.last > STEAL.passGap) {
          pair.total = 0;
          pair.acc = 0;
          pair.dir = 0;
          pair.startA = A.n;
          pair.startB = B.n;
        }
        pair.last = this.clock;
        if (!res.winner) continue;
        const W = res.winner === 'a' ? A : B;
        const Lo = res.winner === 'a' ? B : A;
        const dir = res.winner === 'a' ? 1 : -1;
        if (pair.dir !== dir) {
          pair.acc = 0;
          pair.total = 0;
          pair.dir = dir;
        }
        pair.acc += Math.min(res.rate * dt, res.loserLocal);
        const k = Math.min(Math.floor(pair.acc), Lo.n);
        if (k <= 0) continue;
        pair.acc -= k;
        Lo.n -= k;
        W.n += k;
        pair.total += k;
        W.stats.stolen += k;
        Lo.stats.lostSteal += k;
        const startW = dir === 1 ? pair.startA : pair.startB;
        const startL = dir === 1 ? pair.startB : pair.startA;
        this.events.push({
          type: 'steal',
          from: Lo.id,
          to: W.id,
          k,
          x: c.x,
          y: c.y,
          z: c.z,
          lw: Math.round(res.winnerLocal),
          ll: Math.round(res.loserLocal),
          pass: pair.total,
          bigger: startL > startW,
        });
      }
    }
  }

  // ---------------------------------------------------------------- boosting sheds birds

  peel(dt) {
    for (const id of this.order) {
      const f = this.flocks.get(id);
      const L = f.leader;
      if (!(L.boosting && L.boostTime > FLIGHT.freeBoost && f.n > PEEL.minFlock)) {
        f.peelAcc = 0;
        continue;
      }
      f.peelAcc += Math.max(PEEL.rate * f.n, PEEL.minRate) * dt;
      const k = Math.min(Math.floor(f.peelAcc), f.n);
      if (k <= 0) continue;
      f.peelAcc -= k;
      f.n -= k;
      f.stats.shed += k;
      const tail = f.puffs[FLOCK.puffs - 1];
      let c = f.shedCloud && this.loose.includes(f.shedCloud) && this.clock - f.shedCloud.t0 < 1 ? f.shedCloud : null;
      if (c) c.n += k;
      else {
        c = this.addCloud(tail.x, tail.y, tail.z, -Math.cos(L.yaw) * 2, -Math.sin(L.yaw) * 2, k, [id]);
        f.shedCloud = c;
      }
      this.events.push({ type: 'shed', id, k, cloud: c.id, x: tail.x, y: tail.y, z: tail.z });
    }
  }

  stormTick(dt) {
    const S = this.storm;
    const front = S.front + S.speed * this.time;
    for (const id of this.order) {
      const f = this.flocks.get(id);
      const x = f.head.x;
      if (x > front || f.n <= 0) {
        f.stormAcc = 0;
        continue;
      }
      f.stormAcc += Math.max(0.06 * f.n, 1) * dt;
      const k = Math.min(Math.floor(f.stormAcc), f.n);
      if (k <= 0) continue;
      f.stormAcc -= k;
      f.n -= k;
      f.stats.shed += k;
      const c = this.addCloud(f.head.x, f.head.y, f.head.z, 3, 0, k, [id]);
      this.events.push({ type: 'shed', id, k, cloud: c.id, x: f.head.x, y: f.head.y, z: f.head.z, storm: true });
    }
  }

  stormFront() {
    return this.storm ? this.storm.front + this.storm.speed * this.time : null;
  }

  // ---------------------------------------------------------------- the hawk

  hawkTick() {
    const H = this.hawk;
    const T = this.opts.day;
    if (H.phase === 'wait') {
      if (this.time < H.nextAt || this.time > T - 3) return;
      let target = null;
      for (const id of this.order) {
        const f = this.flocks.get(id);
        if (f.n < HAWK.minFlock || f.shieldUntil > this.clock || f.away) continue;
        if (this.protected.has(id) && this.time < HAWK.newPlayerSafe) continue;
        if (!target || f.n > target.n) target = f;
      }
      if (!target) {
        H.nextAt = this.time + HAWK.retry;
        return;
      }
      H.phase = 'circle';
      H.target = target.id;
      H.t0 = this.clock;
      H.circleStart = this.time;
      H.aim = null;
      this.events.push({ type: 'hawk', phase: 'circle', target: target.id });
      return;
    }
    const target = this.flocks.get(H.target);
    if (H.phase === 'circle') {
      if (!target) {
        H.phase = 'wait';
        H.nextAt = this.time + HAWK.retry;
        return;
      }
      if (this.clock - H.t0 < HAWK.circle) return;
      H.aim = aimAt(target, this.clock - target.lag, HAWK.stoop);
      H.phase = 'stoop';
      H.t0 = this.clock;
      this.events.push({ type: 'hawk', phase: 'stoop', target: H.target, aim: H.aim });
      return;
    }
    if (H.phase === 'stoop') {
      if (this.clock - H.t0 < HAWK.stoop) return;
      this.strike(H.aim, target);
      H.phase = 'leave';
      H.t0 = this.clock;
      return;
    }
    if (H.phase === 'leave' && this.clock - H.t0 >= HAWK.leave) {
      const late = T - this.time <= HAWK.lateWindow;
      const sizes = this.order.map((id) => this.flocks.get(id).n).sort((a, b) => b - a);
      const greedy = sizes[0] >= HAWK.greedyMin && sizes[0] > HAWK.greedy * (sizes[1] ?? 0);
      const every = greedy ? Math.min(HAWK.greedyEvery, late ? this.opts.hawkLateEvery : this.opts.hawkEvery) : late ? this.opts.hawkLateEvery : this.opts.hawkEvery;
      const jitter = late || greedy ? HAWK.lateJitter : HAWK.everyJitter;
      H.phase = 'wait';
      H.target = null;
      H.nextAt = Math.max(this.time + 3, H.circleStart + every + this.rng.range(-jitter, jitter));
    }
  }

  strike(aim, target) {
    const losses = {};
    let total = 0;
    const targetN = target ? target.n : 0;
    for (const id of this.order) {
      const f = this.flocks.get(id);
      if (f.n <= 0) continue;
      const loss = strikeLoss(f.puffs, f.n, aim);
      if (loss > 0) {
        f.n -= loss;
        f.stats.lostHawk += loss;
        losses[id] = loss;
        total += loss;
      }
    }
    let cloud = null;
    if (total > 0) cloud = this.addCloud(aim.x, aim.y + 4, aim.z, 0, 0, total, Object.keys(losses)).id;
    const lost = target ? losses[target.id] ?? 0 : 0;
    this.events.push({
      type: 'strike',
      x: aim.x,
      y: aim.y,
      z: aim.z,
      losses,
      target: target ? target.id : null,
      targetN,
      dodged: !!target && lost === 0 && targetN >= HAWK.minFlock,
      cloud,
    });
  }

  // ---------------------------------------------------------------- sunset and dawn

  sundown() {
    this.phase = 'night';
    this.standings = this.order
      .map((id) => this.flocks.get(id))
      .sort((a, b) => b.n - a.n || (a.id < b.id ? -1 : 1))
      .map((f) => ({ id: f.id, n: f.n, name: f.name, slot: f.slot, kind: f.kind }));
    this.resetHawk();
    for (const f of this.flocks.values()) f.leader.boosting = false;
    this.events.push({ type: 'sundown', standings: this.standings });
  }

  dawn() {
    this.rid += 1;
    if (this.opts.rotate) this.setMap(ROTATION[(ROTATION.indexOf(this.opts.mapId) + 1) % ROTATION.length]);
    this.reseed();
    this.clock = 0;
    this.time = 0;
    this.stepAcc = 0;
    this.ruleAcc = 0;
    this.phase = 'day';
    this.standings = null;
    this.pairs.clear();
    this.deal();
    this.resetHawk();
    this.fillRivals(true);
    const spawns = this.rng.shuffle(this.map.spawns);
    const flocks = this.order.map((id) => this.flocks.get(id)).sort((a, b) => a.slot - b.slot);
    flocks.forEach((f, k) => {
      const sp = spawns[k % spawns.length];
      const L = newLeader(sp.x, sp.z, sp.yaw, this.map);
      if (f.kind === 'rival') {
        f.leader = L;
        f.brain = makeBrain(f.personality, this.skill);
      } else {
        Object.assign(f.leader, { x: L.x, y: L.y, z: L.z, yaw: L.yaw, boosting: false, boostTime: 0 });
      }
      f.n = FLOCK.start;
      f.peelAcc = 0;
      f.stormAcc = 0;
      f.acc = {};
      f.shedCloud = null;
      f.lastFeed = null;
      f.shieldUntil = STEAL.shield;
      f.stats = { maxN: f.n, gathered: 0, stolen: 0, lostSteal: 0, lostHawk: 0, shed: 0, rares: 0 };
      f.spawn = { x: sp.x, z: sp.z, yaw: sp.yaw, y: L.y, token: this.spawnSeq++ };
      f.trail.reset(0, L.x, L.y, L.z);
      this.shape(f);
      this.events.push({ type: 'spawn', id: f.id, x: sp.x, z: sp.z, yaw: sp.yaw, token: f.spawn.token });
    });
    this.events.push({ type: 'dawn', rid: this.rid });
  }

  /** Every flock bird and every wild bird, counted (birds are only made at spawns and dawns). */
  census() {
    let flocks = 0;
    for (const f of this.flocks.values()) flocks += f.n;
    let perched = 0;
    for (let s = 0; s < this.perched.length; s++) perched += this.perched[s];
    const wheels = this.wheels.reduce((a, w) => a + w.n, 0);
    const loose = this.loose.reduce((a, c) => a + c.n, 0);
    const rares = this.rares.reduce((a, r) => a + r.n, 0);
    return { flocks, perched, wheels, loose, rares, wild: perched + wheels + loose + rares, total: flocks + perched + wheels + loose + rares };
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

const AWAY_INPUT = { turn: 0.45, climb: 0, boost: false };
const tmpA = {};
const tmpC = {};
const bA = {};
const bB = {};

/** A bird gathers perched birds under it unless it's climbed well above its cruise height. */
export function canGather(map, p) {
  return p.y <= band(map, p.x, p.z, 0, 0, false).cruise + GATHER.above;
}

/** Who wins a contact, and how fast: the side thicker at the contact point, if thick enough. */
export function resolveContact(a, b, c) {
  const la = localCount(a, c.x, c.y, c.z, STEAL.kernel);
  const lb = localCount(b, c.x, c.y, c.z, STEAL.kernel);
  const out = { la, lb, winner: null, rate: 0, winnerLocal: 0, loserLocal: 0 };
  if (la >= STEAL.margin * lb && lb > 0.01) {
    out.winner = 'a';
    out.winnerLocal = la;
    out.loserLocal = lb;
  } else if (lb >= STEAL.margin * la && la > 0.01) {
    out.winner = 'b';
    out.winnerLocal = lb;
    out.loserLocal = la;
  } else return out;
  out.rate = clamp(STEAL.rateK * (out.winnerLocal - out.loserLocal), STEAL.rateMin, STEAL.rateMax);
  return out;
}

/** Birds a strike at `aim` takes from a flock: 30% of those inside the strike sphere, at most a quarter of the flock. */
export function strikeLoss(puffs, n, aim) {
  let inside = 0;
  for (const p of puffs) {
    const d = dist3(p.x, p.y, p.z, aim.x, aim.y, aim.z);
    const r = Math.max(0.5, p.r);
    const cover = clamp((HAWK.strikeRadius + r - d) / (2 * r), 0, 1);
    inside += p.birds * cover;
  }
  return Math.floor(Math.min(HAWK.maxShare * n, HAWK.zoneShare * inside));
}

/** Where the flock's head will be in `ahead` seconds, if it keeps its speed and its turn. */
export function aimAt(f, t, ahead) {
  const p0 = f.trail.sample(t, {});
  const p1 = f.trail.sample(t - 0.2, {});
  const p2 = f.trail.sample(t - 0.4, {});
  const vx = (p0.x - p1.x) / 0.2;
  const vy = (p0.y - p1.y) / 0.2;
  const vz = (p0.z - p1.z) / 0.2;
  const speed = Math.hypot(vx, vz);
  const head = f.puffs[0];
  let dx;
  let dz;
  if (speed < 0.5) {
    dx = 0;
    dz = 0;
  } else {
    const yaw0 = Math.atan2(vz, vx);
    const yawPrev = Math.atan2(p1.z - p2.z, p1.x - p2.x);
    const w = Math.hypot(p1.x - p2.x, p1.z - p2.z) > 0.1 ? angleDiff(yawPrev, yaw0) / 0.2 : 0;
    if (Math.abs(w) < 1e-3) {
      dx = vx * ahead;
      dz = vz * ahead;
    } else {
      const R = speed / w;
      dx = R * (Math.sin(yaw0 + w * ahead) - Math.sin(yaw0));
      dz = R * (-Math.cos(yaw0 + w * ahead) + Math.cos(yaw0));
    }
  }
  return { x: head.x + dx, y: head.y + vy * ahead * 0.5, z: head.z + dz };
}

export { puffRadius };
