// E04, E05 and E07 were submitted during the first full run, but the script
// lost the page during Creator's post-save redirect to the report and logged
// NOT_EXECUTED. This script checks the outcome of those edits in the live
// reports and records the result with that context.
import fs from 'node:fs';
import path from 'node:path';
import { creatorPage, here, snap } from './lib.mjs';
import { reportRows } from './zc.mjs';

const file = path.join(here, 'out', 'results.json');
const results = JSON.parse(fs.readFileSync(file, 'utf8'));
const { page } = await creatorPage();
const rentals = await reportRows(page, 'All_Rentals');
const rentalShot = await snap(page, 'verify-all-rentals');
const props = await reportRows(page, 'All_Properties');
const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
const find = (c, d) => rentals.find((r) => r[1] === c && r[3] === d);
const note = 'Edit submitted in run 1 (automation lost the page on the post-save redirect); outcome verified in the live report.';

const s10 = find('Hana Sato', '15-Nov-2026');
const s13 = find('Lucas Moreau', '01-Jan-2027');
const s05 = find('Hana Sato', '26-Oct-2026');
const garden = props.find((p) => p[0] === 'Garden House');
const checks = {
  E04: { pass: s10?.[8] === 'Cancelled', actual: `${note} ${s10?.[0]} status = ${s10?.[8]}` },
  E05: { pass: s13?.[8] === 'Cancelled', actual: `${note} ${s13?.[0]} status = ${s13?.[8]}` },
  E07: {
    pass: s05?.[4] === '27-Oct-2026' && Number(s05?.[5]) === 1 && money(s05?.[7]) === 210 && s05?.[8] === 'Completed' && garden?.[4] === 'Available',
    actual: `${note} ${s05?.slice(0, 9).join(' | ')}; Garden House = ${garden?.[4]}`,
  },
};
for (const [id, c] of Object.entries(checks)) {
  Object.assign(results[id], { status: c.pass ? 'PASS' : 'FAIL', actual: c.actual, evidence: rentalShot, executedAt: new Date().toISOString() });
  console.log(id, c.pass ? 'PASS' : 'FAIL', c.actual);
}
fs.writeFileSync(file, JSON.stringify(results, null, 2));
process.exit(0);
