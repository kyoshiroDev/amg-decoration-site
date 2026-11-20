/**
 * Règles pures des images responsives (`srcset` / `sizes`) : largeurs générées sans agrandissement
 * et `sizes` corrigé quand le cadre recadre l'image (`object-fit: cover`).
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
 * Facteur d'agrandissement d'une image recadrée en `object-fit: cover` dans un cadre de ratio
 * `frameRatio` : une source plus large que le cadre est affichée plus large que lui (ex. source
 * 2 : 1 dans une arche 4 / 5 → 2,5 fois la largeur du cadre). 1 si la source est plus haute.
 */
export function coverScale(source: ImageSize, frameRatio: number): number {
  return Math.max(1, source.width / source.height / frameRatio);
}

/** Découpe sur `separator` hors parenthèses (`calc()`, `min()`, conditions média). */
function splitTopLevel(text: string, separator: (char: string) => boolean): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  [...text].forEach((char, index) => {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && separator(char)) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  });
  parts.push(text.slice(start));
  return parts;
}

/**
 * Multiplie chaque longueur d'un attribut `sizes` par `factor` (`calc(… * factor)`), conditions
 * média conservées. Sert à annoncer au navigateur la largeur réellement affichée d'une image
 * recadrée (voir `coverScale`), sans quoi il choisit une variante trop petite. `auto` est conservé.
 */
export function scaleSizes(sizes: string, factor: number): string {
  if (factor === 1) {
    return sizes;
  }
  const scale = Number(factor.toFixed(3));
  return splitTopLevel(sizes, (char) => char === ',')
    .map((entry) => {
      const words = splitTopLevel(entry.trim(), (char) => /\s/.test(char)).filter(Boolean);
      const length = words.pop() ?? '';
      const condition = words.join(' ');
      const scaled = length === 'auto' ? length : `calc(${length} * ${scale})`;
      return condition ? `${condition} ${scaled}` : scaled;
    })
    .join(', ');
}
