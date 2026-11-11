// Automated play-through: plays the whole game the way the hint hand suggests,
// taking screenshots along the way. Used to check that every step can be
// completed and to eyeball how it looks.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/playthrough.mjs [firstStep] [lastStep] [speed]
import { createRequire } from 'module';
import fs from 'fs';
// Playwright is taken from the machine's global install when it is not a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const first = parseInt(process.argv[2] ?? '0', 10);
const lastStep = parseInt(process.argv[3] ?? '13', 10);
const speed = process.argv[4] ?? '3';
const W = parseInt(process.env.W ?? '1280', 10);
const H = parseInt(process.env.H ?? '720', 10);
const base = process.env.GAME_URL || 'http://localhost:4173/';
const outDir = process.env.OUT || 'tools/shots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('[console] ' + m.text().slice(0, 400));
});
page.on('pageerror', (e) => problems.push('[pageerror] ' + e.message));

await page.goto(`${base}#step=${first}&speed=${speed}&lite=1&lang=${process.env.LANG_CODE || 'hi'}`);
await page.waitForFunction(() => window.__game, null, { timeout: 30000 });

const state = () =>
  page.evaluate(() => ({ step: window.__game.step, id: window.__game.stepId, hint: window.__game.hint(), finished: window.__game.finished }));

let shotNo = 0;
const shot = async (label) => {
  const file = `${outDir}/${String(first).padStart(2, '0')}-${String(shotNo++).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: file });
  return file;
};

async function act(h) {
  const m = page.mouse;
  if (h.type === 'tap') {
    await m.move(h.x, h.y);
    await m.down();
    await m.up();
  } else if (h.type === 'circle') {
    const r = Math.max(20, h.r * 0.55);
    await m.move(h.x + r, h.y);
    await m.down();
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      await m.move(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.6);
    }
    await m.up();
  } else if (h.type === 'swipe') {
    await m.move(h.x, h.y);
    await m.down();
    for (let i = 1; i <= 12; i++) await m.move(h.x + ((h.x2 - h.x) * i) / 12, h.y + ((h.y2 - h.y) * i) / 12);
    await m.up();
  } else if (h.type === 'path') {
    await m.move(h.points[0].x, h.points[0].y);
    await m.down();
    for (const p of h.points) await m.move(p.x, p.y);
    await m.up();
  }
}

// MONKEY=1 adds random slaps and smears between the helpful touches.
const monkey = !!process.env.MONKEY;
async function mash() {
  const m = page.mouse;
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    await m.move(x, y);
    await m.down();
    if (Math.random() < 0.5) {
      for (let k = 0; k < 6; k++) await m.move(x + (Math.random() - 0.5) * 300, y + (Math.random() - 0.5) * 200);
    }
    await m.up();
  }
}

const t0 = Date.now();
let cur = -1;
let actions = 0;
let lastShot = 0;
while (true) {
  const s = await state();
  if (s.finished || s.step > lastStep) break;
  if (s.step !== cur) {
    if (cur >= 0) console.log(`  step ${cur} done after ${actions} actions, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    cur = s.step;
    actions = 0;
    console.log(`step ${s.step}: ${s.id}`);
    lastShot = 0;
  }
  if (s.hint) {
    if (actions === 0 || Date.now() - lastShot > 2500) {
      await shot(`${s.id}-${actions}`);
      lastShot = Date.now();
    }
    if (monkey) await mash();
    await act(s.hint);
    actions++;
  }
  await page.waitForTimeout(220);
  if (Date.now() - t0 > (parseInt(process.env.TIMEOUT_S ?? "240", 10)) * 1000) {
    problems.push(`TIMEOUT in step ${s.step} (${s.id})`);
    await shot('timeout');
    break;
  }
}
await page.waitForTimeout(800);
await shot('end');
const fin = await state();
console.log(`finished=${fin.finished} at step ${fin.step} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (problems.length) {
  console.log('PROBLEMS:\n' + [...new Set(problems)].join('\n'));
  process.exitCode = 1;
}
await browser.close();
