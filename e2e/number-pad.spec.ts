import { expect, test } from '@playwright/test';
import { enterNumber, numberPad, seed, startWithPushup } from './fixtures';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Desktop keeps native numeric editing.');
  await seed(page);
});

test('the numeric sheet keeps the viewport and page still and Cancel preserves the value', async ({ page }, testInfo) => {
  await startWithPushup(page);
  const input = page.getByRole('spinbutton', { name: 'Set 1 repetitions', exact: true, includeHidden: true });
  await input.scrollIntoViewIfNeeded();
  const initial = await input.inputValue();
  const dimensions = () => page.evaluate(() => {
    const bounds = document.querySelector('section[data-route]')?.getBoundingClientRect();
    return {
      height: window.visualViewport?.height,
      width: window.innerWidth,
      y: window.scrollY,
      content: bounds && { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    };
  });
  const before = await dimensions();
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveAttribute('inputmode', 'none');
  await input.tap();
  const pad = numberPad(page);
  const value = pad.getByRole('textbox', { name: 'Number to enter', exact: true });
  await expect(value).toHaveAttribute('readonly', '');
  await expect(value).toHaveAttribute('inputmode', 'none');
  await expect(pad.getByRole('heading', { name: 'Set 1 repetitions', exact: true })).toHaveCount(1);
  await expect(page.getByText('Set 1 repetitions', { exact: true })).toHaveCount(1);
  await expect(pad.getByRole('button', { name: 'Change sign', exact: true })).toHaveCount(0);
  await expect(pad.getByText('±', { exact: true })).toHaveCount(0);
  await pad.getByRole('button', { name: '3', exact: true }).tap();
  await expect(value).toHaveValue('3');
  await expect(input).toHaveValue(initial);
  expect(await dimensions()).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('workout-number-pad.png'), animations: 'disabled' });
  await pad.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(input).toHaveValue(initial);
  await expect(input).toBeFocused();
  await expect(pad).toHaveCount(0);
  expect(await dimensions()).toEqual(before);
});

test('the sheet supports decimals, delete, clear and trailing decimal points', async ({ page }) => {
  await page.goto('/settings');
  const weight = page.getByRole('spinbutton', { name: /^Weight\b/ });
  await weight.click();
  const pad = numberPad(page);
  await pad.getByRole('button', { name: '8', exact: true }).click();
  await pad.getByRole('button', { name: '2', exact: true }).click();
  await pad.getByRole('button', { name: 'Decimal point', exact: true }).click();
  await pad.getByRole('button', { name: '6', exact: true }).click();
  await pad.getByRole('button', { name: 'Delete digit', exact: true }).click();
  await pad.getByRole('button', { name: '5', exact: true }).click();
  await expect(pad.getByRole('textbox', { name: 'Number to enter', exact: true })).toHaveValue('82.5');
  await pad.getByRole('button', { name: 'Use value', exact: true }).click();
  await expect(weight).toHaveValue('82.5');
  await page.goto('/nutrition');
  await page.getByRole('button', { name: 'Add Banana', exact: true }).click();
  const portion = page.getByRole('spinbutton', { name: 'Portion in grams', exact: true });
  await enterNumber(portion, '82.');
  await expect(portion).toHaveValue('82');
});

test('Thai numeric sheets retain standard units and translate their controls', async ({ page }, testInfo) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Thai', exact: true }).click();
  const weight = page.getByRole('spinbutton', { name: 'น้ำหนัก kg', exact: true });
  await weight.click();
  const pad = numberPad(page);
  const value = pad.getByRole('textbox', { name: 'ค่าที่ต้องการกรอก', exact: true });
  await expect(value).toHaveAttribute('inputmode', 'none');
  await expect(pad.getByText('kg', { exact: true })).toBeVisible();
  await expect(pad.getByRole('button', { name: 'ล้างตัวเลข', exact: true })).toBeVisible();
  await expect(pad.getByRole('button', { name: 'ใช้ค่านี้', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('thai-number-pad.png'), animations: 'disabled' });
  await pad.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
});
