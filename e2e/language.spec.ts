import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { seed } from './fixtures';

test('sign-in language persists and existing validation changes with the selected language', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByLabel('ชื่อบัญชี', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByText('กรอกชื่อบัญชี', { exact: true })).toBeVisible();
  await expect(page.getByText('PIN ต้องเป็นตัวเลข 4 หลัก', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByText('Enter your name.', { exact: true })).toBeVisible();
  await expect(page.getByText('Use exactly 4 digits for your PIN.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByLabel('ชื่อบัญชี', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('thai-sign-in.png'), fullPage: true, animations: 'disabled' });
});

test('Thai registration translates server errors and keeps the language in the new account', async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ 'X-Gymmiie-Test-Client': randomUUID() });
  await page.goto('/');
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.getByLabel('ชื่อบัญชี', { exact: true }).fill(`Thai athlete ${randomUUID()}`);
  await page.getByLabel('PIN 4 หลัก', { exact: true }).fill('0123');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'สร้างบัญชี', exact: true })).toBeVisible();
  await page.getByLabel('รหัสสำหรับสมัครบัญชี', { exact: true }).fill('incorrect-invite');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
  await expect(page.getByText('รหัสสำหรับสมัครบัญชีไม่ถูกต้อง', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByText('The registration passphrase is incorrect.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.getByLabel('รหัสสำหรับสมัครบัญชี', { exact: true }).fill('test-invite');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ตั้งค่าทีหลัง', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ตั้งค่าทีหลัง', exact: true }).click();
  await expect(page.locator('section[data-route]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  const session = await page.request.get('/api/session');
  const { account } = await session.json();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/accounts/${account.id}/data`);
    if (!response.ok()) return null;
    const { data } = await response.json();
    return data ? parseBackup(data).settings.language : null;
  }).toBe('th');
  await page.reload();
  await expect(page.locator('section[data-route]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
});

test('Thai screens preserve exercise names and standard units while translating the guidance', async ({ page }, testInfo) => {
  await seed(page, (data) => {
    data.active = {
      id: 'language-workout', startedAt: Date.now(), pausedTotalSec: 0, currentIndex: 0,
      exercises: [{
        uid: 'face-pull-set', id: 'face-pull', name: 'Face Pull', primary: 'shoulders',
        mode: '', loadKind: 'external',
        sets: [{ reps: 12, weight: 20, done: false, kind: 'normal' }],
      }],
    };
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Thai', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByRole('button', { name: 'Kilograms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pounds', exact: true })).toBeVisible();
  await page.goto('/session');
  await expect(page.getByRole('heading', { name: 'Face Pull', exact: true })).toBeVisible();
  const reps = page.getByLabel('จำนวน reps ในเซ็ต 1', { exact: true });
  await expect(reps).toHaveValue('12');
  await expect(reps.locator('..').getByText('reps', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'kg', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'lb', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('thai-workout.png'), fullPage: true, animations: 'disabled' });
  await page.goto('/library/face-pull');
  await expect(page.getByRole('heading', { name: 'Face Pull', exact: true })).toBeVisible();
  await expect(page.locator('ol').first()).toContainText(/[ก-๙]/);
  await page.goto('/routines');
  for (const name of ['Full Body', 'Push Pull Legs', 'Upper Lower', 'Arnold Split']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  for (const route of ['/nutrition', '/tools']) {
    await page.goto(route);
    await expect(page.locator('section[data-route]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`thai${route.replace('/', '-')}.png`), fullPage: true, animations: 'disabled' });
  }
});

test('sign-out notices switch language and existing accounts retain their saved preference', async ({ page }) => {
  const account = await seed(page);
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Your account', exact: true })
    .getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Gymmiie', exact: true })).toBeVisible();
  const notice = page.locator('form p[role="status"]');
  await expect(notice).toHaveText('Signed out. Your changes were synced to your account.');
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await expect(notice).toContainText(/[ก-๙]/);
  await expect(notice).not.toContainText('Signed out.');
  await page.getByLabel('ชื่อบัญชี', { exact: true }).fill(account.name);
  await page.getByLabel('PIN 4 หลัก', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Page content' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
