import { expect, test, type Locator } from '@playwright/test';
import { seed } from './fixtures';

// Deterministic artwork failure injection must reach the actual page request.
// Service-worker offline coverage remains in the existing workout suite.
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await seed(page);
});

const motionIn = (scope: Locator) =>
  scope.locator('svg:has(> g.transition-none > path)').first();
const frameState = (motion: Locator) =>
  motion
    .locator(':scope > g')
    .evaluateAll((frames) =>
      frames.map((frame) => (frame as SVGElement).style.opacity).join(','),
    );

test('library artwork opens an animated detail with the original Face Pull guide', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/library');
  await page
    .getByRole('textbox', { name: 'Search exercise library', exact: true })
    .fill('Face Pull');
  const row = page
    .getByRole('button')
    .filter({ has: page.getByText('Face Pull', { exact: true }) });
  await row.scrollIntoViewIfNeeded();
  await expect(motionIn(row)).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/library\/face-pull$/);
  const content = page.getByRole('region', { name: 'Page content' });
  await expect(
    content.getByRole('heading', { name: 'Face Pull', exact: true }),
  ).toBeVisible();
  const motion = motionIn(content);
  await expect(motion).toBeVisible();
  await expect(motion.locator(':scope > g')).toHaveCount(3);
  const initial = await frameState(motion);
  await expect.poll(() => frameState(motion)).not.toBe(initial);
  const steps = content.locator('ol').first();
  await expect(steps).toContainText(
    'Set a rope attachment on a cable pulley just above head height.',
  );
  await expect(steps).not.toContainText('pull-up bar');
  await expect(
    content.getByText('No form notes yet', { exact: true }),
  ).toHaveCount(0);
  await expect(
    content.getByText('Reviewed form guide', { exact: true }),
  ).toHaveCount(0);
});

test('the workout form guide retains Push-up artwork and instructions with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/library/I4hDWkc');
  await page
    .getByRole('button', { name: 'Start with this', exact: true })
    .click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(
    motionIn(page.getByRole('region', { name: 'Page content' })),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Form guide', exact: true }).click();
  const guide = page.getByRole('dialog', {
    name: 'Form guide · Push-up',
    exact: true,
  });
  const motion = motionIn(guide);
  await expect(motion).toBeVisible();
  await expect(motion.locator(':scope > g')).toHaveCount(3);
  await expect.poll(() => frameState(motion)).toBe('1,0,0');
  // Sample across several animation cycles rather than accepting one frozen instant.
  const states = await motion.evaluate(async (svg) => {
    const samples: string[] = [];
    for (let index = 0; index < 6; index++) {
      samples.push(
        Array.from(svg.children)
          .map((frame) => (frame as SVGElement).style.opacity)
          .join(','),
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return samples;
  });
  expect(new Set(states)).toEqual(new Set(['1,0,0']));
  await expect(guide.locator('ol')).toContainText(
    'Start in a high plank position with your hands slightly wider than shoulder-width apart and your feet together.',
  );
});

test('a transient artwork failure recovers when its exercise is reopened', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/art/push-up.svg', async (route) => {
    requests++;
    if (requests === 1)
      await route.fulfill({ status: 503, body: 'Temporary failure' });
    else await route.continue();
  });
  await page.goto('/library');
  const failed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/art/push-up.svg' &&
      response.status() === 503,
  );
  await page
    .getByRole('textbox', { name: 'Search exercise library', exact: true })
    .fill('Push-up');
  const row = page
    .getByRole('button')
    .filter({ has: page.getByText('Push-up', { exact: true }) });
  await row.scrollIntoViewIfNeeded();
  await failed;
  await expect(motionIn(row)).toHaveCount(0);
  await row.click();
  await expect(page).toHaveURL(/\/library\/I4hDWkc$/);
  const content = page.getByRole('region', { name: 'Page content' });
  await expect(
    content.getByRole('heading', { name: 'Push-up', exact: true }),
  ).toBeVisible();
  await expect.poll(() => requests).toBe(2);
  const motion = motionIn(content);
  await expect(motion).toBeVisible();
  await expect(motion.locator(':scope > g.transition-none')).toHaveCount(3);
});
