// Steering: point where to fly. The mouse (the bird flies toward the cursor), WASD or the arrows (eight ways, up the screen is
// up), or the platform's stick and Boost button on a phone. Whichever was used last steers, and the hints name it.

export class Input {
  constructor(el, ow) {
    this.ow = ow;
    this.el = el;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, in: false, down: false, t: 0 };
    this.last = 'mouse'; // 'mouse' | 'keys' | 'touch'
    this.pressed = []; // keys that went down since the last read
    this.onAny = null;
    this.mouseEase = 1;
    this.out = { has: false, sx: 0, sy: 0, mouse: false, boost: false };
    const key = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.type === 'keydown') {
        if (!this.keys.has(k)) this.pressed.push(k);
        this.keys.add(k);
        if (['a', 'd', 'w', 's', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k) && !this.touch()) this.last = 'keys';
        if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
        this.onAny?.();
      } else this.keys.delete(k);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const moved = Math.abs(e.clientX - this.mouse.x) + Math.abs(e.clientY - this.mouse.y) > 2;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.in = true;
      if (moved) {
        this.last = 'mouse';
        this.mouseEase = 1;
      }
    });
    el.addEventListener('pointerdown', (e) => {
      this.onAny?.();
      if (e.pointerType === 'mouse') {
        this.mouse.down = e.button === 0;
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.in = true;
        this.last = 'mouse';
      } else this.last = 'touch';
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false;
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.mouse.in = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  touch() {
    try {
      return !!this.ow?.controls?.touch;
    } catch {
      return false;
    }
  }

  takePresses() {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }

  /**
   * Where the player points this frame, in screen terms: { has, sx, sy (a direction on screen, right and down are +; for the
   * mouse, the cursor's position in px), mouse (true: sx, sy is the cursor), boost }.
   */
  read(dt) {
    const o = this.out;
    o.has = false;
    o.mouse = false;
    o.sx = 0;
    o.sy = 0;
    let boost = false;
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.has('a') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('d') || k.has('ArrowRight')) kx += 1;
    if (k.has('w') || k.has('ArrowUp')) ky -= 1;
    if (k.has('s') || k.has('ArrowDown')) ky += 1;
    if (k.has(' ') || k.has('Shift')) boost = true;
    let stick = null;
    try {
      stick = this.ow?.controls?.stick ?? null;
      if (this.ow?.controls?.pressed?.('boost')) boost = true;
    } catch {
      stick = null;
    }
    if (stick && Math.hypot(stick.x, stick.y) > 0.2) {
      this.last = 'touch';
      o.has = true;
      o.sx = stick.x;
      o.sy = stick.y;
    } else if (kx || ky) {
      o.has = true;
      o.sx = kx;
      o.sy = ky;
    } else if (this.last === 'mouse') {
      if (this.mouse.in) this.mouseEase = 1;
      else this.mouseEase = Math.max(0, this.mouseEase - dt);
      if (this.mouseEase > 0.5) {
        o.has = true;
        o.mouse = true;
        o.sx = this.mouse.x;
        o.sy = this.mouse.y;
      }
      if (this.mouse.down) boost = true;
    }
    o.boost = boost;
    return o;
  }
}
