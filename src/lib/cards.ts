/**
 * Projection PURE des entrées de collections vers les données attendues par les blocs
 * (cartes, listes). Les fonctions reçoivent des objets `{ id, data }` : testables sans Astro.
 */
import type { ImageMetadata } from 'astro';
import { sortByOrder } from './content';
import { resolvePriceDisplay, type PriceDisplay, type PriceDisplayOptions } from './price';
import type { PriceInput, QuoteInput } from './price';
import { projectPath, servicePath, type ProjectPath, type ServicePath } from './routes';

/* ------------------------------------------------------------------ */
/* Prestations                                                         */
/* ------------------------------------------------------------------ */

export interface ServiceEntryLike {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly kind: 'formule' | 'offre';
    readonly tagline: string;
    readonly target?: string | undefined;
    readonly summary: string;
    readonly highlight: boolean;
    readonly price?: PriceInput | undefined;
    readonly quote?: QuoteInput | undefined;
    readonly order: number;
  };
}

export interface ServiceCardData {
  readonly slug: string;
  readonly href: ServicePath;
  readonly title: string;
  readonly tagline: string;
  readonly target: string | undefined;
  readonly summary: string;
  readonly highlight: boolean;
  readonly price: PriceDisplay | undefined;
}

export function toServiceCard(
  entry: ServiceEntryLike,
  options: PriceDisplayOptions,
): ServiceCardData {
  const { data } = entry;
  return {
    slug: entry.id,
    href: servicePath(entry.id),
    title: data.title,
    tagline: data.tagline,
    target: data.target,
    summary: data.summary,
    highlight: data.highlight,
    price: resolvePriceDisplay(data, options),
  };
}

/** Les formules (pas les offres complémentaires), dans l'ordre éditorial. */
export function selectFormulas<T extends ServiceEntryLike>(entries: readonly T[]): T[] {
  return sortByOrder(entries.filter((entry) => entry.data.kind === 'formule'));
}

/* ------------------------------------------------------------------ */
/* Réalisations                                                        */
/* ------------------------------------------------------------------ */

export interface ProjectEntryLike {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly summary: string;
    readonly location?: string | undefined;
    readonly style: string;
    readonly cover: { readonly image: ImageMetadata; readonly alt: string };
    readonly featured: boolean;
    readonly order: number;
  };
}

export interface ProjectCardData {
  readonly slug: string;
  readonly href: ProjectPath;
  readonly title: string;
  readonly summary: string;
  readonly style: string;
  readonly location: string | undefined;
  readonly image: ImageMetadata;
  readonly alt: string;
}

export function toProjectCard(entry: ProjectEntryLike): ProjectCardData {
  const { data } = entry;
  return {
    slug: entry.id,
    href: projectPath(entry.id),
    title: data.title,
    summary: data.summary,
    style: data.style,
    location: data.location,
    image: data.cover.image,
    alt: data.cover.alt,
  };
}

/** Réalisations mises à la une (`featured`), triées, au plus `limit`. */
export function selectFeatured<T extends ProjectEntryLike>(
  entries: readonly T[],
  limit: number,
): T[] {
  return sortByOrder(entries.filter((entry) => entry.data.featured)).slice(0, Math.max(0, limit));
}

/* ------------------------------------------------------------------ */
/* Témoignages, étapes, avantages                                      */
/* ------------------------------------------------------------------ */

export interface TestimonialEntryLike {
  readonly id: string;
  readonly data: {
    readonly author: string;
    readonly text: string;
    readonly url?: string | undefined;
    readonly projectType?: string | undefined;
  };
}

export interface TestimonialData {
  readonly id: string;
  readonly author: string;
  /** Texte EXACT de l'avis (jamais reformulé ni tronqué). */
  readonly text: string;
  readonly url: string | undefined;
  readonly projectType: string | undefined;
}

export function toTestimonial(entry: TestimonialEntryLike): TestimonialData {
  const { author, text, url, projectType } = entry.data;
  return { id: entry.id, author, text, url, projectType };
}

export interface TextItemData {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

/** Étapes de la méthode, avantages de la 3D : `{ title, text }` dans l'ordre éditorial. */
export function toTextItems(
  entries: readonly {
    readonly id: string;
    readonly data: { readonly title: string; readonly text: string; readonly order: number };
  }[],
): TextItemData[] {
  return sortByOrder(entries).map(({ id, data }) => ({ id, title: data.title, text: data.text }));
}

/** Numéro d'étape sur deux chiffres : 1 → « 01 ». */
export function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}
