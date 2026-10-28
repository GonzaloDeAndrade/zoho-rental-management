// Adds the fictional customers and properties from test-data/seed-data.json
// through the live forms. Records that already exist are reported, not duplicated
// (Email and Property Name are unique fields).
import fs from 'node:fs';
import path from 'node:path';
import { creatorPage, here } from './lib.mjs';
import { openForm, fillText, pick, submit } from './zc.mjs';

const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'test-data', 'seed-data.json'), 'utf8'));
const { page } = await creatorPage();
const log = [];

for (const c of process.argv.includes('--skip-customers') ? [] : data.customers) {
  await openForm(page, 'Customers');
  await fillText(page, 'Customer_Name', c.name);
  await fillText(page, 'Email', c.email);
  await fillText(page, 'Phone', c.phone);
  await fillText(page, 'ID_Reference', c.idRef);
  const r = await submit(page, 'Customer saved successfully.');
  log.push({ customer: c.name, ...r });
  console.log('customer', c.name, r.ok ? 'OK' : r.message, r.fieldErrors ?? '');
}

for (const p of data.properties) {
  await openForm(page, 'Properties');
  await fillText(page, 'Property_Name', p.name);
  await fillText(page, 'Address.address_line_1', p.line1);
  await fillText(page, 'Address.district_city', p.city);
  await fillText(page, 'Address.state_province', p.state);
  await fillText(page, 'Address.postal_Code', p.zip);
  await pick(page, 'Address.country', 'Argentina');
  await pick(page, 'Property_Type', p.type);
  await fillText(page, 'Daily_Rate', p.rate);
  if (p.status !== 'Available') await pick(page, 'Availability_Status', p.status);
  await fillText(page, 'Description', p.description);
  const r = await submit(page, 'Property saved successfully.');
  log.push({ property: p.name, ...r });
  console.log('property', p.name, r.ok ? 'OK' : r.message, r.fieldErrors ?? '');
}

fs.writeFileSync(path.join(here, 'out', 'seed-master.json'), JSON.stringify(log, null, 2));
process.exit(0);
