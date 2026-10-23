// E2E: English UI smoke test → landing page in English → sample design → Plan/3D switch on the canvas → pick in 3D → select a room in the canvas
// → properties tab shows its area → Settings shows English selected → the style gallery → a blank design gets English level names
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? '.';
const HAN = /[㐀-鿿＀-￯　-〿]/;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};

// English locale: localStorage for the browser runtime, cookie for the server
// A 2x screen, like most phones and laptops: the 3D canvas must still fit its frame
const context = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await context.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'en', url: BASE }]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// Landing page
await page.goto(BASE, { waitUntil: 'networkidle' });
const h1 = page.getByRole('heading', { level: 1 });
check((await h1.innerText()).trim() === 'House designs you change by just talking', `landing heading is English: ${await h1.innerText()}`);

// Open the sample design
await page.getByRole('button', { name: /Try the sample design/ }).click();
await page.waitForURL(/\/p\//);
await page.waitForFunction(() => window.artifact?.ready);
check(await page.evaluate(() => document.documentElement.lang) === 'en', '<html lang> is "en"');
const planBtn = page.getByRole('button', { name: 'Plan', exact: true });
const threeBtn = page.getByRole('button', { name: '3D', exact: true });
// The canvas shows the switch to the other view: "3D" in the plan, "Plan" in 3D
check(await threeBtn.isVisible() && !(await planBtn.isVisible()), 'the plan shows a "3D" switch');

// 3D view, then back to the plan
const canvas = page.frameLocator('iframe[title="Canvas"]');
await threeBtn.click();
const gl = await canvas.locator('canvas').first().waitFor({ timeout: 20000 }).then(() => true, () => false);
check(gl, 'switching to 3D renders a WebGL canvas');
check(await planBtn.isVisible() && await page.getByRole('button', { name: 'Fit all' }).isVisible(), '3D shows "Plan" and "Fit all"');
await page.screenshot({ path: `${OUT}/en-3d.png` });
const fits = await page.frames().find(f => f !== page.mainFrame()).evaluate(() => {
  const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), p = c.parentElement.getBoundingClientRect();
  return Math.abs(r.width - p.width) < 1 && Math.abs(r.height - p.height) < 1;
});
check(fits, 'the 3D canvas fits its frame on a 2x screen');
// Clicking the model in 3D selects what is under the pointer, once the house has grown out of the plan (entering 3D first
// waits for the floor drawings, then grows for about 1.6 s)
await page.waitForTimeout(6000);
const frameBox = await page.locator('iframe[title="Canvas"]').boundingBox();
await page.mouse.click(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
const picked = await page.waitForFunction(() => window.artifact.call('view_get', {}).then(r => r.result?.selection?.length === 1), null, { timeout: 5000 }).then(() => true, () => false);
check(picked, 'clicking the 3D model selects an object');
await planBtn.click();

// Properties tab first (selection only switches tabs when the chat tab is not active), then click a room label
await page.getByRole('tab', { name: 'Properties' }).click();
const room = '老人房一';
await canvas.getByText(room, { exact: true }).first().click();
const obj = await page.evaluate(r => window.artifact.call('get_object', { ref: r }), `一层·${room}`);
const area = `${obj.result.netArea.toFixed(1)} m²`;
const shown = await page.getByRole('tabpanel').getByText(area, { exact: true }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
check(shown, `properties tab shows the room's area (${area})`);
check(await page.getByRole('tabpanel').getByText('Room', { exact: true }).isVisible(), 'properties tab labels the selection "Room"');
await page.screenshot({ path: `${OUT}/en-props.png` });

// Settings: language selector with English selected
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const langSection = page.locator('section', { has: page.getByRole('heading', { name: 'Language', exact: true }) });
check(await langSection.isVisible(), 'Settings has a "Language" section');
check((await langSection.innerText()).includes('English'), 'language selector shows "English"');
check(await page.getByRole('heading', { name: 'Settings', exact: true }).first().isVisible(), 'Settings page title is English');

// Libraries, from the top navigation; the default library's page: 3D only, the specimens named in English, and picking one
// shows its properties
await page.locator('header a[href="/looks"]').click();
await page.waitForURL(/\/looks$/);
const visible = loc => loc.waitFor({ timeout: 15000 }).then(() => true, () => false);
check(await visible(page.getByRole('heading', { name: 'Libraries', exact: true })), 'the top navigation opens Libraries');
await page.getByRole('link', { name: 'Open “Default pieces”' }).click();
await page.waitForURL(/\/looks\/builtin-default/);
check(await visible(page.getByRole('heading', { name: 'Default pieces', exact: true })), 'the default library opens on its page');
check(!(await page.getByRole('button', { name: 'Plan', exact: true }).isVisible()) && !(await page.getByText('Level 2', { exact: true }).isVisible()),
  'the gallery is 3D only: no switch to the plan, no level buttons');
// The names are written on the ground in WebGL, so pick a specimen in the model itself: tap across the middle of this
// 1400×900 window, where the furniture rows are, until one is picked (once the model has grown)
await page.waitForTimeout(6000);
let picked3 = '';
for (const [x, y] of [[600, 510], [545, 330], [700, 420], [820, 380], [650, 600], [900, 330]]) {
  await page.mouse.click(x, y);
  picked3 = await page.locator('main h3').innerText({ timeout: 1500 }).catch(() => '');
  if (picked3) break;
}
check(/^[\x20-\x7e]+$/.test(picked3), `clicking a specimen shows its English name in the details (${picked3})`);
await page.screenshot({ path: `${OUT}/en-gallery.png` });

// Blank design: project data follows the UI language
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Start from scratch' }).click();
await page.waitForURL(/\/p\//);
await page.waitForFunction(() => window.artifact?.ready);
const proj = await page.evaluate(() => window.artifact.project());
check(proj.levels[0]?.name === 'Level 1', `blank design level name is English: ${proj.levels[0]?.name}`);
check(!HAN.test(proj.name), `blank design name is English: ${proj.name}`);

// No Chinese in the editor chrome (toolbar and panel tabs); the blank design has no Chinese data names
const chrome = `${await page.locator('header').first().innerText()}\n${await page.getByRole('tablist').first().innerText()}`;
const leaked = chrome.split('\n').filter(l => HAN.test(l));
check(leaked.length === 0, `no Chinese in toolbar/tab labels${leaked.length ? `: ${leaked.join(' | ')}` : ''}`);
const aria = await page.locator('header [aria-label], [role=tablist] [aria-label]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
check(!aria.some(a => HAN.test(a)), `no Chinese in toolbar aria labels${aria.some(a => HAN.test(a)) ? `: ${aria.filter(a => HAN.test(a)).join(' | ')}` : ''}`);
await page.screenshot({ path: `${OUT}/en-blank.png` });

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await b.close();
