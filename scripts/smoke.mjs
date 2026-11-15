// Local smoke test: node scripts/smoke.mjs <board url>
import { chromium } from 'playwright';
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME });
for (const [locale, timezoneId] of [['en-NZ', 'Pacific/Auckland'], ['de-DE', 'Europe/Berlin']]) {
  const ctx = await browser.newContext({ locale, timezoneId });
  const page = await ctx.newPage();
  const sawLoader = page.waitForSelector('[data-testid=loader]', { state: 'attached', timeout: 3000 }).then(() => true, () => false);
  await page.goto(url);
  await page.waitForSelector('[data-testid=incident-row]');
  console.log(locale, 'loader seen:', await sawLoader, 'loader now:', await page.locator('[data-testid=loader]').count());
  const row = page.locator('[data-testid=incident-row]').first();
  console.log(locale, await row.locator('time').textContent(), '|', await row.locator('time').getAttribute('datetime'));
  console.log('sha', await page.locator('[data-testid=build-sha]').textContent(), await page.locator('meta[name=build]').getAttribute('content'));
  if (locale === 'de-DE') {
    const before = await page.locator('[data-testid=incident-row]').count();
    const id = await page.locator('[data-testid=incident-row]').nth(2).getAttribute('data-id');
    await page.locator(`[data-id="${id}"] [data-testid=ack]`).click();
    await page.waitForSelector(`[data-id="${id}"] [data-testid=acked]`);
    console.log('acked', id, await page.locator(`[data-id="${id}"] [data-testid=acked]`).getAttribute('title'));
    await page.waitForTimeout(7000);
    console.log('still acked after refreshes:', await page.locator(`[data-id="${id}"] [data-testid=acked]`).count(), 'rows', before, '->', await page.locator('[data-testid=incident-row]').count());
  }
  await ctx.close();
}
await browser.close();
