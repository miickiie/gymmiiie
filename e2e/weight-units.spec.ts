import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { enterNumber, numberPad, seed, snapshot } from './fixtures';

test('weight units stay with each machine and preserve the saved weight', async ({ page }, testInfo) => {
  await seed(page, (data) => {
    data.active = {
      id: 'weight-units-session',
      startedAt: Date.now(),
      pausedTotalSec: 0,
      currentIndex: 0,
      exercises: ['Machine kg', 'Machine lb'].map((name, index) => ({
        uid: `machine-${index}`,
        id: `machine-${index}`,
        name,
        primary: 'chest',
        mode: '',
        loadKind: 'external',
        sets: [{ reps: 10, weight: 20, done: false, kind: 'normal' }],
      })),
    };
  });
  await page.goto('/session');
  const units = page.getByRole('group', { name: 'Weight unit', exact: true });
  const weight = page.getByLabel('Set 1 weight', { exact: true });
  await expect(units.getByRole('button', { name: 'kg', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await units.getByRole('button', { name: 'lb', exact: true }).click();
  await expect(weight).toHaveValue('44.1');
  if (await weight.getAttribute('readonly') !== null) {
    await weight.click();
    await numberPad(page).getByRole('button', { name: 'Use value', exact: true }).click();
    await page.reload();
    expect(parseBackup(await snapshot(page)).active?.exercises[0].sets[0].weight).toBe(20);
  }
  await enterNumber(weight, '100');
  await weight.blur();
  await units.getByRole('button', { name: 'kg', exact: true }).click();
  await expect(weight).toHaveValue('45.4');
  await units.getByRole('button', { name: 'lb', exact: true }).click();
  await expect(weight).toHaveValue('100');
  await page.screenshot({ path: testInfo.outputPath('weight-entry.png'), animations: 'disabled' });
  await page.reload();
  await expect(units.getByRole('button', { name: 'lb', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(weight).toHaveValue('100');
  await page.getByRole('button', { name: '2. Machine lb', exact: true }).click();
  await expect(units.getByRole('button', { name: 'kg', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(weight).toHaveValue('20');
  await page.getByRole('button', { name: '1. Machine kg', exact: true }).click();
  await expect(weight).toHaveValue('100');

  await expect.poll(async () => parseBackup(await snapshot(page)).active?.exercises[0].sets[0].weight)
    .toBeCloseTo(45.359237, 6);
  const active = parseBackup(await snapshot(page));
  expect(active.settings.unit).toBe('kg');
  expect(active.active?.exercises[0].weightUnit).toBe('lb');
  expect(active.active?.exercises[0].sets[0].weight).toBeCloseTo(45.359237, 6);

  await page.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('dialog', { name: 'Finish workout?', exact: true })
    .getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  const saved = parseBackup(await snapshot(page));
  expect(saved.sessions[0].exercises[0].sets[0].weight).toBeCloseTo(45.359237, 6);
});

test('timed loaded sets use the selected unit and reject negative weights', async ({ page }) => {
  await seed(page, (data) => {
    data.active = {
      id: 'timed-weight-session',
      startedAt: Date.now(),
      pausedTotalSec: 0,
      currentIndex: 0,
      exercises: [{
        uid: 'weighted-hold',
        id: 'weighted-hold',
        name: 'Weighted hold',
        primary: 'core',
        mode: 'time',
        loadKind: 'external',
        sets: [{ reps: 0, sec: 30, weight: 20, done: false, kind: 'normal' }],
      }],
    };
  });
  await page.goto('/session');
  const weight = page.getByLabel('Set 1 weight', { exact: true });
  if (await weight.getAttribute('readonly') !== null) {
    await weight.click();
    const pad = numberPad(page);
    const draft = pad.getByRole('textbox', { name: 'Number to enter', exact: true });
    await draft.press('-');
    await expect(draft).toHaveValue('20');
    await expect(pad.getByRole('button', { name: 'Change sign', exact: true })).toHaveCount(0);
    await pad.getByRole('button', { name: 'Cancel', exact: true }).click();
  } else {
    await weight.fill('-10');
    await weight.blur();
  }
  await expect(weight).toHaveValue('20');
  await page.getByRole('group', { name: 'Weight unit', exact: true })
    .getByRole('button', { name: 'lb', exact: true }).click();
  await enterNumber(weight, '55.5');
  await weight.blur();
  await expect(weight).toHaveValue('55.5');
  await expect(page.getByLabel('Set 1 seconds', { exact: true })).toHaveValue('30');
  await expect.poll(async () => parseBackup(await snapshot(page)).active?.exercises[0].sets[0].weight)
    .toBeCloseTo(25.174376535, 6);
});
