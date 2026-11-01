// The room flow through a fake room: a shared sky, the host reloading, a leaver, a latecomer, garbage, parking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Net, stubRoom } from '../src/net.js';
import { getMap } from '../src/sim/maps.js';
import { newLeader, stepLeader } from '../src/sim/flight.js';
import { ROUND } from '../src/sim/config.js';

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const map = getMap('saltmere');

class Hub {
  constructor() {
    this.t = 1_000_000;
    this.state = {};
    this.players = new Map();
    this.rooms = new Map();
    this.order = [];
    this.hostId = null;
    this.now = () => this.t;
  }
  join(id, name) {
    let p = this.players.get(id);
    if (!p) {
      p = { id, name, presence: null, connected: true };
      this.players.set(id, p);
      this.order.push(id);
    }
    p.connected = true;
    const room = new FakeRoom(this, p);
    this.rooms.set(id, room);
    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = id;
    return room;
  }
  /** A reload or a lost connection: the seat is held. */
  drop(id) {
    this.players.get(id).connected = false;
    this.rooms.delete(id);
    if (this.hostId === id) this.elect();
  }
  leave(id) {
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.rooms.delete(id);
    if (this.hostId === id) this.elect();
  }
  elect() {
    this.hostId = this.order.find((id) => this.players.get(id)?.connected) ?? null;
  }
  emit(type, except, ...args) {
    for (const [id, r] of this.rooms) if (id !== except) r.emit(type, ...args);
  }
}

class FakeRoom {
  constructor(hub, me) {
    this.hub = hub;
    this.me = me;
    this.listeners = new Map();
  }
  get players() {
    return this.hub.players;
  }
  get host() {
    return this.hub.hostId;
  }
  get connected() {
    return this.hub.rooms.get(this.me.id) === this;
  }
  get isHost() {
    return this.hub.hostId === this.me.id && this.connected;
  }
  get state() {
    return this.hub.state;
  }
  setPresence(p) {
    this.me.presence = clone(p);
  }
  presenceAt(id) {
    return clone(this.hub.players.get(id)?.presence ?? null);
  }
  setState(key, value) {
    if (key.startsWith('host:') && !this.isHost) return;
    if (value === null) delete this.hub.state[key];
    else this.hub.state[key] = clone(value);
    this.hub.emit('state', this.me.id, key, value, this.me.id);
  }
  send(data) {
    this.hub.emit('message', this.me.id, clone(data), { id: this.me.id });
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }
  emit(type, ...args) {
    for (const fn of this.listeners.get(type) ?? []) fn(...args);
  }
}

class Page {
  constructor(hub, id) {
    this.hub = hub;
    this.room = hub.join(id, id.toUpperCase());
    this.events = [];
    this.leader = newLeader(map.title.spawn.x, map.title.spawn.z, map.title.spawn.yaw, map);
    this.st = 'title';
    // a reloaded page carries on from its last presence
    const last = this.room.me.presence;
    if (last && last.st === 'fly') {
      Object.assign(this.leader, newLeader(last.x, last.z, Math.atan2(last.hz, last.hx), map));
      this.st = 'fly';
    }
    this.net = new Net(this.room, {
      now: hub.now,
      seed: 7,
      on: {
        events: (list) => this.events.push(...list),
        spawn: (f) => Object.assign(this.leader, newLeader(f.spawn.x, f.spawn.z, f.spawn.yaw, map)),
      },
    });
    this.t = Math.random() * 10;
  }
  step(dt) {
    this.t += dt;
    if (this.st === 'fly') stepLeader(this.leader, { turn: 0.6 * Math.sin(this.t * 0.4), climb: 0, boost: false }, dt, map);
    this.net.update(dt, { st: this.st, leader: this.leader, nw: false });
  }
  close() {
    this.net.dispose();
  }
}

function run(hub, pages, seconds, dt = 1 / 20) {
  for (let t = 0; t < seconds; t += dt) {
    for (const p of pages) p.step(dt);
    hub.t += dt * 1000;
  }
}

const countsOf = (sky) => Object.fromEntries([...sky.flocks.values()].map((f) => [f.id, f.n]));

test('two players and the rival flocks share one sky', () => {
  const hub = new Hub();
  const a = new Page(hub, 'a');
  const b = new Page(hub, 'b');
  a.st = 'fly';
  b.st = 'fly';
  run(hub, [a, b], 20);
  assert.ok(a.net.authority && !b.net.authority);
  const host = a.net.sky;
  assert.ok(host.flocks.has('pa') && host.flocks.has('pb'));
  assert.ok(host.flocks.size >= 7, 'rivals fill the sky');
  run(hub, [a, b], 0.3);
  // the mirror shows what the host last wrote
  const written = Object.fromEntries(a.net.state.flocks.map((f) => [f.id, f.n]));
  assert.deepEqual(countsOf(b.net.sky), written);
  assert.equal(b.net.sky.rid, host.rid);
  assert.ok(Math.abs(b.net.sky.clock - host.clock) < 0.5);
  // the mirror draws the rivals where the host flies them
  const r = [...host.flocks.values()].find((f) => f.kind === 'rival');
  const m = b.net.sky.flocks.get(r.id);
  assert.ok(Math.hypot(r.leader.x - m.leader.x, r.leader.z - m.leader.z) < 3);
  assert.ok(b.events.length > 0, 'the host\'s events reach the other page');
  // the next dawn: rivals over the count have left, everyone starts again with 8 at a spawn
  const rid = host.rid;
  while (host.rid === rid) run(hub, [a, b], 1);
  run(hub, [a, b], 0.5);
  assert.equal(host.flocks.size, 7);
  assert.equal(b.net.sky.rid, host.rid);
  const sp = host.flocks.get('pb').spawn;
  assert.ok(Math.hypot(b.leader.x - sp.x, b.leader.z - sp.z) < 15, 'the page moved its bird to its new spawn');
});

