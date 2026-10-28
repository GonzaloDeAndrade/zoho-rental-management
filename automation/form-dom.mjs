// Usage: node form-dom.mjs <FormLinkName>
// Opens a live form and prints its input elements, to map fields to selectors.
import { creatorPage, snap } from './lib.mjs';

const form = process.argv[2];
const { page } = await creatorPage();
await page.goto(`https://creatorapp.zoho.com/gonzadeandrade1/rental-management/#Form:${form}`);
await page.waitForTimeout(6000);
console.log('SHOT:', await snap(page, `form-${form}`));
const els = await page.evaluate(() =>
  [...document.querySelectorAll('input, textarea, select, button, [role=combobox], [elname], [data-fieldname]')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => [e.tagName, e.type || '', 'name=' + (e.name || ''), 'id=' + (e.id || ''), 'elname=' + (e.getAttribute('elname') || ''), 'aria=' + (e.getAttribute('aria-label') || ''), 'cls=' + (e.className?.toString?.() || '').slice(0, 50)].join(' '))
);
console.log(els.join('\n'));
process.exit(0);
