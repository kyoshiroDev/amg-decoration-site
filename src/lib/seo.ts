/**
 * Règles SEO pures (CLAUDE.md §5) : titre ≤ 60 caractères, description de 140 à 160,
 * canonical absolu avec slash final. Toute violation lève une erreur : le build échoue.
 */
import { absoluteUrl } from './url';

export class SeoValidationError extends Error {
  override name = 'SeoValidationError';
}

export interface TitleOptions {
  readonly suffix: string;
  readonly separator: string;
  readonly maxLength: number;
}

export interface LengthRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Limites SEO (CLAUDE.md §5), source unique : lues par `config/seo.ts` (composant SEO)
 * et par `content.config.ts` (validation Zod des contenus).
 */
export const seoLimits = {
  titleMaxLength: 60,
  descriptionLength: { min: 140, max: 160 },
} as const satisfies { titleMaxLength: number; descriptionLength: LengthRange };

/** Nombre de caractères perçus (forme NFC : « é » décomposé compte pour 1). */
export function countCharacters(text: string): number {
  return [...text.normalize('NFC')].length;
}

/** Vrai si le texte (espaces de bord retirés) est non vide et tient dans `maxLength` caractères. */
export function isTitleLengthValid(text: string, maxLength: number): boolean {
  const length = countCharacters(text.trim());
  return length > 0 && length <= maxLength;
}

/** Vrai si la longueur du texte (espaces de bord retirés) est dans l'intervalle, bornes incluses. */
export function isDescriptionLengthValid(text: string, range: LengthRange): boolean {
  const length = countCharacters(text.trim());
  return length >= range.min && length <= range.max;
}

/**
 * Titre complet « Titre | Suffixe » s'il tient dans `maxLength` ; sinon le titre seul.
 * Lève une erreur si le titre seul dépasse déjà la limite.
 */
export function buildPageTitle(
  pageTitle: string,
  options: TitleOptions,
  withSuffix = true,
): string {
  const title = pageTitle.trim();
  if (title === '') {
    throw new SeoValidationError('Le titre de page est vide.');
  }
  const length = countCharacters(title);
  if (length > options.maxLength) {
    throw new SeoValidationError(
      `Titre trop long (${length} > ${options.maxLength} caractères)\u00A0: «\u00A0${title}\u00A0»`,
    );
  }
  if (!withSuffix) {
    return title;
  }
  const full = `${title}${options.separator}${options.suffix}`;
  return countCharacters(full) <= options.maxLength ? full : title;
}

/** Retourne la description si sa longueur est dans l'intervalle, sinon lève une erreur. */
export function assertDescriptionLength(description: string, range: LengthRange): string {
  const text = description.trim();
  const length = countCharacters(text);
  if (length < range.min || length > range.max) {
    throw new SeoValidationError(
      `Description hors limites (${length} caractères, attendu ${range.min}–${range.max})\u00A0: «\u00A0${text}\u00A0»`,
    );
  }
  return text;
}

/** URL canonique absolue, sans query ni ancre, avec slash final. */
export function buildCanonicalUrl(pathname: string, site: URL | undefined): string {
  if (!site) {
    throw new SeoValidationError('`site` doit être défini dans astro.config.mjs.');
  }
  const path = pathname.split(/[?#]/)[0] ?? '/';
  return absoluteUrl(path || '/', site);
}

export type RobotsDirective = 'index, follow' | 'noindex, nofollow';

export function buildRobots(noindex: boolean): RobotsDirective {
  return noindex ? 'noindex, nofollow' : 'index, follow';
}
