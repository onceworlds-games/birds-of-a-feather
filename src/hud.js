// The 2D layer over the sky: the sun clock, the wires leaderboard, a number over every flock, the stamina ring, edge pointers,
// floating numbers, hints and the reason a steal went the way it did. Drawn on a canvas; names are drawn as text only.

import { SLOTS, PALETTE } from './sim/config.js';

const NUM = '"Big Shoulders Display", "Arial Narrow", sans-serif';
const TXT = '"Bricolage Grotesque", system-ui, sans-serif';

/** A flock's symbol at (x, y), radius r. */
export function symbolPath(ctx, kind, x, y, r) {
  ctx.beginPath();
  const poly = (n, rot = -Math.PI / 2, rr = r) => {
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  switch (kind) {
    case 'circle':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'triangle':
      poly(3, -Math.PI / 2, r * 1.15);
      break;
    case 'square':
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'diamond':
      poly(4, -Math.PI / 2, r * 1.15);
      break;
    case 'star':
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const rr = k % 2 ? r * 0.48 : r * 1.15;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'cross': {
      const w = r * 0.38;
      ctx.moveTo(x - w, y - r);
      ctx.lineTo(x + w, y - r);
      ctx.lineTo(x + w, y - w);
      ctx.lineTo(x + r, y - w);
      ctx.lineTo(x + r, y + w);
      ctx.lineTo(x + w, y + w);
      ctx.lineTo(x + w, y + r);
      ctx.lineTo(x - w, y + r);
      ctx.lineTo(x - w, y + w);
      ctx.lineTo(x - r, y + w);
      ctx.lineTo(x - r, y - w);
      ctx.lineTo(x - w, y - w);
      ctx.closePath();
      break;
    }
    case 'hexagon':
      poly(6, 0);
      break;
    case 'chevron':
      ctx.moveTo(x - r, y - r * 0.2);
      ctx.lineTo(x, y - r);
      ctx.lineTo(x + r, y - r * 0.2);
      ctx.lineTo(x + r, y + r * 0.5);
      ctx.lineTo(x, y - r * 0.25);
      ctx.lineTo(x - r, y + r * 0.5);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x + r * 0.5, y);
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2, true);
      break;
    case 'x': {
      const w = r * 0.36;
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const c = Math.cos(a);
        const s = Math.sin(a);
        const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
        const pts = [P(-r * 1.1, -w), P(r * 1.1, -w), P(r * 1.1, w), P(-r * 1.1, w)];
        ctx.moveTo(...pts[0]);
        for (const p of pts.slice(1)) ctx.lineTo(...p);
        ctx.closePath();
      }
      break;
    }
    case 'crescent':
      ctx.arc(x, y, r, 0.35 * Math.PI, 1.65 * Math.PI, false);
      ctx.arc(x + r * 0.45, y, r * 0.78, 1.55 * Math.PI, 0.45 * Math.PI, true);
      ctx.closePath();
      break;
    case 'pentagon':
      poly(5);
      break;
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.pr = 1;
    this.floats = [];
    this.whys = [];
    this.hint = { text: '', t: 0, dur: 0 };
    this.pulse = 0;
    this.myCountPos = { x: 0, y: 0 };
    this.squash = 0;
  }

  resize(w, h, pr) {
    this.w = w;
    this.h = h;
    this.pr = pr;
    this.canvas.width = Math.round(w * pr);
    this.canvas.height = Math.round(h * pr);
  }

  showHint(text, dur = 3.2) {
    this.hint = { text, t: 0, dur };
  }

  /** A number flying from (x, y) into your count (gains), or dropping from it (losses). */
  addFloat(x, y, k, gain) {
    if (this.floats.length > 24) this.floats.shift();
    this.floats.push({ x, y, k, gain, t: 0 });
    this.squash = 1;
  }

  /** Why a steal went one way: the two local counts at the contact point. */
  addWhy(x, y, mine, theirs, lost) {
    const last = this.whys[this.whys.length - 1];
    if (last && last.lost === lost && last.t < 0.6) {
      Object.assign(last, { x, y, mine, theirs, t: 0 });
      return;
    }
    if (this.whys.length > 4) this.whys.shift();
    this.whys.push({ x, y, mine, theirs, lost, t: 0 });
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Outlined text: cream with an ink outline. */
  text(str, x, y, size, { font = TXT, weight = 700, color = PALETTE.cream, align = 'center', base = 'middle', outline = true, alpha = 1 } = {}) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if (outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size * 0.16);
      ctx.strokeStyle = PALETTE.ink;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
  }

  /** Draw a frame. s: everything the HUD shows (see main.js). */
  draw(dt, s) {
    const ctx = this.ctx;
    this.clear();
    ctx.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    this.pulse += dt;
    this.squash = Math.max(0, this.squash - dt * 4);
    if (s.ring) this.drawRing(s.ring);
    if (s.tags) for (const t of s.tags) this.drawTag(t);
    if (s.labels) for (const l of s.labels) this.drawLabel(l);
    if (s.why !== false) this.drawWhys(dt);
    if (s.clock) this.drawClock(s.clock, s.layout);
    if (s.board) this.drawBoard(s.board, s.layout);
    if (s.pointers) for (const p of s.pointers) this.drawPointer(p);
    this.drawFloats(dt);
    this.drawHint(dt, s.layout);
  }

  drawRing(r) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(1, r.squash);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,241,220,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.stroke();
    if (r.stamina < 0.999) {
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = r.stamina < 0.12 ? PALETTE.ember : PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, r.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, r.stamina));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTag(t) {
    const ctx = this.ctx;
    const size = t.size;
    const slot = SLOTS[t.slot];
    const color = t.kind === 'danger' ? PALETTE.ember : PALETTE.cream;
    const label = String(t.n);
    ctx.font = `900 ${size}px ${NUM}`;
    const tw = ctx.measureText(label).width;
    const sr = size * 0.28;
    const total = tw + sr * 2 + 6;
    let x = t.x - total / 2;
    const y = t.y;
    const sq = t.me ? 1 + this.squash * 0.25 : 1;
    // the symbol in the flock's colour
    ctx.globalAlpha = t.alpha;
    symbolPath(ctx, slot.symbol, x + sr, y, sr);
    ctx.fillStyle = slot.hex;
    ctx.fill('evenodd');
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    x += sr * 2 + 6;
    ctx.save();
    ctx.translate(x + tw / 2, y);
    ctx.scale(sq, 2 - sq);
    this.text(label, 0, 0, size, { font: NUM, weight: 900, color, alpha: t.alpha });
    ctx.restore();
    if (t.kind === 'danger') {
      // a jagged underline
      ctx.globalAlpha = t.alpha;
      ctx.strokeStyle = PALETTE.ember;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const y2 = y + size * 0.52;
      for (let k = 0; k <= 8; k++) {
        const px = x + (tw * k) / 8;
        const py = y2 + (k % 2 ? 4 : 0);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    if (t.hunted) {
      // the hawk mark beside the number
      this.drawHawkGlyph(x + tw + 16, y - 2, 11, PALETTE.ember, t.alpha);
    }
    if (t.name) this.text(t.name, t.x, y + size * 0.62 + 10, 16, { weight: 700, alpha: t.alpha * 0.95 });
    if (t.me) this.myCountPos = { x: t.x, y };
    ctx.globalAlpha = 1;
  }

  /** A roost wire's label at its start: place, symbol, name, count. */
  drawLabel(l) {
    const ctx = this.ctx;
    const a = l.alpha ?? 1;
    const size = this.w < 500 ? 24 : 30;
    this.text(String(l.place), l.x, l.y, size, { font: NUM, weight: 900, align: 'right', color: l.place === 1 ? PALETTE.gold : PALETTE.cream, alpha: a });
    const slot = SLOTS[l.slot];
    ctx.globalAlpha = a;
    symbolPath(ctx, slot.symbol, l.x + 16, l.y, 9);
    ctx.fillStyle = slot.hex;
    ctx.fill('evenodd');
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const fs = this.w < 500 ? 16 : 18;
    ctx.font = `800 ${fs}px ${TXT}`;
    let name = l.name;
    while (name.length > 3 && ctx.measureText(name).width > 150) name = name.slice(0, -1);
    if (name !== l.name) name = name.slice(0, -1) + '…';
    const nw = ctx.measureText(name).width;
    this.text(name, l.x + 32, l.y, fs, { align: 'left', weight: 800, alpha: a });
    this.text(String(l.n), l.x + 42 + nw, l.y, size, { font: NUM, weight: 900, align: 'left', color: l.me ? PALETTE.gold : PALETTE.cream, alpha: a });
  }

  drawHawkGlyph(x, y, r, color, alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.6, y - r * 0.2);
    ctx.quadraticCurveTo(x - r * 0.7, y - r * 0.9, x, y);
    ctx.quadraticCurveTo(x + r * 0.7, y - r * 0.9, x + r * 1.6, y - r * 0.2);
    ctx.lineTo(x + r * 0.4, y + r * 0.35);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.4, y + r * 0.35);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawClock(c, layout) {
    const ctx = this.ctx;
    const cx = layout.clockX;
    const top = layout.top;
    const w = 128;
    const lineY = top + 40;
    // the sun: high at the start, gone below the line at sundown
    const r = 13;
    const sunY = lineY - 30 + c.share * (30 + r + 2);
    const sunX = cx - w * 0.28 + c.share * w * 0.56;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w, top - 10, w * 2, lineY - top + 10);
    ctx.clip();
    // halo
    const g = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, r * 2.6);
    g.addColorStop(0, c.sunColor);
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sunX, sunY, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.sunColor;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // the horizon
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, lineY);
    ctx.lineTo(cx + w / 2, lineY);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, lineY);
    ctx.lineTo(cx + w / 2, lineY);
    ctx.stroke();
    // the last 30 s: the time left, small, pulsing each second
    if (c.left <= 30 && c.left > 0) {
      const sec = Math.ceil(c.left);
      const frac = c.left - Math.floor(c.left);
      const size = 30 * (1 + 0.12 * Math.max(0, frac - 0.75) * 4);
      this.text(`0:${String(sec).padStart(2, '0')}`, cx, lineY + 24, size, { font: NUM, weight: 900, color: PALETTE.rose });
    }
    if (c.label) this.text(c.label, cx, lineY + 24, 20, { weight: 700 });
  }

  drawBoard(rows, layout) {
    const ctx = this.ctx;
    const right = layout.right;
    let y = (layout.boardTop ?? layout.top) + 12;
    const width = layout.boardW;
    for (const r of rows) {
      const x0 = right - width;
      // its own wire, sagging under the row
      ctx.strokeStyle = r.me ? PALETTE.cream : 'rgba(35,26,46,0.75)';
      ctx.lineWidth = r.me ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(x0 - 6, y + 13);
      ctx.quadraticCurveTo(x0 + width / 2, y + 19, right + 4, y + 13);
      ctx.stroke();
      this.text(String(r.place), x0 + 8, y, 22, { font: NUM, weight: 900, align: 'center', color: r.place === 1 ? PALETTE.gold : PALETTE.cream });
      const slot = SLOTS[r.slot];
      symbolPath(ctx, slot.symbol, x0 + 30, y, 8);
      ctx.fillStyle = slot.hex;
      ctx.fill('evenodd');
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.ink;
      ctx.stroke();
      const nameMax = width - 100;
      ctx.font = `700 16px ${TXT}`;
      let name = r.name;
      while (name.length > 3 && ctx.measureText(name).width > nameMax) name = name.slice(0, -1);
      if (name !== r.name) name = name.slice(0, -1) + '…';
      this.text(name, x0 + 44, y, 16, { align: 'left', weight: r.me ? 800 : 700 });
      this.text(String(r.n), right, y, 22, { font: NUM, weight: 900, align: 'right', color: r.me ? PALETTE.gold : PALETTE.cream });
      y += 30;
    }
  }

  drawPointer(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-6, -11);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 11);
    ctx.closePath();
    ctx.fillStyle = p.kind === 'hawk' ? PALETTE.ember : SLOTS[p.slot].hex;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
    ctx.restore();
    const ox = -Math.cos(p.angle) * 26;
    const oy = -Math.sin(p.angle) * 26;
    if (p.kind === 'hawk') this.drawHawkGlyph(p.x + ox, p.y + oy, 10, PALETTE.ember);
    else this.text(String(p.n), p.x + ox, p.y + oy, 20, { font: NUM, weight: 900, color: p.danger ? PALETTE.ember : PALETTE.cream });
  }

  drawFloats(dt) {
    const target = this.myCountPos;
    let w = 0;
    for (const f of this.floats) {
      f.t += dt;
      if (f.t < 1.1) this.floats[w++] = f;
    }
    this.floats.length = w;
    for (const f of this.floats) {
      const k = Math.min(1, f.t / 0.7);
      const e = k * k * (3 - 2 * k);
      let x;
      let y;
      if (f.gain) {
        x = f.x + (target.x - f.x) * e;
        y = f.y + (target.y - f.y) * e - Math.sin(e * Math.PI) * 30;
      } else {
        x = target.x + 30;
        y = target.y + 10 + f.t * 50;
      }
      const a = f.t > 0.8 ? 1 - (f.t - 0.8) / 0.3 : 1;
      this.text(`${f.gain ? '+' : '−'}${f.k}`, x, y, 26, { font: NUM, weight: 900, color: f.gain ? PALETTE.gold : PALETTE.ember, alpha: a });
    }
  }

  drawWhys(dt) {
    let k = 0;
    for (const w of this.whys) {
      w.t += dt;
      if (w.t < 1.6) this.whys[k++] = w;
    }
    this.whys.length = k;
    for (const w of this.whys) {
      if (w.x < -50 || w.y < -50) continue;
      const a = w.t > 1.2 ? 1 - (w.t - 1.2) / 0.4 : 1;
      const color = w.lost ? PALETTE.ember : PALETTE.gold;
      this.text(`${w.mine} vs ${w.theirs}`, w.x, w.y - 8, 22, { font: NUM, weight: 900, color, alpha: a });
      this.text(w.lost ? 'thin here' : 'thicker here', w.x, w.y + 12, 16, { weight: 700, alpha: a });
    }
  }

  drawHint(dt, layout) {
    const h = this.hint;
    if (!h.text) return;
    h.t += dt;
    if (h.t > h.dur) {
      h.text = '';
      return;
    }
    const a = Math.min(1, h.t / 0.25, (h.dur - h.t) / 0.4);
    const size = this.w < 500 ? 24 : 28;
    this.text(h.text, this.w / 2, layout.hintY, size, { weight: 800, alpha: a });
  }
}