test('the host reloads mid-sunset: the next host carries on, then the old one comes back', () => {
  const hub = new Hub();
  const a = new Page(hub, 'a');
  const b = new Page(hub, 'b');
  a.st = 'fly';
  b.st = 'fly';
  run(hub, [a, b], 40);
  const rid = a.net.sky.rid;
  const clock = a.net.sky.clock;
  const before = Object.fromEntries(a.net.state.flocks.map((f) => [f.id, f.n]));
  a.close();
  hub.drop('a');
  run(hub, [b], 1);
  assert.ok(b.net.authority, 'b took over');
  const sky = b.net.sky;
  assert.equal(sky.rid, rid, 'same sunset');
  assert.ok(sky.clock > clock && sky.clock < clock + 3, `clock ${clock.toFixed(1)} → ${sky.clock.toFixed(1)}`);
  for (const [id, n] of Object.entries(before)) {
    assert.ok(sky.flocks.has(id), `${id} kept`);
    assert.ok(Math.abs(sky.flocks.get(id).n - n) <= Math.max(25, n * 0.5), `${id}: ${n} → ${sky.flocks.get(id).n}`);
  }
  assert.ok(sky.flocks.get('pa').away, 'the reloading player\'s flock waits for them');
  const total = sky.census().total;
  run(hub, [b], 5);
  assert.equal(sky.census().total, total, 'birds conserved across the change');
  const a2 = new Page(hub, 'a');
  assert.equal(a2.st, 'fly', 'the reloaded page carries on flying');
  run(hub, [a2, b], 3);
  assert.ok(!a2.net.authority);
  assert.equal(sky.flocks.get('pa').away, false);
  assert.equal(a2.net.sky.rid, rid);
});

test('a leaver\'s birds burst into a loose cloud; a latecomer flies at once', () => {
  const hub = new Hub();
  const a = new Page(hub, 'a');
  const c = new Page(hub, 'c');
  a.st = 'fly';
  c.st = 'fly';
  run(hub, [a, c], 30);
  const sky = a.net.sky;
  const total = sky.census().total;
  const n = sky.flocks.get('pc').n;
  c.close();
  hub.leave('c');
  a.events.length = 0;
  run(hub, [a], 0.2);
  assert.ok(!sky.flocks.has('pc'));
  if (n > 0) assert.ok(a.events.some((e) => e.type === 'scatter' && e.id === 'pc' && e.k === n));
  assert.equal(sky.census().total, total, 'nothing lost: the cloud holds them');
  const d = new Page(hub, 'd');
  d.st = 'fly';
  run(hub, [a, d], 0.3);
  const f = sky.flocks.get('pd');
  assert.ok(f, 'the latecomer has a flock');
  assert.equal(f.n, 8);
  assert.ok(f.shieldUntil > sky.clock);
  assert.ok(d.net.mine(), 'and sees it');
});

test('garbage from another page is ignored', () => {
  const hub = new Hub();
  const a = new Page(hub, 'a');
  a.st = 'fly';
  const e = hub.join('e', 'E');
  run(hub, [a], 2);
  const junk = [{ x: NaN, y: 1, z: 1, hx: 1, hz: 0, st: 'fly', rid: 1 }, { x: 1e9 }, 'hello', { st: 'fly', rid: 'x' }, [1, 2, 3]];
  for (const j of junk) {
    hub.players.get('e').presence = j;
    e.setState('host:sky', { v: 1, rid: 99 });
    e.send({ t: 'ev', rid: a.net.sky.rid, e: [['s', 'pa', 'pe', 500, 0, 0, 0, 1, 1, 1, 1]] });
    run(hub, [a], 0.5);
  }
  assert.ok(!a.net.sky.flocks.has('pe'));
  assert.notEqual(hub.state['host:sky'].rid, 99);
  for (const f of a.net.sky.flocks.values()) assert.ok(Number.isFinite(f.leader.x) && Number.isInteger(f.n));
});

test('nobody flying parks the sky; the next flyer gets a fresh dawn', () => {
  const hub = new Hub();
  const a = new Page(hub, 'a');
  run(hub, [a], ROUND.parkAfter + 2);
  const sky = a.net.sky;
  assert.ok(sky.parked);
  assert.equal(sky.time, ROUND.parkedTime);
  const rid = sky.rid;
  a.st = 'fly';
  run(hub, [a], 1);
  assert.ok(!sky.parked);
  assert.equal(sky.rid, rid + 1);
  assert.ok(sky.time < 2);
  assert.ok(sky.flocks.has('pa'));
});

test('a page outside Onceworlds plays alone on a stub room', () => {
  const room = stubRoom();
  let t = 0;
  const net = new Net(room, { now: () => t });
  const L = newLeader(0, 0, 0, map);
  for (let k = 0; k < 200; k++) {
    stepLeader(L, { turn: 0.2, climb: 0, boost: false }, 1 / 20, map);
    net.update(1 / 20, { st: 'fly', leader: L, nw: true });
    t += 50;
  }
  assert.ok(net.authority);
  assert.ok(net.mine());
  assert.equal(net.sky.flocks.size, 7);
  assert.equal(net.sky.skill, 'easy', 'a new player alone gets Easy rivals');
});
