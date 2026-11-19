import { expect, test } from '@playwright/test';

// Indexation (noindex, sitemap) : seo.spec.ts ; axe-core : a11y.spec.ts.

test.describe('Styleguide', () => {
  test('répond et expose un unique h1', async ({ page }) => {
    const response = await page.goto('/styleguide/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('ne déborde pas horizontalement', async ({ page }) => {
    await page.goto('/styleguide/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
