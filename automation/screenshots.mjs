// Captures the showcase screenshots of the live app into ../screenshots/.
// Validation screenshots are copied from the test run evidence (out/test-*.png).
import fs from 'node:fs';
import path from 'node:path';
import { creatorPage, here } from './lib.mjs';
import { APP } from './zc.mjs';

const dir = path.join(here, '..', 'screenshots');
fs.mkdirSync(dir, { recursive: true });
const { page } = await creatorPage();

const pages = [
  ['01-dashboard', '#Page:Dashboard'],
  ['04-all-rentals', '#Report:All_Rentals'],
  ['05-all-properties', '#Report:All_Properties'],
  ['06-available-properties', '#Report:Available_Properties'],
  ['07-active-rentals', '#Report:Active_Rentals'],
  ['08-upcoming-rentals', '#Report:Upcoming_Rentals'],
  ['09-completed-rentals', '#Report:Completed_Rentals'],
  ['10-customers', '#Report:All_Customers'],
];
for (const [name, hash] of pages) {
  await page.goto(`${APP}/${hash}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('captured', name);
}

const copies = {
  '02-rental-form-calculation': 'calc-preview',
  '03-validation-overlap': 'test-N06',
  '11-validation-date-range': 'test-N03',
  '12-validation-maintenance': 'test-N10',
  '13-validation-status-transition': 'test-E01',
  '14-validation-required-fields': 'test-N01',
};
for (const [name, src] of Object.entries(copies)) {
  const from = path.join(here, 'out', `${src}.png`);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(dir, `${name}.png`));
    console.log('copied', name);
  } else console.log('MISSING', src);
}
process.exit(0);
