import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterNumber, seed } from './fixtures';

test.use({ serviceWorkers: 'block' });

const names = [
  'First exercise',
  'Second exercise with a longer name',
  'Third exercise',
  'Fourth exercise with a longer name',
  'Fifth exercise',
  'Sixth exercise with a longer name',
  'Seventh exercise',
  'Eighth exercise with a longer name',
];

async function seedWorkout(page: Page, count = names.length): Promise<void> {
  await seed(page, (data) => {
    data.settings.autoAdvance = true;
    data.active = {
      id: 'session-continuation',
      startedAt: Date.now(),
      pausedTotalSec: 0,
      currentIndex: 0,
      exercises: names.slice(0, count).map((name, index) => ({
        uid: `exercise-${index}`,
        id: `exercise-${index}`,
        name,
        primary: 'chest',
        mode: '',
        loadKind: 'external',
        sets: Array.from({ length: 3 }, () => ({
          reps: 10,
          weight: 10,
          done: false,
          kind: 'normal' as const,
        })),
      })),
    };
  });
  await page.goto('/session');
}

async function expectCentered(strip: Locator): Promise<void> {
  await expect(strip.getByRole('button', { pressed: true })).toHaveCount(1);
  await expect
    .poll(() =>
      strip.evaluate((element) => {
        const selected = element.querySelector('button[aria-pressed="true"]');
        if (!selected) return Infinity;
        const bounds = element.getBoundingClientRect();
        const selectedBounds = selected.getBoundingClientRect();
        return Math.abs(
          selectedBounds.left +
            selectedBounds.width / 2 -
            (bounds.left + element.clientWidth / 2),
        );
      }),
    )
    .toBeLessThan(2);
}

test('completing sets prefills later sets and centers the next exercise on auto-advance', async ({ page }) => {
  await seedWorkout(page, 2);
  const weight = (set: number) =>
    page.getByLabel(`Set ${set} weight`, { exact: true });
  const reps = (set: number) =>
    page.getByLabel(`Set ${set} repetitions`, { exact: true });

  await enterNumber(weight(1), '42.5');
  await enterNumber(reps(1), '8');
  await page.getByRole('button', { name: 'Complete set 1', exact: true }).click();
  for (const set of [2, 3]) {
    await expect(weight(set)).toHaveValue('42.5');
    await expect(reps(set)).toHaveValue('8');
  }

  await enterNumber(weight(2), '55');
  await enterNumber(reps(2), '6');
  await page.getByRole('button', { name: 'Complete set 2', exact: true }).click();
  await expect(weight(3)).toHaveValue('55');
  await expect(reps(3)).toHaveValue('6');
  await expect(weight(1)).toHaveValue('42.5');
  await expect(reps(1)).toHaveValue('8');

  await page.getByRole('button', { name: 'Complete set 3', exact: true }).click();
  const strip = page
    .getByRole('group', { name: 'Workout exercises', exact: true })
    .locator('.scroll-x');
  await expect(strip.getByRole('button', { pressed: true })).toHaveText(
    `2. ${names[1]}`,
  );
  await expectCentered(strip);
  await expect(weight(1)).toHaveValue('10');
  await expect(reps(1)).toHaveValue('10');
});

test('centers first, middle, last, and newly added exercises and recenters after resizing', async ({ page }) => {
  await seedWorkout(page);
  const group = page.getByRole('group', {
    name: 'Workout exercises',
    exact: true,
  });
  const strip = group.locator('.scroll-x');
  await expectCentered(strip);

  for (const index of [4, 7, 0]) {
    const chip = strip.getByRole('button', {
      name: `${index + 1}. ${names[index]}`,
      exact: true,
    });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expectCentered(strip);
  }

  await group.getByRole('button', { name: 'Add', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add exercise', exact: true });
  await picker
    .getByRole('textbox', { name: 'Search exercises', exact: true })
    .fill('Barbell Curl');
  await picker
    .getByRole('button')
    .filter({ has: page.getByText('Barbell Curl', { exact: true }) })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(strip.getByRole('button', { pressed: true })).toHaveText(
    '9. Barbell Curl',
  );
  await expect(page.getByRole('heading', { name: 'Barbell Curl', exact: true })).toBeVisible();
  await expectCentered(strip);

  await page.setViewportSize({ width: 600, height: 900 });
  await expectCentered(strip);
});
