// Rival flocks: each a personality (what it wants) and a skill (how well it does it). They think on the host's page at a human
// pace and fly with exactly the same flight rules as a player's bird.

import { PERSONALITIES, RIVAL_SKILL, PUFF_SHARE } from './config.js';
import { clamp, angleDiff } from './rng.js';
import { wheelPos } from './maps.js';

export function makeBrain(personality, skill) {
  return {
    personality: PERSONALITIES[personality] ? personality : 'gatherer',
    skill: RIVAL_SKILL[skill] ? skill : 'normal',
    next: 0,
    goal: null,
    noise: 0,
    noiseTarget: 0,
    boostUntil: 0,
    dodgeHawk: -1, // which hawk (its start time) we decided about
    dodging: false,
    dodgeUntil: 0,
    dodgeDir: 1,
    misjudge: 0,
    fleeBoost: false,
  };
}

const TAIL_SHARE = PUFF_SHARE[5] + PUFF_SHARE[6] + PUFF_SHARE[7];

/** Is the leader L behind flock o's head (and o not turned toward it)? */
function behind(o, L) {
  const head = o.puffs[0];
  return Math.cos(o.leader.yaw) * (L.x - head.x) + Math.sin(o.leader.yaw) * (L.z - head.z) < -5;
}
const tmpW = {};

