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
  /** URL absolue de la page de l'auteur (même personne que l'`author` du `BlogPosting`). */
  readonly authorUrl?: string | undefined;
  /** Rubrique de l'article (« Conseils déco »). */
  readonly section?: string | undefined;
}

export interface MetaProperty {
  readonly property: string;
  readonly content: string;
}

/**
 * Balises `article:*` (dates ISO 8601, mêmes valeurs que le JSON-LD `BlogPosting`) :
 * `modified_time` reprend la date de publication à défaut de mise à jour ; `author` (URL de la page
 * de l'auteur) et `section` si fournis ; un `article:tag` par mot-clé. Ordre du protocole Open Graph.
 */
export function buildArticleMetaTags(article: OpenGraphArticle): MetaProperty[] {
  const modified = article.modifiedTime ?? article.publishedTime;
  return [
    { property: 'article:published_time', content: article.publishedTime.toISOString() },
    { property: 'article:modified_time', content: modified.toISOString() },
    ...(article.authorUrl ? [{ property: 'article:author', content: article.authorUrl }] : []),
    ...(article.section ? [{ property: 'article:section', content: article.section }] : []),
    ...(article.tags ?? []).map((tag) => ({ property: 'article:tag', content: tag })),
  ];
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** Image candidate à l'Open Graph et son texte alternatif (`og:image:alt`). */
export interface OgImageChoice<Source extends ImageSize> {
  readonly source: Source;
  readonly alt: string;
}

/** Vrai si la source couvre la cible dans les deux dimensions (aucun agrandissement nécessaire). */
export function coversSize(source: ImageSize, target: ImageSize): boolean {
  return source.width >= target.width && source.height >= target.height;
}

/**
 * Image Open Graph retenue : la candidate de la page si elle couvre la cible, sinon l'image par
 * défaut (avec son propre `alt`). Le service sharp d'Astro n'agrandit jamais : une source plus
 * petite donnerait une image plus petite que les `og:image:width` / `og:image:height` annoncés.
 * L'image par défaut, elle, doit couvrir la cible : sinon erreur (le build échoue).
 */
export function pickOgImage<Source extends ImageSize>(
  candidate: OgImageChoice<Source> | undefined,
  fallback: OgImageChoice<Source>,
  target: ImageSize,
): OgImageChoice<Source> {
  if (!coversSize(fallback.source, target)) {
    throw new SeoValidationError(
      `Image Open Graph par défaut trop petite (${fallback.source.width} × ${fallback.source.height} px, minimum ${target.width} × ${target.height} px)\u00A0: fournir une source plus grande.`,
    );
  }
  return candidate && coversSize(candidate.source, target) ? candidate : fallback;
}
