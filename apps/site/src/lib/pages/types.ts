/**
 * Types partagés des données de page (collection `pages`, src/content.config.ts).
 * Import de type uniquement : aucun code Astro n'est chargé (testable avec Vitest).
 */
import type { CollectionEntry } from 'astro:content';
import type { Thing } from 'schema-dts';

export type PageData = CollectionEntry<'pages'>['data'];

/** Section éditoriale d'une page : `eyebrow?`, `heading`, `headingEmphasis?`, `lead?`, `items`, `quote?`, `actions`. */
export type PageSection = PageData['hero'];

/** Modèle de page complété des nœuds schema.org propres à la page (prop `jsonLd` des layouts). */
export type WithJsonLd<T> = T & { readonly jsonLd: readonly Thing[] };

export type PageAction = PageSection['actions'][number];

export interface QuoteData {
  readonly text: string;
  readonly author: string;
}
