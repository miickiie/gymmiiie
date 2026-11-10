import { expect, test } from '@playwright/test';
import { seed, startWithPushup } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
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

test('workouts stay quiet until a meaningful notification or a cat tap', async ({ page }, testInfo) => {
  await startWithPushup(page);
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(companion.getByRole('status')).toHaveCount(0);
  await page.getByLabel('Set 1 repetitions', { exact: true }).fill('12');
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

test('speech expires after reading time and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await page.getByRole('button', { name: 'Pet Mochi for workout encouragement' }).click();
  await expect(companion.getByRole('status')).toContainText('One rep at a time.');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6600);
  await expect(companion.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.gym-cat-sprite')).toHaveCSS('animation-name', 'none');
});

test('notifications stay accessible inside dialogs and errors take priority', async ({ page }, testInfo) => {
  await seed(page, (fixture) => {
    fixture.passes = [{ id: 'test-pass', name: 'Test Gym', code: 'MEMBER-48271', hue: 24 }];
  });
  await page.goto('/pass');
  await page.getByRole('button', { name: 'Show Test Gym pass', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Test Gym', exact: true });
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => {},
    });
  });
  await dialog.getByRole('button', { name: 'Copy code', exact: true }).click();
  const cat = dialog.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(cat.getByRole('status')).toHaveText('Code copied');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => { throw new Error('Synthetic clipboard failure'); },
    });
  });
  await dialog.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(cat.getByRole('alert')).toHaveText('Could not copy');
  await page.screenshot({ path: testInfo.outputPath('mochi-dialog.png'), animations: 'disabled' });
  await cat.getByRole('button', { name: /Next message/ }).press('Enter');
  await expect(cat.getByRole('button', { name: 'Pet Mochi for workout encouragement' })).toBeFocused();
  await expect(cat.getByRole('status')).toHaveText('Code copied');
  await cat.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  await expect(dialog).toBeFocused();
});

test('Mochi announces the end of a rest timer', async ({ page }) => {
  await startWithPushup(page);
  while (await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).isVisible()) {
    await page.getByRole('button', { name: 'Dismiss Mochi’s message' }).click();
  }
  await page.clock.install();
  await page.getByRole('button', { name: '60s', exact: true }).click();
  await page.clock.fastForward(61_000);
  const companion = page.getByRole('complementary', { name: 'Mochi, your workout cat' });
  await expect(companion.getByRole('status')).toContainText('Rest time is up.');
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
  await expect(page.getByRole('complementary', { name: 'Mochi, your workout cat' }).getByRole('status')).toHaveCount(0);
});
