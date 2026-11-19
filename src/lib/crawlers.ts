/**
 * Fichiers destinés aux robots (fonctions PURES, tests/unit/crawlers.test.ts) : `robots.txt`
 * et `llms.txt`, servis par les endpoints statiques src/pages/robots.txt.ts et llms.txt.ts.
 * Décisions : docs/decisions/0011-seo-avance-og-robots-llms.md.
 */

export interface RobotsTxtInput {
  /** URL ABSOLUE de l'index des sitemaps (`https://domaine/sitemap-index.xml`). */
  readonly sitemapUrl: string;
}

/** Vérifie qu'une URL est absolue en http(s) ; sinon lève une erreur (le build échoue). */
function assertAbsoluteUrl(url: string, context: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${context}\u00A0: URL absolue attendue, reçu «\u00A0${url}\u00A0».`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${context}\u00A0: URL http(s) attendue, reçu «\u00A0${url}\u00A0».`);
  }
  return parsed.href;
}

/**
 * `robots.txt` : tout est autorisé, aucun `Disallow` (les pages `noindex` doivent rester
 * explorables pour que la directive soit lue ; rien d'autre n'est à cacher sur un site statique).
 */
export function buildRobotsTxt(input: RobotsTxtInput): string {
  const sitemap = assertAbsoluteUrl(input.sitemapUrl, 'robots.txt, Sitemap');
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
}
