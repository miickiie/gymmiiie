import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { enterNumber, seed, snapshot, startWithPushup } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test('logs mobile-accessible effort/notes and durably saves a workout', async ({
  page,
}, testInfo) => {
  await page.goto('/train');
  await expect(
    page.getByRole('button', { name: 'Empty workout', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('train.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await startWithPushup(page);
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveValue(
    '0',
  );
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '12');
  await page
    .getByRole('button', { name: 'Set 1 details', exact: true })
    .click();
  const details = page.getByRole('dialog', {
    name: 'Set 1 details',
    exact: true,
  });
  await details.getByLabel('Reps in reserve (RIR)').selectOption('2');
  await details.getByLabel('Set note').fill('Controlled tempo');
  await page.screenshot({
    path: testInfo.outputPath('session-details.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await details
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  // Verify controls near the mobile bottom bars receive real clicks after scrolling.
  await page.getByRole('button', { name: 'Add set', exact: true }).click();
  await expect(
    page.getByLabel('Set 4 repetitions', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '60s', exact: true }).click();
  await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page
    .getByRole('button', { name: 'Complete set 1', exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath('session.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Finish workout', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Finish workout?', exact: true })
    .getByRole('button', { name: 'Save workout', exact: true })
    .click();
  await expect(page).toHaveURL(/\/history\/.+/);
  const saved = parseBackup(await snapshot(page));
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].exercises[0].sets[0]).toMatchObject({
    reps: 12,
    rpe: 8,
    note: 'Controlled tempo',
  });
  await page.reload();
  await expect(page).toHaveURL(/\/history\/.+/);
  expect(parseBackup(await snapshot(page)).sessions).toHaveLength(1);
});

test('requires an explicit decision before replacing an active workout', async ({
  page,
}) => {
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '17');
  await page.goto('/train');
  await page
    .getByRole('button', { name: 'Empty workout', exact: true })
    .click();
  const conflict = page.getByRole('dialog', {
    name: 'Workout already in progress',
    exact: true,
  });
  await conflict.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Empty workout', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Workout already in progress', exact: true })
    .getByRole('button', { name: 'Resume workout', exact: true })
    .click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toHaveValue('17');
});

test('locks logging while paused and preserves values after resuming', async ({
  page,
}) => {
  await startWithPushup(page);
  await page.getByRole('button', { name: /^Pause/ }).click();
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Complete set 1', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /^Resume/ }).click();
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toBeEnabled();
});

test('all route chunks remain available after going offline', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
    }
  });
  await context.setOffline(true);
  for (const path of [
    '/train',
    '/history',
    '/history/missing',
    '/library',
    '/library/I4hDWkc',
    '/routines',
    '/routines/new',
    '/progress',
    '/nutrition',
    '/notes',
    '/tools',
    '/pass',
    '/settings',
    '/about',
    '/session',
  ]) {
    await page.goto(path);
    await page
      .getByRole('button', { name: 'Continue offline', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Page content' }),
    ).toHaveAttribute('data-route', path);
    await expect(
      page.getByRole('status', { name: 'Loading page', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText('Something went wrong', { exact: true }),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('session actions and manual rest remain usable at 320px width', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await startWithPushup(page);
  await page
    .getByRole('button', { name: 'Complete set 1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add set', exact: true }).click();
  await expect(
    page.getByLabel('Set 4 repetitions', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '60s', exact: true }).click();
  await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  for (const name of ['Session options', 'Finish workout']) {
    const button = page
      .getByRole('button', { name, exact: true })
      .filter({ hasText: name });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({
    path: testInfo.outputPath('session-320.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Finish workout', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Finish workout?', exact: true })
    .getByRole('button', { name: 'Save workout', exact: true })
    .click();
  await expect(page).toHaveURL(/\/history\/.+/);
});
