import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { expectNoAxeViolations } from './helpers';

// Blog « Conseils déco » : index, article, et garde-fou sur la sortie du build.

const INDEX = '/conseils-deco/';
const ARTICLE = '/conseils-deco/plan-3d-avant-renovation/';
const DRAFT_SLUG = 'modele-article';
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

async function listHtml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listHtml(path);
      return Promise.resolve(entry.name.endsWith('.html') ? [path] : []);
    }),
  );
  return nested.flat();
}

test.describe('Conseils déco : index', () => {
  test('articles publiés uniquement, h1 unique, 0 violation axe', async ({ page }) => {
    await page.goto(INDEX);
    await expect(page.locator('h1')).toHaveCount(1);
    const cards = page.locator('main article');
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator(`a[href*="${DRAFT_SLUG}"]`)).toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card.locator('time[datetime]')).toHaveCount(1);
      await expect(card).toContainText('min de lecture');
    }
    await expectNoAxeViolations(page);
  });

  test('la route du brouillon n’existe pas', async ({ page }) => {
    const response = await page.goto(`/conseils-deco/${DRAFT_SLUG}/`);
    expect(response?.status()).toBe(404);
  });
});

test.describe('Conseils déco : article', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(ARTICLE);
    expect(response?.status()).toBe(200);
  });

  test('fil d’Ariane, h1, dates, hiérarchie sans saut, 0 violation axe', async ({ page }) => {
    const crumbs = page.getByRole('navigation', { name: microcopy.nav.breadcrumb });
    await expect(crumbs.getByRole('listitem')).toHaveCount(3);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main time[datetime]').first()).toHaveAttribute(
      'datetime',
      /^\d{4}-\d{2}-\d{2}$/,
    );
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((els) => els.map((el) => Number(el.tagName.slice(1))));
    levels.forEach((level, i) => {
      if (i > 0) expect(level - (levels[i - 1] ?? 1)).toBeLessThanOrEqual(1);
    });
    await expect(page.locator('img[fetchpriority="high"]')).toHaveCount(1);
    await expectNoAxeViolations(page);
  });

  test('« Pour aller plus loin » : formule, réalisation, autre article ; CTA contact', async ({
    page,
  }) => {
    const further = page.locator('#plus-loin-titre').locator('xpath=ancestor::section[1]');
    const hrefs = await further
      .locator('a')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual([
      '/prestations/signature/',
      '/realisations/sous-sol-suite-parentale/',
      '/conseils-deco/decoratrice-interieur-a-distance/',
    ]);
    await expect(page.locator('main a[href="/contact/"]').first()).toBeVisible();
  });

  test('SEO : og:type article et JSON-LD BlogPosting', async ({ page }) => {
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    const raw = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';
    const graph = (JSON.parse(raw) as { '@graph': { '@type': string; [k: string]: unknown }[] })[
      '@graph'
    ];
    const posting = graph.find((node) => node['@type'] === 'BlogPosting');
    expect(posting?.['datePublished']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(posting?.['image']).toMatch(/^https:\/\/amgdecorationdinterieur\.com\/_astro\//);
  });
});

test.describe('Garde-fou du build (dist/)', () => {
  test('aucune page ne contient « TODO » ni le modèle d’article', async () => {
    const files = await listHtml(DIST);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const html = await readFile(file, 'utf8');
      if (html.includes('TODO') || html.includes(DRAFT_SLUG)) {
        offenders.push(file.replace(DIST, ''));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('le sitemap ne référence pas le modèle d’article', async () => {
    const sitemap = await readFile(join(DIST, 'sitemap-0.xml'), 'utf8');
    expect(sitemap).toContain('/conseils-deco/plan-3d-avant-renovation/');
    expect(sitemap).not.toContain(DRAFT_SLUG);
  });
});
