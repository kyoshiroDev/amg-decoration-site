import { describe, expect, it } from 'vitest';
import { articleLastmod, buildLastmodMap } from '@/lib/sitemap-lastmod';

const ORIGIN = 'https://amgdecorationdinterieur.com';
const fm = (lines: string): string => `---\n${lines}\n---\n\nCorps de l’article.\n`;

describe('articleLastmod', () => {
  it('prend la date de mise à jour, sinon celle de publication', () => {
    expect(articleLastmod(fm('publishedAt: 2026-11-18\nupdatedAt: 2026-12-02'))).toBe('2026-12-02');
    expect(articleLastmod(fm("title: 'X'\npublishedAt: '2026-11-18' # commentaire"))).toBe(
      '2026-11-18',
    );
  });

  it('n’invente rien : ni brouillon, ni date absente ou mal formée', () => {
    expect(articleLastmod(fm('publishedAt: 2026-11-18\ndraft: true'))).toBeUndefined();
    expect(articleLastmod(fm("title: 'Sans date'"))).toBeUndefined();
    expect(articleLastmod(fm('publishedAt: bientôt'))).toBeUndefined();
    expect(articleLastmod('publishedAt: 2026-11-18')).toBeUndefined();
  });

  it('ignore une clé imbriquée ou présente dans le corps', () => {
    const source = `${fm('seo:\n  updatedAt: 2027-01-01\npublishedAt: 2026-11-18')}updatedAt: 2028-01-01\n`;
    expect(articleLastmod(source)).toBe('2026-11-18');
  });
});

describe('buildLastmodMap', () => {
  it('date chaque article publié et l’index au plus récent', () => {
    const map = buildLastmodMap(
      [
        { slug: 'ancien', source: fm('publishedAt: 2026-01-10') },
        { slug: 'recent', source: fm('publishedAt: 2026-03-01\nupdatedAt: 2026-05-02') },
        { slug: 'brouillon', source: fm('publishedAt: 2027-01-01\ndraft: true') },
      ],
      ORIGIN,
    );
    expect(Object.fromEntries(map)).toEqual({
      'https://amgdecorationdinterieur.com/conseils-deco/ancien/': '2026-01-10',
      'https://amgdecorationdinterieur.com/conseils-deco/recent/': '2026-05-02',
      'https://amgdecorationdinterieur.com/conseils-deco/': '2026-05-02',
    });
  });

  it('reste vide sans article publié', () => {
    expect(buildLastmodMap([], ORIGIN).size).toBe(0);
  });
});
