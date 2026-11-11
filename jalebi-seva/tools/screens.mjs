// Takes the screenshots used in the README.
//   npm run build && npx vite preview --port 4173 &
//   node tools/screens.mjs
import { createRequire } from 'module';
import fs from 'fs';
// Playwright is taken from the machine's global install when it is not a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.env.GAME_URL || 'http://localhost:4173/';
const out = 'docs/screens';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(step, speed = 2) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${base}#step=${step}&speed=${speed}`);
  await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  return page;
}
const hintOf = (page) => page.evaluate(() => window.__game.hint());
const save = async (page, name) => {
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82, timeout: 120000 });
  console.log('saved', name);
  await page.close();
};

// 1. jalebis being drawn in the ghee
{
  const page = await open(4);
  await page.waitForFunction(() => window.__game.hint() && window.__game.hint().type === 'path', null, { timeout: 120000 });
  for (let n = 0; n < 4; n++) {
    const h = await hintOf(page);
    if (!h || !h.points) break;
    await page.mouse.move(h.points[0].x, h.points[0].y);
    await page.mouse.down();
    for (const p of h.points) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(1500);
  await save(page, 'fry');
}
// 2. the bhog laid before Shreenathji   3. kirtan   4. prasad together
for (const [step, name, wait] of [
  [8, 'mandir', 9000],
  [9, 'kirtan', 12000],
  [13, 'pangat', 16000],
]) {
  const page = await open(step);
  await page.waitForTimeout(wait);
  await save(page, name);
}
await browser.close();
