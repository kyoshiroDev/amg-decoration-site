import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { resolveRedirect } from '../../src/lib/redirects';
import { NOT_FOUND_PATH, readJpegSize } from './helpers';

const SITE_ORIGIN = 'https://amgdecorationdinterieur.com';
const DIST = new URL('../../dist/', import.meta.url);
const SITEMAP_FILE = new URL('sitemap-0.xml', DIST);

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

// ---------------------------------------------------------------------------------------------
// Toutes les pages : métadonnées, JSON-LD, maillage interne (docs/SEO-STRATEGIE.md §2, §4).
// Le parcours complet ne tourne que sur le projet desktop (le HTML est identique en mobile).
// ---------------------------------------------------------------------------------------------

/** Pages non indexables, absentes du sitemap mais crawlées pour leurs liens. */
const NOINDEX_PATHS = ['/merci/', '/styleguide/', NOT_FOUND_PATH] as const;

/** Types JSON-LD propres à chaque gabarit de page (en plus de WebSite, ProfessionalService, Person). */
function expectedPageTypes(path: string): string[] {
  if (path === '/') return [];
  const types = ['BreadcrumbList'];
  if (['/prestations/', '/realisations/', '/conseils-deco/'].includes(path)) {
    types.push('CollectionPage');
  } else if (path.startsWith('/realisations/')) types.push('CreativeWork');
  else if (path.startsWith('/conseils-deco/')) types.push('BlogPosting');
  else if (path.startsWith('/prestations/') && path !== '/prestations/') types.push('Service');
  else if (path === '/a-propos/') types.push('AboutPage');
  else if (path === '/contact/') types.push('ContactPage');
  return types;
}

