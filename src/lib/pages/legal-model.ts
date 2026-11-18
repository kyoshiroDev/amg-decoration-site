/**
 * Modèle des pages légales (mentions légales, confidentialité, conditions générales) :
 * fil d'Ariane et sommaire tiré des intertitres h2 du corps Markdown. Fonction PURE
 * (tests/unit/pages-model.test.ts), accès aux collections dans ./legal.ts.
 */
import type { BreadcrumbItem } from '../jsonld';
import { breadcrumbTrail } from './breadcrumb-trail';
import type { PageData, PageSection } from './types';

/** Identifiants des pages légales = fichiers de src/content/pages/ = slugs d'URL. */
export const LEGAL_PAGE_IDS = [
  'mentions-legales',
  'confidentialite',
  'conditions-generales',
] as const;
export type LegalPageId = (typeof LEGAL_PAGE_IDS)[number];

/** Nombre minimal d'intertitres pour afficher un sommaire. */
export const LEGAL_TOC_MIN_ITEMS = 4;

export interface MarkdownHeadingLike {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

export interface TocItem {
  readonly href: `#${string}`;
  readonly label: string;
}

export interface LegalInput {
  readonly id: LegalPageId;
  readonly page: Pick<PageData, 'seo' | 'hero' | 'noindex'>;
  readonly headings: readonly MarkdownHeadingLike[];
  readonly homeLabel: string;
}

export interface LegalModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly noindex: boolean;
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  /** Vide si la page compte moins de `LEGAL_TOC_MIN_ITEMS` intertitres. */
  readonly toc: readonly TocItem[];
}

export function legalPath(id: LegalPageId): `/${LegalPageId}/` {
  return `/${id}/`;
}

export function buildToc(headings: readonly MarkdownHeadingLike[]): TocItem[] {
  const items = headings
    .filter((heading) => heading.depth === 2)
    .map((heading) => ({ href: `#${heading.slug}` as const, label: heading.text }));
  return items.length >= LEGAL_TOC_MIN_ITEMS ? items : [];
}

export function buildLegalModel(input: LegalInput): LegalModel {
  const { page, id } = input;
  return {
    seo: page.seo,
    noindex: page.noindex,
    breadcrumbs: breadcrumbTrail(input.homeLabel, {
      label: page.hero.heading,
      href: legalPath(id),
    }),
    hero: page.hero,
    toc: buildToc(input.headings),
  };
}
