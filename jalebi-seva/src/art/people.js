import * as THREE from 'three';
import { registerModel } from '../engine/assets.js';
import { tween, ease, wait, onFrame } from '../engine/tween.js';
import { mat } from './materials.js';
import { part, limb, skinMat, makeHead, addTilak, makeHand, drapeMat } from './figure.js';

// Seated Vaishnavs for the pangat: people of natural proportions sitting
// palthi, with modelled faces, hands, and draped clothes, a tilak and a
// tulsi kanthi. They fold their hands, eat, and rock happily.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = V3(0, -1, 0);
const HEAD_Y = 1.0;

const KINDS = {
  dada: { skin: 0xc68e5e, top: 0xfbf6ea, lap: 0xfdfaf2, hair: 0xe9e9e6, brow: 0xcfcfca, hairStyle: 'thin', scale: 1, moustache: true, glasses: true, belly: 1.12, jaw: 0.26 },
  ben: { skin: 0xd9a273, top: 0xc2185b, lap: 0xd81b60, hair: 0x1a120d, hairStyle: 'bun', scale: 0.94, saree: 0xd81b60, border: 0xf2c14e, jaw: 0.36, lip: 0xb5404a },
  bhai: { skin: 0xb97f4f, top: 0xf28c28, lap: 0xfdfaf2, hair: 0x17100c, hairStyle: 'short', scale: 1, jaw: 0.3, stubble: true },
  bal: { skin: 0xdeab7e, top: 0xf7c81e, lap: 0xf26a2e, hair: 0x17100c, hairStyle: 'short', scale: 0.68, child: true, jaw: 0.2 },
  baa: { skin: 0xcf9d72, top: 0x1f8a7d, lap: 0x2a9d8f, hair: 0xdedede, brow: 0xbdbdbd, hairStyle: 'bun', scale: 0.92, saree: 0x2a9d8f, border: 0xf2c14e, jaw: 0.3 },
};

