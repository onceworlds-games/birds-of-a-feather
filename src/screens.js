// Every screen's DOM: signs hung from a sagging wire (gold for the main one, cream for the rest), at most two on a wire; the
// night's tally adding up into the level bar; the Aviary; Today (goals, the streak, the Daily Sunset and its board).
// Text from other players goes in with textContent only.

import { PLACES } from './sim/migration.js';
import { SLOTS } from './sim/config.js';
import { SPECIES, RARITY } from './sim/species.js';
import { TRAILS, FLAIRS, levelOf } from './sim/progress.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const FEATHER = 'M12 1C6 6 4 13 6 22l2-1c-1-6 0-12 4-17-2 6-2 11-1 16l2-1c-1-5 0-10 3-14 1 5 0 9-3 13l1 1c5-5 6-12 3-18z';
const TICK = 'M4 12.5l5 5L20 6';

function svgIcon(d, cls) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}
const featherIcon = (filled) => svgIcon(FEATHER, `feather${filled ? ' on' : ''}`);

function wire(signs, cls = '') {
  const set = el('div', `wireset ${cls}`);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'wire');
  svg.setAttribute('viewBox', '0 0 100 10');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M-2,1 Q50,9 102,1');
  svg.appendChild(path);
  set.appendChild(svg);
  const row = el('div', 'signs');
  for (const s of signs) row.appendChild(s);
  set.appendChild(row);
  return set;
}

/** A sign button: label, an optional key, gold or cream; `count` is a small number beside the label. */
export function sign(label, { key, gold = false, small = false, onClick, sound, count, disabled = false } = {}) {
  const b = el('button', `sign${gold ? ' gold' : ''}${small ? ' small' : ''}`);
  b.type = 'button';
  b.appendChild(el('span', 'label', label));
  if (count) b.appendChild(el('span', 'count', count));
  if (key) b.appendChild(el('kbd', null, key));
  if (disabled) b.disabled = true;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    sound?.();
    onClick?.();
  });
  return b;
}

/** "Level 7" and its bar. */
function levelBar(level, share) {
  const box = el('div', 'lvl');
  const n = el('span', 'lvl-n', `Level ${level}`);
  const bar = el('span', 'lvl-bar');
  const fill = el('i');
  fill.style.width = `${Math.round(share * 100)}%`;
  bar.appendChild(fill);
  box.append(n, bar);
  return { box, n, fill };
}

/** One of the day's goals: a tick when done, else how far along. */
function goalLine(g, compact = false) {
  const row = el('div', `dgoal${g.done ? ' done' : ''}${compact ? ' compact' : ''}`);
  const mark = el('span', 'dgoal-mark');
  if (g.done) mark.appendChild(svgIcon(TICK, 'tick'));
  row.appendChild(mark);
  row.appendChild(el('span', 'dgoal-text', g.text));
  if (!g.done) row.appendChild(el('span', 'dgoal-n', `${Math.floor(g.value)}/${g.target}`));
  return row;
}

/** A day's board: [{ name, n, me }], the top few. */
function boardRows(board, limit = 5) {
  const box = el('div', 'board');
  board.slice(0, limit).forEach((r, i) => {
    const row = el('div', `brow${r.me ? ' me' : ''}`);
    row.append(el('span', 'brow-k', String(i + 1)), el('span', 'brow-name', r.me ? 'You' : r.name), el('span', 'brow-n', String(r.n)));
    box.appendChild(row);
  });
  return box;
}

const RARITY_CLASS = ['common', 'rare', 'legendary'];

