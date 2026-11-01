// Every screen's DOM: signs hung from a sagging wire (gold for the main one, cream for the rest), at most two on a wire.
// Text from other players goes in with textContent only.

import { PLACES } from './sim/migration.js';
import { SLOTS } from './sim/config.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const FEATHER = 'M12 1C6 6 4 13 6 22l2-1c-1-6 0-12 4-17-2 6-2 11-1 16l2-1c-1-5 0-10 3-14 1 5 0 9-3 13l1 1c5-5 6-12 3-18z';

function featherIcon(filled) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `feather${filled ? ' on' : ''}`);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', FEATHER);
  svg.appendChild(p);
  return svg;
}

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

/** A sign button: label, an optional key, gold or cream. */
export function sign(label, { key, gold = false, small = false, onClick, sound } = {}) {
  const b = el('button', `sign${gold ? ' gold' : ''}${small ? ' small' : ''}`);
  b.type = 'button';
  b.appendChild(el('span', 'label', label));
  if (key) b.appendChild(el('kbd', null, key));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    sound?.();
    onClick?.();
  });
  return b;
}

export class Screens {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.current = null;
    this.keys = new Map();
  }

  tick = () => this.audio.tick();

  clear() {
    this.root.replaceChildren();
    this.current = null;
    this.keys.clear();
  }

  /** Keyboard: Space/Enter for the main sign, and any other keys a screen binds. */
  key(k) {
    const fn = this.keys.get(k);
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

  title({ best, onFly, resume }) {
    const box = el('div', 'title-box');
    const h = el('h1', 'game-name');
    for (const word of ['Birds', 'of a', 'Feather']) h.appendChild(el('span', null, word));
    box.appendChild(h);
    const fly = sign(resume ? 'Fly on' : 'Fly', { key: 'Space', gold: true, onClick: onFly, sound: this.tick });
    box.appendChild(wire([fly], 'title-wire'));
    if (best > 0) box.appendChild(el('div', 'best', `Best ${best}`));
    this.keys.set(' ', onFly);
    this.keys.set('Enter', onFly);
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

  /** The night: the results line, Migration (alone only), the host's rival skill, the dawn countdown. */
  night({ lines, best, migration, skill, onMigration, onSkill, dawnIn }) {
    const box = el('div', 'night-box');
    const head = el('div', 'night-lines');
    for (const [text, cls] of lines) head.appendChild(el('div', `line ${cls ?? ''}`, text));
    if (best) head.appendChild(el('div', 'line newbest', 'New best!'));
    box.appendChild(head);
    const signs = [];
    if (migration) {
      signs.push(sign('Migration', { key: 'M', onClick: onMigration, sound: this.tick }));
      this.keys.set('m', onMigration);
    }
    const bottom = el('div', 'bottom');
    if (signs.length) bottom.appendChild(wire(signs, 'night-wire'));
    if (skill) {
      const row = el('div', 'skill-row');
      row.appendChild(el('span', 'skill-label', 'Rivals'));
      for (const [id, label] of [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]) {
        const b = sign(label, { small: true, gold: skill === id, onClick: () => onSkill(id), sound: this.tick });
        row.appendChild(b);
      }
      bottom.appendChild(row);
    }
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

  intro({ index }) {
    const P = PLACES[index];
    const box = el('div', 'intro-box');
    box.appendChild(el('div', 'intro-n', `${index + 1} of ${PLACES.length}`));
    box.appendChild(el('h2', 'intro-name', P.name));
    box.appendChild(el('div', 'intro-goal', P.lines[0]));
    this.show('intro', box);
  }

  result({ index, rank, n, earned, before, hasNext, onNext, onAgain, onBack }) {
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
      setTimeout(() => {
        f.classList.add('on');
        if (k >= before) f.classList.add('new');
        this.audio.chime(k);
      }, 500 + k * 420);
    });
    return wrap;
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
