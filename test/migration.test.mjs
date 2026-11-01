// Migration: places, feathers and unlocking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, feathersFor, unlocked, totalFeathers, placeSky, MIGRATION_DAY } from '../src/sim/migration.js';

test('feathers by goal', () => {
  const salt = PLACES[0];
  assert.equal(feathersFor(salt, 1, 10), 1);
  assert.equal(feathersFor(salt, 2, 900), 0);
  assert.equal(feathersFor(salt, 1, salt.marks[2]), 3);
  const red = PLACES[1];
  assert.equal(feathersFor(red, 4, red.marks[0]), 1, 'keep goals ignore the place');
  assert.equal(feathersFor(red, 1, red.marks[0] - 1), 0);
});

test('places unlock in order', () => {
  assert.deepEqual(unlocked([]), [true, false, false, false]);
  assert.deepEqual(unlocked([1, 0, 0, 0]), [true, true, false, false]);
  assert.deepEqual(unlocked([3, 2, 1, 0]), [true, true, true, true]);
  assert.equal(totalFeathers([3, 2, 9, -1]), 8);
});

test('every place runs to its sundown with its rivals', () => {
  PLACES.forEach((P, i) => {
    const sky = placeSky(i, 42);
    assert.equal(sky.flocks.size, P.rivals + 1);
    assert.ok(sky.flocks.has('pme'));
    const total = sky.census().total;
    while (sky.phase === 'day') {
      sky.advance(0.25);
      sky.drainEvents();
    }
    assert.ok(Math.abs(sky.time - MIGRATION_DAY) < 0.3);
    assert.equal(sky.census().total, total);
    assert.ok(sky.standings.some((s) => s.id === 'pme'));
  });
});
