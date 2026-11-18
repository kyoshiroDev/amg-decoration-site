import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { SITE_ROUTES } from '../../src/lib/redirects';
import { expectNoAxeViolations } from './helpers';

// Pages du lot 2A : Visualisation 3D, À propos, Contact, Merci et pages légales.

/** Routes de SITE_ROUTES construites par le lot 2A (prestations, 3D, à propos, contact, légal). */
const LOT_2A_ROUTES = SITE_ROUTES.filter((path) =>
  /^\/(prestations|visualisation-3d|a-propos|contact|mentions-legales|confidentialite|conditions-generales)\//.test(
    path,
  ),
);

const AUDITED = [
  '/visualisation-3d/',
  '/a-propos/',
  '/contact/',
  '/merci/',
  '/mentions-legales/',
  '/confidentialite/',
  '/conditions-generales/',
] as const;

const SITEMAP_FILE = new URL('../../dist/sitemap-0.xml', import.meta.url);

test.describe('Routes construites', () => {
  test('la liste couvre les 13 pages du lot', () => {
    expect(LOT_2A_ROUTES).toHaveLength(13);
  });

  for (const path of LOT_2A_ROUTES) {
    test(`${path} répond 200`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('Pages : structure et accessibilité', () => {
  for (const path of AUDITED) {
    test(`${path} : un h1, hiérarchie sans saut, 0 violation axe`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));
      levels.slice(1).forEach((level, index) => {
        expect(level).toBeLessThanOrEqual((levels[index] ?? 0) + 1);
      });
      await expect(page.locator('img[fetchpriority="high"]')).toHaveCount(
        path === '/visualisation-3d/' ? 1 : 0,
      );
      await expectNoAxeViolations(page);
    });
  }
});

test.describe('Débordement horizontal à 320 px (lot 2A)', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  for (const path of [...AUDITED, '/prestations/', '/prestations/professionnels/']) {
    test(`${path} ne déborde pas`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('Pages légales', () => {
  for (const path of ['/mentions-legales/', '/confidentialite/', '/conditions-generales/']) {
    test(`${path} : chaque entrée du sommaire pointe vers un h2`, async ({ page }) => {
      await page.goto(path);
      const toc = page.getByRole('navigation', { name: microcopy.legal.tocLabel });
      const hrefs = await toc
        .getByRole('link')
        .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        await expect(page.locator(`h2${href}`)).toHaveCount(1);
      }
    });
  }

  test('mesure de lecture longue entre 60 et 72 caractères', async ({ page }) => {
    await page.goto('/conditions-generales/');
    const ratio = await page.locator('.rich-text').evaluate((element) => {
      const probe = document.createElement('span');
      probe.textContent = '0';
      element.append(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      return parseFloat(getComputedStyle(element).maxInlineSize) / ch;
    });
    expect(ratio).toBeGreaterThanOrEqual(60);
    expect(ratio).toBeLessThanOrEqual(72);
  });
});

test.describe('À propos', () => {
  test('citation, témoignage filtré sans lien, sans note', async ({ page }) => {
    await page.goto('/a-propos/');
    await expect(page.locator('blockquote').first()).toContainText('soleil');
    const reviews = page.locator('#temoignages-titre').locator('xpath=ancestor::section[1]');
    await expect(reviews.locator('blockquote')).toHaveCount(1);
    await expect(reviews).toContainText('Christine C');
    await expect(reviews.getByRole('link')).toHaveCount(0);
    await expect(reviews).not.toContainText(/★|☆/);
  });
});

test.describe('Merci', () => {
  test('noindex, sans canonical, absente du sitemap, liens de retour', async ({ page }) => {
    const response = await page.goto('/merci/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('main a[href="/"]')).toHaveCount(1);
    const sitemap = await readFile(SITEMAP_FILE, 'utf8');
    expect(sitemap).not.toContain('/merci/');
    expect(sitemap).toContain('/contact/');
  });
});
