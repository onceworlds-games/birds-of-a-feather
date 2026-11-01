// Progress that lasts: song (points) tallied after every sunset into levels 1-40 that unlock trails and flock flair; the
// Aviary of caught species; the Daily Sunset, its three goals and the day streak; the saved profile and its checks.
// Pure: no page, no clock of its own (days come in as numbers).

import { SPECIES, CATCH_SONG } from './species.js';
import { SKILLS, ROTATION, PLACE_TWIST } from './config.js';
import { hashString, makeRng, clamp } from './rng.js';

export const MAX_LEVEL = 40;

/** Song from level L to L+1. */
export const needFor = (level) => Math.round(300 + 90 * (level - 1) + 5 * (level - 1) ** 2);

/** Total song at which level L begins. */
export function songAt(level) {
  let s = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) s += needFor(l);
  return s;
}

/** Where a song total stands: { level, into (song into this level), need (to the next; 0 at the top), share }. */
export function levelOf(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(xp || 0));
  while (level < MAX_LEVEL && left >= needFor(level)) {
    left -= needFor(level);
    level++;
  }
  const need = level >= MAX_LEVEL ? 0 : needFor(level);
  return { level, into: need ? left : 0, need, share: need ? left / need : 1 };
}

/** Trails drawn behind the lead bird (ids index this list). */
export const TRAILS = [
  { id: 0, name: 'Streamers', level: 1 },
  { id: 1, name: 'Petals', level: 2 },
  { id: 2, name: 'Sparks', level: 5 },
  { id: 3, name: 'Lanterns', level: 8 },
  { id: 4, name: 'Comet', level: 12 },
  { id: 5, name: 'Rainbow', level: 17 },
  { id: 6, name: 'Feathers', level: 24 },
  { id: 7, name: 'Aurora', level: 32 },
];

/** Flock flair: how a whole flock shines (ids are the bird shader's). */
export const FLAIRS = [
  { id: 0, name: 'Plain', level: 1 },
  { id: 1, name: 'Shimmer', level: 3 },
  { id: 2, name: 'Dusk glow', level: 6 },
  { id: 5, name: 'Gilded tips', level: 10 },
  { id: 3, name: 'Stardust', level: 14 },
  { id: 4, name: 'Night lights', level: 20 },
  { id: 6, name: 'Ember', level: 28 },
];

/** What a level brings: [{ kind: 'trail' | 'flair', id, name }]. */
export function unlocksAt(level) {
  const out = [];
  for (const t of TRAILS) if (t.level === level && level > 1) out.push({ kind: 'trail', id: t.id, name: t.name });
  for (const f of FLAIRS) if (f.level === level && level > 1) out.push({ kind: 'flair', id: f.id, name: f.name });
  return out;
}

/** Everything unlocked going from one level to another. */
export function unlocksBetween(from, to) {
  const out = [];
  for (let l = from + 1; l <= to; l++) out.push(...unlocksAt(l));
  return out;
}

export const trailOpen = (id, level) => TRAILS.some((t) => t.id === id && t.level <= level);
export const flairOpen = (id, level) => FLAIRS.some((f) => f.id === id && f.level <= level);

// ------------------------------------------------------------------ the sunset's tally

export const PLACE_SONG = [150, 90, 50];
export const GOAL_SONG = 150;
export const FIRST_TODAY = 100;
export const streakSong = (count) => 25 * Math.min(Math.max(count, 0), 8);

/**
 * The song of a sunset, line by line: { lines: [{ key, label, song }], total }.
 * r: { n (flock at sundown), rank (0 first), flocks, trickSong (gathers, steals and tricks), rares: [species], goals (newly
 * done), firstToday, streak (the count if it grew today, else 0) }.
 */
