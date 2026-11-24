/**
 * Données du blog « Conseils déco » (src/pages/conseils-deco/) : lit les collections puis délègue
 * la mise en forme aux fonctions pures de ./articles-model.ts. Les brouillons n'ont ni carte ni
 * route : `getArticlePaths` ne parcourt que les articles publiés (donc absents du sitemap).
 */
import { getImage } from 'astro:assets';
import { getCollection, render } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { requireSection } from '../content';
import { buildCollectionPage, webPageInputFrom } from '../jsonld';
import { getPageData } from './page';
import type { PageSection, WithJsonLd } from './types';
import {
  buildArticlePageModel,
  buildArticlesIndexModel,
  selectPublishedArticles,
  type ArticlePageModel,
  type ArticlesIndexModel,
} from './articles-model';

/** Largeur de l'image publiée dans le JSON-LD (Google recommande ≥ 1200 px). */
const JSON_LD_IMAGE_WIDTH = 1200;

/** Index du blog ; JSON-LD `CollectionPage` listant les articles publiés dans l'ordre affiché. */
export async function getArticlesIndexData(origin: URL): Promise<WithJsonLd<ArticlesIndexModel>> {
  const [page, articles] = await Promise.all([
    getPageData('conseils-deco'),
    getCollection('articles'),
  ]);
  const model = buildArticlesIndexModel({
    page,
    articles,
    readingTemplate: microcopy.articles.readingTime,
    labels: { home: microcopy.home, indexLabel: microcopy.articles.indexLabel },
  });
  const items = model.articles.map((article) => ({ name: article.title, path: article.href }));
  return {
    ...model,
    jsonLd: [buildCollectionPage({ ...webPageInputFrom(model), items }, origin)],
  };
}

export interface ArticlePageProps {
  readonly article: ArticlePageModel;
  /** Visuel pour le JSON-LD `BlogPosting` (URL relative, rendue absolue par le layout). */
  readonly imageUrl: string;
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
  /** Appel à l'action de fin d'article, partagé avec l'index (src/content/pages/conseils-deco.md). */
  readonly cta: PageSection;
}

/** Chemins statiques de `/conseils-deco/<slug>/`, articles publiés uniquement. */
export async function getArticlePaths(): Promise<
  { params: { slug: string }; props: ArticlePageProps }[]
> {
  const [articles, prestations, projets, page] = await Promise.all([
    getCollection('articles'),
    getCollection('prestations'),
    getCollection('projets'),
    getPageData('conseils-deco'),
  ]);
  const cta = requireSection(page.sections, 'cta', 'conseils-deco');
  const labels = {
    home: microcopy.home,
    indexLabel: microcopy.articles.indexLabel,
    readingTime: microcopy.articles.readingTime,
    further: microcopy.articles.further,
  };
  return Promise.all(
    selectPublishedArticles(articles).map(async (entry) => {
      const cover = entry.data.cover.image;
      const [{ Content }, image] = await Promise.all([
        render(entry),
        getImage({ src: cover, width: Math.min(JSON_LD_IMAGE_WIDTH, cover.width), format: 'jpg' }),
      ]);
      const article = buildArticlePageModel({ entry, articles, prestations, projets, labels });
      return { params: { slug: entry.id }, props: { article, imageUrl: image.src, Content, cta } };
    }),
  );
}
