// Every number the rules use, in one place: the game and the tests both read them from here.
// Units: u (world units), seconds, birds.

export const FLIGHT = {
  speed: 14, // cruise, u/s
  boostSpeed: 24,
  accelUp: 40, // u/s² toward a faster target speed (14 → 24 in 0.25 s)
  accelDown: 12,
  turnRate: (130 * Math.PI) / 180, // rad/s at full stick
  turnRateBoost: (95 * Math.PI) / 180,
  turnEase: 0.12, // s to reach the asked turn rate
  heavyFrom: 100, // a flock bigger than this turns wider...
  heavyAt: 500, // ...down to (1 − heavy) of the turn rate at this size
  heavy: 0.3,
  heavySpeed: 0.12, // ...and flies this much slower
  bankMax: (55 * Math.PI) / 180, // drawn only
  floor: 2.5, // above the surface
  cruise: 7,
  ceiling: 30,
  thermalCeiling: 48,
  climbRate: 7, // u/s at full up
  diveRate: 11,
  returnRate: 3, // back to cruise with no input
  climbSlow: 0.15, // speed × (1 − 0.15) climbing flat out
  diveFast: 0.25, // speed × 1.25 diving flat out
  lookAhead: 12, // the surface is read this far ahead too
  stamina: 3, // s of boost
  refill: 4, // s from empty to full
  refillDelay: 0.4,
  boostMin: 0.3, // stamina needed to start a boost
  freeBoost: 0.6, // s of a boost before birds start to peel
  boundary: 290, // radius around the map's centre
  boundaryAssist: 255,
  maxLegalSpeed: 36, // the host's check on players' presence
  teleport: 40, // a jump longer than this in one update is a respawn
};

export const THERMAL = {
  lift: 8, // u/s
  refillMul: 2.5,
  exitBonus: 0.3, // +30% speed after leaving one
  exitFade: 2.5, // s
  rideMin: 1, // s inside to count as a ride
};

export const FLOCK = {
  start: 8,
  puffs: 8,
  lengthBase: 0.5, // T = base + perSqrt·√n seconds of the leader's path
  lengthPerSqrt: 0.08,
  puffRadiusBase: 2,
  puffRadiusPerSqrt: 0.5,
  vertical: 0.75, // vertical distances count this much
  trailHz: 20,
  trailSeconds: 6,
};

