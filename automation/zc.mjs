// Helpers to drive the live Rental Management app like a user would:
// open a form, fill fields, submit, and capture what the app answers.
import { snap, visibleText } from './lib.mjs';

export const APP = 'https://creatorapp.zoho.com/gonzadeandrade1/rental-management';

export async function openForm(page, form, query = '') {
  await page.goto(`${APP}/#Form:${form}${query ? '?' + query : ''}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('input[type=submit]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

export async function fillText(page, name, value) {
  const el = page.locator(`[name="${name}"]`).first();
  await el.click();
  await el.fill(String(value));
  await el.press('Tab');
  await page.waitForTimeout(400);
}

export async function fillDate(page, name, value) {
  const el = page.locator(`input[name="${name}"]`).first();
  await el.click();
  await el.fill('');
  await el.pressSequentially(value, { delay: 20 });
  await page.keyboard.press('Enter');
  // Click a neutral spot (form title) so the date picker closes and the
  // field's change/blur fires without opening the next field's picker.
  await page.locator('.zcform_Rentals, form').first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  await page.waitForTimeout(1500); // let "on user input" workflows run
}

export async function pick(page, name, text) {
  // The address country picker has no named focusser; it is addressed by id.
  const container =
    name === 'Address.country'
      ? page.locator('#s2id_country')
      : page
          .locator(`input[name="zc-sel2-foc-${name}"]`)
          .locator('xpath=ancestor::div[contains(@class,"select2-container")][1]');
  if (name === 'Address.country') await page.evaluate(() => window.jQuery('#country').select2('open'));
  else await container.locator('.select2-choice').click();
  const drop = page.locator('.select2-drop-active:visible').first();
  await drop.waitFor({ timeout: 10000 });
  const search = drop.locator('input.select2-input');
  if (await search.isVisible().catch(() => false)) await search.fill(text);
  const option = drop.locator('.select2-results li', { hasText: text }).first();
  await option.waitFor({ timeout: 15000 });
  await option.click();
  await page.waitForTimeout(1500); // let "on user input" workflows run
}

// Returns the record ID of the first report row containing all given texts.
export async function findRecordId(page, report, texts) {
  await page.goto(`${APP}/#Report:${report}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('tr[elname=zc-reportRowEl]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  let row = page.locator('tr[elname=zc-reportRowEl]');
  for (const t of texts) row = row.filter({ hasText: t });
  if ((await row.count()) === 0) return null;
  return row.first().getAttribute('reclinkid');
}

export async function openEdit(page, form, report, id) {
  await openForm(page, form, `recLinkID=${id}&viewLinkName=${report}`);
}

// Reads a report as rows of cell texts (header row excluded).
export async function reportRows(page, report) {
  await page.goto(`${APP}/#Report:${report}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('tr[elname=zc-reportRowEl], .zc-report-nodata, :text("No records")').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page.$$eval('tr[elname=zc-reportRowEl]', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].slice(2).map((td) => td.innerText.trim()))
  );
}

export async function value(page, name) {
  return page.locator(`[name="${name}"]`).first().inputValue();
}

// Submits the open form and waits for the success message, an alert popup
// (Deluge `alert` or "Invalid entries found") or inline field errors.
export async function submit(page, successText, shotName) {
  const before = new Set((await visibleText(page, 50000)).split('\n').map((l) => l.trim()));
  const startUrl = page.url();
  await page.locator('input[type=submit]').first().click();
  let result = null;
  for (let i = 0; i < 50 && !result; i++) {
    await page.waitForTimeout(400);
    // After a successful edit Creator leaves the form and opens the report.
    if (page.url() !== startUrl && page.url().includes('#Report:')) {
      result = { ok: true, message: `Saved (redirected to ${page.url().split('#')[1]})` };
      break;
    }
    try {
      result = await readOutcome();
    } catch {
      // The page navigated while being read; the next iteration checks the URL.
    }
  }
  result ??= { ok: false, message: '(no response detected)' };
  if (shotName) {
    await page.waitForTimeout(result.ok ? 2500 : 0);
    result.shot = await snap(page, shotName);
  }
  if (!result.ok) await page.locator('.alert-popup .popupFooter button, .alert-popup .popupFooter input').first().click().catch(() => {});
  return result;

  async function readOutcome() {
    const text = await visibleText(page, 50000);
    const hit = [].concat(successText).find((s) => text.toLowerCase().includes(s.toLowerCase()));
    if (hit) return { ok: true, message: hit };
    const alert = page.locator('.alert-popup .alertMsg:visible');
    if (!(await alert.count())) return null;
    await page.waitForTimeout(300);
    const fieldErrors = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !before.has(l) && !/^(OK|Invalid entries found|Please rectify and submit again\.?)$/i.test(l));
    const alertText = (await alert.first().innerText()).trim();
    return { ok: false, message: alertText, fieldErrors: [...new Set(fieldErrors)].filter((l) => !alertText.includes(l)) };
  }
}
