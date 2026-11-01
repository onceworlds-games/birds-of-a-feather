// Rival flocks: legal inputs, inside the world, and skill that shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sky } from '../src/sim/sky.js';
import { makeBrain, rivalInput } from '../src/sim/rivals.js';
import { makeRng } from '../src/sim/rng.js';
import { PERSONALITIES, SKILLS } from '../src/sim/config.js';

test('every personality and skill gives legal input and stays in the world', () => {
  for (const personality of Object.keys(PERSONALITIES)) {
    for (const skill of SKILLS) {
      const sky = new Sky({ seed: 11, autoRivals: false, loop: false });
      for (let k = 0; k < 5; k++) sky.addRival({ personality, skill });
      const rng = makeRng(1);
      const f = sky.flocks.get('r1');
      for (let k = 0; k < 900; k++) {
        const inp = rivalInput(sky, f, rng);
        assert.ok(Math.abs(inp.turn) <= 1 && Math.abs(inp.climb) <= 1 && typeof inp.boost === 'boolean', JSON.stringify(inp));
        sky.advance(1 / 15);
      }
      for (const g of sky.flocks.values()) assert.ok(Math.hypot(g.leader.x, g.leader.z) < 320, `${personality}/${skill} inside`);
    }
  }
});

/** One Hard flock (joining last, like a player) against six others; how often it wins. */
function winRate(others, seeds) {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const sky = new Sky({ seed: seed * 7, loop: false, autoRivals: false });
    for (let k = 0; k < 6; k++) sky.addRival({ skill: others });
    sky.addRival({ personality: ['gatherer', 'drifter', 'hunter', 'skittish'][seed % 4], skill: 'hard', name: 'Star' });
    while (sky.phase === 'day') {
      sky.advance(0.25);
      sky.drainEvents();
    }
    if (sky.standings[0].name === 'Star') wins++;
  }
  return wins / seeds;
}

test('skill shows: a Hard flock usually beats six Easy ones and rarely six Hard ones', () => {
  const easy = winRate('easy', 16);
  const hard = winRate('hard', 16);
  assert.ok(easy >= 0.6, `against Easy ${easy}`);
  assert.ok(hard <= 0.35, `against Hard ${hard}`);
});

test('no runaway sky: the lead changes in most sunsets and wild birds remain', () => {
  let changed = 0;
  let share = 0;
  const N = 10;
  for (let seed = 1; seed <= N; seed++) {
    const sky = new Sky({ seed, loop: false });
    sky.fillRivals();
    let leader = null;
    let changes = 0;
    while (sky.phase === 'day') {
      sky.advance(0.25);
      sky.drainEvents();
      if (sky.time < 20) continue;
      let top = null;
      for (const f of sky.flocks.values()) if (!top || f.n > top.n) top = f;
      if (leader && top.id !== leader) changes++;
      leader = top.id;
    }
    if (changes > 0) changed++;
    const c = sky.census();
    share += sky.standings[0].n / c.flocks;
    assert.ok(c.wild / c.total > 0.03, `wild left ${(c.wild / c.total).toFixed(2)}`);
  }
  assert.ok(changed / N >= 0.6, `lead changed in ${changed}/${N}`);
  assert.ok(share / N < 0.6, `winner's share ${(share / N).toFixed(2)}`);
});

test('a brain for an unknown personality or skill falls back safely', () => {
  const b = makeBrain('nope', 'nope');
  assert.equal(b.personality, 'gatherer');
  assert.equal(b.skill, 'normal');
});
