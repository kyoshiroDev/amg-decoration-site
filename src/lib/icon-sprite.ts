/**
 * Sprite SVG des icônes (fonctions pures) : un `<symbol>` par icône, servi une fois sous
 * `/icons.<empreinte>.svg` (src/pages/icons.[version].svg.ts) et référencé par `<use>` dans
 * Icon.astro. Les pages
 * n'embarquent plus les tracés : quelques dizaines d'octets par icône au lieu de ~400.
 * Les attributs de trait sont portés par chaque `<symbol>` : la copie que fait `<use>` les
 * transmet aux tracés, et `currentColor` reste celui de l'élément `<svg>` de la page.
 */
import { createHash } from 'node:crypto';

/** Grille de dessin commune à toutes les icônes (src/components/ui/icons.ts). */
export const ICON_VIEWBOX = '0 0 24 24';

const SYMBOL_ATTRIBUTES = [
  `viewBox="${ICON_VIEWBOX}"`,
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="1.5"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
].join(' ');

/** Construit le document SVG du sprite, dans l'ordre des clés de `paths`. */
export function buildIconSprite(paths: Readonly<Record<string, string>>): string {
  const symbols = Object.entries(paths).map(
    ([name, markup]) => `<symbol id="${name}" ${SYMBOL_ATTRIBUTES}>${markup}</symbol>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`;
}

/**
 * Version du sprite : début de l'empreinte SHA-256 de son contenu. Elle entre dans l'URL
 * (`/icons.<version>.svg`), comme les fichiers de `/_astro/` : l'URL change avec le contenu, ce qui
 * autorise un cache navigateur immuable d'un an (vercel.json) sans risque d'icône périmée.
 */
export function iconSpriteVersion(sprite: string): string {
  return createHash('sha256').update(sprite).digest('hex').slice(0, 10);
}
