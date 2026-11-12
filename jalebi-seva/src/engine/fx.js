import * as THREE from 'three';
import { onFrame } from './tween.js';

// Particles, attention rings and the "show me where to touch" hand.

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const make = {
    glow: (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    },
    ring: (g, s) => {
      g.strokeStyle = '#fff';
      g.lineWidth = s * 0.07;
      g.shadowColor = '#fff';
      g.shadowBlur = s * 0.08;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2);
      g.stroke();
    },
    // dashed "touch here" ring
    target: (g, s) => {
      g.strokeStyle = 'rgba(120,60,0,0.55)';
      g.lineWidth = s * 0.075;
      g.setLineDash([s * 0.2, s * 0.098]);
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#fff';
      g.lineWidth = s * 0.045;
      g.stroke();
    },
    star: (g, s) => {
      g.fillStyle = '#fff';
      g.translate(s / 2, s / 2);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.2 : s * 0.46;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    },
    note: (g, s) => {
      g.fillStyle = '#fff';
      g.strokeStyle = '#fff';
      g.lineWidth = s * 0.07;
      g.lineCap = 'round';
      g.beginPath();
      g.ellipse(s * 0.36, s * 0.74, s * 0.16, s * 0.12, -0.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.72);
      g.lineTo(s * 0.5, s * 0.16);
      g.quadraticCurveTo(s * 0.78, s * 0.22, s * 0.74, s * 0.46);
      g.stroke();
    },
    petal: (g, s) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(s / 2, s / 2, s * 0.3, s * 0.46, 0, 0, Math.PI * 2);
      g.fill();
    },
    heart: (g, s) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.86);
      g.bezierCurveTo(s * 0.02, s * 0.5, s * 0.2, s * 0.08, s * 0.5, s * 0.34);
      g.bezierCurveTo(s * 0.8, s * 0.08, s * 0.98, s * 0.5, s * 0.5, s * 0.86);
      g.fill();
    },
  }[name];
  return (TEX[name] = canvasTex(name === 'target' ? 128 : 64, make));
}

