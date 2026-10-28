// Replaces test-oriented notes with realistic ones. Notes are the only field
// that stays editable on Cancelled/Completed rentals (rule R4f), so this also
// exercises that rule.
import { creatorPage } from './lib.mjs';
import { findRecordId, openEdit, fillText, submit } from './zc.mjs';

const updates = [
  [['RNT-0012'], 'Long-term lease request for 2027. Cancelled by the customer.'],
  [['RNT-0010'], 'Cancelled by the customer; the dates were re-booked (RNT-0013).'],
  [['RNT-0009'], 'Same-day turnover: checks in on the day RNT-0004 checks out.'],
];
const { page } = await creatorPage();
for (const [match, notes] of updates) {
  const id = await findRecordId(page, 'All_Rentals', match);
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  await fillText(page, 'Notes', notes);
  const r = await submit(page, ['Data updated Successfully!', 'Rental saved successfully.']);
  console.log(match[0], r.ok ? 'updated' : r.message);
}
process.exit(0);
