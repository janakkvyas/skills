import * as THREE from 'three';
import { make, textureOverride } from '../engine/assets.js';
import { mat, tex, canvasTex } from './materials.js';
import { toran } from './deco.js';
import './props.js';
import './people.js';
import './shreenathji.js';

// Builds the three places the game happens in – the halwai's rasoi, the
// mandir and the pangat – side by side in one scene. Only one is visible at
// a time. Every object the steps need is created here and handed back.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const AREAS = {
  kitchen: V3(0, 0, 0),
  mandir: V3(40, 0, 0),
  pangat: V3(80, 0, 0),
};

/** Camera stations: where the halwai's eyes are, and what they look at. */
export const STATIONS = {
  prep: { pos: V3(-3.6, 1.95, 2.55), look: V3(-3.6, 0.12, 0.25) },
  chaasni: { pos: V3(0, 2.0, 2.75), look: V3(0, 0.3, 0.3) },
  kadhai: { pos: V3(1.25, 2.3, 2.45), look: V3(1.25, 0.3, 0.1) },
  dip: { pos: V3(1.0, 2.35, 3.15), look: V3(1.0, 0.3, 0.0) },
  plate: { pos: V3(0, 2.35, 3.35), look: V3(0, 0.22, 0.55) },
  mandir: { pos: V3(40, 1.66, 3.35), look: V3(40, 1.52, -2.0) },
  kirtan: { pos: V3(40, 2.25, 4.3), look: V3(40, 0.8, 0.0) },
  darshan: { pos: V3(40, 1.7, 2.3), look: V3(40, 1.62, -2.5) },
  serve: { pos: V3(80, 2.45, 3.5), look: V3(80, 0.4, -0.55) },
  eat: { pos: V3(80, 1.3, 2.75), look: V3(80, 0.42, -0.3) },
};

function plane(w, h, material, receive = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.receiveShadow = receive;
  return m;
}

function floor(w, d, material) {
  const f = plane(w, d, material);
  f.rotation.x = -Math.PI / 2;
  return f;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const swirlTex = () =>
  canvasTex(256, 256, (g, s) => {
    g.translate(s / 2, s / 2);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      g.lineWidth = 7;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = arm * ((Math.PI * 2) / 3) + t * 3.6;
        const r = (0.08 + 0.36 * t) * s;
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.stroke();
    }
  });

/** A translucent spiral laid on a liquid, spun while the child stirs. */
export function makeSwirl(radius) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, opacity: 0, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------------------

function buildKitchen() {
  const g = new THREE.Group();
  const fl = floor(16, 12, new THREE.MeshStandardMaterial({ map: tex.tiles('#cf8a55', '#c27c48', 10), roughness: 0.95 }));
  g.add(fl);
  const wall = plane(16, 6, mat.color(0xf7dba7, 0.95));
  wall.position.set(0, 3, -2.4);
  g.add(wall);
  const dado = plane(16, 1.0, mat.color(0xc8553d, 0.95));
  dado.position.set(0, 0.5, -2.39);
  g.add(dado);
  const stripe = plane(16, 0.08, mat.color(0xf2c14e, 0.8));
  stripe.position.set(0, 1.04, -2.385);
  g.add(stripe);

  // a shelf of brass pots, purely for atmosphere
  const shelf = box(7, 0.07, 0.42, mat.wood());
  shelf.position.set(0, 1.75, -2.18);
  g.add(shelf);
  const potGeo = new THREE.LatheGeometry(
    [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.12, 0), new THREE.Vector2(0.2, 0.1), new THREE.Vector2(0.17, 0.26), new THREE.Vector2(0.1, 0.32), new THREE.Vector2(0.13, 0.36)],
    16,
  );
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Mesh(potGeo, i % 3 === 1 ? mat.steel() : mat.brassDouble());
    const s = 0.8 + ((i * 37) % 5) * 0.09;
    p.scale.setScalar(s);
    p.position.set(-3 + i * 1.0, 1.785, -2.18);
    g.add(p);
  }
  g.add(toran(V3(-4.2, 3.05, -2.3), V3(4.2, 3.05, -2.3), { sag: 0.3, n: 60, drops: 12 }));

  // --- prep corner ---
  const bowl = make('bowl');
  bowl.position.set(-3.6, 0, 0.1);
  const maida = make('katori', 'maida');
  maida.scale.setScalar(1.35);
  maida.position.set(-4.4, 0, 0.75);
  const dahi = make('katori', 'dahi');
  dahi.scale.setScalar(1.35);
  dahi.position.set(-3.6, 0, 1.05);
  const paani = make('lota');
  paani.position.set(-2.8, 0, 0.75);
  const spoon = make('spoon');
  spoon.visible = false;
  g.add(bowl, maida, dahi, paani, spoon);

  // --- chaasni chulha ---
  const chulhaA = make('chulha');
  chulhaA.position.set(0, 0, 0);
  const pot = make('pot');
  pot.position.set(0, chulhaA.userData.top, 0);
  const sugar = make('katori', 'sugar');
  sugar.scale.setScalar(1.5);
  sugar.position.set(-0.95, 0, 1.05);
  const paani2 = make('lota');
  paani2.position.set(0.95, 0, 1.05);
  sugar.visible = false;
  paani2.visible = false;
  const kesar = make('katori', 'kesar');
  kesar.scale.setScalar(1.5);
  kesar.position.set(-0.95, 0, 1.05);
  kesar.visible = false;
  const thali = make('thali');
  thali.position.set(0.95, 0, 1.05);
  thali.visible = false;
  const pods = [];
  for (let i = 0; i < 3; i++) {
    const p = make('elaichi');
    p.scale.setScalar(1.25);
    p.position.set(0.95 + (i - 1) * 0.17, 0.02, 1.05 + (i % 2) * 0.09 - 0.04);
    p.rotation.y = i * 1.1;
    p.visible = false;
    pods.push(p);
    g.add(p);
  }
  g.add(chulhaA, pot, sugar, paani2, kesar, thali);

  // --- frying chulha ---
  const chulhaB = make('chulha');
  chulhaB.position.set(2.0, 0, 0);
  const kadhai = make('kadhai');
  kadhai.position.set(2.0, chulhaB.userData.top - 0.085, 0);
  const bag = make('pipingBag');
  bag.visible = false;
  g.add(chulhaB, kadhai, bag);

  // --- the tokri the jalebis go into (appears later) ---
  const tokri = make('tokri');
  tokri.position.set(0.55, 0, 1.35);
  tokri.visible = false;
  g.add(tokri);

  return { group: g, bowl, maida, dahi, paani, spoon, chulhaA, pot, sugar, paani2, kesar, thali, pods, chulhaB, kadhai, bag, tokri };
}

