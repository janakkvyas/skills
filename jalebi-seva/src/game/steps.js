import * as THREE from 'three';
import { tween, wait, ease, arcTo, scaleTo, boing, rotateTo, onFrame } from '../engine/tween.js';
import { make } from '../engine/assets.js';
import { COLORS } from '../art/materials.js';
import { jalebiMaterial, jalebiPile, jalebiGeometry, sharedJalebiMaterial } from '../art/props.js';
import { AREAS, makeSwirl } from '../art/world.js';
import { praise } from './i18n.js';

// The fourteen steps of the game, in order. Each is an async function that
// resolves when the child has finished it. There is no way to fail: every
// touch does something nice, and the next thing to touch always glows.
//
// Every step first makes sure the world looks the way the earlier steps
// would have left it (the ensure* helpers), so a parent can skip a step and
// the game can be started from any point.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const IDENTITY = new THREE.Quaternion();
const _c = new THREE.Color();

const worldPos = (o) => o.getWorldPosition(new THREE.Vector3());

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

async function popIn(ctx, obj, dur = 0.4) {
  const s = obj.scale.clone();
  obj.scale.setScalar(0.001);
  obj.visible = true;
  ctx.audio.pop();
  await tween(dur, (k) => obj.scale.copy(s).multiplyScalar(Math.max(0.001, k)), ease.back);
}

async function popOut(obj, dur = 0.25) {
  const s = obj.scale.clone();
  await tween(dur, (k) => obj.scale.copy(s).multiplyScalar(Math.max(0.001, 1 - k)), ease.in);
  obj.visible = false;
  obj.scale.copy(s);
}

function lerpColor(material, toHex, dur) {
  const from = material.color.clone();
  _c.set(toHex);
  const to = _c.clone();
  return tween(dur, (k) => material.color.lerpColors(from, to, k), ease.linear);
}

function slerpTo(obj, q, dur) {
  const from = obj.quaternion.clone();
  return tween(dur, (k) => obj.quaternion.slerpQuaternions(from, q, k), ease.inOut);
}

async function cheer(ctx, at) {
  ctx.fx.stars(at, 14);
  ctx.audio.yay();
  ctx.voice.speak(praise());
  await wait(1.1);
}

/**
 * Wait until every item has been touched, in any order.
 * items: [{ obj, radius?, offset?, onTap: async () => {} }]
 */
function tapAll(ctx, items) {
  return new Promise((resolve) => {
    if (!items.length) return resolve();
    const remaining = new Set(items);
    let pending = items.length;
    const pos = (it) => {
      const p = worldPos(it.obj);
      if (it.offset) p.add(it.offset);
      return p;
    };
    const point = () => {
      const next = remaining.values().next().value;
      if (next) ctx.hint.set({ type: 'tap', at: () => pos(next) });
      else ctx.hint.clear();
    };
    for (const it of items) {
      const stop = ctx.fx.attention(() => pos(it), (it.radius ?? 0.3) * 0.9);
      ctx.input.addTarget(
        it.obj,
        async () => {
          if (!remaining.delete(it)) return;
          ctx.input.removeTarget(it.obj);
          stop();
          ctx.audio.pop();
          point();
          await it.onTap(it);
          if (--pending === 0) resolve();
        },
        { radius: it.radius ?? 0.3, offset: it.offset },
      );
    }
    point();
  });
}

/** Touch the same thing n times. onTap(i) runs for each touch. */
function tapTimes(ctx, obj, n, onTap, { radius = 0.3, offset = null } = {}) {
  return new Promise((resolve) => {
    let count = 0;
    let pending = 0;
    const at = () => {
      const p = worldPos(obj);
      if (offset) p.add(offset);
      return p;
    };
    const stop = ctx.fx.attention(at, radius * 0.9);
    ctx.hint.set({ type: 'tap', at });
    ctx.input.addTarget(
      obj,
      async () => {
        if (count >= n) return;
        const i = count++;
        ctx.hint.nudge();
        if (count >= n) {
          ctx.input.removeTarget(obj);
          stop();
          ctx.hint.clear();
        }
        pending++;
        boing(obj);
        await onTap(i);
        if (--pending === 0 && count >= n) resolve();
      },
      { radius, offset },
    );
  });
}

/** Lift a container, tip it over `target`, and pour its contents in. */
async function pourInto(ctx, obj, target, color, { part = 'fill', onStream = null, leave = true } = {}) {
  const home = obj.position.clone();
  const side = home.x < target.x ? -1 : 1;
  const above = V3(target.x + side * 0.4, target.y + 0.55, target.z + 0.1);
  await arcTo(obj, above, 0.3, 0.5);
  await rotateTo(obj, { z: side * 1.85 }, 0.3);
  ctx.audio.pour();
  ctx.fx.pour(V3(above.x - side * 0.28, above.y + 0.02, above.z), target, color, { n: 26, dur: 0.7 });
  const fill = obj.userData.parts && obj.userData.parts[part];
  if (onStream) onStream();
  await wait(0.45);
  if (fill) fill.visible = false;
  await wait(0.4);
  await rotateTo(obj, { z: 0 }, 0.25);
  if (leave) {
    await arcTo(obj, home, 0.3, 0.4);
    await popOut(obj);
  } else {
    await arcTo(obj, home, 0.3, 0.45);
  }
}

/** Raise a liquid disc to a level, widening it to match the vessel. */
function raiseLiquid(disc, y, scale, dur = 0.7) {
  disc.visible = true;
  const y0 = disc.position.y;
  const s0 = disc.scale.x;
  return tween(dur, (k) => {
    disc.position.y = y0 + (y - y0) * k;
    disc.scale.setScalar(s0 + (scale - s0) * k);
  });
}

/**
 * Stirring: any dragging (or tapping) on the vessel moves the spoon and
 * fills the meter. Resolves when the meter is full.
 */
