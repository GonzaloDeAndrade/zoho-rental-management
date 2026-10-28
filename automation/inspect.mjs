// Usage: node inspect.mjs <name> [url]
// Optionally navigates the Creator tab, then saves a screenshot to out/<name>.png
// and prints the page's visible text.
import { creatorPage, snap, visibleText } from './lib.mjs';

const [name = 'inspect', url] = process.argv.slice(2);
const { page } = await creatorPage();
if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
console.log('URL:', page.url());
console.log('SHOT:', await snap(page, name));
console.log(await visibleText(page));
process.exit(0);