export function tally(r) {
  const lines = [];
  const add = (key, label, song) => {
    if (song > 0) lines.push({ key, label, song: Math.round(song) });
  };
  add('flock', `Flock at sundown`, r.n);
  if (r.flocks >= 3 && r.n > 0 && r.rank < PLACE_SONG.length) add('place', ['First', 'Second', 'Third'][r.rank], PLACE_SONG[r.rank]);
  add('tricks', 'Gathers, steals and tricks', r.trickSong);
  for (const sp of r.rares ?? []) if (SPECIES[sp]) add('rare', SPECIES[sp].name, CATCH_SONG[SPECIES[sp].rarity]);
  if (r.goals) add('goals', r.goals === 1 ? 'Daily goal' : `${r.goals} daily goals`, GOAL_SONG * r.goals);
  if (r.firstToday) add('today', 'First sunset today', FIRST_TODAY);
  if (r.streak > 1) add('streak', `${r.streak} days running`, streakSong(r.streak));
  return { lines, total: lines.reduce((a, l) => a + l.song, 0) };
}

// ------------------------------------------------------------------ days: the Daily Sunset, goals, the streak

export const DAY_MS = 86400000;
export const dayNumber = (ms) => Math.floor(ms / DAY_MS);

/** The Daily Sunset for a day: the same place, twist, rivals and seed for everyone. */
export function dailySpec(day) {
  const rng = makeRng(`daily:${day}`);
  const mapId = ROTATION[((day % ROTATION.length) + ROTATION.length) % ROTATION.length];
  return {
    day,
    mapId,
    seed: hashString(`daily-seed:${day}`) % 1e9,
    twist: PLACE_TWIST[mapId] ?? null,
    rivals: 5 + rng.int(0, 2),
    skill: rng.chance(0.5) ? 'normal' : 'hard',
    hawkEvery: rng.pick([22, 28, 34]),
  };
}

/** The pool of daily goals: `sum` adds up over the day's sunsets, `max` takes the best one. */
export const GOALS = [
  { id: 'gather', text: (k) => `Gather ${k} birds`, stat: 'gathered', mode: 'sum', amounts: [200, 350, 500] },
  { id: 'steal', text: (k) => `Steal ${k} birds`, stat: 'stolen', mode: 'sum', amounts: [40, 80, 150] },
  { id: 'chorus', text: (k) => `Sing a Chorus of ${k}`, stat: 'bestChain', mode: 'max', amounts: [4, 5, 6] },
  { id: 'tailcut', text: (k) => (k === 1 ? 'Cut a tail' : `Cut ${k} tails`), stat: 'tailCut', mode: 'sum', amounts: [1, 2, 3] },
  { id: 'rare', text: (k) => (k === 1 ? 'Catch a rare bird' : `Catch ${k} rare birds`), stat: 'rares', mode: 'sum', amounts: [1, 2] },
  { id: 'dodge', text: () => 'Dodge the hawk', stat: 'dodge', mode: 'sum', amounts: [1] },
  { id: 'top3', text: (k) => (k === 1 ? 'Finish in the top three' : `Finish in the top three ${k} times`), stat: 'top3', mode: 'sum', amounts: [1, 2] },
  { id: 'size', text: (k) => `Lead a flock of ${k}`, stat: 'maxN', mode: 'max', amounts: [150, 250, 350] },
  { id: 'sunsets', text: (k) => `Fly ${k} sunsets`, stat: 'sunsets', mode: 'sum', amounts: [2, 3] },
  { id: 'thermal', text: (k) => `Ride ${k} thermals`, stat: 'thermal', mode: 'sum', amounts: [3, 5] },
];

/** A day's three goals: [{ id, text, stat, mode, target }], different kinds, the same for everyone. */
export function goalsFor(day) {
  const rng = makeRng(`goals:${day}`);
  const pick = rng.shuffle(GOALS).slice(0, 3);
  return pick.map((g) => {
    const target = rng.pick(g.amounts);
    return { id: g.id, text: g.text(target), stat: g.stat, mode: g.mode, target };
  });
}

/**
 * Add a sunset's stats to the day's goals. `daily` is the profile's { day, progress: [3], done: [3] }; returns how many
 * goals this sunset finished. A new day starts the goals over.
 */
