import { describe, expect, it } from 'vitest';
import { ContentError } from '@/lib/content';
import { ABOUT_SECTION_KEYS, buildAboutModel } from '@/lib/pages/about-model';
import { LEGAL_TOC_MIN_ITEMS, buildLegalModel, buildToc, legalPath } from '@/lib/pages/legal-model';
import {
  METHOD_SECTION_KEYS,
  METHOD_SERVICE_TYPE,
  buildMethodModel,
} from '@/lib/pages/method-model';
import type { PageSection } from '@/lib/pages/types';

const seo = { title: 'T', description: 'D' };
const section = (heading: string, extra: Partial<PageSection> = {}): PageSection => ({
  heading,
  items: [],
  actions: [],
  ...extra,
});
const sectionsFor = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, section(key)]));

describe('buildMethodModel', () => {
  it('trie étapes et avantages, fil d’Ariane depuis le surtitre', () => {
    const model = buildMethodModel({
      page: {
        seo,
        hero: section('Visualisation 3D avant travaux', { eyebrow: 'Visualisation 3D' }),
        sections: sectionsFor(METHOD_SECTION_KEYS),
      },
      etapes: [
        { id: 'b', data: { title: 'B', text: 't', order: 2 } },
        { id: 'a', data: { title: 'A', text: 't', order: 1 } },
      ],
      avantages: [{ id: 'x', data: { title: 'X', text: 't', order: 1 } }],
      homeLabel: 'Accueil',
      further: { articles: [], prestations: [], projets: [] },
    });
    expect(model.steps.map((step) => step.id)).toEqual(['a', 'b']);
    expect(model.benefits).toHaveLength(1);
    expect(model.further).toEqual([]);
    expect(model.breadcrumbs.at(-1)).toEqual({
      label: 'Visualisation 3D',
      href: '/visualisation-3d/',
    });
    expect(model.service).toEqual({
      name: 'T',
      description: 'D',
      path: '/visualisation-3d/',
      serviceType: METHOD_SERVICE_TYPE,
    });
    expect(METHOD_SERVICE_TYPE).toBe('Visualisation 3D d’intérieur');
  });
});

describe('buildAboutModel', () => {
  const sections = {
    ...sectionsFor(ABOUT_SECTION_KEYS),
    citation: section('Ce qui m’inspire', {
      quote: { text: 'Le soleil…', author: 'Le Corbusier' },
    }),
  };
  const temoignages = [
    {
      id: 'g',
      data: { author: 'G.', text: 'Avis G', url: 'https://g.co/x', pages: ['accueil'], order: 1 },
    },
    { id: 'c', data: { author: 'Christine C', text: 'Avis C', pages: ['a-propos'], order: 4 } },
  ];

  it('garde les témoignages de la page, citation obligatoire', () => {
    const model = buildAboutModel({
      page: { seo, hero: section('Amandine', { eyebrow: 'À propos' }), sections },
      temoignages,
      homeLabel: 'Accueil',
    });
    expect(model.testimonials).toEqual([
      { id: 'c', author: 'Christine C', text: 'Avis C', url: undefined, projectType: undefined },
    ]);
    expect(model.quote.author).toBe('Le Corbusier');
    expect(model.breadcrumbs.at(-1)).toEqual({ label: 'À propos', href: '/a-propos/' });
  });

  it('échoue sans citation', () => {
    expect(() =>
      buildAboutModel({
        page: { seo, hero: section('A'), sections: sectionsFor(ABOUT_SECTION_KEYS) },
        temoignages: [],
        homeLabel: 'Accueil',
      }),
    ).toThrow(ContentError);
  });
});

describe('pages légales', () => {
  const headings = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      depth: 2,
      slug: `titre-${index}`,
      text: `Titre ${index}`,
    }));

  it('sommaire : h2 seulement, à partir du seuil', () => {
    const toc = buildToc([...headings(LEGAL_TOC_MIN_ITEMS), { depth: 3, slug: 'sous', text: 'S' }]);
    expect(toc).toHaveLength(LEGAL_TOC_MIN_ITEMS);
    expect(toc[0]).toEqual({ href: '#titre-0', label: 'Titre 0' });
    expect(buildToc(headings(LEGAL_TOC_MIN_ITEMS - 1))).toEqual([]);
  });

  it('fil d’Ariane avec le titre de la page', () => {
    const model = buildLegalModel({
      id: 'mentions-legales',
      page: { seo, noindex: false, hero: section('Mentions légales', { eyebrow: 'Infos' }) },
      headings: headings(5),
      homeLabel: 'Accueil',
    });
    expect(legalPath('confidentialite')).toBe('/confidentialite/');
    expect(model.breadcrumbs).toEqual([
      { label: 'Accueil', href: '/' },
      { label: 'Mentions légales', href: '/mentions-legales/' },
    ]);
    expect(model.toc).toHaveLength(5);
  });
});
