// Migration: four places flown alone, one sunset each, with a goal worth up to three feathers.

import { Sky } from './sky.js';
import { PERSONALITY_ORDER } from './config.js';

export const MIGRATION_DAY = 120;

export const PLACES = [
  {
    id: 'saltmere',
    name: 'Saltmere Harbour',
    map: 'saltmere',
    rivals: 3,
    skill: 'easy',
    hawkEvery: 40,
    wild: 1000,
    goal: 'first',
    marks: [0, 200, 350],
    lines: ['Finish first', 'First with 200', 'First with 350'],
    light: 0,
  },
  {
    id: 'redrock',
    name: 'Redrock Canyon',
    map: 'redrock',
    rivals: 4,
    skill: 'normal',
    hawkEvery: 20,
    wild: 1000,
    goal: 'keep',
    marks: [120, 200, 300],
    lines: ['Keep 120', 'Keep 200', 'Keep 300'],
    light: 0,
  },
  {
    id: 'stormfield',
    name: 'Stormfield',
    map: 'stormfield',
    rivals: 4,
    skill: 'normal',
    hawkEvery: 35,
    wild: 1000,
    twist: 'storm',
    goal: 'first',
    marks: [0, 150, 250],
    lines: ['Finish first', 'First with 150', 'First with 250'],
    light: 0,
  },
  {
    id: 'lantern',
    name: 'Lantern City',
    map: 'lantern',
    rivals: 6,
    skill: 'hard',
    hawkEvery: 25,
    wild: 1600,
    goal: 'first',
    marks: [150, 300, 450],
    lines: ['First with 150', 'First with 300', 'First with 450'],
    light: 0.62, // starts in the pink
  },
];

/** Feathers (0-3) for finishing a place in `rank` (1 = first) with `n` birds. */
export function feathersFor(place, rank, n) {
  let k = 0;
  for (const mark of place.marks) {
    const ok = place.goal === 'first' ? rank === 1 && n >= mark : n >= mark;
    if (ok) k++;
  }
  return k;
}

/** Which places are open: the first always, then each one after a place with a feather. */
export function unlocked(feathers) {
  const out = [];
  for (let i = 0; i < PLACES.length; i++) out.push(i === 0 || (feathers[i - 1] ?? 0) > 0);
  return out;
}

export const totalFeathers = (feathers) => PLACES.reduce((a, _, i) => a + Math.max(0, Math.min(3, feathers[i] ?? 0)), 0);

/** A place's sky, with the player's flock `id` at the first spawn and its rivals around. */
export function placeSky(index, seed, id = 'pme', name = 'You') {
  const P = PLACES[index];
  const sky = new Sky({
    mapId: P.map,
    seed,
    day: MIGRATION_DAY,
    loop: false,
    autoRivals: false,
    wild: P.wild,
    hawkFirst: 30,
    hawkEvery: P.hawkEvery,
    hawkLateEvery: Math.min(22, P.hawkEvery),
    twist: P.twist ?? null,
    skill: P.skill,
  });
  sky.addFlock(id, { kind: 'player', name, slot: 0, local: true, spawn: sky.map.spawns[(seed >>> 0) % sky.map.spawns.length] });
  for (let k = 0; k < P.rivals; k++) sky.addRival({ personality: PERSONALITY_ORDER[k], skill: P.skill });
  sky.drainEvents();
  return sky;
}
