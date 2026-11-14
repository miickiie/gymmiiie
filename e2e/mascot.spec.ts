import { expect, test, type Page } from '@playwright/test';
import { enterNumber, seed, startWithPushup } from './fixtures';

async function dismissSyncNotices(page: Page, waiting = false): Promise<void> {
  const companion = page.getByRole('complementary', {
    name: 'Mochi, your workout cat',
  });
  const status = companion.getByRole('status');
  const dismiss = companion.getByRole('button', {
    name: 'Dismiss Mochi’s message',
  });
  if (!waiting) {
    await expect(status).toHaveText('Account sync up to date');
    await dismiss.click();
  } else {
    if (await status.filter({ hasText: /^Account sync up to date$/ }).isVisible())
      await dismiss.click();
    await expect(status).toHaveText('Saved on device · account sync waiting');
    await dismiss.click();
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(0, 0);
}

test.beforeEach(async ({ page }) => {
  await seed(page);
  await dismissSyncNotices(page);
});

test('Mochi gives encouragement, queues speech, and stays after dismissal', async ({ page }) => {
  const cat = page.getByRole('button', { name: 'Pet Mochi for workout encouragement' });
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(companion.getByRole('status')).toHaveCount(0);
  await expect(cat).toBeVisible();

  await cat.click();
  await expect(companion.getByRole('status')).toContainText('One rep at a time.');
  await expect(companion).not.toContainText('Mochi says');
  await expect(page.locator('.gym-cat-name')).toHaveCount(0);
  await cat.click();
  await expect(companion.getByRole('status')).toContainText('One rep at a time.');
  await page.getByRole('button', { name: /Next message/ }).click();
  await expect(companion.getByRole('status')).toContainText('Tiny steps, strong habits.');
  await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  await expect(companion.getByRole('status')).toHaveCount(0);
  await expect(cat).toBeVisible();
});

test('workouts stay quiet after the one-time sync notices until a notification or a cat tap', async ({ page }, testInfo) => {
  await startWithPushup(page);
  await dismissSyncNotices(page, true);
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(companion.getByRole('status')).toHaveCount(0);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '12');
  await page.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await expect(companion.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pet Mochi for workout encouragement' }).click();
  await expect(companion.getByRole('status')).toContainText('One rep at a time.');
  await page.screenshot({ path: testInfo.outputPath('mochi-workout.png'), fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish workout?' });
  await finish.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await expect(companion.getByRole('status')).toHaveText('Workout saved');
});

test('speech expires after a previous bubble is dismissed and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await page.getByRole('button', { name: 'Pet Mochi for workout encouragement' }).click();
  await expect(companion.getByRole('status')).toContainText('One rep at a time.');
  await companion.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  await page.getByRole('button', { name: 'Pet Mochi for workout encouragement' }).click();
  await expect(companion.getByRole('status')).toContainText('Tiny steps, strong habits.');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6600);
  await expect(companion.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.gym-cat-sprite')).toHaveCSS('animation-name', 'none');
});

test('notifications stay accessible inside dialogs and errors take priority', async ({ page }, testInfo) => {
  await page.goto('/notes');
  await dismissSyncNotices(page);
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New note', exact: true });
  const cat = dialog.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(cat.getByRole('alert')).toHaveText('Write something first');
  await page.screenshot({ path: testInfo.outputPath('mochi-dialog.png'), animations: 'disabled' });
  await cat.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  await expect(dialog).toBeFocused();
  await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(cat.getByRole('alert')).toHaveText('Write something first');
  await dialog
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Focus on form');
  await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const pageCat = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(pageCat.getByRole('alert')).toHaveText('Write something first');
  await pageCat.getByRole('button', { name: /Next message/ }).press('Enter');
  await expect(pageCat.getByRole('button', { name: 'Pet Mochi for workout encouragement' })).toBeFocused();
  await expect(pageCat.getByRole('status')).toHaveText('Note saved');
});

test('Mochi announces the end of a rest timer', async ({ page }) => {
  await startWithPushup(page);
  await dismissSyncNotices(page, true);
  await page.clock.install();
  await page.getByRole('button', { name: '60s', exact: true }).click();
  await page.clock.fastForward(61_000);
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(companion.getByRole('status')).toContainText('Rest time is up.');
});

test('the cat settles upright after being petted', async ({ page }) => {
  const cat = page.getByRole('button', { name: 'Pet Mochi for workout encouragement' });
  const sprite = page.locator('.gym-cat-sprite');
  await cat.click();
  await sprite.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .filter((animation) => animation instanceof CSSAnimation && animation.animationName === 'gym-cat-hop')
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const rotation = await sprite.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
  });
  expect(rotation).toBe(0);
});

test('the cat looks towards desktop pointers and mobile taps without speaking', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('A viewport is required for gaze testing.');
  const gaze = page.locator('.gym-cat-gaze');
  const lookX = async () => Number((await gaze.getAttribute('transform'))?.match(/translate\(([-\d.]+)/)?.[1]);
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(2, viewport.height / 2);
  else await page.mouse.move(2, viewport.height / 2);
  await expect.poll(lookX).toBeLessThan(0);
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(viewport.width - 2, viewport.height / 2);
  else await page.mouse.move(viewport.width - 2, viewport.height / 2);
  await expect.poll(lookX).toBeGreaterThan(0);
  await expect(page.getByRole('complementary', { name: 'Mochi, your workout cat' }).getByRole('status')).toHaveCount(0);
  await page.goto('/library');
  await dismissSyncNotices(page);
  await expect(page.getByRole('complementary', { name: 'Mochi, your workout cat' }).getByRole('status')).toHaveCount(0);
});
