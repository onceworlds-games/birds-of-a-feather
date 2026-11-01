// What travels between pages, and the checks every page runs on it. Presence and messages come from other people's browsers
// and state from the host's, so nothing here trusts its input: a bad value gives null (the last good one stays in use).

import { SLOTS, PERSONALITIES, SKILLS, SKY, RARE } from './config.js';
import { SPECIES } from './species.js';
import { MAP_IDS } from './maps.js';

export const STATUSES = ['title', 'fly', 'mig'];
const WORLD = 420; // |x| and |z| of anything in the world
const HAWK_PHASES = ['wait', 'circle', 'stoop', 'leave'];

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;

/** Flock ids: 'p' + the player's id, or 'r' + a number for a rival flock. */
export const FLOCK_ID = /^(p[A-Za-z0-9_.:-]{1,64}|r\d{1,2})$/;
export const isFlockId = (v) => typeof v === 'string' && FLOCK_ID.test(v);

export const flockIdOf = (playerId) => `p${playerId}`;
export const playerIdOf = (flockId) => (flockId[0] === 'p' ? flockId.slice(1) : null);

/** A name to draw (text only): trimmed, one line, 24 characters at most. */
export function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
}

// ------------------------------------------------------------------ presence

/** A page's own presence: its lead bird, what it's doing, which sunset it's in; the host adds the leaders it flies (`rv`). */
export function writePresence(L, st, rid, extra = {}) {
  const out = {
    x: r2(L.x),
    y: r2(L.y),
    z: r2(L.z),
    hx: r2(Math.cos(L.yaw)),
    hz: r2(Math.sin(L.yaw)),
    b: L.boosting ? 1 : 0,
    st,
    rid,
  };
  if (extra.nw) out.nw = 1;
  if (extra.rv) out.rv = extra.rv;
  if (extra.look) out.lk = [extra.look.species, extra.look.trail, extra.look.flair];
  return out;
}

/** The most trails and flairs a look may name (the Aviary's lists: anything past them is refused). */
export const LOOK_MAX = { trail: 7, flair: 6 };

/** A look from presence: { species, trail, flair } or null. Cosmetic only: ranges are checked, unlocks can't be. */
export function readLook(lk) {
  if (!Array.isArray(lk) || lk.length !== 3) return null;
  const [species, trail, flair] = lk;
  if (!int(species, 0, SPECIES.length - 1) || !int(trail, 0, LOOK_MAX.trail) || !int(flair, 0, LOOK_MAX.flair)) return null;
  return { species, trail, flair };
}

/** The host's rival leaders for presence: { r1: [x, y, z, hx, hz, b], ... }. */
export function writeLeaders(flocks) {
  const rv = {};
  for (const f of flocks) {
    const L = f.leader;
    rv[f.id] = [r2(L.x), r2(L.y), r2(L.z), r2(Math.cos(L.yaw)), r2(Math.sin(L.yaw)), L.boosting ? 1 : 0];
  }
  return rv;
}

/** Someone's presence, checked: { x, y, z, yaw, boosting, st, rid, nw, rv, look } or null. */
export function readPresence(p) {
  if (!isObj(p)) return null;
  if (!num(p.x, -WORLD, WORLD) || !num(p.y, -50, 250) || !num(p.z, -WORLD, WORLD)) return null;
  if (!num(p.hx, -1.5, 1.5) || !num(p.hz, -1.5, 1.5) || Math.hypot(p.hx, p.hz) < 0.2) return null;
  if (!STATUSES.includes(p.st)) return null;
  if (!int(p.rid, 0, 1e9)) return null;
  const out = {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: Math.atan2(p.hz, p.hx),
    boosting: p.b === 1 || p.b === true,
    st: p.st,
    rid: p.rid,
    nw: p.nw === 1,
    rv: null,
    look: readLook(p.lk),
  };
  if (p.rv !== undefined) out.rv = readLeaders(p.rv);
  return out;
}

/** The leaders in a host's presence: [{ id, x, y, z, yaw, boosting }]. Bad entries are skipped. */
export function readLeaders(rv) {
  if (!isObj(rv)) return null;
  const out = [];
  for (const id of Object.keys(rv).slice(0, SKY.maxFlocks)) {
    const a = rv[id];
    if (!isFlockId(id) || !Array.isArray(a) || a.length !== 6) continue;
    const [x, y, z, hx, hz, b] = a;
    if (!num(x, -WORLD, WORLD) || !num(y, -50, 250) || !num(z, -WORLD, WORLD)) continue;
    if (!num(hx, -1.5, 1.5) || !num(hz, -1.5, 1.5) || Math.hypot(hx, hz) < 0.2) continue;
    out.push({ id, x, y, z, yaw: Math.atan2(hz, hx), boosting: b === 1 });
  }
  return out;
}

