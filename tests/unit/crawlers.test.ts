import { describe, expect, it } from 'vitest';
import type { ImageMetadata } from 'astro';
import { site } from '@/config/site';
import { microcopy } from '@/config/microcopy';
import { buildLlmsTxt, buildRobotsTxt } from '@/lib/crawlers';
import { buildLlmsModel, toLlmsPages } from '@/lib/pages/llms-model';
import type { ArticleEntryLike } from '@/lib/pages/articles-model';

describe('buildRobotsTxt', () => {
  const robots = buildRobotsTxt({
    sitemapUrl: 'https://amgdecorationdinterieur.com/sitemap-index.xml',
  });

  it('autorise tout et déclare le sitemap en URL absolue', () => {
    expect(robots).toBe(
      [
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: https://amgdecorationdinterieur.com/sitemap-index.xml',
        '',
      ].join('\n'),
    );
  });

  it('ne contient aucune directive Disallow', () => {
    expect(robots).not.toMatch(/disallow/i);
  });

  it('refuse un sitemap relatif ou hors http(s)', () => {
    expect(() => buildRobotsTxt({ sitemapUrl: '/sitemap-index.xml' })).toThrow(/absolue/);
    expect(() => buildRobotsTxt({ sitemapUrl: 'ftp://exemple.fr/sitemap.xml' })).toThrow(/http/);
  });
});

describe('buildLlmsTxt', () => {
  const base = {
    name: 'AMG Décoration',
    summary: 'Votre intérieur\nen 3D.',
    details: ['Paragraphe factuel.'],
    sections: [
      {
        title: 'Prestations',
        links: [
          {
            title: 'Formule [Studio]',
            url: 'https://amgdecorationdinterieur.com/prestations/studio/',
            description: 'Petits espaces',
          },
        ],
      },
      { title: 'Vide', links: [] },
    ],
    optional: [{ title: 'Mentions légales', url: 'https://amgdecorationdinterieur.com/m/' }],
  } as const;

  it('suit la spécification : H1, citation, paragraphe, sections H2 de liens, Optional', () => {
    expect(buildLlmsTxt(base)).toBe(
      [
        '# AMG Décoration',
        '> Votre intérieur en 3D.',
        'Paragraphe factuel.',
        '## Prestations',
        '- [Formule \\[Studio\\]](https://amgdecorationdinterieur.com/prestations/studio/): Petits espaces',
        '## Optional',
        '- [Mentions légales](https://amgdecorationdinterieur.com/m/)',
      ].join('\n\n') + '\n',
    );
  });

  it('omet les sections vides et refuse un lien relatif ou un titre vide', () => {
    expect(buildLlmsTxt(base)).not.toContain('## Vide');
    expect(() =>
      buildLlmsTxt({ ...base, optional: [{ title: 'Relatif', url: '/mentions-legales/' }] }),
    ).toThrow(/absolue/);
    expect(() => buildLlmsTxt({ ...base, name: '  ' })).toThrow(/obligatoire/);
  });
});

describe('buildLlmsModel', () => {
  const origin = new URL('https://amgdecorationdinterieur.com');
  const image = { src: '/x.jpg', width: 1600, height: 1200, format: 'jpg' } as ImageMetadata;
  const article = (id: string, draft: boolean): ArticleEntryLike => ({
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
  const entry = (id: string, order: number) => ({
    id,
    data: { title: `Titre ${id}`, summary: `Résumé ${id}`, order },
  });
  const descriptions = Object.fromEntries(
    [...site.mainNav, ...site.legalNav].map((item) => [item.href, `Description ${item.href}`]),
  );
  const model = buildLlmsModel({
    site,
    origin,
    labels: microcopy.llms,
    mainPages: toLlmsPages(site.mainNav, descriptions),
    legalPages: toLlmsPages(site.legalNav, descriptions),
    prestations: [entry('studio', 4), entry('essentiel', 1)],
    projets: [entry('chalet-suisse', 1)],
    articles: [article('publie', false), article('brouillon', true)],
  });
  const text = buildLlmsTxt(model);

  it('reprend le nom, la tagline et les coordonnées de site.ts, sans jeton restant', () => {
    expect(model.name).toBe(site.name);
    expect(model.summary).toBe(site.tagline);
    expect(model.details[0]).toContain(site.founder.name);
    expect(model.details[0]).toContain(site.email);
    expect(model.details[0]).toContain('Paris, Île-de-France, France');
    expect(model.details[0]).not.toMatch(/[{}]/);
  });

  it('liste les prestations dans l’ordre, en URL absolues, et les pages légales en Optional', () => {
    const services = model.sections.find((s) => s.title === microcopy.llms.sections.services);
    expect(services?.links.map((link) => link.url)).toEqual([
      'https://amgdecorationdinterieur.com/prestations/essentiel/',
      'https://amgdecorationdinterieur.com/prestations/studio/',
    ]);
    expect(model.optional.map((link) => link.title)).toEqual(site.legalNav.map((i) => i.label));
  });

  it('n’expose que les articles publiés et aucun prix', () => {
    expect(text).toContain('/conseils-deco/publie/');
    expect(text).not.toContain('brouillon');
    expect(text).not.toMatch(/€|EUR/);
  });

  it('échoue si la description d’une page fixe manque', () => {
    expect(() => toLlmsPages(site.mainNav, {})).toThrow(/description introuvable/);
  });
});
