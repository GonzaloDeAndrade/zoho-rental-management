// Builds app/RentalManagement.ds from the template, the Deluge scripts in
// src/deluge and the generated dashboard page (ZML).
// Usage: node app/build.mjs [--no-crm]
//   --no-crm  leaves out the Zoho CRM sync and the Zoho Books invoice
//             (src/deluge/crm_sync.dg, books_invoice.dg), for accounts where those
//             connections aren't set up.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const withCrm = !process.argv.includes('--no-crm');
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8').replace(/\r\n/g, '\n');
const indent = (code, tabs) =>
  code.trimEnd().split('\n').map((l) => (l ? '\t'.repeat(tabs) + l : l)).join('\n');

// ---------- Dashboard ----------
const q = (s) => s.replace(/"/g, '&quot;');

function kpiPanel({ name, color, value, criteria, label, report, money }) {
  const number = money
    ? `\tdisplayType = 'actual'\n\tdecimalPlaces = '2'\n\tthousandsSeperator = 'COMMA'\n\tdecimalSeperator = 'DOT'\n\tnumberScale = 'none'\n`
    : `\tdisplayType = 'actual'\n\tthousandsSeperator = 'LOCALE'\n\tdecimalSeperator = 'DOT'\n\tnumberScale = 'none'\n`;
  const crit = criteria ? `\t\tcriteria = '${q(criteria)}'\n` : '';
  return `<panel elementName="${name}"\n >\n\t<pr \n\t\t\twidth='fill'\n\t\theight='fill'\n>\n\t<pc \n\t\tbgColor = '#FFFFFF'\n\n\t\twidth = '100%'\n>\n\t<pr \n\t\t\twidth='fill'\n\t\theight='fill'\n>\n\t<pc \n\t\tpadding = '20px'\n\tbgColor = '#FFFFFF'\n\n    action = 'OpenReport'\n\t\tparameters = '#Report:${report}' \n\t\tcomponentLinkName = '${report}'\n\t\ttarget = 'popup'\n\t\twidth = '100%'\n\t\thAlign = 'center'\n\t\tvAlign = 'middle'\n>\n\t<pr \n\t\t\twidth='auto'\n\t\theight='auto'\n>\n\t<pc \n\t\tpadding = '5px'\n\n>\n\t<pr \n\t>\n\t<pc \n\t\n>\n\t<text \n\n\tmarginLeft = '0px'\n\tmarginRight = '0px' \n\tmarginBottom = '0px'\n\tmarginTop = '5px'\n\tcolor = '${color}'\n\tsize = '36px'\n\tbold = 'true' \n\ttype = 'Form Data'\n\tbgColor = '#FFFFFF'\n\n${number}\n\n\t  \n${crit}\t  value = '${value}'\n>\n</text>\n\n</pc>\n</pr>\n</pc>\n</pr>\n</pc>\n</pr><pr \n\t\t\twidth='fill'\n\t\theight='50px'\n>\n\t<pc \n\t\tpadding = '0px'\n\tbgColor = '${color}'\n\n\t\twidth = '100%'\n\t\thAlign = 'center'\n\t\tvAlign = 'middle'\n>\n\t<pr \n\t\t\twidth='auto'\n\t\theight='auto'\n>\n\t<pc \n\t\n>\n\t<text \n\n\tmarginLeft = '20px'\n\tmarginRight = '20px' \n\tmarginBottom = '0px'\n\tmarginTop = '0px'\n\tcolor = '#FFFFFF'\n\tsize = '16px'\n\tbold = 'true' \n\ttype = 'Text'\n\n\n\n\t  \n\t  value = '${label}'\n>\n</text>\n\n</pc>\n</pr>\n</pc>\n</pr>\n</pc>\n</pr>\n</panel>`;
}

// KPI definitions - keep in sync with docs/BUSINESS_RULES.md (KPI section).
const kpiRows = [
  [
    { label: 'Active Rentals', value: 'thisapp.Rentals.ID.count', criteria: 'Rental_Status == "Active"', report: 'Active_Rentals', color: '#2A70E7' },
    { label: 'Upcoming Rentals', value: 'thisapp.Rentals.ID.count', criteria: 'Rental_Status == "Reserved"', report: 'Upcoming_Rentals', color: '#7B61FF' },
    { label: 'Available Properties', value: 'thisapp.Properties.ID.count', criteria: 'Availability_Status == "Available"', report: 'Available_Properties', color: '#0A9F4B' },
    { label: 'Customers', value: 'thisapp.Customers.ID.count', report: 'All_Customers', color: '#E8710A' },
  ],
  [
    { label: 'Realized Revenue (USD) - Completed rentals', value: 'thisapp.Rentals.Total_Cost.sum', criteria: 'Rental_Status == "Completed"', report: 'Completed_Rentals', color: '#1F2D3D', money: true },
    { label: 'Booked Revenue (USD) - Reserved + Active', value: 'thisapp.Rentals.Total_Cost.sum', criteria: 'Rental_Status == "Reserved" || Rental_Status == "Active"', report: 'All_Rentals', color: '#0E8A94', money: true },
  ],
];

let n = 0;
const rows = kpiRows
  .map((row) => {
    const width = `${Math.floor(100 / row.length)}%`;
    const cols = row
      .map((k) => `<column\n   \t\t width="${width}"\n   \t>\n\t${kpiPanel({ ...k, name: n++ ? `Panel ${n - 1}` : 'Panel' })}\n</column>`)
      .join('');
    return `<row>\n\t${cols}\n</row>`;
  })
  .join('');
const zml = `<zml \n>\n\t<layout>\n\t${rows}\n</layout>\n</zml>`;
const zmlEscaped = JSON.stringify(zml).slice(1, -1).replace(/\//g, '\\/');

// ---------- Report status colours ----------
const statusColours = {
  Reserved: 'color:#5b3cc4;background-color:#ece7ff;',
  Active: 'color:#1d4f91;background-color:#dde8f8;',
  Completed: 'color:#0b6b3a;background-color:#d9f2e3;',
  Cancelled: 'color:#6b6b6b;background-color:#ececec;',
};
const formatting =
  '\t\t\tconditional formatting\n\t\t\t(\n' +
  Object.entries(statusColours)
    .map(([s, f]) => `\t\t\t\t"${s}"\n\t\t\t\t{\n\t\t\t\tcondition = (Rental_Status == "${s}")\n\t\t\t\tfields = [Rental_Status]\n\t\t\t\tformat = "${f}"\n\t\t\t\t}`)
    .join('\n') +
  '\n\t\t\t)';

// ---------- Assemble ----------
const ds = read('src/RentalManagement.template.ds')
  .replace('__DASHBOARD_ZML__', () => zmlEscaped)
  .replace('__STATUS_FORMATTING__', () => formatting)
  .replace('__RENTAL_VALIDATE__', () => indent(read('src/deluge/rental_validate.dg'), 7))
  .replace('__RENTAL_SUCCESS__', () => indent(read('src/deluge/rental_success.dg') + (withCrm ? read('src/deluge/crm_sync.dg') + read('src/deluge/books_invoice.dg') : '') + read('src/deluge/booking_email.dg'), 7))
  .replace('__PROPERTY_VALIDATE__', () => indent(read('src/deluge/property_validate.dg'), 7));

const left = ds.match(/__[A-Z_]+__/);
if (left) throw new Error(`Unfilled placeholder ${left[0]}`);
const opens = (ds.match(/[{(\[]/g) || []).length;
const closes = (ds.match(/[})\]]/g) || []).length;
console.log(`brackets open=${opens} close=${closes}`);

const out = path.join(here, withCrm ? 'RentalManagement.ds' : 'RentalManagement-no-crm.ds');
fs.writeFileSync(out, ds.replace(/\n/g, '\r\n'));
console.log('Wrote', out);
