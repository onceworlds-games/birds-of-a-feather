import test from 'node:test';
import assert from 'node:assert/strict';
import { Trail, shapeOf, newPuffs, flockLength } from '../src/sim/flock.js';
import { FLOCK } from '../src/sim/config.js';

// the own leader is flown at 60 Hz and pushes every frame; rivals and the host push at 30 Hz
for (const hz of [60, 30, 144]) {
  test(`a trail fed at ${hz} Hz keeps points a sample apart, its newest on the leader`, () => {
    const tr = new Trail();
    const step = 1 / FLOCK.trailHz;
    let t = 0;
    for (let k = 0; k < hz * 6; k++) {
      t = k / hz;
      tr.push(t, t * 14, 50, 0);
    }
    const o = tr.newest({});
    assert.equal(o.t, t);
    assert.ok(Math.abs(o.x - t * 14) < 1e-3);
    // the kept points (older than the newest) are a sample apart, give or take one push
    const times = [];
    for (let k = 0; k < tr.n; k++) times.push(tr.t[(tr.head - k + tr.cap) % tr.cap]);
    for (let k = 2; k < times.length; k++) {
      const gap = times[k - 1] - times[k];
      assert.ok(gap >= step - 1e-6 && gap <= step + 1 / hz + 1e-6, `gap ${gap}`);
    }
    // enough history for the longest flock
    assert.ok(times[0] - times[times.length - 1] >= FLOCK.trailSeconds - step - 1 / hz);
    // sampling the past finds the straight path
    const s = tr.sample(t - 1.5, {});
    assert.ok(Math.abs(s.x - (t - 1.5) * 14) < 0.05, `x ${s.x}`);
  });
}

test('time going back is ignored; a reset starts again', () => {
  const tr = new Trail();
  tr.push(1, 1, 0, 0);
  tr.push(2, 2, 0, 0);
  tr.push(1.5, 99, 0, 0);
  assert.equal(tr.newest({}).x, 2);
  tr.reset(5, 7, 8, 9);
  assert.equal(tr.n, 1);
  assert.deepEqual([tr.newest({}).x, tr.newest({}).y, tr.newest({}).z], [7, 8, 9]);
});

test('a flock fed at 60 Hz has a head-heavy shape along its path, without NaN', () => {
  const tr = new Trail();
  const puffs = newPuffs();
  let t = 0;
  for (let k = 0; k < 600; k++) {
    t = k / 60;
    tr.push(t, Math.cos(t * 0.4) * 40, 50 + Math.sin(t), Math.sin(t * 0.4) * 40);
  }
  for (const n of [1, 30, 200, 900]) {
    shapeOf(tr, n, t, puffs);
    let total = 0;
    for (const p of puffs) {
      for (const v of [p.x, p.y, p.z, p.r, p.birds]) assert.ok(Number.isFinite(v));
      total += p.birds;
    }
    assert.ok(Math.abs(total - n) < 1e-6 * Math.max(1, n));
    assert.ok(puffs[0].birds >= puffs[puffs.length - 1].birds);
    // the tail trails the head by the flock's seconds of path (the leader flies 16 u/s here)
    const len = Math.hypot(puffs[0].x - puffs[7].x, puffs[0].z - puffs[7].z);
    assert.ok(len > 0 && len <= flockLength(n) * 16 * (7 / 8) + 0.5, `length ${len} for ${n}`);
  }
});
