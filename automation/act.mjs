// Usage: node act.mjs <name> "<js to run with page in scope>"
// Runs a Playwright snippet in the automation tab (see tab.mjs), then screenshots it.
import { chromium } from 'playwright';
import { snap, visibleText } from './lib.mjs';

const [name = 'act', code = ''] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
if (!page) throw new Error('automation tab not found; run tab.mjs first');
await page.bringToFront();
page.setDefaultTimeout(8000);
const fn = new Function('page', 'ctx', `return (async () => { ${code} })();`);
const out = await fn(page, ctx);
if (out !== undefined) console.log('RESULT:', typeof out === 'string' ? out : JSON.stringify(out, null, 1));
await page.waitForTimeout(2500);
console.log('URL:', page.url());
console.log('SHOT:', await snap(page, name));
if (!process.env.QUIET) console.log(await visibleText(page, 2500));
process.exit(0);
