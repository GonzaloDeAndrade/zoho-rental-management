// Zoho Books tests B01-B03 against the live app. Re-saves rentals without changes:
// Completed ones must get a Books invoice (once), a Reserved one must not.
// Then reads the invoice list in Zoho Books. Writes out/books-results.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { here, snap, visibleText } from './lib.mjs';
import { APP, openEdit, submit, value, reportRows } from './zc.mjs';

const booksOrg = '944467787';
const browser = await chromium.connectOverCDP('http://localhost:9333');
let page = null;
for (const p of browser.contexts()[0].pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
await page.bringToFront();
const results = [];
const record = (id, title, expected, actual, pass, evidence) => {
  results.push({ id, area: 'Zoho Books integration', title, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence, executedAt: new Date().toISOString() });
  console.log(id, pass ? 'PASS' : 'FAIL', '-', actual);
};

async function resave(id) {
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  const res = await submit(page, ['updated successfully'], null);
  await page.waitForTimeout(2000);
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  return { res, ref: await value(page, 'Rental_Reference'), invoice: (await value(page, 'Books_Invoice_No')).trim(), total: await value(page, 'Total_Cost') };
}

await page.goto(`${APP}/#Report:All_Rentals`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('tr[elname=zc-reportRowEl]').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
const rows = await page.$$eval('tr[elname=zc-reportRowEl]', (trs) => trs.map((tr) => ({ id: tr.getAttribute('reclinkid'), text: tr.innerText })));
const completed = rows.filter((r) => /\bCompleted\b/.test(r.text));
const reserved = rows.find((r) => /RNT-0006/.test(r.text));

// B01: every Completed rental gets an invoice number on save.
const invoiced = [];
for (const r of completed) invoiced.push(await resave(r.id));
const shot1 = await snap(page, 'books-B01-form');
const allHave = invoiced.length > 0 && invoiced.every((x) => x.invoice);
record('B01', 'Saving a Completed rental creates a Zoho Books invoice and stores its number', `All ${completed.length} Completed rentals get an Invoice No.`,
  invoiced.map((x) => `${x.ref}: ${x.invoice || '(none)'}`).join('; '), allHave, shot1);

// B02: re-saving again does not create a second invoice.
const again = await resave(completed[0].id);
record('B02', 'An invoiced rental is not invoiced twice', `${invoiced[0].ref} keeps ${invoiced[0].invoice}`,
  `${again.ref}: ${again.invoice}`, again.invoice === invoiced[0].invoice, null);

// B03: a Reserved rental is not invoiced.
const res3 = await resave(reserved.id);
record('B03', 'A Reserved rental is not invoiced', 'RNT-0006 (Reserved) has no Invoice No. after saving',
  `${res3.ref}: ${res3.invoice || '(none)'}`, res3.res.ok && !res3.invoice, null);

// Books side: the invoices exist with the right amounts.
await page.goto(`https://books.zoho.com/app/${booksOrg}#/invoices`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const booksText = await visibleText(page, 20000);
const booksShot = await snap(page, 'books-invoices');
const missing = invoiced.filter((x) => !booksText.includes(x.invoice));
record('B04', 'The invoices appear in Zoho Books', 'Each invoice number is listed in Zoho Books → Invoices',
  missing.length ? `missing in Books: ${missing.map((x) => x.invoice).join(', ')}` : `${invoiced.length} invoices listed in Zoho Books`, missing.length === 0, booksShot);

fs.writeFileSync(path.join(here, 'out', 'books-results.json'), JSON.stringify(results, null, 2));
process.exit(0);
