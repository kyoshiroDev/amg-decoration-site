/**
 * Modèle de l'accueil, construit à partir des entrées BRUTES des collections (fonction pure,
 * testée dans tests/unit/home-model.test.ts). L'accès aux collections est dans ./home.ts.
 */
import {
  selectFeatured,
  selectFormulas,
  toProjectCard,
  toServiceCard,
  toTestimonial,
  toTextItems,
  type ProjectCardData,
  type ProjectEntryLike,
  type ServiceCardData,
  type ServiceEntryLike,
  type TestimonialData,
  type TestimonialEntryLike,
  type TextItemData,
} from '../cards';
import { ContentError, filterByPage, requireSection, sortByOrder } from '../content';
import type { PriceDisplayOptions } from '../price';
import type { PageSection, QuoteData } from './types';

/** Sections attendues dans src/content/pages/accueil.md, dans l'ordre d'affichage. */
export const HOME_SECTION_KEYS = [
  'missions',
  'prestations',
  'presentation',
  'projets',
  'methode',
  'citation',
  'avantages',
  'temoignages',
  'cta',
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/** Nombre maximal de réalisations à la une sur l'accueil (grille éditoriale 2 × 2). */
export const HOME_FEATURED_LIMIT = 4;

type OrderedText = {
  readonly id: string;
  readonly data: { readonly title: string; readonly text: string; readonly order: number };
};

export interface HomeInput {
  readonly page: {
    readonly seo: { readonly title: string; readonly description: string };
    readonly hero: PageSection;
    readonly sections: Readonly<Record<string, PageSection>>;
  };
  readonly prestations: readonly ServiceEntryLike[];
  readonly projets: readonly ProjectEntryLike[];
  readonly etapes: readonly OrderedText[];
  readonly avantages: readonly OrderedText[];
  readonly temoignages: readonly (TestimonialEntryLike & {
    readonly data: { readonly pages: readonly string[]; readonly order: number };
  })[];
  readonly pricing: PriceDisplayOptions;
  /** Surtitre du héros si `hero.eyebrow` est absent du contenu. */
  readonly fallbackEyebrow: string;
}

export interface HomeModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly hero: PageSection;
  readonly heroEyebrow: string;
  readonly sections: Readonly<Record<HomeSectionKey, PageSection>>;
  readonly quote: QuoteData;
  readonly services: readonly ServiceCardData[];
  readonly projects: readonly ProjectCardData[];
  readonly steps: readonly TextItemData[];
  readonly benefits: readonly TextItemData[];
  readonly testimonials: readonly TestimonialData[];
}

const PAGE_ID = 'accueil';

export function buildHomeModel(input: HomeInput): HomeModel {
  const { page } = input;
  const sections = Object.fromEntries(
    HOME_SECTION_KEYS.map((key) => [key, requireSection(page.sections, key, PAGE_ID)]),
  ) as Record<HomeSectionKey, PageSection>;

  const quote = sections.citation.quote;
  if (!quote) {
    throw new ContentError(
      `La section « citation » de src/content/pages/${PAGE_ID}.md doit avoir un champ \`quote\`.`,
    );
  }

  return {
    seo: page.seo,
    hero: page.hero,
    heroEyebrow: page.hero.eyebrow ?? input.fallbackEyebrow,
    sections,
    quote,
    services: selectFormulas(input.prestations).map((entry) => toServiceCard(entry, input.pricing)),
    projects: selectFeatured(input.projets, HOME_FEATURED_LIMIT).map(toProjectCard),
    steps: toTextItems(input.etapes),
    benefits: toTextItems(input.avantages),
    testimonials: sortByOrder(filterByPage(input.temoignages, PAGE_ID)).map(toTestimonial),
  };
}
