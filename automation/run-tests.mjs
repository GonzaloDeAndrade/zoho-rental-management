// Executes the test plan against the live Rental Management app.
// Usage: node run-tests.mjs [--only=ID,ID] [--force]
// Results are merged into out/results.json; tests that already passed are
// skipped unless --force is given (several tests create records, so re-running
// them would collide with their own data).
import fs from 'node:fs';
import path from 'node:path';
import { creatorPage, here, snap } from './lib.mjs';
import { APP, openForm, fillText, fillDate, pick, value, submit, findRecordId, openEdit, reportRows } from './zc.mjs';

const resultsFile = path.join(here, 'out', 'results.json');
const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : {};
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const force = process.argv.includes('--force');
const { page } = await creatorPage();

const SAVED = ['Rental saved successfully.'];
const UPDATED = ['Rental saved successfully.', 'Data updated successfully', 'updated successfully', 'Record updated'];

async function newRental(r, shot) {
  await openForm(page, 'Rentals', r.query);
  if (r.customer) await pick(page, 'Customer', r.customer);
  if (r.property) await pick(page, 'Property', r.property);
  if (r.start) await fillDate(page, 'Start_Date', r.start);
  if (r.end) await fillDate(page, 'End_Date', r.end);
  if (r.status && r.status !== 'Reserved') await pick(page, 'Rental_Status', r.status);
  if (r.notes) await fillText(page, 'Notes', r.notes);
  const preview = {
    days: await value(page, 'Number_of_Days'),
    rate: await value(page, 'Daily_Rate'),
    total: await value(page, 'Total_Cost'),
  };
  if (r.previewShot) await snap(page, r.previewShot);
  return { preview, ...(await submit(page, SAVED, shot)) };
}

async function editRental(match, changes, shot) {
  const id = await findRecordId(page, 'All_Rentals', match);
  if (!id) return { ok: false, message: `record not found: ${match.join(' / ')}` };
  await openEdit(page, 'Rentals', 'All_Rentals', id);
  if (changes.end) await fillDate(page, 'End_Date', changes.end);
  if (changes.start) await fillDate(page, 'Start_Date', changes.start);
  if (changes.status) await pick(page, 'Rental_Status', changes.status);
  if (changes.notes) await fillText(page, 'Notes', changes.notes);
  const preview = { days: await value(page, 'Number_of_Days'), total: await value(page, 'Total_Cost') };
  return { preview, ...(await submit(page, UPDATED, shot)) };
}

async function editProperty(name, changes, shot) {
  const id = await findRecordId(page, 'All_Properties', [name]);
  if (!id) return { ok: false, message: `property not found: ${name}` };
  await openEdit(page, 'Properties', 'All_Properties', id);
  if (changes.rate) await fillText(page, 'Daily_Rate', changes.rate);
  if (changes.status) await pick(page, 'Availability_Status', changes.status);
  return submit(page, ['Property saved successfully.', 'updated successfully'], shot);
}

async function propertyStatus(name) {
  const rows = await reportRows(page, 'All_Properties');
  return rows.find((r) => r[0] === name)?.[4];
}

const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
const has = (res, text) => `${res.message}\n${(res.fieldErrors || []).join('\n')}`.includes(text);

