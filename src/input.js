// Steering: the mouse (the bird turns toward the cursor), the keys, or the platform's stick and Boost button on a phone.
// Whichever was used last steers, and the hints name it.

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
   * The stick for this frame: { turn (right +), climb (up +), boost }. `lead` is the lead bird's position on screen (px),
   * `w`, `h` the view's size.
   */
  read(lead, w, h, dt) {
    let turn = 0;
    let climb = 0;
    let boost = false;
    const k = this.keys;
    if (k.has('a') || k.has('ArrowLeft')) turn -= 1;
    if (k.has('d') || k.has('ArrowRight')) turn += 1;
    if (k.has('w') || k.has('ArrowUp')) climb += 1;
    if (k.has('s') || k.has('ArrowDown')) climb -= 1;
    if (k.has(' ')) boost = true;
    let stick = null;
    try {
      stick = this.ow?.controls?.stick ?? null;
      if (this.ow?.controls?.pressed?.('boost')) boost = true;
    } catch {
      stick = null;
    }
    if (stick && (Math.abs(stick.x) > 0.08 || Math.abs(stick.y) > 0.08)) {
      this.last = 'touch';
      turn += stick.x;
      climb += -stick.y;
    }
    // the mouse: its offset from the lead bird on screen
    if (this.last === 'mouse' && lead) {
      if (this.mouse.in) this.mouseEase = 1;
      else this.mouseEase = Math.max(0, this.mouseEase - dt);
      const half = w / 2;
      const dx = this.mouse.x - lead.x;
      const dy = this.mouse.y - lead.y;
      const dead = 12;
      const mx = Math.abs(dx) < dead ? 0 : (dx - Math.sign(dx) * dead) / (half * 0.35);
      // a wide band in the middle flies level: climbing and diving need a clear push
      const vdead = h * 0.12;
      const my = Math.abs(dy) < vdead ? 0 : -(dy - Math.sign(dy) * vdead) / (h * 0.25);
      turn += Math.max(-1, Math.min(1, mx)) * this.mouseEase;
      climb += Math.max(-1, Math.min(1, my)) * this.mouseEase;
      if (this.mouse.down) boost = true;
    }
    return { turn: Math.max(-1, Math.min(1, turn)), climb: Math.max(-1, Math.min(1, climb)), boost };
  }
}