// ---------------------------------------------------------------------------

function archWall({ width = 14, height = 5.6, openW = 3.7, springY = 2.25, rise = 0.9, lobes = 5 }) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();
  const rx = openW / 2;
  const edge = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI - (Math.PI * i) / N;
    const bump = 0.14 * Math.abs(Math.sin(lobes * th));
    edge.push(new THREE.Vector2(Math.cos(th) * (rx + bump), springY + Math.sin(th) * (rise + bump)));
  }
  const hole = new THREE.Path();
  hole.moveTo(-rx, 0);
  hole.lineTo(-rx, springY);
  for (const p of edge) hole.lineTo(p.x, p.y);
  hole.lineTo(rx, 0);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  const wall = new THREE.Mesh(geo, mat.color(0xf3c98b, 0.95));
  wall.receiveShadow = true;
  wall.castShadow = true;
  const trimPts = [V3(-rx, 0, 0.32), V3(-rx, springY, 0.32), ...edge.map((p) => V3(p.x, p.y, 0.32)), V3(rx, 0, 0.32)];
  const trim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts, false, 'catmullrom', 0.1), 160, 0.05, 6), mat.gold());
  const g = new THREE.Group();
  g.add(wall, trim);
  return g;
}

function curtainHalf(side, w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 30, 1);
  geo.translate(w / 2, h / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 8) * 0.07);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex.curtain(), roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(m);
  pivot.userData.side = side;
  return pivot;
}

