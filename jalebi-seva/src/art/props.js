import * as THREE from 'three';
import { registerModel } from '../engine/assets.js';
import { onFrame } from '../engine/tween.js';
import { mat, tex, COLORS } from './materials.js';
import { surf, makeFlame, makeGlow, flameClock } from './surfaces.js';

// Liquids share one ripple map; drift it so ghee and syrup shimmer.
onFrame((dt, t) => {
  flameClock.value = t;
  surf.ripples().offset.set(t * 0.03, t * 0.021);
});

// Procedural stand-ins for every prop. Each is registered under a slot name
// so a Tripo-generated .glb can replace it (see engine/assets.js).
// Convention: a model sits on y = 0 and is centred on x/z.

const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(geo, material, { shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}

const lathe = (pts, segs = 28) => new THREE.LatheGeometry(pts, Math.max(segs, 48));

/** Quarter-ellipse bowl profile: radius R at the rim, depth H. */
function bowlProfile(R, H, n = 12, a1 = Math.PI / 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a1 * i) / n;
    pts.push(V2(Math.max(0.0001, R * Math.sin(a)), H * (1 - Math.cos(a))));
  }
  return pts;
}

function disc(radius, material, y) {
  const d = mesh(new THREE.CircleGeometry(radius, 56), material, { shadow: false });
  d.rotation.x = -Math.PI / 2;
  d.position.y = y;
  return d;
}

function group(parts = {}, keep = []) {
  const g = new THREE.Group();
  g.userData.parts = parts;
  g.userData.keep = keep;
  return g;
}

// ---------------------------------------------------------------------------
// Cooking vessels
// ---------------------------------------------------------------------------

registerModel('kadhai', () => {
  const R = 0.72;
  const H = 0.34;
  const body = mesh(lathe(bowlProfile(R, H, 14)), mat.iron());
  const rim = mesh(new THREE.TorusGeometry(R, 0.022, 8, 40), mat.iron());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H;
  const g = group();
  g.add(body, rim);
  for (const sx of [-1, 1]) {
    const h = mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20, Math.PI), mat.iron());
    h.position.set(sx * (R + 0.01), H - 0.01, 0);
    h.rotation.set(Math.PI / 2, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    g.add(h);
  }
  const gheeY = 0.215;
  const ghee = disc(0.655, mat.liquid(COLORS.ghee, 0.94), gheeY);
  g.add(ghee);
  g.userData.parts = { ghee };
  g.userData.keep = [ghee];
  g.userData.gheeY = gheeY;
  g.userData.gheeR = 0.62;
  return g;
});

registerModel('pot', () => {
  const body = mesh(
    lathe([V2(0.0001, 0.012), V2(0.4, 0.012), V2(0.475, 0.06), V2(0.5, 0.13), V2(0.5, 0.4), V2(0.55, 0.445)], 32),
    mat.brassDouble(),
  );
  const rim = mesh(new THREE.TorusGeometry(0.55, 0.018, 8, 40), mat.brass());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.445;
  const liquid = disc(0.49, mat.liquid(COLORS.syrupClear, 0.92), 0.14);
  liquid.visible = false;
  const g = group({ liquid }, [liquid]);
  g.add(body, rim, liquid);
  g.userData.liquidTop = 0.33;
  g.userData.liquidR = 0.46;
  return g;
});

registerModel('bowl', () => {
  const R = 0.52;
  const H = 0.3;
  const body = mesh(lathe(bowlProfile(R, H, 12)), mat.steel());
  const rim = mesh(new THREE.TorusGeometry(R, 0.02, 8, 40), mat.steel());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H;
  const batter = disc(0.47, mat.fresh(0xffffff, 0.55), 0.06);
  batter.scale.setScalar(0.6);
  batter.visible = false;
  const g = group({ batter }, [batter]);
  g.add(body, rim, batter);
  g.userData.fillTop = 0.2;
  g.userData.fillR = 0.4;
  return g;
});

