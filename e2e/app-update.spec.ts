import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { seed, snapshot, startWithPushup } from './fixtures';

test('update recovery bypasses stale offline screens and preserves saved data', async ({
  page,
}) => {
  const filename = `sw-stale-${randomUUID()}.js`;
  const file = resolve('dist', filename);
  await writeFile(
    file,
    `self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(new Response('<h1>Outdated Gymmiie</h1>', {
      headers: { 'Content-Type': 'text/html' }
    }));
  }
});`,
  );

  try {
    await seed(page);
    await startWithPushup(page);
    await page.getByLabel('Set 1 repetitions', { exact: true }).fill('19');
    await expect
      .poll(async () =>
        parseBackup(await snapshot(page)).active?.exercises[0]?.sets[0]?.reps,
      )
      .toBe(19);
    const before = parseBackup(await snapshot(page));

    await page.evaluate(async (url) => {
      await navigator.serviceWorker.ready;
      await navigator.serviceWorker.register(url, { scope: '/' });
    }, `/${filename}`);
    await expect
      .poll(() =>
        page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
      )
      .toContain(filename);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Outdated Gymmiie' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Outdated Gymmiie' }),
    ).toBeVisible();

    const response = await page.goto('/api/app-update');
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(
      page.getByRole('heading', { name: 'Update Gymmiie' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Update Gymmiie' }).click();
    await expect(page).toHaveURL(/\/\?app-update=\d+$/);
    await expect(page.getByRole('region', { name: 'Page content' })).toBeVisible();
    const after = parseBackup(await snapshot(page));
    expect(after.profile).toEqual(before.profile);
    expect(after.active).toEqual(before.active);
    expect(after.sessions).toEqual(before.sessions);
  } finally {
    await rm(file, { force: true });
  }
});
