import { expect, test, type Locator } from '@playwright/test';
import { seed, startWithPushup } from './fixtures';

async function expectUnitSpacing(scope: Locator): Promise<void> {
  const fields = await scope.locator('input[type="number"]').evaluateAll((inputs) =>
    inputs.flatMap((input) => {
      if (!(input instanceof HTMLInputElement) || !input.getClientRects().length) return [];
      const unit = input.parentElement?.querySelector(':scope > span.absolute');
      if (!(unit instanceof HTMLElement)) return [];
      const box = input.getBoundingClientRect();
      const suffix = unit.getBoundingClientRect();
      const style = getComputedStyle(input);
      const contentRight = box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      return [{
        label: input.getAttribute('aria-label') ?? input.labels?.[0]?.textContent?.trim() ?? 'Number',
        unit: unit.textContent?.trim(),
        gap: suffix.left - contentRight,
        inside: suffix.right <= box.right,
      }];
    }),
  );
  expect(fields.length).toBeGreaterThan(0);
  for (const field of fields) {
    expect(field.gap, `${field.label}: ${field.unit} needs a clear gap after the number`).toBeGreaterThanOrEqual(3);
    expect(field.inside, `${field.label}: the unit must stay inside its input`).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test('daily nutrition goals reserve space for kcal, grams, and millilitres at phone widths', async ({ page }, testInfo) => {
  const initialWidth = page.viewportSize()?.width ?? 390;
  for (const width of new Set([initialWidth, 320, 390])) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/nutrition');
    await page.getByRole('button', { name: 'Goals', exact: true }).click();
    const goals = page.getByRole('dialog', { name: 'Daily goals', exact: true });
    await expect(goals.getByRole('spinbutton')).toHaveCount(7);
    await goals.getByRole('spinbutton', { name: /^Calories\b/ }).fill('12000');
    await goals.getByRole('spinbutton', { name: /^Water\b/ }).fill('5000');
    await expectUnitSpacing(goals);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath('nutrition-goals-units.png'), animations: 'disabled' });
    await goals.getByRole('button', { name: 'Save goals', exact: true }).click();
    await page.getByRole('button', { name: 'Goals', exact: true }).click();
    await expect(goals.getByRole('spinbutton', { name: /^Calories\b/ })).toHaveValue('12000');
    await goals.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
});

test('food portions and custom food macros keep their units separate in narrow dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/nutrition');
  await page.getByRole('button', { name: 'Add Banana', exact: true }).click();
  const food = page.getByRole('dialog');
  await expect(food.getByRole('spinbutton', { name: 'Portion in grams', exact: true })).toBeVisible();
  await expectUnitSpacing(food);
  await food.getByRole('button', { name: 'New food', exact: true }).click();
  for (const nutrient of ['kcal', 'protein', 'carbs', 'fat']) {
    await food.getByRole('spinbutton', { name: `${nutrient} per 100 grams`, exact: true }).fill('100');
  }
  await expectUnitSpacing(food);
});

test('bodyweight and target weight reserve their unit spacing', async ({ page }) => {
  await page.goto('/progress');
  await page.getByRole('button', { name: 'Body', exact: true }).click();
  const content = page.getByRole('region', { name: 'Page content' });
  await expect(content.getByRole('spinbutton', { name: /^Weight\b/ })).toBeVisible();
  await expectUnitSpacing(content);
});

test('shared profile fields preserve unit spacing and editable numbers', async ({ page }) => {
  await page.goto('/settings');
  const content = page.getByRole('region', { name: 'Page content' });
  const weight = content.getByRole('spinbutton', { name: /^Weight\b/ });
  await weight.fill('82.5');
  await weight.blur();
  await expect(weight).toHaveValue('82.5');
  await expectUnitSpacing(content);
});

test('calculator units including reps and percent never overlap', async ({ page }) => {
  await page.goto('/tools');
  for (const tool of ['1RM', 'FFMI']) {
    await page.getByRole('button', { name: new RegExp(`^${tool}\\b`) }).click();
    const calculator = page.getByRole('dialog');
    await expectUnitSpacing(calculator);
    await calculator.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
});

test('workout weights and repetitions reserve space for their longest suffix on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startWithPushup(page);
  await page.getByLabel('Set 1 repetitions', { exact: true }).fill('100');
  await expectUnitSpacing(page.getByRole('region', { name: 'Page content' }));
});