// A small brass katori with something in it: 'maida' | 'dahi' | 'sugar' | 'kesar'
registerModel('katori', (content = 'maida') => {
  const R = 0.17;
  const H = 0.13;
  const body = mesh(lathe(bowlProfile(R, H, 8), 20), mat.brassDouble());
  const foot = mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.02, 16), mat.brass());
  foot.position.y = 0.005;
  const g = group();
  g.add(body, foot);
  let fill;
  if (content === 'maida' || content === 'sugar') {
    fill = mesh(new THREE.SphereGeometry(0.145, 16, 10), mat.fresh(content === 'sugar' ? 0xffffff : 0xfff8e7, content === 'sugar' ? 0.25 : 0.95));
    fill.scale.y = 0.7;
    fill.position.y = 0.1;
  } else if (content === 'dahi') {
    fill = disc(0.155, mat.fresh(0xfffef8, 0.25), 0.105);
  } else if (content === 'kesar') {
    fill = new THREE.Group();
    const m = mat.color(COLORS.kesar, 0.6);
    for (let i = 0; i < 16; i++) {
      const s = mesh(new THREE.CylinderGeometry(0.006, 0.003, 0.09, 4), m, { shadow: false });
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.09;
      s.position.set(Math.cos(a) * r, 0.1 + Math.random() * 0.02, Math.sin(a) * r);
      s.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, 0, Math.random() * Math.PI);
      fill.add(s);
    }
  }
  if (fill) g.add(fill);
  g.userData.parts = { fill };
  g.userData.keep = fill ? [fill] : [];
  return g;
});

registerModel('lota', () => {
  const body = mesh(
    lathe(
      [V2(0.0001, 0), V2(0.11, 0), V2(0.2, 0.07), V2(0.23, 0.17), V2(0.19, 0.27), V2(0.12, 0.33), V2(0.125, 0.37), V2(0.17, 0.4)],
      24,
    ),
    mat.brassDouble(),
  );
  const water = disc(0.12, mat.liquid(0x9ad7ee, 0.9), 0.36);
  const g = group({ water }, [water]);
  g.add(body, water);
  return g;
});

// Wooden ladle. Origin is at the working tip; the handle rises toward the cook.
registerModel('spoon', () => {
  const g = group();
  const handle = mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.95, 8), mat.wood());
  handle.position.y = 0.475;
  const tip = mesh(new THREE.SphereGeometry(0.075, 12, 8), mat.wood());
  tip.scale.set(1, 0.45, 1.25);
  const inner = new THREE.Group();
  inner.add(handle, tip);
  inner.rotation.set(0.5, 0, -0.3);
  g.add(inner);
  return g;
});

// Cloth piping bag for the batter. Origin is at the nozzle.
registerModel('pipingBag', () => {
  const g = group();
  const cone = mesh(new THREE.ConeGeometry(0.13, 0.36, 14), mat.white());
  cone.rotation.x = Math.PI;
  cone.position.y = 0.18;
  const knot = mesh(new THREE.SphereGeometry(0.075, 10, 8), mat.white());
  knot.position.y = 0.4;
  const tie = mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 14), mat.red());
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.355;
  g.add(cone, knot, tie);
  return g;
});

// Clay chulha (U-shaped stove), opening toward the camera (+z).
registerModel('chulha', () => {
  const R = 0.66;
  const r = 0.46;
  const H = 0.3;
  const a0 = THREE.MathUtils.degToRad(-52);
  const a1 = THREE.MathUtils.degToRad(232);
  const sh = new THREE.Shape();
  sh.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
  sh.absarc(0, 0, R, a0, a1, false);
  sh.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  sh.absarc(0, 0, r, a1, a0, true);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: H,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 2,
    curveSegments: 72,
  });
  geo.rotateX(-Math.PI / 2);
  const wall = mesh(geo, mat.clay());
  const base = mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.1, 0.05, 28), mat.clayDark());
  base.position.y = 0.0;
  const embers = disc(r, mat.ember(), 0.035);
  embers.visible = false;

  const g = group();
  g.add(base, wall, embers);
  for (let i = 0; i < 3; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.8, 8), mat.woodDark());
    log.rotation.set(Math.PI / 2, 0, (i - 1) * 0.28);
    log.position.set((i - 1) * 0.14, 0.085, 0.5);
    g.add(log);
  }

  // Fire: flames licking out of the mouth and up around the pot, a glow in
  // the hearth, and a warm flickering light on everything nearby.
  const fire = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const f = makeFlame(0.26 + (i % 2) * 0.08, 0.5 + (i % 3) * 0.12);
    f.position.set((i - 2) * 0.12, 0.04, 0.42 + (i % 2) * 0.12);
    fire.add(f);
  }
  for (let i = 0; i < 9; i++) {
    const a = THREE.MathUtils.degToRad(-30 + (i / 8) * 240);
    const f = makeFlame(0.2, 0.3 + (i % 3) * 0.07);
    f.position.set(Math.cos(a) * 0.6, H - 0.07, -Math.sin(a) * 0.6);
    fire.add(f);
  }
  const hearth = makeGlow(0xff7a1a, 1.1, 0.3);
  hearth.position.set(0, 0.15, 0.45);
  fire.add(hearth);
  const light = new THREE.PointLight(0xff8a30, 0, 4.5, 1.6);
  light.position.set(0, 0.35, 0.75);
  g.add(light);
  fire.visible = false;
  g.add(fire);

  onFrame((dt, t) => {
    if (!fire.visible) return;
    const k = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 31);
    light.intensity = 1.5 * k;
    hearth.material.opacity = 0.26 * k;
  });

  g.userData.top = H + 0.03;
  g.userData.setFire = (on) => {
    fire.visible = on;
    embers.visible = on;
    if (!on) light.intensity = 0;
  };
  g.userData.keep = [fire];
  return g;
});