export function applyGoals(daily, day, stats) {
  if (daily.day !== day) {
    daily.day = day;
    daily.progress = [0, 0, 0];
    daily.done = [false, false, false];
    daily.best = 0;
    daily.played = 0;
    daily.flew = false;
  }
  const goals = goalsFor(day);
  let finished = 0;
  goals.forEach((g, i) => {
    const v = Math.max(0, stats[g.stat] ?? 0);
    daily.progress[i] = g.mode === 'max' ? Math.max(daily.progress[i], v) : daily.progress[i] + v;
    if (!daily.done[i] && daily.progress[i] >= g.target) {
      daily.done[i] = true;
      finished++;
    }
  });
  return finished;
}

/** The streak after playing on `day`: one more if yesterday was played, back to 1 after a gap. Returns true if it grew. */
export function bumpStreak(streak, day) {
  if (streak.day === day) return false;
  streak.count = streak.day === day - 1 ? streak.count + 1 : 1;
  streak.day = day;
  streak.best = Math.max(streak.best, streak.count);
  return true;
}

// ------------------------------------------------------------------ the saved profile

export const PROFILE0 = () => ({
  v: 2,
  best: 0,
  biggest: 0,
  sunsets: 0,
  wins: 0,
  gathered: 0,
  stolen: 0,
  feathers: [0, 0, 0, 0],
  skill: 'normal',
  hints: [],
  xp: 0,
  aviary: {}, // species id → how many caught
  equip: { species: 'starling', trail: 0, flair: 0 },
  streak: { day: -1, count: 0, best: 0 },
  daily: { day: -1, progress: [0, 0, 0], done: [false, false, false], best: 0, played: 0, flew: false }, // best, flew: the Daily Sunset
  tricks: {},
});

const count = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.floor(Math.min(v, max)) : 0);
const day = (v) => (Number.isInteger(v) && v >= -1 && v < 1e7 ? v : -1);

/** A saved profile, checked and brought up to date (a v1 profile keeps everything it had). */
export function cleanProfile(p) {
  const o = PROFILE0();
  if (!p || typeof p !== 'object') return o;
  for (const k of ['best', 'biggest', 'sunsets', 'wins', 'gathered', 'stolen']) o[k] = count(p[k]);
  if (Array.isArray(p.feathers)) o.feathers = [0, 1, 2, 3].map((i) => (Number.isInteger(p.feathers[i]) ? clamp(p.feathers[i], 0, 3) : 0));
  if (SKILLS.includes(p.skill)) o.skill = p.skill;
  if (Array.isArray(p.hints)) o.hints = p.hints.filter((h) => typeof h === 'string' && h.length < 20).slice(0, 30);
  o.xp = count(p.xp, 1e8);
  const level = levelOf(o.xp).level;
  if (p.aviary && typeof p.aviary === 'object') {
    for (const s of SPECIES) if (count(p.aviary[s.id]) > 0) o.aviary[s.id] = count(p.aviary[s.id], 1e6);
  }
  const e = p.equip ?? {};
  if (typeof e.species === 'string' && (e.species === 'starling' || o.aviary[e.species])) o.equip.species = e.species;
  if (Number.isInteger(e.trail) && trailOpen(e.trail, level)) o.equip.trail = e.trail;
  if (Number.isInteger(e.flair) && flairOpen(e.flair, level)) o.equip.flair = e.flair;
  const s = p.streak ?? {};
  o.streak = { day: day(s.day), count: count(s.count, 1e5), best: count(s.best, 1e5) };
  const d = p.daily ?? {};
  o.daily = {
    day: day(d.day),
    progress: [0, 1, 2].map((i) => count(Array.isArray(d.progress) ? d.progress[i] : 0)),
    done: [0, 1, 2].map((i) => Array.isArray(d.done) && d.done[i] === true),
    best: count(d.best, 5000),
    played: count(d.played, 1000),
    flew: d.flew === true,
  };
  if (p.tricks && typeof p.tricks === 'object') for (const [k, v] of Object.entries(p.tricks).slice(0, 20)) if (/^[a-zA-Z]{1,12}$/.test(k)) o.tricks[k] = count(v);
  return o;
}

/** The species a profile can lead with: the starling, and every one it has caught. */
export const leadable = (profile) => SPECIES.filter((s) => s.id === 'starling' || profile.aviary[s.id] > 0);
