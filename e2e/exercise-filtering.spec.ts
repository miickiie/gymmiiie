import { expect, test } from '@playwright/test';
import { seed } from './fixtures';

test.use({ serviceWorkers: 'block' });

for (const language of ['en', 'th'] as const) {
  const thai = language === 'th';

  test(`exercise picker filters primary muscles without focusing search in ${language}`, async ({ page }) => {
    await seed(page, (data) => {
      data.settings.language = language;
    });
    await page.goto('/train');
    await page
      .getByRole('button', {
        name: thai ? 'ฝึกแบบไม่มีแผน' : 'Empty workout',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/session$/);

    const add = page.getByRole('button', {
      name: thai ? 'เพิ่ม' : 'Add',
      exact: true,
    });
    await add.click();
    const picker = page.getByRole('dialog', {
      name: thai ? 'เพิ่มท่า' : 'Add exercise',
      exact: true,
    });
    const search = picker.getByRole('textbox', {
      name: thai ? 'ค้นหาท่าออกกำลัง' : 'Search exercises',
      exact: true,
    });
    await expect(picker).toBeVisible();
    await expect(search).not.toBeFocused();

    const arms = picker.getByRole('button', {
      name: thai ? 'แขน' : 'Arms',
      exact: true,
    });
    await arms.click();
    await expect(arms).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByText('Barbell Curl', { exact: true })).toBeVisible();
    await expect(
      picker.getByText('Barbell Bench Press', { exact: true }),
    ).toHaveCount(0);
    await expect(picker.getByText('Push-up', { exact: true })).toHaveCount(0);

    await search.fill('bench');
    await expect(picker.getByText('Barbell Curl', { exact: true })).toHaveCount(0);
    await expect(
      picker.getByText('Barbell Bench Press', { exact: true }),
    ).toHaveCount(0);
    await search.fill('curl');
    await expect(picker.getByText('Barbell Curl', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await add.click();
    await expect(picker).toBeVisible();
    await expect(search).not.toBeFocused();
  });

  test(`library filters primary muscle groups and individual muscles in ${language}`, async ({ page }) => {
    await seed(page, (data) => {
      data.settings.language = language;
    });
    await page.goto('/library');
    const exerciseRow = (name: string) =>
      page.getByRole('button', {
        name: `${thai ? 'ดูท่า' : 'View exercise'}: ${name}`,
        exact: true,
      });
    await expect(exerciseRow('Barbell Bench Press')).toBeVisible();
    await page
      .getByRole('button', { name: thai ? 'แขน' : 'Arms', exact: true })
      .click();
    await expect(exerciseRow('Barbell Curl')).toBeVisible();
    await expect(exerciseRow('Barbell Bench Press')).toHaveCount(0);
    await expect(exerciseRow('Push-up')).toHaveCount(0);

    const filtersLabel = thai ? 'ตัวกรอง' : 'Filters';
    await page.getByRole('button', { name: filtersLabel, exact: true }).click();
    const filters = page.getByRole('dialog', { name: filtersLabel, exact: true });
    await filters
      .getByRole('button', { name: thai ? 'ไตรเซ็ปส์' : 'Triceps', exact: true })
      .click();
    await filters.getByRole('button', { name: /^(Show|แสดง) / }).click();
    await expect(filters).toHaveCount(0);
    await expect(exerciseRow('Barbell Close-grip Bench Press')).toBeVisible();
    await expect(exerciseRow('Barbell Bench Press')).toHaveCount(0);
    await expect(exerciseRow('Push-up')).toHaveCount(0);
    await expect(exerciseRow('Barbell Curl')).toHaveCount(0);
  });
}
