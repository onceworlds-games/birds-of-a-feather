// The rules: stealing, shedding, the hawk, conservation and the clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sky, resolveContact, strikeLoss, aimAt } from '../src/sim/sky.js';
import { Trail, shapeOf, newPuffs, contactOf } from '../src/sim/flock.js';
import { FLIGHT, ROUND, HAWK, RARE, ROTATION, STEAL } from '../src/sim/config.js';
import { SPECIES } from '../src/sim/species.js';

/** A flock of n flying straight along yaw at cruise speed, its leader at (x, z) at time t. */
function flock(n, x, z, yaw, t = 10, y = 10) {
  const trail = new Trail();
  const hx = Math.cos(yaw);
  const hz = Math.sin(yaw);
  for (let k = 120; k >= 0; k--) {
    const s = k / 20;
    trail.push(t - s, x - hx * FLIGHT.speed * s, y, z - hz * FLIGHT.speed * s);
  }
  return shapeOf(trail, n, t, newPuffs());
}

test('a compact flock crossing a big one\'s thin tail wins there', () => {
  const big = flock(300, 0, 0, 0);
  const tail = big[7];
  const small = flock(30, tail.x, tail.z + 1, Math.PI / 2);
  const c = contactOf(small, big, {});
  assert.ok(c, 'they touch');
  const r = resolveContact(small, big, c);
  assert.equal(r.winner, 'a', `small ${r.la.toFixed(1)} vs big ${r.lb.toFixed(1)}`);
  assert.ok(r.rate >= 3 && r.rate <= 30, `rate ${r.rate}`);
  assert.ok(r.loserLocal < 30, 'it can only take the stragglers there');
});

test('the same small flock flying into the big one\'s head loses', () => {
  const big = flock(300, 0, 0, 0);
  const small = flock(30, big[0].x + 2, big[0].z, Math.PI);
  const c = contactOf(small, big, {});
  assert.ok(c);
  const r = resolveContact(small, big, c);
  assert.equal(r.winner, 'b');
  assert.ok(r.rate >= 20, `rate ${r.rate}`);
});

test('two equal flocks meeting head-on: nobody wins', () => {
  const a = flock(100, 0, 0, 0);
  const b = flock(100, a[0].x + 2, 0, Math.PI, 10);
  const c = contactOf(a, b, {});
  assert.ok(c);
  const r = resolveContact(a, b, c);
  assert.equal(r.winner, null, `${r.la.toFixed(1)} vs ${r.lb.toFixed(1)}`);
});

test('symmetric contacts are symmetric: swapping the sides swaps the winner', () => {
  const big = flock(200, 0, 0, 0);
  const small = flock(40, big[6].x, big[6].z + 1, Math.PI / 2);
  const c1 = contactOf(small, big, {});
  const c2 = contactOf(big, small, {});
  const r1 = resolveContact(small, big, c1);
  const r2 = resolveContact(big, small, c2);
  assert.equal(r1.winner === 'a', r2.winner === 'b');
  assert.ok(Math.abs(r1.rate - r2.rate) < 1e-6);
});

test('a full boost from 200 birds sheds 15-25', () => {
  const sky = new Sky({ seed: 3, autoRivals: false, loop: false });
  sky.addFlock('pme', { kind: 'player', n: 200, spawn: sky.map.spawns[0] });
  const f = sky.flocks.get('pme');
  f.shieldUntil = 0;
  sky.advance(0.5);
  let t = 0;
  // fly the leader straight out over open ground, boosting for the whole 3 s of stamina
  while (t < 3.2) {
    f.leader.boosting = true;
    f.leader.boostTime += 1 / 30;
    sky.advance(1 / 30);
    t += 1 / 30;
  }
  const shed = f.stats.shed;
  assert.ok(shed >= 15 && shed <= 25, `shed ${shed}`);
});

