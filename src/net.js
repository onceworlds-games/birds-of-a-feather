// The room. Every page flies its own lead bird and keeps a sky; the host's page runs the rules in it (joins, steals, the hawk,
// the clock, the rival flocks) and writes the results to `host:` state, and every other page mirrors that state. When the host
// changes, the new host's mirror simply becomes the real sky. No window, three.js or SDK here: node tests drive it with a fake
// room.

import { Sky } from './sim/sky.js';
import { ROUND, SKY, SKILLS } from './sim/config.js';
import { hashString } from './sim/rng.js';
import * as W from './sim/wire.js';

const WRITE_EVERY = 0.125; // host state, at most 8 times a second
const EVENTS_EVERY = 0.1;
const PRESENCE_EVERY = 0.05;
const MAX_BATCH = 60;
const AT = { snap: 30 }; // presenceAt: a jump this long is a respawn, not a glide

export class Net {
  /**
   * room: a platform room (or `stubRoom()`); now(): ms on the platform clock.
   * on: { events(list), spawn(flock), dawn(rid), sundown(standings) } (all optional).
   */
  constructor(room, { now, on = {}, seed, mapId = 'saltmere', rotate = true } = {}) {
    this.room = room;
    this.now = now;
    this.on = on;
    this.sky = new Sky({ mapId, rotate, seed: seed ?? hashString(String(Date.now())) % 1e9, judgeDelay: SKY.judgeDelay, authority: false });
    this.sky.drainEvents();
    this.authority = false;
    this.dawnAt = now();
    this.state = null; // the last good host:sky
    this.wild = null;
    this.results = null;
    this.stateDirty = true;
    this.skillPick = 'normal';
    this.myId = W.flockIdOf(room.me.id);
    this.mySpawn = null; // the spawn token this page last flew from
    this.myRid = 0;
    this.idle = 0; // seconds nobody has been flying (host)
    this.writeAcc = 0;
    this.eventAcc = 0;
    this.presenceAcc = 0;
    this.outbox = [];
    this.lastSkyText = '';
    this.lastWildText = '';
    this.resultsRid = -1;
    this.offs = [
      room.on('state', () => {
        this.stateDirty = true;
      }),
      room.on('message', (data, from) => this.onMessage(data, from)),
    ];
  }

  dispose() {
    for (const off of this.offs) if (typeof off === 'function') off();
  }

  /** Other players connected right now (seat-held ones don't count). */
  othersOnline() {
    let k = 0;
    for (const p of this.room.players.values()) if (p.id !== this.room.me.id && p.connected !== false) k++;
    return k;
  }

  /** Others flying in the shared sky. */
  othersFlying() {
    let k = 0;
    for (const f of this.sky.flocks.values()) if (f.kind === 'player' && f.id !== this.myId) k++;
    return k;
  }

  /** The host's pick of rival skill (only the host's counts). */
  setSkill(skill) {
    if (!SKILLS.includes(skill)) return;
    this.skillPick = skill;
  }

  onMessage(data, from) {
    if (this.authority || !from || from.id !== this.room.host) return;
    const batch = W.readEvents(data);
    if (!batch || batch.rid !== this.sky.rid) return;
    if (batch.events.length && this.on.events) this.on.events(batch.events);
  }

  /**
   * One frame. own: { st: 'title' | 'fly' | 'mig', leader, nw, look } (the page's own lead bird, already flown this frame).
   */
  update(dt, own) {
    const room = this.room;
    const auth = !!(room.isHost && room.connected);
    if (auth && !this.authority) this.becomeHost();
    else if (!auth && this.authority) this.becomeMirror();
    if (this.authority) this.hostUpdate(dt, own);
    else this.mirrorUpdate(dt, own);
    this.checkOwnSpawn();
    this.presenceAcc += dt;
    if (this.presenceAcc >= PRESENCE_EVERY && own.leader) {
      this.presenceAcc = 0;
      const extra = { nw: own.nw, look: own.look };
      if (this.authority) {
        const flown = [];
        for (const f of this.sky.flocks.values()) if (f.kind === 'rival' || f.away) flown.push(f);
        extra.rv = W.writeLeaders(flown);
      }
      room.setPresence(W.writePresence(own.leader, own.st, this.myRid, extra));
      this.readLooks();
    }
  }

