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

/**
 * Annonce de la région `aria-live` : « Image 2 sur 5 : légende » (`{current}` et `{total}`
 * remplacés, légende ajoutée si elle existe). Une seule annonce par changement d'image : le
 * compteur visible « 2 / 5 » est masqué aux technologies d'assistance.
 */
export function statusText(
  index: number,
  length: number,
  template: string,
  caption: string,
): string {
  const position = counterText(index, length, template);
  const text = caption.trim();
  return text ? `${position}\u00A0: ${text}` : position;
}

/** Navigation (précédent / suivant, compteur, annonce) seulement s'il y a au moins deux images. */
export function hasNavigation(length: number): boolean {
  return length > 1;
}
