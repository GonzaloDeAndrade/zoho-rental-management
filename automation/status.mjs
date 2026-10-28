// Prints the URL and title of every tab in the shared browser window.
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9333');
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) console.log(p.url(), '|', await p.title().catch(() => '(navigating)'));
}
process.exit(0);