// ---------------------------------------------------------------------------
// Jalebi
// ---------------------------------------------------------------------------

function jalebiCurve(seed = 0) {
  const pts = [];
  const turns = 2.7;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * Math.PI * 2 + seed;
    const r = (0.016 + 0.092 * t) * (1 + 0.07 * Math.sin(a * 3 + seed * 2));
    pts.push(V3(Math.cos(a) * r, 0.004 * Math.sin(a * 2), Math.sin(a) * r));
  }
  // the squiggle that crosses back over the coils
  const end = turns * Math.PI * 2 + seed;
  for (let j = 1; j <= 7; j++) {
    const u = j / 7;
    const r = 0.108 * (1 - u * 1.05);
    const a = end + 0.55 * u;
    pts.push(V3(Math.cos(a) * r, 0.014 + 0.016 * Math.sin(Math.PI * u), Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

const jalebiGeoCache = {};
export function jalebiGeometry(variant = 0, detail = 'hi') {
  const key = variant + detail;
  if (!jalebiGeoCache[key]) {
    const curve = jalebiCurve(variant * 1.7);
    const geo =
      detail === 'hi' ? new THREE.TubeGeometry(curve, 150, 0.0195, 10) : new THREE.TubeGeometry(curve, 60, 0.0195, 6);
    geo.translate(0, 0.0195, 0);
    jalebiGeoCache[key] = geo;
  }
  return jalebiGeoCache[key];
}

/** What a jalebi looks like at each stage: pale batter, crisp, then glazed in syrup. */
export const JALEBI_LOOK = {
  raw: { color: COLORS.jalebiRaw, roughness: 0.75, clearcoat: 0, sheen: 0 },
  fried: { color: COLORS.jalebiFried, roughness: 0.5, clearcoat: 0.15, sheen: 0 },
  syrup: { color: COLORS.jalebiSyrup, roughness: 0.3, clearcoat: 1, sheen: 0 },
};

export function applyJalebiLook(m, stage) {
  const l = JALEBI_LOOK[stage];
  m.color.set(l.color);
  m.roughness = l.roughness;
  m.clearcoat = l.clearcoat;
}

export const jalebiMaterial = (stage = 'syrup') => {
  const m = new THREE.MeshPhysicalMaterial({
    metalness: 0,
    clearcoatRoughness: 0.12,
    normalMap: surf.crisp(),
    normalScale: new THREE.Vector2(0.5, 0.5),
    emissive: 0x7a2c00,
    emissiveIntensity: 0.12, // a little glow, as light passes through the sugar
  });
  applyJalebiLook(m, stage);
  return m;
};

let sharedSyrupMat = null;
export const sharedJalebiMaterial = () => sharedSyrupMat || (sharedSyrupMat = jalebiMaterial('syrup'));

// ---------------------------------------------------------------------------
// Serving ware
// ---------------------------------------------------------------------------

registerModel('paatal', () => {
  const geo = new THREE.RingGeometry(0.0001, 0.45, 36, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i)) / 0.45;
    pos.setZ(i, 0.012 + 0.035 * r * r);
  }
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const leaf = mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex.leaf(), roughness: 0.85, alphaTest: 0.5, side: THREE.DoubleSide }),
    { shadow: false },
  );
  const g = group();
  g.add(leaf);
  g.userData.surfaceY = 0.02;
  return g;
});

registerModel('tokri', () => {
  const body = mesh(
    lathe([V2(0.0001, 0.01), V2(0.3, 0.01), V2(0.43, 0.15), V2(0.47, 0.21)], 28),
    new THREE.MeshStandardMaterial({ map: tex.weave(), roughness: 0.9, side: THREE.DoubleSide }),
  );
  const rim = mesh(new THREE.TorusGeometry(0.47, 0.028, 8, 32), mat.color(0xa8742f, 0.85));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.21;
  const g = group();
  g.add(body, rim);
  g.userData.surfaceY = 0.03;
  return g;
});

