import * as THREE from 'three';
import { registerModel } from '../engine/assets.js';
import { onFrame } from '../engine/tween.js';
import { mat, canvasTex, tex } from './materials.js';
import { beads, MARIGOLD, MOGRA, ROSE } from './deco.js';
import { surf, normalFromHeight } from './surfaces.js';
import { makeHead, addTilak, makeHand, limb as limbF, pleatMap } from './figure.js';

// Shreenathji's swaroop, built in code: the shyam stone form against its
// carved pithika, left arm raised to hold Giriraj, right hand at the waist,
// the long painted eyes, and full shringar (mukut with mor-pankh, kundal,
// pearls, vanmala, zari vastra). A family's own model can still replace it
// through the "shreenathji" slot.

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

// ---------------------------------------------------------------------------
// Textures for the swaroop
// ---------------------------------------------------------------------------

/** Carved relief on the pithika: cows, peacocks, a serpent, sages, a parrot. */
const pithikaRelief = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#707070';
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#c8c8c8';
  g.strokeStyle = '#c8c8c8';
  const cow = (x, y, s, flip) => {
    g.save();
    g.translate(x, y);
    g.scale(flip * s, s);
    g.beginPath();
    g.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2); // body
    g.ellipse(21, -9, 8, 6, -0.4, 0, Math.PI * 2); // head
    g.fill();
    g.fillRect(-15, 6, 4, 14);
    g.fillRect(-5, 6, 4, 14);
    g.fillRect(6, 6, 4, 14);
    g.fillRect(13, 6, 4, 14);
    g.beginPath();
    g.ellipse(-4, -12, 6, 5, 0, 0, Math.PI * 2); // hump
    g.fill();
    g.restore();
  };
  const sage = (x, y) => {
    g.beginPath();
    g.arc(x, y - 13, 6, 0, Math.PI * 2);
    g.ellipse(x, y, 10, 9, 0, 0, Math.PI * 2);
    g.fill();
  };
  const peacock = (x, y, flip) => {
    g.save();
    g.translate(x, y);
    g.scale(flip, 1);
    g.beginPath();
    g.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
    g.ellipse(9, -9, 3, 7, 0.5, 0, Math.PI * 2);
    g.ellipse(-16, 4, 14, 5, 0.3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  cow(44, 470, 1.2, 1);
  cow(212, 470, 1.2, -1);
  cow(40, 410, 0.9, 1);
  cow(216, 410, 0.9, -1);
  sage(34, 330);
  sage(222, 330);
  sage(34, 250);
  sage(222, 250);
  peacock(40, 170, 1);
  peacock(216, 170, -1);
  // the serpent rising up one side
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 30; i++) {
    const y = 380 - i * 8;
    const x = 232 + Math.sin(i * 0.7) * 9;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // rocks of Giriraj along the top, and a beaded border
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.ellipse(20 + i * 27, 60 + (i % 2) * 14, 16, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.arc(8, 8 + i * 12.6, 3.2, 0, Math.PI * 2);
    g.arc(248, 8 + i * 12.6, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  // soften, then turn into a normal map
  const soft = document.createElement('canvas');
  soft.width = 256;
  soft.height = 512;
  const sg = soft.getContext('2d');
  sg.filter = 'blur(2px)';
  sg.drawImage(c, 0, 0);
  const n = normalFromHeight(soft, 3);
  n.wrapS = n.wrapT = THREE.ClampToEdgeWrapping;
  return n;
};

/** Zari-work cloth for the ghera vastra: saffron with gold booti and a red-and-gold hem. */
const vastraTex = () =>
  canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffb000');
    grd.addColorStop(1, '#ff8a00');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // hem: v = 0 is the waist (top of canvas is the hem after lathe UVs)
    const band = (y, hh, col) => {
      g.fillStyle = col;
      g.fillRect(0, y, w, hh);
    };
    band(0, 34, '#b3122a');
    band(6, 5, '#f7d774');
    band(24, 5, '#f7d774');
    band(34, 4, '#f7d774');
    g.fillStyle = '#f7d774';
    for (let i = 0; i < 32; i++) {
      g.beginPath();
      g.moveTo(i * 16 + 8, 11);
      g.lineTo(i * 16 + 13, 17);
      g.lineTo(i * 16 + 8, 23);
      g.lineTo(i * 16 + 3, 17);
      g.fill();
    }
    // booti
    for (let row = 0; row < 6; row++) {
      for (let i = 0; i < 16; i++) {
        const x = i * 32 + (row % 2) * 16 + 16;
        const y = 62 + row * 34;
        g.fillStyle = '#fff1b8';
        g.beginPath();
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.ellipse(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3, 3, 0, 0, Math.PI * 2);
        }
        g.fill();
        g.fillStyle = '#b3122a';
        g.beginPath();
        g.arc(x, y, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

/** The long, fish-shaped eyes of the swaroop, drawn flat as they are painted. */
const iconEyeTex = () =>
  canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const almond = (rx, ry, tail) => {
      g.beginPath();
      g.moveTo(cx - rx, cy + 4);
      g.bezierCurveTo(cx - rx * 0.5, cy - ry * 1.5, cx + rx * 0.45, cy - ry * 1.35, cx + rx + tail, cy - 6);
      g.bezierCurveTo(cx + rx * 0.45, cy + ry * 1.1, cx - rx * 0.5, cy + ry * 1.25, cx - rx, cy + 4);
      g.closePath();
    };
    almond(96, 34, 22);
    g.fillStyle = '#0a0a0c'; // kajal
    g.fill();
    almond(84, 26, 6);
    g.fillStyle = '#fffaf0';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#1a0f08';
    g.beginPath();
    g.arc(cx - 4, cy + 3, 27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(cx - 4, cy + 3, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx + 5, cy - 6, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });

// ---------------------------------------------------------------------------
// Shreenathji
// ---------------------------------------------------------------------------

registerModel('shreenathji', () => {
  const g = new THREE.Group();
  // polished shyam stone
  const stone = new THREE.MeshPhysicalMaterial({
    color: 0x14161f,
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    normalMap: surf.rough([3, 3], 0.9, 51),
    normalScale: V2(0.25, 0.25),
  });
  const gold = mat.gold();
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.25, clearcoat: 1, sheen: 0.5 });
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0xc1121f, roughness: 0.15, clearcoat: 1 });
  const emerald = new THREE.MeshPhysicalMaterial({ color: 0x1f9d55, roughness: 0.15, clearcoat: 1 });

  // --- pithika: the carved stone slab with its arched top
  const slab = new THREE.Shape();
  slab.moveTo(-0.72, 0);
  slab.lineTo(0.72, 0);
  slab.lineTo(0.72, 1.45);
  slab.absarc(0, 1.45, 0.72, 0, Math.PI, false);
  slab.lineTo(-0.72, 0);
  const slabGeo = new THREE.ExtrudeGeometry(slab, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 40 });
  // map the relief across the whole face
  const uv = slabGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.72) / 1.44, uv.getY(i) / 2.17);
  const slabM = new THREE.MeshStandardMaterial({ color: 0x1b1c23, roughness: 0.55, normalMap: pithikaRelief(), normalScale: V2(1.6, 1.6) });
  const stoneSlab = part(slabGeo, slabM);
  stoneSlab.position.z = -0.27;
  g.add(stoneSlab);
  const edgePts = [];
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI;
    edgePts.push(V3(Math.cos(a) * 0.72, 1.45 + Math.sin(a) * 0.72, -0.13));
  }
  g.add(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0.72, 0, -0.13), ...edgePts, V3(-0.72, 0, -0.13)], false, 'catmullrom', 0.05), 100, 0.028, 8), gold, false));

  // --- feet and legs
  for (const sx of [-1, 1]) {
    g.add(limbF(V3(sx * 0.1, 0.08, 0.02), V3(sx * 0.1, 0.8, 0), 0.085, stone, 0.1));
    const foot = part(new THREE.SphereGeometry(1, 16, 12), stone);
    foot.scale.set(0.07, 0.04, 0.13);
    foot.position.set(sx * 0.1, 0.045, 0.1);
    g.add(foot);
    for (let t = 0; t < 5; t++) {
      const toe = part(new THREE.SphereGeometry(0.016 - t * 0.0015, 8, 6), stone, false);
      toe.position.set(sx * (0.06 + t * 0.021), 0.035, 0.225 - t * 0.008);
      g.add(toe);
    }
    const nupur = part(new THREE.TorusGeometry(0.09, 0.014, 8, 20), gold, false);
    nupur.rotation.x = Math.PI / 2;
    nupur.position.set(sx * 0.1, 0.1, 0.03);
    g.add(nupur);
  }

  // --- ghera vastra, flaring to the hem, with zari border and pleats
  const robeTex = vastraTex();
  robeTex.wrapS = THREE.RepeatWrapping;
  robeTex.repeat.set(2, 1);
  const pl = pleatMap().clone();
  pl.repeat.set(3, 1);
  pl.needsUpdate = true;
  const robe = part(
    new THREE.LatheGeometry([V2(0.56, 0.11), V2(0.53, 0.16), V2(0.42, 0.36), V2(0.31, 0.58), V2(0.235, 0.76), V2(0.2, 0.86)], 64),
    new THREE.MeshStandardMaterial({ map: robeTex, roughness: 0.8, side: THREE.DoubleSide, normalMap: pl, normalScale: V2(0.9, 0.9) }),
  );
  g.add(robe);
  // kamarbandh with a jewelled clasp
  const belt = part(new THREE.TorusGeometry(0.205, 0.028, 10, 40), gold, false);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.86;
  g.add(belt);
  const clasp = part(new THREE.OctahedronGeometry(0.04), ruby, false);
  clasp.scale.z = 0.5;
  clasp.position.set(0, 0.86, 0.225);
  g.add(clasp);
  // the patka: two sash ends hanging in front
  for (const sx of [-1, 1]) {
    const sash = part(new THREE.BoxGeometry(0.075, 0.42, 0.012), mat.cloth(0xc1121f), false);
    sash.position.set(sx * 0.055, 0.63, 0.275 + 0.0);
    sash.rotation.set(-0.42, 0, sx * 0.08);
    const tassel = part(new THREE.SphereGeometry(0.03, 10, 8), gold, false);
    tassel.position.set(sx * 0.075, 0.44, 0.365);
    g.add(sash, tassel);
  }

  // --- torso
  const torso = part(
    new THREE.LatheGeometry([V2(0.0001, 0.82), V2(0.2, 0.84), V2(0.215, 0.98), V2(0.2, 1.08), V2(0.225, 1.2), V2(0.2, 1.27), V2(0.08, 1.31), V2(0.0001, 1.32)], 40),
    stone,
  );
  torso.scale.z = 0.78;
  g.add(torso);
  const neck = part(new THREE.CylinderGeometry(0.07, 0.085, 0.1, 18), stone);
  neck.position.y = 1.32;
  g.add(neck);

  // --- head: broad, serene, with the long painted eyes
  const head = makeHead({ skinMaterial: stone, size: 0.215, width: 0.88, jaw: 0.2, socket: 0.02, cheeks: 0.05, nose: 0.95, eye: 'icon', hairStyle: 'none', lip: 0xd62839 });
  head.position.set(0, 1.55, 0.02);
  g.add(head);
  const { face, frontZ } = head.userData;
  const eyeM = new THREE.MeshBasicMaterial({ map: iconEyeTex(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.33, 6, 1), eyeM);
    const pos = eye.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, -pos.getX(i) * pos.getX(i) * 0.5); // wrap round the face
    eye.scale.x = sx;
    eye.position.set(sx * 0.33, 0.12, frontZ(0.3, 0.1) + 0.13);
    eye.rotation.set(0, sx * 0.32, sx * 0.06);
    eye.renderOrder = 3;
    face.add(eye);
  }
  // tilak in gold with a red bindu, the chin diamond, the nose pearl
  addTilak(head, 0xffd23f);
  const bindu = part(new THREE.SphereGeometry(0.035, 10, 8), ruby, false);
  bindu.position.set(0, 0.36, frontZ(0, 0.36) + 0.03);
  face.add(bindu);
  const heera = part(new THREE.OctahedronGeometry(0.06), new THREE.MeshPhysicalMaterial({ color: 0xeaffff, roughness: 0.02, metalness: 0.2, clearcoat: 1 }), false);
  heera.scale.z = 0.5;
  heera.position.set(0, -0.7, frontZ(0, -0.7) + 0.03);
  face.add(heera);
  const nath = part(new THREE.TorusGeometry(0.06, 0.012, 6, 16), gold, false);
  nath.position.set(0.1, -0.24, frontZ(0.1, -0.24) + 0.04);
  const nathMoti = part(new THREE.SphereGeometry(0.03, 10, 8), pearl, false);
  nathMoti.position.set(0.1, -0.31, frontZ(0.1, -0.3) + 0.05);
  face.add(nath, nathMoti);
  for (const sx of [-1, 1]) {
    // makarakriti kundal
    const k1 = part(new THREE.TorusGeometry(0.11, 0.03, 8, 20), gold, false);
    k1.position.set(sx * 0.93, -0.28, 0.02);
    k1.rotation.y = Math.PI / 2 - sx * 0.5;
    const k2 = part(new THREE.SphereGeometry(0.05, 10, 8), sx > 0 ? ruby : emerald, false);
    k2.position.set(sx * 0.93, -0.28, 0.04);
    const k3 = part(new THREE.SphereGeometry(0.04, 10, 8), pearl, false);
    k3.position.set(sx * 0.93, -0.45, 0.03);
    face.add(k1, k2, k3);
  }

  // --- mukut: jewelled gold crown with the mor-pankh chandrika
  const mukut = new THREE.Group();
  mukut.position.set(0, 1.69, 0.0);
  const crown = part(
    new THREE.LatheGeometry([V2(0.205, 0), V2(0.215, 0.04), V2(0.2, 0.1), V2(0.15, 0.2), V2(0.1, 0.27), V2(0.05, 0.31), V2(0.0001, 0.32)], 40),
    gold,
  );
  crown.scale.z = 0.92;
  mukut.add(crown);
  const band = part(new THREE.TorusGeometry(0.212, 0.022, 8, 40), gold, false);
  band.rotation.x = Math.PI / 2;
  band.scale.y = 0.92;
  band.position.y = 0.02;
  mukut.add(band);
  const jewelPts = [];
  const jewelCols = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * Math.PI - Math.PI;
    jewelPts.push(V3(Math.cos(a) * 0.222, 0.02, -Math.sin(a) * 0.205));
    jewelCols.push(i % 3 === 0 ? 0xc1121f : i % 3 === 1 ? 0x1f9d55 : 0xfffaf0);
  }
  mukut.add(beads(jewelPts, jewelCols, 0.02));
  const crest = part(new THREE.OctahedronGeometry(0.045), ruby, false);
  crest.position.set(0, 0.13, 0.19);
  mukut.add(crest);
  const fm = new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  for (let i = -2; i <= 2; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.34), fm);
    f.position.set(i * 0.075, 0.4 - Math.abs(i) * 0.035, 0.02 - Math.abs(i) * 0.01);
    f.rotation.z = -i * 0.3;
    f.scale.setScalar(i === 0 ? 1.15 : 1 - Math.abs(i) * 0.08);
    mukut.add(f);
  }
  // strings of pearls falling from the crown past the ears
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push(V3(sx * (0.215 + Math.sin(i * 0.4) * 0.012), -0.02 - i * 0.03, 0.03));
    mukut.add(beads(pts, [0xfffaf0], 0.014));
  }
  g.add(mukut);

  // --- arms. Left raised high to hold up Giriraj (viewer's right); right fist at the waist.
  const sL = V3(0.225, 1.2, 0);
  const eL = V3(0.4, 1.47, 0.0);
  const wL = V3(0.47, 1.83, 0.02);
  g.add(limbF(sL, eL, 0.075, stone, 0.066), limbF(eL, wL, 0.064, stone, 0.052));
  const handL = makeHand(stone, 1.7, 1);
  handL.position.copy(wL);
  handL.rotation.set(Math.PI + 0.25, 0, 0.35); // open palm turned up
  g.add(handL);
  const sR = V3(-0.225, 1.2, 0);
  const eR = V3(-0.43, 0.99, 0.03);
  const wR = V3(-0.27, 0.9, 0.16);
  g.add(limbF(sR, eR, 0.075, stone, 0.066), limbF(eR, wR, 0.064, stone, 0.055));
  const fist = part(new THREE.SphereGeometry(0.075, 16, 12), stone);
  fist.scale.set(1, 0.9, 0.85);
  fist.position.copy(wR).add(V3(0.04, -0.02, 0.03));
  g.add(fist);
  // two lotus buds held in the right hand
  for (const [dx, tilt] of [
    [0, -0.25],
    [0.05, 0.3],
  ]) {
    const stemTop = V3(-0.3 + dx * 2, 1.16 + dx, 0.2);
    g.add(limbF(fist.position.clone().add(V3(0, -0.06, 0.02)), stemTop, 0.008, mat.color(0x3f8f3a, 0.7)));
    const bud = part(new THREE.SphereGeometry(0.045, 12, 10), mat.color(0xff8fab, 0.5), false);
    bud.scale.set(0.8, 1.35, 0.8);
    bud.position.copy(stemTop).add(V3(0, 0.04, 0));
    bud.rotation.z = tilt;
    g.add(bud);
  }
  // bajuband and kada
  for (const [p, r, q] of [
    [V3(0.32, 1.35, 0), 0.085, [0, 0, 0.55]],
    [V3(0.455, 1.76, 0.015), 0.068, [0, 0, 0.2]],
    [V3(-0.33, 1.09, 0.015), 0.085, [0, 0, -0.75]],
    [V3(-0.3, 0.915, 0.14), 0.07, [0.6, 0, 1.0]],
  ]) {
    const kada = part(new THREE.TorusGeometry(r, 0.018, 8, 20), gold, false);
    kada.position.copy(p);
    kada.rotation.set(Math.PI / 2 + q[0], q[1], q[2]);
    g.add(kada);
  }

  // --- necklaces: a gold choker, strands of pearls, and the long vanmala
  const strand = (rx, ry, cy, n, fwd) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const sag = Math.sin((i / n) * Math.PI);
      pts.push(V3(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.1 + sag * fwd));
    }
    return pts;
  };
  const choker = part(new THREE.TorusGeometry(0.105, 0.02, 8, 28), gold, false);
  choker.rotation.x = Math.PI / 2 - 0.25;
  choker.position.set(0, 1.305, 0.02);
  g.add(choker);
  const pendant = part(new THREE.OctahedronGeometry(0.035), emerald, false);
  pendant.scale.z = 0.5;
  pendant.position.set(0, 1.275, 0.125);
  g.add(pendant);
  g.add(beads(strand(0.15, 0.2, 1.27, 26, 0.09), [0xfffaf0], 0.016));
  g.add(beads(strand(0.18, 0.34, 1.27, 34, 0.1), [0xfffaf0, 0xfffaf0, 0xf2c14e], 0.018));
  g.add(beads(strand(0.2, 0.5, 1.27, 40, 0.13), [0xfffaf0], 0.02));
  const kaustubh = part(new THREE.OctahedronGeometry(0.045), ruby, false);
  kaustubh.scale.z = 0.5;
  kaustubh.position.set(0, 0.95, 0.24);
  g.add(kaustubh);
  // vanmala: flowers and leaves, down to the knees
  const mala = strand(0.27, 0.92, 1.25, 52, 0.26);
  g.add(beads(mala, [...MARIGOLD, 0x3f8f3a, ...ROSE, 0xffffff, 0x3f8f3a, ...MOGRA], 0.038));

  // --- soft golden light behind the head
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
  halo.position.set(0, 1.6, -0.1);
  halo.scale.setScalar(1.25);
  g.add(halo);
  onFrame((dt, t) => {
    halo.scale.setScalar(1.25 + Math.sin(t * 1.5) * 0.06);
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
