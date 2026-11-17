import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { NOT_FOUND_PATH } from './helpers';

const SITE_ORIGIN = 'https://amgdecorationdinterieur.com';
const SITEMAP_FILE = new URL('../../dist/sitemap-0.xml', import.meta.url);

interface GraphNode {
  '@type': string;
  '@id'?: string;
  [key: string]: unknown;
}

/** Longueur perçue d'un texte : points de code après normalisation NFC. */
function nfcLength(text: string): number {
  return [...text.normalize('NFC')].length;
}

async function metaContent(page: Page, selector: string): Promise<string> {
  const content = await page.locator(selector).getAttribute('content');
  expect(content, `${selector} doit avoir un attribut content`).not.toBeNull();
  return content ?? '';
}

async function readGraph(page: Page): Promise<GraphNode[]> {
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  const raw = (await scripts.textContent()) ?? '';
  const data = JSON.parse(raw) as { '@context': string; '@graph': GraphNode[] };
  expect(data['@context']).toBe('https://schema.org');
  return data['@graph'];
}

function nodeOfType(graph: GraphNode[], type: string): GraphNode {
  const node = graph.find((item) => item['@type'] === type);
  expect(node, `nœud ${type} absent du @graph`).toBeDefined();
  return node as GraphNode;
}

test.describe('SEO de l’accueil', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('un seul JSON-LD dont le @graph relie WebSite, ProfessionalService et Person', async ({
    page,
  }) => {
    const graph = await readGraph(page);
    const website = nodeOfType(graph, 'WebSite');
    const business = nodeOfType(graph, 'ProfessionalService');
    const person = nodeOfType(graph, 'Person');

    for (const node of [website, business, person]) {
      expect(node['@id']).toMatch(new RegExp(`^${SITE_ORIGIN}/#`));
    }
    const ids = graph.map((node) => node['@id']);
    expect(new Set(ids).size).toBe(ids.length);

    expect(website['publisher']).toEqual({ '@id': business['@id'] });
    expect(business['founder']).toEqual({ '@id': person['@id'] });
    expect(person['worksFor']).toEqual({ '@id': business['@id'] });
  });

  test('canonical absolu vers l’accueil de production', async ({ page }) => {
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute('href', `${SITE_ORIGIN}/`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `${SITE_ORIGIN}/`,
    );
  });

  test('title ≤ 60 caractères et description de 140 à 160 caractères', async ({ page }) => {
    const title = await page.title();
    expect(nfcLength(title)).toBeGreaterThan(0);
    expect(nfcLength(title)).toBeLessThanOrEqual(60);

    const description = await metaContent(page, 'meta[name="description"]');
    expect(nfcLength(description)).toBeGreaterThanOrEqual(140);
    expect(nfcLength(description)).toBeLessThanOrEqual(160);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
  });

  test('og:image absolue, 1200 × 630, servie par le build', async ({ page }) => {
    const ogImage = await metaContent(page, 'meta[property="og:image"]');
    expect(ogImage.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1200',
    );
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      'content',
      '630',
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /\S/);

    // Le domaine de production est réécrit vers le serveur local de prévisualisation.
    const localPath = new URL(ogImage).pathname;
    const response = await page.request.get(localPath);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\//);

    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, localPath);
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  test('Open Graph et Twitter Card complets', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    const ogImage = await metaContent(page, 'meta[property="og:image"]');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', ogImage);
    const title = await page.title();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'fr_FR');
  });

  test('un seul h1 et une hiérarchie de titres sans saut', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const levels = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      const current = levels[i] ?? 0;
      const previous = levels[i - 1] ?? 0;
      expect(current, `saut de niveau : h${previous} puis h${current}`).toBeLessThanOrEqual(
        previous + 1,
      );
    }
  });
});

test.describe('SEO des pages non indexables', () => {
  test('la 404 répond 404, un h1, noindex et pas de canonical', async ({ page }) => {
    const response = await page.goto(NOT_FOUND_PATH);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });

  test('le styleguide est noindex et absent du sitemap', async ({ page }) => {
    const response = await page.goto('/styleguide/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

    const sitemap = await readFile(SITEMAP_FILE, 'utf8');
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(sitemap).not.toContain('/styleguide/');
    expect(sitemap).not.toContain('404');
  });

  test('sitemap-index.xml référence le sitemap des pages', async ({ request }) => {
    const index = await request.get('/sitemap-index.xml');
    expect(index.status()).toBe(200);
    expect(await index.text()).toContain(`${SITE_ORIGIN}/sitemap-0.xml`);
  });
});
