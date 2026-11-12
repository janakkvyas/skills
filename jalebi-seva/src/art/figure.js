import * as THREE from 'three';
import { mat } from './materials.js';
import { surf } from './surfaces.js';

// A small sculpting kit for people: a modelled head (brow, eye sockets,
// cheekbones, jaw, nose, lips, ears, lidded eyes), hands with fingers, and
// skin that takes the light softly. Used for the Vaishnavs and, with other
// settings, for Shreenathji's swaroop.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const gauss = (d, w) => Math.exp(-(d * d) / (2 * w * w));

export function part(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
}

const skinCache = {};
/** Skin: soft, slightly warm where light passes through, never plastic. */
export function skinMat(hex) {
  if (!skinCache[hex]) {
    const c = new THREE.Color(hex);
    skinCache[hex] = new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.62,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: c.clone().lerp(new THREE.Color(0xff9a7a), 0.5),
      emissive: c.clone().multiplyScalar(0.5).lerp(new THREE.Color(0x802010), 0.35),
      emissiveIntensity: 0.1,
    });
  }
  return skinCache[hex];
}

/** Capsule between two points. */
export function limb(a, b, r, material, r2 = r) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r2, r, len, 14, 1);
  const g = new THREE.Group();
  const cyl = part(geo, material);
  const capA = part(new THREE.SphereGeometry(r, 14, 10), material);
  capA.position.y = -len / 2;
  const capB = part(new THREE.SphereGeometry(r2, 14, 10), material);
  capB.position.y = len / 2;
  g.add(cyl, capA, capB);
  g.position.copy(a).addScaledVector(dir, 0.5);
  g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return g;
}

// ---------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------

/**
 * The shape of a head in "unit" space (about -1..1 tall). `o` tunes it:
 * width, jaw (0 round .. 1 strong taper), cheeks, child (softer, rounder).
 */
function headShape(o) {
  const W = o.width ?? 0.78;
  const D = 0.9;
  const jaw = o.jaw ?? 0.3;
  return (p) => {
    let { x, y, z } = p;
    x *= W;
    z *= D;
    if (y < 0) {
      const t = -y;
      x *= 1 - jaw * Math.pow(t, 1.6);
      z *= 1 - 0.1 * t;
      if (z > 0) z += 0.1 * gauss(t - 0.85, 0.2) * gauss(x, 0.25); // chin
    } else {
      z *= 1 - 0.06 * y; // forehead slopes back a little
    }
    if (z > 0) {
      z += 0.035 * gauss(y - 0.24, 0.07) * (1 - gauss(x, 0.08) * 0.5); // brow ridge
      const ex = Math.abs(x) - 0.31;
      z -= (o.socket ?? 0.075) * gauss(ex, 0.13) * gauss(y - 0.1, 0.1); // eye sockets
      z += (o.cheeks ?? 0.04) * gauss(Math.abs(x) - 0.4, 0.16) * gauss(y + 0.18, 0.16); // cheeks
      z -= 0.02 * gauss(x, 0.2) * gauss(y + 0.42, 0.06); // under the nose
    }
    // back of the skull fuller
    if (z < 0 && y > -0.3) z *= 1.06;
    return p.set(x, y, z);
  };
}

function sculpt(geo, fn) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Where the face surface is, in unit space, at (x, y). */
function frontZ(shape, x, y, W = 0.78) {
  const xx = x / W;
  const z0 = Math.sqrt(Math.max(0.0001, 1 - xx * xx - y * y));
  return shape(V3(xx, y, z0)).z;
}

/**
 * Build a head. Returns a group (unit space scaled by `size`, the head's
 * half-height) with userData { smile, mouth, shape }.
 *  o.skin, o.hair (hex), o.size, o.eye ('human' | 'icon'), o.child
 *  o.hairStyle: 'short' | 'bun' | 'thin' | 'none'
 */
