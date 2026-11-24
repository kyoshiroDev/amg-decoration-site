/**
 * Modèle de la page « À propos » (/a-propos/), construit à partir des entrées BRUTES des
 * collections (fonction pure, tests/unit/pages-model.test.ts). Accès : ./about.ts.
 */
import { toTestimonial, type TestimonialData, type TestimonialEntryLike } from '../cards';
import { ContentError, filterByPage, sortByOrder } from '../content';
import type { BreadcrumbItem } from '../jsonld';
import { breadcrumbTrail } from './breadcrumb-trail';
import { readSections } from './sections';
import type { PageData, PageSection, QuoteData } from './types';

export const ABOUT_SECTION_KEYS = [
  'parcours',
  'citation',
  'missions',
  'valeurs',
  'temoignages',
  'cta',
] as const;
export type AboutSectionKey = (typeof ABOUT_SECTION_KEYS)[number];

export const ABOUT_PATH = '/a-propos/';
const PAGE_ID = 'a-propos';

export interface AboutInput {
  readonly page: Pick<PageData, 'seo' | 'hero' | 'sections'>;
  readonly temoignages: readonly (TestimonialEntryLike & {
    readonly data: { readonly pages: readonly string[]; readonly order: number };
  })[];
  readonly homeLabel: string;
}

export interface AboutModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly sections: Readonly<Record<AboutSectionKey, PageSection>>;
  readonly quote: QuoteData;
  readonly testimonials: readonly TestimonialData[];
}

export function buildAboutModel(input: AboutInput): AboutModel {
  const { page } = input;
  const sections = readSections(page.sections, ABOUT_SECTION_KEYS, PAGE_ID);
  const quote = sections.citation.quote;
  if (!quote) {
    throw new ContentError(
      `La section « citation » de src/content/pages/${PAGE_ID}.md doit avoir un champ \`quote\`.`,
    );
  }
  return {
    seo: page.seo,
    breadcrumbs: breadcrumbTrail(input.homeLabel, {
      label: page.hero.eyebrow ?? page.hero.heading,
      href: ABOUT_PATH,
    }),
    hero: page.hero,
    sections,
    quote,
    testimonials: sortByOrder(filterByPage(input.temoignages, PAGE_ID)).map(toTestimonial),
  };
}
