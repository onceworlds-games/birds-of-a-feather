// A lead bird's flight: turning, the height band over the ground and roofs, boost and stamina, thermals, the soft boundary.
// The same code flies a player's bird (on their page) and every rival (on the host's page).

import { FLIGHT, THERMAL } from './config.js';
import { surfaceAt, groundAt } from './maps.js';
import { clamp, angleDiff } from './rng.js';

export function newLeader(x, z, yaw, map) {
  const s = map ? surfaceAt(map, x, z) : 0;
  return {
    x,
    y: s + FLIGHT.cruise,
    z,
    yaw,
    turnVel: 0,
    vy: 0,
    speed: FLIGHT.speed,
    stamina: FLIGHT.stamina,
    boosting: false,
    boostTime: 0, // seconds of the current boost
    sinceBoost: 10, // seconds since the last boost ended
    lift: 0, // the thermal exit bonus, 1 → 0
    thermal: -1, // the thermal we're in
    thermalTime: 0,
    rides: 0, // thermals ridden (inside at least THERMAL.rideMin)
    bank: 0,
  };
}

/** The height band at a point: floor, cruise and ceiling, reading the surface under the bird and ahead. */
export function band(map, x, z, hx, hz, inThermal) {
  const s0 = surfaceAt(map, x, z);
  const s1 = surfaceAt(map, x + hx * FLIGHT.lookAhead, z + hz * FLIGHT.lookAhead);
  const s2 = surfaceAt(map, x + hx * FLIGHT.lookAhead * 0.5, z + hz * FLIGHT.lookAhead * 0.5);
  const s = Math.max(s0, s1, s2);
  const water = map.hasSea ? map.water : -Infinity;
  const base = Math.max(s, water);
  return {
    floor: base + FLIGHT.floor,
    cruise: base + FLIGHT.cruise,
    ceiling: base + (inThermal ? FLIGHT.thermalCeiling : FLIGHT.ceiling),
    ground: Math.max(groundAt(map, x, z), water),
  };
}

/**
 * One step. input: { turn: -1..1 (right is +), climb: -1..1 (up is +), boost: bool }. Returns events: 'thermal-in', 'ride',
 * 'boost' (a boost began).
 */
