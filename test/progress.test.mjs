// Tricks, song, levels and unlocks, the Daily Sunset and its goals, the streak, and the saved profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Tricks, TRICK, SONG } from '../src/sim/tricks.js';
import * as G from '../src/sim/progress.js';
import { SPECIES, CATCH_SONG } from '../src/sim/species.js';
import { ROTATION } from '../src/sim/config.js';

const join = (k, extra = {}) => ({ type: 'join', id: 'pme', k, x: 0, y: 10, z: 0, ...extra });

test('a chorus: separate gathers in quick succession climb; one long gather is one note; a pause ends it', () => {
  const T = new Tricks('pme');
  let t = 0;
  const steps = [];
  for (let g = 0; g < 4; g++) {
    // one gather is several joins a tick apart
    for (let j = 0; j < 3; j++) {
      for (const c of T.push([join(2)], t)) if (c.step) steps.push(c.step);
      t += 0.1;
    }
    t += 1.2;
  }
  assert.deepEqual(steps, [1, 2, 3, 4]);
  assert.equal(T.bestChain, 4);
  t += TRICK.chorusGap + 0.5;
  const after = T.push([join(1)], t);
  assert.equal(after[0].step, 1, 'a pause starts over');
  assert.equal(T.bestChain, 4);
});

test('the fifth note brings a Tailwind for a few seconds', () => {
  const T = new Tricks('pme');
  let t = 10;
  let wind = null;
  for (let g = 0; g < TRICK.tailwindAt; g++) {
    for (const c of T.push([join(3)], t)) if (c.kind === 'tailwind') wind = t;
    t += 1.5;
  }
  assert.ok(wind !== null);
  assert.ok(T.tailwind(wind + 1));
  assert.ok(!T.tailwind(wind + TRICK.tailwind + 0.1));
  assert.equal(T.counts.tailwind, 1);
});

test('steals: song per bird, a Tail cut once per pass from a bigger flock, a Scatter when the victim is gone', () => {
  const T = new Tricks('pme');
  const n = { r1: 30 };
  const steal = (k, pass, bigger = true) => ({ type: 'steal', from: 'r1', to: 'pme', k, pass, bigger, x: 0, y: 0, z: 0, lw: 9, ll: 3 });
  let calls = [];
  for (let p = 4; p <= 20; p += 4) calls.push(...T.push([steal(4, p)], p, (id) => n[id]));
  assert.equal(calls.filter((c) => c.kind === 'tailCut').length, 1);
  assert.equal(T.stolen, 20);
  // a new pass can cut again
  calls = [...T.push([steal(4, 4)], 30, (id) => n[id]), ...T.push([steal(10, 14)], 31, (id) => n[id])];
  assert.equal(calls.filter((c) => c.kind === 'tailCut').length, 1);
  // smaller victims never give a Tail cut
  const U = new Tricks('pme');
  assert.equal(U.push([steal(14, 14, false)], 1, () => 5).filter((c) => c.kind === 'tailCut').length, 0);
  // the last bird taken scatters it
  n.r1 = 0;
  calls = T.push([steal(3, 3, false)], 40, (id) => n[id]);
  assert.equal(calls.filter((c) => c.kind === 'scatter').length, 1);
  assert.equal(T.push([steal(1, 4, false)], 41, (id) => n[id]).filter((c) => c.kind === 'scatter').length, 0);
});

test('the hawk: a dodge, a close call; scraps from a cloud; a rare bird; nobody else\'s events count', () => {
  const T = new Tricks('pme');
  const c1 = T.push([{ type: 'strike', target: 'pme', dodged: true, losses: {}, x: 0, y: 0, z: 0 }], 1);
  assert.equal(c1[0].kind, 'dodge');
  const c2 = T.push([{ type: 'strike', target: 'pme', dodged: false, losses: { pme: 2 }, x: 0, y: 0, z: 0 }], 2);
  assert.equal(c2[0].kind, 'closeCall');
  assert.equal(T.push([{ type: 'strike', target: 'pme', dodged: false, losses: { pme: 30 }, x: 0, y: 0, z: 0 }], 3).length, 0);
  assert.equal(T.push([join(8, { cloud: 3 })], 4)[0].kind, 'scavenge');
  const sp = SPECIES.findIndex((s) => s.id === 'kingfisher');
  const r = T.push([{ type: 'rare', id: 'pme', species: sp, k: 24, x: 0, y: 0, z: 0 }], 5);
  assert.equal(r[0].kind, 'rare');
  assert.equal(r[0].song, CATCH_SONG[1]);
  assert.deepEqual(T.rares, [sp]);
  const before = T.song;
  T.push([join(9, { id: 'r2' }), { type: 'rare', id: 'r2', species: sp, k: 9, x: 0, y: 0, z: 0 }, { type: 'strike', target: 'r2', dodged: true, losses: {} }], 6);
  assert.equal(T.song, before);
});

