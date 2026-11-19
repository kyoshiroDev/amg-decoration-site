/**
 * Données structurées de toutes les pages publiques et de /merci/, lues dans le HTML final
 * (`dist/`), sans navigateur : le JSON-LD est statique. docs/SEO-STRATEGIE.md §4.
 */
import { access, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  checkAuthorVisible,
  checkGraphStructure,
  checkRequiredProperties,
  collectAssetPaths,
  parseGraph,
  type PageGraph,
} from './jsonld-assert';

const DIST = new URL('../../dist/', import.meta.url);

async function sitemapPaths(): Promise<string[]> {
  const xml = await readFile(new URL('sitemap-0.xml', DIST), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1] ?? '').pathname);
}

async function readPages(): Promise<{
  pages: (PageGraph & { html: string })[];
  problems: string[];
}> {
  const paths = [...(await sitemapPaths()), '/merci/'];
  const problems: string[] = [];
  const pages: (PageGraph & { html: string })[] = [];
  for (const path of paths) {
    const html = await readFile(new URL(`.${path}index.html`, DIST), 'utf8');
    const parsed = parseGraph(path, html);
    problems.push(...parsed.problems);
    if (parsed.problems.length === 0) pages.push({ path, graph: parsed.graph, html });
  }
  return { pages, problems };
}

test.describe('Données structurées (JSON-LD)', { tag: '@desktop' }, () => {
  test('un seul graphe schema.org parsable par page', async () => {
    const { pages, problems } = await readPages();
    expect(problems).toEqual([]);
    expect(pages.length).toBeGreaterThan(1);
  });

  test('types attendus par route, @id uniques et résolus, URL absolues', async () => {
    const { pages } = await readPages();
    expect(pages.flatMap(checkGraphStructure)).toEqual([]);
  });

  test('propriétés requises : BlogPosting, Service, CreativeWork, ItemList, BreadcrumbList', async () => {
    const { pages } = await readPages();
    expect(pages.flatMap(checkRequiredProperties)).toEqual([]);
  });

  test('images /_astro/ du JSON-LD présentes dans dist', async () => {
    const { pages } = await readPages();
    const missing: string[] = [];
    for (const { path, graph } of pages) {
      for (const asset of collectAssetPaths(graph)) {
        await access(new URL(`.${asset}`, DIST)).catch(() => missing.push(`${path} → ${asset}`));
      }
    }
    expect(missing).toEqual([]);
  });

  test('auteur des articles visible dans le <main>, lié à sa page de présentation', async () => {
    const { pages } = await readPages();
    const articles = pages.filter(({ graph }) =>
      graph.some((node) => node['@type'] === 'BlogPosting'),
    );
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.flatMap((page) => checkAuthorVisible(page, page.html))).toEqual([]);
  });
});
