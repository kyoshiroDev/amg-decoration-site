/**
 * Lecture typée des sections obligatoires d'une page (collection `pages`) : chaque clé
 * manquante fait échouer le build avec un message explicite. Fonction PURE.
 */
import { requireSection } from '../content';
import type { PageSection } from './types';

export function readSections<const K extends string>(
  sections: Readonly<Record<string, PageSection>>,
  keys: readonly K[],
  pageId: string,
): Readonly<Record<K, PageSection>> {
  return Object.fromEntries(
    keys.map((key) => [key, requireSection(sections, key, pageId)]),
  ) as Record<K, PageSection>;
}
