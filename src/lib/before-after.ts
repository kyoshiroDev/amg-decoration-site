/**
 * Logique pure du comparateur « Rendu 3D ↔ Réalisé » (scripts/before-after.ts).
 * La valeur est la part de l'image visible côté rendu 3D, en pour cent (0 à 100, entier).
 */

export const COMPARE_MIN = 0;
export const COMPARE_MAX = 100;

/** Ramène une valeur quelconque dans [0, 100], arrondie à l'entier (NaN ⇒ 50). */
export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return COMPARE_MAX / 2;
  return Math.round(Math.min(COMPARE_MAX, Math.max(COMPARE_MIN, value)));
}

/**
 * Position du curseur sous le pointeur : `clientX` rapporté à la boîte du comparateur
 * (`left` et `width` de getBoundingClientRect). Largeur nulle ⇒ milieu.
 */
export function positionFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return COMPARE_MAX / 2;
  return clampPercent(((clientX - left) / width) * 100);
}

/**
 * Texte de `aria-valuetext` : `{rendering}` et `{result}` remplacés par les deux parts,
 * ex. « 60 % rendu 3D, 40 % réalisé ».
 */
export function compareValueText(value: number, template: string): string {
  const rendering = clampPercent(value);
  return template
    .replace('{rendering}', String(rendering))
    .replace('{result}', String(COMPARE_MAX - rendering));
}
