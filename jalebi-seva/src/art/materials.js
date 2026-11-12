import * as THREE from 'three';
import { surf } from './surfaces.js';

// Shared materials and hand-painted canvas textures. Nothing here loads a
// file: every surface is either a flat colour or drawn at start-up.

export function canvasTex(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const std = (color, roughness = 0.7, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const cache = {};
const once = (key, fn) => cache[key] || (cache[key] = fn());

export const COLORS = {
  batterRaw: 0xfff3d0,
  jalebiRaw: 0xffe6a8,
  jalebiFried: 0xf27a02,
  jalebiSyrup: 0xee6f04,
  ghee: 0xb46f0c,
  syrupClear: 0xfff1c9,
  syrupKesar: 0xf5a623,
  kesar: 0xd9480f,
  elaichi: 0x8fb04a,
};

const NS = (v) => new THREE.Vector2(v, v);

export const mat = {
  brass: () => once('brass', () => std(0xd9a035, 0.3, 1, { normalMap: surf.hammered(), normalScale: NS(0.5) })),
  gold: () => once('gold', () => std(0xf0bc45, 0.24, 1, { normalMap: surf.hammered([8, 3]), normalScale: NS(0.25) })),
  steel: () =>
    once('steel', () => std(0xd5dadd, 0.2, 1, { side: THREE.DoubleSide, normalMap: surf.brushed(), normalScale: NS(0.35) })),
  brassDouble: () =>
    once('brassD', () => std(0xd9a035, 0.3, 1, { side: THREE.DoubleSide, normalMap: surf.hammered(), normalScale: NS(0.5) })),
  iron: () =>
    once('iron', () => std(0x26252a, 0.55, 0.85, { side: THREE.DoubleSide, normalMap: surf.hammered([7, 3]), normalScale: NS(0.6) })),
  clay: () =>
    once('clay', () =>
      std(0xffffff, 0.95, 0, { map: surf.mottle(0xb5653a, [2, 2], 0.45), normalMap: surf.rough([2, 2], 3.2), normalScale: NS(1) }),
    ),
  clayDark: () =>
    once('clayDark', () => std(0xffffff, 0.95, 0, { map: surf.mottle(0x7a3f22, [3, 3], 0.4), normalMap: surf.rough([3, 3], 3), normalScale: NS(1) })),
  wood: () => once('wood', () => std(0xffffff, 0.7, 0, { ...surf.wood(0x8a5a2b, [1, 1]), normalScale: NS(0.8) })),
  woodDark: () => once('woodDark', () => std(0xffffff, 0.8, 0, { ...surf.wood(0x5c3a1a, [1, 2]), normalScale: NS(1) })),
  white: () => once('white', () => std(0xfffdf6, 0.75, 0, { normalMap: surf.cloth(), normalScale: NS(0.35) })),
  red: () => once('red', () => std(0xc1121f, 0.8, 0, { normalMap: surf.cloth(), normalScale: NS(0.4) })),
  black: () => once('black', () => std(0x1b1b1f, 0.5)),
  ember: () => once('ember', () => new THREE.MeshBasicMaterial({ color: 0xff6a1f, toneMapped: false })),
  color: (hex, rough = 0.7, metal = 0) => once(`c${hex}_${rough}_${metal}`, () => std(hex, rough, metal)),
  /** Soft cloth in any colour (clothes, cushions). */
  cloth: (hex, rough = 0.85) =>
    once(`cl${hex}_${rough}`, () => std(hex, rough, 0, { normalMap: surf.cloth([8, 8]), normalScale: NS(0.45) })),
  /** Painted plaster wall. */
  plaster: (hex) =>
    once(`pl${hex}`, () => std(0xffffff, 0.95, 0, { map: surf.mottle(hex, [3, 2], 0.22, 13), normalMap: surf.rough([6, 3], 1.6, 17), normalScale: NS(0.6) })),
  /** Tiled floor. */
  floor: (a, b, reps, rough = 0.85, metal = 0) =>
    once(`fl${a}${b}${reps}`, () => std(0xffffff, rough, metal, { ...surf.tiles(a, b, reps), normalScale: NS(0.9) })),
  /** A fresh (uncached) material for things whose colour animates. */
  fresh: (hex, rough = 0.7, metal = 0, extra = {}) => std(hex, rough, metal, extra),
  /** A liquid surface: glossy, gently rippling. */
  liquid: (hex, opacity = 0.93) =>
    new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness: 0.16,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity,
      normalMap: surf.ripples(),
      normalScale: NS(0.35),
      envMapIntensity: 0.25,
    }),
};