// ------------------------------------------------------------------ the perch bitset

export function encodeBits(bytes) {
  const packed = new Uint8Array(Math.ceil(bytes.length / 8));
  for (let i = 0; i < bytes.length; i++) if (bytes[i]) packed[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < packed.length; i++) s += String.fromCharCode(packed[i]);
  return btoa(s);
}

/** Decode into `out` (a Uint8Array of 0/1 of the right length). False when the text isn't a bitset of that length. */
export function decodeBits(text, out) {
  if (typeof text !== 'string' || text.length > 4096) return false;
  let s;
  try {
    s = atob(text);
  } catch {
    return false;
  }
  if (s.length !== Math.ceil(out.length / 8)) return false;
  for (let i = 0; i < out.length; i++) out[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return true;
}

// ------------------------------------------------------------------ host state

const HAWK_CODE = { wait: 'w', circle: 'c', stoop: 's', leave: 'l' };
const HAWK_NAME = { w: 'wait', c: 'circle', s: 'stoop', l: 'leave' };

/** `host:sky`: the sunset, every flock and the hawk. */
export function writeSky(sky, dawnAt) {
  const flocks = [];
  for (const id of sky.order) {
    const f = sky.flocks.get(id);
    flocks.push([
      f.id,
      f.slot,
      f.n,
      r2(f.shieldUntil),
      f.spawn.token,
      f.kind === 'rival' ? 'r' : 'p',
      f.name,
      f.personality ?? '',
      r2(f.spawn.x),
      r2(f.spawn.y),
      r2(f.spawn.z),
      r2(f.spawn.yaw),
      f.away ? 1 : 0,
    ]);
  }
  const H = sky.hawk;
  const aim = H.aim ? [r2(H.aim.x), r2(H.aim.y), r2(H.aim.z)] : null;
  return {
    v: 1,
    rid: sky.rid,
    seed: sky.baseSeed,
    map: sky.opts.mapId,
    dawnAt: Math.round(dawnAt),
    parked: sky.parked ? 1 : 0,
    phase: sky.phase === 'night' ? 'n' : 'd',
    skill: sky.skill,
    flocks,
    hawk: [HAWK_CODE[H.phase], H.target, r2(H.t0), r2(H.circleStart), r2(H.nextAt), aim],
  };
}

export function readSky(v) {
  if (!isObj(v) || v.v !== 1) return null;
  if (!int(v.rid, 0, 1e9) || !int(v.seed, 0, 2 ** 32) || !MAP_IDS.includes(v.map)) return null;
  if (!num(v.dawnAt, 0, 1e15) || (v.parked !== 0 && v.parked !== 1) || (v.phase !== 'd' && v.phase !== 'n')) return null;
  if (!SKILLS.includes(v.skill) || !Array.isArray(v.flocks) || v.flocks.length > SKY.maxFlocks) return null;
  const flocks = [];
  const ids = new Set();
  for (const e of v.flocks) {
    if (!Array.isArray(e) || e.length !== 13) return null;
    const [id, slot, n, shield, token, kind, name, pers, sx, sy, sz, syaw, away] = e;
    if (!isFlockId(id) || ids.has(id)) return null;
    if (!int(slot, 0, SLOTS.length - 1) || !int(n, 0, 100000) || !num(shield, -1e6, 1e6) || !int(token, 0, 1e9)) return null;
    if (kind !== 'r' && kind !== 'p') return null;
    if ((kind === 'r') !== (id[0] === 'r')) return null;
    if (kind === 'r' && !PERSONALITIES[pers]) return null;
    if (!num(sx, -WORLD, WORLD) || !num(sy, -50, 250) || !num(sz, -WORLD, WORLD) || !num(syaw, -7, 7)) return null;
    ids.add(id);
    flocks.push({
      id,
      slot,
      n,
      shieldUntil: shield,
      token,
      kind: kind === 'r' ? 'rival' : 'player',
      name: cleanName(name) || (kind === 'r' ? 'Rival' : 'Player'),
      personality: kind === 'r' ? pers : null,
      spawn: { x: sx, y: sy, z: sz, yaw: syaw },
      away: away === 1,
    });
  }
  const h = v.hawk;
  if (!Array.isArray(h) || h.length !== 6 || !HAWK_NAME[h[0]]) return null;
  const [code, target, t0, circleStart, nextAt, aim] = h;
  if (target !== null && !isFlockId(target)) return null;
  if (!num(t0, -1e6, 1e6) || !num(circleStart, -1e6, 1e6) || !num(nextAt, -1e6, 1e6)) return null;
  let hawkAim = null;
  if (aim !== null) {
    if (!Array.isArray(aim) || aim.length !== 3 || !aim.every((a) => num(a, -1000, 1000))) return null;
    hawkAim = { x: aim[0], y: aim[1], z: aim[2] };
  }
  return {
    rid: v.rid,
    seed: v.seed,
    map: v.map,
    dawnAt: v.dawnAt,
    parked: v.parked === 1,
    phase: v.phase === 'n' ? 'night' : 'day',
    skill: v.skill,
    flocks,
    hawk: { phase: HAWK_NAME[code], target, t0, circleStart, nextAt, aim: hawkAim },
  };
}

/** `host:wild`: perched birds as a bitset, the grey wheels' counts and the loose clouds. */
export function writeWild(sky) {
  return {
    rid: sky.rid,
    p: encodeBits(sky.perched),
    w: sky.wheels.map((w) => w.n),
    l: sky.loose.slice(0, 40).map((c) => [c.id, r2(c.x), r2(c.y), r2(c.z), r2(c.vx), r2(c.vz), r2(c.t0), c.n, c.owners ?? []]),
    r: (sky.rares ?? []).map((r) => [r.species, r2(r.x), r2(r.y), r2(r.z), r.n, r.by]),
  };
}

/** The rare birds in `host:wild` (optional): [{ species, x, y, z, n, by }] or null when malformed. */
export function readRares(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > 8) return null;
  const out = [];
  for (const e of list) {
    if (!Array.isArray(e) || e.length !== 6) return null;
    const [species, x, y, z, n, by] = e;
    if (!int(species, 0, SPECIES.length - 1) || !num(x, -WORLD, WORLD) || !num(y, -50, 250) || !num(z, -WORLD, WORLD)) return null;
    if (!int(n, 0, Math.max(...RARE.birds)) || (by !== null && !isFlockId(by))) return null;
    out.push({ species, x, y, z, n, by });
  }
  return out;
}

