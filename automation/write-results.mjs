// Generates TEST_RESULTS.md from out/results.json and copies the evidence
// screenshots that the document links to into ../screenshots/tests/.
import fs from 'node:fs';
import path from 'node:path';
import { here } from './lib.mjs';

const root = path.join(here, '..');
const results = Object.values(JSON.parse(fs.readFileSync(path.join(here, 'out', 'results.json'), 'utf8')));
const order = ['S01', 'S02', 'S03', 'S04', 'S05', 'S12', 'S06', 'S07', 'S08', 'S09', 'S10', 'C01', 'N01', 'N02', 'N03', 'N04', 'N05', 'S13', 'N06', 'N07', 'N08', 'N09', 'N10', 'N11', 'N12', 'N13', 'N14', 'E01', 'E02', 'E03', 'E04', 'S11', 'E05', 'E06', 'E07', 'E08', 'P01', 'P02', 'P03', 'R01', 'U01', 'U02', 'L01', 'L02', 'K01', 'I01', 'I02', 'I03', 'B01', 'B02', 'B03', 'B04', 'L01', 'L02', 'L03'];
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

const shotsDir = path.join(root, 'screenshots', 'tests');
fs.mkdirSync(shotsDir, { recursive: true });
const count = (s) => results.filter((r) => r.status === s).length;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');

let md = `# Test Results

Executed against the live Zoho Creator app (\`creatorapp.zoho.com/gonzadeandrade1/rental-management\`) by [\`automation/run-tests.mjs\`](automation/run-tests.mjs). The script compared each result with the expected value and set PASS/FAIL automatically. See [TEST_PLAN.md](TEST_PLAN.md) for the method.

**Run date:** 27-Oct-2026, evening, in the application time zone (America/Argentina/Buenos_Aires); integration tests (I, B, L) on 28-Oct-2026; first execution ${results.map((r) => r.executedAt).sort()[0]?.slice(0, 16).replace('T', ' ')} UTC. Raw results: [\`automation/out/results.json\`](automation/out/results.json).

| Total | PASS | FAIL | NOT EXECUTED |
|---|---|---|---|
| ${results.length} | ${count('PASS')} | ${count('FAIL')} | ${count('NOT_EXECUTED')} |

| ID | Area | Test | Expected | Actual (observed in the app) | Result | Evidence |
|---|---|---|---|---|---|---|
`;
for (const r of results) {
  let link = '';
  if (r.evidence && fs.existsSync(r.evidence)) {
    const name = `${r.id}.png`;
    fs.copyFileSync(r.evidence, path.join(shotsDir, name));
    link = `[screenshot](screenshots/tests/${name})`;
  }
  const badge = r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ NOT EXECUTED';
  md += `| ${r.id} | ${esc(r.area)} | ${esc(r.title)} | ${esc(r.expected)} | ${esc(r.actual)} | ${badge} | ${link} |\n`;
}
md += `\n## Notes\n\n__NOTES__\n`;
const notesFile = path.join(here, 'results-notes.md');
md = md.replace('__NOTES__', fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').trim() : '_None._');
fs.writeFileSync(path.join(root, 'TEST_RESULTS.md'), md);
console.log(`TEST_RESULTS.md written: ${count('PASS')} pass, ${count('FAIL')} fail, ${count('NOT_EXECUTED')} not executed`);
