/**
 * Règles pures des images responsives (`srcset`) : largeurs générées sans agrandissement et
 * recadrage au build à la proportion du cadre (`object-fit: cover`).
 */

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Largeurs à générer pour une source de `sourceWidth` px : les largeurs demandées strictement
 * inférieures à la source, plus la source elle-même si une largeur demandée l'atteint ou la
 * dépasse (variante la plus nette disponible, au lieu de s'arrêter à l'étape précédente).
 * Jamais vide : une source plus étroite que toutes les étapes donne `[sourceWidth]`.
 */
export function fitWidths(widths: readonly number[], sourceWidth: number): number[] {
  const kept = [...new Set(widths.filter((width) => width < sourceWidth))].sort((a, b) => a - b);
  const reachesSource = widths.length === 0 || widths.some((width) => width >= sourceWidth);
  return reachesSource ? [...kept, sourceWidth] : kept;
}

/** Ratio largeur / hauteur d'une valeur CSS `aspect-ratio` (« 4 / 5 », « 1.5 »). */
export function parseAspectRatio(ratio: string): number {
  const [width, height = '1', ...rest] = ratio.split('/').map((part) => part.trim());
  const value = Number(width) / Number(height);
  if (rest.length > 0 || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Ratio d'image invalide\u00A0: «\u00A0${ratio}\u00A0»`);
  }
  return value;
}

/**
 * Plus grand recadrage de `source` à la proportion `frameRatio` (largeur / hauteur) : toute la
 * hauteur d'une source plus large que le cadre (paysage 2 : 1 dans une arche 4 / 5 → 480 × 600
 * depuis 1200 × 600), toute la largeur d'une source plus haute. Passé en `width` / `height` à
 * `<Picture>`, il fait recadrer chaque variante au build (centrée, comme `object-fit: cover`) :
 * le navigateur ne télécharge plus les bandes masquées par le cadre.
 */
export function coverCrop(source: ImageSize, frameRatio: number): ImageSize {
  if (source.width / source.height > frameRatio) {
    return { width: Math.round(source.height * frameRatio), height: source.height };
  }
  return {
    width: source.width,
    height: Math.min(source.height, Math.round(source.width / frameRatio)),
  };
}
