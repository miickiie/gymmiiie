import { expect, test, type Page } from '@playwright/test';
import { seed } from './fixtures';

test.use({ serviceWorkers: 'block' });

async function openSettings(page: Page, thai: boolean): Promise<void> {
  const label = thai ? 'ตั้งค่า' : 'Settings';
  const link = page.getByRole('link', { name: label, exact: true });
  if (await link.isVisible()) {
    await link.click();
  } else {
    await page
      .getByRole('button', {
        name: thai ? 'เปิดเมนู' : 'Open menu',
        exact: true,
      })
      .click();
    await page
      .getByRole('dialog', { name: thai ? 'เมนู' : 'Menu', exact: true })
      .getByRole('button', { name: label, exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/settings$/);
}

for (const language of ['en', 'th'] as const) {
  test(`sync status speaks once per state through Mochi without a persistent row in ${language}`, async ({ page }) => {
    const thai = language === 'th';
    const account = await seed(page, (data) => {
      data.settings.language = language;
    });
    const companion = page.getByRole('complementary', {
      name: thai ? 'Mochi แมวคู่ฝึกของคุณ' : 'Mochi, your workout cat',
    });
    const synced = thai ? 'ข้อมูลบัญชีซิงก์ล่าสุดแล้ว' : 'Account sync up to date';
    const waiting = thai
      ? 'บันทึกในเครื่องแล้ว · รอการซิงก์บัญชี'
      : 'Saved on device · account sync waiting';
    const dismiss = companion.getByRole('button', {
      name: thai ? 'ปิดข้อความจาก Mochi' : 'Dismiss Mochi’s message',
    });
    await expect(companion.getByRole('status')).toHaveText(synced);
    await expect(page.getByText(synced, { exact: true })).toHaveCount(1);
    await dismiss.click();

    await openSettings(page, thai);
    await expect(page.getByText(synced, { exact: true })).toHaveCount(0);
    await expect(companion.getByRole('status')).toHaveCount(0);
    await page.locator('a[href="/train"]:visible').first().click();

    const nextSync = () =>
      page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/accounts/${account.id}/data`) &&
          response.request().method() === 'PUT' &&
          response.ok(),
      );
    const firstSync = nextSync();
    await page
      .getByRole('button', {
        name: thai ? 'ฝึกแบบไม่มีแผน' : 'Empty workout',
        exact: true,
      })
      .click();
    await expect(companion.getByRole('status')).toHaveText(waiting);
    await expect(page.getByText(waiting, { exact: true })).toHaveCount(1);
    await dismiss.click();
    await firstSync;

    const secondSync = nextSync();
    await page
      .getByRole('button', { name: thai ? 'เพิ่ม' : 'Add', exact: true })
      .click();
    const picker = page.getByRole('dialog', {
      name: thai ? 'เพิ่มท่า' : 'Add exercise',
      exact: true,
    });
    await picker
      .getByRole('textbox', {
        name: thai ? 'ค้นหาท่าออกกำลัง' : 'Search exercises',
        exact: true,
      })
      .fill('Barbell Curl');
    await picker
      .getByRole('button')
      .filter({ has: page.getByText('Barbell Curl', { exact: true }) })
      .click();
    await secondSync;
    await openSettings(page, thai);
    await expect(companion.getByRole('status')).toHaveCount(0);
    await expect(page.getByText(synced, { exact: true })).toHaveCount(0);
    await expect(page.getByText(waiting, { exact: true })).toHaveCount(0);
  });
}
