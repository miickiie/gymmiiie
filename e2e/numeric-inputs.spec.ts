import { expect, test } from '@playwright/test';
import { enterNumber, seed, startWithPushup } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test('workout numeric entry remains available on mobile and desktop', async ({ page }, testInfo) => {
  await startWithPushup(page);
  const input = page.getByLabel('Set 1 repetitions', { exact: true });
  if (testInfo.project.name === 'mobile') {
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).toHaveAttribute('inputmode', 'none');
  } else {
    await expect(input).toBeEditable();
    await expect(input).toHaveAttribute('inputmode', 'decimal');
  }
  await enterNumber(input, '14');
  await expect(input).toHaveValue('14');
  await expect(page.getByRole('dialog', { name: 'Number pad', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change sign', exact: true })).toHaveCount(0);
  await expect(page.getByText('Set 1 repetitions', { exact: true })).toHaveCount(0);
  await input.blur();
  await page.reload();
  await expect(input).toHaveValue('14');
});

test('numeric fields accept decimal weights and food portions', async ({ page }) => {
  await page.goto('/settings');
  const weight = page.getByRole('spinbutton', { name: /^Weight\b/ });
  await enterNumber(weight, '82.5');
  await weight.blur();
  await expect(weight).toHaveValue('82.5');
  await enterNumber(weight, '79.2');
  await weight.blur();
  await expect(weight).toHaveValue('79.2');
  await page.goto('/nutrition');
  await page.getByRole('button', { name: 'Add Banana', exact: true }).click();
  const portion = page.getByRole('spinbutton', { name: 'Portion in grams', exact: true });
  await enterNumber(portion, '82.5');
  await expect(portion).toHaveValue('82.5');
});

test('nutrition goals remain editable inside their sheet', async ({ page }) => {
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
