// CRM integration test: creates a rental in the live app, checks that a matching
// Deal (with Account and Contact) appears in Zoho CRM, then cancels the rental and
// checks that the Deal moves to "Closed Lost". Writes out/crm-results.json.
// Usage: node crm-test.mjs <crm org path, e.g. org943436044>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { here, snap, visibleText } from './lib.mjs';
import { openForm, pick, fillDate, fillText, value, submit, findRecordId, openEdit } from './zc.mjs';

const org = process.argv[2] ?? 'org943436044';
const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
page ??= await ctx.newPage();
await page.bringToFront();

const rental = { customer: 'Sophie Laurent', property: 'Downtown Studio 5A', start: '01-Feb-2027', end: '04-Feb-2027' };
const results = [];
const record = (id, title, expected, actual, pass, evidence) => {
  results.push({ id, area: 'Zoho CRM integration', title, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence, executedAt: new Date().toISOString() });
  console.log(id, pass ? 'PASS' : 'FAIL', '-', actual);
};

async function openDeal(dealId, shot) {
  await page.goto(`https://crm.zoho.com/crm/${org}/tab/Potentials/${dealId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const text = await visibleText(page, 20000);
  return { text, shot: await snap(page, shot) };
}
const field = (text, label) => {
  const lines = text.split('\n').map((l) => l.trim());
  const i = lines.findIndex((l) => l === label);
  return i >= 0 ? lines[i + 1] : undefined;
};

// C1: create the rental, then read the Deal ID that the on-success workflow stored.
await openForm(page, 'Rentals');
await pick(page, 'Customer', rental.customer);
await pick(page, 'Property', rental.property);
await fillDate(page, 'Start_Date', rental.start);
await fillDate(page, 'End_Date', rental.end);
await fillText(page, 'Notes', 'Booked by phone; synced to Zoho CRM.');
const saved = await submit(page, ['Rental saved successfully.'], 'crm-C01-saved');
await page.waitForTimeout(3000);
const recId = await findRecordId(page, 'All_Rentals', [rental.customer, rental.property, rental.start]);
await openEdit(page, 'Rentals', 'All_Rentals', recId);
const dealId = (await value(page, 'CRM_Deal_ID')).trim();
const reference = (await value(page, 'Rental_Reference')).trim();
const formShot = await snap(page, 'crm-C01-form');
record('C01', 'Saving a rental stores the CRM Deal ID on the record', 'Rental saves; CRM Deal ID filled automatically',
  `${saved.message}; ${reference}; CRM Deal ID = ${dealId || '(empty)'}`, saved.ok && /^\d{10,}$/.test(dealId), formShot);

if (dealId) {
  // C2: the Deal exists in CRM with the right name, amount, stage, account and contact.
  const deal = await openDeal(dealId, 'crm-C02-deal');
  const name = `${reference} - ${rental.property}`;
  const ok = deal.text.includes(name) && deal.text.includes('210') && deal.text.includes('Negotiation/Review') && deal.text.includes(rental.customer);
  record('C02', 'The Deal appears in Zoho CRM with the rental data', `Deal "${name}", Amount $210, Stage Negotiation/Review, Account and Contact ${rental.customer}`,
    ok ? `Deal "${name}" found: $210, Negotiation/Review, linked to ${rental.customer}` : `Deal page text did not match: ${deal.text.slice(0, 400).replace(/\n/g, ' | ')}`, ok, deal.shot);

  // C3: cancelling the rental moves the Deal to Closed Lost (same Deal, no duplicate).
  await openEdit(page, 'Rentals', 'All_Rentals', recId);
  await pick(page, 'Rental_Status', 'Cancelled');
  const upd = await submit(page, ['updated successfully'], 'crm-C03-updated');
  await page.waitForTimeout(3000);
  await openEdit(page, 'Rentals', 'All_Rentals', recId);
  const dealId2 = (await value(page, 'CRM_Deal_ID')).trim();
  const deal2 = await openDeal(dealId, 'crm-C03-deal');
  const ok3 = upd.ok && dealId2 === dealId && deal2.text.includes('Closed Lost');
  record('C03', 'Changing the rental status updates the same Deal\'s stage', 'Status Cancelled → same Deal moves to Closed Lost',
    `${upd.message}; Deal ID ${dealId2 === dealId ? 'unchanged' : 'changed to ' + dealId2}; stage ${deal2.text.includes('Closed Lost') ? 'Closed Lost' : 'not Closed Lost'}`, ok3, deal2.shot);
}

fs.writeFileSync(path.join(here, 'out', 'crm-results.json'), JSON.stringify(results, null, 2));
process.exit(0);