async function sitemapPaths(): Promise<string[]> {
  const xml = await readFile(SITEMAP_FILE, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
}

/** Chemin interne d'un lien (domaine de production ou serveur local), ou `null` s'il est externe. */
function internalPath(href: string, base: string): URL | null {
  if (/^(mailto|tel|sms):/i.test(href)) return null;
  const url = new URL(href, base);
  const local = new URL(base).origin;
  if (url.origin !== local && url.origin !== SITE_ORIGIN) return null;
  return url;
}

interface CrawledPage {
  readonly path: string;
  readonly links: readonly string[];
}

async function collectLinks(page: Page, path: string): Promise<CrawledPage> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${path} doit répondre`).toBe(path === NOT_FOUND_PATH ? 404 : 200);
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
  return { path, links: hrefs };
}

async function statusOf(request: APIRequestContext, path: string): Promise<number> {
  const response = await request.get(path, { maxRedirects: 0 });
  return response.status();
}

test.describe('SEO de toutes les pages', { tag: '@desktop' }, () => {
  // Chaque test parcourt les 22 pages publiques : délai élargi, chargement limité au DOM.
  test.describe.configure({ timeout: 120_000 });

  test('le sitemap liste toutes les pages publiques et aucune page noindex', async () => {
    const paths = await sitemapPaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.endsWith('/'), `${path} : slash final`).toBe(true);
      expect(resolveRedirect(path), `${path} ne doit pas être redirigée`).toBeNull();
    }
    for (const path of NOINDEX_PATHS) expect(paths).not.toContain(path);
  });

  test('title, description et canonical uniques ; un h1 ; JSON-LD du gabarit', async ({ page }) => {
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();
    for (const path of await sitemapPaths()) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      const description = await metaContent(page, 'meta[name="description"]');
      expect(nfcLength(title), `${path} : title`).toBeLessThanOrEqual(60);
      expect(nfcLength(description), `${path} : description`).toBeGreaterThanOrEqual(140);
      expect(nfcLength(description), `${path} : description`).toBeLessThanOrEqual(160);
      expect(titles.get(title), `title dupliqué : « ${title} »`).toBeUndefined();
      expect(descriptions.get(description), `description dupliquée`).toBeUndefined();
      titles.set(title, path);
      descriptions.set(description, path);

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE_ORIGIN}${path}`,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        `${SITE_ORIGIN}${path}`,
      );
      const isArticle = path.startsWith('/conseils-deco/') && path !== '/conseils-deco/';
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
        'content',
        isArticle ? 'article' : 'website',
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      const graph = await readGraph(page);
      const types = graph.map((node) => node['@type']);
      expect(types.slice(0, 3)).toEqual(['WebSite', 'ProfessionalService', 'Person']);
      expect(types.slice(3).sort(), `${path} : types JSON-LD`).toEqual(
        expectedPageTypes(path).sort(),
      );
    }
  });

  test('og:image de chaque page : JPEG 1200 × 630 présent dans dist, absolu, avec texte alternatif', async () => {
    for (const path of await sitemapPaths()) {
      const html = await readFile(new URL(`.${path}index.html`, DIST), 'utf8');
      const meta = (property: string): string =>
        new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html)?.[1] ?? '';
      const ogImage = meta('og:image');
      expect(ogImage.startsWith(`${SITE_ORIGIN}/_astro/`), `${path} : og:image absolue`).toBe(true);
      expect(meta('og:image:width'), `${path} : og:image:width`).toBe('1200');
      expect(meta('og:image:height'), `${path} : og:image:height`).toBe('630');
      expect(meta('og:image:alt'), `${path} : og:image:alt`).toMatch(/\S/);
      const file = await readFile(new URL(`.${new URL(ogImage).pathname}`, DIST));
      expect(readJpegSize(file), `${path} : dimensions réelles de ${ogImage}`).toEqual({
        width: 1200,
        height: 630,
      });
    }
  });

  test('balises article:* sur les articles seulement, aux dates du JSON-LD BlogPosting', async ({
    page,
  }) => {
    for (const path of await sitemapPaths()) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const articleMeta = page.locator('meta[property^="article:"]');
      const isArticle = path.startsWith('/conseils-deco/') && path !== '/conseils-deco/';
      if (!isArticle) {
        await expect(articleMeta, `${path} : aucune balise article:*`).toHaveCount(0);
        continue;
      }
      const posting = nodeOfType(await readGraph(page), 'BlogPosting');
      await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
        'content',
        String(posting['datePublished']),
      );
      await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute(
        'content',
        String(posting['dateModified']),
      );
    }
  });

  test('BreadcrumbList identique au fil d’Ariane visible sur chaque page interne', async ({
    page,
  }) => {
    for (const path of (await sitemapPaths()).filter((p) => p !== '/')) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const graph = await readGraph(page);
      const list = nodeOfType(graph, 'BreadcrumbList');
      const items = list['itemListElement'] as { name: string; item: string }[];
      const nav = page.getByRole('navigation', { name: microcopy.nav.breadcrumb });
      const visible = (await nav.getByRole('listitem').allTextContents()).map((t) => t.trim());
      expect(
        items.map((item) => item.name),
        `${path} : noms du fil`,
      ).toEqual(visible);
      expect(items.at(-1)?.item, `${path} : dernier élément = page courante`).toBe(
        `${SITE_ORIGIN}${path}`,
      );
      const hrefs = await nav
        .getByRole('link')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(items.slice(0, -1).map((item) => new URL(item.item).pathname)).toEqual(hrefs);
    }
  });

  test('liens internes : 200, slash final, aucune ancienne URL ; aucune page orpheline', async ({
    page,
    request,
    baseURL,
  }) => {
    const base = baseURL ?? 'http://localhost:4321';
    const pages = [...(await sitemapPaths()), ...NOINDEX_PATHS];
    const statuses = new Map<string, number>();
    const linkedFrom = new Map<string, Set<string>>();
    const problems: string[] = [];

    for (const path of pages) {
      const crawled = await collectLinks(page, path);
      for (const href of crawled.links) {
        const url = internalPath(href, new URL(path, base).href);
        if (!url) continue;
        const target = url.pathname;
        if (href.startsWith('#')) {
          const id = decodeURIComponent(url.hash.slice(1));
          if (id && (await page.locator(`[id="${id}"]`).count()) === 0) {
            problems.push(`${path} → ${href} : ancre absente`);
          }
          continue;
        }
        if (!target.endsWith('/') && !/\.[a-z0-9]+$/i.test(target)) {
          problems.push(`${path} → ${href} : slash final manquant`);
        }
        if (resolveRedirect(target) !== null) {
          problems.push(`${path} → ${href} : URL redirigée (ancienne URL ou sans slash)`);
        }
        if (!statuses.has(target)) statuses.set(target, await statusOf(request, target));
        if (statuses.get(target) !== 200) {
          problems.push(`${path} → ${href} : HTTP ${String(statuses.get(target))}`);
        }
        if (target !== path) {
          const sources = linkedFrom.get(target) ?? new Set<string>();
          sources.add(path);
          linkedFrom.set(target, sources);
        }
      }
    }
    expect(problems).toEqual([]);

    const orphans = (await sitemapPaths()).filter(
      (path) => (linkedFrom.get(path)?.size ?? 0) === 0,
    );
    expect(orphans, 'pages publiques liées depuis aucune autre page').toEqual([]);
  });
});
