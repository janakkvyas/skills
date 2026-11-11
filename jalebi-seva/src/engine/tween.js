// Tiny promise-based tween system. Everything in the game that moves over
// time goes through here so that one clock (and one time-scale, used by the
// automated play-through) drives it all.

const active = new Set();
const loops = new Set();

export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Run fn(easedT, rawT) every frame for `dur` seconds. Resolves when done. */
export function tween(dur, fn, e = ease.inOut) {
  return new Promise((resolve) => {
    if (dur <= 0) {
      fn(1, 1);
      resolve();
      return;
    }
    active.add({ t: 0, dur, fn, e, resolve });
  });
}

export const wait = (sec) => tween(sec, () => {}, ease.linear);

/** Register a per-frame callback fn(dt, time). Returns a function that removes it. */
export function onFrame(fn) {
  loops.add(fn);
  return () => loops.delete(fn);
}

let clock = 0;
export function updateTweens(dt) {
  clock += dt;
  for (const tw of active) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k), k);
    if (k >= 1) {
      active.delete(tw);
      tw.resolve();
    }
  }
  for (const fn of loops) fn(dt, clock);
}

export const now = () => clock;

// ---- helpers on Object3D ---------------------------------------------------

export function moveTo(obj, target, dur = 0.5, e = ease.inOut) {
  const from = obj.position.clone();
  const to = target.clone ? target.clone() : target;
  return tween(dur, (k) => obj.position.lerpVectors(from, to, k), e);
}

/** Hop from the current position to `target` along a parabola `height` tall. */
export function arcTo(obj, target, height = 0.6, dur = 0.6, e = ease.inOut) {
  const from = obj.position.clone();
  const to = target.clone();
  return tween(
    dur,
    (k) => {
      obj.position.lerpVectors(from, to, k);
      obj.position.y += Math.sin(Math.PI * k) * height;
    },
    e,
  );
}

export function scaleTo(obj, s, dur = 0.3, e = ease.back) {
  const from = obj.scale.clone();
  const to = typeof s === 'number' ? { x: s, y: s, z: s } : s;
  return tween(
    dur,
    (k) => obj.scale.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k),
    e,
  );
}

/** Quick squash-and-stretch "boing" to acknowledge a touch. */
export function boing(obj, amount = 0.25, dur = 0.35) {
  const base = obj.userData.baseScale || (obj.userData.baseScale = obj.scale.clone());
  return tween(
    dur,
    (k) => {
      const w = Math.sin(k * Math.PI * 3) * (1 - k) * amount;
      obj.scale.set(base.x * (1 + w), base.y * (1 - w * 0.8), base.z * (1 + w));
    },
    ease.linear,
  );
}

export function rotateTo(obj, rot, dur = 0.4, e = ease.inOut) {
  const from = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
  const to = { x: rot.x ?? from.x, y: rot.y ?? from.y, z: rot.z ?? from.z };
  return tween(
    dur,
    (k) => obj.rotation.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k),
    e,
  );
}
