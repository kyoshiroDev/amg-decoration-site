/**
 * Types partagés des données de page (collection `pages`, src/content.config.ts).
 * Import de type uniquement : aucun code Astro n'est chargé (testable avec Vitest).
 */
import type { CollectionEntry } from 'astro:content';

export type PageData = CollectionEntry<'pages'>['data'];

/** Section éditoriale d'une page : `eyebrow?`, `heading`, `headingEmphasis?`, `lead?`, `items`, `quote?`, `actions`. */
export type PageSection = PageData['hero'];

export type PageAction = PageSection['actions'][number];

export interface QuoteData {
  readonly text: string;
  readonly author: string;
}
