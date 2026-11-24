import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import type { ArticleEntryLike } from '@/lib/pages/articles-model';
import {
  buildServiceFurtherReading,
  type ServiceProjectEntryLike,
} from '@/lib/pages/services-model';

const image = { src: '/x.jpg', width: 1600, height: 2000, format: 'jpg' } as ImageMetadata;
const labels = { article: 'À lire', project: 'Une réalisation' };

function article(
  id: string,
  publishedAt: string,
  overrides: Partial<ArticleEntryLike['data']> = {},
): ArticleEntryLike {
  return {
    id,
    data: {
      title: `Article ${id}`,
      publishedAt: new Date(publishedAt),
      cover: { image, alt: 'Salon lumineux' },
      tags: [],
      draft: false,
      seo: { title: `SEO ${id}`, description: `Description ${id}` },
      ...overrides,
    },
  };
}

function project(id: string, order: number, service?: string): ServiceProjectEntryLike {
  return {
    id,
    data: {
      title: `Projet ${id}`,
      summary: `Résumé ${id}`,
      style: 'Contemporain',
      cover: { image, alt: 'Pièce de vie' },
      featured: false,
      order,
      ...(service ? { service: { id: service } } : {}),
    },
  };
}

const articles = [
  article('ancien', '2026-01-10', {
    relatedService: { id: 'signature' },
    relatedProject: { id: 'sous-sol' },
  }),
  article('recent', '2026-05-02', { relatedService: { id: 'confort' } }),
  article('brouillon', '2026-12-01', { draft: true, relatedService: { id: 'studio' } }),
];
const projets = [project('chalet', 1), project('sous-sol', 2), project('scandinave', 3)];

describe('buildServiceFurtherReading', () => {
  it('retient l’article qui renvoie vers la prestation et la réalisation qu’il lui associe', () => {
    expect(buildServiceFurtherReading({ slug: 'signature', articles, projets, labels })).toEqual([
      {
        kind: 'article',
        eyebrow: 'À lire',
        title: 'Article ancien',
        text: 'Description ancien',
        href: '/conseils-deco/ancien/',
      },
      {
        kind: 'project',
        eyebrow: 'Une réalisation',
        title: 'Projet sous-sol',
        text: 'Résumé sous-sol',
        href: '/realisations/sous-sol/',
      },
    ]);
  });

  it('se replie sur l’article publié le plus récent et la première réalisation, sans brouillon', () => {
    const items = buildServiceFurtherReading({ slug: 'studio', articles, projets, labels });
    expect(items.map((item) => item.href)).toEqual([
      '/conseils-deco/recent/',
      '/realisations/chalet/',
    ]);
  });

  it('préfère la réalisation dont la formule est renseignée', () => {
    const withService = [...projets, project('studio-paris', 9, 'studio')];
    const items = buildServiceFurtherReading({
      slug: 'studio',
      articles,
      projets: withService,
      labels,
    });
    expect(items[1]?.href).toBe('/realisations/studio-paris/');
  });

  it('ne renvoie rien quand il n’y a ni article publié ni réalisation', () => {
    expect(
      buildServiceFurtherReading({
        slug: 'confort',
        articles: [article('brouillon', '2026-12-01', { draft: true })],
        projets: [],
        labels,
      }),
    ).toEqual([]);
  });
});
