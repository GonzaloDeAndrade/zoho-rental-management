// One-off: re-saves every existing rental without changes so the on-success
// workflow syncs it to Zoho CRM. Rentals that already have a CRM Deal ID are skipped.
import { chromium } from 'playwright';
import { APP, openEdit, submit, value } from './zc.mjs';

const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
await page.bringToFront();
await page.goto(`${APP}/#Report:All_Rentals`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('tr[elname=zc-reportRowEl]').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const ids = await page.$$eval('tr[elname=zc-reportRowEl]', (trs) => trs.map((tr) => tr.getAttribute('reclinkid')));
console.log(ids.length, 'rentals');
for (const id of ids) {
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  const ref = await value(page, 'Rental_Reference');
  if ((await value(page, 'CRM_Deal_ID')).trim()) { console.log(ref, 'already synced'); continue; }
  const res = await submit(page, ['updated successfully'], null);
  await page.waitForTimeout(1500);
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  console.log(ref, res.ok ? 'saved' : 'NOT SAVED: ' + res.message, '-> CRM Deal ID', (await value(page, 'CRM_Deal_ID')) || '(empty)');
}
process.exit(0);
