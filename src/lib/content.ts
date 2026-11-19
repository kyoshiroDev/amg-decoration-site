/**
 * Helpers PURS pour manipuler les entrées des collections de contenu (src/content.config.ts).
 * Aucun import Astro : les fonctions reçoivent des objets de forme `{ id, data }`.
 */

export class ContentError extends Error {
  override name = 'ContentError';
}

interface OrderedEntry {
  readonly id: string;
  readonly data: { readonly order: number };
}

/** Copie triée par `data.order` croissant, puis par `id` (ordre stable et prévisible). */
export function sortByOrder<T extends OrderedEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (first, second) => first.data.order - second.data.order || first.id.localeCompare(second.id),
  );
}

/** Retire les brouillons (`draft: true`). */
export function filterPublished<T extends { readonly data: { readonly draft: boolean } }>(
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => !entry.data.draft);
}

/** Garde les entrées à afficher sur une page donnée (`data.pages` contient `page`). */
export function filterByPage<T extends { readonly data: { readonly pages: readonly string[] } }>(
  entries: readonly T[],
  page: T['data']['pages'][number],
): T[] {
  return entries.filter((entry) => entry.data.pages.includes(page));
}

/**
 * Section nommée d'une page de la collection `pages`. Lève une erreur explicite si elle manque :
 * le build échoue au lieu de publier une page amputée.
 */
export function requireSection<S>(
  sections: Readonly<Record<string, S>>,
  key: string,
  pageId: string,
): S {
  const section = sections[key];
  if (section === undefined) {
    throw new ContentError(
      `Section « ${key} » absente de src/content/pages/${pageId}.md (clés présentes : ${Object.keys(sections).join(', ') || 'aucune'}).`,
    );
  }
  return section;
}

/** Retourne l'entrée ou lève une erreur explicite (remplace un `!` après `getEntry`). */
export function requireEntry<T>(entry: T | undefined, collection: string, id: string): T {
  if (entry === undefined) {
    throw new ContentError(`Entrée « ${id} » introuvable dans la collection « ${collection} ».`);
  }
  return entry;
}
