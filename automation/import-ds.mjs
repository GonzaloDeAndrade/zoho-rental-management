// Usage: node import-ds.mjs <file.ds>
// Opens Creator's "Import from file" screen, uploads the .ds and prints either
// the importer's error block or the page the importer lands on.
import { creatorPage, snap, visibleText } from './lib.mjs';
import path from 'node:path';

const file = path.resolve(process.argv[2]);
const { page } = await creatorPage();
await page.goto('https://creator.zoho.com/userhome/gonzadeandrade1/admindashboard#/creator/import');
await page.reload({ waitUntil: 'domcontentloaded' });
let frame;
for (let i = 0; i < 30 && !frame; i++) {
  await page.waitForTimeout(1000);
  frame = page.frames().find((f) => f.url().includes('sheet2appimport'));
}
if (!frame) throw new Error('Import frame not found');
await frame.locator('input[type=file]').first().setInputFiles(file, { timeout: 30000 });

for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(2000);
  const text = await visibleText(page, 20000);
  const err = text.indexOf('Error at line');
  if (err >= 0) {
    console.log('IMPORT_ERROR');
    console.log(text.slice(err, err + 1800));
    console.log('SHOT:', await snap(page, 'import-error'));
    process.exit(2);
  }
  if (!page.url().includes('/creator/import')) {
    console.log('LANDED', page.url());
    await page.waitForTimeout(5000);
    console.log('SHOT:', await snap(page, 'import-done'));
    console.log((await visibleText(page, 3000)).slice(0, 3000));
    process.exit(0);
  }
}
console.log('TIMEOUT', page.url());
console.log('SHOT:', await snap(page, 'import-timeout'));
console.log((await visibleText(page, 20000)).slice(-3000));
process.exit(1);
