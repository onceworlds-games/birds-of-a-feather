// For capturing the trailer only (`?autoplay=1` on a local address, never on the live site): a sharp hunter's mind flies the
// player's own bird, through the same rival code the rival flocks use.

import { makeBrain, rivalInput } from './sim/rivals.js';
import { makeRng } from './sim/rng.js';

const IDLE = { turn: 0, climb: 0, boost: false };

export class Autopilot {
  constructor(personality = 'hunter') {
    this.personality = personality;
    this.rng = makeRng('autoplay');
    this.brain = makeBrain(personality, 'hard');
    this.rid = -1;
  }

  /** The stick for the player's lead bird L, flying flock f of `sky`. */
  input(sky, f, L) {
    if (!f || !L) return IDLE;
    if (sky.rid !== this.rid || sky.clock + 1 < this.brain.next - 30) {
      // a new sunset: think afresh
      this.rid = sky.rid;
      this.brain = makeBrain(this.personality, 'hard');
    }
    const keepL = f.leader;
    const keepB = f.brain;
    f.leader = L;
    f.brain = this.brain;
    try {
      return rivalInput(sky, f, this.rng);
    } catch {
      return IDLE;
    } finally {
      f.leader = keepL;
      f.brain = keepB;
    }
  }
}
