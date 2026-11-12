import { expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { defaultData } from '../src/lib/defaults';
import { accountDataKey } from '../src/lib/db';
import type { AppData } from '../src/types';
import type { Account } from '../src/lib/accounts';

const accounts = new WeakMap<Page, Account>();

export async function enterNumber(input: Locator, value: string): Promise<void> {
  await input.fill(value);
}

export async function seed(
  page: Page,
  customize?: (fixture: AppData) => void,
  identity?: { name: string; pin: string },
): Promise<Account> {
  const fixture = defaultData();
  fixture.onboarded = true;
  fixture.settings.effort = 'rir';
  fixture.settings.autoRest = false;
  customize?.(fixture);
  await page
    .context()
    .setExtraHTTPHeaders({ 'X-Gymmiie-Test-Client': randomUUID() });
  const response = await page.request.post('/__test/seed', {
    data: { data: fixture, ...identity },
  });
  expect(response.status()).toBe(201);
  const body: { account: Account } = await response.json();
  accounts.set(page, body.account);
  await page.goto('/');
  const content = page.getByRole('region', { name: 'Page content' });
  const name = page.getByLabel('Name', { exact: true });
  await expect(content.or(name).first()).toBeVisible();
  if (await name.isVisible()) {
    await name.fill(body.account.name);
    await page
      .getByLabel('PIN (4 digits)', { exact: true })
      .fill(identity?.pin ?? '1234');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect(content).toBeVisible();
  return body.account;
}

export async function snapshot(
  page: Page,
  accountId?: string,
): Promise<unknown> {
  const id = accountId || accounts.get(page)?.id;
  if (!id) throw new Error('No seeded account is associated with this page.');
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('keyval').objectStore('keyval').get(key);
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
    accountDataKey(id),
  );
}

export async function startWithPushup(page: Page): Promise<void> {
  await page.goto('/train');
  await page
    .getByRole('button', { name: 'Empty workout', exact: true })
    .click();
  await expect(page).toHaveURL(/\/session$/);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Push-up');
  await page.getByText('Push-up', { exact: true }).first().click();
  await expect(
    page.getByLabel('Set 1 repetitions', { exact: true }),
  ).toBeVisible();
}
