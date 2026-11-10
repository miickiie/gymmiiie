import { expect, test } from '@playwright/test';
import { seed } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
  await page.goto('/library');
});

test('detail Back restores library filters, sorting, and both scroll positions', async ({ page }) => {
  const search = page.getByRole('textbox', { name: 'Search exercise library', exact: true });
  await search.fill('barbell');
  await page.getByRole('button', { name: 'Legs', exact: true }).click();
  await page.getByRole('button', { name: 'Muscle', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
  await filters.getByRole('button', { name: 'Barbell', exact: true }).click();
  await filters.getByRole('button', { name: /^Show/ }).click();

  const strip = page.getByRole('region', { name: 'Page content' }).locator('.scroll-x');
  const exercise = page.getByRole('button', { name: 'View exercise: Barbell Front Squat', exact: true });
  await exercise.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  const scrollX = await strip.evaluate((element) => element.scrollLeft);
  expect(scrollY).toBeGreaterThan(100);
  await exercise.click();
  await expect(page).toHaveURL(/\/library\/zG0zs85$/);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(search).toHaveValue('barbell');
  await expect(page.getByRole('button', { name: 'Legs', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Muscle', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(3);
  await expect.poll(async () => Math.abs((await strip.evaluate((element) => element.scrollLeft)) - scrollX)).toBeLessThan(3);

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'Barbell', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('browser Back restores expanded results and the selected row', async ({ page }) => {
  const rows = page.getByRole('button', { name: /^View exercise:/ });
  await expect(rows).toHaveCount(80);
  await page.getByRole('button', { name: /Show more/i }).click();
  await expect(rows).toHaveCount(160);
  const exercise = rows.nth(100);
  const label = await exercise.getAttribute('aria-label');
  if (!label) throw new Error('The exercise row must have an accessible name.');
  await exercise.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  await exercise.click();
  await expect(page).toHaveURL(/\/library\/.+/);
  await page.goBack();
  await expect(rows).toHaveCount(160);
  await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(3);
});
