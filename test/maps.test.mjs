// The four places: valid, reachable and the same on every page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_IDS, getMap, groundAt, surfaceAt, wheelPos } from '../src/sim/maps.js';
import { band } from '../src/sim/flight.js';
import { canGather } from '../src/sim/sky.js';
import { FLIGHT, GATHER } from '../src/sim/config.js';

test('four places', () => {
  assert.deepEqual(MAP_IDS, ['saltmere', 'redrock', 'stormfield', 'lantern']);
});

for (const id of MAP_IDS) {
  test(`${id}: perches, thermals, wheels, spawns and the roost are sound`, () => {
    const map = getMap(id);
    const P = map.perches;
    assert.ok(P.count >= 1400, `${P.count} perches`);
    let reach = 0;
    for (let s = 0; s < P.count; s++) {
      const x = P.x[s];
      const y = P.y[s];
      const z = P.z[s];
      assert.ok([x, y, z].every(Number.isFinite), `perch ${s}`);
      assert.ok(Math.hypot(x - map.center.x, z - map.center.z) < 262, `perch ${s} inside`);
      assert.ok(y >= groundAt(map, x, z) - 0.5, `perch ${s} above ground`);
      // a bird cruising over it gathers it
      const b = band(map, x, z, 0, 0, false);
      if (y <= b.cruise + GATHER.over && canGather(map, { x, y: b.cruise, z })) reach++;
    }
    assert.ok(reach / P.count > 0.97, `reachable at cruise: ${(reach / P.count * 100).toFixed(1)}%`);
    for (const g of map.groups) assert.ok(g.count >= 1 && g.start + g.count <= P.count);
    assert.ok(map.thermals.length >= 6, `${map.thermals.length} thermals`);
    for (const th of map.thermals) assert.ok(Math.hypot(th.x - map.center.x, th.z - map.center.z) < FLIGHT.boundaryAssist);
    assert.ok(map.wheels.length >= 4);
    for (let w = 0; w < map.wheels.length; w++) {
      for (let t = 0; t < 180; t += 7) {
        const p = wheelPos(map, w, t, {});
        assert.ok(Math.hypot(p.x - map.center.x, p.z - map.center.z) < FLIGHT.boundaryAssist, 'wheel inside');
        assert.ok(p.y > surfaceAt(map, p.x, p.z) + 2, 'wheel above roofs');
      }
    }
    assert.equal(map.spawns.length, 12);
    for (const sp of map.spawns) assert.ok(Math.hypot(sp.x - map.center.x, sp.z - map.center.z) < FLIGHT.boundaryAssist);
    assert.ok(map.roost && map.roost.wires.length >= 5);
    assert.ok(map.title && map.title.wire && map.title.spawn);
  });
}

test('places are built the same every time', async () => {
  const a = getMap('saltmere');
  const { getMap: again } = await import('../src/sim/maps.js?fresh');
  const b = again('saltmere');
  assert.notEqual(a, b);
  assert.equal(a.perches.count, b.perches.count);
  for (let s = 0; s < a.perches.count; s += 37) assert.equal(a.perches.x[s], b.perches.x[s]);
  assert.equal(a.buildings.length, b.buildings.length);
});
