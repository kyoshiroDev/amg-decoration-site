/**
 * Lecture générique des custom properties d'une feuille de tokens (fonction pure).
 * Sert au styleguide pour afficher les valeurs réelles de tokens.css sans les recopier.
 */

export interface CustomProperty {
  /** Nom complet, ex. `--space-m`. */
  name: string;
  /** Valeur brute telle qu'écrite dans la feuille. */
  value: string;
}

/** Renvoie, dans l'ordre du fichier, les custom properties dont le nom commence par `prefix`. */
export function parseCustomProperties(css: string, prefix: string): CustomProperty[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const declaration = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  return Array.from(withoutComments.matchAll(declaration), ([, name = '', value = '']) => ({
    name,
    value: value.trim().replace(/\s+/g, ' '),
  })).filter((property) => property.name.startsWith(prefix));
}

/** Extrait les bornes min et max d'une valeur `clamp(min, préférée, max)`. */
export function clampBounds(value: string): { min: string; max: string } | null {
  const match = /^clamp\(\s*([^,]+),[^,]+,\s*([^)]+)\)$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  return { min: match[1].trim(), max: match[2].trim() };
}