/** Re-decide what to go for. */
function think(sky, f, rng) {
  const b = f.brain;
  const P = PERSONALITIES[b.personality];
  const S = RIVAL_SKILL[b.skill];
  const L = f.leader;
  // once running, keep running until the threat is well behind or has turned away
  if (b.goal && b.goal.kind === 'flee') {
    const o = sky.flocks.get(b.goal.id);
    if (o && o.n > f.n && !o.away) {
      const head = o.puffs[0];
      const d = Math.hypot(head.x - L.x, head.z - L.z);
      const closing = (Math.cos(o.leader.yaw) * (L.x - head.x) + Math.sin(o.leader.yaw) * (L.z - head.z)) / (d || 1);
      if (d < 50 && (closing > 0.5 || d < 22)) {
        b.next = sky.clock + S.reaction * (0.8 + 0.4 * rng.next());
        return;
      }
    }
  }
  const me = Math.max(0, f.n);
  const est = (n) => n * (1 + S.misjudge * rng.wobble());
  // like people: everyone hunts the leader, and a flock far ahead gets lazy
  let biggest = null;
  let second = 0;
  for (const o of sky.flocks.values()) {
    if (!biggest || o.n > biggest.n) {
      second = biggest ? biggest.n : second;
      biggest = o;
    } else if (o.n > second) second = o.n;
  }
  const lazy = biggest === f && me > 2 * second ? 0.35 : 1;
  const meEst = est(me);
  let best = null;
  let bestV = 0;
  // bigger flocks nearby make any target near them a bad idea
  const dangers = [];
  for (const o of sky.flocks.values()) {
    if (o === f || o.away || o.n < 10) continue;
    if (est(o.n) > me * 1.2) dangers.push(o.puffs[0]);
  }
  const risky = (x, z) => {
    for (const p of dangers) if (Math.hypot(p.x - x, p.z - z) < 40) return 0.15;
    return 1;
  };
  const consider = (v, goal) => {
    if (goal.x !== undefined) v *= risky(goal.x, goal.z);
    if (v > bestV) {
      bestV = v;
      best = goal;
    }
  };
  const map = sky.map;
  // grey birds on perches
  for (let g = 0; g < map.groups.length; g++) {
    const live = sky.groupLive[g];
    if (live < 3) continue;
    const G = map.groups[g];
    const d = Math.hypot(G.x - L.x, G.z - L.z);
    if (d > 170) continue;
    consider((live / (d + 20)) * P.greed, { kind: 'perch', g, x: G.x, z: G.z, y: G.y });
  }
  for (let w = 0; w < sky.wheels.length; w++) {
    if (sky.wheels[w].n < 3) continue;
    wheelPos(map, w, sky.clock, tmpW);
    const d = Math.hypot(tmpW.x - L.x, tmpW.z - L.z);
    if (d > 200) continue;
    consider((sky.wheels[w].n / (d + 20)) * P.greed * 1.3, { kind: 'wheel', w, x: tmpW.x, z: tmpW.z });
  }
  for (const c of sky.loose) {
    if (c.n < 2 || sky.clock - c.t0 > 3) continue;
    const p = sky.looseAt(c, {});
    const d = Math.hypot(p.x - L.x, p.z - L.z);
    if (d > 120) continue;
    consider((c.n / (d + 20)) * P.greed * 1.5, { kind: 'loose', id: c.id, x: p.x, z: p.z });
  }
  // other flocks: prey and threats
  let threat = null;
  let threatV = 0;
  for (const o of sky.flocks.values()) {
    if (o === f || o.away || o.n < 1) continue;
    const head = o.puffs[0];
    const d = Math.hypot(head.x - L.x, head.z - L.z);
    if (d > 160) continue;
    const them = est(o.n);
    const shielded = o.shieldUntil > sky.clock;
    if (o.n < me * 0.08 && d > 25) continue;
    if (!shielded && meEst > them * 1.4 && me >= 6) {
      consider(((o.n * 0.6) / (d + 30)) * P.aggression * S.fight * lazy, { kind: 'flock', id: o.id, part: 0 });
    } else if (!shielded && S.tail > 0 && me >= 6 && rng.next() < S.tail && behind(o, L) && d > 20) {
      // cut a bigger flock's thin tail, but only from behind, where its head can't turn on us in time
      const tail = them * TAIL_SHARE;
      const mine = meEst * 0.7;
      if (mine > tail * 1.3) {
        const gain = Math.min(tail, 0.6 * (mine - tail) * 1.2);
        const focus = o === biggest ? 1.6 : 1;
        consider((gain / (d + 30)) * P.aggression * 1.2 * focus, { kind: 'flock', id: o.id, part: 6 });
      }
    }
    if (them > meEst * 1.2 && d < S.aware && o.n > 10) {
      const closing = (Math.cos(o.leader.yaw) * (L.x - head.x) + Math.sin(o.leader.yaw) * (L.z - head.z)) / (d || 1);
      if (closing > S.closing || d < 25) {
        const near = (S.aware + 5 - d) / S.aware;
        const v = P.fear * Math.min(4, o.n / (me + 5)) * near * near * 0.8;
        if (v > threatV) {
          threatV = v;
          threat = o;
        }
      }
    }
  }
  if (threat && threatV > bestV) {
    best = { kind: 'flee', id: threat.id };
    bestV = threatV;
  }
  // thermals when tired, or for the drifters
  if ((L.stamina < 1.5 || b.personality === 'drifter') && rng.next() < S.thermals) {
    for (let t = 0; t < map.thermals.length; t++) {
      const th = map.thermals[t];
      const d = Math.hypot(th.x - L.x, th.z - L.z);
      if (d > 150) continue;
      consider((P.thermal * 1.6) / (d + 25), { kind: 'thermal', t });
    }
  }
  if (Math.hypot(L.x - map.center.x, L.z - map.center.z) > 240) best = { kind: 'home' };
  if (!best) best = { kind: 'roam', x: map.center.x + rng.range(-150, 150), z: map.center.z + rng.range(-150, 150) };
  if (best.kind === 'perch') {
    // aim at the birds actually sitting there, not the middle of the wire
    const G = map.groups[best.g];
    let sx = 0;
    let sz = 0;
    let k = 0;
    for (let q = G.start; q < G.start + G.count; q++) {
      if (!sky.perched[q]) continue;
      sx += map.perches.x[q];
      sz += map.perches.z[q];
      k++;
    }
    if (k) {
      best.x = sx / k;
      best.z = sz / k;
    }
  }
  // boost decisions
  b.boostUntil = 0;
  // a panicky flock boosts the moment it sees a threat; a sharp one saves it for when the threat is close
  b.fleeBoost = best.kind === 'flee' && rng.next() < S.boost;
  if (b.fleeBoost && b.skill === 'easy') b.boostUntil = sky.clock + 2.2;
  b.goal = best;
  b.noiseTarget = S.noise * rng.wobble();
  b.next = sky.clock + S.reaction * (0.8 + 0.4 * rng.next());
}