export function makeHead(o) {
  const head = new THREE.Group();
  const face = new THREE.Group();
  face.scale.setScalar(o.size);
  head.add(face);
  const skin = o.skinMaterial || skinMat(o.skin);
  const shape = headShape(o);

  face.add(part(sculpt(new THREE.SphereGeometry(1, 48, 36), shape), skin));

  // --- nose: bridge, tip and wings
  const ns = (o.nose ?? 1) * 0.72;
  const zN = frontZ(shape, 0, -0.12);
  const bridge = part(new THREE.SphereGeometry(1, 16, 12), skin, false);
  bridge.scale.set(0.085 * ns, 0.2, 0.1 * ns);
  bridge.position.set(0, -0.03, zN + 0.01);
  bridge.rotation.x = -0.28;
  const tip = part(new THREE.SphereGeometry(1, 16, 12), skin, false);
  tip.scale.set(0.115 * ns, 0.095 * ns, 0.11 * ns);
  tip.position.set(0, -0.19, zN + 0.075 * ns);
  face.add(bridge, tip);
  for (const sx of [-1, 1]) {
    const wing = part(new THREE.SphereGeometry(1, 12, 10), skin, false);
    wing.scale.set(0.07 * ns, 0.06 * ns, 0.07 * ns);
    wing.position.set(sx * 0.1 * ns, -0.21, zN + 0.025);
    face.add(wing);
  }

  // --- ears
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(1, 14, 12), skin, false);
    ear.scale.set(0.06, 0.2, 0.12);
    ear.position.set(sx * 0.76 * (o.width ?? 0.78) / 0.78, -0.02, -0.02);
    ear.rotation.set(0, sx * 0.35, sx * -0.12);
    face.add(ear);
  }

  // --- eyes
  const lidM = skin;
  const eyeY = 0.1;
  const eyeX = 0.31;
  const zE = frontZ(shape, eyeX, eyeY);
  for (const sx of o.eye === 'icon' ? [] : [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * eyeX, eyeY, zE - 0.075);
    const R = o.child ? 0.17 : 0.15;
    const ball = part(new THREE.SphereGeometry(R, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xfbf7f0, roughness: 0.15, clearcoat: 1 }), false);
    const iris = part(new THREE.SphereGeometry(R * 0.56, 18, 14), new THREE.MeshPhysicalMaterial({ color: o.iris ?? 0x3a2414, roughness: 0.2, clearcoat: 1 }), false);
    iris.scale.z = 0.35;
    iris.position.z = R * 0.84;
    const pupil = part(new THREE.SphereGeometry(R * 0.28, 12, 10), mat.black(), false);
    pupil.scale.z = 0.3;
    pupil.position.z = R * 0.97;
    const glint = part(new THREE.SphereGeometry(R * 0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), false);
    glint.position.set(R * 0.2, R * 0.22, R * 1.02);
    // lids: skin shells over the top and under the eye
    const upper = part(new THREE.SphereGeometry(R * 1.07, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), lidM, false);
    upper.rotation.x = -0.32;
    const lower = part(new THREE.SphereGeometry(R * 1.06, 20, 10, 0, Math.PI * 2, Math.PI * 0.66, Math.PI * 0.34), lidM, false);
    lower.rotation.x = 0.18;
    eye.add(ball, iris, pupil, glint, upper, lower);
    face.add(eye);

    // brow: an arc of short strokes along the brow ridge
    const browM = mat.color(o.brow ?? o.hair ?? 0x1f1410, 0.9);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const bx = sx * (0.16 + 0.34 * t);
      const by = 0.3 + 0.045 * Math.sin(t * Math.PI) - 0.03 * t;
      const st = part(new THREE.SphereGeometry(1, 8, 6), browM, false);
      st.scale.set(0.05, 0.022 * (1 - 0.4 * t), 0.02);
      st.position.set(bx, by, frontZ(shape, bx, by) + 0.012);
      st.rotation.z = sx * (0.25 - 0.5 * t);
      face.add(st);
    }
  }

  // --- mouth: lips that smile, and an open mouth for eating
  const lipM = mat.color(o.lip ?? 0xa85a4a, 0.5);
  const zM = frontZ(shape, 0, -0.46);
  const smile = new THREE.Group();
  const upperLip = part(new THREE.TorusGeometry(0.2, 0.03, 8, 18, Math.PI * 0.62), lipM, false);
  upperLip.rotation.z = Math.PI * 1.19;
  upperLip.scale.set(1, 0.55, 0.8);
  upperLip.position.set(0, -0.345, zM + 0.005);
  const lowerLip = part(new THREE.TorusGeometry(0.19, 0.04, 8, 18, Math.PI * 0.56), lipM, false);
  lowerLip.rotation.z = Math.PI * 1.22;
  lowerLip.scale.set(1, 0.75, 0.9);
  lowerLip.position.set(0, -0.33, zM + 0.012);
  smile.add(upperLip, lowerLip);
  const mouth = part(new THREE.SphereGeometry(0.11, 14, 10), mat.color(0x4a1512, 0.6), false);
  mouth.scale.set(1.1, 0.9, 0.35);
  mouth.position.set(0, -0.47, zM + 0.005);
  mouth.visible = false;
  face.add(smile, mouth);

  // --- hair
  const hairM = new THREE.MeshStandardMaterial({
    color: o.hair ?? 0x1f1410,
    roughness: 0.55,
    normalMap: surf.brushed([6, 2]),
    normalScale: new THREE.Vector2(1.4, 1.4),
  });
  const style = o.hairStyle ?? 'short';
  if (style !== 'none') {
    // one cap over the crown and down the back of the head
    const cover = style === 'thin' ? 0.46 : 0.58;
    const cap = part(new THREE.SphereGeometry(1, 44, 28, 0, Math.PI * 2, 0, Math.PI * cover), hairM);
    cap.scale.set((o.width ?? 0.78) * 1.06, 1.05, 0.98);
    cap.rotation.x = style === 'thin' ? -1.05 : -0.72;
    cap.position.set(0, 0.0, -0.035);
    face.add(cap);
    if (style === 'bun') {
      const bun = part(new THREE.SphereGeometry(0.34, 18, 14), hairM);
      bun.position.set(0, -0.15, -0.95);
      face.add(bun);
      // centre parting
      const part2 = part(new THREE.BoxGeometry(0.02, 0.02, 0.6), skin, false);
      part2.position.set(0, 0.99, 0.2);
      part2.rotation.x = 0.45;
      face.add(part2);
    }
  }

  head.userData = { smile, mouth, shape, face, frontZ: (x, y) => frontZ(shape, x, y, o.width ?? 0.78) };
  return head;
}