registerModel('vaishnav', (kind = 'bhai') => {
  const k = KINDS[kind] || KINDS.bhai;
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that sways
  root.add(body);
  const skin = skinMat(k.skin);
  const top = mat.cloth(k.top);
  const lapM = drapeMat(k.lap, 3);
  const woman = !!k.saree;

  // --- legs folded in palthi, under the dhoti or saree
  for (const sx of [-1, 1]) {
    const hip = V3(sx * 0.12, 0.15, 0.0);
    const knee = V3(sx * 0.4, 0.12, 0.27);
    const ankle = V3(sx * -0.08, 0.085 + (sx > 0 ? 0.05 : 0), 0.4);
    body.add(limb(hip, knee, 0.105, lapM, 0.085), limb(knee, ankle, 0.08, lapM, 0.055));
    const foot = part(new THREE.SphereGeometry(1, 12, 10), skin);
    foot.scale.set(0.085, 0.035, 0.05);
    foot.position.copy(ankle).add(V3(sx * -0.09, -0.02, 0.02));
    foot.rotation.y = sx * 0.5;
    body.add(foot);
  }
  // the cloth sagging between the knees
  const drape = part(new THREE.SphereGeometry(1, 28, 16), lapM);
  drape.scale.set(0.4, 0.12, 0.32);
  drape.position.set(0, 0.13, 0.17);
  body.add(drape);
  const seat = part(new THREE.SphereGeometry(1, 20, 14), lapM);
  seat.scale.set(0.27, 0.16, 0.2);
  seat.position.set(0, 0.16, -0.04);
  body.add(seat);

  // --- torso: chest, belly and shoulders
  const bw = k.belly ?? 1;
  const torso = part(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0001, 0.14),
        new THREE.Vector2(0.2, 0.16),
        new THREE.Vector2(0.205 * bw, 0.3),
        new THREE.Vector2(0.185 * bw, 0.44),
        new THREE.Vector2(0.2, 0.58),
        new THREE.Vector2(0.21, 0.68),
        new THREE.Vector2(0.17, 0.77),
        new THREE.Vector2(0.075, 0.82),
        new THREE.Vector2(0.0001, 0.83),
      ],
      36,
    ),
    top,
  );
  torso.scale.z = 0.7 * (woman ? 0.95 : 1) * (bw > 1 ? 1.1 : 1);
  body.add(torso);
  for (const sx of [-1, 1]) {
    const sh = part(new THREE.SphereGeometry(woman ? 0.07 : 0.082, 16, 12), top);
    sh.position.set(sx * 0.215, 0.73, 0);
    body.add(sh);
  }
  const neck = part(new THREE.CylinderGeometry(0.058, 0.07, 0.12, 16), skin);
  neck.position.y = 0.845;
  body.add(neck);

  if (!woman) {
    // kurta: collar band, placket and buttons
    const collar = part(new THREE.TorusGeometry(0.075, 0.014, 8, 24), top, false);
    collar.rotation.x = Math.PI / 2 - 0.2;
    collar.position.set(0, 0.815, 0.005);
    const placket = part(new THREE.BoxGeometry(0.03, 0.2, 0.01), top, false);
    placket.position.set(0, 0.68, 0.14);
    placket.rotation.x = -0.12;
    body.add(collar, placket);
    for (let i = 0; i < 3; i++) {
      const btn = part(new THREE.SphereGeometry(0.009, 8, 6), mat.gold(), false);
      btn.position.set(0, 0.745 - i * 0.06, 0.148 - i * 0.004);
      body.add(btn);
    }
  } else {
    // saree: pallu across the chest, over the shoulder and the head, with a zari border
    const sareeM = drapeMat(k.saree, 4);
    const sash = part(new THREE.TorusGeometry(0.25, 0.085, 10, 28, Math.PI * 1.25), sareeM);
    sash.scale.set(1, 1.25, 0.72);
    sash.rotation.set(0.05, 0, 2.25);
    sash.position.set(0.0, 0.53, 0.015);
    body.add(sash);
  }

  // tulsi kanthi: a double string of small wooden beads
  for (const [r, y] of [
    [0.078, 0.8],
    [0.088, 0.785],
  ]) {
    const kanthi = part(new THREE.TorusGeometry(r, 0.0065, 6, 30), mat.color(0xb8925a, 0.8), false);
    kanthi.rotation.x = Math.PI / 2 - 0.35;
    kanthi.position.set(0, y, 0.02);
    body.add(kanthi);
  }

  // --- head
  const head = makeHead({
    skin: k.skin,
    hair: k.hair,
    brow: k.brow,
    hairStyle: k.hairStyle,
    size: k.child ? 0.165 : 0.15,
    jaw: k.jaw,
    child: k.child,
    cheeks: k.child ? 0.07 : 0.04,
    nose: k.child ? 0.75 : 1,
    lip: k.lip,
    width: k.child ? 0.84 : 0.78,
  });
  head.position.y = HEAD_Y;
  body.add(head);
  addTilak(head);
  const { face, frontZ } = head.userData;

  if (k.moustache) {
    for (const sx of [-1, 1]) {
      const mo = part(new THREE.SphereGeometry(1, 12, 8), mat.color(0xf2f2ee, 0.9), false);
      mo.scale.set(0.15, 0.045, 0.05);
      mo.position.set(sx * 0.12, -0.3, frontZ(0.12, -0.3) + 0.03);
      mo.rotation.z = sx * -0.25;
      face.add(mo);
    }
  }
  if (k.stubble) {
    // a neat dark moustache
    for (const sx of [-1, 1]) {
      const mo = part(new THREE.SphereGeometry(1, 12, 8), mat.color(k.hair, 0.9), false);
      mo.scale.set(0.12, 0.03, 0.04);
      mo.position.set(sx * 0.1, -0.3, frontZ(0.1, -0.3) + 0.03);
      mo.rotation.z = sx * -0.18;
      face.add(mo);
    }
  }
  if (k.glasses) {
    const gm = mat.color(0x3a2a1a, 0.4, 0.6);
    for (const sx of [-1, 1]) {
      const rim = part(new THREE.TorusGeometry(0.17, 0.014, 6, 24), gm, false);
      rim.position.set(sx * 0.31, 0.09, frontZ(0.31, 0.1) + 0.1);
      const arm = part(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 5), gm, false);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(sx * 0.55, 0.1, frontZ(0.31, 0.1) - 0.3);
      face.add(rim, arm);
    }
    const bridge = part(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), gm, false);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.11, frontZ(0, 0.1) + 0.1);
    face.add(bridge);
  }
  if (woman) {
    const bindi = part(new THREE.SphereGeometry(0.035, 10, 8), mat.color(0xc1121f, 0.4), false);
    bindi.scale.z = 0.4;
    bindi.position.set(0, 0.2, frontZ(0, 0.2) + 0.045);
    face.add(bindi);
    // the pallu drawn over the head
    const pallu = part(
      new THREE.SphereGeometry(1.14, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.6),
      drapeMat(k.saree, 5),
    );
    pallu.scale.set(0.86, 1, 0.98);
    pallu.rotation.x = -0.95;
    pallu.position.set(0, 0.0, -0.06);
    face.add(pallu);
    // earrings and a nose pin
    for (const sx of [-1, 1]) {
      const er = part(new THREE.SphereGeometry(0.045, 10, 8), mat.gold(), false);
      er.position.set(sx * 0.77, -0.24, 0.0);
      face.add(er);
    }
  }

  // --- arms: pivot at the shoulder, hang along local -Y, slightly bent
  const L = 0.47;
  const arms = {};
  const sleeveM = top;
  for (const [name, sx] of [
    ['r', -1],
    ['l', 1],
  ]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.245, 0.72, 0.01);
    const elbow = V3(0, -0.25, -0.02);
    const wrist = V3(0, -L + 0.07, 0.02);
    arm.add(limb(V3(0, 0, 0), elbow, woman ? 0.052 : 0.062, sleeveM, woman ? 0.045 : 0.052));
    arm.add(limb(elbow, wrist, woman ? 0.042 : 0.052, woman ? skin : sleeveM, woman ? 0.034 : 0.044));
    if (woman) {
      for (let i = 0; i < 3; i++) {
        const bangle = part(new THREE.TorusGeometry(0.04, 0.007, 6, 18), i === 1 ? mat.color(0xc1121f, 0.4) : mat.gold(), false);
        bangle.rotation.x = Math.PI / 2;
        bangle.position.set(0, wrist.y + 0.03 + i * 0.016, wrist.z);
        arm.add(bangle);
      }
    } else {
      const cuff = part(new THREE.TorusGeometry(0.046, 0.009, 6, 18), sleeveM, false);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.copy(wrist);
      arm.add(cuff);
    }
    const hand = makeHand(skin, 1.05, sx);
    hand.position.copy(wrist);
    hand.rotation.y = sx * -0.5;
    arm.add(hand);
    body.add(arm);
    const pose = (target) => new THREE.Quaternion().setFromUnitVectors(DOWN, target.clone().sub(arm.position).normalize());
    arms[name] = {
      arm,
      rest: pose(V3(sx * 0.37, 0.3, 0.3)),
      mouth: pose(V3(sx * 0.04, 0.9, 0.25)),
      namaste: pose(V3(sx * 0.045, 0.6, 0.33)),
      plate: pose(V3(sx * 0.12, 0.22, 0.5)),
    };
    arm.quaternion.copy(arms[name].rest);
  }

  const ph = Math.random() * 10;
  onFrame((dt, t) => {
    if (!root.visible) return;
    body.position.y = Math.sin(t * 1.6 + ph) * 0.004; // breathing
    head.rotation.z = Math.sin(t * 0.9 + ph) * 0.035;
    head.rotation.y = Math.sin(t * 0.5 + ph * 2) * 0.08;
  });

  root.scale.setScalar(k.scale);
  root.userData.parts = { body, head, smile: head.userData.smile, mouth: head.userData.mouth, arms };
  root.userData.makeApi = makeApi;
  root.userData.api = makeApi(root, false);
  return root;
});

