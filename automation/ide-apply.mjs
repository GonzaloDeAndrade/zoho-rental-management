// Usage: node ide-apply.mjs <component label> <file with new code> [shot name]
// In the Application IDE (automation tab): selects a component in the tree, replaces
// its code with the file's content, clicks Save and prints the IDE's response.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { snap, visibleText } from './lib.mjs';

const [label, file, shot = 'ide-apply'] = process.argv.slice(2);
const code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
page.setDefaultTimeout(10000);
await page.bringToFront();
await page.getByText(label, { exact: label === 'Rental' }).locator('visible=true').first().click();
await page.waitForTimeout(3000);
await page.evaluate((c) => document.querySelector('.CodeMirror').CodeMirror.setValue(c), code);
await page.waitForTimeout(500);
const before = await visibleText(page, 100000);
await page.getByText('Save', { exact: true }).locator('visible=true').first().click();
await page.waitForTimeout(6000);
const after = await visibleText(page, 100000);
const added = after.split('\n').filter((l) => !before.includes(l));
console.log('NEW TEXT AFTER SAVE:\n' + added.join('\n').slice(0, 2000));
console.log('SHOT:', await snap(page, shot));
process.exit(0);
