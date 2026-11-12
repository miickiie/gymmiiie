import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { enterNumber, seed, snapshot, startWithPushup } from './fixtures';

const origin = `http://127.0.0.1:${process.env.GYMMIIE_TEST_PORT ?? 4173}`;
function identity(label: string): { name: string; pin: string } {
  return { name: `${label} ${randomUUID()}`, pin: '0123' };
}

async function signIn(
  page: Page,
  user: { name: string; pin: string },
): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill(user.name);
  await page.getByLabel('PIN (4 digits)', { exact: true }).fill(user.pin);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Your account', exact: true })
    .getByRole('button', { name: 'Sign out', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible();
}

async function accountCopy(page: Page, accountId: string): Promise<unknown> {
  const response = await page.request.get(`/api/accounts/${accountId}/data`);
  expect(response.status()).toBe(200);
  const result: { data: unknown } = await response.json();
  return result.data;
}

test('new users require the server registration phrase; returning users do not', async ({
  page,
}, testInfo) => {
  await page
    .context()
    .setExtraHTTPHeaders({ 'X-Gymmiie-Test-Client': randomUUID() });
  const user = identity('New athlete');
  await signIn(page, user);
  await expect(
    page.getByRole('heading', { name: 'Create an account', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Registration passphrase', { exact: true })
    .fill('incorrect-test-phrase');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await page.request.get('/api/session')).status()).toBe(401);
  await page
    .getByLabel('Registration passphrase', { exact: true })
    .fill('test-invite');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Page content' }),
  ).toBeVisible();
  const response = await page.request.get('/api/session');
  const result: { account: { id: string; name: string } } =
    await response.json();
  expect(result.account.name).toBe(user.name);
  expect(result.account).not.toHaveProperty('pin');
  expect(result.account).not.toHaveProperty('telephone');
  await expect
    .poll(async () => {
      const data = await accountCopy(page, result.account.id);
      return data !== null && parseBackup(data).onboarded;
    })
    .toBe(true);
  await signOut(page);
  await page.screenshot({
    path: testInfo.outputPath('sign-in.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await signIn(page, {
    name: `  ${user.name.toUpperCase()}  `,
    pin: user.pin,
  });
  await expect(
    page.getByRole('region', { name: 'Page content' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Registration passphrase', { exact: true }),
  ).toHaveCount(0);
});

test('saved tracking loads on another browser without a local cache', async ({
  page,
  browser,
}) => {
  const user = identity('Tracking athlete');
  const account = await seed(
    page,
    (data) => {
      data.profile.name = 'Athlete display name';
    },
    user,
  );
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '16');
  await page
    .getByRole('button', { name: 'Complete set 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Finish workout', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Finish workout?', exact: true })
    .getByRole('button', { name: 'Save workout', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        parseBackup(await accountCopy(page, account.id)).sessions.length,
    )
    .toBe(1);
  const savedSession = parseBackup(await accountCopy(page, account.id))
    .sessions[0];
  const other = await browser.newContext({ baseURL: origin });
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage, user);
    await expect(
      otherPage.getByRole('region', { name: 'Page content' }),
    ).toBeVisible();
    await otherPage.goto('/history');
    await expect(
      otherPage.locator(`a[href="/history/${savedSession.id}"]`),
    ).toBeVisible();
    const loaded = parseBackup(await snapshot(otherPage, account.id));
    expect(loaded.profile.name).toBe('Athlete display name');
    expect(loaded.sessions[0].exercises[0].sets[0].reps).toBe(16);
  } finally {
    await other.close();
  }
});

test('switching A to B and back preserves each account and its active draft', async ({
  page,
}) => {
  const userA = identity('Account A');
  const userB = identity('Account B');
  const accountA = await seed(
    page,
    (data) => {
      data.profile.name = 'Alice';
    },
    userA,
  );
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '23');
  const accountB = await seed(
    page,
    (data) => {
      data.profile.name = 'Bob';
    },
    userB,
  );
  const dataB = parseBackup(await accountCopy(page, accountB.id));
  expect(dataB.profile.name).toBe('Bob');
  expect(dataB.active).toBeNull();
  expect(dataB.sessions).toEqual([]);
  await signOut(page);
  await signIn(page, userA);
  await expect(
    page.getByRole('region', { name: 'Page content' }),
  ).toBeVisible();
  await page.goto('/session');
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toHaveValue('23');
  expect(parseBackup(await snapshot(page, accountA.id)).profile.name).toBe(
    'Alice',
  );
});

test('an old tab cannot upload its draft to a different account after shared cookies change', async ({
  page,
}) => {
  const userA = identity('Tab athlete A');
  const accountA = await seed(
    page,
    (data) => {
      data.profile.name = 'Tab Alice';
    },
    userA,
  );
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '31');
  const otherPage = await page.context().newPage();
  const accountB = await seed(
    otherPage,
    (data) => {
      data.profile.name = 'Tab Bob';
    },
    identity('Tab athlete B'),
  );
  await page.bringToFront();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible();
  const protectedData = parseBackup(await accountCopy(otherPage, accountB.id));
  expect(protectedData.profile.name).toBe('Tab Bob');
  expect(protectedData.active).toBeNull();
  expect(protectedData.sessions).toEqual([]);
  expect(
    parseBackup(await snapshot(page, accountA.id)).active?.exercises[0].sets[0]
      .reps,
  ).toBe(31);
});

test('offline edits stay with the cached account and sync after reconnection', async ({
  page,
  context,
}) => {
  const account = await seed(page);
  await startWithPushup(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((done) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => done(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole('button', { name: 'Continue offline', exact: true })
    .click();
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toBeVisible();
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '29');
  await expect
    .poll(
      async () =>
        parseBackup(await snapshot(page, account.id)).active?.exercises[0]
          .sets[0].reps,
    )
    .toBe(29);
  await context.setOffline(false);
  await expect
    .poll(
      async () =>
        parseBackup(await accountCopy(page, account.id)).active?.exercises[0]
          .sets[0].reps,
      { timeout: 15000 },
    )
    .toBe(29);
});

test('a service failure is not treated as a missing account', async ({
  page,
}) => {
  await page
    .context()
    .setExtraHTTPHeaders({ 'X-Gymmiie-Test-Client': randomUUID() });
  await page.route('**/api/session', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'service_unavailable',
            message: 'Temporarily unavailable. Try again.',
          },
        }),
      });
    } else await route.continue();
  });
  await signIn(page, identity('Retry athlete'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Create an account', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Registration passphrase', { exact: true }),
  ).toHaveCount(0);
});