function stir(ctx, { center, radius, spoon, swirl = null, need = 2.3, onProgress = null }) {
  return new Promise((resolve) => {
    const { input, hint, hud, audio } = ctx;
    const minDim = () => Math.min(window.innerWidth, window.innerHeight);
    let prog = 0;
    let spin = 0;
    let auto = 0;
    let ang = 0;
    let finished = false;
    let lastTick = 0;
    const target = center.clone();
    hint.set({ type: 'circle', at: center, r: radius * 0.75 }, 1.6);
    const stopAttn = ctx.fx.attention(() => center, radius * 0.8);
    hud.meter(0);

    const off = onFrame((dt) => {
      if (auto > 0) {
        auto -= dt;
        ang += dt * 9;
        target.set(center.x + Math.cos(ang) * radius * 0.5, center.y, center.z + Math.sin(ang) * radius * 0.5);
        spin += dt * 5;
      }
      spoon.position.lerp(target, Math.min(1, dt * 14));
      if (swirl) {
        swirl.rotation.z -= (spin * 3 + 0.3) * dt;
        swirl.material.opacity = Math.min(0.6, swirl.material.opacity + spin * dt * 0.6);
      }
      spin *= Math.max(0, 1 - dt * 2.5);
    });

    const add = (amt) => {
      if (finished) return;
      prog = Math.min(1, prog + amt / need);
      hud.meter(prog);
      if (onProgress) onProgress(prog);
      if (prog - lastTick > 0.07) {
        lastTick = prog;
        audio.tone({ freq: 420 + prog * 380, dur: 0.07, vol: 0.09, type: 'triangle' });
      }
      if (prog >= 1) {
        finished = true;
        off();
        stopAttn();
        input.onDrag = null;
        hint.clear();
        hud.meter(null);
        resolve();
      }
    };

    input.onDrag = (ev) => {
      hint.nudge();
      const p = input.pointOnPlane(ev.x, ev.y, center.y);
      if (p) {
        const d = p.sub(center);
        d.y = 0;
        const max = radius * 0.8;
        if (d.length() > max) d.setLength(max);
        target.copy(center).add(d);
      }
      if (ev.phase === 'start') {
        auto = 0.6;
        add(0.14);
      } else if (ev.phase === 'move') {
        const dist = Math.hypot(ev.dx, ev.dy) / minDim();
        add(dist);
        spin += dist * 16;
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Jalebi bookkeeping
//
// Every touch in the ghee makes one perfect jalebi, as many as the child
// likes. Each jalebi is tracked from the kadhai, to the chaasni, to the
// tokri; the tokri (and everything in it) is what is offered as bhog.
// ---------------------------------------------------------------------------

const DEFAULT_COUNT = 5; // made for a step reached by skipping
const POT_VISIBLE = 40; // more than this in the pot sink out of sight
const TOKRI_ON_CHOWKI = 0.74;

function kadhaiSurface(k) {
  const c = worldPos(k.kadhai);
  return { center: V3(c.x, c.y + k.kadhai.userData.gheeY + 0.012, c.z), R: k.kadhai.userData.gheeR - 0.05 };
}

function potSurface(k) {
  const c = worldPos(k.pot);
  return V3(c.x, c.y + k.pot.userData.liquidTop + 0.004, c.z);
}

const ring = (c, r, n, y = 0, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return V3(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r);
  });

/** Seven places in the kadhai: one in the middle, six around it. */
const kadhaiSlots = (k) => {
  const { center } = kadhaiSurface(k);
  return [center.clone(), ...ring(center, 0.36, 6, 0, Math.PI / 6)];
};

/** The i-th place in the chaasni: rings of five, heaping up. */
function potSlot(k, i) {
  const c = potSurface(k);
  const layer = Math.floor(i / 5);
  const s = i % 5;
  const y = c.y + layer * 0.028;
  if (s === 0) return V3(c.x, y, c.z);
  const a = layer * 0.6 + ((s - 1) / 4) * Math.PI * 2 + Math.PI / 4;
  return V3(c.x + Math.cos(a) * 0.27, y, c.z + Math.sin(a) * 0.27);
}

function setStage(j, stage) {
  const m = j.material;
  m.color.set({ raw: COLORS.jalebiRaw, fried: COLORS.jalebiFried, syrup: COLORS.jalebiSyrup }[stage]);
  m.roughness = stage === 'syrup' ? 0.16 : stage === 'fried' ? 0.4 : 0.7;
  m.metalness = stage === 'syrup' ? 0.15 : 0;
}

function newJalebi(ctx, pos, stage) {
  const k = ctx.world.kitchen;
  const st = ctx.state;
  const material = jalebiMaterial(stage);
  const variant = st.made % 3;
  const obj = new THREE.Mesh(jalebiGeometry(variant), material);
  obj.castShadow = true;
  obj.position.copy(pos);
  obj.rotation.y = Math.random() * Math.PI * 2;
  k.group.add(obj);
  const j = { obj, material, variant, where: null, fried: stage !== 'raw', born: st.made++ };
  st.jalebis.push(j);
  return j;
}

const jalebisIn = (ctx, where) => ctx.state.jalebis.filter((j) => j.where === where);

/** Put a jalebi straight into the chaasni (no animation). */
function placeInPot(ctx, j) {
  const k = ctx.world.kitchen;
  const idx = ctx.state.potCount++;
  j.where = 'pot';
  j.potIndex = idx;
  j.obj.position.copy(potSlot(k, idx));
  j.obj.visible = idx < POT_VISIBLE;
  setStage(j, 'syrup');
}

/** Make sure there are jalebis where a step expects them. */
function ensureJalebis(ctx, where) {
  const k = ctx.world.kitchen;
  const st = ctx.state;
  if (!st.jalebis.length && !st.inTokri) {
    const slots = kadhaiSlots(k);
    for (let i = 0; i < DEFAULT_COUNT; i++) {
      const j = newJalebi(ctx, slots[i], 'fried');
      j.where = 'kadhai';
    }
  }
  if (where === 'pot') jalebisIn(ctx, 'kadhai').forEach((j) => placeInPot(ctx, j));
}

function ensureSyrup(ctx) {
  const { pot } = ctx.world.kitchen;
  const liquid = pot.userData.parts.liquid;
  liquid.visible = true;
  liquid.position.y = pot.userData.liquidTop;
  liquid.scale.setScalar(1);
  liquid.material.color.set(COLORS.syrupKesar);
}

function ensureTokri(ctx) {
  const k = ctx.world.kitchen;
  if (!ctx.state.pile) {
    const pile = jalebiPile(80, 0.34, (k.tokri.userData.surfaceY ?? 0.03) + 0.05);
    k.tokri.add(pile);
    ctx.state.pile = pile;
  }
  return ctx.state.pile;
}

/** One more jalebi lands in the tokri. */
function addToTokri(ctx, j) {
  const pile = ensureTokri(ctx);
  ctx.state.inTokri++;
  pile.userData.reveal(pile.userData.shown + 1);
  if (j) {
    j.where = 'tokri';
    j.obj.removeFromParent();
    j.material.dispose();
    ctx.state.jalebis = ctx.state.jalebis.filter((x) => x !== j);
  }
}

/** For steps after the tokri is filled: every jalebi made is in it. */
function ensureTokriFilled(ctx) {
  const k = ctx.world.kitchen;
  k.tokri.visible = true;
  ensureTokri(ctx);
  [...ctx.state.jalebis].forEach((j) => addToTokri(ctx, j));
  ctx.state.potCount = 0;
  while (ctx.state.inTokri < DEFAULT_COUNT) addToTokri(ctx, null);
}

/** Height of the heap inside the tokri, in the tokri's own units. */
const tokriTop = (ctx) => ensureTokri(ctx).userData.top();

/** Hold something in front of the camera, as if in the halwai's hands. */
function hold(ctx, obj, { x = 0, y = -0.47, z = -1.4, tilt = 0.55, scale = null } = {}) {
  ctx.camera.add(obj);
  obj.position.set(x, y, z);
  obj.rotation.set(tilt, 0, 0);
  if (scale !== null) obj.scale.setScalar(scale);
  obj.visible = true;
}

/** Hand a held object over to `parent` and glide it to a spot there. */
async function setDown(ctx, obj, parent, localPos, { height = 0.5, dur = 0.8, scale = null } = {}) {
  parent.attach(obj);
  ctx.audio.whoosh();
  const jobs = [arcTo(obj, localPos, height, dur), slerpTo(obj, IDENTITY, dur)];
  if (scale !== null) jobs.push(scaleTo(obj, scale, dur, ease.inOut));
  await Promise.all(jobs);
}

// ---------------------------------------------------------------------------
// 1. Ghol (batter)
// ---------------------------------------------------------------------------

async function batter(ctx) {
  const k = ctx.world.kitchen;
  await ctx.goto('kitchen', 'prep');
  ctx.say('batter');
  const b = worldPos(k.bowl);
  const { fillTop } = k.bowl.userData;
  const disc = k.bowl.userData.parts.batter;
  const target = V3(b.x, b.y + 0.1, b.z);
  let level = 0;
  const add = (color) => {
    level++;
    const y = 0.07 + (fillTop - 0.07) * (level / 3);
    lerpColor(disc.material, color, 0.6);
    raiseLiquid(disc, y, [0.82, 0.93, 0.99][level - 1] ?? 0.99);
    ctx.audio.plop();
  };
  await tapAll(ctx, [
    { obj: k.maida, radius: 0.28, onTap: () => pourInto(ctx, k.maida, target, 0xfff8e7, { onStream: () => add(0xfffaf0) }) },
    { obj: k.dahi, radius: 0.28, onTap: () => pourInto(ctx, k.dahi, target, 0xffffff, { onStream: () => add(0xfffdf5) }) },
    {
      obj: k.paani,
      radius: 0.3,
      offset: V3(0, 0.2, 0),
      onTap: () => pourInto(ctx, k.paani, target, 0x9ad7ee, { part: 'water', onStream: () => add(0xfff6dc) }),
    },
  ]);

  ctx.say('stir');
  const center = V3(b.x, b.y + fillTop + 0.01, b.z);
  const swirl = makeSwirl(0.42);
  swirl.position.copy(center).setY(center.y + 0.004);
  k.group.add(swirl);
  k.spoon.position.copy(center);
  await popIn(ctx, k.spoon);
  await stir(ctx, {
    center,
    radius: 0.42,
    spoon: k.spoon,
    swirl,
    onProgress: (p) => disc.material.color.lerpColors(_c.set(0xfff6dc), new THREE.Color(COLORS.batterRaw), p),
  });
  await popOut(k.spoon);
  tween(0.5, (t) => (swirl.material.opacity = 0.6 * (1 - t))).then(() => k.group.remove(swirl));

  // The batter goes into the piping cloth, ready for the kadhai.
  k.bag.position.set(b.x, b.y + 0.55, b.z);
  await popIn(ctx, k.bag);
  ctx.audio.pour();
  await Promise.all([raiseLiquid(disc, 0.08, 0.6, 0.8), tween(0.8, (t) => (k.bag.position.y = b.y + 0.55 - Math.sin(t * Math.PI) * 0.2))]);
  await cheer(ctx, center.clone().setY(center.y + 0.5));
  await popOut(k.bag);
}

// ---------------------------------------------------------------------------
// 2. Chaasni (sugar syrup)
// ---------------------------------------------------------------------------

async function chaasni(ctx) {
  const k = ctx.world.kitchen;
  await ctx.goto('kitchen', 'chaasni');
  await Promise.all([popIn(ctx, k.sugar), popIn(ctx, k.paani2)]);
  ctx.say('chaasni');
  const p = worldPos(k.pot);
  const liquid = k.pot.userData.parts.liquid;
  const top = k.pot.userData.liquidTop;
  const target = V3(p.x, p.y + 0.2, p.z);
  let level = 0;
  const add = () => {
    level++;
    raiseLiquid(liquid, 0.14 + (top - 0.14) * (level / 2), 1);
    ctx.audio.plop();
  };
  await tapAll(ctx, [
    { obj: k.sugar, radius: 0.3, onTap: () => pourInto(ctx, k.sugar, target, 0xffffff, { onStream: add }) },
    {
      obj: k.paani2,
      radius: 0.3,
      offset: V3(0, 0.2, 0),
      onTap: () => pourInto(ctx, k.paani2, target, 0x9ad7ee, { part: 'water', onStream: add }),
    },
  ]);

  // light the chulha
  k.chulhaA.userData.setFire(true);
  ctx.audio.whoosh();
  await wait(0.4);

  ctx.say('stir');
  const center = potSurface(k);
  const swirl = makeSwirl(0.44);
  swirl.position.copy(center).setY(center.y + 0.004);
  k.group.add(swirl);
  k.spoon.position.copy(center);
  await popIn(ctx, k.spoon);
  ctx.audio.bubbling(true);
  const stopBubbles = ctx.fx.bubbles(center, 0.42, 0xffffff, 6);
  await stir(ctx, {
    center,
    radius: 0.44,
    spoon: k.spoon,
    swirl,
    onProgress: (q) => liquid.material.color.lerpColors(_c.set(COLORS.syrupClear), new THREE.Color(0xffe2a0), q),
  });
  await popOut(k.spoon);
  tween(0.5, (t) => (swirl.material.opacity = 0.6 * (1 - t))).then(() => k.group.remove(swirl));
  ctx.state.potFx = [stopBubbles, ctx.fx.steam(center.clone().setY(center.y + 0.05), 0.35, 4)];
  await cheer(ctx, center.clone().setY(center.y + 0.5));
}

function startPotFx(ctx) {
  if (ctx.state.potFx) return;
  const k = ctx.world.kitchen;
  const center = potSurface(k);
  k.chulhaA.userData.setFire(true);
  ctx.audio.bubbling(true);
  ctx.state.potFx = [ctx.fx.bubbles(center, 0.42, 0xffffff, 6), ctx.fx.steam(center.clone().setY(center.y + 0.05), 0.35, 4)];
}

function stopPotFx(ctx) {
  if (ctx.state.potFx) ctx.state.potFx.forEach((s) => s());
  ctx.state.potFx = null;
  ctx.audio.bubbling(false);
  ctx.world.kitchen.chulhaA.userData.setFire(false);
}

// ---------------------------------------------------------------------------
// 3. Kesar   4. Elaichi
// ---------------------------------------------------------------------------

async function kesar(ctx) {
  const k = ctx.world.kitchen;
  ensureSyrup(ctx);
  k.pot.userData.parts.liquid.material.color.set(0xffe2a0);
  k.sugar.visible = false;
  k.paani2.visible = false;
  startPotFx(ctx);
  await ctx.goto('kitchen', 'chaasni');
  ctx.say('kesar');
  const center = potSurface(k);
  const liquid = k.pot.userData.parts.liquid;
  await popIn(ctx, k.kesar);
  const from = new THREE.Color(0xffe2a0);
  const to = new THREE.Color(COLORS.syrupKesar);
  await tapTimes(
    ctx,
    k.kesar,
    3,
    async (i) => {
      const src = worldPos(k.kesar).add(V3(0, 0.2, 0));
      ctx.audio.sparkle();
      ctx.fx.pour(src, center, COLORS.kesar, { n: 8, dur: 0.25, size: 0.014 });
      await wait(0.45);
      ctx.fx.splash(center, COLORS.kesar, 5);
      const a = liquid.material.color.clone();
      const b = from.clone().lerp(to, (i + 1) / 3);
      await tween(0.6, (t) => liquid.material.color.lerpColors(a, b, t));
    },
    { radius: 0.3 },
  );
  await popOut(k.kesar);
  await cheer(ctx, center.clone().setY(center.y + 0.5));
}

async function elaichi(ctx) {
  const k = ctx.world.kitchen;
  ensureSyrup(ctx);
  k.sugar.visible = false;
  k.paani2.visible = false;
  startPotFx(ctx);
  await ctx.goto('kitchen', 'chaasni');
  ctx.say('elaichi');
  const center = potSurface(k);
  await popIn(ctx, k.thali);
  await Promise.all(k.pods.map((p) => popIn(ctx, p, 0.3)));
  await tapAll(
    ctx,
    k.pods.map((pod) => ({
      obj: pod,
      radius: 0.14,
      onTap: async () => {
        tween(0.6, (t) => (pod.rotation.x = t * 9), ease.linear);
        await arcTo(pod, center, 0.9, 0.6);
        ctx.audio.plop();
        ctx.fx.splash(center, COLORS.syrupKesar, 7);
        pod.visible = false;
        // the fragrance rises
        for (let i = 0; i < 4; i++) ctx.fx.puff(center.clone().add(V3((Math.random() - 0.5) * 0.3, 0.1, 0)), 0xd8f3b0, 0.22, 1.5);
      },
    })),
  );
  await popOut(k.thali);
  await cheer(ctx, center.clone().setY(center.y + 0.5));
}

// ---------------------------------------------------------------------------
// 5. Jalebi talna (pipe and fry)
// ---------------------------------------------------------------------------

/** Pipe a jalebi into place: the spiral draws itself as the bag goes round. */
async function pipeIn(ctx, j, bag, dur = 0.9) {
  const shared = j.obj.geometry;
  const geo = shared.clone();
  j.obj.geometry = geo;
  const total = geo.index.count;
  const path = geo.parameters.path;
  geo.setDrawRange(0, 0);
  const tip = new THREE.Vector3();
  await tween(
    dur,
    (k) => {
      geo.setDrawRange(0, Math.floor((k * total) / 3) * 3);
      path.getPoint(Math.min(1, k), tip);
      tip.y += 0.06;
      j.obj.localToWorld(tip);
      bag.parent.worldToLocal(tip);
      bag.position.copy(tip);
    },
    ease.linear,
  );
  j.obj.geometry = shared;
  geo.dispose();
}

/** A fried jalebi hops from the kadhai into the chaasni. */
async function dipIntoPot(ctx, j) {
  const k = ctx.world.kitchen;
  const idx = ctx.state.potCount++;
  j.where = 'pot';
  j.potIndex = idx;
  const slot = potSlot(k, idx);
  ctx.audio.whoosh();
  tween(0.75, (t) => (j.obj.rotation.y += 0.15), ease.linear);
  await arcTo(j.obj, slot, 1.0, 0.75);
  ctx.audio.plop();
  ctx.fx.splash(slot, COLORS.syrupKesar, 9);
  j.material.roughness = 0.16;
  j.material.metalness = 0.15;
  await Promise.all([
    lerpColor(j.material, COLORS.jalebiSyrup, 0.8),
    tween(0.8, (t) => (j.obj.position.y = slot.y - Math.sin(t * Math.PI) * 0.03)),
  ]);
  if (idx >= POT_VISIBLE) j.obj.visible = false; // sinks under the others
}

async function fry(ctx) {
  const k = ctx.world.kitchen;
  const st = ctx.state;
  await ctx.goto('kitchen', 'kadhai');
  k.chulhaB.userData.setFire(true);
  ctx.audio.whoosh();
  ctx.audio.sizzle(true);
  const { center, R } = kadhaiSurface(k);
  const y = center.y;
  const stopBubbles = ctx.fx.bubbles(center, R, 0xfff7c2, 9);
  k.bag.position.set(center.x, y + 0.06, center.z);
  k.bag.rotation.set(0, 0, 0);
  await popIn(ctx, k.bag);
  ctx.say('fry');

  // Start afresh in the kadhai if this step is replayed.
  jalebisIn(ctx, 'kadhai').forEach((j) => {
    j.obj.removeFromParent();
    st.jalebis = st.jalebis.filter((x) => x !== j);
  });

  const slots = kadhaiSlots(k);
  const occupant = slots.map(() => null);
  const frying = new Set();
  let fried = 0;
  let ready = false;
  let finished = false;
  let finishFry;
  const allDone = new Promise((r) => (finishFry = r));

  const freeSlotNear = (p) => {
    let best = -1;
    let bestD = Infinity;
    slots.forEach((s, i) => {
      if (occupant[i]) return;
      const d = s.distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  // The kadhai is full: the oldest fried jalebi goes into the chaasni.
  const makeRoom = () => {
    let best = -1;
    occupant.forEach((j, i) => {
      if (j && j.fried && (best < 0 || j.born < occupant[best].born)) best = i;
    });
    if (best < 0) return -1;
    const j = occupant[best];
    occupant[best] = null;
    dipIntoPot(ctx, j);
    return best;
  };

  const spiralHint = () => {
    const i = freeSlotNear(center);
    const c = slots[i < 0 ? 0 : i];
    const pts = [];
    for (let n = 0; n <= 26; n++) {
      const t = n / 26;
      const a = t * Math.PI * 4.6;
      const r = 0.02 + 0.1 * t;
      pts.push(V3(c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r));
    }
    ctx.hint.set({ type: 'path', points: pts }, 1.8);
  };

  // When a few are done, the child may move on whenever they like by
  // touching the chaasni; until then (and after) every touch in the ghee
  // makes another jalebi.
  let stopPotRing = null;
  const offerNext = () => {
    ready = true;
    ctx.say('fryMore');
    const potAt = () => worldPos(k.pot).add(V3(0, 0.35, 0));
    stopPotRing = ctx.fx.attention(potAt, 0.4);
    ctx.hint.set({ type: 'tap', at: potAt }, 3.5);
    ctx.input.addTarget(
      k.pot,
      async () => {
        if (finished) return;
        finished = true;
        ctx.input.removeTarget(k.pot);
        ctx.input.onDrag = null;
        stopPotRing();
        ctx.hint.clear();
        boing(k.pot, 0.12);
        await Promise.all([...frying]);
        finishFry();
      },
      { radius: 0.5, offset: V3(0, 0.3, 0) },
    );
  };

  const makeOne = (p) => {
    let i = freeSlotNear(p);
    if (i < 0) i = makeRoom();
    if (i < 0) return; // every place is still frying; the next touch will do
    const j = newJalebi(ctx, slots[i], 'raw');
    j.where = 'kadhai';
    occupant[i] = j;
    const job = (async () => {
      await pipeIn(ctx, j, k.bag);
      ctx.audio.plop();
      const stop = ctx.fx.bubbles(worldPos(j.obj), 0.13, 0xffffff, 16);
      await lerpColor(j.material, COLORS.jalebiFried, 1.6);
      stop();
      j.material.roughness = 0.4;
      j.fried = true;
      ctx.fx.stars(worldPos(j.obj).add(V3(0, 0.15, 0)), 6);
      ctx.audio.sparkle();
      fried++;
      if (fried >= 3 && !ready) offerNext();
      else if (!ready) spiralHint();
    })();
    frying.add(job);
    job.then(() => frying.delete(job));
  };

  ctx.input.onDrag = (ev) => {
    ctx.hint.nudge();
    if (ev.phase !== 'start') return;
    const hit = ctx.input.pointOnPlane(ev.x, ev.y, y);
    if (!hit || Math.hypot(hit.x - center.x, hit.z - center.z) > R * 1.3) return;
    makeOne(hit);
  };
  const stopAttn = ctx.fx.attention(() => center, R * 0.9);
  spiralHint();

  await allDone;
  stopAttn();
  stopBubbles();
  ctx.audio.sizzle(false);
  await popOut(k.bag);
  await cheer(ctx, center.clone().setY(y + 0.45));
}

// ---------------------------------------------------------------------------
// 6. Chaasni mein dubao
// ---------------------------------------------------------------------------

async function dip(ctx) {
  const k = ctx.world.kitchen;
  ensureJalebis(ctx, 'kadhai');
  ensureSyrup(ctx);
  startPotFx(ctx);
  k.chulhaB.userData.setFire(true);
  k.sugar.visible = k.paani2.visible = false;
  await ctx.goto('kitchen', 'dip');
  ctx.say('dip');
  await tapAll(
    ctx,
    jalebisIn(ctx, 'kadhai').map((j) => ({ obj: j.obj, radius: 0.16, onTap: () => dipIntoPot(ctx, j) })),
  );
  k.chulhaB.userData.setFire(false);
  await cheer(ctx, potSurface(k).setY(potSurface(k).y + 0.5));
}

// ---------------------------------------------------------------------------
// 7. Tokri mein rakho
// ---------------------------------------------------------------------------

async function plate(ctx) {
  const k = ctx.world.kitchen;
  const st = ctx.state;
  ensureJalebis(ctx, 'pot');
  ensureSyrup(ctx);
  startPotFx(ctx);
  k.sugar.visible = k.paani2.visible = false;
  await ctx.goto('kitchen', 'plate');
  ensureTokri(ctx);
  await popIn(ctx, k.tokri);
  ctx.say('plate');

  // Each touch on the chaasni (or the tokri) scoops a few jalebis across,
  // top of the heap first, until the chaasni is empty.
  await new Promise((resolve) => {
    let flying = 0;
    let done = false;
    const potAt = () => worldPos(k.pot).add(V3(0, 0.35, 0));
    const stopRing = ctx.fx.attention(potAt, 0.4);
    const finish = () => {
      if (done || flying || jalebisIn(ctx, 'pot').length) return;
      done = true;
      stopRing();
      ctx.input.removeTarget(k.pot);
      ctx.input.removeTarget(k.tokri);
      ctx.hint.clear();
      st.potCount = 0;
      resolve();
    };
    const scoop = () => {
      ctx.hint.nudge();
      const batch = jalebisIn(ctx, 'pot')
        .sort((a, b) => b.potIndex - a.potIndex)
        .slice(0, 4);
      if (!batch.length) return;
      ctx.audio.whoosh();
      batch.forEach((j, i) => {
        j.where = 'flying';
        flying++;
        (async () => {
          await wait(i * 0.1);
          j.obj.visible = true;
          ctx.fx.splash(worldPos(j.obj), COLORS.syrupKesar, 4);
          const to = worldPos(k.tokri).add(V3((Math.random() - 0.5) * 0.25, 0.12, (Math.random() - 0.5) * 0.25));
          k.group.worldToLocal(to);
          tween(0.6, () => (j.obj.rotation.y += 0.15), ease.linear);
          await arcTo(j.obj, to, 0.9, 0.6);
          addToTokri(ctx, j);
          boing(k.tokri, 0.06);
          ctx.audio.tap();
          flying--;
          finish();
        })();
      });
    };
    ctx.input.addTarget(k.pot, scoop, { radius: 0.5, offset: V3(0, 0.3, 0) });
    ctx.input.addTarget(k.tokri, scoop, { radius: 0.45, offset: V3(0, 0.1, 0) });
    ctx.hint.set({ type: 'tap', at: potAt });
    finish();
  });
  stopPotFx(ctx);
  await cheer(ctx, worldPos(k.tokri).add(V3(0, 0.6, 0)));
}

// ---------------------------------------------------------------------------
// 8. Shreenathji ko bhog dharo
// ---------------------------------------------------------------------------

// Things carried "in the hands" sit low in the view and are shown a little
// smaller than life so they never hide what they are being carried to.
const HELD = { x: 0, y: -0.47, z: -1.4, tilt: 0.55 };
const HELD_SCALE = 0.5;

function chowkiSpot(m, dx = 0) {
  return V3(m.chowki.position.x + dx, m.chowki.position.y + m.chowki.userData.surfaceY, m.chowki.position.z);
}

function ringGhanta(ctx) {
  const g = ctx.world.mandir.ghanta;
  ctx.audio.bell();
  return tween(1.6, (t) => (g.rotation.z = Math.sin(t * Math.PI * 5) * 0.45 * (1 - t)), ease.linear);
}

function enterMandir(ctx, { curtain }) {
  const m = ctx.world.mandir;
  m.setCurtain(m.curtainL, curtain);
  m.setCurtain(m.curtainR, curtain);
  // the temple bell can always be rung, just for the joy of it
  ctx.input.addTarget(m.ghanta, () => ringGhanta(ctx), { radius: 0.3, offset: V3(0, -0.7, 0) });
}

async function bhog(ctx) {
  const k = ctx.world.kitchen;
  const m = ctx.world.mandir;
  ensureTokriFilled(ctx);
  stopPotFx(ctx);
  ctx.audio.stopSong();
  await ctx.goto('mandir', 'mandir', () => {
    hold(ctx, k.tokri, { ...HELD, y: -0.5, scale: HELD_SCALE });
    m.jhari.visible = false;
    m.tulsi.visible = false;
    m.kirtanSet.forEach((o) => (o.visible = false));
  });
  enterMandir(ctx, { curtain: 0 });
  ringGhanta(ctx);
  ctx.say('bhog');

  // the tokri of jalebi
  const spot = chowkiSpot(m, -0.12);
  await new Promise((resolve) => {
    let done = false;
    const go = async () => {
      if (done) return;
      done = true;
      ctx.input.removeTarget(k.tokri);
      ctx.input.removeTarget(m.chowki);
      stopA();
      ctx.hint.clear();
      ctx.audio.pop();
      await setDown(ctx, k.tokri, m.group, spot, { height: 0.35, dur: 1.0, scale: TOKRI_ON_CHOWKI });
      resolve();
    };
    // Touching the tokri, or the chowki it is going to, both work.
    const stopA = ctx.fx.attention(() => worldPos(k.tokri), 0.2);
    ctx.input.addTarget(k.tokri, go, { radius: 0.4 });
    ctx.input.addTarget(m.chowki, go, { radius: 0.5, offset: V3(0, 0.25, 0) });
    ctx.hint.set({ type: 'swipe', from: () => worldPos(k.tokri), to: () => worldPos(m.chowki).add(V3(0, 0.3, 0)) });
  });
  ctx.audio.sparkle();

  // tulsi on the bhog
  ctx.say('tulsi');
  hold(ctx, m.tulsi, { x: 0, y: -0.33, z: -1.05, tilt: 0.9, scale: 2.6 });
  await tapAll(ctx, [
    {
      obj: m.tulsi,
      radius: 0.2,
      // the tulsi rests on top of the jalebis, and stays with them
      onTap: () =>
        setDown(ctx, m.tulsi, k.tokri, V3(0, tokriTop(ctx) + 0.01, 0), {
          height: 0.3,
          dur: 0.9,
          scale: 1.8 / TOKRI_ON_CHOWKI,
        }),
    },
  ]);
  ctx.audio.sparkle();

  // jhari of water alongside
  ctx.say('jhari');
  hold(ctx, m.jhari, { x: 0, y: -0.47, z: -1.25, tilt: 0.15, scale: 0.85 });
  await tapAll(ctx, [
    {
      obj: m.jhari,
      radius: 0.25,
      offset: V3(0, 0.15, 0),
      onTap: () => setDown(ctx, m.jhari, m.group, chowkiSpot(m, 0.43), { height: 0.3, dur: 0.9, scale: 1.25 }),
    },
  ]);
  ringGhanta(ctx);
  await cheer(ctx, worldPos(m.chowki).add(V3(0, 0.9, 0.3)));
  ctx.state.offered = true;
}

/** If we arrive at a later mandir step directly, lay the offering out. */
function ensureOffered(ctx) {
  const k = ctx.world.kitchen;
  const m = ctx.world.mandir;
  ensureTokriFilled(ctx);
  if (ctx.state.offered) return;
  m.group.add(k.tokri);
  k.tokri.position.copy(chowkiSpot(m, -0.12));
  k.tokri.rotation.set(0, 0, 0);
  k.tokri.scale.setScalar(TOKRI_ON_CHOWKI);
  k.tokri.visible = true;
  k.tokri.add(m.tulsi);
  m.tulsi.position.set(0, tokriTop(ctx) + 0.01, 0);
  m.tulsi.rotation.set(0, 0, 0);
  m.tulsi.scale.setScalar(1.8 / TOKRI_ON_CHOWKI);
  m.tulsi.visible = true;
  m.group.add(m.jhari);
  m.jhari.position.copy(chowkiSpot(m, 0.43));
  m.jhari.scale.setScalar(1.25);
  m.jhari.visible = true;
  ctx.state.offered = true;
}

// ---------------------------------------------------------------------------
// 9 & 11. Parda
// ---------------------------------------------------------------------------

/** Close (to = 1) or open (to = 0) both curtain halves by tapping or swiping. */
function curtains(ctx, to) {
  const m = ctx.world.mandir;
  const halves = [m.curtainL, m.curtainR];
  const start = 1 - to;
  return new Promise((resolve) => {
    let finished = false;
    let drag = 0;
    const centre = (h) => {
      // middle of the cloth as it currently hangs
      const p = worldPos(h);
      const w = 1.95 * (0.22 + 0.78 * h.userData.k);
      p.x -= h.userData.side * w * 0.5;
      p.y += 1.55;
      return p;
    };
    const isDone = (h) => Math.abs(h.userData.k - to) < 0.01;
    const settle = (h) => {
      if (!isDone(h) || !h.userData.stop) return;
      h.userData.stop();
      h.userData.stop = null;
      ctx.input.removeTarget(h);
    };
    const check = () => {
      halves.forEach(settle);
      if (finished || !halves.every(isDone)) return;
      finished = true;
      ctx.input.onDrag = null;
      ctx.hint.clear();
      resolve();
    };
    const run = (h) => {
      if (h.userData.busy || isDone(h)) return;
      h.userData.busy = true;
      ctx.audio.whoosh();
      const from = h.userData.k;
      tween(0.9 * Math.abs(to - from) + 0.1, (t) => m.setCurtain(h, from + (to - from) * t)).then(() => {
        h.userData.busy = false;
        check();
      });
    };
    for (const h of halves) {
      h.userData.busy = false;
      m.setCurtain(h, start);
      h.userData.stop = ctx.fx.attention(() => centre(h), 0.45);
      ctx.input.addTarget(h, () => run(h), { radius: 0.6, offset: V3(-h.userData.side * (to ? 0.25 : 0.95), 1.55, 0) });
    }
    ctx.input.onDrag = (ev) => {
      ctx.hint.nudge();
      if (ev.phase !== 'move') return;
      drag += Math.abs(ev.dx) / (window.innerWidth * 0.3);
      const k = Math.min(1, drag);
      for (const h of halves) {
        if (h.userData.busy) continue;
        const want = start + (to - start) * k;
        if (Math.abs(want - start) > Math.abs(h.userData.k - start)) m.setCurtain(h, want);
      }
      if (k >= 1) check();
    };
    // The hand shows the half that still has to move: pull it toward the
    // middle to close, or out to its own side to open.
    const next = () => halves.find((h) => !isDone(h)) || halves[0];
    ctx.hint.set({
      type: 'swipe',
      from: () => centre(next()),
      to: () => {
        const h = next();
        const p = centre(h);
        p.x += (to ? -1 : 1) * h.userData.side * 0.9;
        return p;
      },
    });
  });
}

async function pardaClose(ctx) {
  ensureOffered(ctx);
  await ctx.goto('mandir', 'mandir');
  enterMandir(ctx, { curtain: 0 });
  ctx.say('pardaClose');
  await curtains(ctx, 1);
  ctx.audio.ghanti();
  await cheer(ctx, V3(AREAS.mandir.x, 1.9, -0.6));
}

// ---------------------------------------------------------------------------
// 10. Kirtan
// ---------------------------------------------------------------------------

async function kirtan(ctx) {
  const m = ctx.world.mandir;
  ensureOffered(ctx);
  await ctx.goto('mandir', 'kirtan');
  enterMandir(ctx, { curtain: 1 });
  for (const o of m.kirtanSet) await popIn(ctx, o, 0.25);
  ctx.say('kirtan');
  await wait(0.6);
  ctx.audio.playSong('kirtan');

  let taps = 0;
  let time = 0;
  let beat = 0;
  const { a, b } = m.jhanjh.userData.parts || {};
  const instruments = [
    {
      obj: m.pakhawaj,
      radius: 0.42,
      offset: V3(0, 0.3, 0),
      play: () => {
        ctx.audio.drum(beat++ % 2 ? 'na' : 'dha');
        boing(m.pakhawaj, 0.18);
      },
    },
    {
      obj: m.jhanjh,
      radius: 0.38,
      offset: V3(0, 0.08, 0),
      play: () => {
        ctx.audio.manjira(0, 0.22);
        boing(m.jhanjh, 0.2);
        if (a && b) {
          tween(0.25, (t) => {
            const s = Math.sin(t * Math.PI);
            a.position.x = -0.13 + s * 0.09;
            b.position.x = 0.13 - s * 0.09;
          });
        }
      },
    },
    {
      obj: m.ghanti,
      radius: 0.36,
      offset: V3(0, 0.3, 0),
      play: () => {
        ctx.audio.ghanti();
        tween(0.6, (t) => (m.ghanti.rotation.z = Math.sin(t * Math.PI * 4) * 0.35 * (1 - t)), ease.linear);
      },
    },
  ];
  const stops = instruments.map((it) => ctx.fx.attention(() => worldPos(it.obj).add(it.offset), it.radius * 0.8));
  let idx = 0;
  ctx.hint.set({ type: 'tap', at: () => worldPos(instruments[idx % 3].obj).add(instruments[idx % 3].offset) }, 1.5);
  ctx.hud.meter(0);

  await new Promise((resolve) => {
    let finished = false;
    const update = () => {
      const p = Math.min(1, taps / 12 + time / 22);
      ctx.hud.meter(p);
      if (p >= 1 && !finished) {
        finished = true;
        off();
        resolve();
      }
    };
    const off = onFrame((dt) => {
      time += dt;
      update();
    });
    for (const it of instruments) {
      ctx.input.addTarget(
        it.obj,
        () => {
          it.play();
          ctx.fx.notes(worldPos(it.obj).add(V3(0, 0.5, 0)), 2);
          taps++;
          idx++;
          ctx.hint.nudge();
          update();
        },
        { radius: it.radius, offset: it.offset },
      );
    }
  });
  stops.forEach((s) => s());
  ctx.hint.clear();
  ctx.hud.meter(null);
  await cheer(ctx, V3(AREAS.mandir.x, 1.2, 1.0));
}

// ---------------------------------------------------------------------------
// 11. Parda kholo – darshan
// ---------------------------------------------------------------------------

async function pardaOpen(ctx) {
  const m = ctx.world.mandir;
  ensureOffered(ctx);
  m.kirtanSet.forEach((o) => (o.visible = true));
  if (!ctx.audio.song) ctx.audio.playSong('kirtan');
  await ctx.goto('mandir', 'mandir');
  enterMandir(ctx, { curtain: 1 });
  ctx.say('pardaOpen');
  await curtains(ctx, 0);
  ctx.audio.shankh();
  ringGhanta(ctx);
  const dp = worldPos(m.deity).add(V3(0, 1.3, 0.6));
  const stopPetals = ctx.fx.petals(V3(AREAS.mandir.x, 0.4, -2.0), 3.4, 16, 3.3);
  // During darshan a touch sends up hearts.
  ctx.input.addTarget(
    m.deity,
    () => {
      ctx.fx.hearts(dp, 4);
      ctx.audio.sparkle();
    },
    { radius: 1.1, offset: V3(0, 1.1, 0) },
  );
  await ctx.cam.go('darshan', 2.2);
  ctx.say('jai');
  ctx.fx.hearts(dp, 6);
  await wait(3.2);
  stopPetals();
  await cheer(ctx, dp);
}

// ---------------------------------------------------------------------------
// 12. Bhog sarao
// ---------------------------------------------------------------------------

async function sarao(ctx) {
  const k = ctx.world.kitchen;
  const m = ctx.world.mandir;
  ensureOffered(ctx);
  await ctx.goto('mandir', 'mandir');
  enterMandir(ctx, { curtain: 0 });
  ctx.say('sarao');
  await tapAll(ctx, [
    {
      obj: k.tokri,
      radius: 0.42,
      offset: V3(0, 0.1, 0),
      onTap: async () => {
        ctx.camera.attach(k.tokri); // the tulsi rides along on the prasad
        ctx.audio.whoosh();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(HELD.tilt, 0, 0));
        await Promise.all([
          arcTo(k.tokri, V3(HELD.x, -0.5, HELD.z), 0.25, 0.9),
          slerpTo(k.tokri, q, 0.9),
          scaleTo(k.tokri, HELD_SCALE, 0.9, ease.inOut),
        ]);
      },
    },
    { obj: m.jhari, radius: 0.25, offset: V3(0, 0.2, 0), onTap: () => popOut(m.jhari) },
  ]);
  ctx.audio.stopSong();
  await cheer(ctx, worldPos(k.tokri).add(V3(0, 0.5, 0)));
}

// ---------------------------------------------------------------------------
// 13. Vaishnavo ko paatal paroso
// ---------------------------------------------------------------------------

function ensurePangat(ctx) {
  const pg = ctx.world.pangat;
  const st = ctx.state;
  if (!st.served) st.served = pg.people.map(() => ({ paatal: null, jalebis: [] }));
  return st.served;
}

function layPaatal(ctx, i) {
  const pg = ctx.world.pangat;
  const p = make('paatal');
  pg.group.add(p);
  p.position.copy(pg.seats[i]).sub(AREAS.pangat);
  ctx.state.served[i].paatal = p;
  return p;
}

function putJalebi(ctx, i, n) {
  const pg = ctx.world.pangat;
  const s = ctx.state.served[i];
  const m = new THREE.Mesh(jalebiGeometry(n, 'hi'), sharedJalebiMaterial());
  m.castShadow = true;
  pg.group.add(m);
  m.position.copy(s.paatal.position).add(V3(n ? 0.14 : -0.14, 0.03, n ? 0.05 : -0.03));
  s.jalebis.push(m);
  return m;
}

async function serve(ctx) {
  const k = ctx.world.kitchen;
  const pg = ctx.world.pangat;
  ensureTokriFilled(ctx);
  const served = ensurePangat(ctx);
  ctx.audio.stopSong();

  const stack = new THREE.Group();
  const stackItems = pg.people.map((_, i) => {
    const p = make('paatal');
    p.position.y = i * 0.022;
    stack.add(p);
    return p;
  });
  await ctx.goto('pangat', 'serve', () => {
    k.tokri.visible = false;
    hold(ctx, stack, { ...HELD, scale: 0.58 });
  });
  ctx.audio.playSong('kitchen');
  ctx.say('serve');

  const anchors = pg.seats.map((s) => {
    const a = new THREE.Object3D();
    a.position.copy(s);
    ctx.scene.add(a);
    return a;
  });
  await tapAll(
    ctx,
    anchors.map((a, i) => ({
      obj: a,
      radius: 0.42,
      onTap: async () => {
        const p = stackItems.pop();
        await setDown(ctx, p, pg.group, pg.seats[i].clone().sub(AREAS.pangat), { height: 0.5, dur: 0.75, scale: 1 });
        served[i].paatal = p;
        ctx.audio.tap();
        const api = pg.people[i].userData.api;
        api.namaste().then(() => wait(0.5)).then(() => api.relax());
      },
    })),
  );
  anchors.forEach((a) => ctx.scene.remove(a));
  ctx.camera.remove(stack);
  await wait(0.3);

  // now the jalebi
  ctx.say('serveJalebi');
  hold(ctx, k.tokri, { ...HELD, y: -0.5, scale: 0.55 });
  await popIn(ctx, k.tokri, 0.35);
  await tapAll(
    ctx,
    served.map((s, i) => ({
      obj: s.paatal,
      radius: 0.42,
      onTap: async () => {
        const from = worldPos(k.tokri).add(V3(0, 0.15, 0));
        const jobs = [0, 1].map(async (n) => {
          await wait(n * 0.15);
          const m = putJalebi(ctx, i, n);
          const to = m.position.clone();
          m.position.copy(from).sub(AREAS.pangat);
          tween(0.65, (t) => (m.rotation.y = t * 6.28), ease.linear);
          await arcTo(m, to, 0.9, 0.65);
          ctx.audio.tap();
        });
        ctx.audio.whoosh();
        await Promise.all(jobs);
        pg.people[i].userData.api.happy();
        ctx.fx.hearts(worldPos(pg.people[i]).add(V3(0, 1.1, 0.2)), 3);
      },
    })),
  );
  ctx.say('jsk');
  pg.people.forEach((p) => p.userData.api.namaste().then(() => wait(0.8)).then(() => p.userData.api.relax()));
  await cheer(ctx, V3(AREAS.pangat.x, 1.3, -0.5));
  await popOut(k.tokri);
  ctx.camera.remove(k.tokri);
}

// ---------------------------------------------------------------------------
// 14. Sab ke saath khao
// ---------------------------------------------------------------------------

async function eat(ctx) {
  const pg = ctx.world.pangat;
  const served = ensurePangat(ctx);
  served.forEach((s, i) => {
    if (!s.paatal) layPaatal(ctx, i);
    if (!s.jalebis.length) [0, 1].forEach((n) => putJalebi(ctx, i, n));
  });
  await ctx.goto('pangat', 'eat');
  if (!ctx.audio.song) ctx.audio.playSong('kitchen');

  const own = make('paatal');
  own.position.copy(pg.ownSeat).sub(AREAS.pangat);
  pg.group.add(own);
  const mine = ring(own.position, 0.2, 3, 0.03, -Math.PI / 2).map((p, i) => {
    const m = new THREE.Mesh(jalebiGeometry(i, 'hi'), jalebiMaterial('syrup'));
    m.castShadow = true;
    m.position.copy(p);
    m.visible = false;
    pg.group.add(m);
    return m;
  });
  await popIn(ctx, own);
  for (const m of mine) await popIn(ctx, m, 0.25);
  ctx.say('eat');

  await tapAll(
    ctx,
    mine.map((m) => ({
      obj: m,
      radius: 0.17,
      onTap: async () => {
        // everyone takes a bite together
        pg.people.forEach((p, i) => {
          p.userData.api.eat();
          const j = served[i].jalebis.pop();
          if (j) wait(0.5).then(() => popOut(j, 0.15));
        });
        // ...and so do we: the jalebi comes up to the mouth
        ctx.scene.attach(m);
        const mouth = ctx.camera.localToWorld(V3(0, -0.22, -0.45));
        scaleTo(m, 1.6, 0.5, ease.inOut);
        await arcTo(m, mouth, 0.15, 0.55);
        ctx.audio.crunch();
        ctx.fx.stars(ctx.camera.localToWorld(V3(0, -0.12, -0.9)), 6);
        await popOut(m, 0.15);
        await wait(0.9);
      },
    })),
  );

  // utsav!
  ctx.audio.playSong('utsav');
  ctx.say('jsk');
  const stopPetals = ctx.fx.petals(V3(AREAS.pangat.x, 0.2, -0.6), 5, 22, 3.4);
  for (let r = 0; r < 3; r++) {
    pg.people.forEach((p, i) => wait(i * 0.12).then(() => p.userData.api.happy()));
    ctx.fx.stars(V3(AREAS.pangat.x + (r - 1) * 1.6, 1.5, -0.6), 12);
    ctx.audio.yay();
    await wait(1.1);
  }
  ctx.state.stopFinale = stopPetals; // the flowers keep falling behind the end card
}

// ---------------------------------------------------------------------------

export const STEPS = [
  { id: 'batter', run: batter },
  { id: 'chaasni', run: chaasni },
  { id: 'kesar', run: kesar },
  { id: 'elaichi', run: elaichi },
  { id: 'fry', run: fry },
  { id: 'dip', run: dip },
  { id: 'plate', run: plate },
  { id: 'bhog', run: bhog },
  { id: 'pardaClose', run: pardaClose },
  { id: 'kirtan', run: kirtan },
  { id: 'pardaOpen', run: pardaOpen },
  { id: 'sarao', run: sarao },
  { id: 'serve', run: serve },
  { id: 'eat', run: eat },
];