test('levels: song needed grows, level 40 is the top, unlocks come at their levels', () => {
  assert.deepEqual(G.levelOf(0), { level: 1, into: 0, need: G.needFor(1), share: 0 });
  assert.equal(G.levelOf(G.needFor(1)).level, 2);
  assert.equal(G.levelOf(G.needFor(1) - 1).level, 1);
  for (let l = 1; l < G.MAX_LEVEL; l++) assert.ok(G.needFor(l + 1) > G.needFor(l));
  assert.equal(G.levelOf(G.songAt(17)).level, 17);
  assert.equal(G.levelOf(1e9).level, G.MAX_LEVEL);
  assert.equal(G.levelOf(1e9).share, 1);
  // every trail and flair past the first is reachable, one level each
  const all = G.unlocksBetween(1, G.MAX_LEVEL);
  assert.equal(all.length, G.TRAILS.length - 1 + G.FLAIRS.length - 1);
  assert.equal(new Set(all.map((u) => `${u.kind}${u.id}`)).size, all.length);
  assert.deepEqual(G.unlocksAt(2), [{ kind: 'trail', id: 1, name: 'Petals' }]);
  assert.ok(G.trailOpen(1, 2) && !G.trailOpen(2, 4));
  // a good sunset is worth a level early on, and the top takes a long while
  assert.ok(G.songAt(3) < 1200);
  assert.ok(G.songAt(40) > 100000);
});

test('the tally: flock, place, tricks, rare birds, goals, first of the day, the streak', () => {
  const t = G.tally({ n: 212, rank: 0, flocks: 6, trickSong: 340, rares: [10, 20], goals: 2, firstToday: true, streak: 3 });
  const by = Object.fromEntries(t.lines.map((l) => [l.key + (l.key === 'rare' ? l.label : ''), l.song]));
  assert.equal(by.flock, 212);
  assert.equal(by.place, G.PLACE_SONG[0]);
  assert.equal(by.tricks, 340);
  assert.equal(by[`rare${SPECIES[10].name}`], CATCH_SONG[SPECIES[10].rarity]);
  assert.equal(by.goals, 2 * G.GOAL_SONG);
  assert.equal(by.today, G.FIRST_TODAY);
  assert.equal(by.streak, G.streakSong(3));
  assert.equal(t.total, t.lines.reduce((a, l) => a + l.song, 0));
  // no place song in a near-empty sky, nothing for nothing
  assert.equal(G.tally({ n: 0, rank: 0, flocks: 2, trickSong: 0 }).total, 0);
});

test('the Daily Sunset and its goals are the same for everyone on a day, and change the next', () => {
  const a = G.dailySpec(20400);
  assert.deepEqual(a, G.dailySpec(20400));
  assert.ok(ROTATION.includes(a.mapId));
  assert.notEqual(G.dailySpec(20401).mapId, a.mapId);
  const g = G.goalsFor(20400);
  assert.deepEqual(g, G.goalsFor(20400));
  assert.equal(g.length, 3);
  assert.equal(new Set(g.map((x) => x.id)).size, 3);
  assert.ok(g.every((x) => typeof x.text === 'string' && x.text.length > 4 && x.target > 0));
  let differs = false;
  for (let d = 20401; d < 20410; d++) if (JSON.stringify(G.goalsFor(d)) !== JSON.stringify(g)) differs = true;
  assert.ok(differs);
});

test('goals add up over the day\'s sunsets (or take the best), finish once, and start over the next day', () => {
  const day = 20400;
  const goals = G.goalsFor(day);
  const daily = G.PROFILE0().daily;
  const big = {};
  for (const x of goals) big[x.stat] = x.target;
  const half = {};
  for (const x of goals) half[x.stat] = x.mode === 'sum' ? x.target / 2 : x.target - 1;
  assert.equal(G.applyGoals(daily, day, {}), 0);
  const sums = goals.filter((x) => x.mode === 'sum').length;
  assert.equal(G.applyGoals(daily, day, half), 0, 'halfway');
  assert.equal(G.applyGoals(daily, day, half), sums, 'two halves finish a sum goal; a best of nearly is not enough');
  assert.equal(G.applyGoals(daily, day, big), 3 - sums);
  assert.ok(daily.done.every(Boolean));
  assert.equal(G.applyGoals(daily, day, big), 0, 'a goal finishes once');
  assert.equal(G.applyGoals(daily, day + 1, {}), 0);
  assert.deepEqual(daily.done, [false, false, false]);
  assert.equal(daily.day, day + 1);
});