const _tmp = new THREE.Vector3();
const blobGeo = new THREE.SphereGeometry(1, 8, 6);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const strandGeo = new THREE.CylinderGeometry(0.06, 0.03, 1, 4);

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.emitters = new Set();
    onFrame((dt, t) => this._update(dt, t));
  }

  sprite(name, color = 0xffffff, size = 0.2, opts = {}) {
    const m = new THREE.SpriteMaterial({
      map: tex(name),
      color,
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  }

  blob(color, size) {
    const m = new THREE.Mesh(blobGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.scale.setScalar(size);
    return m;
  }

  /** Add a short-lived object. vel/gravity in world units, life in seconds. */
  spawn(obj, { pos, vel = null, gravity = 0, life = 1, grow = 0, fade = true, spin = 0, drag = 0, floorY = null }) {
    obj.position.copy(pos);
    this.scene.add(obj);
    this.items.push({
      obj,
      vel: vel ? vel.clone() : new THREE.Vector3(),
      gravity,
      life,
      age: 0,
      grow,
      fade,
      spin,
      drag,
      floorY,
      base: obj.scale.x,
      opacity: obj.material.opacity,
    });
    return obj;
  }

  _update(dt, time) {
    for (const em of this.emitters) em(dt, time);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.scene.remove(p.obj);
        p.obj.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.floorY !== null && p.obj.position.y < p.floorY) {
        p.obj.position.y = p.floorY;
        p.vel.set(0, 0, 0);
      }
      if (p.grow) p.obj.scale.setScalar(p.base * (1 + p.grow * k));
      if (p.spin) {
        if (p.obj.isSprite) p.obj.material.rotation += p.spin * dt;
        else {
          p.obj.rotation.x += p.spin * dt;
          p.obj.rotation.z += p.spin * 0.7 * dt;
        }
      }
      if (p.fade) p.obj.material.opacity = p.opacity * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
    }
  }

  /** Emitter callback fn(dt, time); returns a function that stops it. */
  emitter(fn) {
    this.emitters.add(fn);
    return () => this.emitters.delete(fn);
  }

  // ---- presets ---------------------------------------------------------------

  stars(pos, n = 12, colors = [0xffd23f, 0xff8fab, 0x8ef6e4, 0xffffff, 0xffa62b]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 1 + Math.random() * 1.4;
      const s = this.sprite('star', colors[i % colors.length], 0.12 + Math.random() * 0.1, { depthTest: false });
      s.material.transparent = true;
      s.renderOrder = 20;
      this.spawn(s, {
        pos,
        vel: _tmp.set(Math.cos(a) * sp, Math.sin(a) * sp + 0.8, (Math.random() - 0.5) * 0.6),
        gravity: 2.2,
        life: 0.9 + Math.random() * 0.4,
        spin: (Math.random() - 0.5) * 8,
      });
    }
  }

  hearts(pos, n = 5) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite('heart', [0xff5d8f, 0xff8fab, 0xffb703][i % 3], 0.14, { depthTest: false });
      s.renderOrder = 20;
      this.spawn(s, {
        pos: _tmp.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, 0)),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.5, 0),
        life: 1.2,
        grow: 0.5,
      });
    }
  }

  puff(pos, color = 0xffffff, size = 0.25, life = 1.4) {
    const s = this.sprite('glow', color, size);
    s.material.opacity = 0.5;
    this.spawn(s, {
      pos,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.35 + Math.random() * 0.25, (Math.random() - 0.5) * 0.12),
      life,
      grow: 1.6,
    });
  }

  /** Steam rising from a disc of the given radius. Returns stop(). */
  steam(center, radius, rate = 5) {
    let acc = 0;
    return this.emitter((dt) => {
      acc += dt * rate;
      while (acc > 1) {
        acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        this.puff(new THREE.Vector3(center.x + Math.cos(a) * r, center.y, center.z + Math.sin(a) * r));
      }
    });
  }

  /** Little rings popping on a liquid surface. Returns stop(). */
  bubbles(center, radius, color = 0xffffff, rate = 9) {
    let acc = 0;
    return this.emitter((dt) => {
      acc += dt * rate;
      while (acc > 1) {
        acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const s = this.sprite('ring', color, 0.03 + Math.random() * 0.03);
        s.material.opacity = 0.8;
        this.spawn(s, {
          pos: new THREE.Vector3(center.x + Math.cos(a) * r, center.y + 0.012, center.z + Math.sin(a) * r),
          life: 0.45 + Math.random() * 0.3,
          grow: 1.8,
        });
      }
    });
  }

  /**
   * One piece of falling stuff. kind: 'blob' | 'powder' (flour) | 'crystal'
   * (sugar) | 'water' | 'strand' (saffron) | 'chura' (crushed cardamom).
   */
  grain(kind, color, size) {
    let m;
    if (kind === 'crystal') {
      m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.05 }));
      m.scale.setScalar(size * (0.5 + Math.random() * 0.5));
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    } else if (kind === 'water') {
      m = new THREE.Mesh(
        blobGeo,
        new THREE.MeshStandardMaterial({ color: 0xd9f1fb, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.6 }),
      );
      const w = size * (0.55 + Math.random() * 0.4);
      m.scale.set(w, w * (1.8 + Math.random() * 1.4), w);
    } else if (kind === 'strand') {
      m = new THREE.Mesh(strandGeo, new THREE.MeshStandardMaterial({ color: Math.random() < 0.25 ? 0xe8791a : 0xa3140a, roughness: 0.6 }));
      m.scale.setScalar(size * 40);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    } else if (kind === 'chura') {
      const c = [0x2e2218, 0x4a3524, 0x9bb055, 0xb8a36a][Math.floor(Math.random() * 4)];
      m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
      m.scale.set(size * (0.4 + Math.random() * 0.8), size * 0.4, size * (0.4 + Math.random() * 0.8));
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    } else {
      m = new THREE.Mesh(blobGeo, new THREE.MeshStandardMaterial({ color, roughness: kind === 'powder' ? 1 : 0.5 }));
      m.scale.setScalar(size * (kind === 'powder' ? 0.35 + Math.random() * 0.5 : 0.7 + Math.random() * 0.6));
    }
    return m;
  }

  /** A stream falling from `from` into `to`. */
  pour(from, to, color, { n = 22, dur = 0.7, size = 0.03, kind = 'blob', spread = 0.05 } = {}) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const b = this.grain(kind, color, size);
        const start = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, 0, (Math.random() - 0.5) * spread));
        const fall = Math.max(0.05, start.y - to.y);
        const T = Math.sqrt((2 * fall) / 9.8);
        const land = spread * 2.5;
        this.spawn(b, {
          pos: start,
          vel: new THREE.Vector3((to.x - start.x + (Math.random() - 0.5) * land) / T, 0, (to.z - start.z + (Math.random() - 0.5) * land) / T),
          gravity: 9.8,
          life: T,
          fade: false,
          spin: kind === 'strand' || kind === 'crystal' || kind === 'chura' ? 6 : 0,
        });
        // flour hangs in the air as it falls
        if (kind === 'powder' && i % 5 === 0) this.puff(start.clone().lerp(to, 0.5 + Math.random() * 0.5), 0xffffff, 0.16, 0.9);
      }, (i / n) * dur * 1000);
    }
  }

  splash(pos, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = this.blob(color, 0.02 + Math.random() * 0.015);
      this.spawn(b, {
        pos,
        vel: new THREE.Vector3(Math.cos(a) * 0.6, 1.3 + Math.random() * 0.8, Math.sin(a) * 0.6),
        gravity: 7,
        life: 0.5,
        fade: false,
      });
    }
  }

  notes(pos, n = 2) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite('note', [0xffd23f, 0xffffff, 0xff8fab, 0x8ef6e4][Math.floor(Math.random() * 4)], 0.2, {
        depthTest: false,
      });
      s.renderOrder = 20;
      this.spawn(s, {
        pos: _tmp.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, 0)),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.4, 0),
        life: 1.3,
        grow: 0.4,
      });
    }
  }

  /** Flower petals drifting down over an area. Returns stop(). */
  petals(center, spread = 3, rate = 14, height = 3.2) {
    const colors = [0xff9f1c, 0xffbf00, 0xff5d8f, 0xffffff, 0xf94144];
    let acc = 0;
    return this.emitter((dt) => {
      acc += dt * rate;
      while (acc > 1) {
        acc -= 1;
        const s = this.sprite('petal', colors[Math.floor(Math.random() * colors.length)], 0.09 + Math.random() * 0.05);
        this.spawn(s, {
          pos: new THREE.Vector3(
            center.x + (Math.random() - 0.5) * spread,
            center.y + height,
            center.z + (Math.random() - 0.5) * spread * 0.6,
          ),
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.7 - Math.random() * 0.5, 0),
          life: 3.6,
          spin: (Math.random() - 0.5) * 5,
        });
      }
    });
  }

  /** A pulsing ring that says "touch me". Returns remove(). */
  attention(getPos, radius = 0.3, color = 0xffffff) {
    const s = this.sprite('target', color, radius * 2.6, { depthTest: false });
    s.renderOrder = 15;
    this.scene.add(s);
    const stop = this.emitter((dt, t) => {
      const p = getPos();
      s.position.copy(p);
      s.scale.setScalar(radius * (2.5 + Math.sin(t * 5) * 0.28));
      s.material.rotation = t * 0.9;
      s.material.opacity = 0.9;
    });
    return () => {
      stop();
      this.scene.remove(s);
      s.material.dispose();
    };
  }
}

