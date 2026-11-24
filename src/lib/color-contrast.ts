/**
 * Contraste WCAG 2.x et lecture des tokens de couleur.
 * Fonctions pures : le styleguide lit `tokens.css` (source de vérité unique) et en
 * dérive nuancier et tableau de contrastes, sans dupliquer aucune valeur.
 */

export interface ColorToken {
  /** Nom du token sans préfixe, ex. `terracotta-700`. */
  name: string;
  /** Valeur hexadécimale normalisée en minuscules, ex. `#8f4530`. */
  hex: string;
}

export type ContrastLevel = 'AA' | 'AA-large' | 'fail';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLOR_DECLARATION = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,6})\s*;/gi;

/** Normalise `#abc` ou `#AABBCC` en `#aabbcc`. Lève une erreur si la valeur est invalide. */
export function normalizeHex(value: string): string {
  const match = HEX_COLOR.exec(value.trim());
  const digits = match?.[1];
  if (!digits) {
    throw new Error(`Couleur hexadécimale invalide\u00A0: «\u00A0${value}\u00A0»`);
  }
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  return `#${full.toLowerCase()}`;
}

/** Luminance relative WCAG d'une couleur hexadécimale. */
export function relativeLuminance(hex: string): number {
  const full = normalizeHex(hex);
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste WCAG entre deux couleurs (1 à 21), NON arrondi :
 * WCAG ne prévoit aucun arrondi, la comparaison aux seuils se fait sur la valeur brute.
 * Arrondir uniquement à l'affichage (`formatRatio`).
 */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Affichage d'un ratio, tronqué (jamais arrondi au-dessus) au centième : 4.499 → « 4.49 ». */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

/** Niveau atteint : AA texte courant (≥ 4.5), AA grand texte (≥ 3) ou échec. */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/** Retourne la valeur d'un token de couleur ; lève une erreur (build en échec) s'il est absent. */
export function requireColorToken(tokens: readonly ColorToken[], name: string): string {
  const token = tokens.find((t) => t.name === name);
  if (!token) {
    throw new Error(`Token de couleur introuvable dans tokens.css\u00A0: --color-${name}`);
  }
  return token.hex;
}

/** Extrait les tokens `--color-*` à valeur hexadécimale littérale d'une feuille CSS. */
export function parseColorTokens(css: string): ColorToken[] {
  return Array.from(css.matchAll(COLOR_DECLARATION), ([, name = '', value = '']) => ({
    name,
    hex: normalizeHex(value),
  }));
}