function buildMandir() {
  const g = new THREE.Group();
  g.position.copy(AREAS.mandir);
  g.add(floor(16, 14, new THREE.MeshStandardMaterial({ map: tex.tiles('#f7ead8', '#e9c9b0', 9), roughness: 0.4, metalness: 0.05 })));

  const back = plane(16, 6, mat.color(0x7a1f2b, 0.95));
  back.position.set(0, 3, -3.4);
  g.add(back);
  // The family can supply its own pichwai picture (manifest "textures").
  const pichwai = plane(4.6, 3.7, new THREE.MeshStandardMaterial({ map: textureOverride('pichwai') || tex.pichwai(), roughness: 0.9 }));
  pichwai.position.set(0, 2.2, -3.36);
  g.add(pichwai);

  const dais = box(6.4, 0.3, 2.7, mat.color(0xfff4e0, 0.5));
  dais.position.set(0, 0.15, -2.15);
  g.add(dais);
  const lip = box(6.4, 0.05, 0.06, mat.gold());
  lip.position.set(0, 0.285, -0.79);
  g.add(lip);

  const sinhasan = make('sinhasan');
  sinhasan.position.set(0, 0.3, -2.6);
  const deity = make('shreenathji');
  deity.position.set(0, 0.3 + sinhasan.userData.surfaceY, -2.6);
  deity.scale.setScalar(1.1);
  const chowki = make('chowki');
  chowki.position.set(0, 0.3, -1.45);
  g.add(sinhasan, deity, chowki);

  const diyas = [];
  for (const sx of [-1, 1]) {
    const d = make('diya');
    d.scale.setScalar(1.5);
    d.position.set(sx * 1.45, 0.3, -1.25);
    diyas.push(d);
    g.add(d);
  }

  const arch = archWall({});
  arch.position.set(0, 0, -0.78);
  g.add(arch);
  g.add(toran(V3(-1.75, 2.72, -0.42), V3(1.75, 2.72, -0.42), { sag: 0.34, n: 34, drops: 7 }));

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 8), mat.gold());
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 3.42, -0.9);
  g.add(rod);
  const curtainW = 1.95;
  const curtainL = curtainHalf(-1, curtainW, 3.15);
  curtainL.position.set(-curtainW, 0.3, -0.9);
  const curtainR = curtainHalf(1, curtainW, 3.15);
  curtainR.position.set(curtainW, 0.3, -0.9);
  g.add(curtainL, curtainR);
  const OPEN = 0.22;
  const setCurtain = (half, k) => {
    half.userData.k = k;
    const s = OPEN + (1 - OPEN) * k;
    half.scale.x = half.userData.side < 0 ? s : -s;
  };
  setCurtain(curtainL, 0);
  setCurtain(curtainR, 0);

  // kirtan corner
  const rug = floor(3.6, 1.5, new THREE.MeshStandardMaterial({ map: tex.redCloth(), roughness: 0.95 }));
  rug.position.set(0, 0.006, 0.95);
  const pakhawaj = make('pakhawaj');
  pakhawaj.scale.setScalar(1.35);
  pakhawaj.position.set(-1.15, 0, 0.85);
  pakhawaj.rotation.y = 0.35;
  const jhanjh = make('jhanjh');
  jhanjh.scale.setScalar(1.7);
  jhanjh.position.set(0, 0, 1.1);
  const ghanti = make('ghanti');
  ghanti.scale.setScalar(1.6);
  ghanti.position.set(1.15, 0, 0.85);
  g.add(rug, pakhawaj, jhanjh, ghanti);
  const kirtanSet = [rug, pakhawaj, jhanjh, ghanti];
  kirtanSet.forEach((o) => (o.visible = false));

  const ghanta = make('ghanta');
  ghanta.position.set(2.5, 3.35, -0.35);
  g.add(ghanta);

  const jhari = make('jhari');
  jhari.scale.setScalar(1.25);
  jhari.visible = false;
  const tulsi = make('tulsi');
  tulsi.scale.setScalar(1.6);
  tulsi.visible = false;
  g.add(jhari, tulsi);

  return { group: g, deity, sinhasan, chowki, diyas, curtainL, curtainR, setCurtain, pakhawaj, jhanjh, ghanti, kirtanSet, ghanta, jhari, tulsi };
}

// ---------------------------------------------------------------------------

function buildPangat() {
  const g = new THREE.Group();
  g.position.copy(AREAS.pangat);
  g.add(floor(16, 14, new THREE.MeshStandardMaterial({ map: tex.tiles('#f1dcae', '#e9cf99', 9), roughness: 0.9 })));
  const wall = plane(16, 6, mat.color(0xfde8b8, 0.95));
  wall.position.set(0, 3, -2.9);
  g.add(wall);
  const dado = plane(16, 0.9, mat.color(0xe07a5f, 0.95));
  dado.position.set(0, 0.45, -2.89);
  g.add(dado);
  // arched niches along the wall
  for (let i = -2; i <= 2; i++) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.5, 0);
    sh.lineTo(0.5, 0);
    sh.lineTo(0.5, 0.9);
    sh.absarc(0, 0.9, 0.5, 0, Math.PI, false);
    sh.lineTo(-0.5, 0);
    const niche = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), mat.color(i % 2 ? 0xf2b880 : 0xeec48a, 0.95));
    niche.position.set(i * 1.9, 1.35, -2.88);
    g.add(niche);
  }
  g.add(toran(V3(-4.6, 3.3, -2.8), V3(4.6, 3.3, -2.8), { sag: 0.3, n: 64, drops: 13 }));

  const runner = floor(8.2, 1.15, new THREE.MeshStandardMaterial({ map: tex.runner(), roughness: 0.95 }));
  runner.position.set(0, 0.006, -1.25);
  g.add(runner);

  const kinds = ['dada', 'ben', 'bal', 'bhai'];
  const people = [];
  const seats = [];
  kinds.forEach((kind, i) => {
    const x = (i - 1.5) * 1.5;
    const z = -1.3 + Math.abs(i - 1.5) * 0.14;
    const p = make('vaishnav', kind);
    p.position.set(x, 0, z);
    p.rotation.y = -(i - 1.5) * 0.14;
    g.add(p);
    people.push(p);
    seats.push(V3(AREAS.pangat.x + x * 0.97, 0.008, z + 0.98));
  });
  const ownSeat = V3(AREAS.pangat.x, 0.008, 0.72);
  return { group: g, people, seats, ownSeat };
}

// ---------------------------------------------------------------------------

export function buildWorld(scene) {
  const kitchen = buildKitchen();
  const mandir = buildMandir();
  const pangat = buildPangat();
  scene.add(kitchen.group, mandir.group, pangat.group);
  const areas = { kitchen, mandir, pangat };
  const world = {
    kitchen,
    mandir,
    pangat,
    current: null,
    show(name) {
      for (const [k, a] of Object.entries(areas)) a.group.visible = k === name;
      world.current = name;
    },
  };
  world.show('kitchen');
  return world;
}