// ---------------------------------------------------------------------------
// The pointing hand: a DOM element that floats over the 3D view.
// ---------------------------------------------------------------------------

const HAND_SVG = `
<svg viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 6c4 0 7 3 7 7v19l15 3c6 1 10 6 9 12l-3 17c-1 6-6 10-12 10H27c-5 0-9-2-12-6L4 52c-2-3-1-7 2-9s7-1 9 2l2 3V13c0-4 3-7 7-7z"
        fill="#fff" stroke="#3b2a1a" stroke-width="4" stroke-linejoin="round"/>
</svg>`;

export class Hint {
  constructor(input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'hint-hand';
    this.el.innerHTML = HAND_SVG;
    document.body.appendChild(this.el);
    this.desc = null;
    this.idle = 0;
    this.delay = 2.2;
    this.px = null;
    onFrame((dt, t) => this._update(dt, t));
  }

  /**
   * desc.type: 'tap' {at}, 'circle' {at, r}, 'swipe' {from, to}, 'path' {points}
   * positions are THREE.Vector3 or functions returning one.
   */
  set(desc, delay = 2.2) {
    this.desc = desc;
    this.delay = delay;
    this.idle = 0;
    this.el.style.opacity = 0;
  }

  clear() {
    this.desc = null;
    this.px = null;
    this.el.style.opacity = 0;
  }

  /** Call on any touch: hide the hand and start the idle timer again. */
  nudge() {
    this.idle = 0;
    this.el.style.opacity = 0;
  }

  _w(p) {
    return typeof p === 'function' ? p() : p;
  }

  /** Current hint in CSS pixels (also used by the automated play-through). */
  screen() {
    const d = this.desc;
    if (!d) return null;
    const out = { type: d.type };
    const S = (w) => this.input.toScreen(this._w(w), { x: 0, y: 0 });
    if (d.type === 'tap') Object.assign(out, S(d.at));
    else if (d.type === 'circle') {
      const c = this._w(d.at);
      Object.assign(out, S(c));
      out.r = this.input.screenRadius(c, d.r);
    } else if (d.type === 'swipe') {
      const a = S(d.from);
      const b = S(d.to);
      Object.assign(out, { x: a.x, y: a.y, x2: b.x, y2: b.y });
    } else if (d.type === 'path') {
      out.points = d.points.map((p) => S(p));
      out.x = out.points[0].x;
      out.y = out.points[0].y;
    }
    return out;
  }

  _update(dt, t) {
    if (!this.desc) return;
    this.idle += dt;
    const s = this.screen();
    this.px = s;
    if (this.idle < this.delay) return;
    let x = s.x;
    let y = s.y;
    const k = (this.idle - this.delay) % 2;
    if (s.type === 'tap') {
      y += Math.abs(Math.sin(t * 5)) * -16;
    } else if (s.type === 'circle') {
      x += Math.cos(t * 3.2) * s.r * 0.6;
      y += Math.sin(t * 3.2) * s.r * 0.6 * 0.6;
    } else if (s.type === 'swipe') {
      const u = Math.min(1, k / 1.3);
      x = s.x + (s.x2 - s.x) * u;
      y = s.y + (s.y2 - s.y) * u;
    } else if (s.type === 'path') {
      const u = Math.min(0.999, k / 1.7) * (s.points.length - 1);
      const i = Math.floor(u);
      const f = u - i;
      x = s.points[i].x + (s.points[i + 1].x - s.points[i].x) * f;
      y = s.points[i].y + (s.points[i + 1].y - s.points[i].y) * f;
    }
    this.el.style.opacity = 1;
    this.el.style.transform = `translate(${x - 18}px, ${y - 4}px)`;
  }
}
