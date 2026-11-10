import { expect, test } from '@playwright/test';
import { seed } from './fixtures';

test('Today fits phone widths without horizontal page scrolling', async ({ page }) => {
  await seed(page);
  for (const width of [320, 375, 390, 393, 402, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'This week', exact: true })).toBeVisible();
    const size = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return {
        viewport: width,
        document: document.documentElement.scrollWidth,
        overflow: Array.from(document.querySelectorAll('main *'))
          .filter((element) => element.getBoundingClientRect().right > width + 1)
          .slice(0, 8)
          .map((element) => ({ tag: element.tagName, className: element.getAttribute('class'), text: element.textContent?.slice(0, 60) })),
      };
    });
    expect(size.document, JSON.stringify(size)).toBeLessThanOrEqual(size.viewport + 1);
    await page.evaluate(() => window.scrollTo({ left: 1000, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  }
});
