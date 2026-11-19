import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import type { ProjectEntryLike, ServiceEntryLike } from '@/lib/cards';
import { ContentError } from '@/lib/content';
import type { ArticleEntryLike } from '@/lib/pages/articles-model';
import { resolveFurtherLinks, type FurtherSources } from '@/lib/pages/further-links';
import type { PageSection } from '@/lib/pages/types';

const image = { src: '/x.jpg', width: 1600, height: 2000, format: 'jpg' } as ImageMetadata;

const article = (id: string, draft = false): ArticleEntryLike => ({
  id,
  data: {
    title: `Article ${id}`,
    publishedAt: new Date('2026-11-18'),
    cover: { image, alt: 'Salon' },
    tags: [],
    draft,
    seo: { title: 'T', description: `Description ${id}` },
  },
});

const meuble: ServiceEntryLike = {
  id: 'meuble-sur-mesure',
  data: {
    title: 'Meuble sur mesure 3D',
    kind: 'offre',
    tagline: 'Sur mesure',
    summary: 'Résumé meuble',
    highlight: false,
    order: 5,
  },
};

const chalet: ProjectEntryLike = {
  id: 'chalet-suisse',
  data: {
    title: 'Chalet en Suisse',
    summary: 'Au cœur des Alpes',
    style: 'Chalet',
    cover: { image, alt: 'Pièce de vie' },
    featured: true,
    order: 1,
  },
};

const sources: FurtherSources = {
  articles: [article('plan-3d'), article('brouillon', true)],
  prestations: [meuble],
  projets: [chalet],
};

const section = (links: NonNullable<PageSection['links']>): PageSection => ({
  heading: 'Pour aller plus loin',
  items: [],
  actions: [],
  links,
});

describe('resolveFurtherLinks', () => {
  it('garde l’ordre du contenu, le libellé en surtitre et les textes de la collection', () => {
    const items = resolveFurtherLinks(
      section([
        { label: 'À lire', href: '/conseils-deco/plan-3d/' },
        { label: 'Une réalisation', href: '/realisations/chalet-suisse/' },
        { label: 'Votre meuble', href: '/prestations/meuble-sur-mesure/' },
      ]),
      sources,
      'visualisation-3d',
    );
    expect(items).toEqual([
      {
        kind: 'article',
        eyebrow: 'À lire',
        title: 'Article plan-3d',
        text: 'Description plan-3d',
        href: '/conseils-deco/plan-3d/',
      },
      {
        kind: 'project',
        eyebrow: 'Une réalisation',
        title: 'Chalet en Suisse',
        text: 'Au cœur des Alpes',
        href: '/realisations/chalet-suisse/',
      },
      {
        kind: 'service',
        eyebrow: 'Votre meuble',
        title: 'Meuble sur mesure 3D',
        text: 'Résumé meuble',
        href: '/prestations/meuble-sur-mesure/',
      },
    ]);
  });

  it('refuse un article brouillon ou une adresse inconnue', () => {
    for (const href of ['/conseils-deco/brouillon/', '/prestations/inconnue/'] as const) {
      expect(() =>
        resolveFurtherLinks(section([{ label: 'X', href }]), sources, 'visualisation-3d'),
      ).toThrow(ContentError);
    }
  });
});
