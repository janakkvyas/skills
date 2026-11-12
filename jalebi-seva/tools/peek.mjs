// Look at one step, optionally after running some JS in the page:
//   node tools/peek.mjs <step> <out.png> [waitMs] ["js to eval"] [postWaitMs]
// Env: W, H (viewport), LITE=1 (cheap rendering), SPEED
import { createRequire } from 'module';
// Playwright is taken from the machine's global install when it is not a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const [step = '0', out = 'tools/shots/peek.png', waitMs = '4000', js = '', postWait = '1500'] = process.argv.slice(2);
const W = parseInt(process.env.W ?? '1280', 10);
const H = parseInt(process.env.H ?? '720', 10);
const base = process.env.GAME_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const q = [`step=${step}`, `speed=${process.env.SPEED || 1}`, `lang=${process.env.LANG_CODE || 'hi'}`];
if (process.env.LITE) q.push('lite=1');
await page.goto(base + '#' + q.join('&'));
await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
await page.waitForTimeout(+waitMs);
if (js) {
  await page.evaluate(js);
  await page.waitForTimeout(+postWait);
}
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
