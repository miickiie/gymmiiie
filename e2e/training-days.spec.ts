import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { seed, snapshot } from './fixtures';

test.use({ timezoneId: 'Asia/Bangkok' });

test('By muscle quick start immediately shows a selectable muscle map on a small screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page);
  await page.getByRole('link', { name: /^By muscle/ }).click();
  await expect(page).toHaveURL(/\/train\?focus=muscles$/);
  await expect(page.getByRole('button', { name: 'Suggest by muscle', exact: true })).toHaveAttribute('aria-expanded', 'true');
  const chest = page.getByRole('button', { name: 'Chest', exact: true });
  await expect(chest).toBeInViewport();
  await chest.click();
  const review = page.getByRole('button', { name: 'Review suggestions', exact: true });
  await expect(review).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('quick-start-muscles-320.png') });
  await review.click();
  await expect(page.getByRole('heading', { name: 'Review your workout', exact: true })).toBeVisible();
});

test('an overnight workout stays on its start day without duplicating a manual check-in', async ({ page }, testInfo) => {
  const start = new Date('2026-11-13T23:50:00+07:00');
  const finish = new Date('2026-11-14T01:15:00+07:00');
  await page.clock.install({ time: finish });
  await seed(page, (data) => {
    data.settings.weekStart = 1;
    data.checkins = ['2026-11-13'];
    data.active = {
      id: 'overnight-workout', startedAt: start.getTime(), currentIndex: 0, pausedTotalSec: 0,
      exercises: [{
        uid: 'night-bench', id: 'night-bench', name: 'Night bench press', primary: 'chest',
        mode: '', loadKind: 'external',
        sets: [{ reps: 10, weight: 40, done: true, kind: 'normal', editedFields: {} }],
      }],
    };
  });
  await page.goto('/session');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('dialog', { name: 'Finish workout?', exact: true })
    .getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  const saved = parseBackup(await snapshot(page));
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].startedAt).toBe(start.toISOString());
  expect(new Date(saved.sessions[0].date).getTime()).toBeGreaterThanOrEqual(finish.getTime());
  expect(saved.sessions[0].durationSec).toBeGreaterThanOrEqual(85 * 60);
  expect(saved.checkins).toEqual([]);
  await expect(page.getByText(/Friday, November 13, 2026/i)).toBeVisible();

  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByTitle('2026-11-13 · level 4', { exact: true })).toHaveCount(1);
  await expect(page.getByTitle('2026-11-14 · level 0', { exact: true })).toHaveCount(1);
  await expect(page.locator('main').getByRole('link', { name: /Night bench press/ })).toContainText('Fri');

  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check in', exact: true })).toBeVisible();
  await expect(page.getByText('1 this week', { exact: true })).toBeVisible();
  const days = page.locator('main .grid-cols-7 > div');
  await expect(days).toHaveCount(7);
  await expect(days.nth(4).locator('.lucide-check')).toHaveCount(1);
  await expect(days.nth(5).locator('.lucide-check')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('overnight-start-day.png'), fullPage: true });
});