export function stepLeader(L, input, dt, map, events = null, birds = 0) {
  const turnIn = clamp(Number(input.turn) || 0, -1, 1);
  const climbIn = clamp(Number(input.climb) || 0, -1, 1);
  // boost and stamina
  const wantBoost = !!input.boost;
  if (wantBoost && (L.boosting ? L.stamina > 0 : L.stamina >= FLIGHT.boostMin)) {
    if (!L.boosting && events) events.push('boost');
    L.boosting = true;
  } else {
    L.boosting = false;
  }
  if (L.boosting) {
    L.stamina = Math.max(0, L.stamina - dt);
    L.boostTime += dt;
    L.sinceBoost = 0;
    if (L.stamina <= 0) L.boosting = false;
  } else {
    L.boostTime = 0;
    L.sinceBoost += dt;
    if (L.sinceBoost >= FLIGHT.refillDelay) {
      const mul = L.thermal >= 0 ? THERMAL.refillMul : 1;
      L.stamina = Math.min(FLIGHT.stamina, L.stamina + (FLIGHT.stamina / FLIGHT.refill) * mul * dt);
    }
  }

  // turning, eased; the boundary turns the bird home
  const weight = clamp((birds - FLIGHT.heavyFrom) / (FLIGHT.heavyAt - FLIGHT.heavyFrom), 0, 1);
  const maxTurn = (L.boosting ? FLIGHT.turnRateBoost : FLIGHT.turnRate) * (1 - FLIGHT.heavy * weight);
  let want = turnIn * maxTurn;
  const cx = map.center.x;
  const cz = map.center.z;
  const dist = Math.hypot(L.x - cx, L.z - cz);
  if (dist > FLIGHT.boundaryAssist) {
    const home = Math.atan2(cz - L.z, cx - L.x);
    const diff = angleDiff(L.yaw, home);
    const k = clamp((dist - FLIGHT.boundaryAssist) / (FLIGHT.boundary - FLIGHT.boundaryAssist), 0, 1);
    const outward = Math.cos(diff) < 0.3;
    if (outward) want = want * (1 - k) + Math.sign(diff || 1) * maxTurn * k;
  }
  L.turnVel += (want - L.turnVel) * clamp(dt / FLIGHT.turnEase, 0, 1);
  L.yaw += L.turnVel * dt;
  if (L.yaw > Math.PI) L.yaw -= Math.PI * 2;
  if (L.yaw < -Math.PI) L.yaw += Math.PI * 2;
  L.bank += ((-L.turnVel / FLIGHT.turnRate) * FLIGHT.bankMax - L.bank) * clamp(dt * 6, 0, 1);
  const hx = Math.cos(L.yaw);
  const hz = Math.sin(L.yaw);

  // thermals
  let inside = -1;
  const g = groundAt(map, L.x, L.z);
  for (let t = 0; t < map.thermals.length; t++) {
    const th = map.thermals[t];
    const dx = L.x - th.x;
    const dz = L.z - th.z;
    if (dx * dx + dz * dz < th.r * th.r && L.y < Math.max(g, 0) + th.top) {
      inside = t;
      break;
    }
  }
  if (inside !== L.thermal) {
    if (L.thermal >= 0) {
      if (L.thermalTime >= THERMAL.rideMin) {
        L.rides++;
        if (events) events.push('ride');
      }
      L.lift = 1;
    }
    if (inside >= 0 && events) events.push('thermal-in');
    L.thermal = inside;
    L.thermalTime = 0;
  }
  if (L.thermal >= 0) L.thermalTime += dt;
  else L.lift = Math.max(0, L.lift - dt / THERMAL.exitFade);

  // height
  const b = band(map, L.x, L.z, hx, hz, L.thermal >= 0);
  let vy;
  if (climbIn > 0.05) vy = climbIn * FLIGHT.climbRate;
  else if (climbIn < -0.05) vy = climbIn * FLIGHT.diveRate;
  else vy = clamp((b.cruise - L.y) * 1.2, -FLIGHT.returnRate, FLIGHT.returnRate);
  if (L.thermal >= 0) vy = Math.max(vy, 0) + THERMAL.lift;
  L.vy += (vy - L.vy) * clamp(dt * 5, 0, 1);
  L.y += L.vy * dt;
  if (L.y < b.floor) {
    L.y += (b.floor - L.y) * clamp(dt * 10, 0, 1);
    if (L.y < b.floor - 1.5) L.y = b.floor - 1.5;
    if (L.vy < 0) L.vy *= 0.5;
  }
  if (L.y > b.ceiling) {
    L.y += (b.ceiling - L.y) * clamp(dt * 3, 0, 1);
    if (L.vy > 0) L.vy *= 0.6;
  }

  // speed
  let target = (L.boosting ? FLIGHT.boostSpeed : FLIGHT.speed) * (1 - FLIGHT.heavySpeed * weight);
  if (L.vy > 0 && L.thermal < 0) target *= 1 - FLIGHT.climbSlow * clamp(L.vy / FLIGHT.climbRate, 0, 1);
  if (L.vy < 0) target *= 1 + FLIGHT.diveFast * clamp(-L.vy / FLIGHT.diveRate, 0, 1);
  target *= 1 + THERMAL.exitBonus * L.lift;
  const accel = target > L.speed ? FLIGHT.accelUp : FLIGHT.accelDown;
  L.speed += clamp(target - L.speed, -accel * dt, accel * dt);
  L.x += hx * L.speed * dt;
  L.z += hz * L.speed * dt;
  // a hard edge past the soft one
  const d2 = Math.hypot(L.x - cx, L.z - cz);
  const hard = FLIGHT.boundary + 12;
  if (d2 > hard) {
    L.x = cx + ((L.x - cx) / d2) * hard;
    L.z = cz + ((L.z - cz) / d2) * hard;
  }
  return L;
}

/** Heading as a unit vector. */
export const headingOf = (L) => [Math.cos(L.yaw), Math.sin(L.yaw)];
