import * as THREE from 'three';
import { registerModel } from '../engine/assets.js';
import { onFrame } from '../engine/tween.js';
import { mat, canvasTex, tex } from './materials.js';
import { beads, limb, MARIGOLD, MOGRA, ROSE } from './deco.js';

// A gentle, child-like placeholder for Shreenathji's swaroop, meant to be
// replaced by the family's own model (slot "shreenathji"). It keeps the
// features a child recognises: shyam colour, the raised left arm that lifts
// Giriraj, the right hand at the waist, large eyes, tilak, mor-pankh and
// garlands, standing against the dark pithika.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

function part(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
}

const featherTex = () =>
  canvasTex(64, 128, (g, w, h) => {
    g.translate(w / 2, h * 0.42);
    g.fillStyle = '#2a9d5c';
    g.beginPath();
    g.ellipse(0, 0, w * 0.42, h * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d4a017';
    g.beginPath();
    g.ellipse(0, 0, w * 0.3, h * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b6ca8';
    g.beginPath();
    g.ellipse(0, h * 0.02, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#14213d';
    g.beginPath();
    g.ellipse(0, h * 0.05, w * 0.1, h * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a9d5c';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, h * 0.38);
    g.lineTo(0, h * 0.58);
    g.stroke();
  });

registerModel('shreenathji', () => {
  const g = new THREE.Group();
  const shyam = mat.color(0x1a2145, 0.45, 0.05);
  const gold = mat.gold();
  const vastra = mat.color(0xff9a00, 0.8);
  const border = mat.color(0xc1121f, 0.7);

  // Pithika: dark stone slab with an arched top and a gold edge.
  const slab = new THREE.Shape();
  slab.moveTo(-0.72, 0);
  slab.lineTo(0.72, 0);
  slab.lineTo(0.72, 1.45);
  slab.absarc(0, 1.45, 0.72, 0, Math.PI, false);
  slab.lineTo(-0.72, 0);
  const slabGeo = new THREE.ExtrudeGeometry(slab, { depth: 0.1, bevelEnabled: false, curveSegments: 20 });
  const stone = part(slabGeo, mat.color(0x25262e, 0.6));
  stone.position.z = -0.24;
  g.add(stone);
  const edgePts = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI;
    edgePts.push(V3(Math.cos(a) * 0.72, 1.45 + Math.sin(a) * 0.72, -0.13));
  }
  const edge = part(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.72, 0, -0.13), ...edgePts, V3(-0.72, 0, -0.13)]), 60, 0.025, 6),
    gold,
    false,
  );
  g.add(edge);

  // Ghera vastra (flared robe) with a red and gold hem.
  const robe = part(
    new THREE.LatheGeometry([V2(0.19, 0.84), V2(0.24, 0.7), V2(0.36, 0.4), V2(0.52, 0.1), V2(0.55, 0.06)], 28),
    new THREE.MeshStandardMaterial({ color: 0xff9a00, roughness: 0.8, side: THREE.DoubleSide }),
  );
  g.add(robe);
  for (const [r, y, m, tube] of [
    [0.545, 0.075, border, 0.03],
    [0.5, 0.15, gold, 0.014],
    [0.2, 0.84, gold, 0.03],
  ]) {
    const ring = part(new THREE.TorusGeometry(r, tube, 8, 32), m, false);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  // little gold booti on the robe
  const dots = [];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI - Math.PI / 2 + row * 0.17;
      const y = 0.26 + row * 0.16;
      const r = 0.52 - (y - 0.1) * 0.43;
      dots.push(V3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
  }
  g.add(beads(dots, [0xfff3b0], 0.014));

  // Feet peeping out, with anklets.
  for (const sx of [-1, 1]) {
    const foot = part(new THREE.SphereGeometry(0.07, 10, 8), shyam);
    foot.scale.set(1, 0.55, 1.5);
    foot.position.set(sx * 0.12, 0.04, 0.5);
    g.add(foot);
  }

  // Body
  const torso = part(new THREE.CapsuleGeometry(0.175, 0.2, 6, 16), shyam);
  torso.position.y = 1.0;
  g.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.4, 0.02);
  g.add(head);
  head.add(part(new THREE.SphereGeometry(0.23, 24, 18), shyam));

  // Eyes: large, long and gentle, gazing softly downward.
  for (const sx of [-1, 1]) {
    const white = part(new THREE.SphereGeometry(0.07, 16, 10), mat.white(), false);
    white.scale.set(1.3, 0.72, 0.3);
    white.position.set(sx * 0.098, 0.012, 0.196);
    const pupil = part(new THREE.SphereGeometry(0.036, 12, 10), mat.black(), false);
    pupil.scale.z = 0.4;
    pupil.position.set(sx * 0.098, 0.004, 0.216);
    const glint = part(new THREE.SphereGeometry(0.01, 6, 6), mat.white(), false);
    glint.position.set(sx * 0.098 + 0.012, 0.018, 0.229);
    const lid = part(new THREE.TorusGeometry(0.085, 0.007, 5, 14, Math.PI * 0.8), mat.black(), false);
    lid.scale.set(1.05, 0.62, 1);
    lid.rotation.z = Math.PI * 0.1;
    lid.position.set(sx * 0.098, -0.002, 0.214);
    head.add(white, pupil, glint, lid);
  }
  const smile = part(new THREE.TorusGeometry(0.036, 0.008, 6, 14, Math.PI * 0.8), mat.color(0xff6b81, 0.6), false);
  smile.rotation.z = Math.PI * 1.1;
  smile.position.set(0, -0.088, 0.208);
  head.add(smile);
  // tilak
  const tilakG = mat.color(0xffd60a, 0.5);
  for (const sx of [-1, 1]) {
    const bar = part(new THREE.BoxGeometry(0.011, 0.085, 0.01), tilakG, false);
    bar.position.set(sx * 0.02, 0.125, 0.195);
    bar.rotation.set(-0.5, 0, sx * -0.14);
    head.add(bar);
  }
  const bindu = part(new THREE.SphereGeometry(0.013, 6, 6), mat.color(0xd00000, 0.6), false);
  bindu.position.set(0, 0.105, 0.21);
  head.add(bindu);
  // the diamond on the chin, nose pearl, earrings
  const heera = part(new THREE.OctahedronGeometry(0.022), mat.color(0xe0fbfc, 0.05, 0.6), false);
  heera.position.set(0, -0.168, 0.158);
  head.add(heera);
  const moti = part(new THREE.SphereGeometry(0.014, 8, 6), mat.white(), false);
  moti.position.set(0.02, -0.035, 0.232);
  head.add(moti);
  for (const sx of [-1, 1]) {
    const kundal = part(new THREE.SphereGeometry(0.035, 10, 8), gold, false);
    kundal.position.set(sx * 0.235, -0.05, 0.02);
    head.add(kundal);
  }

  // Paag with a jewelled band and the mor-pankh chandrika.
  const paag = part(new THREE.SphereGeometry(0.245, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), vastra);
  paag.scale.set(1.08, 0.85, 1.05);
  paag.position.y = 0.1;
  paag.rotation.x = -0.2;
  head.add(paag);
  const band = part(new THREE.TorusGeometry(0.245, 0.022, 8, 28), gold, false);
  band.rotation.x = Math.PI / 2 - 0.2;
  band.position.y = 0.115;
  head.add(band);
  const fm = new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  for (const [x, rz, s] of [
    [0, 0, 1.15],
    [-0.11, 0.45, 0.9],
    [0.11, -0.45, 0.9],
  ]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.32), fm);
    f.position.set(x, 0.4 - Math.abs(x) * 0.5, 0.03);
    f.rotation.z = rz;
    f.scale.setScalar(s);
    head.add(f);
  }

  // Left arm raised high (viewer's right); right hand resting at the waist.
  const sL = V3(0.21, 1.14, 0);
  const hL = V3(0.47, 1.78, 0.02);
  g.add(limb(sL, hL, 0.065, shyam));
  const handL = part(new THREE.SphereGeometry(0.08, 12, 10), shyam);
  handL.position.copy(hL).add(V3(0.02, 0.07, 0));
  g.add(handL);
  const sR = V3(-0.21, 1.14, 0);
  const eR = V3(-0.42, 0.93, 0.04);
  const hR = V3(-0.25, 0.86, 0.14);
  g.add(limb(sR, eR, 0.065, shyam), limb(eR, hR, 0.06, shyam));
  const handR = part(new THREE.SphereGeometry(0.075, 12, 10), shyam);
  handR.position.copy(hR);
  g.add(handR);
  for (const [p, r] of [
    [V3(0.44, 1.7, 0.02), 0.075],
    [V3(0.29, 1.33, 0.01), 0.08],
    [V3(-0.29, 0.88, 0.11), 0.07],
    [V3(-0.32, 1.04, 0.02), 0.08],
  ]) {
    const kada = part(new THREE.TorusGeometry(r, 0.016, 6, 16), gold, false);
    kada.position.copy(p);
    kada.rotation.x = Math.PI / 2;
    g.add(kada);
  }

  // Necklace and garlands.
  const haar = part(new THREE.TorusGeometry(0.19, 0.018, 8, 24), gold, false);
  haar.rotation.x = Math.PI / 2 + 0.45;
  haar.position.set(0, 1.1, 0.05);
  g.add(haar);
  const mala = (rx, ry, cy, colors, size, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const sag = Math.sin((i / n) * Math.PI);
      pts.push(V3(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.13 + sag * (0.1 + ry * 0.32)));
    }
    return beads(pts, colors, size);
  };
  g.add(mala(0.2, 0.42, 1.2, MOGRA, 0.034, 20));
  g.add(mala(0.25, 0.72, 1.2, [...MARIGOLD, ...ROSE], 0.04, 26));

  // Soft golden light behind the head.
  const haloMat = new THREE.SpriteMaterial({
    map: canvasTex(128, 128, (c, s) => {
      const grd = c.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
      grd.addColorStop(0, 'rgba(255,220,130,0.5)');
      grd.addColorStop(1, 'rgba(255,230,150,0)');
      c.fillStyle = grd;
      c.fillRect(0, 0, s, s);
    }),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, 1.5, -0.12);
  halo.scale.setScalar(1.2);
  g.add(halo);
  onFrame((dt, t) => {
    halo.scale.setScalar(1.2 + Math.sin(t * 1.5) * 0.06);
  });

  g.userData.keep = [halo];
  g.userData.parts = { halo };
  return g;
});

// Sinhasan: stepped throne with a white gadi and red bolsters.
registerModel('sinhasan', () => {
  const g = new THREE.Group();
  const step = part(new THREE.BoxGeometry(2.3, 0.16, 1.1), mat.gold());
  step.position.y = 0.08;
  const gadi = part(new THREE.BoxGeometry(1.9, 0.12, 0.9), mat.white());
  gadi.position.y = 0.22;
  const trim = part(new THREE.BoxGeometry(1.92, 0.03, 0.92), mat.red());
  trim.position.y = 0.175;
  g.add(step, gadi, trim);
  for (const sx of [-1, 1]) {
    const takiya = part(new THREE.CapsuleGeometry(0.12, 0.5, 6, 14), new THREE.MeshStandardMaterial({ map: tex.redCloth(), roughness: 0.9 }));
    takiya.rotation.x = Math.PI / 2;
    takiya.position.set(sx * 0.98, 0.4, -0.05);
    g.add(takiya);
  }
  g.userData.surfaceY = 0.28;
  return g;
});