/** Pushtimarg tilak: two fine red lines rising from the bridge of the nose, joined below. */
export function addTilak(head, color = 0xd00000) {
  const { face, frontZ: fz } = head.userData;
  const m = mat.color(color, 0.6);
  const at = (x, y) => V3(x, y, fz(x, y) + 0.018);
  for (const sx of [-1, 1]) {
    let prev = at(0, 0.2);
    for (let i = 1; i <= 4; i++) {
      const next = at(sx * (0.012 + i * 0.012), 0.2 + i * 0.1);
      face.add(limb(prev, next, 0.011, m));
      prev = next;
    }
  }
}

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------

/** A relaxed hand hanging along -Y from the wrist at the origin. */
export function makeHand(skin, s = 1, side = 1) {
  const g = new THREE.Group();
  const palm = part(new THREE.SphereGeometry(1, 14, 10), skin);
  palm.scale.set(0.042 * s, 0.05 * s, 0.02 * s);
  palm.position.y = -0.045 * s;
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const len = [0.05, 0.058, 0.054, 0.042][i] * s;
    const f = limb(V3((i - 1.5) * 0.02 * s, -0.085 * s, 0), V3((i - 1.5) * 0.023 * s, -0.085 * s - len, 0.018 * s), 0.0105 * s, skin, 0.009 * s);
    g.add(f);
  }
  const thumb = limb(V3(side * 0.038 * s, -0.035 * s, 0.006 * s), V3(side * 0.062 * s, -0.08 * s, 0.022 * s), 0.0125 * s, skin, 0.01 * s);
  g.add(thumb);
  return g;
}

/** Soft folds for draped cloth, as a normal map (vertical pleats). */
let pleats = null;
export function pleatMap() {
  if (!pleats) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    for (let x = 0; x < 256; x++) {
      const v = 128 + 70 * Math.sin((x / 256) * Math.PI * 2 * 9) + 30 * Math.sin((x / 256) * Math.PI * 2 * 23 + 1);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, 0, 1, 64);
    }
    // inline height->normal (x gradient only)
    const src = g.getImageData(0, 0, 256, 64).data;
    const out = g.createImageData(256, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 256; x++) {
        const a = src[(y * 256 + ((x + 255) % 256)) * 4];
        const b = src[(y * 256 + ((x + 1) % 256)) * 4];
        const dx = ((b - a) / 255) * 2.2;
        const l = Math.hypot(dx, 1);
        const i = (y * 256 + x) * 4;
        out.data[i] = (-dx / l) * 127 + 128;
        out.data[i + 1] = 128;
        out.data[i + 2] = (1 / l) * 127 + 128;
        out.data[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
    pleats = new THREE.CanvasTexture(c);
    pleats.wrapS = pleats.wrapT = THREE.RepeatWrapping;
  }
  return pleats;
}

const drapeCache = {};
/** Draped cloth (dhoti, saree) with pleats. */
export function drapeMat(hex, repeat = 2) {
  const k = hex + '_' + repeat;
  if (!drapeCache[k]) {
    const n = pleatMap().clone();
    n.repeat.set(repeat, 1);
    n.needsUpdate = true;
    drapeCache[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide });
  }
  return drapeCache[k];
}
