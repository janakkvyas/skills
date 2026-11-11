import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Every model in the game is a named "slot". Each slot has a procedural
// builder (so the game is complete with no art files at all) and can be
// overridden by a .glb – e.g. one generated with Tripo AI – simply by listing
// it in public/models/manifest.json:
//
//   {
//     "kadhai": "kadhai.glb",
//     "shreenathji": { "file": "shreenathji.glb", "rotateY": 180, "scale": 1.05 },
//     "vaishnav:dada": "dadaji.glb",
//     "textures": { "pichwai": "pichwai.jpg" }
//   }
//
// The .glb is scaled and re-centred to occupy the same space as the
// procedural model it replaces, so no code has to change. A key of the form
// "slot:variant" replaces only that variant (e.g. one of the four diners).
// Options: rotateY (degrees), scale (multiplier), lift (metres up),
// fit ("contain" | "height" | "width"; the default depends on the slot).

// How an override is sized when the manifest does not say. Vessels are
// matched by their rim so the liquid the game pours in still fits; figures
// are matched by height; everything else is fitted inside the placeholder.
const DEFAULT_FIT = {
  kadhai: 'width',
  pot: 'width',
  bowl: 'width',
  katori: 'width',
  lota: 'width',
  chulha: 'width',
  tokri: 'width',
  thali: 'width',
  paatal: 'width',
  vaishnav: 'height',
  shreenathji: 'height',
};

const builders = new Map();
const overrides = new Map();
const textures = new Map();
const _box = new THREE.Box3();

export function registerModel(slot, builder) {
  builders.set(slot, builder);
}

export const slotNames = () => [...builders.keys()];

export async function loadOverrides(onProgress) {
  let manifest;
  try {
    const res = await fetch('models/manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    manifest = await res.json();
  } catch (_) {
    return;
  }
  const entries = Object.entries(manifest).filter(([slot]) => !slot.startsWith('_') && slot !== 'textures');
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const texJobs = Object.entries(manifest.textures || {}).map(async ([name, file]) => {
    try {
      const t = await texLoader.loadAsync('models/' + file);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      textures.set(name, t);
    } catch (err) {
      console.warn(`[assets] could not load texture "${name}":`, err);
    }
  });
  let done = 0;
  await Promise.all(
    entries.map(async ([slot, spec]) => {
      const cfg = typeof spec === 'string' ? { file: spec } : spec;
      try {
        const gltf = await loader.loadAsync('models/' + cfg.file);
        gltf.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        overrides.set(slot, { scene: gltf.scene, cfg });
      } catch (err) {
        console.warn(`[assets] could not load override for "${slot}":`, err);
      }
      if (onProgress) onProgress(++done / entries.length);
    }),
  );
  await Promise.all(texJobs);
}

/** A family-supplied picture for a named surface (e.g. "pichwai"), if any. */
export const textureOverride = (name) => textures.get(name) || null;

export const hasOverride = (slot) => overrides.has(slot);

/** Build the model for a slot. Extra args go to the procedural builder. */
export function make(slot, ...args) {
  const builder = builders.get(slot);
  if (!builder) throw new Error('Unknown model slot: ' + slot);
  const proc = builder(...args);
  const ov = (typeof args[0] === 'string' && overrides.get(`${slot}:${args[0]}`)) || overrides.get(slot);
  if (!ov) return proc;

  // Fit the override into the procedural model's bounding box. Parts the
  // game adds itself (liquids, flames, glows) are set aside first so they do
  // not distort the measurement; they are re-attached below.
  const keep = proc.userData.keep || [];
  for (const k of keep) k.removeFromParent();
  proc.updateMatrixWorld(true);
  _box.setFromObject(proc);
  const want = _box.getSize(new THREE.Vector3());
  const wantMinY = _box.min.y;
  const wantCx = (_box.min.x + _box.max.x) / 2;
  const wantCz = (_box.min.z + _box.max.z) / 2;

  const model = ov.scene.clone(true);
  if (ov.cfg.rotateY) model.rotation.y = THREE.MathUtils.degToRad(ov.cfg.rotateY);
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  const have = _box.getSize(new THREE.Vector3());
  const fit = ov.cfg.fit || DEFAULT_FIT[slot] || 'contain';
  let s;
  if (fit === 'height') s = want.y / have.y;
  else if (fit === 'width') s = Math.max(want.x, want.z) / Math.max(have.x, have.z);
  else s = Math.min(want.x / have.x, want.y / have.y, want.z / have.z);
  s *= ov.cfg.scale || 1;
  model.scale.multiplyScalar(s);
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  model.position.x += wantCx - (_box.min.x + _box.max.x) / 2;
  model.position.z += wantCz - (_box.min.z + _box.max.z) / 2;
  model.position.y += wantMinY - _box.min.y + (ov.cfg.lift || 0);

  const g = new THREE.Group();
  g.add(model);
  g.userData = { ...proc.userData, isOverride: true };
  // Figures expose behaviours; a static .glb gets the simple "bob" versions.
  if (proc.userData.makeApi) g.userData.api = proc.userData.makeApi(g, true);
  // Keep any functional (non-visual) parts the game animates, e.g. liquid
  // surfaces, by re-parenting the ones the builder marked as "keep".
  for (const k of keep) g.add(k);
  return g;
}

/** Size [w, h, d] an override for this slot is fitted to. */
export function slotSize(slot, ...args) {
  const proc = builders.get(slot)(...args);
  for (const k of proc.userData.keep || []) k.removeFromParent();
  proc.updateMatrixWorld(true);
  const v = _box.setFromObject(proc).getSize(new THREE.Vector3());
  return [v.x, v.y, v.z].map((n) => +n.toFixed(2));
}