  /** What other players' lead birds look like, from their own presence (cosmetic: a bad look draws the starling). */
  readLooks() {
    const room = this.room;
    for (const p of room.players.values()) {
      if (p.id === room.me.id) continue;
      const f = this.sky.flocks.get(W.flockIdOf(p.id));
      if (!f) continue;
      const pr = W.readPresence(p.presence);
      if (pr) f.look = pr.look;
    }
  }

  // ---------------------------------------------------------------- host

  becomeHost() {
    this.authority = true;
    const sky = this.sky;
    if (this.state) {
      // carry on from the last host's sky
      this.dawnAt = this.state.dawnAt;
      sky.setSkill(this.state.skill);
      this.skillPick = this.state.skill;
      sky.takeOver();
    } else {
      // a new sky waits parked (its rivals flying for the title) until someone flies
      sky.authority = true;
      this.dawnAt = this.now() - sky.clock * 1000;
      sky.fillRivals();
      sky.park();
    }
    sky.drainEvents();
    this.lastSkyText = '';
    this.lastWildText = '';
  }

  becomeMirror() {
    this.authority = false;
    this.sky.becomeMirror();
    this.outbox.length = 0;
    this.stateDirty = true;
  }

  /** The players who should have a flock in the shared sky, read from presence. */
  flyers(own) {
    const room = this.room;
    const out = [];
    for (const p of room.players.values()) {
      if (p.id === room.me.id) {
        if (own.st === 'fly' && own.leader) out.push({ id: this.myId, me: true, name: room.me.name, nw: own.nw, p: null, connected: true });
        continue;
      }
      const pres = W.readPresence(p.presence);
      if (!pres || pres.st !== 'fly') continue;
      out.push({ id: W.flockIdOf(p.id), pid: p.id, me: false, name: p.name, nw: pres.nw, p: pres, connected: p.connected !== false });
    }
    return out;
  }

  hostUpdate(dt, own) {
    const sky = this.sky;
    const room = this.room;
    const flyers = this.flyers(own);
    // park when nobody has flown for a while; the next flyer gets a fresh dawn
    if (flyers.length === 0) {
      this.idle += dt;
      if (!sky.parked && this.idle >= ROUND.parkAfter) sky.park();
    } else {
      this.idle = 0;
    }
    const fresh = flyers.length > 0 && sky.parked;
    // flocks in and out
    const want = new Set(flyers.map((f) => f.id));
    for (const f of [...sky.flocks.values()]) if (f.kind === 'player' && !want.has(f.id)) sky.removeFlock(f.id, true);
    for (const fl of flyers) {
      let f = sky.flocks.get(fl.id);
      if (!f) {
        const L = fl.me ? own.leader : fl.p;
        f = sky.addFlock(fl.id, {
          kind: 'player',
          name: W.cleanName(fl.name) || 'Player',
          local: fl.me,
          spawn: { x: L.x, y: L.y, z: L.z, yaw: L.yaw },
        });
        if (!f) continue; // the sky is full
        if (fl.nw) sky.protected.add(fl.id);
      }
      f.name = W.cleanName(fl.name) || f.name;
      f.away = !fl.connected;
      if (fl.me) {
        const L = own.leader;
        sky.feed(fl.id, L.x, L.y, L.z, L.yaw, L.boosting);
      } else if (fl.connected && fl.p.rid === sky.rid) {
        const at = W.readPresence(room.presenceAt(fl.pid, AT)) ?? fl.p;
        sky.feed(fl.id, at.x, at.y, at.z, at.yaw, at.boosting);
      }
    }
    if (fresh) {
      // the first flyer wakes a parked sky: a fresh dawn, with just enough rivals
      this.chooseSkill(flyers);
      sky.unpark();
      this.dawnAt = this.now();
      sky.fillRivals(true, false);
      for (const fl of flyers) {
        const f = sky.flocks.get(fl.id);
        const L = fl.me ? own.leader : fl.p;
        if (f) {
          f.trail.reset(sky.clock, L.x, L.y, L.z);
          f.lastFeed = null;
        }
      }
    }
    sky.fillRivals();
    // the clock is the platform's: every page reads the same sunset from dawnAt
    const before = sky.rid;
    sky.advanceTo((this.now() - this.dawnAt) / 1000);
    if (sky.rid !== before) {
      this.dawnAt = this.now() - sky.clock * 1000;
      if (sky.skill !== this.skillPick) this.chooseSkill(flyers);
    }
    const events = sky.drainEvents();
    if (events.length) this.hostEvents(events);
    // state and messages
    this.writeAcc += dt;
    if (this.writeAcc >= WRITE_EVERY) {
      this.writeAcc = 0;
      this.writeState();
    }
    this.eventAcc += dt;
    if (this.eventAcc >= EVENTS_EVERY && this.outbox.length) {
      this.eventAcc = 0;
      room.send({ t: 'ev', rid: sky.rid, e: this.outbox.splice(0, MAX_BATCH) });
      this.outbox.length = 0;
    }
  }

