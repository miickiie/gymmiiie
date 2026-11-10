import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { enterNumber, seed, snapshot, startWithPushup } from './fixtures';
import { parseBackup } from '../src/lib/backup';

test('a waiting service-worker update preserves the active workout', async ({
  page,
}) => {
  const filename = `sw-update-check-${randomUUID()}.js`;
  const file = resolve('dist', filename);
  await writeFile(
    file,
    "self.addEventListener('install', (event) => event.waitUntil(Promise.resolve()));\n",
  );
  try {
    await seed(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((done) =>
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => done(),
            { once: true },
          ),
        );
      }
    });
    await startWithPushup(page);
    const result = await page.evaluate(async (url) => {
      const active = navigator.serviceWorker.controller?.scriptURL;
      const registration = await navigator.serviceWorker.register(url, {
        scope: '/',
      });
      await new Promise<void>((done, reject) => {
        const timeout = setTimeout(() => {
          clearInterval(check);
          reject(new Error('Update did not enter waiting state.'));
        }, 10000);
        const check = setInterval(() => {
          if (registration.waiting?.state === 'installed') {
            clearInterval(check);
            clearTimeout(timeout);
            done();
          }
        }, 20);
      });
      return {
        active,
        current: navigator.serviceWorker.controller?.scriptURL,
        waiting: registration.waiting?.scriptURL,
      };
    }, `/${filename}`);
    expect(result.current).toBe(result.active);
    expect(result.waiting).toContain(filename);
    await expect(page).toHaveURL(/\/session$/);
    await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '19');
    await expect
      .poll(
        async () =>
          parseBackup(await snapshot(page)).active?.exercises[0]?.sets[0]?.reps,
      )
      .toBe(19);
  } finally {
    await rm(file, { force: true });
  }
});
