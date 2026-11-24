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

export interface LlmsLink {
  readonly title: string;
  /** URL ABSOLUE de la page. */
  readonly url: string;
  readonly description?: string | undefined;
}

export interface LlmsSection {
  readonly title: string;
  readonly links: readonly LlmsLink[];
}

/** Contenu d'un `llms.txt` (spécification https://llmstxt.org). */
export interface LlmsTxtInput {
  /** Titre H1 : nom du site ou de l'entreprise (seul élément obligatoire de la spécification). */
  readonly name: string;
  /** Résumé en citation, juste sous le titre. */
  readonly summary: string;
  /** Paragraphes d'informations complémentaires (texte brut, sans titre). */
  readonly details: readonly string[];
  /** Sections H2 de liens ; une section vide est omise. */
  readonly sections: readonly LlmsSection[];
  /** Liens secondaires, sous la section `## Optional` que les outils peuvent ignorer. */
  readonly optional: readonly LlmsLink[];
}

/** Texte sur une ligne : espaces et sauts de ligne réduits à une espace. */
function inline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Intitulé de lien Markdown : crochets échappés. */
function linkLabel(text: string): string {
  return inline(text).replace(/[[\]]/g, (char) => `\\${char}`);
}

function linkLine(link: LlmsLink): string {
  const url = assertAbsoluteUrl(link.url, `llms.txt, lien « ${inline(link.title)} »`);
  const description = link.description ? `: ${inline(link.description)}` : '';
  return `- [${linkLabel(link.title)}](${url})${description}`;
}

function sectionBlock(title: string, links: readonly LlmsLink[]): string[] {
  return links.length === 0 ? [] : [`## ${inline(title)}`, links.map(linkLine).join('\n')];
}

/**
 * `llms.txt` : H1, résumé en citation, paragraphes, sections H2 de listes de liens
 * `- [titre](url): description`, puis `## Optional`. Blocs séparés par une ligne vide.
 */
export function buildLlmsTxt(input: LlmsTxtInput): string {
  const name = inline(input.name);
  if (name === '') throw new Error('llms.txt\u00A0: le titre (nom du site) est obligatoire.');
  const blocks = [
    `# ${name}`,
    `> ${inline(input.summary)}`,
    ...input.details.map(inline).filter((text) => text !== ''),
    ...input.sections.flatMap((section) => sectionBlock(section.title, section.links)),
    ...sectionBlock('Optional', input.optional),
  ];
  return `${blocks.join('\n\n')}\n`;
}
