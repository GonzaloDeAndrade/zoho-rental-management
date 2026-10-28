// Usage: node click.mjs <name> <text-or-selector>
// Clicks the first visible element matching the text (or a CSS selector when
// prefixed with "css="), then screenshots and prints the page text.
import { creatorPage, snap, visibleText } from './lib.mjs';

const [name, target] = process.argv.slice(2);
const { page } = await creatorPage();
const loc = target.startsWith('css=') ? page.locator(target.slice(4)) : page.getByText(target, { exact: true });
await loc.first().click({ timeout: 15000 });
await page.waitForTimeout(3500);
console.log('URL:', page.url());
console.log('SHOT:', await snap(page, name));
console.log(await visibleText(page));
process.exit(0);