test('the hawk: a clean hit takes 15-25%, a miss nothing', () => {
  for (const n of [60, 150, 300, 600]) {
    const puffs = flock(n, 0, 0, 0);
    const hit = strikeLoss(puffs, n, { x: puffs[0].x, y: puffs[0].y, z: puffs[0].z });
    assert.ok(hit >= 0.15 * n - 1 && hit <= 0.25 * n, `n ${n}: ${hit}`);
    const miss = strikeLoss(puffs, n, { x: puffs[0].x + 30, y: puffs[0].y, z: puffs[0].z + 30 });
    assert.equal(miss, 0);
  }
});

test('the hawk aims where a turning flock will be', () => {
  const sky = new Sky({ seed: 4, autoRivals: false, loop: false });
  const f = sky.addFlock('pme', { kind: 'player', n: 100, spawn: sky.map.spawns[0] });
  let yaw = 0;
  for (let k = 0; k < 60; k++) {
    yaw += 1.2 / 30;
    const L = f.leader;
    sky.feed('pme', L.x + Math.cos(yaw) * FLIGHT.speed / 30, L.y, L.z + Math.sin(yaw) * FLIGHT.speed / 30, yaw, false);
    sky.advance(1 / 30);
  }
  const aim = aimAt(f, sky.clock, HAWK.stoop);
  // keep turning for the stoop's 1.2 s and see how close the aim was
  let x = f.leader.x;
  let z = f.leader.z;
  for (let k = 0; k < 36; k++) {
    yaw += 1.2 / 30;
    x += Math.cos(yaw) * FLIGHT.speed / 30;
    z += Math.sin(yaw) * FLIGHT.speed / 30;
  }
  assert.ok(Math.hypot(aim.x - x, aim.z - z) < HAWK.strikeRadius, `off by ${Math.hypot(aim.x - x, aim.z - z).toFixed(1)}`);
});

test('birds are conserved, counts stay whole and nothing leaves the world, over many sunsets', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const sky = new Sky({ seed, loop: false });
    sky.fillRivals();
    const total0 = sky.census().total;
    let steps = 0;
    while (sky.phase === 'day') {
      sky.advance(0.25);
      sky.drainEvents();
      if (++steps % 40 === 0) {
        assert.equal(sky.census().total, total0, `seed ${seed} at ${sky.time.toFixed(1)}`);
        for (const f of sky.flocks.values()) {
          assert.ok(Number.isInteger(f.n) && f.n >= 0, 'whole birds');
          for (const v of [f.leader.x, f.leader.y, f.leader.z, f.leader.yaw]) assert.ok(Number.isFinite(v), 'finite');
          assert.ok(Math.hypot(f.leader.x - sky.map.center.x, f.leader.z - sky.map.center.z) <= FLIGHT.boundary + 13, 'inside');
        }
      }
    }
    assert.equal(sky.census().total, total0);
  }
});

test('a sunset ends at exactly its time, the night lasts its time, then a fresh dawn', () => {
  const sky = new Sky({ seed: 9 });
  sky.fillRivals();
  let sundownAt = null;
  let dawnAt = null;
  while (dawnAt === null) {
    sky.advance(1 / 30);
    for (const e of sky.drainEvents()) {
      if (e.type === 'sundown') sundownAt = sky.time;
      if (e.type === 'dawn') dawnAt = sundownAt;
    }
    assert.ok(sky.clock < ROUND.day + ROUND.night + 1);
  }
  assert.ok(Math.abs(sundownAt - ROUND.day) < 0.15, `sundown at ${sundownAt}`);
  assert.equal(sky.rid, 2);
  assert.ok(sky.time < 0.2);
  for (const f of sky.flocks.values()) assert.equal(f.n, 8);
  assert.equal(sky.census().wild, 1000 + sky.map.wheels.length * 40 + sky.rares.reduce((a, r) => a + r.n, 0));
  assert.equal(sky.rares.length, RARE.perSunset);
  assert.ok(sky.rares.every((r) => r.by === null && r.n > 0));
});

