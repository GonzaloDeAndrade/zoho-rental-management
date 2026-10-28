// Lists clickable elements and file inputs on the Creator tab (all frames),
// to find stable selectors for the next automation step.
import { creatorPage, snap } from './lib.mjs';

const { page } = await creatorPage();
console.log('URL:', page.url());
console.log('SHOT:', await snap(page, process.argv[2] || 'dump'));
for (const frame of page.frames()) {
  const items = await frame
    .evaluate(() =>
      [...document.querySelectorAll('button, a, input, [role=button], [role=tab], li, label')]
        .filter((e) => e.offsetParent !== null || e.type === 'file')
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.type ? '[' + e.type + ']' : ''} ${(e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 60).replace(/\n/g, ' ')}`)
        .filter((s) => s.trim().length > 3)
    )
    .catch(() => []);
  if (items.length) console.log(`--- frame ${frame.url().slice(0, 90)}\n` + [...new Set(items)].slice(0, 120).join('\n'));
}
process.exit(0);
