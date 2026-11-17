/**
 * Utilitaires d'URL purs. Le site utilise `trailingSlash: 'always'` :
 * toute URL interne de page se termine par `/` (sauf les fichiers avec extension).
 */

const FILE_EXTENSION = /\.[a-z0-9]+$/i;

/** Ajoute un `/` final au chemin d'une page, en conservant query string et ancre. */
export function withTrailingSlash(path: string): string {
  const match = /^([^?#]*)(.*)$/.exec(path);
  const pathname = match?.[1] ?? '';
  const rest = match?.[2] ?? '';
  if (pathname === '' || pathname.endsWith('/') || FILE_EXTENSION.test(pathname)) {
    return `${pathname || '/'}${rest}`;
  }
  return `${pathname}/${rest}`;
}

/** Construit une URL absolue canonique à partir de l'origine du site et d'un chemin. */
export function absoluteUrl(path: string, site: string | URL): string {
  return new URL(withTrailingSlash(path), site).href;
}
