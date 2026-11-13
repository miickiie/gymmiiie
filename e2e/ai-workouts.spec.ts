import { expect, test, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { AiWorkoutRequest } from '../shared/ai-workout';
import type { Exercise } from '../src/types';
import { seed } from './fixtures';

const catalog: Exercise[] = JSON.parse(readFileSync(new URL('../src/data/exercises-runtime.json', import.meta.url), 'utf8'));
const bench = catalog.find(exercise => exercise.name === 'Barbell Bench Press')!;
function response(input: AiWorkoutRequest) {
  return {
    requestId: 'test-request', mode: input.mode,
    ...(input.mode === 'routine' ? { name: 'AI Chest' } : {}),
    items: (input.mode === 'suggest' ? [...input.baselineIds].reverse() : [input.candidates[0].id]).map((exerciseId, index) => ({
      exerciseId, reason: input.language === 'th' ? `ท่าที่คุ้นเคย ${index + 1}` : `Familiar choice ${index + 1}`,
      ...(input.mode === 'routine' ? { sets: 3, restSeconds: 90 } : {}),
    })),
  };
}
function fulfill(route: Route, input: AiWorkoutRequest) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response(input)) });
}

test.beforeEach(async ({ page }) => {
  await seed(page, data => {
    data.favorites[bench.id] = true;
    data.sessions = [{ id: 'previous', date: new Date().toISOString(), durationSec: 600, exercises: [{ id: bench.id, name: bench.name, primary: bench.primary, sets: [{ reps: 8, weight: 50, kind: 'normal' }] }] }];
  });
});

test('requests AI only on review and shows its ordering with historical working weights', async ({ page }) => {
  const requests: AiWorkoutRequest[] = [];
  await page.route('**/api/ai/workout-plan', async route => {
    const input: AiWorkoutRequest = route.request().postDataJSON();
    requests.push(input);
    await fulfill(route, input);
  });
  await page.goto('/train');
  await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
  await page.getByRole('button', { name: 'Chest', exact: true }).click();
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByText('Familiar choice 1', { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].mode).toBe('suggest');
  expect(requests[0].profile.age).toBe(28);
  await expect(page.getByTestId(`starting-sets-${bench.id}`)).toContainText('50 kg');
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
});

test('keeps generated routines as drafts and saves reviewed sets and rest explicitly', async ({ page }) => {
  await page.route('**/api/ai/workout-plan', route => fulfill(route, route.request().postDataJSON()));
  await page.goto('/routines');
  await page.getByRole('button', { name: 'Generate with AI', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Generate routine', exact: true });
  await dialog.getByRole('button', { name: 'Chest', exact: true }).click();
  await dialog.getByRole('button', { name: 'Generate with AI', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Routine name', exact: true })).toHaveValue('AI Chest');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('AI Chest', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate with AI', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Generate routine', exact: true });
  await dialog.getByRole('button', { name: 'Chest', exact: true }).click();
  await dialog.getByRole('button', { name: 'Generate with AI', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Routine name', exact: true }).fill('Reviewed AI Chest');
  await dialog.getByRole('spinbutton', { name: `Sets · ${bench.name}`, exact: true }).fill('4');
  await dialog.getByRole('spinbutton', { name: `Rest (seconds) · ${bench.name}`, exact: true }).fill('120');
  await expect(dialog.getByTestId(`starting-sets-${bench.id}`)).toHaveText('8 × 50 kg · 8 × 50 kg · 8 × 50 kg · 8 × 50 kg');
  await dialog.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(page).toHaveURL(/\/routines\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Routine name', exact: true })).toHaveValue('Reviewed AI Chest');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByLabel('Set 3 repetitions', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Set 6 repetitions', { exact: true })).toHaveValue('8');
  await expect(page.getByLabel('Set 7 repetitions', { exact: true })).toHaveCount(0);
});

test('falls back to the existing picker on quota exhaustion', async ({ page }) => {
  await page.route('**/api/ai/workout-plan', route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AI_QUOTA' } }) }));
  await page.goto('/train');
  await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
  await page.getByRole('button', { name: 'Chest', exact: true }).click();
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByText('The daily AI allowance is exhausted. Try again tomorrow.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Add exercise', exact: true })).toBeVisible();
});

test('cancels pending AI and ignores a late response after choosing basic suggestions', async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ai/workout-plan', async route => {
    const input: AiWorkoutRequest = route.request().postDataJSON();
    await gate;
    await fulfill(route, input).catch(() => undefined);
  });
  await page.goto('/train');
  await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
  await page.getByRole('button', { name: 'Chest', exact: true }).click();
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByText('AI is arranging your workout…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use basic suggestions', exact: true }).click();
  release();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await expect(page.getByText('Familiar choice 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: `Remove ${bench.name}`, exact: true }).click();
  await expect(page.getByTestId(`starting-sets-${bench.id}`)).toHaveCount(0);
});

test('requests and reviews a routine in Thai', async ({ page }) => {
  await seed(page, data => { data.settings.language = 'th'; });
  let language = '';
  await page.route('**/api/ai/workout-plan', async route => {
    const input: AiWorkoutRequest = route.request().postDataJSON();
    language = input.language;
    await fulfill(route, input);
  });
  await page.goto('/routines');
  await page.getByRole('button', { name: 'สร้างด้วย AI', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'สร้างตารางด้วย AI', exact: true });
  await dialog.getByRole('button', { name: 'อก', exact: true }).click();
  await dialog.getByRole('button', { name: 'สร้างด้วย AI', exact: true }).click();
  await expect(dialog.getByText('ท่าที่คุ้นเคย 1', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'บันทึกตารางฝึก', exact: true })).toBeEnabled();
  expect(language).toBe('th');
});

test('falls back after the client deadline without waiting for a provider response', async ({ page }) => {
  await page.clock.install();
  let release = (): void => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ai/workout-plan', async route => {
    const input: AiWorkoutRequest = route.request().postDataJSON();
    await gate;
    await fulfill(route, input).catch(() => undefined);
  });
  try {
    await page.goto('/train');
    await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
    await expect(page.getByText('AI is arranging your workout…', { exact: true })).toBeVisible();
    await page.clock.fastForward(35_001);
    await expect(page.getByText('AI generation timed out. Try again or use basic suggestions.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  } finally { release(); }
});

test('discards the old response when another account becomes active', async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: AiWorkoutRequest[] = [];
  await page.route('**/api/ai/workout-plan', async route => {
    const input: AiWorkoutRequest = route.request().postDataJSON();
    requests.push(input);
    const old = requests.length === 1;
    if (old) await gate;
    const output = response(input);
    output.items.forEach(item => { item.reason = old ? 'Old account plan' : 'Current account plan'; });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(output) }).catch(() => undefined);
  });
  try {
    await page.goto('/train');
    await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
    await expect(page.getByText('AI is arranging your workout…', { exact: true })).toBeVisible();
    const account = await seed(page);
    release();
    await page.goto('/train');
    await page.getByRole('button', { name: 'Suggest by muscle', exact: true }).click();
    await page.getByRole('button', { name: 'Chest', exact: true }).click();
    await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
    await expect(page.getByText('Current account plan', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Old account plan', { exact: true })).toHaveCount(0);
    expect(requests.at(-1)?.expectedAccountId).toBe(account.id);
    expect(requests[0].expectedAccountId).not.toBe(account.id);
  } finally { release(); }
});