// ---- textures ----------------------------------------------------------------

export const tex = {
  /** Stitched leaf plate (pattal), seen from above. */
  leaf: () =>
    once('leafTex', () =>
      canvasTex(512, 512, (g, s) => {
        g.translate(s / 2, s / 2);
        const greens = ['#7f9a3e', '#8fa94a', '#728d36', '#86a043'];
        const R = s * 0.47;
        // round base so the plate reads as a plate
        g.fillStyle = '#6d8833';
        g.beginPath();
        g.arc(0, 0, R * 0.97, 0, Math.PI * 2);
        g.fill();
        const n = 7;
        for (let i = 0; i < n; i++) {
          g.save();
          g.rotate((i / n) * Math.PI * 2);
          g.fillStyle = greens[i % greens.length];
          g.beginPath();
          g.moveTo(0, R * 0.12);
          g.bezierCurveTo(R * 0.78, R * 0.02, R * 0.62, -R * 0.9, 0, -R);
          g.bezierCurveTo(-R * 0.62, -R * 0.9, -R * 0.78, R * 0.02, 0, R * 0.12);
          g.fill();
          g.strokeStyle = 'rgba(52,72,22,0.55)';
          g.lineWidth = 3;
          g.stroke();
          // midrib and veins
          g.strokeStyle = 'rgba(226,236,180,0.5)';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(0, R * 0.05);
          g.lineTo(0, -R * 0.95);
          g.stroke();
          g.lineWidth = 1.6;
          g.beginPath();
          for (let k = 1; k < 7; k++) {
            const y = -k * R * 0.13;
            const w = R * 0.36 * (1 - k / 9);
            g.moveTo(0, y);
            g.quadraticCurveTo(w * 0.6, y - R * 0.03, w, y - R * 0.1);
            g.moveTo(0, y);
            g.quadraticCurveTo(-w * 0.6, y - R * 0.03, -w, y - R * 0.1);
          }
          g.stroke();
          g.restore();
        }
        // the little twig stitches that hold the leaves together
        g.strokeStyle = '#e8d6a0';
        g.lineWidth = 5;
        g.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + 0.22;
          const r = (i % 2 ? 0.42 : 0.7) * R;
          g.beginPath();
          g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a + 0.16) * (r + 0.07 * R), Math.sin(a + 0.16) * (r + 0.07 * R));
          g.stroke();
        }
        // darker rim
        g.strokeStyle = 'rgba(60,80,24,0.5)';
        g.lineWidth = 6;
        g.beginPath();
        g.arc(0, 0, R * 0.985, 0, Math.PI * 2);
        g.stroke();
      }),
    ),

  weave: () =>
    once('weaveTex', () =>
      canvasTex(
        64,
        64,
        (g, s) => {
          g.fillStyle = '#c9954c';
          g.fillRect(0, 0, s, s);
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
              g.fillStyle = (x + y) % 2 ? '#e0b46a' : '#a8742f';
              if ((x + y) % 2) g.fillRect(x * 16 + 1, y * 16 + 4, 14, 8);
              else g.fillRect(x * 16 + 4, y * 16 + 1, 8, 14);
            }
          }
        },
        { repeat: [10, 3] },
      ),
    ),

  /** Red cloth with a gold border, for the offering stool and cushions. */
  redCloth: () =>
    once('redCloth', () =>
      canvasTex(256, 256, (g, s) => {
        g.fillStyle = '#b3122a';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#f2c14e';
        g.lineWidth = 14;
        g.strokeRect(12, 12, s - 24, s - 24);
        g.lineWidth = 3;
        g.strokeRect(30, 30, s - 60, s - 60);
        g.fillStyle = '#f2c14e';
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            g.beginPath();
            g.arc(58 + i * 35, 58 + j * 35, 3.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }),
    ),

  /** Velvet curtain with gold trim along the bottom and the inner edge. */
  curtain: () =>
    once('curtain', () =>
      canvasTex(256, 512, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#8f0f24');
        grd.addColorStop(1, '#c1121f');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#f2c14e';
        g.fillRect(0, h - 46, w, 30);
        g.fillRect(0, h - 10, w, 10);
        g.fillStyle = '#ffe9a8';
        for (let i = 0; i < 8; i++) {
          g.beginPath();
          g.arc(16 + i * 32, h - 31, 7, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = 'rgba(242,193,78,0.85)';
        for (let y = 40; y < h - 80; y += 70) {
          for (let x = 30; x < w; x += 65) {
            const xx = x + ((y / 70) % 2) * 32;
            g.beginPath();
            g.moveTo(xx, y - 9);
            g.lineTo(xx + 7, y);
            g.lineTo(xx, y + 9);
            g.lineTo(xx - 7, y);
            g.fill();
          }
        }
      }),
    ),

  tiles: (a = '#c97b4a', b = '#b96a3c', reps = 8) =>
    once(`tiles${a}${b}${reps}`, () =>
      canvasTex(
        128,
        128,
        (g, s) => {
          g.fillStyle = a;
          g.fillRect(0, 0, s, s);
          g.fillStyle = b;
          g.fillRect(0, 0, s / 2, s / 2);
          g.fillRect(s / 2, s / 2, s / 2, s / 2);
          g.strokeStyle = 'rgba(0,0,0,0.12)';
          g.lineWidth = 2;
          g.strokeRect(0, 0, s / 2, s / 2);
          g.strokeRect(s / 2, s / 2, s / 2, s / 2);
        },
        { repeat: [reps, reps] },
      ),
    ),

  /** Painted temple backdrop: night-blue cloth with lotuses and a gold border. */
  pichwai: () =>
    once('pichwai', () =>
      canvasTex(512, 512, (g, s) => {
        const grd = g.createLinearGradient(0, 0, 0, s);
        grd.addColorStop(0, '#162a5c');
        grd.addColorStop(1, '#0f1c40');
        g.fillStyle = grd;
        g.fillRect(0, 0, s, s);
        const lotus = (x, y, r, col) => {
          g.save();
          g.translate(x, y);
          g.fillStyle = col;
          for (let i = -2; i <= 2; i++) {
            g.save();
            g.rotate(i * 0.42);
            g.beginPath();
            g.ellipse(0, -r * 0.55, r * 0.26, r * 0.62, 0, 0, Math.PI * 2);
            g.fill();
            g.restore();
          }
          g.fillStyle = '#f2c14e';
          g.beginPath();
          g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
          g.fill();
          g.restore();
        };
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 6; col++) {
            const x = 50 + col * 82 + (row % 2) * 40;
            const y = 70 + row * 78;
            lotus(x, y, 26, row % 2 ? '#ffb3c6' : '#fff0f3');
            g.strokeStyle = '#3f8f5b';
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(x, y + 4);
            g.quadraticCurveTo(x + 10, y + 22, x - 6, y + 36);
            g.stroke();
          }
        }
        g.strokeStyle = '#f2c14e';
        g.lineWidth = 18;
        g.strokeRect(9, 9, s - 18, s - 18);
        g.strokeStyle = '#b3122a';
        g.lineWidth = 6;
        g.strokeRect(24, 24, s - 48, s - 48);
      }),
    ),

  /** Long floor runner the diners sit on. */
  runner: () =>
    once('runner', () =>
      canvasTex(
        128,
        64,
        (g, w, h) => {
          g.fillStyle = '#a4161a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#f2c14e';
          g.fillRect(0, 0, w, 7);
          g.fillRect(0, h - 7, w, 7);
          g.fillStyle = '#ffd98a';
          for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.moveTo(16 + i * 32, h / 2 - 12);
            g.lineTo(26 + i * 32, h / 2);
            g.lineTo(16 + i * 32, h / 2 + 12);
            g.lineTo(6 + i * 32, h / 2);
            g.fill();
          }
        },
        { repeat: [6, 1] },
      ),
    ),
};
