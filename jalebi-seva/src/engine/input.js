import * as THREE from 'three';

// Toddler-proof input.
//
// * Things react on touch-DOWN, not on release: small children press, hold,
//   smear and slap rather than "tap".
// * Picking is done in screen space with a generous radius around each
//   target, and falls back to the nearest target if the touch missed.
// * Every pointer is handled independently so a resting palm does not block
//   the finger that is actually playing.

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _right = new THREE.Vector3();

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.targets = [];
    this.onDrag = null; // ({phase:'start'|'move'|'end', x, y, dx, dy}) => void
    this.onAnyTouch = null; // fires for every touch-down, used to hide hints
    this.enabled = true;
    this.pointers = new Map();
    this.dragPointer = null;
    this.raycaster = new THREE.Raycaster();

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    canvas.addEventListener('pointermove', (e) => this._move(e), opts);
    canvas.addEventListener('pointerup', (e) => this._up(e), opts);
    canvas.addEventListener('pointercancel', (e) => this._up(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Make an object touchable.
   * @param {THREE.Object3D} obj
   * @param {(obj) => void} onTap
   * @param {{radius?: number, offset?: THREE.Vector3}} opts radius is in world units
   */
  addTarget(obj, onTap, opts = {}) {
    const t = { obj, onTap, radius: opts.radius ?? 0.3, offset: opts.offset ?? null };
    this.targets.push(t);
    return t;
  }

  removeTarget(obj) {
    this.targets = this.targets.filter((t) => t.obj !== obj);
  }

  clear() {
    this.targets = [];
    this.onDrag = null;
    this.dragPointer = null;
  }

  /** World position a target is considered to be "at". */
  targetWorld(t, out = new THREE.Vector3()) {
    t.obj.getWorldPosition(out);
    if (t.offset) out.add(t.offset);
    return out;
  }

  /** Project a world point to CSS pixels. */
  toScreen(world, out = { x: 0, y: 0 }) {
    _v.copy(world).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    out.x = r.left + (_v.x * 0.5 + 0.5) * r.width;
    out.y = r.top + (-_v.y * 0.5 + 0.5) * r.height;
    out.behind = _v.z > 1;
    return out;
  }

  /** Size in CSS pixels of a world-space radius at a world position. */
  screenRadius(world, radius) {
    _right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const a = this.toScreen(world, { x: 0, y: 0 });
    const b = this.toScreen(_v2.copy(world).addScaledVector(_right, radius), { x: 0, y: 0 });
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Where a screen point hits the horizontal plane y = planeY. */
  pointOnPlane(x, y, planeY, out = new THREE.Vector3()) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (Math.abs(direction.y) < 1e-5) return null;
    const t = (planeY - origin.y) / direction.y;
    if (t < 0) return null;
    return out.copy(origin).addScaledVector(direction, t);
  }

  _pick(x, y) {
    const r = this.canvas.getBoundingClientRect();
    const slop = Math.max(44, Math.min(r.width, r.height) * 0.09);
    let best = null;
    let bestScore = Infinity;
    const p = { x: 0, y: 0 };
    for (const t of this.targets) {
      if (!t.obj.visible) continue;
      const w = this.targetWorld(t, _v2.clone());
      this.toScreen(w, p);
      if (p.behind) continue;
      const rad = this.screenRadius(w, t.radius) + slop;
      const d = Math.hypot(p.x - x, p.y - y);
      // Score by how deep inside the target the touch is, so that a small
      // target next to a large one can still be chosen.
      const score = d / rad;
      if (score < 1 && score < bestScore) {
        best = t;
        bestScore = score;
      }
    }
    return best;
  }

  _down(e) {
    e.preventDefault();
    if (!this.enabled) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* synthetic events have no capturable pointer */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.onAnyTouch) this.onAnyTouch(e.clientX, e.clientY);

    const hit = this._pick(e.clientX, e.clientY);
    if (hit) {
      hit.onTap(hit.obj, e.clientX, e.clientY);
      return;
    }
    if (this.onDrag && this.dragPointer === null) {
      this.dragPointer = e.pointerId;
      this.onDrag({ phase: 'start', x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    }
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    e.preventDefault();
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.onDrag && this.dragPointer === e.pointerId) {
      this.onDrag({ phase: 'move', x: e.clientX, y: e.clientY, dx, dy });
    }
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.dragPointer === e.pointerId) {
      this.dragPointer = null;
      if (this.onDrag) this.onDrag({ phase: 'end', x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    }
  }
}
