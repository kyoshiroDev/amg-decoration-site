import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { site } from '../../src/config/site';
import { expectNoAxeViolations } from './helpers';

// Prestations : page d'index et pages de détail. Première page interne : couvre aussi
// PageLayout et Breadcrumbs (fil d'Ariane visible, aria-current, BreadcrumbList cohérent).

const SITE_ORIGIN = 'https://amgdecorationdinterieur.com';
const SERVICE_SLUGS = [
  'essentiel',
  'confort',
  'signature',
  'studio',
  'meuble-sur-mesure',
  'professionnels',
] as const;

interface GraphNode {
  '@type': string;
  [key: string]: unknown;
}

async function readGraph(page: Page): Promise<GraphNode[]> {
  const raw = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';
  return (JSON.parse(raw) as { '@graph': GraphNode[] })['@graph'];
}

async function headingLevels(page: Page): Promise<number[]> {
  return page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));
}

function expectNoHeadingJump(levels: number[]): void {
  expect(levels[0]).toBe(1);
  levels.slice(1).forEach((level, index) => {
    expect(level, `saut de niveau après h${levels[index]}`).toBeLessThanOrEqual(
      (levels[index] ?? 0) + 1,
    );
  });
}

test.describe('Prestations : index', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto('/prestations/');
    expect(response?.status()).toBe(200);
  });

  test('formules et offres mènent vers leur page de détail', async ({ page }) => {
    const formulas = page.locator('#formules-titre').locator('xpath=ancestor::section[1]');
    await expect(formulas.locator('ul a')).toHaveCount(4);
    const offers = page.locator('#offres-titre').locator('xpath=ancestor::section[1]');
    const hrefs = await offers
      .locator('ul a')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['/prestations/meuble-sur-mesure/', '/prestations/professionnels/']);
    await expect(offers).toContainText('Devis professionnel');
  });

  test('les prix suivent site.pricing.showPrices', async ({ page }) => {
    const formulas = page.locator('#formules-titre').locator('xpath=ancestor::section[1]');
    const euros = formulas.getByText(/\d\s?€/);
    if (site.pricing.showPrices) expect(await euros.count()).toBeGreaterThan(0);
    else await expect(euros).toHaveCount(0);
  });

  test('un h1, hiérarchie sans saut, 0 violation axe', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expectNoHeadingJump(await headingLevels(page));
    await expectNoAxeViolations(page);
  });
});

test.describe('Prestations : pages de détail', () => {
  for (const slug of SERVICE_SLUGS) {
    test(`/prestations/${slug}/ répond 200 avec un seul h1`, async ({ page }) => {
      const response = await page.goto(`/prestations/${slug}/`);
      expect(response?.status()).toBe(200);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveCount(1);
      // h1 orienté mot-clé (`heroTitle`) : jamais le seul nom de la prestation.
      await expect(h1).not.toHaveText(/^(Formule \S+|Meuble sur mesure 3D|Offre Professionnels)$/);
      await expect(h1).toContainText('3D');
      expectNoHeadingJump(await headingLevels(page));
    });

    test(`/prestations/${slug}/ : « Pour aller plus loin » vers 1 article et 1 réalisation`, async ({
      page,
    }) => {
      await page.goto(`/prestations/${slug}/`);
      const further = page.locator('#plus-loin-titre').locator('xpath=ancestor::section[1]');
      await expect(further.locator('#plus-loin-titre')).toHaveText(
        microcopy.services.further.heading,
      );
      const hrefs = await further
        .locator('a')
        .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs).toHaveLength(2);
      expect(hrefs[0]).toMatch(/^\/conseils-deco\/[a-z0-9-]+\/$/);
      expect(hrefs[1]).toMatch(/^\/realisations\/[a-z0-9-]+\/$/);
    });
  }

  test.describe('PageLayout et Breadcrumbs (formule Confort)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/prestations/confort/');
    });

    test('fil d’Ariane visible : Accueil › Prestations › page courante', async ({ page }) => {
      const nav = page.getByRole('navigation', { name: microcopy.nav.breadcrumb });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('listitem')).toHaveText([
        microcopy.home,
        microcopy.services.indexLabel,
        'Formule Confort',
      ]);
      await expect(nav.getByRole('link')).toHaveCount(2);
      const current = nav.locator('[aria-current="page"]');
      await expect(current).toHaveText('Formule Confort');
      await expect(current).not.toHaveAttribute('href');
    });

    test('BreadcrumbList JSON-LD identique au fil visible', async ({ page }) => {
      const graph = await readGraph(page);
      const list = graph.find((node) => node['@type'] === 'BreadcrumbList');
      expect(list).toBeDefined();
      const items = list?.['itemListElement'] as {
        position: number;
        name: string;
        item: string;
      }[];
      expect(items).toEqual([
        { '@type': 'ListItem', position: 1, name: microcopy.home, item: `${SITE_ORIGIN}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: microcopy.services.indexLabel,
          item: `${SITE_ORIGIN}/prestations/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Formule Confort',
          item: `${SITE_ORIGIN}/prestations/confort/`,
        },
      ]);
      const visible = await page
        .getByRole('navigation', { name: microcopy.nav.breadcrumb })
        .getByRole('listitem')
        .allTextContents();
      expect(items.map((item) => item.name)).toEqual(visible.map((text) => text.trim()));
    });

    test('Service JSON-LD sans offre, rattaché à l’entreprise', async ({ page }) => {
      const graph = await readGraph(page);
      const service = graph.find((node) => node['@type'] === 'Service');
      expect(service).toMatchObject({
        name: 'Formule Confort',
        url: `${SITE_ORIGIN}/prestations/confort/`,
        provider: { '@id': `${SITE_ORIGIN}/#entreprise` },
      });
      expect(service).not.toHaveProperty('offers');
    });

    test('carte « En bref » avec action vers le contact, autres formules liées', async ({
      page,
    }) => {
      const facts = page.getByRole('complementary', { name: microcopy.services.facts.label });
      await expect(facts).toBeVisible();
      await expect(facts.getByRole('link')).toHaveAttribute('href', '/contact/');
      const others = page.locator('#autres-formules-titre').locator('xpath=ancestor::section[1]');
      const hrefs = await others
        .locator('ul a')
        .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual([
        '/prestations/essentiel/',
        '/prestations/signature/',
        '/prestations/studio/',
      ]);
    });

    test('0 violation axe', async ({ page }) => {
      await expectNoAxeViolations(page);
    });
  });
});
