// Opens a visible Chromium window with a persistent profile so the user can
// sign in to Zoho through the official login page. Other scripts attach to
// this window over CDP (port 9333) instead of handling credentials.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.join(here, '.browser-profile');

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  locale: 'en-US',
  args: ['--remote-debugging-port=9333', '--start-maximized', '--lang=en-US'],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://creator.zoho.com/');
console.log('Browser ready on CDP port 9333');

context.on('close', () => process.exit(0));
await new Promise(() => {});
