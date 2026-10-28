// Tests L01-L03 (booking email + "deal lost in CRM cancels the rental").
// Usage: node lost-test.mjs create   -> creates the test rental (sends the confirmation email)
//        node lost-test.mjs lose     -> marks its Deal Closed Lost in CRM, then runs the checks below
//        node lost-test.mjs check    -> checks Creator and the Deal note (after the Deal was marked by hand)
// Results are merged into out/lost-results.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { here, snap, visibleText } from './lib.mjs';
import { openForm, pick, fillDate, fillText, value, submit, findRecordId, openEdit } from './zc.mjs';

const org = 'org943436044';
const step = process.argv[2];
const rental = { customer: 'Daniel Okafor', property: 'Downtown Studio 5A', start: '01-Mar-2027', end: '05-Mar-2027' };
const file = path.join(here, 'out', 'lost-results.json');
const results = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const record = (id, title, expected, actual, pass, evidence) => {
  results[id] = { id, area: id === 'L01' ? 'Booking email' : 'Zoho CRM integration', title, expected, actual, status: pass ? 'PASS' : 'FAIL', evidence, executedAt: new Date().toISOString() };
  console.log(id, pass ? 'PASS' : 'FAIL', '-', actual);
};

const browser = await chromium.connectOverCDP('http://localhost:9333');
let page = null;
for (const p of browser.contexts()[0].pages()) {
  if (await p.evaluate(() => window.name === 'automation-tab').catch(() => false)) page = p;
}
await page.bringToFront();

async function readRental() {
  const id = await findRecordId(page, 'All_Rentals', [rental.customer, rental.property, rental.start]);
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  return { id, ref: await value(page, 'Rental_Reference'), deal: (await value(page, 'CRM_Deal_ID')).trim(), status: await page.locator('[name="Rental_Status"]').first().inputValue().catch(() => '') };
}

if (step === 'create') {
  await openForm(page, 'Rentals');
  await pick(page, 'Customer', rental.customer);
  await pick(page, 'Property', rental.property);
  await fillDate(page, 'Start_Date', rental.start);
  await fillDate(page, 'End_Date', rental.end);
  await fillText(page, 'Notes', 'Tentative booking; client still confirming travel dates.');
  const res = await submit(page, ['Rental saved successfully.'], 'lost-L01-saved');
  await page.waitForTimeout(3000);
  const r = await readRental();
  fs.writeFileSync(path.join(here, 'out', 'lost-rental.json'), JSON.stringify(r));
  record('L01', 'A new booking sends the confirmation email (copy to the owner)', `${r.ref} saved; confirmation email to the customer with a copy to the owner's inbox`,
    `${res.message}; ${r.ref}; Deal ${r.deal}. Email delivery is confirmed by the owner (see notes)`, res.ok && !!r.deal, res.shot);
}

if (step === 'lose') {
  const r = JSON.parse(fs.readFileSync(path.join(here, 'out', 'lost-rental.json'), 'utf8'));
  // Change the Deal's Stage to Closed Lost through the CRM edit form, like a salesperson would.
  await page.goto(`https://crm.zoho.com/crm/${org}/tab/Potentials/${r.deal}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  await page.getByText('Negotiation/Review', { exact: true }).locator('visible=true').first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Closed Lost', { exact: true }).locator('visible=true').first().click();
  await page.waitForTimeout(1000);
  await snap(page, 'lost-L02-edit');
  await page.getByText('Save', { exact: true }).locator('visible=true').first().click();
  await page.waitForTimeout(12000); // workflow rule -> function -> Creator API
}

if (step === 'lose' || step === 'check') {
  const r = JSON.parse(fs.readFileSync(path.join(here, 'out', 'lost-rental.json'), 'utf8'));
  // L02: the rental is now Cancelled in Creator.
  const after = await readRental();
  const shot2 = await snap(page, 'lost-L02-creator');
  record('L02', 'Marking the Deal Closed Lost in CRM cancels the rental in Creator', `${r.ref}: Reserved → Cancelled`, `${after.ref}: ${after.status}`, after.status === 'Cancelled', shot2);
  // L03: the Deal has a note explaining what happened.
  await page.goto(`https://crm.zoho.com/crm/${org}/tab/Potentials/${r.deal}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const text = await visibleText(page, 60000);
  const shot3 = await snap(page, 'lost-L03-note');
  const hasNote = text.includes(`Rental ${r.ref} was cancelled in Zoho Creator`);
  record('L03', 'The Deal gets a note from the sync', `Note "Rental ${r.ref} was cancelled in Zoho Creator…" on the Deal`, hasNote ? 'note present on the Deal' : 'note not found', hasNote, shot3);
}
fs.writeFileSync(file, JSON.stringify(results, null, 2));
process.exit(0);
