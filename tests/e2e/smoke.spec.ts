import { expect, test } from '@playwright/test';
import { NOT_FOUND_PATH } from './helpers';

// Les audits axe-core de toutes les pages sont centralisés dans a11y.spec.ts.

test.describe('Accueil', () => {
  test('répond et expose un unique h1', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/AMG Décoration/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

test.describe('Console', () => {
  for (const path of ['/', '/styleguide/', NOT_FOUND_PATH]) {
    test(`aucune erreur console ni exception sur ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // Le statut 404 du document lui-même est attendu sur la page introuvable.
        const isExpected404 =
          path === NOT_FOUND_PATH && message.location().url.endsWith(NOT_FOUND_PATH);
        if (!isExpected404) errors.push(message.text());
      });
      await page.goto(path, { waitUntil: 'load' });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      expect(errors).toEqual([]);
    });
  }
});
