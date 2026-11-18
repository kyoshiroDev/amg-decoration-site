/**
 * Modèle de la page « Visualisation 3D » (/visualisation-3d/), construit à partir des entrées
 * BRUTES des collections (fonction pure, tests/unit/pages-model.test.ts). Accès : ./method.ts.
 */
import { toTextItems, type TextItemData } from '../cards';
import type { BreadcrumbItem } from '../jsonld';
import { breadcrumbTrail } from './breadcrumb-trail';
import { readSections } from './sections';
import type { PageData, PageSection } from './types';

export const METHOD_SECTION_KEYS = ['promesse', 'methode', 'avantages', 'cta'] as const;
export type MethodSectionKey = (typeof METHOD_SECTION_KEYS)[number];

export const METHOD_PATH = '/visualisation-3d/';
const PAGE_ID = 'visualisation-3d';

type OrderedText = {
  readonly id: string;
  readonly data: { readonly title: string; readonly text: string; readonly order: number };
};

export interface MethodInput {
  readonly page: Pick<PageData, 'seo' | 'hero' | 'sections'>;
  readonly etapes: readonly OrderedText[];
  readonly avantages: readonly OrderedText[];
  readonly homeLabel: string;
}

export interface MethodModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly sections: Readonly<Record<MethodSectionKey, PageSection>>;
  readonly steps: readonly TextItemData[];
  readonly benefits: readonly TextItemData[];
}

export function buildMethodModel(input: MethodInput): MethodModel {
  const { page } = input;
  return {
    seo: page.seo,
    breadcrumbs: breadcrumbTrail(input.homeLabel, {
      label: page.hero.eyebrow ?? page.hero.heading,
      href: METHOD_PATH,
    }),
    hero: page.hero,
    sections: readSections(page.sections, METHOD_SECTION_KEYS, PAGE_ID),
    steps: toTextItems(input.etapes),
    benefits: toTextItems(input.avantages),
  };
}
