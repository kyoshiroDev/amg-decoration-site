/**
 * Redirections 301/308 de la migration WordPress → Astro (docs/SEO-STRATEGIE.md §3).
 *
 * SOURCE DE VÉRITÉ : `vercel.json` → `redirects` doit être égal à `buildVercelRedirects()`
 * (vérifié par tests/unit/redirects.test.ts).
 *
 * Pourquoi `vercel.json` n'a plus `trailingSlash: true` : Vercel place la règle d'ajout du
 * slash final AVANT les `redirects` (@vercel/routing-utils, `getTransformedRoutes`). Une
 * ancienne URL sans slash (`/projet-chalet`, utilisée par l'accueil WordPress) ferait donc
 * deux sauts : `/projet-chalet` → `/projet-chalet/` → `/realisations/chalet-suisse/`.
 * On reproduit la normalisation en DERNIÈRE redirection (`TRAILING_SLASH_REDIRECT`), après
 * les anciennes URLs déclarées avec et sans slash : chaque ancienne URL arrive en un saut.
 *
 * Hôte `www` : toutes les règles sont d'abord déclinées pour `www.` avec une destination
 * ABSOLUE sur le domaine nu (`WWW_REDIRECTS`), puis une règle générique renvoie le reste de
 * `www.` vers le même chemin du domaine nu. `www.…/projet-chalet` arrive donc en un saut sur
 * `https://amgdecorationdinterieur.com/realisations/chalet-suisse/` (jamais www → nu → page).
 */

/** Condition Vercel `has` sur l'hôte (`value` : expression régulière ancrée par Vercel). */
export interface HostCondition {
  type: 'host';
  value: string;
}

export interface VercelRedirect {
  source: string;
  destination: string;
  permanent: true;
  has?: HostCondition[];
}

/** Origine canonique (domaine nu, HTTPS) : même valeur que `site` dans astro.config.mjs. */
export const CANONICAL_ORIGIN = 'https://amgdecorationdinterieur.com';

/** Hôte canonique servi sans redirection. */
export const CANONICAL_HOST = new URL(CANONICAL_ORIGIN).host;

/** Hôte `www` redirigé en 301/308 vers le domaine nu. */
export const WWW_HOST = `www.${CANONICAL_HOST}`;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WWW_CONDITION: HostCondition = { type: 'host', value: escapeRegExp(WWW_HOST) };

/** Slugs des 4 réalisations migrées (décision SEO, Phase 3). */
export const PROJECT_SLUGS = {
  chalet: 'chalet-suisse',
  lamyae: 'piece-de-vie-bois-pierre',
  iryna: 'espace-de-vie-scandinave',
  magali: 'sous-sol-suite-parentale',
} as const;

const project = (slug: string): string => `/realisations/${slug}/`;

/**
 * Pages du nouveau site (toutes servies en 200, slash final). Fonction PURE : les routes des
 * articles publiés sont fournies par l'appelant (`publishedArticleRoutes()` de
 * `article-files.ts`, qui lit src/content/articles/ ; voir tests/site-routes.ts), jamais
 * recopiées à la main.
 */
export function siteRoutes(articleRoutes: readonly string[]): readonly string[] {
  return [
    '/',
    '/prestations/',
    '/prestations/essentiel/',
    '/prestations/confort/',
    '/prestations/signature/',
    '/prestations/studio/',
    '/prestations/meuble-sur-mesure/',
    '/prestations/professionnels/',
    '/visualisation-3d/',
    '/realisations/',
    ...Object.values(PROJECT_SLUGS).map(project),
    '/a-propos/',
    '/conseils-deco/',
    ...articleRoutes,
    '/contact/',
    '/mentions-legales/',
    '/confidentialite/',
    '/conditions-generales/',
  ];
}

/** Fichiers techniques générés au build (sitemap Astro, robots.txt, llms.txt). */
export const SITE_FILES: readonly string[] = ['/sitemap-index.xml', '/robots.txt', '/llms.txt'];

const OLD_PROJECTS_WITHOUT_TEXT = [
  '/projet-1/',
  '/projet-2/',
  '/projet-3/',
  '/projet-4/',
  '/projet-5/',
  '/projet-6/',
  '/projet-7/',
  '/projet-marine/',
  '/projet-marine-dupliquer-3417/',
  '/projet-chambre-ado/',
  '/projet-chambre-ado-dupliquer-3454/',
] as const;

/**
 * Anciennes pages WordPress → nouvelle URL. Clés avec slash final ; la variante sans slash
 * est générée automatiquement.
 */
export const PAGE_REDIRECTS: Readonly<Record<string, string>> = {
  '/services/': '/prestations/',
  '/about/': '/realisations/',
  '/politique-de-confidentialite/': '/mentions-legales/',
  '/conditions-generales-de-services-cgs/': '/conditions-generales/',
  '/projet-chalet/': project(PROJECT_SLUGS.chalet),
  // Lien cassé de l'ancienne page Réalisations (`/about/`).
  '/projet-iryna/projet-chalet/': project(PROJECT_SLUGS.chalet),
  '/projet-lamyae/': project(PROJECT_SLUGS.lamyae),
  '/projet-iryna/': project(PROJECT_SLUGS.iryna),
  '/projet_magali/': project(PROJECT_SLUGS.magali),
  ...Object.fromEntries(OLD_PROJECTS_WITHOUT_TEXT.map((path) => [path, '/realisations/'])),
  '/bonjour-tout-le-monde/': '/conseils-deco/',
  '/2593-2/': '/conseils-deco/',
  '/category/blog/': '/conseils-deco/',
  '/author/amgdecorationdinterieur-com/': '/a-propos/',
  // Flux RSS WordPress : pas de flux sur le nouveau site, on envoie vers le blog.
  '/feed/': '/conseils-deco/',
  '/comments/feed/': '/conseils-deco/',
  '/bonjour-tout-le-monde/feed/': '/conseils-deco/',
  '/2593-2/feed/': '/conseils-deco/',
};

