/**
 * Logique pure de la visionneuse (scripts/lightbox.ts).
 */

/** Index suivant ou précédent dans une liste de `length` éléments, en boucle. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

/** Compteur « 2 / 5 » : `{current}` (à partir de 1) et `{total}` remplacés. */
export function counterText(index: number, length: number, template: string): string {
  return template
    .replace('{current}', String(wrapIndex(index, length) + 1))
    .replace('{total}', String(length));
}
