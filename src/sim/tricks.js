// Tricks: what a player did this sunset, read from the sky's events about their own flock (the same on the host's page and
// on a mirror's). Each trick has a name and is worth song; gathers in quick succession sing a Chorus, and a Chorus of five
// brings a Tailwind. Pure: the page shows the callouts, plays the notes and gives the Tailwind.

import { SPECIES, CATCH_SONG } from './species.js';

export const TRICK = {
  burstGap: 0.6, // s: joins this close together are one gather
  chorusGap: 2.6, // s: a gather this soon after the last one carries the chorus on
  tailwindAt: 5, // the chorus step that brings a Tailwind
  tailwind: 4, // s of free boost
  tailCut: 12, // birds in one pass from a bigger flock
  scavenge: 5, // birds scooped from a cloud at once
};

export const SONG = {
  gather: 1, // a bird
  steal: 2, // a bird
  chorus: 8, // per step past the first
  tailCut: 50,
  scatter: 80,
  dodge: 60,
  closeCall: 20,
  scavenge: 20,
  thermal: 10,
  slingshot: 30,
};

export const TRICK_NAMES = {
  chorus: 'Chorus',
  tailwind: 'Tailwind',
  tailCut: 'Tail cut',
  scatter: 'Scatter',
  dodge: 'Dodged',
  closeCall: 'Close call',
  scavenge: 'Scavenge',
  rare: 'Rare bird',
  thermal: 'Thermal',
  slingshot: 'Slingshot',
};

export class Tricks {
  constructor(myId = null) {
    this.myId = myId;
    this.reset();
  }

  reset() {
    this.song = 0;
    this.chain = 0;
    this.lastBurst = -99; // when the current gather began
    this.lastJoin = -99;
    this.bestChain = 0;
    this.tailwindUntil = -1;
    this.passes = new Map(); // victim id → { pass, cut }
    this.scattered = new Set();
    this.counts = { chorus: 0, tailwind: 0, tailCut: 0, scatter: 0, dodge: 0, closeCall: 0, scavenge: 0, rare: 0, thermal: 0, slingshot: 0 };
    this.gathered = 0;
    this.stolen = 0;
    this.rares = []; // species caught
  }

  /** Give song for something and make its callout. */
  call(out, kind, song, extra = {}) {
    this.song += song;
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    const c = { kind, name: TRICK_NAMES[kind], song, ...extra };
    out.push(c);
    return c;
  }

  /**
   * Read a batch of events at sky time `t`. A steal says what its victim has left; for one that doesn't, `nOf(id)` gives a
   * flock's count after the batch (a Scatter is taking the last bird). Returns the callouts:
   * [{ kind, name, song, step?, k?, species?, x?, y?, z? }].
   */
  push(events, t, nOf = () => 1) {
    const out = [];
    const me = this.myId;
    if (!me) return out;
    // a chorus fades if no gather comes in time
    if (this.chain > 0 && t - this.lastJoin > TRICK.chorusGap) this.chain = 0;
    for (const e of events) {
      switch (e.type) {
        case 'join': {
          if (e.id !== me) break;
          this.gathered += e.k;
          this.song += e.k * SONG.gather;
          if (e.cloud !== undefined) {
            if (e.k >= TRICK.scavenge) this.call(out, 'scavenge', SONG.scavenge + e.k, { k: e.k, x: e.x, y: e.y, z: e.z });
            this.lastJoin = t;
            break;
          }
          // a new gather (not more of the one going on) sings the next note of the chorus
          if (t - this.lastJoin > TRICK.burstGap) {
            this.chain = t - this.lastJoin <= TRICK.chorusGap ? this.chain + 1 : 1;
            this.lastBurst = t;
            this.bestChain = Math.max(this.bestChain, this.chain);
            if (this.chain >= 2) {
              this.song += SONG.chorus * (this.chain - 1);
              out.push({ kind: 'chorus', name: TRICK_NAMES.chorus, song: SONG.chorus * (this.chain - 1), step: this.chain, x: e.x, y: e.y, z: e.z });
              if (this.chain === 2) this.counts.chorus++;
            } else out.push({ kind: 'note', step: 1, song: 0, x: e.x, y: e.y, z: e.z });
            if (this.chain === TRICK.tailwindAt) {
              this.tailwindUntil = t + TRICK.tailwind;
              this.call(out, 'tailwind', 0);
            }
          }
          this.lastJoin = t;
          break;
        }
        case 'steal': {
          if (e.to === me) {
            this.stolen += e.k;
            this.song += e.k * SONG.steal;
            let p = this.passes.get(e.from);
            if (!p || e.pass < p.pass) p = { pass: 0, cut: false };
            p.pass = e.pass;
            if (!p.cut && e.bigger && e.pass >= TRICK.tailCut) {
              p.cut = true;
              this.call(out, 'tailCut', SONG.tailCut, { k: e.pass, x: e.x, y: e.y, z: e.z });
            }
            this.passes.set(e.from, p);
            if ((e.left ?? nOf(e.from)) === 0 && !this.scattered.has(e.from)) {
              this.scattered.add(e.from);
              this.call(out, 'scatter', SONG.scatter, { x: e.x, y: e.y, z: e.z });
            }
          } else if (e.from === me) this.passes.delete(e.to);
          break;
        }
        case 'strike': {
          if (e.target !== me) break;
          const lost = e.losses?.[me] ?? 0;
          if (e.dodged) this.call(out, 'dodge', SONG.dodge, { x: e.x, y: e.y, z: e.z });
          else if (lost > 0 && lost <= 3) this.call(out, 'closeCall', SONG.closeCall, { x: e.x, y: e.y, z: e.z });
          break;
        }
        case 'rare': {
          if (e.id !== me) break;
          const sp = SPECIES[e.species];
          if (!sp) break;
          this.rares.push(e.species);
          this.gathered += e.k;
          this.song += e.k * SONG.gather;
          this.call(out, 'rare', CATCH_SONG[sp.rarity], { species: e.species, k: e.k, x: e.x, y: e.y, z: e.z });
          break;
        }
        case 'spawn':
          if (e.id === me) this.scattered.clear();
          break;
        default:
          break;
      }
    }
    return out;
  }

  /** The page saw its bird ride a thermal (or boost out of one within a moment: a Slingshot). */
  thermal() {
    const out = [];
    this.call(out, 'thermal', SONG.thermal);
    return out[0];
  }

  slingshot() {
    const out = [];
    this.call(out, 'slingshot', SONG.slingshot);
    return out[0];
  }

  /** True while a Tailwind blows (sky time t). */
  tailwind(t) {
    return t < this.tailwindUntil;
  }
}
