import { expect, test } from '@playwright/test';
import { enterNumber, seed, startWithPushup } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test('mobile number pad does not resize or scroll the page and Cancel preserves the value', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Desktop keeps native numeric editing.');
  await startWithPushup(page);
  const input = page.getByLabel('Set 1 repetitions', { exact: true });
  await input.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({ height: window.visualViewport?.height, width: window.innerWidth, y: window.scrollY }));
  const initial = await input.inputValue();
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveAttribute('inputmode', 'none');
  await input.tap();
  const pad = page.getByRole('dialog', { name: 'Number pad', exact: true });
  await expect(pad).toBeVisible();
  await pad.getByRole('button', { name: '3', exact: true }).tap();
  await expect(input).toHaveValue(initial);
  const during = await page.evaluate(() => ({ height: window.visualViewport?.height, width: window.innerWidth, y: window.scrollY }));
  expect(during).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('workout-number-pad.png'), animations: 'disabled' });
  await pad.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(input).toHaveValue(initial);
  await expect(input).toBeFocused();
  await expect(pad).toHaveCount(0);
});

test('mobile keypad replaces values and supports decimals, delete, and clear', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Desktop keeps native numeric editing.');
  await page.goto('/settings');
  const weight = page.getByRole('spinbutton', { name: /^Weight\b/ });
  await weight.click();
  const pad = page.getByRole('dialog', { name: 'Number pad', exact: true });
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await pad.getByRole('button', { name: '2', exact: true }).click();
  await pad.getByRole('button', { name: 'Decimal point', exact: true }).click();
  await pad.getByRole('button', { name: '6', exact: true }).click();
  await pad.getByRole('button', { name: 'Delete digit', exact: true }).click();
  await pad.getByRole('button', { name: '5', exact: true }).click();
  await pad.getByRole('button', { name: 'Apply number', exact: true }).click();
  await expect(weight).toHaveValue('82.5');
  await enterNumber(weight, '79.2');
  await expect(weight).toHaveValue('79.2');
  await page.goto('/nutrition');
  await page.getByRole('button', { name: 'Add Banana', exact: true }).click();
  const portion = page.getByRole('spinbutton', { name: 'Portion in grams', exact: true });
  await enterNumber(portion, '82.');
  await expect(portion).toHaveValue('82');
});

test('a nested nutrition keypad applies and returns focus to the original goals sheet', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Desktop keeps native numeric editing.');
  await page.goto('/nutrition');
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  const goals = page.getByRole('dialog', { name: 'Daily goals', exact: true });
  const calories = goals.getByRole('spinbutton', { name: /^Calories\b/ });
  await enterNumber(calories, '2300');
  await expect(goals).toBeVisible();
  await expect(calories).toBeFocused();
  await expect(calories).toHaveValue('2300');
  await goals.getByRole('button', { name: 'Save goals', exact: true }).click();
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  await expect(calories).toHaveValue('2300');
});

test('desktop numeric fields remain editable without opening a pad', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mobile uses the custom pad.');
  await startWithPushup(page);
  const input = page.getByLabel('Set 1 repetitions', { exact: true });
  await input.fill('14');
  await expect(input).toHaveValue('14');
  await expect(page.getByRole('dialog', { name: 'Number pad', exact: true })).toHaveCount(0);
});