/**
 * Sous-arborescences WordPress (pagination, flux de catégorie / d'auteur, variantes de flux).
 * `/:rest+` = un ou plusieurs segments (syntaxe path-to-regexp de Vercel) ; règle déclinée
 * avec et sans slash final.
 */
export const PREFIX_REDIRECTS: Readonly<Record<string, string>> = {
  '/category': '/conseils-deco/',
  '/author': '/a-propos/',
  '/feed': '/conseils-deco/',
};

/** Anciens sitemaps et flux de sitemap (fichiers : pas de variante slash). */
export const FILE_REDIRECTS: Readonly<Record<string, string>> = {
  '/sitemap.xml': '/sitemap-index.xml',
  '/sitemap_index.xml': '/sitemap-index.xml',
  '/wp-sitemap.xml': '/sitemap-index.xml',
  '/page-sitemap.xml': '/sitemap-index.xml',
  '/post-sitemap.xml': '/sitemap-index.xml',
  '/category-sitemap.xml': '/sitemap-index.xml',
  '/sitemap.rss': '/sitemap-index.xml',
};

/**
 * Équivalent de `trailingSlash: true` de Vercel, en dernière position : tout chemin dont le
 * dernier segment n'a ni point ni slash final reçoit un `/` (hors `/.well-known/` et `/_vercel/`).
 */
export const TRAILING_SLASH_REDIRECT: VercelRedirect = {
  source: '/:path((?!(?:\\.well-known|_vercel)/)(?:[^/]+/)*[^/.]+)',
  destination: '/:path/',
  permanent: true,
};

const redirect = (source: string, destination: string): VercelRedirect => ({
  source,
  destination,
  permanent: true,
});

/** Règles servies sur le domaine nu (chemins relatifs), dans l'ordre d'évaluation. */
function canonicalRedirects(): VercelRedirect[] {
  const pages = Object.entries(PAGE_REDIRECTS).flatMap(([source, destination]) => [
    redirect(source, destination),
    redirect(source.slice(0, -1), destination),
  ]);
  const prefixes = Object.entries(PREFIX_REDIRECTS).flatMap(([prefix, destination]) => [
    redirect(`${prefix}/:rest+`, destination),
    redirect(`${prefix}/:rest+/`, destination),
  ]);
  const files = Object.entries(FILE_REDIRECTS).map(([source, destination]) =>
    redirect(source, destination),
  );
  return [...pages, ...prefixes, ...files, TRAILING_SLASH_REDIRECT];
}

/**
 * Mêmes règles pour l'hôte `www`, destination absolue sur le domaine nu, puis le reste de
 * `www.` vers le même chemin (`/:path(.*)` couvre aussi `/`, `/robots.txt`, `/_astro/…`).
 */
export function buildWwwRedirects(canonical: readonly VercelRedirect[]): VercelRedirect[] {
  const absolute = canonical.map((rule) => ({
    ...redirect(rule.source, `${CANONICAL_ORIGIN}${rule.destination}`),
    has: [WWW_CONDITION],
  }));
  const rest: VercelRedirect = {
    ...redirect('/:path(.*)', `${CANONICAL_ORIGIN}/:path`),
    has: [WWW_CONDITION],
  };
  return [...absolute, rest];
}

/** Tableau `redirects` exact attendu dans `vercel.json` (l'ordre compte : première règle gagnante). */
export function buildVercelRedirects(): VercelRedirect[] {
  const canonical = canonicalRedirects();
  return [...buildWwwRedirects(canonical), ...canonical];
}

/**
 * Compile le sous-ensemble de path-to-regexp utilisé ici (littéraux, `:name+` en fin de
 * chemin, `:name(regex)`), en mode strict et sensible à la casse comme Vercel.
 */
function compileSource(source: string): RegExp {
  let pattern = '';
  let rest = source;
  while (rest.length > 0) {
    const custom = /^:(\w+)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/.exec(rest);
    const repeat = /^\/:(\w+)\+/.exec(rest);
    if (custom) {
      pattern += `(${custom[2] ?? ''})`;
      rest = rest.slice(custom[0].length);
    } else if (repeat) {
      pattern += '\\/([^/]+(?:\\/[^/]+)*)';
      rest = rest.slice(repeat[0].length);
    } else {
      pattern += escapeRegExp(rest.charAt(0));
      rest = rest.slice(1);
    }
  }
  return new RegExp(`^${pattern}$`);
}

/** Une règle s'applique-t-elle à cet hôte ? (`has` absent = tous les hôtes). */
function hostMatches(rule: VercelRedirect, host: string): boolean {
  return (rule.has ?? []).every((condition) => new RegExp(`^${condition.value}$`).test(host));
}

/**
 * Résout un chemin comme le ferait Vercel avec ces redirections : renvoie la destination de
 * la première règle qui correspond (chemin, ou URL absolue pour l'hôte `www`), ou `null` si
 * le chemin est servi tel quel. `host` : hôte de la requête (domaine nu par défaut).
 */
export function resolveRedirect(
  path: string,
  redirects: readonly VercelRedirect[] = buildVercelRedirects(),
  host: string = CANONICAL_HOST,
): string | null {
  for (const rule of redirects) {
    if (!hostMatches(rule, host)) continue;
    const match = compileSource(rule.source).exec(path);
    if (match) {
      const captured = match[1] ?? '';
      return rule.destination.replace(/:\w+/, captured);
    }
  }
  return null;
}