registerModel('chowki', () => {
  const g = group();
  const top = mesh(new THREE.BoxGeometry(1.05, 0.06, 0.66), mat.wood());
  top.position.y = 0.19;
  g.add(top);
  for (const [x, z] of [
    [-0.45, -0.26],
    [0.45, -0.26],
    [-0.45, 0.26],
    [0.45, 0.26],
  ]) {
    const leg = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.17, 10), mat.woodDark());
    leg.position.set(x, 0.085, z);
    g.add(leg);
  }
  const cloth = mesh(new THREE.BoxGeometry(0.98, 0.012, 0.6), new THREE.MeshStandardMaterial({ map: tex.redCloth(), roughness: 0.9 }));
  cloth.position.y = 0.226;
  g.add(cloth);
  g.userData.surfaceY = 0.234;
  return g;
});

// Jhari: the covered water vessel placed beside the offering.
registerModel('jhari', () => {
  const g = group();
  const body = mesh(
    lathe([V2(0.0001, 0), V2(0.07, 0), V2(0.115, 0.05), V2(0.125, 0.12), V2(0.085, 0.2), V2(0.04, 0.26), V2(0.045, 0.3), V2(0.062, 0.315)], 20),
    mat.brass(),
  );
  const cover = mesh(new THREE.SphereGeometry(0.132, 16, 10, 0, Math.PI * 2, 0.9, 1.25), mat.red());
  cover.position.y = 0.115;
  const curve = new THREE.QuadraticBezierCurve3(V3(0.1, 0.08, 0), V3(0.2, 0.12, 0), V3(0.19, 0.27, 0));
  const spout = mesh(new THREE.TubeGeometry(curve, 10, 0.014, 6), mat.brass());
  g.add(body, cover, spout);
  return g;
});

registerModel('tulsi', () => {
  const g = group();
  const m = mat.color(0x3f9142, 0.7);
  for (const [x, r] of [
    [-0.035, 0.35],
    [0.035, -0.35],
  ]) {
    const leaf = mesh(new THREE.SphereGeometry(0.045, 10, 6), m, { shadow: false });
    leaf.scale.set(1, 0.12, 0.6);
    leaf.position.set(x, 0.008, 0);
    leaf.rotation.y = r;
    g.add(leaf);
  }
  const bud = mesh(new THREE.SphereGeometry(0.012, 6, 5), mat.color(0x8e5ea2, 0.6), { shadow: false });
  bud.position.y = 0.014;
  g.add(bud);
  return g;
});

// Standing oil lamp with a flickering flame.
registerModel('diya', () => {
  const g = group();
  const stand = mesh(
    lathe([V2(0.0001, 0), V2(0.11, 0), V2(0.1, 0.03), V2(0.03, 0.08), V2(0.025, 0.42), V2(0.06, 0.46), V2(0.1, 0.5)], 16),
    mat.brassDouble(),
  );
  const flame = makeFlame(0.11, 0.24);
  flame.position.y = 0.5;
  const glow = makeGlow(0xffb347, 0.5, 0.3);
  glow.position.y = 0.6;
  g.add(stand, glow, flame);
  const ph = Math.random() * 10;
  onFrame((dt, t) => {
    glow.material.opacity = 0.26 + 0.06 * Math.sin(t * 9 + ph);
  });
  return g;
});

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

// Jhanjh: the pair of brass cymbals that keeps time in haveli kirtan.
registerModel('jhanjh', () => {
  const g = group();
  const cup = () => {
    const c = mesh(lathe([V2(0.0001, 0.05), V2(0.035, 0.045), V2(0.05, 0.02), V2(0.105, 0.012), V2(0.11, 0)], 20), mat.brassDouble());
    return c;
  };
  const a = cup();
  const b = cup();
  a.position.set(-0.13, 0.02, 0);
  b.position.set(0.13, 0.02, 0);
  a.rotation.z = 0.35;
  b.rotation.z = -0.35;
  const curve = new THREE.QuadraticBezierCurve3(V3(-0.13, 0.07, 0), V3(0, 0.02, 0.1), V3(0.13, 0.07, 0));
  const cord = mesh(new THREE.TubeGeometry(curve, 12, 0.008, 5), mat.red(), { shadow: false });
  g.add(a, b, cord);
  g.userData.parts = { a, b };
  return g;
});

