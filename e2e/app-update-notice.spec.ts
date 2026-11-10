import { expect, test } from '@playwright/test';
import { enterNumber, seed, startWithPushup } from './fixtures';

const NEXT_VERSION = 'ffffffffffffffffffff';

test('the loaded app and server agree on the current build', async ({ page }) => {
  await seed(page);
  const loaded = await page.locator('meta[name="gymmiie-build"]').getAttribute('content');
  expect(loaded).toMatch(/^[a-f0-9]{20}$/);
  const response = await page.request.get('/api/app-version');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ version: loaded });
  await expect(page.getByRole('button', { name: 'Refresh app', exact: true })).toHaveCount(0);
});

test('Mochi asks on open, waits for consent, and remembers Later for that version', async ({ page }, testInfo) => {
  let remoteVersion = NEXT_VERSION;
  let checks = 0;
  await page.route('**/api/app-version', async (route) => {
    checks += 1;
    await route.fulfill({ json: { version: remoteVersion } });
  });
  await seed(page);
  const cat = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(cat.getByRole('status')).toContainText('A newer Gymmiie is ready.');
  await page.clock.install();
  await page.clock.fastForward(20_000);
  await expect(cat.getByRole('button', { name: 'Refresh app', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: testInfo.outputPath('mochi-update-ready.png'), animations: 'disabled' });

  await cat.getByRole('button', { name: 'Later', exact: true }).click();
  const previousChecks = checks;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => checks).toBeGreaterThan(previousChecks);
  await expect(cat.getByRole('button', { name: 'Refresh app', exact: true })).toHaveCount(0);

  remoteVersion = 'eeeeeeeeeeeeeeeeeeee';
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(cat.getByRole('button', { name: 'Refresh app', exact: true })).toBeVisible();
});

test('refreshing after a resume check preserves an active workout and sign-in', async ({ page }) => {
  await seed(page);
  await startWithPushup(page);
  while (await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).isVisible()) {
    await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  }
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '19');
  await page.route('**/api/app-version', (route) => route.fulfill({ json: { version: NEXT_VERSION } }));
  await page.evaluate(() => {
    localStorage.setItem('update-preservation-check', 'keep');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Refresh app', exact: true }).click();
  await expect(page).toHaveURL(/\/\?app-update=\d+$/);
  await expect(page.getByRole('region', { name: 'Page content' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('update-preservation-check'))).toBe('keep');
  await page.goto('/session');
  await expect(page.getByLabel('Set 1 repetitions', { exact: true })).toHaveValue('19');
});

test('a failed refresh check keeps the app open and offers retry', async ({ page }) => {
  let unavailable = false;
  await page.route('**/api/app-version', (route) => unavailable
    ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
    : route.fulfill({ json: { version: NEXT_VERSION } }));
  await seed(page);
  const refresh = page.getByRole('button', { name: 'Refresh app', exact: true });
  await expect(refresh).toBeVisible();
  unavailable = true;
  await refresh.click();
  const cat = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(cat.getByRole('alert')).toContainText('Mochi couldn’t refresh yet.');
  await expect(refresh).toBeEnabled();
  await expect(page).toHaveURL(/\/$/);
});

test('unavailable or malformed version responses never announce an update', async ({ page }) => {
  await page.route('**/api/app-version', (route) => route.fulfill({ status: 503, json: { error: 'offline' } }));
  await seed(page);
  await expect(page.getByRole('button', { name: 'Refresh app', exact: true })).toHaveCount(0);
  await page.unroute('**/api/app-version');
  await page.route('**/api/app-version', (route) => route.fulfill({ json: { version: null } }));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('region', { name: 'Page content' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh app', exact: true })).toHaveCount(0);
});