export class Screens {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.current = null;
    this.keys = new Map();
    this.timers = [];
    this.raf = 0;
  }

  tick = () => this.audio.tick();

  clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    cancelAnimationFrame(this.raf);
    this.root.replaceChildren();
    this.current = null;
    this.keys.clear();
  }

  later(ms, fn) {
    this.timers.push(setTimeout(fn, ms));
  }

  /** Keyboard: Space/Enter for the main sign, and any other keys a screen binds. */
  key(k) {
    const fn = this.keys.get(k.length === 1 ? k.toLowerCase() : k);
    if (fn) {
      this.audio.tick();
      fn();
      return true;
    }
    return false;
  }

  show(name, node) {
    this.clear();
    this.current = name;
    const wrap = el('div', `screen ${name}`);
    wrap.appendChild(node);
    this.root.appendChild(wrap);
    return wrap;
  }

  /** The title: the name, Fly, then Today and the Aviary, and where the player stands. */
  title({ level, share, streak, goalsDone, onFly, onAviary, onToday, resume }) {
    const box = el('div', 'title-box');
    const h = el('h1', 'game-name');
    for (const word of ['Birds', 'of a', 'Feather']) h.appendChild(el('span', null, word));
    box.appendChild(h);
    const fly = sign(resume ? 'Fly on' : 'Fly', { key: 'Space', gold: true, onClick: onFly, sound: this.tick });
    box.appendChild(wire([fly], 'title-wire'));
    const more = el('div', 'title-more');
    more.appendChild(sign('Today', { small: true, count: `${goalsDone}/3`, onClick: onToday, sound: this.tick }));
    more.appendChild(sign('Aviary', { small: true, onClick: onAviary, sound: this.tick }));
    box.appendChild(more);
    if (level > 1 || share > 0 || streak > 1) {
      const stand = el('div', 'standing');
      stand.appendChild(levelBar(level, share).box);
      if (streak > 1) stand.appendChild(el('span', 'streak', `${streak} days`));
      box.appendChild(stand);
    }
    this.keys.set(' ', onFly);
    this.keys.set('Enter', onFly);
    this.keys.set('t', onToday);
    this.keys.set('b', onAviary);
    this.show('title', box);
  }

  /** "Tap for sound" after a reload that skipped the title. */
  tapForSound(onTap) {
    const b = el('button', 'tap-sound', 'Tap for sound');
    b.type = 'button';
    b.addEventListener('click', () => {
      onTap();
      b.remove();
    });
    this.root.appendChild(b);
  }

  /**
   * The sunset's song adding up line by line, then the level bar filling (a new level, and what it unlocks, with a sign to
   * use it). report: { lines, total, before, after, unlocks, played } (played: shown once already: no animation).
   */
  tallyBlock(report, { onUse } = {}) {
    const box = el('div', 'tally');
    const list = el('div', 'tally-lines');
    const rows = report.lines.map((l) => {
      const row = el('div', `tl tl-${l.key}`);
      row.append(el('span', 'tl-label', l.label), el('span', 'tl-song', `+${l.song}`));
      list.appendChild(row);
      return row;
    });
    box.appendChild(list);
    const L0 = levelOf(report.before);
    const L1 = levelOf(report.after);
    const bar = levelBar(L0.level, L0.share);
    const total = el('span', 'tally-total', '+0');
    bar.box.appendChild(total);
    box.appendChild(bar.box);
    const unl = el('div', 'unlocks');
    box.appendChild(unl);
    const showUnlocks = () => {
      for (const u of report.unlocks) {
        const row = el('div', 'unlock');
        row.appendChild(el('span', 'unlock-text', `${u.kind === 'trail' ? 'Trail' : 'Flair'}: ${u.name}`));
        if (onUse) {
          const b = sign('Use', {
            small: true,
            onClick: () => {
              onUse(u);
              b.querySelector('.label').textContent = 'On';
              b.classList.add('gold');
            },
            sound: this.tick,
          });
          row.appendChild(b);
        }
        unl.appendChild(row);
      }
    };
    if (report.played || !rows.length) {
      for (const r of rows) r.classList.add('in');
      total.textContent = `+${report.total}`;
      bar.n.textContent = `Level ${L1.level}`;
      bar.fill.style.width = `${Math.round(L1.share * 100)}%`;
      showUnlocks();
      return box;
    }
    report.played = true;
    let sum = 0;
    rows.forEach((r, i) => {
      this.later(250 + i * 280, () => {
        r.classList.add('in');
        sum += report.lines[i].song;
        total.textContent = `+${sum}`;
        this.audio.tally(i);
      });
    });
    // the bar fills from where it was, a level at a time
    this.later(250 + rows.length * 280 + 200, () => {
      let level = L0.level;
      let from = L0.share;
      const step = () => {
        const to = level < L1.level ? 1 : L1.share;
        const t0 = performance.now();
        const dur = 260 + (to - from) * 700;
        const frame = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          const e = 1 - (1 - k) * (1 - k);
          bar.fill.style.width = `${((from + (to - from) * e) * 100).toFixed(1)}%`;
          if (k < 1) {
            this.raf = requestAnimationFrame(frame);
            return;
          }
          if (level < L1.level) {
            level++;
            from = 0;
            bar.n.textContent = `Level ${level}`;
            bar.box.classList.remove('up');
            void bar.box.offsetWidth;
            bar.box.classList.add('up');
            this.audio.levelUp();
            if (level === L1.level) showUnlocks();
            this.later(380, step);
          }
        };
        this.raf = requestAnimationFrame(frame);
      };
      step();
    });
    return box;
  }

  /** The night: results, the tally, the day's goals; Migration and the Daily Sunset (alone), the Aviary, rival skill, dawn. */
  night({ lines, best, report, goals, solo, skill, onMigration, onDaily, onAviary, onSkill, onUse, dawnIn }) {
    const box = el('div', 'night-box');
    const head = el('div', 'night-lines');
    for (const [text, cls] of lines) head.appendChild(el('div', `line ${cls ?? ''}`, text));
    if (best) head.appendChild(el('div', 'line newbest', 'New best'));
    box.appendChild(head);
    const mid = el('div', 'night-mid');
    if (report) mid.appendChild(this.tallyBlock(report, { onUse }));
    if (goals) {
      const g = el('div', 'goals-mini');
      for (const x of goals) g.appendChild(goalLine(x, true));
      mid.appendChild(g);
    }
    box.appendChild(mid);
    const bottom = el('div', 'bottom');
    if (solo) {
      // no key for the Daily Sunset here: D steers, and may still be held as the flock lands
      bottom.appendChild(wire([sign('Migration', { key: 'M', onClick: onMigration, sound: this.tick }), sign('Daily Sunset', { onClick: onDaily, sound: this.tick })], 'night-wire'));
      this.keys.set('m', onMigration);
    }
    const row = el('div', 'skill-row');
    row.appendChild(sign('Aviary', { small: true, onClick: onAviary, sound: this.tick }));
    this.keys.set('b', onAviary);
    if (skill) {
      row.appendChild(el('span', 'skill-label', 'Rivals'));
      for (const [id, label] of [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]) {
        row.appendChild(sign(label, { small: true, gold: skill === id, onClick: () => onSkill(id), sound: this.tick }));
      }
    }
    bottom.appendChild(row);
    const dawn = el('div', 'dawn', '');
    bottom.appendChild(dawn);
    box.appendChild(bottom);
    this.show('night', box);
    this.dawnEl = dawn;
    this.setDawn(dawnIn);
  }

  setDawn(sec) {
    if (this.current === 'night' && this.dawnEl) this.dawnEl.textContent = sec > 0 ? `Dawn in ${Math.ceil(sec)}` : '';
  }

  route({ feathers, open, onPick, onBack }) {
    const box = el('div', 'route-box');
    box.appendChild(el('h2', 'route-title', 'Migration'));
    const path = el('div', 'route');
    PLACES.forEach((P, i) => {
      const stop = el('button', `stop${open[i] ? '' : ' locked'}`);
      stop.type = 'button';
      stop.disabled = !open[i];
      stop.appendChild(el('span', 'stop-n', String(i + 1)));
      stop.appendChild(el('span', 'stop-name', P.name));
      stop.appendChild(el('span', 'stop-goal', open[i] ? P.lines[0] : 'Locked'));
      const fs = el('span', 'feathers');
      for (let k = 0; k < 3; k++) fs.appendChild(featherIcon(k < (feathers[i] ?? 0)));
      stop.appendChild(fs);
      if (open[i]) {
        stop.addEventListener('click', () => {
          this.audio.tick();
          onPick(i);
        });
        this.keys.set(String(i + 1), () => onPick(i));
      }
      path.appendChild(stop);
    });
    box.appendChild(path);
    box.appendChild(wire([sign('Back to the sky', { key: 'Esc', onClick: onBack, sound: this.tick })], 'route-wire'));
    this.keys.set('Escape', onBack);
    this.show('route', box);
  }

  /** Before a solo sunset: what it is and what to do. */
  intro({ top, name, goal }) {
    const box = el('div', 'intro-box');
    box.appendChild(el('div', 'intro-n', top));
    box.appendChild(el('h2', 'intro-name', name));
    if (goal) box.appendChild(el('div', 'intro-goal', goal));
    this.show('intro', box);
  }

  result({ index, rank, n, earned, before, hasNext, report, onUse, onNext, onAgain, onBack }) {
    const P = PLACES[index];
    const box = el('div', 'result-box');
    box.appendChild(el('h2', 'result-name', P.name));
    box.appendChild(el('div', 'result-line', `${ordinal(rank)} with ${n}`));
    const goals = el('div', 'goals');
    P.lines.forEach((line, k) => {
      const g = el('div', `goal${k < earned ? ' done' : ''}`);
      g.appendChild(featherIcon(false));
      g.appendChild(el('span', null, line));
      goals.appendChild(g);
    });
    box.appendChild(goals);
    if (report) box.appendChild(this.tallyBlock(report, { onUse }));
    const main = hasNext && earned > 0 ? sign('Next place', { key: 'Space', gold: true, onClick: onNext, sound: this.tick }) : sign('Again', { key: 'Space', gold: true, onClick: onAgain, sound: this.tick });
    box.appendChild(wire([main, sign('Back to the sky', { key: 'Esc', onClick: onBack, sound: this.tick })], 'result-wire'));
    this.keys.set(' ', hasNext && earned > 0 ? onNext : onAgain);
    this.keys.set('Enter', hasNext && earned > 0 ? onNext : onAgain);
    this.keys.set('Escape', onBack);
    const wrap = this.show('result', box);
    // the feathers fill one by one, a chime each
    const icons = [...goals.querySelectorAll('.feather')];
    icons.forEach((f, k) => {
      if (k >= earned) return;
      this.later(500 + k * 420, () => {
        f.classList.add('on');
        if (k >= before) f.classList.add('new');
        this.audio.chime(k);
      });
    });
    return wrap;
  }

  /** After a Daily Sunset: the flock, the day's best, the board, the song. */
  dailyResult({ place, n, rank, best, newBest, board, report, onUse, onAgain, onBack }) {
    const box = el('div', 'result-box daily');
    box.appendChild(el('div', 'intro-n', 'Daily Sunset'));
    box.appendChild(el('h2', 'result-name', place));
    box.appendChild(el('div', 'result-line', `${ordinal(rank)} with ${n}`));
    box.appendChild(el('div', `line ${newBest ? 'newbest' : ''}`, newBest ? 'Best today' : `Best today ${best}`));
    if (board.length) box.appendChild(boardRows(board, 5));
    if (report) box.appendChild(this.tallyBlock(report, { onUse }));
    box.appendChild(wire([sign('Again', { key: 'Space', gold: true, onClick: onAgain, sound: this.tick }), sign('Back to the sky', { key: 'Esc', onClick: onBack, sound: this.tick })], 'result-wire'));
    this.keys.set(' ', onAgain);
    this.keys.set('Enter', onAgain);
    this.keys.set('Escape', onBack);
    return this.show('result', box);
  }

  /**
   * Today: the streak, the day's three goals, and the Daily Sunset (its place, the board, the player's best; flown alone).
   */
  today({ streak, goals, daily, onDaily, onBack }) {
    const box = el('div', 'today-box');
    box.appendChild(el('h2', 'route-title', 'Today'));
    const cols = el('div', 'today-cols');
    const left = el('div', 'today-col');
    if (streak > 0) {
      const s = el('div', 'streak-big');
      s.append(el('span', 'streak-n', String(streak)), el('span', 'streak-l', streak === 1 ? 'day' : 'days running'));
      left.appendChild(s);
    }
    const gl = el('div', 'goals-full');
    for (const g of goals) gl.appendChild(goalLine(g));
    left.appendChild(gl);
    cols.appendChild(left);
    const right = el('div', 'today-col daily-col');
    right.appendChild(el('div', 'intro-n', 'Daily Sunset'));
    right.appendChild(el('div', 'daily-name', daily.place));
    const facts = [`${daily.rivals} rivals`, daily.skill === 'hard' ? 'Hard' : 'Normal'];
    if (daily.twist === 'storm') facts.push('Storm');
    right.appendChild(el('div', 'daily-sub', facts.join(' · ')));
    if (daily.best > 0) right.appendChild(el('div', 'daily-best', `Your best ${daily.best}`));
    if (daily.flown > 0) right.appendChild(el('div', 'daily-sub', `${daily.flown} flew it today`));
    if (daily.board.length) right.appendChild(boardRows(daily.board, 5));
    cols.appendChild(right);
    box.appendChild(cols);
    const fly = sign(daily.canFly ? 'Daily Sunset' : 'Alone only', { key: daily.canFly ? 'Space' : undefined, gold: daily.canFly, disabled: !daily.canFly, onClick: onDaily, sound: this.tick });
    box.appendChild(wire([fly, sign('Back', { key: 'Esc', onClick: onBack, sound: this.tick })], 'today-wire'));
    if (daily.canFly) {
      this.keys.set(' ', onDaily);
      this.keys.set('Enter', onDaily);
    }
    this.keys.set('Escape', onBack);
    this.show('today', box);
  }

  /**
   * The Aviary: every species (caught ones in colour, the rest as shadows), then trails and flair, each with the level that
   * opens it. A tap leads with a bird or puts on a trail or flair. portraits: { species id: canvas, `${id}:dark`: canvas }.
   */
  aviary({ profile, level, tab, portraits, onTab, onEquip, onBack }) {
    const box = el('div', 'aviary-box');
    const head = el('div', 'aviary-head');
    const caught = SPECIES.filter((s) => s.id === 'starling' || profile.aviary[s.id] > 0).length;
    const name = el('div', 'aviary-name');
    name.append(el('h2', 'route-title', 'Aviary'), el('span', 'aviary-count', `${caught} of ${SPECIES.length}`));
    head.appendChild(name);
    const tabs = el('div', 'tabs');
    for (const [id, label] of [['birds', 'Birds'], ['trails', 'Trails'], ['flair', 'Flair']]) {
      tabs.appendChild(sign(label, { small: true, gold: tab === id, onClick: () => onTab(id), sound: this.tick }));
    }
    head.appendChild(tabs);
    box.appendChild(head);
    const grid = el('div', `aviary-grid ${tab}`);
    if (tab === 'birds') {
      for (const sp of SPECIES) {
        const have = sp.id === 'starling' || profile.aviary[sp.id] > 0;
        const on = profile.equip.species === sp.id;
        const tile = el('button', `tile ${RARITY_CLASS[sp.rarity]}${have ? '' : ' unknown'}${on ? ' on' : ''}`);
        tile.type = 'button';
        const pic = portraits?.[have ? sp.id : `${sp.id}:dark`];
        if (pic) {
          const c = el('canvas', 'pic');
          c.width = pic.width;
          c.height = pic.height;
          c.getContext('2d').drawImage(pic, 0, 0);
          tile.appendChild(c);
        } else tile.appendChild(el('span', 'pic blank'));
        tile.appendChild(el('span', 'tile-name', have ? sp.name : RARITY[sp.rarity][0].toUpperCase() + RARITY[sp.rarity].slice(1)));
        if (have && profile.aviary[sp.id] > 1) tile.appendChild(el('span', 'tile-count', `×${profile.aviary[sp.id]}`));
        if (have) {
          tile.addEventListener('click', () => {
            this.audio.tick();
            onEquip('species', sp.id);
          });
        } else tile.disabled = true;
        grid.appendChild(tile);
      }
    } else {
      const list = tab === 'trails' ? TRAILS : FLAIRS;
      const now = tab === 'trails' ? profile.equip.trail : profile.equip.flair;
      for (const item of list) {
        const open = item.level <= level;
        const tile = el('button', `tile item${open ? '' : ' unknown'}${now === item.id ? ' on' : ''}`);
        tile.type = 'button';
        tile.appendChild(el('span', `swatch ${tab}-${item.id}`));
        tile.appendChild(el('span', 'tile-name', item.name));
        tile.appendChild(el('span', 'tile-sub', open ? (now === item.id ? 'On' : '') : `Level ${item.level}`));
        if (open) {
          tile.addEventListener('click', () => {
            this.audio.tick();
            onEquip(tab === 'trails' ? 'trail' : 'flair', item.id);
          });
        } else tile.disabled = true;
        grid.appendChild(tile);
      }
    }
    box.appendChild(grid);
    box.appendChild(wire([sign('Back', { key: 'Esc', onClick: onBack, sound: this.tick })], 'aviary-wire'));
    this.keys.set('Escape', onBack);
    this.keys.set('Enter', onBack);
    this.show('aviary', box);
  }

  pause({ onResume, onLeave }) {
    const box = el('div', 'pause-box');
    box.appendChild(el('h2', 'pause-title', 'Paused'));
    box.appendChild(wire([sign('Resume', { key: 'Space', gold: true, onClick: onResume, sound: this.tick }), sign('Leave', { key: 'Esc', onClick: onLeave, sound: this.tick })]));
    this.keys.set(' ', onResume);
    this.keys.set('Enter', onResume);
    this.keys.set('Escape', onLeave);
    this.show('pause', box);
  }

  /** One message, one button. */
  notice({ text, button, onClick }) {
    const box = el('div', 'notice-box');
    box.appendChild(el('h2', 'notice-title', text));
    box.appendChild(wire([sign(button, { key: 'Space', gold: true, onClick, sound: this.tick })]));
    this.keys.set(' ', onClick);
    this.keys.set('Enter', onClick);
    this.show('notice', box);
  }
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export { SLOTS };
