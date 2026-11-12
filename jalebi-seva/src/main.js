import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
// Only the scripts the game speaks: Devanagari, Gujarati and Latin.
import '@fontsource/baloo-2/devanagari-700.css';
import '@fontsource/baloo-2/devanagari-800.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-bhai-2/gujarati-700.css';
import '@fontsource/baloo-bhai-2/gujarati-800.css';
import './ui/style.css';

import { updateTweens, tween, ease } from './engine/tween.js';
import { Input } from './engine/input.js';
import { AudioSys } from './engine/audio.js';
import { Voice } from './engine/voice.js';
import { FX, Hint } from './engine/fx.js';
import { loadOverrides, slotNames, slotSize } from './engine/assets.js';
import { buildWorld, STATIONS, AREAS } from './art/world.js';
import { Hud } from './ui/hud.js';
import { STEPS } from './game/steps.js';
import { T, setLang, getLang } from './game/i18n.js';

// ---------------------------------------------------------------------------
// Settings (kept between sessions) and URL switches (for testing)
// ---------------------------------------------------------------------------

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('jalebi.' + k);
      return v === null ? d : JSON.parse(v);
    } catch (_) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('jalebi.' + k, JSON.stringify(v));
    } catch (_) {
      /* private mode */
    }
  },
};

// Where to start. A skip or a replay reloads the page and leaves the wanted
// step in sessionStorage; the address (#step=7&speed=3) does the same job for
// testing and wins when present.
function pendingJump() {
  try {
    const v = sessionStorage.getItem('jalebi.jump');
    sessionStorage.removeItem('jalebi.jump');
    return v;
  } catch (_) {
    return null;
  }
}
const params = new URLSearchParams(location.hash.replace(/^#/, '') || location.search);
const jumped = pendingJump();
if (jumped !== null && !params.has('step')) params.set('step', jumped);
const startStep = Math.max(0, Math.min(STEPS.length - 1, parseInt(params.get('step') ?? '-1', 10)));
const autoStart = params.has('step');
const timeScale = parseFloat(params.get('speed') ?? '1') || 1;
const lite = params.has('lite'); // cheap rendering, for software-rendered test runs

setLang(params.get('lang') || store.get('lang', 'hi'));

// ---------------------------------------------------------------------------
// Renderer, scene, lights
// ---------------------------------------------------------------------------

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
let pixelRatio = lite ? 1 : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = !lite;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
const BG = { kitchen: 0xf7dba7, mandir: 0x7a1f2b, pangat: 0xfde8b8 };
scene.background = new THREE.Color(BG.kitchen);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
scene.add(camera); // things "held in the hands" are parented to the camera

const hemi = new THREE.HemisphereLight(0xfff4e0, 0xb98a5a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
sun.castShadow = !lite;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 5;
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 24;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function lightArea(name) {
  const o = AREAS[name];
  sun.position.set(o.x + 3.2, 8, 5.5);
  sun.target.position.set(o.x, 0, -0.5);
  fill.position.set(o.x - 5, 4, 3);
  fill.target.position.set(o.x, 0.5, 0);
  scene.background.set(BG[name]);
}

// A cool fill from the other side keeps shadows from going flat.
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.45);
scene.add(fill, fill.target);

// Post-processing: a soft bloom so fire, lamps, brass highlights and syrup
// glow. Dropped automatically on phones that cannot keep up.
let composer = null;
if (!lite) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.15, 0.5, 1.45));
  composer.addPass(new OutputPass());
}

// Keep the horizontal view constant on narrow (portrait) screens.
const BASE_FOV = 46;
const H_HALF = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * 1.65;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
  }
  const aspect = w / h;
  camera.aspect = aspect;
  camera.fov = aspect >= 1.65 ? BASE_FOV : Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(H_HALF / aspect)));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Camera: glides between stations and breathes a little, like a person.
// ---------------------------------------------------------------------------

const cam = {
  pos: new THREE.Vector3(),
  look: new THREE.Vector3(),
  set(name) {
    const s = STATIONS[name];
    this.pos.copy(s.pos);
    this.look.copy(s.look);
    this.update(0);
  },
  go(name, dur = 1.2) {
    const s = STATIONS[name];
    const p0 = this.pos.clone();
    const l0 = this.look.clone();
    return tween(
      dur,
      (k) => {
        this.pos.lerpVectors(p0, s.pos, k);
        this.look.lerpVectors(l0, s.look, k);
      },
      ease.inOut,
    );
  },
  update(t) {
    camera.position.set(this.pos.x + Math.sin(t * 0.7) * 0.012, this.pos.y + Math.sin(t * 1.1) * 0.01, this.pos.z);
    camera.lookAt(this.look);
    camera.updateMatrixWorld();
  },
};

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------

const input = new Input(canvas, camera);
const audio = new AudioSys();
const voice = new Voice();
voice.lang = getLang();
voice.enabled = store.get('speech', true);
audio.muted = !store.get('sound', true);
const fx = new FX(scene);
const hint = new Hint(input);

let stepIndex = 0;
let lastSaid = null;

