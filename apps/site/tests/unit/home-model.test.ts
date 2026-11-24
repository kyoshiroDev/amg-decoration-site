import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import {
  formatStepNumber,
  selectFeatured,
  selectFormulas,
  toProjectCard,
  toServiceCard,
  toTestimonial,
  toTextItems,
  type ProjectEntryLike,
  type ServiceEntryLike,
} from '@/lib/cards';
import { ContentError } from '@/lib/content';
import {
  HOME_FEATURED_LIMIT,
  HOME_SECTION_KEYS,
  buildHomeModel,
  type HomeInput,
} from '@/lib/pages/home-model';
import type { PageSection } from '@/lib/pages/types';

const NBSP = '\u00A0';
const pricing = { showPrices: true, fromLabel: 'À partir de' };
const image = { src: '/x.jpg', width: 1600, height: 2000, format: 'jpg' } as ImageMetadata;

function service(
  id: string,
  order: number,
  overrides: Partial<ServiceEntryLike['data']> = {},
): ServiceEntryLike {
  return {
    id,
    data: {
      title: `Formule ${id}`,
      kind: 'formule',
      tagline: 'pour tous',
      summary: 'Résumé',
      highlight: false,
      order,
      ...overrides,
    },
  };
}

function project(id: string, order: number, featured = true): ProjectEntryLike {
  return {
    id,
    data: {
      title: `Projet ${id}`,
      summary: 'Résumé',
      style: 'Doux',
      cover: { image, alt: 'Salon lumineux' },
      featured,
      order,
    },
  };
}

function section(heading: string, extra: Partial<PageSection> = {}): PageSection {
  return { heading, items: [], actions: [], ...extra };
}

function homeInput(overrides: Partial<HomeInput> = {}): HomeInput {
  const sections = Object.fromEntries(HOME_SECTION_KEYS.map((key) => [key, section(key)]));
  sections['citation'] = section('Citation', { quote: { text: 'Les détails…', author: 'Eames' } });
  return {
    page: { seo: { title: 'T', description: 'D' }, hero: section('Héros'), sections },
    prestations: [
      service('signature', 3),
      service('meuble', 5, { kind: 'offre' }),
      service('essentiel', 1),
      service('confort', 2, { highlight: true }),
    ],
    projets: [project('b', 2), project('a', 1), project('hors-une', 0, false)],
    etapes: [
      { id: 'deux', data: { title: 'Deux', text: 't', order: 2 } },
      { id: 'un', data: { title: 'Un', text: 't', order: 1 } },
    ],
    avantages: [{ id: 'av', data: { title: 'Av', text: 't', order: 1 } }],
    temoignages: [
      { id: 'z', data: { author: 'Z.', text: 'Texte Z', pages: ['accueil'], order: 2 } },
      { id: 'y', data: { author: 'Y.', text: 'Texte Y', pages: ['a-propos'], order: 1 } },
      {
        id: 'x',
        data: {
          author: 'X.',
          text: 'Texte X',
          url: 'https://g.co/kgs/x',
          projectType: 'Cuisine',
          pages: ['accueil', 'contact'],
          order: 1,
        },
      },
    ],
    pricing,
    fallbackEyebrow: 'Amandine Gaury · Designer d’intérieur',
    ...overrides,
  };
}

describe('cartes', () => {
  it('selectFormulas garde les formules, triées, sans les offres', () => {
    const ids = selectFormulas(homeInput().prestations).map((entry) => entry.id);
    expect(ids).toEqual(['essentiel', 'confort', 'signature']);
  });

  it('toServiceCard construit le lien et le prix affichable', () => {
    const card = toServiceCard(
      service('confort', 2, { price: { amount: 339, currency: 'EUR', from: false } }),
      pricing,
    );
    expect(card.href).toBe('/prestations/confort/');
    expect(card.price?.label).toBe(`339${NBSP}€`);
    expect(toServiceCard(service('studio', 4), pricing).price).toBeUndefined();
  });

  it('selectFeatured filtre les projets à la une, trie et borne', () => {
    const entries = [project('c', 3), project('a', 1), project('off', 0, false), project('b', 2)];
    expect(selectFeatured(entries, 2).map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(selectFeatured(entries, -1)).toEqual([]);
  });

  it('toProjectCard expose image, alt et lien de détail', () => {
    const card = toProjectCard(project('chalet-suisse', 1));
    expect(card).toMatchObject({
      href: '/realisations/chalet-suisse/',
      alt: 'Salon lumineux',
      location: undefined,
    });
    expect(card.image).toBe(image);
  });

  it('toTestimonial recopie le texte à l’identique', () => {
    const text = 'Recommandation à 100% et beaucoup de réussites pour l’avenir';
    expect(toTestimonial({ id: 'c', data: { author: 'C', text } }).text).toBe(text);
  });

  it('toTextItems trie et formatStepNumber numérote sur deux chiffres', () => {
    expect(toTextItems(homeInput().etapes).map((item) => item.title)).toEqual(['Un', 'Deux']);
    expect([0, 8, 11].map(formatStepNumber)).toEqual(['01', '09', '12']);
  });
});

describe('buildHomeModel', () => {
  it('rassemble les sections dans l’ordre attendu', () => {
    const model = buildHomeModel(homeInput());
    expect(Object.keys(model.sections)).toEqual([...HOME_SECTION_KEYS]);
    expect(model.quote).toEqual({ text: 'Les détails…', author: 'Eames' });
  });

  it('trie les formules, garde les projets à la une et filtre les avis de l’accueil', () => {
    const model = buildHomeModel(homeInput());
    expect(model.services.map((card) => card.slug)).toEqual(['essentiel', 'confort', 'signature']);
    expect(model.projects.map((card) => card.slug)).toEqual(['a', 'b']);
    expect(model.projects.length).toBeLessThanOrEqual(HOME_FEATURED_LIMIT);
    expect(model.testimonials.map((item) => item.id)).toEqual(['x', 'z']);
    expect(model.testimonials[0]).toEqual({
      id: 'x',
      author: 'X.',
      text: 'Texte X',
      url: 'https://g.co/kgs/x',
      projectType: 'Cuisine',
    });
  });

  it('utilise le surtitre de repli si le héros n’en a pas', () => {
    expect(buildHomeModel(homeInput()).heroEyebrow).toBe('Amandine Gaury · Designer d’intérieur');
    const input = homeInput();
    const withEyebrow = homeInput({
      page: { ...input.page, hero: section('Héros', { eyebrow: 'Atelier' }) },
    });
    expect(buildHomeModel(withEyebrow).heroEyebrow).toBe('Atelier');
  });

  it('masque les prix quand showPrices vaut false', () => {
    const input = homeInput({
      prestations: [
        service('essentiel', 1, { price: { amount: 189, currency: 'EUR', from: false } }),
      ],
      pricing: { ...pricing, showPrices: false },
    });
    expect(buildHomeModel(input).services[0]?.price).toBeUndefined();
  });

  it('échoue explicitement si une section manque', () => {
    const input = homeInput();
    const sections = Object.fromEntries(
      Object.entries(input.page.sections).filter(([key]) => key !== 'methode'),
    );
    expect(() => buildHomeModel({ ...input, page: { ...input.page, sections } })).toThrow(
      /Section « methode »/,
    );
  });

  it('échoue explicitement si la citation n’a pas de `quote`', () => {
    const input = homeInput();
    const sections = { ...input.page.sections, citation: section('Citation') };
    expect(() => buildHomeModel({ ...input, page: { ...input.page, sections } })).toThrow(
      ContentError,
    );
  });
});