function slerpArm(a, to, dur) {
  const from = a.arm.quaternion.clone();
  return tween(dur, (k) => a.arm.quaternion.slerpQuaternions(from, to, k), ease.inOut);
}

function hop(obj, h = 0.08, dur = 0.35) {
  const y0 = obj.position.y;
  return tween(dur, (k) => (obj.position.y = y0 + Math.sin(Math.PI * k) * h), ease.linear);
}

/** Behaviours. With a .glb override there are no limbs to move, so it bobs. */
export function makeApi(root, isOverride) {
  if (isOverride) {
    const bob = () => hop(root, 0.1, 0.4);
    return { eat: bob, namaste: bob, happy: bob, relax: async () => {} };
  }
  const { body, head, smile, mouth, arms } = root.userData.parts;
  return {
    async namaste() {
      await Promise.all([slerpArm(arms.r, arms.r.namaste, 0.35), slerpArm(arms.l, arms.l.namaste, 0.35)]);
      await tween(0.5, (k) => (head.rotation.x = Math.sin(Math.PI * k) * 0.3), ease.linear);
    },
    async relax() {
      await Promise.all([slerpArm(arms.r, arms.r.rest, 0.35), slerpArm(arms.l, arms.l.rest, 0.35)]);
    },
    async eat() {
      await slerpArm(arms.r, arms.r.plate, 0.25);
      await slerpArm(arms.r, arms.r.mouth, 0.3);
      smile.visible = false;
      mouth.visible = true;
      await wait(0.18);
      mouth.visible = false;
      smile.visible = true;
      // chew
      await tween(0.7, (k) => (head.position.y = HEAD_Y + Math.abs(Math.sin(k * Math.PI * 4)) * 0.012), ease.linear);
      head.position.y = HEAD_Y;
      await slerpArm(arms.r, arms.r.rest, 0.3);
    },
    // a happy sway, as people do when the food is good
    happy: () => tween(0.6, (k) => (body.rotation.z = Math.sin(k * Math.PI * 2) * 0.09), ease.linear),
  };
}
