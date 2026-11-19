/**
 * Modèles des pages Prestations (`/prestations/` et `/prestations/<slug>/`), construits à
 * partir des entrées BRUTES des collections (fonctions pures, tests/unit/services-model.test.ts).
 * L'accès aux collections est dans ./services.ts.
 */
import type { ImageMetadata } from 'astro';
import {
  selectFormulas,
  toServiceCard,
  type ServiceCardData,
  type ServiceEntryLike,
} from '../cards';
import { sortByOrder } from '../content';
import type { BreadcrumbItem, ServiceInput } from '../jsonld';
import { resolvePriceDisplay, type PriceDisplay, type PriceDisplayOptions } from '../price';
import { servicePath } from '../routes';
import { breadcrumbTrail } from './breadcrumb-trail';
import { readSections } from './sections';
import type { PageData, PageSection } from './types';

interface Figure {
  readonly image: ImageMetadata;
  readonly alt: string;
}

/** Sections attendues dans src/content/pages/prestations.md. */
export const SERVICES_SECTION_KEYS = [
  'formules',
  'inclus',
  'options',
  'offres',
  'autres',
  'cta',
] as const;

export type ServicesSectionKey = (typeof SERVICES_SECTION_KEYS)[number];

const PAGE_ID = 'prestations';
const INDEX_PATH = '/prestations/';

export interface ServiceDetailEntryLike extends ServiceEntryLike {
  readonly data: ServiceEntryLike['data'] & {
    readonly includes: readonly string[];
    readonly options: readonly string[];
    readonly seo: { readonly title: string; readonly description: string };
    readonly cover?: Figure | undefined;
  };
}

/** Carte d'offre complémentaire : carte de prestation + ce qu'elle comprend. */
export interface OfferCardData extends ServiceCardData {
  readonly includes: readonly string[];
}

interface Labels {
  /** « Accueil » (fil d'Ariane). */
  readonly home: string;
  /** « Prestations » (fil d'Ariane). */
  readonly index: string;
}

export interface ServicesInput {
  readonly page: Pick<PageData, 'seo' | 'hero' | 'sections'>;
  readonly prestations: readonly ServiceDetailEntryLike[];
  readonly pricing: PriceDisplayOptions;
  readonly labels: Labels;
}

export interface ServicesModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly sections: Readonly<Record<ServicesSectionKey, PageSection>>;
  readonly formulas: readonly ServiceCardData[];
  readonly offers: readonly OfferCardData[];
}

export function toOfferCard(
  entry: ServiceDetailEntryLike,
  pricing: PriceDisplayOptions,
): OfferCardData {
  return { ...toServiceCard(entry, pricing), includes: entry.data.includes };
}

export function buildServicesModel(input: ServicesInput): ServicesModel {
  const { page, pricing, labels } = input;
  return {
    seo: page.seo,
    breadcrumbs: breadcrumbTrail(labels.home, { label: labels.index, href: INDEX_PATH }),
    hero: page.hero,
    sections: readSections(page.sections, SERVICES_SECTION_KEYS, PAGE_ID),
    formulas: selectFormulas(input.prestations).map((entry) => toServiceCard(entry, pricing)),
    offers: sortByOrder(input.prestations.filter((entry) => entry.data.kind === 'offre')).map(
      (entry) => toOfferCard(entry, pricing),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Page de détail                                                      */
/* ------------------------------------------------------------------ */

export interface ServiceFacts {
  readonly target: string | undefined;
  readonly includes: readonly string[];
  readonly options: readonly string[];
  readonly price: PriceDisplay | undefined;
}

export interface ServiceDetailModel {
  readonly slug: string;
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly facts: ServiceFacts;
  /** Action principale de la carte « En bref » (première action du héros de prestations.md). */
  readonly factsAction: PageSection['actions'][number] | undefined;
  readonly others: readonly ServiceCardData[];
  readonly othersSection: PageSection;
  readonly cta: PageSection;
  readonly service: ServiceInput;
  /** Visuel de la prestation (`cover`, facultatif) : image Open Graph et `image` du JSON-LD. */
  readonly cover: Figure | undefined;
}

export function buildServiceDetailModel(
  input: ServicesInput & { readonly slug: string },
): ServiceDetailModel {
  const { page, pricing, labels, slug } = input;
  const entry = input.prestations.find((candidate) => candidate.id === slug);
  if (!entry) {
    throw new Error(`Prestation « ${slug} » introuvable dans src/content/prestations/.`);
  }
  const { data } = entry;
  const sections = readSections(page.sections, SERVICES_SECTION_KEYS, PAGE_ID);
  const path = servicePath(slug);

  return {
    slug,
    seo: data.seo,
    breadcrumbs: breadcrumbTrail(
      labels.home,
      { label: labels.index, href: INDEX_PATH },
      { label: data.title, href: path },
    ),
    hero: {
      eyebrow: data.tagline,
      heading: data.title,
      lead: data.summary,
      items: [],
      // L'action « Demander un devis » est portée par la carte « En bref », juste dessous.
      actions: [],
    },
    facts: {
      target: data.target,
      includes: data.includes,
      options: data.options,
      price: resolvePriceDisplay(data, pricing),
    },
    factsAction: page.hero.actions[0],
    others: selectFormulas(input.prestations)
      .filter((candidate) => candidate.id !== slug)
      .map((candidate) => toServiceCard(candidate, pricing)),
    othersSection: sections.autres,
    cta: sections.cta,
    service: { name: data.title, description: data.summary, path },
    cover: data.cover,
  };
}
