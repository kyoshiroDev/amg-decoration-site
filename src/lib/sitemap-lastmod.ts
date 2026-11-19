/**
 * `lastmod` du sitemap (docs/SEO-STRATEGIE.md § 4 bis), uniquement à partir de dates RÉELLES du
 * contenu : `updatedAt`, sinon `publishedAt`, des articles publiés. Les réalisations et les
 * pages n'ont pas de date dans leur contenu : pas de `lastmod` (mieux vaut aucune date qu'une
 * date de build, que Google apprend à ignorer). Fonctions PURES, utilisées par astro.config.mjs
 * (sans alias d'import : ce fichier est chargé avant la configuration de Vite).
 */
import { articlePath } from './routes';

export interface ArticleSource {
  /** Nom du fichier sans extension (= slug de l'URL). */
  readonly slug: string;
  /** Contenu brut du fichier `.md` / `.mdx`. */
  readonly source: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valeur scalaire d'une clé de premier niveau du frontmatter YAML (guillemets retirés). */
function frontmatterValue(source: string, key: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  const line = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(frontmatter)?.[1];
  const value = line
    ?.replace(/\s+#.*$/, '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
  return value === '' ? undefined : value;
}

/** Date de dernière modification d'un article (AAAA-MM-JJ), absente pour un brouillon. */
export function articleLastmod(source: string): string | undefined {
  if (frontmatterValue(source, 'draft') === 'true') return undefined;
  const date = frontmatterValue(source, 'updatedAt') ?? frontmatterValue(source, 'publishedAt');
  return date && ISO_DATE.test(date) ? date : undefined;
}

/**
 * URL absolue → `lastmod` : chaque article publié, et l'index `/conseils-deco/` à la date de
 * l'article le plus récemment modifié (sa liste change à ce moment-là).
 */
export function buildLastmodMap(
  articles: readonly ArticleSource[],
  origin: string,
): Map<string, string> {
  const map = new Map<string, string>();
  let latest: string | undefined;
  for (const { slug, source } of articles) {
    const date = articleLastmod(source);
    if (!date) continue;
    map.set(new URL(articlePath(slug), origin).href, date);
    if (!latest || date > latest) latest = date;
  }
  if (latest) map.set(new URL('/conseils-deco/', origin).href, latest);
  return map;
}