test('older device tracking stays separate until its import is explicitly confirmed', async ({
  page,
}) => {
  await seed(page);
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '15');
  await expect
    .poll(
      async () =>
        parseBackup(await snapshot(page)).active?.exercises[0]?.sets[0]?.reps,
    )
    .toBe(15);
  const older = parseBackup(await snapshot(page));
  older.profile.name = 'Older device log';
  await page.evaluate(
    (data) =>
      new Promise<void>((done, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('keyval', 'readwrite');
          transaction.objectStore('keyval').put(data, 'gymmiie:data:v1');
          transaction.oncomplete = () => {
            db.close();
            done();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        };
      }),
    older,
  );
  await signOut(page);
  const account = await seed(page, (data) => {
    data.profile.name = 'Separate account';
  });
  expect(parseBackup(await snapshot(page, account.id)).active).toBeNull();
  await page
    .getByRole('button', { name: 'Review device log', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Review older device log', exact: true })
    .getByRole('button', { name: 'Import into this account…', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: /^Replace .*account log\?/ })
    .getByRole('button', { name: 'Import device log', exact: true })
    .click();
  await expect
    .poll(
      async () => parseBackup(await snapshot(page, account.id)).profile.name,
    )
    .toBe('Older device log');
  expect(
    parseBackup(await snapshot(page, account.id)).active?.exercises[0].sets[0]
      .reps,
  ).toBe(15);
});

test('sign in requires exactly four PIN digits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill('Validation athlete');
  await expect(page.getByLabel('Telephone', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Set PIN for existing account', exact: true })).toHaveCount(0);
  const pin = page.getByLabel('PIN (4 digits)', { exact: true });
  await expect(pin).toHaveAttribute('type', 'password');
  await expect(pin).toHaveAttribute('inputmode', 'numeric');
  await pin.fill('1a23');
  await expect(pin).toHaveValue('123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Create an account', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Registration passphrase', { exact: true }),
  ).toHaveCount(0);
});

test('session loss hides private tracking while preserving the account draft for sign-in', async ({
  page,
  context,
}) => {
  const user = identity('Session recovery athlete');
  const account = await seed(page, undefined, user);
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '28');
  await context.clearCookies();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(
    parseBackup(await snapshot(page, account.id)).active?.exercises[0].sets[0]
      .reps,
  ).toBe(28);
  await signIn(page, user);
  await expect(
    page.getByRole('region', { name: 'Page content' }),
  ).toBeVisible();
  await page.goto('/session');
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toHaveValue('28');
});

test('an online sign-out flushes the latest tracking before another device signs in', async ({
  page,
  browser,
}) => {
  const user = identity('Fast sign-out athlete');
  const account = await seed(page, undefined, user);
  await startWithPushup(page);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '34');
  await signOut(page);
  const other = await browser.newContext({ baseURL: origin });
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage, user);
    await expect(
      otherPage.getByRole('region', { name: 'Page content' }),
    ).toBeVisible();
    await otherPage.goto('/session');
    await expect(
      otherPage.getByLabel('Set 1 repetitions', { exact: true }),
    ).toHaveValue('34');
    expect(
      parseBackup(await snapshot(otherPage, account.id)).active?.exercises[0]
        .sets[0].reps,
    ).toBe(34);
  } finally {
    await other.close();
  }
});

test('offline sign-out keeps a recoverable draft and does not reopen it automatically', async ({
  page,
  context,
}) => {
  const user = identity('Offline sign-out athlete');
  const account = await seed(page, undefined, user);
  await startWithPushup(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((done) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => done(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await enterNumber(page.getByLabel('Set 1 repetitions', { exact: true }), '26');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Your account', exact: true })
    .getByRole('button', { name: 'Sign out', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Changes are not synced yet', exact: true })
    .getByRole('button', { name: 'Continue sign out', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible();
  expect(
    parseBackup(await snapshot(page, account.id)).active?.exercises[0].sets[0]
      .reps,
  ).toBe(26);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue offline', exact: true }),
  ).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true }),
  ).toBeVisible();
  await signIn(page, user);
  await expect(
    page.getByRole('region', { name: 'Page content' }),
  ).toBeVisible();
  await page.goto('/session');
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toHaveValue('26');
});
