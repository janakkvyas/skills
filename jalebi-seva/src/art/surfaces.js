import * as THREE from 'three';

// Procedural surface detail: every bump, grain and dimple in the game is
// drawn into a canvas at start-up and turned into a normal map, so metal
// looks beaten, clay looks hand-patted and wood has grain, with no image
// files at all. Also the fire shader.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Seeded random, so the textures are the same on every run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Tileable-ish soft noise: random grids blown up and layered. Returns a canvas (grey). */
export function fbm(size, { octaves = 4, base = 4, seed = 1, contrast = 1 } = {}) {
  const out = canvas(size, size);
  const g = out.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  const r = rng(seed);
  let amp = 0.5;
  for (let o = 0; o < octaves; o++) {
    const n = base * 2 ** o;
    const small = canvas(n, n);
    const sg = small.getContext('2d');
    const img = sg.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = Math.floor(r() * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.globalAlpha = Math.min(1, amp * contrast);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, size, size);
    amp *= 0.55;
  }
  g.globalAlpha = 1;
  return out;
}

/** Turn a grey height canvas into a tangent-space normal map texture. */
export function normalFromHeight(height, strength = 2, repeat = null) {
  const w = height.width;
  const h = height.height;
  const src = height.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const g = out.getContext('2d');
  const img = g.createImageData(w, h);
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx / l) * 127 + 128;
      img.data[i + 1] = (dy / l) * 127 + 128;
      img.data[i + 2] = (1 / l) * 127 + 128;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

function colorTex(c, repeat = null) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

const cache = {};
const once = (k, fn) => cache[k] || (cache[k] = fn());

