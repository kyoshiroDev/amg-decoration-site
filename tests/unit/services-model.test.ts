import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import { ContentError } from '@/lib/content';
import {
  SERVICES_SECTION_KEYS,
  buildServiceDetailModel,
  buildServicesModel,
  type ServiceDetailEntryLike,
  type ServicesInput,
} from '@/lib/pages/services-model';
import type { PageSection } from '@/lib/pages/types';

const seo = { title: 'T', description: 'D' };
const section = (heading: string): PageSection => ({ heading, items: [], actions: [] });

function entry(
  id: string,
  order: number,
  overrides: Partial<ServiceDetailEntryLike['data']> = {},
): ServiceDetailEntryLike {
  return {
    id,
    data: {
      title: `Formule ${id}`,
      kind: 'formule',
      tagline: 'pour tous',
      summary: `Résumé ${id}`,
      highlight: false,
      includes: [],
      options: [],
      order,
      seo,
      ...overrides,
    },
  };
}

function input(overrides: Partial<ServicesInput> = {}): ServicesInput {
  return {
    page: {
      seo,
      hero: { ...section('Prestations'), actions: [{ label: 'Devis', href: '/contact/' }] },
      sections: Object.fromEntries(SERVICES_SECTION_KEYS.map((key) => [key, section(key)])),
    },
    prestations: [
      entry('confort', 2, { price: { amount: 339, currency: 'EUR', from: false } }),
      entry('pro', 6, { kind: 'offre', includes: ['1 visuel 4K'], quote: { label: 'Devis pro' } }),
      entry('essentiel', 1),
      entry('meuble', 5, { kind: 'offre' }),
      entry('studio', 4),
    ],
    pricing: { showPrices: true, fromLabel: 'À partir de' },
    labels: { home: 'Accueil', index: 'Prestations' },
    ...overrides,
  };
}

describe('buildServicesModel', () => {
  it('sépare formules et offres, triées', () => {
    const model = buildServicesModel(input());
    expect(model.formulas.map((card) => card.slug)).toEqual(['essentiel', 'confort', 'studio']);
    expect(model.offers.map((card) => card.slug)).toEqual(['meuble', 'pro']);
    expect(model.offers[1]?.includes).toEqual(['1 visuel 4K']);
    expect(model.offers[1]?.price).toMatchObject({ kind: 'quote', label: 'Devis pro' });
  });

  it('masque les prix si showPrices est faux, garde les devis', () => {
    const model = buildServicesModel(input({ pricing: { showPrices: false, fromLabel: '' } }));
    expect(model.formulas.find((card) => card.slug === 'confort')?.price).toBeUndefined();
    expect(model.offers[1]?.price?.kind).toBe('quote');
  });

  it('fil d’Ariane : Accueil › Prestations', () => {
    expect(buildServicesModel(input()).breadcrumbs).toEqual([
      { label: 'Accueil', href: '/' },
      { label: 'Prestations', href: '/prestations/' },
    ]);
  });

  it('échoue si une section manque', () => {
    const broken = input();
    expect(() => buildServicesModel({ ...broken, page: { ...broken.page, sections: {} } })).toThrow(
      ContentError,
    );
  });
});

describe('buildServiceDetailModel', () => {
  it('construit héros, fil d’Ariane, faits et JSON-LD', () => {
    const model = buildServiceDetailModel({ ...input(), slug: 'confort' });
    expect(model.hero).toMatchObject({ heading: 'Formule confort', eyebrow: 'pour tous' });
    expect(model.hero.actions).toEqual([]);
    expect(model.factsAction).toEqual({ label: 'Devis', href: '/contact/' });
    expect(model.breadcrumbs.at(-1)).toEqual({
      label: 'Formule confort',
      href: '/prestations/confort/',
    });
    expect(model.facts.price?.label).toBe('339 €');
    expect(model.service).toEqual({
      name: 'Formule confort',
      description: 'Résumé confort',
      path: '/prestations/confort/',
    });
  });

  it('propose les autres formules, sans la page courante ni les offres', () => {
    const formula = buildServiceDetailModel({ ...input(), slug: 'confort' });
    expect(formula.others.map((card) => card.slug)).toEqual(['essentiel', 'studio']);
    const offer = buildServiceDetailModel({ ...input(), slug: 'pro' });
    expect(offer.others.map((card) => card.slug)).toEqual(['essentiel', 'confort', 'studio']);
    expect(offer.facts.includes).toEqual(['1 visuel 4K']);
  });

  it('expose le visuel de la prestation s’il existe (image Open Graph), sinon rien', () => {
    const image = { src: '/c.jpg', width: 1600, height: 1200, format: 'jpg' } as ImageMetadata;
    const cover = { image, alt: 'Salon en rendu 3D' };
    const withCover = input({
      prestations: [entry('confort', 2, { cover }), entry('essentiel', 1)],
    });
    expect(buildServiceDetailModel({ ...withCover, slug: 'confort' }).cover).toEqual(cover);
    expect(buildServiceDetailModel({ ...withCover, slug: 'essentiel' }).cover).toBeUndefined();
  });

  it('échoue sur un slug inconnu', () => {
    expect(() => buildServiceDetailModel({ ...input(), slug: 'inconnu' })).toThrow(/inconnu/);
  });
});
