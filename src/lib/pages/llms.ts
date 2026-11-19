/**
 * Données du fichier /llms.txt : lit src/config/site.ts et les collections, puis délègue
 * l'assemblage à ./llms-model.ts et la mise en forme à ../crawlers.ts (fonctions pures).
 */
import { getCollection } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import { buildLlmsTxt } from '../crawlers';
import { buildLlmsModel, toLlmsPages } from './llms-model';
import { getPageData } from './page';

/** Identifiant de la page (collection `pages`) servie à un chemin : `/` → `accueil`. */
function pageIdOf(href: string): string {
  return href === '/' ? 'accueil' : href.replaceAll('/', '');
}

/** Meta descriptions des pages fixes, indexées par chemin. */
async function readDescriptions(hrefs: readonly string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    hrefs.map(async (href) => [href, (await getPageData(pageIdOf(href))).seo.description] as const),
  );
  return Object.fromEntries(entries);
}

export async function getLlmsTxt(origin: URL): Promise<string> {
  const fixedPages = [...site.mainNav, ...site.legalNav];
  const [descriptions, prestations, projets, articles] = await Promise.all([
    readDescriptions(fixedPages.map((page) => page.href)),
    getCollection('prestations'),
    getCollection('projets'),
    getCollection('articles'),
  ]);
  return buildLlmsTxt(
    buildLlmsModel({
      site,
      origin,
      labels: microcopy.llms,
      mainPages: toLlmsPages(site.mainNav, descriptions),
      legalPages: toLlmsPages(site.legalNav, descriptions),
      prestations,
      projets,
      articles,
    }),
  );
}