const hud = new Hud(STEPS.length, {
  getState: () => ({ sound: !audio.muted, speech: voice.enabled }),
  onLang: (l) => {
    setLang(l);
    voice.lang = l;
    store.set('lang', l);
  },
  onToggleSound: () => {
    audio.setMuted(!audio.muted);
    store.set('sound', !audio.muted);
  },
  onToggleSpeech: () => {
    voice.enabled = !voice.enabled;
    if (!voice.enabled) voice.stop();
    store.set('speech', voice.enabled);
  },
  onRepeat: () => {
    audio.resume();
    if (lastSaid) voice.speak(T(lastSaid));
  },
  // Skipping and restarting reload the page at the wanted step: the cleanest
  // way to be sure no half-finished animation is left behind.
  onSkip: () => jump(Math.min(STEPS.length - 1, stepIndex + 1)),
  onRestart: () => jump(null),
});

function jump(step) {
  voice.stop();
  audio.stopSong();
  try {
    if (step === null) sessionStorage.removeItem('jalebi.jump');
    else sessionStorage.setItem('jalebi.jump', String(step));
  } catch (_) {
    /* storage unavailable: fall back to the address alone */
    location.hash = step === null ? '' : `step=${step}`;
  }
  if (location.hash.includes('step=')) {
    const rest = location.hash.replace(/^#/, '').split('&').filter((kv) => !kv.startsWith('step='));
    if (step !== null) rest.unshift(`step=${step}`);
    location.hash = rest.join('&');
  }
  location.reload();
}

input.onAnyTouch = () => audio.resume();
window.addEventListener('pointerdown', () => audio.resume(), { passive: true });
// Go quiet whenever the game is not on screen. The Android shell calls
// window.__pause directly, since a WebView does not always report visibility.
window.__pause = (paused) => {
  if (paused) voice.stop();
  if (audio.customKirtan && paused) audio.customKirtan.pause();
  if (!audio.ctx) return;
  if (paused) audio.ctx.suspend();
  else audio.ctx.resume();
};
document.addEventListener('visibilitychange', () => window.__pause(document.hidden));

// ---------------------------------------------------------------------------
// Frame loop, with a guard that lightens the load on slow phones
// ---------------------------------------------------------------------------

let last = performance.now();
let simTime = 0;
let slowFrames = 0;
let frames = 0;
let degraded = 0;

function frame(now) {
  const real = Math.min(0.25, (now - last) / 1000);
  last = now;
  const dt = real * timeScale;
  simTime += dt;
  // Advance in small slices so that a slow frame (or a fast-forwarded test
  // run) plays the same animation, just with fewer pictures.
  const slices = Math.max(1, Math.ceil(dt / 0.034));
  for (let i = 0; i < slices; i++) updateTweens(dt / slices);
  cam.update(simTime);
  if (composer) composer.render();
  else renderer.render(scene, camera);

  frames++;
  if (real > 1 / 26) slowFrames++;
  if (frames >= 150) {
    if (!lite && slowFrames > 75 && degraded < 2 && !params.has('hq')) {
      degraded++;
      if (degraded === 1) {
        composer = null; // bloom is the first thing to go
        pixelRatio = Math.min(pixelRatio, 1.5);
        renderer.setPixelRatio(pixelRatio);
      } else {
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
      }
      resize();
    }
    frames = 0;
    slowFrames = 0;
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

async function main() {
  await loadOverrides();
  const world = buildWorld(scene);
  lightArea('kitchen');
  cam.set('prep');
  requestAnimationFrame(frame);

  const ctx = {
    scene,
    camera,
    input,
    audio,
    voice,
    fx,
    hint,
    hud,
    world,
    cam,
    state: { jalebis: [], made: 0, potCount: 0, inTokri: 0, pile: null, potFx: null, offered: false, served: null },
    say(key) {
      lastSaid = key;
      hud.banner(key);
      voice.speak(T(key));
    },
    /** Move to a camera station, cross-fading if it is in another place. */
    async goto(area, station, during = null) {
      if (world.current !== area) {
        await hud.fade(() => {
          world.show(area);
          lightArea(area);
          cam.set(station);
          if (during) during();
        });
      } else {
        if (during) during();
        await cam.go(station, 1.2);
      }
    },
  };

  // exposed for the automated play-through (tools/playthrough.mjs)
  window.__game = {
    ctx,
    steps: STEPS.map((s) => s.id),
    get step() {
      return stepIndex;
    },
    get stepId() {
      return STEPS[stepIndex] ? STEPS[stepIndex].id : 'done';
    },
    hint: () => hint.screen(),
    finished: false,
    renderer,
    /** Size of every model slot, for docs/TRIPO_ASSETS.md. */
    slotSizes() {
      const out = {};
      for (const slot of slotNames()) {
        if (slot === 'vaishnav') ['dada', 'ben', 'bal', 'bhai'].forEach((k) => (out[`vaishnav:${k}`] = slotSize(slot, k)));
        else out[slot] = slotSize(slot);
      }
      return out;
    },
  };

  input.onAnyTouch = () => {
    audio.resume();
    hint.nudge();
  };

  if (autoStart) {
    hud.hideTitle();
    audio.init();
  } else {
    await hud.showTitle();
    audio.resume();
  }
  hud.showHud(true);
  audio.playSong('kitchen');

  for (stepIndex = autoStart ? startStep : 0; stepIndex < STEPS.length; stepIndex++) {
    input.clear();
    hint.clear();
    hud.meter(null);
    hud.setStep(stepIndex);
    await STEPS[stepIndex].run(ctx);
  }
  hud.setStep(STEPS.length);
  window.__game.finished = true;
  await hud.showEnd();
  jump(0);
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:auto 0 0 0;margin:0;padding:8px;background:#7a1f2b;color:#fff;z-index:99;white-space:pre-wrap">${String(err && err.stack ? err.stack : err)}</pre>`,
  );
});
