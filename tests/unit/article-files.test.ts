import { describe, expect, it } from 'vitest';
import { publishedArticleRoutes, readArticleSources } from '@/lib/article-files';

describe('readArticleSources', () => {
  it('lit les fichiers .md/.mdx de src/content/articles/, brouillons compris', () => {
    const slugs = readArticleSources().map(({ slug }) => slug);
    expect(slugs).toContain('modele-article');
    expect(slugs).toContain('plan-3d-avant-renovation');
  });
});

describe('publishedArticleRoutes', () => {
  it('écarte les brouillons et produit des routes à slash final', () => {
    expect(
      publishedArticleRoutes([
        { slug: 'publie', source: '---\npublishedAt: 2026-11-18\n---\n' },
        { slug: 'brouillon', source: '---\ndraft: true\n---\n' },
      ]),
    ).toEqual(['/conseils-deco/publie/']);
  });
});
