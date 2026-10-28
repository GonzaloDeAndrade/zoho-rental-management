// Navigates the first tab of the shared browser window to the given URL.
import { chromium } from 'playwright';

const url = process.argv[2];
const browser = await chromium.connectOverCDP('http://localhost:9333');
const page = browser.contexts()[0].pages()[0];
await page.goto(url, { waitUntil: 'domcontentloaded' });
console.log(page.url());
process.exit(0);
