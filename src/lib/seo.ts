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

/** Métadonnées Open Graph d'un article (protocole ogp.me, type `article`). */
export interface OpenGraphArticle {
  readonly publishedTime: Date;
  readonly modifiedTime?: Date | undefined;
  readonly tags?: readonly string[] | undefined;
}

export interface MetaProperty {
  readonly property: string;
  readonly content: string;
}

/**
 * Balises `article:*` (dates ISO 8601, mêmes valeurs que le JSON-LD `BlogPosting`) :
 * `modified_time` reprend la date de publication à défaut de mise à jour ; un `article:tag` par mot-clé.
 */
export function buildArticleMetaTags(article: OpenGraphArticle): MetaProperty[] {
  const modified = article.modifiedTime ?? article.publishedTime;
  return [
    { property: 'article:published_time', content: article.publishedTime.toISOString() },
    { property: 'article:modified_time', content: modified.toISOString() },
    ...(article.tags ?? []).map((tag) => ({ property: 'article:tag', content: tag })),
  ];
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Vérifie qu'une image source peut produire l'image Open Graph sans être agrandie : le service
 * sharp d'Astro redimensionne avec `withoutEnlargement`, une source plus petite donnerait une
 * image OG plus petite que les dimensions annoncées dans `og:image:width` / `og:image:height`.
 */
export function assertOgImageSource(source: ImageSize, target: ImageSize): void {
  if (source.width < target.width || source.height < target.height) {
    throw new SeoValidationError(
      `Image Open Graph trop petite (${source.width} × ${source.height} px, minimum ${target.width} × ${target.height} px)\u00A0: fournir une source plus grande.`,
    );
  }
}
