// Shared helpers: attach to the signed-in browser window and work with its
// Zoho Creator tab.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const outDir = path.join(here, 'out');
fs.mkdirSync(outDir, { recursive: true });

export async function creatorPage() {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('creator.zoho')) ?? ctx.pages()[0];
  await page.bringToFront();
  return { browser, ctx, page };
}

export async function snap(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

export async function visibleText(page, max = 4000) {
  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  return text.replace(/\n{2,}/g, '\n').slice(0, max);
}