  /** Rival skill for the coming sunset: Easy for a new player flying alone, else the host's pick. */
  chooseSkill(flyers) {
    const gentle = flyers.length === 1 && flyers[0].nw;
    this.sky.setSkill(gentle ? 'easy' : this.skillPick);
  }

  hostEvents(events) {
    for (const e of events) {
      if (e.type === 'sundown') this.on.sundown?.(e.standings);
      else if (e.type === 'dawn') this.on.dawn?.(e.rid);
      const packed = W.packEvent(e);
      if (packed) this.outbox.push(packed);
    }
    if (this.outbox.length > MAX_BATCH * 2) this.outbox.splice(0, this.outbox.length - MAX_BATCH * 2);
    this.on.events?.(events);
  }

  writeState() {
    const room = this.room;
    const sky = this.sky;
    const s = W.writeSky(sky, this.dawnAt);
    const text = JSON.stringify(s);
    if (text !== this.lastSkyText) {
      this.lastSkyText = text;
      room.setState('host:sky', s);
      this.state = W.readSky(s);
    }
    const w = W.writeWild(sky);
    const wt = JSON.stringify(w);
    if (wt !== this.lastWildText) {
      this.lastWildText = wt;
      room.setState('host:wild', w);
    }
    if (sky.standings && this.resultsRid !== sky.rid) {
      this.resultsRid = sky.rid;
      const r = W.writeResults(sky);
      room.setState('host:results', r);
      this.results = W.readResults(r);
    }
  }

  // ---------------------------------------------------------------- mirror

  mirrorUpdate(dt, own) {
    const room = this.room;
    const sky = this.sky;
    if (this.stateDirty) {
      this.stateDirty = false;
      const s = W.readSky(room.state['host:sky']);
      // the host's sky moved on to another place: follow it there
      if (s && s.map !== sky.opts.mapId) sky.setMap(s.map);
      if (s) this.state = s;
      const r = W.readResults(room.state['host:results']);
      if (r) this.results = r;
      if (this.state) {
        this.applySky(this.state);
        const w = W.readWild(room.state['host:wild'], sky.map);
        if (w && w.rid === this.state.rid) this.applyWild(w);
      }
    }
    if (!this.state) return;
    // every leader from presence: players from their own, rival flocks (and away players) from the host's
    const hostId = room.host;
    for (const p of room.players.values()) {
      if (p.id === room.me.id) continue;
      const fid = W.flockIdOf(p.id);
      if (!sky.flocks.has(fid)) continue;
      const at = W.readPresence(room.presenceAt(p.id, AT));
      if (at && at.st === 'fly' && at.rid === sky.rid) sky.feed(fid, at.x, at.y, at.z, at.yaw, at.boosting);
    }
    if (hostId && hostId !== room.me.id) {
      const hp = W.readPresence(room.presenceAt(hostId, AT));
      if (hp && hp.rv && hp.rid === sky.rid) for (const r of hp.rv) if (sky.flocks.has(r.id)) sky.feed(r.id, r.x, r.y, r.z, r.yaw, r.boosting);
    }
    if (own.st === 'fly' && own.leader && sky.flocks.has(this.myId)) {
      const L = own.leader;
      sky.feed(this.myId, L.x, L.y, L.z, L.yaw, L.boosting);
    }
    const st = this.state;
    sky.mirrorTo(Math.max(0, (this.now() - st.dawnAt) / 1000), st.parked, st.phase);
    sky.drainEvents();
  }

