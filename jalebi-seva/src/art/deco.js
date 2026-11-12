import * as THREE from 'three';

// Small decorative helpers shared by the rooms and the figures.

const beadGeo = new THREE.SphereGeometry(1, 8, 6);
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/** A string of round "flowers": one instanced mesh, coloured per bead. */
export function beads(points, colors, size = 0.035, { shadow = false } = {}) {
  const inst = new THREE.InstancedMesh(beadGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), points.length);
  points.forEach((p, i) => {
    _m.makeScale(size, size, size).setPosition(p.x, p.y, p.z);
    inst.setMatrixAt(i, _m);
    inst.setColorAt(i, _c.set(colors[i % colors.length]));
  });
  inst.castShadow = shadow;
  inst.instanceColor.needsUpdate = true;
  return inst;
}

/** Points along a sagging line from a to b. */
export function swag(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  return pts;
}

export const MARIGOLD = [0xff9f1c, 0xffbf00, 0xff9f1c, 0xffd60a];
export const MOGRA = [0xffffff, 0xfff5e1];
export const ROSE = [0xe5383b, 0xff5d8f];

/** Marigold door garland (toran) with hanging mango leaves. */
export function toran(a, b, { sag = 0.18, n = 30, drops = 5 } = {}) {
  const g = new THREE.Group();
  const pts = swag(a, b, sag, n);
  g.add(beads(pts, MARIGOLD, 0.05));
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.8, side: THREE.DoubleSide });
  const leafGeo = new THREE.SphereGeometry(1, 6, 4);
  for (let i = 1; i < drops; i++) {
    const p = pts[Math.round((i / drops) * n)];
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.scale.set(0.035, 0.11, 0.008);
    leaf.position.set(p.x, p.y - 0.14, p.z);
    g.add(leaf);
  }
  return g;
}

/** Straight capsule between two points. */
export function limb(a, b, radius, material) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 10), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}
