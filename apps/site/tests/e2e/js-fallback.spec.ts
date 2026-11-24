import { expect, test } from '@playwright/test';

// ADR-0010 : si un module JS ne se charge pas, le script inline retire la classe `js` et le site
// revient à sa version sans JS (pas de filtres inertes ni de comparateur sans interaction).
test.describe('Filet de sécurité de la classe js', () => {
  test('la classe js est posée quand les scripts se chargent', async ({ page }) => {
    await page.goto('/realisations/');
    await expect(page.locator('html')).toHaveClass(/\bjs\b/);
    await expect(page.locator('[data-project-filters]')).toBeVisible();
  });

  test('un module en échec de chargement retire la classe js et masque les filtres', async ({
    page,
  }) => {
    await page.route(/\/_astro\/.+\.js$/, (route) => route.abort());
    await page.goto('/realisations/');
    await expect(page.locator('html')).not.toHaveClass(/\bjs\b/);
    await expect(page.locator('[data-project-filters]')).toBeHidden();
    // La grille complète reste lisible.
    await expect(page.locator('main h1')).toBeVisible();
  });
});
