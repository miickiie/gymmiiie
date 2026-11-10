import { randomUUID } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import { parseBackup } from '../src/lib/backup';
import { seed, snapshot } from './fixtures';

async function replaceNumber(input: Locator, value: string): Promise<void> {
  await input.fill('');
  await expect(input).toHaveValue('');
  for (const digit of value) {
    await input.pressSequentially(digit);
  }
  await expect(input).toHaveValue(value);
  await input.press('Tab');
  await expect(input).toHaveValue(value);
}

test('onboarding profile numbers can be cleared and retyped without overlapping units', async ({
  page,
}) => {
  await page
    .context()
    .setExtraHTTPHeaders({ 'X-Gymmiie-Test-Client': randomUUID() });
  await page.goto('/');
  await page.getByLabel('Name', { exact: true }).fill(`Profile ${randomUUID()}`);
  await page.getByLabel('Telephone', { exact: true }).fill('+12025550121');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel('Registration passphrase', { exact: true })
    .fill('test-invite');
  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const age = page.getByRole('spinbutton', { name: /^Age\b/ });
  const height = page.getByRole('spinbutton', { name: /^Height\b/ });
  const weight = page.getByRole('spinbutton', { name: /^Weight\b/ });

  await replaceNumber(age, '34');
  await replaceNumber(height, '178');
  await replaceNumber(weight, '72.5');

  for (const input of [age, height, weight]) {
    const gap = await input.evaluate((element) => {
      const unit = element.parentElement?.querySelector('span');
      if (!unit) throw new Error('Missing input unit');
      const style = getComputedStyle(element);
      const numberRight =
        element.getBoundingClientRect().right -
        parseFloat(style.paddingRight) -
        parseFloat(style.borderRightWidth);
      return unit.getBoundingClientRect().left - numberRight;
    });
    expect(gap).toBeGreaterThan(0);
  }

  await height.fill('300');
  await expect(height).toHaveValue('300');
  await height.press('Tab');
  await expect(height).toHaveValue('250');
  await height.fill('90');
  await expect(height).toHaveValue('90');
  await height.press('Tab');
  await expect(height).toHaveValue('100');
  await replaceNumber(height, '178');

  await age.fill('');
  await age.press('Tab');
  await expect(age).toHaveValue('34');

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Gymmiie', exact: true }).click();
  await page.goto('/settings');
  await expect(page.getByRole('spinbutton', { name: /^Age\b/ })).toHaveValue(
    '34',
  );
  await expect(page.getByRole('spinbutton', { name: /^Height\b/ })).toHaveValue(
    '178',
  );
  await expect(page.getByRole('spinbutton', { name: /^Weight\b/ })).toHaveValue(
    '72.5',
  );
});

test('settings keeps valid profile numbers while a replacement is incomplete', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/settings');
  const age = page.getByRole('spinbutton', { name: /^Age\b/ });
  const height = page.getByRole('spinbutton', { name: /^Height\b/ });
  const weight = page.getByRole('spinbutton', { name: /^Weight\b/ });

  await height.fill('');
  await expect(height).toHaveValue('');
  await height.pressSequentially('1');
  await expect(height).toHaveValue('1');
  await expect
    .poll(async () => parseBackup(await snapshot(page)).profile.heightCm)
    .toBe(175);
  await height.pressSequentially('80');
  await height.press('Tab');
  await expect(height).toHaveValue('180');

  await replaceNumber(age, '42');
  await replaceNumber(weight, '82.5');
  await expect
    .poll(async () => parseBackup(await snapshot(page)).profile)
    .toMatchObject({ age: 42, heightCm: 180, weightKg: 82.5 });

  await page.reload();
  await expect(age).toHaveValue('42');
  await expect(height).toHaveValue('180');
  await expect(weight).toHaveValue('82.5');
});
