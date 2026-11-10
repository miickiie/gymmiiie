import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const FOODS = JSON.parse(
  readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8'),
) as { id: string; name: string; kcal: number }[];
import { parseBackup } from '../src/lib/backup';
import { seed, snapshot } from './fixtures';

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test('nested exercise picker traps focus and Escape returns to the note draft', async ({
  page,
}, testInfo) => {
  await page.goto('/notes');
  const newNote = page.getByRole('button', { name: 'New note', exact: true });
  await newNote.click();
  const note = page.getByRole('dialog', { name: 'New note', exact: true });
  await note
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Keep this draft while attaching a movement.');
  const attach = note.getByRole('button', {
    name: 'Attach exercise',
    exact: true,
  });
  await attach.click();
  const picker = page.getByRole('dialog', {
    name: 'Attach exercise',
    exact: true,
  });
  await expect(picker).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  const first = picker.getByRole('button', {
    name: 'Close dialog',
    exact: true,
  });
  const last = picker.getByRole('button').last();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('nested-exercise-picker.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(note).toBeVisible();
  await expect(attach).toBeFocused();
  await expect(
    note.getByRole('textbox', { name: 'Note', exact: true }),
  ).toHaveValue('Keep this draft while attaching a movement.');
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(note).toHaveCount(0);
  await expect(newNote).toBeFocused();
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
});

test('food shortcut selects its food and invalid portions cannot change nutrition', async ({
  page,
}) => {
  await page.goto('/nutrition');
  const food = FOODS[0];
  await page
    .getByRole('button', { name: `Add ${food.name}`, exact: true })
    .click();
  const picker = page.getByRole('dialog', {
    name: 'Add to snacks',
    exact: true,
  });
  const portion = picker.getByRole('spinbutton', {
    name: 'Portion in grams',
    exact: true,
  });
  await expect(portion).toBeVisible();
  for (const invalid of ['-25', '0']) {
    await portion.fill(invalid);
    await picker.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(picker.getByRole('alert')).toContainText('greater than zero');
    expect(parseBackup(await snapshot(page)).nutrition.entries).toHaveLength(0);
  }
  await portion.fill('50');
  await picker.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect
    .poll(
      async () => parseBackup(await snapshot(page)).nutrition.entries.length,
    )
    .toBe(1);
  const entry = parseBackup(await snapshot(page)).nutrition.entries[0];
  expect(entry).toMatchObject({
    name: food.name,
    foodId: food.id,
    grams: 50,
    meal: 'snacks',
  });
  expect(entry.kcal).toBeCloseTo(food.kcal / 2);
});

test('negative custom macros are rejected and correcting them permits a food entry', async ({
  page,
}) => {
  await page.goto('/nutrition');
  await page
    .getByRole('button', { name: `Add ${FOODS[0].name}`, exact: true })
    .click();
  const picker = page.getByRole('dialog', {
    name: 'Add to snacks',
    exact: true,
  });
  await picker.getByRole('button', { name: 'New food', exact: true }).click();
  await picker
    .getByPlaceholder('Food name', { exact: true })
    .fill('Test recovery meal');
  await picker
    .getByRole('spinbutton', { name: 'kcal per 100 grams', exact: true })
    .fill('100');
  await picker
    .getByRole('spinbutton', { name: 'protein per 100 grams', exact: true })
    .fill('-4');
  await picker
    .getByRole('spinbutton', { name: 'carbs per 100 grams', exact: true })
    .fill('12');
  await picker
    .getByRole('spinbutton', { name: 'fat per 100 grams', exact: true })
    .fill('3');
  await picker
    .getByRole('button', { name: 'Save custom food', exact: true })
    .click();
  await expect(picker.getByRole('alert')).toContainText('nonnegative');
  expect(parseBackup(await snapshot(page)).nutrition.customFoods).toHaveLength(
    0,
  );
  await picker
    .getByRole('spinbutton', { name: 'protein per 100 grams', exact: true })
    .fill('5');
  await picker
    .getByRole('button', { name: 'Save custom food', exact: true })
    .click();
  await expect(
    picker.getByPlaceholder('Food name', { exact: true }),
  ).toHaveCount(0);
  await picker
    .getByRole('spinbutton', { name: 'Portion in grams', exact: true })
    .fill('100');
  await picker.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect
    .poll(
      async () => parseBackup(await snapshot(page)).nutrition.entries.length,
    )
    .toBe(1);
  const data = parseBackup(await snapshot(page));
  expect(data.nutrition.customFoods).toHaveLength(1);
  expect(data.nutrition.entries[0]).toMatchObject({
    name: 'Test recovery meal',
    kcal: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
  });
});

test('Show at desk keeps the gym pass and membership code visible', async ({
  page,
}, testInfo) => {
  await page.goto('/pass');
  await page.getByRole('button', { name: 'Add pass', exact: true }).click();
  const editor = page.getByRole('dialog', {
    name: 'Add gym pass',
    exact: true,
  });
  await editor
    .getByRole('textbox', { name: 'Pass name', exact: true })
    .fill('Test Gym');
  await editor
    .getByRole('textbox', { name: 'Member name (optional)', exact: true })
    .fill('Mickey');
  await editor
    .getByRole('textbox', { name: 'Code / number', exact: true })
    .fill('MEMBER-48271');
  await editor.getByRole('button', { name: 'Save pass', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Show Test Gym pass', exact: true })
    .click();
  const pass = page.getByRole('dialog', { name: 'Test Gym', exact: true });
  await pass.getByRole('button', { name: 'Show at desk', exact: true }).click();
  await expect(pass).toBeVisible();
  await expect(
    pass.getByRole('status').getByText('MEMBER-48271', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('gym-pass-at-desk.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await expect
    .poll(async () => parseBackup(await snapshot(page)).passes.length)
    .toBe(1);
  expect(parseBackup(await snapshot(page)).passes[0]).toMatchObject({
    name: 'Test Gym',
    code: 'MEMBER-48271',
    member: 'Mickey',
  });
});

test('an invalid backup is rejected before confirmation and leaves stored data intact', async ({
  page,
}) => {
  await seed(page, (data) => {
    data.profile.name = 'Keep this local log';
    data.notes = [
      {
        id: 'keep-note',
        exerciseId: '',
        date: '2026-11-10',
        kind: 'note',
        text: 'Keep this note',
        createdAt: '2026-11-10T03:00:00Z',
      },
    ];
  });
  await page.goto('/settings');
  await expect(
    page.getByRole('button', { name: 'Import backup', exact: true }),
  ).toBeVisible();
  const before = parseBackup(await snapshot(page));
  await page.locator('input[type="file"]').setInputFiles({
    name: 'unsupported-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...before, version: 2 })),
  });
  await expect(
    page.getByText(
      'This backup uses an unsupported version. Your current log has not changed.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(parseBackup(await snapshot(page))).toEqual(before);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Import backup', exact: true }),
  ).toBeVisible();
  expect(parseBackup(await snapshot(page))).toEqual(before);
});
