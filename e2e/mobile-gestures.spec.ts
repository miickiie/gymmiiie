import { expect, test } from '@playwright/test';
import { seed } from './fixtures';

test('mobile surfaces suppress zoom and selection while inputs remain editable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'This behavior applies to touch devices.');
  await seed(page);
  await page.goto('/library');
  await expect(page.locator('body')).toHaveCSS('touch-action', 'pan-x pan-y');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('user-select', 'none');
  const search = page.getByRole('textbox', { name: 'Search exercise library', exact: true });
  await expect(search).toHaveCSS('user-select', 'text');
  await search.fill('squat');
  await expect(search).toHaveValue('squat');
  await search.evaluate((element) => {
    if (element instanceof HTMLInputElement) element.setSelectionRange(0, 5);
  });
  expect(await search.evaluate((element) => element instanceof HTMLInputElement ? element.selectionEnd : null)).toBe(5);

  const scale = await page.evaluate(() => window.visualViewport?.scale);
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 130, y: 250 }, { x: 230, y: 250 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 250 }, { x: 280, y: 250 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(scale);
  await touch.detach();
});
