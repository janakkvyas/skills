import * as THREE from 'three';
import { registerModel } from '../engine/assets.js';
import { tween, ease, wait, onFrame } from '../engine/tween.js';
import { mat } from './materials.js';

// Seated Vaishnavs for the pangat. Simple, round, friendly figures with a
// tilak and a tulsi kanthi. They can fold their hands, eat and bob happily.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = V3(0, -1, 0);

const KINDS = {
  dada: { skin: 0xd9a066, top: 0xfffaf0, lap: 0xfffaf0, hair: 0xe5e5e5, scale: 1, moustache: true },
  ben: { skin: 0xe0ac7a, top: 0xd81b60, lap: 0xd81b60, hair: 0x1f1410, scale: 0.95, pallu: 0xb5124f },
  bhai: { skin: 0xc98d5a, top: 0xff8c1a, lap: 0xfffaf0, hair: 0x1f1410, scale: 1 },
  bal: { skin: 0xe6b88a, top: 0xffd60a, lap: 0xff6b35, hair: 0x1f1410, scale: 0.7, bigHead: true },
  baa: { skin: 0xd9a678, top: 0x2a9d8f, lap: 0x2a9d8f, hair: 0xdcdcdc, scale: 0.92, pallu: 0x8ecae6 },
};

function part(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

registerModel('vaishnav', (kind = 'bhai') => {
  const k = KINDS[kind] || KINDS.bhai;
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that bobs
  root.add(body);
  const skin = mat.color(k.skin, 0.75);
  const top = mat.color(k.top, 0.85);
  const lapM = mat.color(k.lap, 0.85);

  const lap = part(new THREE.SphereGeometry(1, 18, 12), lapM);
  lap.scale.set(0.44, 0.15, 0.36);
  lap.position.set(0, 0.14, 0.06);
  body.add(lap);
  for (const sx of [-1, 1]) {
    const knee = part(new THREE.SphereGeometry(0.14, 12, 10), lapM);
    knee.position.set(sx * 0.33, 0.13, 0.16);
    body.add(knee);
  }

  const torso = part(new THREE.CapsuleGeometry(0.21, 0.24, 6, 16), top);
  torso.position.y = 0.48;
  body.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.93;
  if (k.bigHead) head.scale.setScalar(1.18);
  body.add(head);
  head.add(part(new THREE.SphereGeometry(0.2, 20, 16), skin));

  const hair = part(new THREE.SphereGeometry(0.208, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), mat.color(k.hair, 0.9));
  hair.rotation.x = -0.35;
  head.add(hair);
  if (k.pallu) {
    const pallu = part(
      new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      mat.color(k.pallu, 0.85),
    );
    pallu.rotation.x = -1.0;
    pallu.position.z = -0.025;
    head.add(pallu);
    // sari drape across the body
    const drape = part(new THREE.TorusGeometry(0.2, 0.05, 8, 20, Math.PI * 1.1), mat.color(k.pallu, 0.85));
    drape.position.set(0, -0.42, 0.03);
    drape.rotation.set(0, 0, 2.2);
    drape.scale.set(1.15, 1.3, 1.05);
    head.add(drape);
  }

  const eyeM = mat.black();
  for (const sx of [-1, 1]) {
    const eye = part(new THREE.SphereGeometry(0.028, 8, 8), eyeM);
    eye.position.set(sx * 0.075, 0.02, 0.182);
    head.add(eye);
    const glint = part(new THREE.SphereGeometry(0.009, 6, 6), mat.white());
    glint.position.set(sx * 0.075 + 0.009, 0.03, 0.206);
    head.add(glint);
    const cheek = part(new THREE.SphereGeometry(0.035, 8, 6), mat.color(0xf28482, 0.9));
    cheek.scale.z = 0.3;
    cheek.position.set(sx * 0.125, -0.045, 0.15);
    head.add(cheek);
  }
  const smile = part(new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI), mat.color(0x7a1f1f, 0.6));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.05, 0.188);
  head.add(smile);
  const mouth = part(new THREE.SphereGeometry(0.04, 10, 8), mat.color(0x5a1414, 0.6));
  mouth.scale.set(1, 1, 0.4);
  mouth.position.set(0, -0.075, 0.185);
  mouth.visible = false;
  head.add(mouth);
  if (k.moustache) {
    const mo = part(new THREE.CapsuleGeometry(0.014, 0.09, 4, 8), mat.color(0xf0f0f0, 0.9));
    mo.rotation.z = Math.PI / 2;
    mo.position.set(0, -0.03, 0.2);
    head.add(mo);
  }

  // Pushtimarg tilak: two red lines joined at the bottom.
  const tilakM = mat.color(0xd00000, 0.7);
  for (const sx of [-1, 1]) {
    const bar = part(new THREE.BoxGeometry(0.009, 0.075, 0.009), tilakM);
    bar.position.set(sx * 0.015, 0.105, 0.172);
    bar.rotation.set(-0.5, 0, sx * -0.12);
    head.add(bar);
  }
  if (k.pallu) {
    const bindi = part(new THREE.SphereGeometry(0.012, 6, 6), tilakM);
    bindi.position.set(0, 0.06, 0.196);
    head.add(bindi);
  }

  const kanthi = part(new THREE.TorusGeometry(0.135, 0.013, 6, 20), mat.color(0xc9a66b, 0.8));
  kanthi.rotation.x = Math.PI / 2 - 0.25;
  kanthi.position.set(0, 0.7, 0.03);
  body.add(kanthi);

  // Arms pivot at the shoulder and point along local -Y.
  const L = 0.42;
  const arms = {};
  for (const [name, sx] of [
    ['r', -1],
    ['l', 1],
  ]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.25, 0.63, 0.02);
    const sleeve = part(new THREE.CapsuleGeometry(0.06, L - 0.14, 4, 10), top);
    sleeve.position.y = -(L - 0.02) / 2 + 0.02;
    const hand = part(new THREE.SphereGeometry(0.062, 10, 8), skin);
    hand.position.y = -L;
    arm.add(sleeve, hand);
    body.add(arm);
    const pose = (target) =>
      new THREE.Quaternion().setFromUnitVectors(DOWN, target.clone().sub(arm.position).normalize());
    arms[name] = {
      arm,
      rest: pose(V3(sx * 0.32, 0.27, 0.3)),
      mouth: pose(V3(sx * 0.02, 0.86, 0.34)),
      namaste: pose(V3(sx * 0.035, 0.52, 0.34)),
      plate: pose(V3(sx * 0.1, 0.2, 0.45)),
    };
    arm.quaternion.copy(arms[name].rest);
  }

  const ph = Math.random() * 10;
  onFrame((dt, t) => {
    if (!root.visible) return;
    body.position.y = Math.sin(t * 1.6 + ph) * 0.006;
    head.rotation.z = Math.sin(t * 0.9 + ph) * 0.04;
  });

  root.scale.setScalar(k.scale);
  root.userData.parts = { body, head, smile, mouth, arms };
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
  const { head, smile, mouth, arms } = root.userData.parts;
  return {
    async namaste() {
      await Promise.all([slerpArm(arms.r, arms.r.namaste, 0.35), slerpArm(arms.l, arms.l.namaste, 0.35)]);
      await tween(0.4, (k) => (head.rotation.x = Math.sin(Math.PI * k) * 0.3), ease.linear);
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
      await tween(0.7, (k) => (head.position.y = 0.93 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.018), ease.linear);
      head.position.y = 0.93;
      await slerpArm(arms.r, arms.r.rest, 0.3);
    },
    happy: () => hop(root, 0.1, 0.4),
  };
}