// Each test: id, area, title, expected, run() -> { pass, actual, evidence }
const tests = [
  // ---------- Valid rentals (also the sample data) ----------
  ...[
    ['S01', 'Olivia Bennett', 'Seaside Loft 101', '05-Oct-2026', '10-Oct-2026', 'Completed', 5, 600, 'Historical stay recorded after check-out.'],
    ['S02', 'Mateo Fernandez', 'Pine Grove Cabin', '01-Oct-2026', '08-Oct-2026', 'Completed', 7, 665, 'Week-long family stay.'],
    ['S03', 'Sophie Laurent', 'Harbor View Apartment 3B', '12-Oct-2026', '15-Oct-2026', 'Completed', 3, 450, 'Weekend business trip.'],
    ['S04', 'Daniel Okafor', 'Harbor View Apartment 3B', '25-Oct-2026', '01-Nov-2026', 'Active', 7, 1050, 'Guest checked in on time.'],
    ['S05', 'Hana Sato', 'Garden House', '26-Oct-2026', '30-Oct-2026', 'Active', 4, 840, 'Group of 5 guests.'],
    ['S06', 'Olivia Bennett', 'Seaside Loft 101', '05-Nov-2026', '12-Nov-2026', 'Reserved', 7, 840, 'Returning customer.'],
    ['S07', 'Mateo Fernandez', 'Downtown Studio 5A', '10-Nov-2026', '11-Nov-2026', 'Reserved', 1, 70, 'One-night stay (minimum duration).'],
    ['S08', 'Sophie Laurent', 'Pine Grove Cabin', '20-Dec-2026', '27-Dec-2026', 'Reserved', 7, 665, 'Holiday booking.'],
    ['S09', 'Daniel Okafor', 'Harbor View Apartment 3B', '01-Nov-2026', '04-Nov-2026', 'Reserved', 3, 450, 'Back-to-back with RNT S04: starts on its check-out day.'],
    ['S10', 'Hana Sato', 'Downtown Studio 5A', '15-Nov-2026', '18-Nov-2026', 'Reserved', 3, 210, 'Will be cancelled in test E04.'],
    ['S12', 'Lucas Moreau', 'Pine Grove Cabin', '24-Oct-2026', '31-Oct-2026', 'Active', 7, 665, 'Long-weekend guest.'],
  ].map(([id, customer, property, start, end, status, days, total, notes]) => ({
    id,
    area: 'Valid rental + calculation',
    title: `Create ${status} rental: ${customer} / ${property} ${start} to ${end}`,
    expected: `Saved; ${days} day(s) x rate = $${total.toFixed(2)}; reference RNT-#### generated`,
    async run() {
      const res = await newRental({ customer, property, start, end, status, notes, previewShot: id === 'S06' ? 'calc-preview' : null }, `test-${id}`);
      const rows = await reportRows(page, 'All_Rentals');
      const row = rows.find((r) => r[1] === customer && r[3] === start);
      const pass = res.ok && !!row && Number(row[5]) === days && money(row[7]) === total && /^RNT-\d{4}$/.test(row[0]);
      return {
        pass,
        actual: `${res.ok ? 'Saved' : 'Rejected: ' + res.message}. Form preview: ${res.preview.days} days, $${res.preview.total}. Report row: ${row ? row.slice(0, 9).join(' | ') : 'not found'}`,
        evidence: res.shot,
      };
    },
  })),
  {
    id: 'C01', area: 'Property status sync', title: 'Activating a rental marks the property as Rented',
    expected: 'Harbor View Apartment 3B (S04 Active) = Rented; Seaside Loft 101 (no active rental) = Available',
    async run() {
      const a = await propertyStatus('Harbor View Apartment 3B');
      const b = await propertyStatus('Seaside Loft 101');
      return { pass: a === 'Rented' && b === 'Available', actual: `Harbor View = ${a}; Seaside Loft = ${b}`, evidence: await snap(page, 'test-C01') };
    },
  },
  // ---------- Required fields ----------
  {
    id: 'N01', area: 'Required fields', title: 'Submit an empty rental form',
    expected: 'Rejected; Customer, Property, Start Date and End Date flagged as required',
    async run() {
      const res = await newRental({}, 'test-N01');
      return { pass: !res.ok && /invalid entries|required|enter a value/i.test(`${res.message} ${res.fieldErrors}`), actual: `${res.message} | ${(res.fieldErrors || []).join(' ; ')}`, evidence: res.shot };
    },
  },
  {
    id: 'N02', area: 'Required fields', title: 'Rental without a property',
    expected: 'Rejected; Property flagged as required',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', start: '01-Dec-2026', end: '03-Dec-2026' }, 'test-N02');
      return { pass: !res.ok, actual: `${res.message} | ${(res.fieldErrors || []).join(' ; ')}`, evidence: res.shot };
    },
  },
  // ---------- Date ranges & boundaries ----------
  {
    id: 'N03', area: 'Invalid date range', title: 'End date before start date (10-Nov to 05-Nov)',
    expected: 'Rejected: "End date must be later than the start date."; preview shows 0 days / $0.00',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Pine Grove Cabin', start: '10-Nov-2026', end: '05-Nov-2026' }, 'test-N03');
      return { pass: !res.ok && has(res, 'End date must be later than the start date.') && Number(res.preview.days) === 0, actual: `${res.message} (preview ${res.preview.days} days, $${res.preview.total})`, evidence: res.shot };
    },
  },
  {
    id: 'N04', area: 'Boundary: dates', title: 'End date equal to start date (0 days)',
    expected: 'Rejected: "End date must be later than the start date."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Pine Grove Cabin', start: '10-Nov-2026', end: '10-Nov-2026' }, 'test-N04');
      return { pass: !res.ok && has(res, 'End date must be later than the start date.'), actual: `${res.message} (preview ${res.preview.days} days, $${res.preview.total})`, evidence: res.shot };
    },
  },
  {
    id: 'N05', area: 'Boundary: dates', title: '366-day rental (01-Jan-2027 to 02-Jan-2028)',
    expected: 'Rejected: "A rental cannot be longer than 365 days."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Garden House', start: '01-Jan-2027', end: '02-Jan-2028' }, 'test-N05');
      return { pass: !res.ok && has(res, 'cannot be longer than 365 days'), actual: `${res.message} (preview ${res.preview.days} days)`, evidence: res.shot };
    },
  },
  {
    id: 'S13', area: 'Boundary: dates', title: '365-day rental (01-Jan-2027 to 01-Jan-2028) is accepted',
    expected: 'Saved; 365 days x $210 = $76,650.00',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Garden House', start: '01-Jan-2027', end: '01-Jan-2028', notes: 'Boundary test: maximum duration. Cancelled in E05.' }, 'test-S13');
      return { pass: res.ok && Number(res.preview.days) === 365 && money(res.preview.total) === 76650, actual: `${res.ok ? 'Saved' : res.message} (preview ${res.preview.days} days, $${res.preview.total})`, evidence: res.shot };
    },
  },
  // ---------- Overlaps ----------
  {
    id: 'N06', area: 'Overlapping bookings', title: 'Partial overlap: Seaside Loft 08-Nov to 15-Nov (S06 holds 05-Nov to 12-Nov)',
    expected: 'Rejected with "Booking overlap" naming the existing reservation',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Seaside Loft 101', start: '08-Nov-2026', end: '15-Nov-2026' }, 'test-N06');
      return { pass: !res.ok && has(res, 'Booking overlap') && has(res, '05-Nov-2026'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N07', area: 'Overlapping bookings', title: 'Enclosing overlap: Seaside Loft 01-Nov to 20-Nov',
    expected: 'Rejected with "Booking overlap"',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Seaside Loft 101', start: '01-Nov-2026', end: '20-Nov-2026' }, 'test-N07');
      return { pass: !res.ok && has(res, 'Booking overlap'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N08', area: 'Overlapping bookings', title: 'Identical dates: Harbor View 01-Nov to 04-Nov (S09 holds the same dates)',
    expected: 'Rejected with "Booking overlap" naming S09 (01-Nov-2026 to 04-Nov-2026)',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Harbor View Apartment 3B', start: '01-Nov-2026', end: '04-Nov-2026' }, 'test-N08');
      return { pass: !res.ok && has(res, 'Booking overlap') && has(res, '01-Nov-2026 to 04-Nov-2026'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N09', area: 'Overlapping bookings', title: 'Overlap with a reservation that will be cancelled: Downtown Studio 15-Nov to 18-Nov (S10)',
    expected: 'Rejected with "Booking overlap" while S10 is Reserved',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '15-Nov-2026', end: '18-Nov-2026' }, 'test-N09');
      return { pass: !res.ok && has(res, 'Booking overlap'), actual: res.message, evidence: res.shot };
    },
  },
  // ---------- Status rules on create ----------
  {
    id: 'N10', area: 'Rental statuses', title: 'Book a property under Maintenance (Lakeside House)',
    expected: 'Rejected: "Property Lakeside House is under maintenance and cannot be booked."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Lakeside House', start: '10-Dec-2026', end: '12-Dec-2026' }, 'test-N10');
      return { pass: !res.ok && has(res, 'under maintenance'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N11', area: 'Rental statuses', title: 'New reservation starting in the past (20-Oct-2026)',
    expected: 'Rejected: "A reservation cannot start in the past..."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '20-Oct-2026', end: '22-Oct-2026' }, 'test-N11');
      return { pass: !res.ok && has(res, 'cannot start in the past'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N12', area: 'Rental statuses', title: 'New rental as Active with a future start date',
    expected: 'Rejected: "A rental can only be Active once its start date ... has been reached."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '01-Dec-2026', end: '05-Dec-2026', status: 'Active' }, 'test-N12');
      return { pass: !res.ok && has(res, 'can only be Active'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N13', area: 'Rental statuses', title: 'New rental as Completed with an end date in the future',
    expected: 'Rejected: "A rental can only be Completed on or after its end date..."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '20-Oct-2026', end: '29-Oct-2026', status: 'Completed' }, 'test-N13');
      return { pass: !res.ok && has(res, 'can only be Completed'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'N14', area: 'Rental statuses', title: 'New rental created directly as Cancelled',
    expected: 'Rejected: "A new rental cannot be created as Cancelled."',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '01-Dec-2026', end: '05-Dec-2026', status: 'Cancelled' }, 'test-N14');
      return { pass: !res.ok && has(res, 'cannot be created as Cancelled'), actual: res.message, evidence: res.shot };
    },
  },
  // ---------- Status transitions on edit ----------
  {
    id: 'E01', area: 'Status transitions', title: 'Completed -> Active (S01)',
    expected: 'Rejected: "Invalid status change: Completed to Active..."',
    async run() {
      const res = await editRental(['Olivia Bennett', '05-Oct-2026'], { status: 'Active' }, 'test-E01');
      return { pass: !res.ok && has(res, 'Invalid status change: Completed to Active'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'E02', area: 'Status transitions', title: 'Reserved -> Active before the start date (S06, starts 05-Nov)',
    expected: 'Rejected: "A rental can only be Active once its start date (05-Nov-2026) has been reached."',
    async run() {
      const res = await editRental(['Olivia Bennett', '05-Nov-2026'], { status: 'Active' }, 'test-E02');
      return { pass: !res.ok && has(res, 'can only be Active'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'E03', area: 'Status transitions', title: 'Change the dates of a Completed rental (S02)',
    expected: 'Rejected: "Completed rentals are locked. Only the notes can be edited."',
    async run() {
      const res = await editRental(['Mateo Fernandez', '01-Oct-2026'], { end: '09-Oct-2026' }, 'test-E03');
      return { pass: !res.ok && has(res, 'Completed rentals are locked'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'E04', area: 'Status transitions', title: 'Reserved -> Cancelled (S10)',
    expected: 'Saved; S10 shows Cancelled',
    async run() {
      const res = await editRental(['Hana Sato', '15-Nov-2026'], { status: 'Cancelled' }, 'test-E04');
      const row = (await reportRows(page, 'All_Rentals')).find((r) => r[1] === 'Hana Sato' && r[3] === '15-Nov-2026');
      return { pass: res.ok && row?.[8] === 'Cancelled', actual: `${res.ok ? 'Saved' : res.message}; status in report: ${row?.[8]}`, evidence: res.shot };
    },
  },
  {
    id: 'S11', area: 'Overlapping bookings', title: 'Cancelled reservations free their dates: Downtown Studio 15-Nov to 18-Nov again',
    expected: 'Saved (S10 is now Cancelled); 3 days x $70 = $210.00',
    async run() {
      const res = await newRental({ customer: 'Lucas Moreau', property: 'Downtown Studio 5A', start: '15-Nov-2026', end: '18-Nov-2026', notes: 'Took the dates released by a cancellation.' }, 'test-S11');
      return { pass: res.ok && money(res.preview.total) === 210, actual: `${res.ok ? 'Saved' : res.message} (preview ${res.preview.days} days, $${res.preview.total})`, evidence: res.shot };
    },
  },
  {
    id: 'E05', area: 'Status transitions', title: 'Reserved -> Cancelled for the 365-day booking (S13)',
    expected: 'Saved; excluded from Booked Revenue',
    async run() {
      const res = await editRental(['Lucas Moreau', '01-Jan-2027'], { status: 'Cancelled' }, 'test-E05');
      return { pass: res.ok, actual: res.ok ? 'Saved' : res.message, evidence: res.shot };
    },
  },
  {
    id: 'E06', area: 'Status transitions', title: 'Active -> Completed before the end date (S05 ends 30-Oct)',
    expected: 'Rejected: "A rental can only be Completed on or after its end date. To finish early, set the end date to today first."',
    async run() {
      const res = await editRental(['Hana Sato', '26-Oct-2026'], { status: 'Completed' }, 'test-E06');
      return { pass: !res.ok && has(res, 'can only be Completed'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'E07', area: 'Status transitions', title: 'Early check-out: S05 end date -> 27-Oct-2026 (today) and Active -> Completed',
    expected: 'Saved; recalculated to 1 day x $210 = $210.00; Garden House returns to Available',
    async run() {
      const res = await editRental(['Hana Sato', '26-Oct-2026'], { end: '27-Oct-2026', status: 'Completed' }, 'test-E07');
      const row = (await reportRows(page, 'All_Rentals')).find((r) => r[1] === 'Hana Sato' && r[3] === '26-Oct-2026');
      const prop = await propertyStatus('Garden House');
      return { pass: res.ok && Number(row?.[5]) === 1 && money(row?.[7]) === 210 && row?.[8] === 'Completed' && prop === 'Available', actual: `${res.ok ? 'Saved' : res.message}; row: ${row?.slice(0, 9).join(' | ')}; Garden House = ${prop}`, evidence: res.shot };
    },
  },
  // ---------- Properties ----------
  {
    id: 'P01', area: 'Property validation', title: 'Property with a daily rate of 0',
    expected: 'Rejected: "Daily rental rate must be greater than zero."',
    async run() {
      await openForm(page, 'Properties');
      await fillText(page, 'Property_Name', 'Zero Rate Test');
      await fillText(page, 'Address.address_line_1', '1 Test Street');
      await fillText(page, 'Address.district_city', 'Miramar');
      await fillText(page, 'Address.state_province', 'Buenos Aires');
      await fillText(page, 'Address.postal_Code', '7607');
      await pick(page, 'Address.country', 'Argentina');
      await pick(page, 'Property_Type', 'Studio');
      await fillText(page, 'Daily_Rate', '0');
      const res = await submit(page, 'Property saved successfully.', 'test-P01');
      return { pass: !res.ok && has(res, 'greater than zero'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'P02', area: 'Property validation', title: 'Set a property with an active rental to Maintenance (Harbor View, S04 Active)',
    expected: 'Rejected: "This property has an active rental, so its status stays Rented..."',
    async run() {
      const res = await editProperty('Harbor View Apartment 3B', { status: 'Maintenance' }, 'test-P02');
      return { pass: !res.ok && has(res, 'active rental'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'P03', area: 'Property validation', title: 'Manually set a property without active rentals to Rented (Seaside Loft 101)',
    expected: 'Rejected: "Rented is set automatically when a rental becomes Active..."',
    async run() {
      const res = await editProperty('Seaside Loft 101', { status: 'Rented' }, 'test-P03');
      return { pass: !res.ok && has(res, 'Rented is set automatically'), actual: res.message, evidence: res.shot };
    },
  },
  {
    id: 'R01', area: 'Calculation: rate snapshot', title: 'Raising a property rate does not change existing rentals',
    expected: 'Downtown Studio 5A rate 70 -> 80 saved; S07 keeps $70.00; rate restored to 70',
    async run() {
      const up = await editProperty('Downtown Studio 5A', { rate: '80' });
      const row = (await reportRows(page, 'All_Rentals')).find((r) => r[1] === 'Mateo Fernandez' && r[3] === '10-Nov-2026');
      const down = await editProperty('Downtown Studio 5A', { rate: '70' });
      return { pass: up.ok && down.ok && money(row?.[6]) === 70 && money(row?.[7]) === 70, actual: `rate->80 ${up.ok ? 'saved' : up.message}; S07 daily rate ${row?.[6]}, total ${row?.[7]}; rate->70 ${down.ok ? 'saved' : down.message}`, evidence: null };
    },
  },
  // ---------- Customers ----------
  {
    id: 'U01', area: 'Required fields / uniqueness', title: 'Customer with a duplicate email (olivia.bennett@example.com)',
    expected: 'Rejected by the unique-field rule on Email',
    async run() {
      await openForm(page, 'Customers');
      await fillText(page, 'Customer_Name', 'Duplicate Test');
      await fillText(page, 'Email', 'olivia.bennett@example.com');
      await fillText(page, 'Phone', '+12025550100');
      await fillText(page, 'ID_Reference', 'CUS-ID-9999');
      const res = await submit(page, 'Customer saved successfully.', 'test-U01');
      return { pass: !res.ok, actual: `${res.message} | ${(res.fieldErrors || []).join(' ; ')}`, evidence: res.shot };
    },
  },
  {
    id: 'U02', area: 'Required fields / uniqueness', title: 'Customer with an invalid email format',
    expected: 'Rejected by the Email field validation',
    async run() {
      await openForm(page, 'Customers');
      await fillText(page, 'Customer_Name', 'Invalid Email Test');
      await fillText(page, 'Email', 'not-an-email');
      await fillText(page, 'Phone', '+12025550101');
      await fillText(page, 'ID_Reference', 'CUS-ID-9998');
      const res = await submit(page, 'Customer saved successfully.', 'test-U02');
      return { pass: !res.ok, actual: `${res.message} | ${(res.fieldErrors || []).join(' ; ')}`, evidence: res.shot };
    },
  },
  // ---------- References ----------
  {
    id: 'L01', area: 'Missing / incorrect references', title: 'Customer lookup offers only existing customers',
    expected: 'Dropdown lists exactly the 6 saved customers; a non-existent name returns no match',
    async run() {
      await openForm(page, 'Rentals');
      const container = page.locator('input[name="zc-sel2-foc-Customer"]').locator('xpath=ancestor::div[contains(@class,"select2-container")][1]');
      await container.locator('.select2-choice').click();
      const drop = page.locator('.select2-drop-active:visible').first();
      await drop.waitFor();
      await page.waitForTimeout(2000);
      const all = (await drop.locator('.select2-results li').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      const search = drop.locator('input.select2-input');
      await search.fill('Nonexistent Person');
      await page.waitForTimeout(2500);
      const none = (await drop.locator('.select2-results li').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      const shot = await snap(page, 'test-L01');
      await page.keyboard.press('Escape');
      return { pass: all.length === 6 && !none.some((s) => s.includes('Nonexistent Person')), actual: `options: ${all.join(', ')}; search "Nonexistent Person": ${none.join(', ') || '(none)'}`, evidence: shot };
    },
  },
  {
    id: 'L02', area: 'Missing / incorrect references', title: 'Rental form opened with a non-existent Customer ID in the URL (Customer=1234567890123)',
    expected: 'The invalid ID is not accepted as a customer; the rental cannot be saved with it',
    async run() {
      const res = await newRental({ query: 'Customer=1234567890123', property: 'Pine Grove Cabin', start: '01-Dec-2026', end: '03-Dec-2026' }, 'test-L02');
      return { pass: !res.ok, actual: `${res.ok ? 'Saved (unexpected)' : res.message} | ${(res.fieldErrors || []).join(' ; ')}`, evidence: res.shot };
    },
  },
  // ---------- Dashboard ----------
  {
    id: 'K01', area: 'Dashboard KPIs', title: 'Dashboard KPIs match the data',
    expected: 'Active 2, Upcoming 5, Available Properties 3, Customers 6, Realized $1,925.00, Booked $3,950.00',
    async run() {
      await page.goto(`${APP}/#Page:Dashboard`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);
      const text = await page.evaluate(() => document.body.innerText);
      const grab = (label) => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        // Last match: the navigation menu also contains "Customers".
        const i = lines.findLastIndex((l) => l.startsWith(label));
        return i > 0 ? lines[i - 1] : null;
      };
      const k = {
        active: grab('Active Rentals'), upcoming: grab('Upcoming Rentals'), available: grab('Available Properties'),
        customers: grab('Customers'), realized: grab('Realized Revenue'), booked: grab('Booked Revenue'),
      };
      const pass = money(k.active) === 2 && money(k.upcoming) === 5 && money(k.available) === 3 && money(k.customers) === 6 && money(k.realized) === 1925 && money(k.booked) === 3950;
      return { pass, actual: JSON.stringify(k), evidence: await snap(page, 'test-K01') };
    },
  },
];

for (const t of tests) {
  if (only.length && !only.includes(t.id)) continue;
  if (!force && results[t.id]?.status === 'PASS') continue;
  process.stdout.write(`${t.id} ${t.title} ... `);
  let r;
  try {
    r = await t.run();
  } catch (e) {
    r = { pass: false, actual: `Automation error: ${e.message.split('\n')[0]}`, evidence: await snap(page, `test-${t.id}-error`).catch(() => null), error: true };
  }
  const status = r.error ? 'NOT_EXECUTED' : r.pass ? 'PASS' : 'FAIL';
  results[t.id] = { id: t.id, area: t.area, title: t.title, expected: t.expected, actual: r.actual, status, evidence: r.evidence, executedAt: new Date().toISOString() };
  console.log(status, '-', r.actual);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
}
process.exit(0);
