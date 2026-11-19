import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import type { ProjectEntryLike, ServiceEntryLike } from '@/lib/cards';
import { ContentError } from '@/lib/content';
import {
  buildArticlePageModel,
  buildArticlesIndexModel,
  buildByline,
  buildFurtherReading,
  formatArticleDate,
  selectPublishedArticles,
  toArticleCard,
  type ArticleEntryLike,
  type ArticleLabels,
} from '@/lib/pages/articles-model';
import type { PageSection } from '@/lib/pages/types';

const NBSP = '\u00A0';
const image = { src: '/x.jpg', width: 1600, height: 2000, format: 'jpg' } as ImageMetadata;
const READING = `{minutes}${NBSP}min de lecture`;

const labels: ArticleLabels = {
  home: 'Accueil',
  indexLabel: 'Conseils déco',
  readingTime: READING,
  further: { service: 'La formule', project: 'La réalisation', article: 'À lire aussi' },
};

function article(
  id: string,
  publishedAt: string,
  overrides: Partial<ArticleEntryLike['data']> = {},
): ArticleEntryLike {
  return {
    id,
    body: 'Un texte court.',
    data: {
      title: `Article ${id}`,
      publishedAt: new Date(publishedAt),
      cover: { image, alt: 'Salon lumineux' },
      tags: ['Couleurs'],
      draft: false,
      seo: { title: `SEO ${id}`, description: `Description ${id}` },
      ...overrides,
    },
  };
}

const section = (heading: string): PageSection => ({ heading, items: [], actions: [] });

const signature: ServiceEntryLike = {
  id: 'signature',
  data: {
    title: 'Signature',
    kind: 'formule',
    tagline: 'pour tout un logement',
    summary: 'Résumé de la formule',
    highlight: false,
    order: 3,
  },
};

const chalet: ProjectEntryLike = {
  id: 'chalet-suisse',
  data: {
    title: 'Chalet en Suisse',
    summary: 'Au cœur des Alpes',
    style: 'Chalet',
    cover: { image, alt: 'Pièce de vie boisée' },
    featured: true,
    order: 1,
  },
};

describe('formatArticleDate', () => {
  it('formate en français sans décalage horaire', () => {
    expect(formatArticleDate(new Date('2026-11-18'))).toEqual({
      iso: '2026-11-18',
      label: `18${NBSP}novembre 2026`,
    });
  });

  it('écrit le premier du mois en ordinal', () => {
    expect(formatArticleDate(new Date('2026-12-01')).label).toBe(
      `1\u1D49\u02B3${NBSP}décembre 2026`,
    );
  });
});

describe('selectPublishedArticles', () => {
  it('retire les brouillons et trie du plus récent au plus ancien', () => {
    const result = selectPublishedArticles([
      article('ancien', '2026-01-10'),
      article('brouillon', '2026-12-01', { draft: true }),
      article('recent', '2026-11-18'),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['recent', 'ancien']);
  });
});

describe('toArticleCard', () => {
  it('prend la meta description comme extrait et calcule le temps de lecture', () => {
    const card = toArticleCard(article('a', '2026-11-18'), READING);
    expect(card).toMatchObject({
      href: '/conseils-deco/a/',
      excerpt: 'Description a',
      readingTime: `1${NBSP}min de lecture`,
      published: { iso: '2026-11-18' },
    });
  });
});

describe('buildArticlesIndexModel', () => {
  it('n’expose jamais un brouillon', () => {
    const model = buildArticlesIndexModel({
      page: {
        seo: { title: 'Conseils', description: 'Description' },
        hero: section('Conseils déco'),
        sections: { cta: section('Envie d’aller plus loin ?') },
      },
      articles: [
        article('a', '2026-11-18'),
        article('modele-article', '2026-11-18', { draft: true }),
      ],
      readingTemplate: READING,
      labels: { home: 'Accueil', indexLabel: 'Conseils déco' },
    });
    expect(model.articles.map((card) => card.slug)).toEqual(['a']);
    expect(model.breadcrumbs.at(-1)?.href).toBe('/conseils-deco/');
  });

  it('prend la couverture du premier article publié comme image Open Graph', () => {
    const recent = { src: '/r.jpg', width: 1600, height: 1200, format: 'jpg' } as ImageMetadata;
    const page = {
      seo: { title: 'Conseils', description: 'Description' },
      hero: section('Conseils déco'),
      sections: { cta: section('Envie d’aller plus loin ?') },
    };
    const model = buildArticlesIndexModel({
      page,
      articles: [
        article('ancien', '2026-01-10'),
        article('recent', '2026-11-18', { cover: { image: recent, alt: 'Studio en 3D' } }),
        article('brouillon', '2026-12-01', { draft: true }),
      ],
      readingTemplate: READING,
      labels: { home: 'Accueil', indexLabel: 'Conseils déco' },
    });
    expect(model.ogImage).toEqual({ image: recent, alt: 'Studio en 3D' });
    const empty = buildArticlesIndexModel({
      page,
      articles: [],
      readingTemplate: READING,
      labels: { home: 'Accueil', indexLabel: 'Conseils déco' },
    });
    expect(empty.ogImage).toBeUndefined();
  });
});

describe('buildFurtherReading', () => {
  const entry = article('a', '2026-11-18', {
    relatedService: { id: 'signature' },
    relatedProject: { id: 'chalet-suisse' },
  });

  it('propose la formule, la réalisation, puis un autre article publié', () => {
    const items = buildFurtherReading({
      entry,
      articles: [
        entry,
        article('brouillon', '2026-12-01', { draft: true }),
        article('b', '2026-10-01'),
      ],
      prestations: [signature],
      projets: [chalet],
      labels,
    });
    expect(items.map((item) => [item.kind, item.href])).toEqual([
      ['service', '/prestations/signature/'],
      ['project', '/realisations/chalet-suisse/'],
      ['article', '/conseils-deco/b/'],
    ]);
  });

  it('échoue sur une référence introuvable', () => {
    expect(() =>
      buildFurtherReading({ entry, articles: [entry], prestations: [], projets: [chalet], labels }),
    ).toThrow(ContentError);
  });
});

describe('buildArticlePageModel', () => {
  it('n’affiche la mise à jour que si elle diffère de la publication', () => {
    const same = article('a', '2026-11-18', { updatedAt: new Date('2026-11-18') });
    const later = article('b', '2026-11-18', { updatedAt: new Date('2027-01-05') });
    const input = { articles: [same, later], prestations: [], projets: [], labels };
    expect(buildArticlePageModel({ ...input, entry: same }).updated).toBeUndefined();
    const model = buildArticlePageModel({ ...input, entry: later });
    expect(model.updated?.iso).toBe('2027-01-05');
    expect(model.breadcrumbs.map((item) => item.href)).toEqual([
      '/',
      '/conseils-deco/',
      '/conseils-deco/b/',
    ]);
  });

  it('refuse de construire la page d’un brouillon', () => {
    const draft = article('modele-article', '2026-11-18', { draft: true });
    expect(() =>
      buildArticlePageModel({
        entry: draft,
        articles: [draft],
        prestations: [],
        projets: [],
        labels,
      }),
    ).toThrow(ContentError);
  });
});

describe('buildByline', () => {
  it('signe avec le nom et le métier de la fondatrice, liés à sa page de présentation', () => {
    expect(
      buildByline({ name: 'Amandine Gaury', jobTitle: 'Designer d’intérieur' }, 'Par'),
    ).toEqual({
      prefix: 'Par',
      name: 'Amandine Gaury',
      role: 'designer d’intérieur',
      href: '/a-propos/',
    });
  });
});
