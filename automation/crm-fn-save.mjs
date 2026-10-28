// Puts app/crm/deal_closed_lost.dg into the open CRM function editor (automation tab),
// clicks Save and prints any error shown by the editor.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { snap } from './lib.mjs';

const body = fs.readFileSync('../app/crm/deal_closed_lost.dg', 'utf8').replace(/\r\n/g, '\n').trimEnd();
const browser = await chromium.connectOverCDP('http://localhost:9333');
let page = null;
for (const p of browser.contexts()[0].pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
const code = 'void automation.Rental_Deal_Closed_Lost(String dealId)\n{\n' + body.split('\n').map((l) => (l ? '\t' + l : l)).join('\n') + '\n}';
await page.evaluate((c) => document.querySelector('.CodeMirror').CodeMirror.setValue(c), code);
await page.waitForTimeout(800);
await page.mouse.click(1877, 21); // Save
await page.waitForTimeout(5000);
const text = await page.evaluate(() => document.body.innerText);
console.log(text.split('\n').filter((l) => /error|saved|success|line|invalid|connection/i.test(l)).slice(0, 15).join('\n'));
console.log('SHOT:', await snap(page, 'crm-fn-saved'));
process.exit(0);
