/**
 * Modèle de la page « Visualisation 3D » (/visualisation-3d/), construit à partir des entrées
 * BRUTES des collections (fonction pure, tests/unit/pages-model.test.ts). Accès : ./method.ts.
 */
import { toTextItems, type TextItemData } from '../cards';
import type { FurtherItem } from './articles-model';
import { resolveFurtherLinks, type FurtherSources } from './further-links';
import type { BreadcrumbItem, ServiceInput } from '../jsonld';
import { breadcrumbTrail } from './breadcrumb-trail';
import { readSections } from './sections';
import type { PageData, PageSection } from './types';

export const METHOD_SECTION_KEYS = [
  'promesse',
  'comparatif',
  'methode',
  'avantages',
  'plus-loin',
  'cta',
] as const;
export type MethodSectionKey = (typeof METHOD_SECTION_KEYS)[number];

export const METHOD_PATH = '/visualisation-3d/';

/** `serviceType` schema.org du nœud `Service` de la page (docs/SEO-STRATEGIE.md §4). */
export const METHOD_SERVICE_TYPE = 'Visualisation 3D d’intérieur';
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
  /** Cibles possibles des liens de la section `plus-loin` (article, offre, réalisation). */
  readonly further: FurtherSources;
}

export interface MethodModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly sections: Readonly<Record<MethodSectionKey, PageSection>>;
  readonly steps: readonly TextItemData[];
  readonly benefits: readonly TextItemData[];
  /** Maillage vers l'article, les offres et une réalisation (section `plus-loin`). */
  readonly further: readonly FurtherItem[];
  /** Données du nœud JSON-LD `Service` (nom et description = balises title/description). */
  readonly service: ServiceInput;
}

export function buildMethodModel(input: MethodInput): MethodModel {
  const { page } = input;
  const sections = readSections(page.sections, METHOD_SECTION_KEYS, PAGE_ID);
  return {
    seo: page.seo,
    breadcrumbs: breadcrumbTrail(input.homeLabel, {
      label: page.hero.eyebrow ?? page.hero.heading,
      href: METHOD_PATH,
    }),
    hero: page.hero,
    sections,
    steps: toTextItems(input.etapes),
    benefits: toTextItems(input.avantages),
    further: resolveFurtherLinks(sections['plus-loin'], input.further, PAGE_ID),
    service: {
      name: page.seo.title,
      description: page.seo.description,
      path: METHOD_PATH,
      serviceType: METHOD_SERVICE_TYPE,
    },
  };
}