/** Where the current goal is now: { x, y, z } or null when it's gone. */
function goalPoint(sky, f, goal, out) {
  const map = sky.map;
  switch (goal.kind) {
    case 'perch': {
      if (sky.groupLive[goal.g] < 1) return null;
      out.x = goal.x;
      out.y = goal.y + 5;
      out.z = goal.z;
      if (Math.hypot(out.x - f.leader.x, out.z - f.leader.z) < 4) return null;
      return out;
    }
    case 'wheel': {
      if (sky.wheels[goal.w].n < 1) return null;
      wheelPos(map, goal.w, sky.clock + 0.6, out);
      return out;
    }
    case 'loose': {
      const c = sky.loose.find((l) => l.id === goal.id);
      if (!c || c.n < 1) return null;
      return sky.looseAt(c, out);
    }
    case 'flock':
    case 'flee': {
      const o = sky.flocks.get(goal.id);
      if (!o || o.n < 1) return null;
      const p = o.puffs[goal.kind === 'flee' ? 0 : goal.part];
      if (goal.kind === 'flee') {
        // straight away; when it's coming right at us, out of its path to the side as well
        const L = f.leader;
        const dx = L.x - p.x;
        const dz = L.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const hx = Math.cos(o.leader.yaw);
        const hz = Math.sin(o.leader.yaw);
        const ax = dx / len;
        const az = dz / len;
        const at = (hx * dx + hz * dz) / len;
        const side = hx * dz - hz * dx > 0 ? 1 : -1;
        let sx = -hz * side * (at > 0.8 ? 0.75 : 0);
        let sz = hx * side * (at > 0.8 ? 0.75 : 0);
        // near the edge, curve round toward the middle rather than fly into the wall and turn back into the threat
        const cx = map.center.x - L.x;
        const cz = map.center.z - L.z;
        const dc = Math.hypot(cx, cz) || 1;
        const edge = clamp((dc - 140) / 100, 0, 1);
        if (edge > 0) {
          const turnSide = -az * cx + ax * cz > 0 ? 1 : -1;
          sx += -az * turnSide * edge * 1.4;
          sz += ax * turnSide * edge * 1.4;
        }
        out.x = L.x + (ax + sx) * 40;
        out.z = L.z + (az + sz) * 40;
        out.y = L.y;
        return out;
      }
      // lead the target a little
      const lead = 0.4;
      out.x = p.x + Math.cos(o.leader.yaw) * o.leader.speed * lead;
      out.z = p.z + Math.sin(o.leader.yaw) * o.leader.speed * lead;
      out.y = p.y;
      return out;
    }
    case 'thermal': {
      const th = map.thermals[goal.t];
      out.x = th.x;
      out.z = th.z;
      out.y = f.leader.y;
      return out;
    }
    case 'home':
      out.x = map.center.x;
      out.z = map.center.z;
      out.y = f.leader.y;
      return out;
    default:
      out.x = goal.x;
      out.z = goal.z;
      out.y = f.leader.y;
      return out;
  }
}

const gp = {};

/** The rival's stick and button for this step. */
export function rivalInput(sky, f, rng) {
  const b = f.brain;
  const S = RIVAL_SKILL[b.skill];
  const L = f.leader;
  if (sky.clock >= b.next || !b.goal) think(sky, f, rng);
  let point = goalPoint(sky, f, b.goal, gp);
  if (!point) {
    think(sky, f, rng);
    point = goalPoint(sky, f, b.goal, gp) ?? { x: sky.map.center.x, y: L.y, z: sky.map.center.z };
  }
  b.noise += (b.noiseTarget - b.noise) * 0.1;
  const want = Math.atan2(point.z - L.z, point.x - L.x);
  let diff = angleDiff(L.yaw, want) + b.noise;
  const d = Math.hypot(point.x - L.x, point.z - L.z);
  let boost = sky.clock < b.boostUntil && L.stamina > 0.3;
  if (b.goal.kind === 'flee' && b.fleeBoost && b.skill !== 'easy') {
    const o = sky.flocks.get(b.goal.id);
    if (o && Math.hypot(o.puffs[0].x - L.x, o.puffs[0].z - L.z) < 26 && L.stamina > 0.3) boost = true;
  }
  // close in on prey
  if (b.goal.kind === 'flock' && d < 34 && d > 5 && L.stamina > 1.2 && S.boost > 0.5) boost = true;
  if (b.goal.kind === 'wheel' && d > 45 && L.stamina > 2.9 && S.boost > 0.7) boost = true;
  // the hawk: decide once per dive whether we'll see it coming
  const h = sky.hawk;
  if (h.target === f.id && (h.phase === 'circle' || h.phase === 'stoop')) {
    if (b.dodgeHawk !== h.circleStart) {
      b.dodgeHawk = h.circleStart;
      b.dodging = rng.next() < S.dodge;
      b.dodgeDir = rng.next() < 0.5 ? -1 : 1;
    }
    if (b.dodging && h.phase === 'stoop') {
      b.dodgeUntil = sky.clock + 1.2;
      if (Math.abs(L.turnVel) > 0.3) b.dodgeDir = -Math.sign(L.turnVel);
    }
  }
  let climb = 0;
  if (sky.clock < b.dodgeUntil) {
    diff = b.dodgeDir * 2;
    boost = L.stamina > 0.2;
    climb = -0.6;
  } else if (b.goal.kind === 'flock') {
    const dy = point.y - L.y;
    if (Math.abs(dy) > 3) climb = clamp(dy / 8, -1, 1);
  }
  return { turn: clamp(diff / 0.5, -1, 1), climb, boost };
}
