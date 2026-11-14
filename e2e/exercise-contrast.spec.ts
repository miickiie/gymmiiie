import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { seed } from './fixtures';

const luminance = (rgb: number[]) => {
  const linear = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

for (const theme of ['dark', 'light', 'solar'] as const) {
  test(`Band Chest Fly has a visible figure against its canvas in ${theme} mode`, async ({
    page,
  }, testInfo) => {
    await seed(page, (data) => {
      data.settings.theme = theme;
    });
    // Keep the first real animation frame still for a deterministic pixel check.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/library/band-chest-fly');
    const content = page.getByRole('region', { name: 'Page content' });
    await expect(
      content.getByRole('heading', { name: 'Band Chest Fly', exact: true }),
    ).toBeVisible();
    const motion = content
      .locator('svg:has(> g.transition-none > path)')
      .first();
    await expect(motion).toBeVisible();
    await expect(motion.locator(':scope > g')).toHaveCount(2);
    await expect
      .poll(() =>
        motion
          .locator(':scope > g')
          .evaluateAll((frames) =>
            frames
              .map((frame) => (frame as SVGElement).style.opacity)
              .join(','),
          ),
      )
      .toBe('1,0');

    const aspect = await motion.evaluate((svg) => {
      const box = (svg as SVGSVGElement).viewBox.baseVal;
      return box.width / box.height;
    });
    const png = await motion.screenshot({
      path: testInfo.outputPath(`band-chest-fly-${theme}.png`),
      animations: 'disabled',
    });
    const metadata = await sharp(png).metadata();
    const width = metadata.width!;
    const height = metadata.height!;
    // Crop out SVG letterboxing so the surrounding dark card cannot mask an
    // unreadable white-on-white drawing in the actual source-image rectangle.
    const cropWidth = Math.min(width, Math.round(height * aspect));
    const cropHeight = Math.min(height, Math.round(width / aspect));
    const { data, info } = await sharp(png)
      .extract({
        left: Math.floor((width - cropWidth) / 2),
        top: Math.floor((height - cropHeight) / 2),
        width: cropWidth,
        height: cropHeight,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colors = new Map<string, number>();
    for (let offset = 0; offset < data.length; offset += 3) {
      const color = `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
    const [dominant] = [...colors].sort((a, b) => b[1] - a[1])[0];
    const background = luminance(dominant.split(',').map(Number));
    let visiblePixels = 0;
    for (const [color, count] of colors) {
      const foreground = luminance(color.split(',').map(Number));
      const contrast =
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05);
      if (contrast >= 3) visiblePixels += count;
    }
    const visibleFraction = visiblePixels / (info.width * info.height);
    await testInfo.attach('figure-contrast', {
      body: JSON.stringify({ theme, dominant, visibleFraction }),
      contentType: 'application/json',
    });
    expect(visibleFraction).toBeGreaterThan(0.01);
  });
}