// Pakhawaj: the barrel drum of haveli sangeet, lying on its side.
registerModel('pakhawaj', () => {
  const g = group();
  const body = mesh(
    lathe([V2(0.15, -0.34), V2(0.2, -0.2), V2(0.225, 0), V2(0.2, 0.2), V2(0.15, 0.34)], 20),
    mat.color(0x9b3d12, 0.55),
  );
  const headM = mat.color(0xf3e3c2, 0.8);
  const h1 = mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 20), headM);
  h1.position.y = 0.345;
  const h2 = h1.clone();
  h2.position.y = -0.345;
  const drum = new THREE.Group();
  drum.add(body, h1, h2);
  for (const y of [-0.3, 0.3]) {
    const ring = mesh(new THREE.TorusGeometry(0.165, 0.014, 6, 20), mat.gold());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    drum.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rope = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 4), mat.white(), { shadow: false });
    rope.position.set(Math.cos(a) * 0.215, 0, Math.sin(a) * 0.215);
    rope.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    drum.add(rope);
  }
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 0.23;
  g.add(drum);
  return g;
});

registerModel('ghanti', () => {
  const g = group();
  const bell = mesh(
    lathe([V2(0.0001, 0.2), V2(0.03, 0.2), V2(0.055, 0.16), V2(0.07, 0.07), V2(0.1, 0.02), V2(0.12, 0)], 20),
    mat.brassDouble(),
  );
  const handle = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.14, 8), mat.brass());
  handle.position.y = 0.27;
  const knob = mesh(new THREE.SphereGeometry(0.03, 10, 8), mat.brass());
  knob.position.y = 0.35;
  g.add(bell, handle, knob);
  return g;
});

// Large hanging temple bell. Origin is the hook it swings from.
registerModel('ghanta', () => {
  const g = group();
  const chain = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mat.brass(), { shadow: false });
  chain.position.y = -0.25;
  const bell = mesh(
    lathe([V2(0.0001, 0.3), V2(0.06, 0.3), V2(0.1, 0.25), V2(0.12, 0.1), V2(0.17, 0.03), V2(0.2, 0)], 22),
    mat.brassDouble(),
  );
  bell.position.y = -0.8;
  const clapper = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat.brass(), { shadow: false });
  clapper.position.y = -0.8;
  g.add(chain, bell, clapper);
  return g;
});

// A single green cardamom pod.
registerModel('elaichi', () => {
  const g = group();
  const pod = mesh(new THREE.SphereGeometry(0.05, 10, 8), mat.color(COLORS.elaichi, 0.75));
  pod.scale.set(1.5, 0.85, 0.85);
  pod.position.y = 0.042;
  g.add(pod);
  return g;
});

// Small brass plate the cardamom sits on.
registerModel('thali', () => {
  const g = group();
  const plate = mesh(lathe([V2(0.0001, 0.008), V2(0.24, 0.008), V2(0.3, 0.035)], 28), mat.brassDouble());
  g.add(plate);
  return g;
});

/** A heap of syrupy jalebis as one instanced mesh (one draw call). */
export function jalebiPile(count, radius, baseY = 0) {
  const inst = new THREE.InstancedMesh(jalebiGeometry(0, 'lo'), sharedJalebiMaterial(), count);
  inst.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const slots = [];
  // Rings that get smaller as the heap rises, so it grows into a mound.
  for (let layer = 0; slots.length < count; layer++) {
    const r = radius * Math.max(0, 0.82 - layer * 0.11);
    const n = r < 0.06 ? 1 : 1 + Math.floor((2 * Math.PI * r) / 0.17);
    for (let k = 0; k < n && slots.length < count; k++) {
      const a = (k / Math.max(1, n - 1)) * Math.PI * 2 + layer * 0.7;
      const rr = k === 0 ? Math.min(r, 0.04) : r;
      const p = V3(Math.cos(a) * rr, baseY + layer * 0.034, Math.sin(a) * rr);
      e.set((Math.random() - 0.5) * 0.35, Math.random() * 6, (Math.random() - 0.5) * 0.35);
      q.setFromEuler(e);
      slots.push({ p, q: q.clone() });
    }
  }
  slots.forEach((s, i) => {
    m.compose(s.p, s.q, V3(0, 0, 0)); // hidden until revealed
    inst.setMatrixAt(i, m);
  });
  inst.userData.slots = slots;
  inst.userData.shown = 0;
  inst.userData.reveal = (n) => {
    const to = Math.min(count, n);
    for (let i = inst.userData.shown; i < to; i++) {
      m.compose(slots[i].p, slots[i].q, V3(1, 1, 1));
      inst.setMatrixAt(i, m);
    }
    inst.userData.shown = Math.max(inst.userData.shown, to);
    inst.instanceMatrix.needsUpdate = true;
  };
  /** Top of the heap, in the basket's own units. */
  inst.userData.top = () => {
    const n = inst.userData.shown;
    if (!n) return baseY;
    let top = baseY;
    for (let i = 0; i < n; i++) top = Math.max(top, slots[i].p.y);
    return top + 0.045;
  };
  return inst;
}