export const surf = {
  /** Hand-beaten metal: a field of soft dimples. */
  hammered: (repeat = [5, 2]) =>
    once('hammered' + repeat, () => {
      const s = 256;
      const c = canvas(s, s);
      const g = c.getContext('2d');
      g.fillStyle = '#808080';
      g.fillRect(0, 0, s, s);
      const r = rng(7);
      for (let i = 0; i < 260; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = 9 + r() * 12;
        for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
          const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
          grd.addColorStop(0, 'rgba(40,40,40,0.55)');
          grd.addColorStop(0.7, 'rgba(110,110,110,0.2)');
          grd.addColorStop(1, 'rgba(128,128,128,0)');
          g.fillStyle = grd;
          g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
        }
      }
      return normalFromHeight(c, 2.2, repeat);
    }),

  /** Fine brushed scratches, for steel and iron. */
  brushed: (repeat = [3, 1]) =>
    once('brushed' + repeat, () => {
      const s = 256;
      const c = fbm(s, { octaves: 5, base: 8, seed: 21 });
      const g = c.getContext('2d');
      const r = rng(3);
      for (let i = 0; i < 500; i++) {
        g.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.07)`;
        g.lineWidth = 1;
        const y = r() * s;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(s, y + (r() - 0.5) * 4);
        g.stroke();
      }
      return normalFromHeight(c, 1.4, repeat);
    }),

  /** Lumpy hand-patted clay / plaster. */
  rough: (repeat = [2, 2], strength = 2.4, seed = 5) =>
    once('rough' + repeat + strength + seed, () => normalFromHeight(fbm(256, { octaves: 5, base: 4, seed }), strength, repeat)),

  /** Mottled colour, multiplied over a flat tint. */
  mottle: (hex, repeat = [2, 2], amount = 0.35, seed = 9) =>
    once('mottle' + hex + repeat + amount, () => {
      const s = 256;
      const n = fbm(s, { octaves: 4, base: 3, seed });
      const c = canvas(s, s);
      const g = c.getContext('2d');
      g.fillStyle = '#' + new THREE.Color(hex).getHexString();
      g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = amount * 2;
      g.drawImage(n, 0, 0);
      return colorTex(c, repeat);
    }),

  /** Wood: colour with grain rings, and a matching normal map. */
  wood: (hex, repeat = [1, 1]) =>
    once('wood' + hex + repeat, () => {
      const s = 256;
      const col = canvas(s, s);
      const hgt = canvas(s, s);
      const g = col.getContext('2d');
      const hg = hgt.getContext('2d');
      const base = new THREE.Color(hex);
      g.fillStyle = '#' + base.getHexString();
      g.fillRect(0, 0, s, s);
      hg.fillStyle = '#808080';
      hg.fillRect(0, 0, s, s);
      const r = rng(11);
      const dark = '#' + base.clone().multiplyScalar(0.62).getHexString();
      const light = '#' + base.clone().lerp(new THREE.Color(0xffffff), 0.18).getHexString();
      for (let i = 0; i < 46; i++) {
        const y0 = r() * s;
        const amp = 2 + r() * 7;
        const f = 0.01 + r() * 0.03;
        const ph = r() * 6;
        const w = 0.6 + r() * 2.2;
        const isDark = r() > 0.35;
        for (const [ctx, style] of [[g, isDark ? dark : light], [hg, isDark ? '#404040' : '#b0b0b0']]) {
          ctx.strokeStyle = style;
          ctx.globalAlpha = 0.25 + r() * 0.4;
          ctx.lineWidth = w;
          ctx.beginPath();
          for (let x = 0; x <= s; x += 8) {
            const y = y0 + Math.sin(x * f + ph) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      return { map: colorTex(col, repeat), normalMap: normalFromHeight(hgt, 1.6, repeat) };
    }),

  /** Checked floor tiles with sunken grout, slight wear, and a normal map. */
  tiles: (a, b, reps, { grout = '#8a6a50' } = {}) =>
    once('tiles' + a + b + reps, () => {
      const s = 512;
      const col = canvas(s, s);
      const hgt = canvas(s, s);
      const g = col.getContext('2d');
      const hg = hgt.getContext('2d');
      const half = s / 2;
      const gw = 7;
      g.fillStyle = grout;
      g.fillRect(0, 0, s, s);
      hg.fillStyle = '#303030';
      hg.fillRect(0, 0, s, s);
      const round = (ctx, x, y, w, h, rad) => {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
      };
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          const x = tx * half + gw / 2;
          const y = ty * half + gw / 2;
          const w = half - gw;
          g.fillStyle = (tx + ty) % 2 ? b : a;
          round(g, x, y, w, w, 10);
          g.fill();
          // bevelled edge in the height map
          for (let k = 0; k < 6; k++) {
            hg.fillStyle = `rgb(${90 + k * 26},${90 + k * 26},${90 + k * 26})`;
            round(hg, x + k, y + k, w - k * 2, w - k * 2, 10);
            hg.fill();
          }
        }
      }
      // wear and variation
      const n = fbm(s, { octaves: 5, base: 6, seed: 31 });
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.55;
      g.drawImage(n, 0, 0);
      hg.globalCompositeOperation = 'soft-light';
      hg.globalAlpha = 0.5;
      hg.drawImage(n, 0, 0);
      return { map: colorTex(col, [reps, reps]), normalMap: normalFromHeight(hgt, 2.4, [reps, reps]) };
    }),

  /** Gentle ripples for liquid surfaces (scrolled at run time). */
  ripples: () => once('ripples', () => normalFromHeight(fbm(256, { octaves: 4, base: 5, seed: 77 }), 3, [2, 2])),

  /** Tiny pits and blisters for the skin of a fried jalebi. */
  crisp: () => once('crisp', () => normalFromHeight(fbm(128, { octaves: 4, base: 16, seed: 41 }), 2.2, [10, 1])),

  /** Soft woven cloth. */
  cloth: (repeat = [6, 6]) =>
    once('cloth' + repeat, () => {
      const s = 64;
      const c = canvas(s, s);
      const g = c.getContext('2d');
      g.fillStyle = '#808080';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 4) {
        g.fillStyle = i % 8 ? '#606060' : '#a0a0a0';
        g.fillRect(i, 0, 2, s);
        g.fillStyle = i % 8 ? 'rgba(160,160,160,0.6)' : 'rgba(96,96,96,0.6)';
        g.fillRect(0, i, s, 2);
      }
      return normalFromHeight(c, 1.2, repeat);
    }),
};

// ---------------------------------------------------------------------------
// Fire: a camera-facing card with a scrolling-noise flame drawn in a shader.
// ---------------------------------------------------------------------------

export const flameClock = { value: 0 };

const FLAME_VERT = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    // stand upright in the world, face the camera sideways
    vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    mv.xyz += vec3(1.0, 0.0, 0.0) * (position.x * uSize.x) + up * (position.y * uSize.y);
    gl_Position = projectionMatrix * mv;
  }
`;

const FLAME_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3); }
  void main() {
    vec2 uv = vUv;
    float t = uTime * 1.6 + uPhase;
    float n = fbm(vec2(uv.x * 3.0 + uPhase, uv.y * 2.4 - t * 1.5));
    // sway more toward the tip
    float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.9 * uv.y;
    float width = (1.0 - uv.y) * (0.55 + 0.45 * smoothstep(0.0, 0.25, uv.y));
    float body = 1.0 - smoothstep(width * 0.55, width, abs(x));
    float lick = smoothstep(0.0, 1.0, n * 1.5 - uv.y * 0.95);
    float a = body * lick * smoothstep(0.0, 0.06, uv.y);
    float heat = a * (1.25 - uv.y) ;
    vec3 col = mix(vec3(0.95, 0.16, 0.02), vec3(1.0, 0.55, 0.05), smoothstep(0.15, 0.55, heat));
    col = mix(col, vec3(1.0, 0.92, 0.55), smoothstep(0.6, 1.05, heat));
    gl_FragColor = vec4(col * (0.9 + 0.7 * heat), a);
  }
`;

const flameGeo = new THREE.PlaneGeometry(1, 1);
flameGeo.translate(0, 0.5, 0);

/** A flame `w` wide and `h` tall whose base sits at the mesh's position. */
export function makeFlame(w, h) {
  const m = new THREE.Mesh(
    flameGeo,
    new THREE.ShaderMaterial({
      uniforms: { uTime: flameClock, uPhase: { value: Math.random() * 20 }, uSize: { value: new THREE.Vector2(w, h) } },
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  m.frustumCulled = false;
  m.renderOrder = 5;
  return m;
}

/** Soft round glow sprite (embers, lamp halos). */
export function makeGlow(color, size, opacity = 0.6) {
  const tex = once('glowTex', () => {
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  s.scale.setScalar(size);
  return s;
}