/** Birds in each of the 8 puffs, as a share of the flock: w(u) = (1 − u)² + 0.05, normalised. A dense head, a thin tail. */
export const PUFF_SHARE = (() => {
  const w = [];
  for (let k = 0; k < FLOCK.puffs; k++) {
    const u = (k + 0.5) / FLOCK.puffs;
    w.push((1 - u) * (1 - u) + 0.05);
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
})();

export const GATHER = {
  radius: 6, // horizontal, around the lead bird
  above: 4, // a bird more than this above its cruise height passes over perches
  over: 5, // perches up to this far above the bird still count
  wheelRate: 25, // birds/s while inside a grey wheel
  wheelRadiusBase: 7,
  wheelRadiusPerSqrt: 0.4,
  looseRate: 30,
  looseRadius: 6,
  looseLife: 4,
  looseSink: 1.5, // u/s a loose cloud drifts down
  ownerShy: 2.5, // s scattered or shed birds won't rejoin the flock they left
};

export const STEAL = {
  kernel: 10, // u: how far "near the contact point" reaches
  margin: 1.25, // the thicker side must be this much thicker
  rateK: 0.5, // birds/s per bird of difference
  rateMin: 3,
  rateMax: 30,
  shield: 3, // s a fresh flock can't be stolen from (or steal)
  passGap: 0.6, // s without contact ends a pass
};

export const PEEL = {
  minFlock: 12,
  rate: 0.04, // share of the flock per second
  minRate: 1,
};

export const HAWK = {
  first: 45, // s into a sunset
  every: 35,
  everyJitter: 5,
  lateWindow: 40, // the last 40 s
  lateEvery: 22,
  lateJitter: 3,
  minFlock: 40,
  retry: 5,
  greedy: 2, // a flock more than twice the size of the next...
  greedyEvery: 20, // ...brings the hawk back sooner
  greedyMin: 120,
  circle: 4,
  stoop: 1.2,
  leave: 2,
  height: 55,
  strikeRadius: 9,
  maxShare: 0.25,
  zoneShare: 0.3,
  newPlayerSafe: 90, // a new player's first sunset: not before 1:30
};

export const ROUND = {
  day: 180,
  night: 15,
  sundown: 5, // landing on the wires
  results: 12, // when the dawn sweep begins
  parkAfter: 10, // nobody flying this long parks the sky
  parkedTime: 20, // the light a parked sky shows
};

export const SKY = {
  flocks: 7, // rivals fill the sky to this many flocks
  maxFlocks: 12,
  ruleHz: 10,
  flightHz: 30,
  judgeDelay: 0.1, // the host judges every flock where it was this long ago
};

/** Light phases, as a share of the sunset (0 = 3:00 left, 1 = sundown). */
export const LIGHT = {
  gold: 0,
  ember: 60 / 180,
  rose: 120 / 180,
  dusk: 155 / 180,
};

export const SKILLS = ['easy', 'normal', 'hard'];

/** How sharp a rival is, by skill. */
export const RIVAL_SKILL = {
  // aware: how far off it notices a bigger flock; closing: how surely that flock must be coming at it before it runs;
  // fight: how keen it is to chase smaller flocks; dither: how often (a second) it wanders off for a few seconds
  easy: { reaction: 0.6, noise: (25 * Math.PI) / 180, misjudge: 0.4, dodge: 0.1, thermals: 0.2, boost: 0.4, tail: 0, aware: 40, closing: -1, fight: 0.35, dither: 0.15 },
  normal: { reaction: 0.35, noise: (12 * Math.PI) / 180, misjudge: 0.2, dodge: 0.45, thermals: 0.5, boost: 0.8, tail: 0.5, aware: 65, closing: 0, fight: 0.75, dither: 0.04 },
  hard: { reaction: 0.2, noise: (5 * Math.PI) / 180, misjudge: 0.08, dodge: 0.8, thermals: 0.9, boost: 1, tail: 1, aware: 90, closing: 0.5, fight: 1, dither: 0 },
};

/** Personalities: what a rival wants. */
export const PERSONALITIES = {
  gatherer: { greed: 1.4, aggression: 0.5, fear: 0.8, thermal: 0.8, names: ['Magpie', 'Gull', 'Jackdaw'] },
  hunter: { greed: 0.7, aggression: 1.5, fear: 0.5, thermal: 0.8, names: ['Kestrel', 'Shrike', 'Merlin'] },
  skittish: { greed: 1, aggression: 0.4, fear: 1.6, thermal: 1, names: ['Plover', 'Sparrow', 'Linnet'] },
  drifter: { greed: 1, aggression: 0.8, fear: 1, thermal: 1.5, names: ['Swift', 'Gannet', 'Tern'] },
};
export const PERSONALITY_ORDER = ['hunter', 'gatherer', 'drifter', 'skittish', 'hunter', 'gatherer', 'drifter', 'skittish', 'hunter', 'gatherer', 'drifter'];

/** The flock colours: each with a symbol, so no flock is told apart by colour alone. */
export const SLOTS = [
  { name: 'Cobalt', hex: '#2D6CFF', symbol: 'circle' },
  { name: 'Vermilion', hex: '#FF3B2F', symbol: 'triangle' },
  { name: 'Jade', hex: '#22C98A', symbol: 'square' },
  { name: 'Saffron', hex: '#FFC21A', symbol: 'diamond' },
  { name: 'Fuchsia', hex: '#E040A0', symbol: 'star' },
  { name: 'Cyan', hex: '#1FC8F0', symbol: 'cross' },
  { name: 'Lime', hex: '#9BE03A', symbol: 'hexagon' },
  { name: 'Tangerine', hex: '#FF8A1E', symbol: 'chevron' },
  { name: 'Violet', hex: '#8E5CFF', symbol: 'ring' },
  { name: 'Rose Pink', hex: '#FF7FA8', symbol: 'x' },
  { name: 'Teal', hex: '#0FA3A0', symbol: 'crescent' },
  { name: 'Ivory', hex: '#F2EAD8', symbol: 'pentagon' },
];

export const PALETTE = {
  ink: '#231A2E',
  cream: '#FFF1DC',
  gold: '#FFB547',
  ember: '#F05A3C',
  rose: '#E8758F',
  teal: '#1E5866',
  terracotta: '#C0563A',
  ash: '#8D8794',
  hawk: '#5E3424',
};

export const JOIN = { maxPlayers: 12 };