/** Checks `host:wild` against this map (perch and wheel counts). Returns { rid, perched (Uint8Array), wheels, loose } or null. */
export function readWild(v, map) {
  if (!isObj(v) || !int(v.rid, 0, 1e9)) return null;
  const perched = new Uint8Array(map.perches.count);
  if (!decodeBits(v.p, perched)) return null;
  if (!Array.isArray(v.w) || v.w.length !== map.wheels.length || !v.w.every((n) => int(n, 0, 100000))) return null;
  if (!Array.isArray(v.l) || v.l.length > 40) return null;
  const loose = [];
  for (const c of v.l) {
    if (!Array.isArray(c) || c.length !== 9) return null;
    const [id, x, y, z, vx, vz, t0, n, owners] = c;
    if (!int(id, 0, 1e9) || !num(x, -WORLD, WORLD) || !num(y, -50, 250) || !num(z, -WORLD, WORLD)) return null;
    if (!num(vx, -50, 50) || !num(vz, -50, 50) || !num(t0, -1e6, 1e6) || !int(n, 0, 100000)) return null;
    if (!Array.isArray(owners) || owners.length > SKY.maxFlocks || !owners.every(isFlockId)) return null;
    loose.push({ id, x, y, z, vx, vz, t0, n, owners: owners.length ? owners : null });
  }
  const rares = readRares(v.r);
  if (!rares) return null;
  return { rid: v.rid, perched, wheels: v.w, loose, rares };
}

/** `host:results`: the standings at sundown. */
export function writeResults(sky) {
  return { rid: sky.rid, s: (sky.standings ?? []).map((s) => [s.id, s.n, s.name, s.slot, s.kind === 'rival' ? 'r' : 'p']) };
}

export function readResults(v) {
  if (!isObj(v) || !int(v.rid, 0, 1e9) || !Array.isArray(v.s) || v.s.length > SKY.maxFlocks) return null;
  const out = [];
  for (const e of v.s) {
    if (!Array.isArray(e) || e.length !== 5) return null;
    const [id, n, name, slot, kind] = e;
    if (!isFlockId(id) || !int(n, 0, 100000) || !int(slot, 0, SLOTS.length - 1) || (kind !== 'r' && kind !== 'p')) return null;
    out.push({ id, n, name: cleanName(name) || 'Flock', slot, kind: kind === 'r' ? 'rival' : 'player' });
  }
  return { rid: v.rid, standings: out };
}

