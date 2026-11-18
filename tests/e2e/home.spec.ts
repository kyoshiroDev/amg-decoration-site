import { expect, test } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';

// Contenu et contrats de l'accueil (blocs de la Phase 4). axe-core : a11y.spec.ts.

test.describe('Accueil : contenu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('chaque section est une région nommée par son titre h2', async ({ page }) => {
    const regions = page.locator('main section[aria-labelledby]');
    expect(await regions.count()).toBeGreaterThanOrEqual(10);
    for (const region of await regions.all()) {
      const id = await region.getAttribute('aria-labelledby');
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
  });

  test('les 4 formules mènent vers leur page de détail', async ({ page }) => {
    const links = page.locator('#prestations-titre').locator('xpath=ancestor::section[1]');
    const hrefs = await links
      .locator('ul a[href^="/prestations/"]')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual([
      '/prestations/essentiel/',
      '/prestations/confort/',
      '/prestations/signature/',
      '/prestations/studio/',
    ]);
  });

  test('les projets à la une mènent vers /realisations/<slug>/', async ({ page }) => {
    const section = page.locator('#projets-titre').locator('xpath=ancestor::section[1]');
    const hrefs = await section
      .locator('ul a')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^\/realisations\/[a-z0-9-]+\/$/);
  });

  test('les avis renvoient vers leur source, sans note ni étoile', async ({ page }) => {
    const section = page.locator('#temoignages-titre').locator('xpath=ancestor::section[1]');
    const quotes = section.locator('blockquote');
    expect(await quotes.count()).toBeGreaterThan(0);
    const sources = section.getByRole('link', { name: microcopy.testimonials.googleLink });
    await expect(sources).toHaveCount(await quotes.count());
    for (const link of await sources.all()) {
      await expect(link).toHaveAttribute('href', /^https:\/\//);
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    await expect(section).not.toContainText(/★|☆|\/\s?5\b/);
  });

  test('le bandeau de mots-clés n’est lu qu’une fois', async ({ page }) => {
    const readable = page.getByRole('list', { name: microcopy.marquee.label });
    await expect(readable).toHaveCount(1);
    await expect(readable.getByRole('listitem')).toHaveText([...microcopy.marquee.words]);
    const copies = page.locator('[data-marquee] ul[aria-hidden="true"]');
    expect(await copies.count()).toBeGreaterThanOrEqual(1);
  });

  test('une seule image prioritaire (le héros), en AVIF avec dimensions', async ({ page }) => {
    const priority = page.locator('img[fetchpriority="high"]');
    await expect(priority).toHaveCount(1);
    await expect(priority).toHaveAttribute('width', /\d+/);
    await expect(priority).toHaveAttribute('height', /\d+/);
    const hero = page.locator('#accueil-titre').locator('xpath=ancestor::section[1]');
    await expect(hero.locator('source[type="image/avif"]')).toHaveCount(1);
    await expect(page.locator('main img:not([fetchpriority="high"])').first()).toHaveAttribute(
      'loading',
      'lazy',
    );
  });
});
