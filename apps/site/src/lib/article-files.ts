/**
 * Lecture des sources des articles sur le disque (Node uniquement) : pour les outils qui
 * tournent hors des collections Astro (astro.config.mjs pour le sitemap, les routes d'articles
 * de `siteRoutes()`, assemblées par tests/site-routes.ts). Sans alias d'import : chargé avant la configuration de Vite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { articlePath, type ArticlePath } from './routes';
import { isPublishedSource, type ArticleSource } from './sitemap-lastmod';

const ARTICLES_DIR = new URL('../content/articles/', import.meta.url);
const ARTICLE_FILE = /\.mdx?$/;

/** Tous les articles (brouillons compris), triés par slug. */
export function readArticleSources(): ArticleSource[] {
  return readdirSync(ARTICLES_DIR)
    .filter((file) => ARTICLE_FILE.test(file))
    .sort()
    .map((file) => ({
      slug: file.replace(ARTICLE_FILE, ''),
      source: readFileSync(new URL(file, ARTICLES_DIR), 'utf8'),
    }));
}

/** Routes des articles publiés (`/conseils-deco/<slug>/`) : les brouillons n'ont pas de page. */
export function publishedArticleRoutes(
  sources: readonly ArticleSource[] = readArticleSources(),
): ArticlePath[] {
  return sources
    .filter(({ source }) => isPublishedSource(source))
    .map(({ slug }) => articlePath(slug));
}