test('the streak grows a day at a time and starts over after a gap', () => {
  const s = { day: -1, count: 0, best: 0 };
  assert.ok(G.bumpStreak(s, 100));
  assert.ok(!G.bumpStreak(s, 100), 'once a day');
  G.bumpStreak(s, 101);
  G.bumpStreak(s, 102);
  assert.equal(s.count, 3);
  G.bumpStreak(s, 105);
  assert.equal(s.count, 1);
  assert.equal(s.best, 3);
});

test('a saved profile is checked: v1 keeps its numbers, junk is dropped, equips must be earned', () => {
  const v1 = { v: 1, best: 140, sunsets: 12, wins: 3, feathers: [1, 2, 0, 0], skill: 'hard', hints: ['steer'] };
  const p = G.cleanProfile(v1);
  assert.equal(p.v, 2);
  assert.equal(p.best, 140);
  assert.equal(p.sunsets, 12);
  assert.deepEqual(p.feathers, [1, 2, 0, 0]);
  assert.equal(p.xp, 0);
  assert.deepEqual(p.equip, { species: 'starling', trail: 0, flair: 0 });
  const odd = G.cleanProfile({
    xp: G.songAt(6),
    aviary: { kingfisher: 2, dodo: 5, raven: -1, jay: 'x' },
    equip: { species: 'raven', trail: 2, flair: 2 },
    streak: { day: 20400, count: 4, best: 9 },
    daily: { day: 20400, progress: [5, 'x', 2], done: [true, 1, false] },
    tricks: { tailCut: 3, 'bad key!': 9 },
  });
  assert.deepEqual(odd.aviary, { kingfisher: 2 });
  assert.equal(odd.equip.species, 'starling', 'a species not caught can not lead');
  assert.equal(odd.equip.trail, 2);
  assert.equal(odd.equip.flair, 2);
  assert.deepEqual(odd.daily.progress, [5, 0, 2]);
  assert.deepEqual(odd.daily.done, [true, false, false]);
  assert.deepEqual(odd.tricks, { tailCut: 3 });
  assert.equal(G.cleanProfile({ xp: 10, equip: { trail: 7, flair: 6 } }).equip.trail, 0, 'not unlocked yet');
  assert.ok(G.leadable(odd).some((s) => s.id === 'kingfisher'));
  assert.equal(G.cleanProfile(null).v, 2);
  assert.equal(G.cleanProfile('junk').xp, 0);
});

test('song for tricks is what the table says', () => {
  const T = new Tricks('pme');
  T.thermal();
  T.slingshot();
  assert.equal(T.song, SONG.thermal + SONG.slingshot);
});

test('the week: three bigger goals, the same for everyone, adding up over the week, starting over on Monday', () => {
  // 20400 is a Monday? weeks turn on Mondays: the day before a turn and the turn are in different weeks
  let turn = 20400;
  while (G.weekNumber(turn) === G.weekNumber(turn - 1)) turn++;
  assert.equal(new Date(turn * G.DAY_MS).getUTCDay(), 1, 'a week starts on a Monday');
  assert.equal(G.weekNumber(turn + 6), G.weekNumber(turn));
  assert.equal(G.weekNumber(turn + 7), G.weekNumber(turn) + 1);
  const wk = G.weekNumber(turn);
  const goals = G.weeklyFor(wk);
  assert.deepEqual(goals, G.weeklyFor(wk));
  assert.equal(goals.length, 3);
  assert.equal(new Set(goals.map((g) => g.id)).size, 3);
  const weekly = G.PROFILE0().weekly;
  const third = {};
  for (const g of goals) third[g.stat] = Math.ceil(g.target / 3);
  assert.equal(G.applyWeekly(weekly, wk, third), 0);
  assert.equal(G.applyWeekly(weekly, wk, third), 0);
  assert.equal(G.applyWeekly(weekly, wk, third), 3, 'three sunsets of a third each finish all three');
  assert.equal(G.applyWeekly(weekly, wk, third), 0, 'once');
  G.applyWeekly(weekly, wk + 1, {});
  assert.deepEqual(weekly.done, [false, false, false]);
  // a week's goals are worth more than a day's, and they show in the tally
  assert.ok(G.WEEK_SONG > G.GOAL_SONG);
  const t = G.tally({ n: 10, rank: 4, flocks: 6, trickSong: 0, weekly: 2 });
  assert.equal(t.lines.find((l) => l.key === 'week').song, 2 * G.WEEK_SONG);
  // saved weeks are checked
  const p = G.cleanProfile({ weekly: { week: wk, progress: [3, -1, 'x'], done: [true, 'yes', false] } });
  assert.deepEqual(p.weekly, { week: wk, progress: [3, 0, 0], done: [true, false, false] });
  assert.equal(G.cleanProfile({ weekly: { week: 1.5 } }).weekly.week, -1);
});