  applySky(s) {
    const sky = this.sky;
    const clock = Math.max(0, (this.now() - s.dawnAt) / 1000);
    if (s.rid !== sky.rid || s.seed !== sky.baseSeed) {
      const newSunset = s.rid !== sky.rid;
      sky.baseSeed = s.seed;
      sky.rid = s.rid;
      sky.reseed();
      if (newSunset) {
        // the clock starts again: every path starts again where its bird is
        sky.clock = clock;
        const p = {};
        for (const f of sky.flocks.values()) {
          f.trail.newest(p);
          f.trail.reset(clock, p.x, p.y, p.z);
          f.lastFeed = null;
        }
        sky.pairs.clear();
        sky.standings = null;
        this.on.dawn?.(s.rid);
      }
    }
    this.dawnAt = s.dawnAt;
    sky.skill = s.skill;
    const keep = new Set();
    for (const e of s.flocks) {
      keep.add(e.id);
      let f = sky.flocks.get(e.id);
      if (!f) {
        sky.clock = clock;
        f = sky.addFlock(e.id, { kind: e.kind, name: e.name, slot: e.slot, n: e.n, personality: e.personality, spawn: e.spawn });
        if (!f) continue;
        f.spawn.token = e.token;
      }
      f.slot = e.slot;
      f.n = e.n;
      f.name = e.name;
      f.shieldUntil = e.shieldUntil;
      f.away = e.away;
      if (e.kind === 'rival') f.personality = e.personality;
      if (f.spawn.token !== e.token) {
        f.spawn = { ...e.spawn, token: e.token };
        if (f.id !== this.myId) {
          f.trail.reset(clock, e.spawn.x, e.spawn.y, e.spawn.z);
          f.lastFeed = null;
        }
      }
    }
    for (const id of [...sky.flocks.keys()]) if (!keep.has(id)) sky.removeFlock(id, false);
    const h = s.hawk;
    Object.assign(sky.hawk, { phase: h.phase, target: h.target, t0: h.t0, circleStart: h.circleStart, nextAt: h.nextAt, aim: h.aim });
    if (s.phase === 'night' && this.results && this.results.rid === s.rid) {
      if (!sky.standings) {
        sky.standings = this.results.standings;
        this.on.sundown?.(sky.standings);
      }
    }
    sky.drainEvents();
  }

  applyWild(w) {
    const sky = this.sky;
    const map = sky.map;
    sky.perched = w.perched;
    sky.groupLive = new Int16Array(map.groups.length);
    for (let i = 0; i < w.perched.length; i++) if (w.perched[i]) sky.groupLive[map.perches.group[i]]++;
    w.wheels.forEach((n, i) => (sky.wheels[i].n = n));
    sky.loose = w.loose;
    sky.rares = w.rares;
  }

  // ---------------------------------------------------------------- own flock

  /** A new spawn token for this page's flock (a dawn) moves its lead bird there. The first one seen is where it already is. */
  checkOwnSpawn() {
    const f = this.sky.flocks.get(this.myId);
    if (!f) {
      this.mySpawn = null;
      this.myRid = this.sky.rid;
      return;
    }
    if (this.mySpawn !== null && this.mySpawn !== f.spawn.token) {
      f.trail.reset(this.sky.clock, f.spawn.x, f.spawn.y, f.spawn.z);
      f.lastFeed = null;
      this.on.spawn?.(f);
    }
    this.mySpawn = f.spawn.token;
    this.myRid = this.sky.rid;
  }

  /** This page's flock (or null while it isn't flying in the shared sky). */
  mine() {
    return this.sky.flocks.get(this.myId) ?? null;
  }
}

/** A room for a page outside Onceworlds: one player, the host, everything local. */
export function stubRoom(name = 'You') {
  const listeners = new Map();
  const me = { id: 'me', name, presence: null, connected: true };
  const room = {
    me,
    players: new Map([[me.id, me]]),
    host: me.id,
    isHost: true,
    connected: true,
    kind: 'solo',
    state: {},
    setPresence(p) {
      me.presence = p;
    },
    presenceAt(id) {
      return id === me.id ? me.presence : null;
    },
    setState(key, value) {
      if (value === null) delete room.state[key];
      else room.state[key] = value;
    },
    send() {},
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },
    leave() {},
  };
  return room;
}