// ------------------------------------------------------------------ events (host → everyone, for show only)

/** Sky events → compact entries for a message. Returns null for events nobody needs to animate. */
export function packEvent(e) {
  switch (e.type) {
    case 'join':
      return ['j', e.id, e.k, r2(e.x ?? 0), r2(e.z ?? 0), e.cloud !== undefined ? 2 : e.wheel !== undefined ? 1 : 0];
    case 'rare':
      return ['r', e.id, e.species, e.k, r2(e.x), r2(e.y), r2(e.z)];
    case 'steal':
      return ['s', e.from, e.to, e.k, r2(e.x), r2(e.y), r2(e.z), e.lw, e.ll, e.pass, e.bigger ? 1 : 0, e.left ?? -1];
    case 'shed':
      return ['h', e.id, e.k, r2(e.x), r2(e.y), r2(e.z), e.storm ? 1 : 0];
    case 'strike':
      return ['k', r2(e.x), r2(e.y), r2(e.z), e.target, e.dodged ? 1 : 0, Object.entries(e.losses).slice(0, SKY.maxFlocks)];
    case 'scatter':
      return ['c', e.id, e.k, r2(e.x), r2(e.y), r2(e.z)];
    default:
      return null;
  }
}

const P = (x, y, z) => num(x, -WORLD, WORLD) && num(y, -50, 250) && num(z, -WORLD, WORLD);

/** One packed entry → an event like the sky's, or null. */
export function unpackEvent(a) {
  if (!Array.isArray(a) || a.length > 12) return null;
  switch (a[0]) {
    case 'j': {
      const [, id, k, x, z, src] = a;
      if (!isFlockId(id) || !int(k, 1, 10000) || !num(x, -WORLD, WORLD) || !num(z, -WORLD, WORLD)) return null;
      const e = { type: 'join', id, k, x, z };
      if (src === 1) e.wheel = -1;
      else if (src === 2) e.cloud = -1;
      return e;
    }
    case 'r': {
      const [, id, species, k, x, y, z] = a;
      if (!isFlockId(id) || !int(species, 0, SPECIES.length - 1) || !int(k, 0, 10000) || !P(x, y, z)) return null;
      return { type: 'rare', id, species, k, x, y, z };
    }
    case 's': {
      const [, from, to, k, x, y, z, lw, ll, pass, bigger, left] = a;
      if (!isFlockId(from) || !isFlockId(to) || !int(k, 1, 10000) || !P(x, y, z)) return null;
      if (!int(lw, 0, 100000) || !int(ll, 0, 100000) || !int(pass, 0, 100000)) return null;
      const e = { type: 'steal', from, to, k, x, y, z, lw, ll, pass, bigger: bigger === 1 };
      if (int(left, 0, 100000)) e.left = left; // what the victim has left (a Scatter at 0)
      return e;
    }
    case 'h': {
      const [, id, k, x, y, z, storm] = a;
      if (!isFlockId(id) || !int(k, 1, 10000) || !P(x, y, z)) return null;
      return { type: 'shed', id, k, x, y, z, storm: storm === 1 };
    }
    case 'k': {
      const [, x, y, z, target, dodged, losses] = a;
      if (!P(x, y, z) || (target !== null && !isFlockId(target)) || !Array.isArray(losses) || losses.length > SKY.maxFlocks) return null;
      const out = {};
      for (const e of losses) {
        if (!Array.isArray(e) || e.length !== 2 || !isFlockId(e[0]) || !int(e[1], 0, 100000)) return null;
        out[e[0]] = e[1];
      }
      return { type: 'strike', x, y, z, target, dodged: dodged === 1, losses: out };
    }
    case 'c': {
      const [, id, k, x, y, z] = a;
      if (!isFlockId(id) || !int(k, 0, 100000) || !P(x, y, z)) return null;
      return { type: 'scatter', id, k, x, y, z };
    }
    default:
      return null;
  }
}

/** A batch message: { t: 'ev', rid, e: [...] } → events (bad entries dropped), or null. */
export function readEvents(msg) {
  if (!isObj(msg) || msg.t !== 'ev' || !int(msg.rid, 0, 1e9) || !Array.isArray(msg.e) || msg.e.length > 80) return null;
  const out = [];
  for (const a of msg.e) {
    const e = unpackEvent(a);
    if (e) out.push(e);
  }
  return { rid: msg.rid, events: out };
}
