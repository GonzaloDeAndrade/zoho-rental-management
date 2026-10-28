// Usage: node tab.mjs <name> [url]
// Works in a dedicated tab ("automation tab") so the user's own tabs are left alone.
// Navigates it (if url is given), screenshots it to out/<name>.png and prints its text.
import { chromium } from 'playwright';
import { snap, visibleText } from './lib.mjs';

const [name = 'tab', url] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
if (!page) {
  page = await ctx.newPage();
  await page.evaluate(() => { window.name = 'automation-tab'; });
}
await page.bringToFront();
if (url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { window.name = "automation-tab"; }).catch(() => {});
}
await page.waitForTimeout(5000);
console.log('URL:', page.url());
console.log('SHOT:', await snap(page, name));
console.log(await visibleText(page, 3000));
process.exit(0);