test('rare birds: three on landmarks, the first flock there wins it and its greys, once', () => {
  const sky = new Sky({ seed: 21, autoRivals: false });
  assert.equal(sky.rares.length, RARE.perSunset);
  for (const r of sky.rares) {
    assert.ok(SPECIES[r.species], 'a real species');
    assert.ok(r.species > 0, 'never the starling everyone starts with');
    assert.equal(r.n, RARE.birds[SPECIES[r.species].rarity]);
    assert.ok(sky.map.landmarks.some((p) => p.x === r.x && p.z === r.z), 'on a landmark');
  }
  sky.addFlock('pa', { kind: 'player', name: 'A' });
  sky.addFlock('pb', { kind: 'player', name: 'B' });
  const r = sky.rares[0];
  const total0 = sky.census().total;
  sky.advance(STEAL.shield + 0.5);
  sky.drainEvents();
  const n0 = sky.flocks.get('pa').n;
  // A flies onto it; B arrives a moment later
  for (let k = 0; k < 20; k++) {
    sky.feed('pa', r.x, r.y + 2, r.z, 0, false);
    sky.feed('pb', r.x + 30, r.y + 2, r.z + 30, 0, false);
    sky.advance(1 / 30);
  }
  let got = sky.drainEvents().filter((e) => e.type === 'rare');
  assert.equal(got.length, 1);
  assert.equal(got[0].id, 'pa');
  assert.equal(got[0].species, r.species);
  assert.equal(r.by, 'pa');
  assert.equal(r.n, 0);
  assert.ok(sky.flocks.get('pa').n >= n0 + got[0].k);
  for (let k = 0; k < 20; k++) {
    sky.feed('pb', r.x, r.y + 2, r.z, 0, false);
    sky.advance(1 / 30);
  }
  got = sky.drainEvents().filter((e) => e.type === 'rare');
  assert.equal(got.length, 0, 'taken: nobody else gets it');
  assert.equal(sky.census().total, total0, 'birds are only moved, never made');
});

test('the shared sky turns to the next place every dawn', () => {
  const sky = new Sky({ seed: 4, rotate: true });
  sky.fillRivals();
  const seen = [sky.map.id];
  for (let d = 0; d < 4; d++) {
    while (sky.phase === 'day') sky.advance(0.5);
    while (sky.phase === 'night') sky.advance(0.5);
    seen.push(sky.map.id);
    assert.equal(sky.perched.length, sky.map.perches.count);
    assert.equal(!!sky.storm, sky.map.id === 'stormfield', 'the storm comes with Stormfield');
    for (const f of sky.flocks.values()) assert.ok(Math.abs(f.leader.x) < 330 && Math.abs(f.leader.z) < 330);
  }
  assert.deepEqual(seen, [...ROTATION, ROTATION[0]]);
});

test('a parked sky stops its clock and wakes with a fresh dawn', () => {
  const sky = new Sky({ seed: 5 });
  sky.fillRivals();
  sky.advance(30);
  sky.park();
  const rid = sky.rid;
  for (let k = 0; k < 600; k++) sky.advance(0.5);
  assert.equal(sky.time, ROUND.parkedTime);
  assert.equal(sky.phase, 'day');
  sky.unpark();
  assert.equal(sky.rid, rid + 1);
  assert.equal(sky.time, 0);
});

test('a new player\'s first sunset: the hawk leaves them alone until 1:30', () => {
  const sky = new Sky({ seed: 6, autoRivals: false, loop: false, hawkFirst: 10, hawkEvery: 10 });
  const f = sky.addFlock('pnew', { kind: 'player', n: 200, spawn: sky.map.spawns[0] });
  sky.protected.add('pnew');
  while (sky.time < HAWK.newPlayerSafe - 1) {
    const L = f.leader;
    sky.feed('pnew', L.x + 0.3, L.y, L.z, 0, false);
    sky.advance(1 / 10);
    assert.notEqual(sky.hawk.target, 'pnew');
  }
});
