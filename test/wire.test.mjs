// What travels between pages: round trips, and garbage turned away.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/sim/wire.js';
import { Sky } from '../src/sim/sky.js';

test('presence round trip', () => {
  const p = W.writePresence({ x: 10.123, y: 8, z: -40, yaw: 1, boosting: true }, 'fly', 3, { nw: true, rv: { r1: [1, 2, 3, 1, 0, 0] } });
  const r = W.readPresence(JSON.parse(JSON.stringify(p)));
  assert.equal(r.st, 'fly');
  assert.equal(r.rid, 3);
  assert.ok(Math.abs(r.yaw - 1) < 0.02);
  assert.equal(r.boosting, true);
  assert.equal(r.nw, true);
  assert.equal(r.rv.length, 1);
});

test('garbage presence is turned away', () => {
  const good = { x: 1, y: 2, z: 3, hx: 1, hz: 0, b: 0, st: 'fly', rid: 1 };
  const bad = [
    null,
    'x',
    [],
    { ...good, x: NaN },
    { ...good, x: 1e9 },
    { ...good, y: '2' },
    { ...good, hx: 0, hz: 0 },
    { ...good, st: 'admin' },
    { ...good, rid: -1 },
    { ...good, rid: 1.5 },
  ];
  for (const b of bad) assert.equal(W.readPresence(b), null, JSON.stringify(b));
  const sneaky = W.readPresence({ ...good, rv: { r1: [1, 2, 3, 1, 0, 0], '<img>': [1, 2, 3, 1, 0, 0], r2: [NaN, 0, 0, 1, 0, 0], r3: 'x' } });
  assert.deepEqual(sneaky.rv.map((r) => r.id), ['r1']);
});

test('the perch bitset', () => {
  const a = new Uint8Array(1499);
  for (let i = 0; i < a.length; i += 3) a[i] = 1;
  const b = new Uint8Array(1499);
  assert.ok(W.decodeBits(W.encodeBits(a), b));
  assert.deepEqual(b, a);
  assert.equal(W.decodeBits('!!!', b), false);
  assert.equal(W.decodeBits(W.encodeBits(new Uint8Array(100)), b), false, 'wrong length');
});

test('host state round trips, and broken state is refused', () => {
  const sky = new Sky({ seed: 2 });
  sky.fillRivals();
  sky.addFlock('pabc', { kind: 'player', name: 'Ann' });
  sky.advance(50);
  const s = W.readSky(JSON.parse(JSON.stringify(W.writeSky(sky, 12345))));
  assert.ok(s);
  assert.equal(s.flocks.length, sky.flocks.size);
  assert.equal(s.dawnAt, 12345);
  const w = W.readWild(JSON.parse(JSON.stringify(W.writeWild(sky))), sky.map);
  assert.ok(w);
  assert.deepEqual([...w.perched], [...sky.perched]);
  const raw = W.writeSky(sky, 1);
  for (const broken of [
    { ...raw, v: 2 },
    { ...raw, map: 'moon' },
    { ...raw, flocks: [...raw.flocks, raw.flocks[0]] },
    { ...raw, flocks: [['r1', 99, 8, 0, 1, 'r', 'X', 'hunter', 0, 0, 0, 0, 0]] },
    { ...raw, flocks: [['pabc', 1, 8, 0, 1, 'r', 'X', 'hunter', 0, 0, 0, 0, 0]] },
    { ...raw, hawk: ['x', null, 0, 0, 0, null] },
  ]) {
    assert.equal(W.readSky(broken), null);
  }
  assert.equal(W.readWild({ ...W.writeWild(sky), w: [1, 2] }, sky.map), null);
});

test('event batches: good entries kept, bad ones dropped', () => {
  const msg = {
    t: 'ev',
    rid: 4,
    e: [
      W.packEvent({ type: 'steal', from: 'r1', to: 'pabc', k: 3, x: 1, y: 2, z: 3, lw: 20, ll: 10, pass: 3, bigger: true }),
      W.packEvent({ type: 'strike', x: 1, y: 2, z: 3, target: 'r2', dodged: false, losses: { r2: 12 } }),
      ['s', 'r1', 'r2', 1e9],
      ['zz'],
      'hello',
    ],
  };
  const r = W.readEvents(msg);
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].type, 'steal');
  assert.equal(r.events[1].losses.r2, 12);
  assert.equal(W.readEvents({ t: 'ev', rid: 1, e: new Array(200).fill(['zz']) }), null);
});

test('names are text, one line, short', () => {
  assert.equal(W.cleanName('  Ann\n<b>  '), 'Ann<b>');
  assert.equal(W.cleanName('x'.repeat(40)).length, 24);
  assert.equal(W.cleanName(5), '');
});
