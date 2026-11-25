import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRedirectMap,
  REDIRECT_STATUS,
  toMapKey,
  TRAILING_SLASH_SOURCE,
  vercelStatus,
  WWW_CATCH_ALL_SOURCE,
  type VercelRedirect,
} from '../../scripts/nginx-redirects';
import {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  resolveRedirect,
  SITE_FILES,
  WWW_HOST,
  type VercelRedirect as SiteRedirect,
} from '@/lib/redirects';
import { SITE_ROUTES } from '../site-routes';

// Image du site pour le VPS (ADR-0020) : nginx reprend les redirections et les en-têtes de
// vercel.json. Ces tests rejouent nginx.conf + la table générée sur des chemins, et comparent à
// `resolveRedirect()` (simulation de Vercel, elle-même validée par redirects.test.ts).

interface HeaderRule {
  source: string;
  has?: unknown[];
  headers: { key: string; value: string }[];
}

const VERCEL_FILE = new URL('../../../../vercel.json', import.meta.url);
const vercel = JSON.parse(readFileSync(VERCEL_FILE, 'utf8')) as {
  redirects: SiteRedirect[];
  headers: HeaderRule[];
};
const nginxConf = readFileSync(new URL('../../nginx/nginx.conf', import.meta.url), 'utf8');
const generated = buildRedirectMap(vercel.redirects);
const canonicalRules = vercel.redirects.filter((rule) => rule.has === undefined);

/** Entrées `"~^…" "…";` d'un bloc `map`, dans l'ordre (nginx garde la première qui correspond). */
function parseRegexMap(text: string): { pattern: RegExp; value: string }[] {
  return [...text.matchAll(/^\s+"~([^"]+)"\s+"([^"]*)";$/gm)].map((match) => ({
    pattern: new RegExp(match[1] ?? ''),
    value: match[2] ?? '',
  }));
}

/** Bloc `map <source> <variable> { … }` de nginx.conf. */
function mapBlock(variable: string): string {
  const block = new RegExp(`map \\S+ \\${variable} \\{([^}]*)\\}`).exec(nginxConf);
  expect(block, `map ${variable} absent de nginx.conf`).not.toBeNull();
  return block?.[1] ?? '';
}

const redirectMap = parseRegexMap(generated);
const locationRoot = /location \/ \{([\s\S]*?)\n {4}\}/.exec(nginxConf)?.[1] ?? '';
const returns = [...locationRoot.matchAll(/return (\d+) (\S+);/g)].map((match) => ({
  status: Number(match[1]),
  target: match[2] ?? '',
}));
const trailingSlash = new RegExp(
  /if \(\$request_uri ~ "([^"]+)"\)/.exec(locationRoot)?.[1] ?? 'absent de nginx.conf',
);
const origins = new Map(
  [...mapBlock('$amg_origin').matchAll(/^\s+(\S+)\s+(https:\/\/\S+);$/gm)].map((match) => [
    match[1] ?? '',
    match[2] ?? '',
  ]),
);

/** Remplace les variables nginx (`$name`, `$1`) d'une cible de `return`. */
function interpolate(target: string, variables: Readonly<Record<string, string>>): string {
  return target.replace(/\$(\w+)/g, (_, name: string) => variables[name] ?? '');
}

/**
 * Rejoue `location /` de nginx.conf : table générée (sur `$uri`, décodé), puis barre finale
 * (sur `$request_uri`, brut), puis hôte www. `null` = servi tel quel.
 */
function nginxRedirect(
  requestUri: string,
  host = CANONICAL_HOST,
): { status: number; location: string } | null {
  const [path = '', query] = requestUri.split(/\?(.*)/s);
  const variables: Record<string, string> = {
    amg_origin: origins.get(host) ?? '',
    amg_redirect:
      redirectMap.find(({ pattern }) => pattern.test(decodeURIComponent(path)))?.value ?? '',
    is_args: query ? '?' : '',
    args: query ?? '',
    request_uri: requestUri,
  };
  const [toMap, toSlash, toWww] = returns;
  if (variables['amg_redirect'] && toMap) {
    return { status: toMap.status, location: interpolate(toMap.target, variables) };
  }
  const slash = trailingSlash.exec(requestUri);
  if (slash && toSlash) {
    const groups = { ...variables, 1: slash[1] ?? '', 2: slash[2] ?? '' };
    return { status: toSlash.status, location: interpolate(toSlash.target, groups) };
  }
  if (variables['amg_origin'] && toWww) {
    return { status: toWww.status, location: interpolate(toWww.target, variables) };
  }
  return null;
}

/** Ce que Vercel renvoie (relevé sur la preview) : paramètres conservés, `?` vide retiré. */
function vercelRedirect(
  requestUri: string,
  host = CANONICAL_HOST,
): { status: number; location: string } | null {
  const [path = '', query] = requestUri.split(/\?(.*)/s);
  const destination = resolveRedirect(path, vercel.redirects, host);
  if (destination === null) return null;
  return { status: 308, location: `${destination}${query ? `?${query}` : ''}` };
}

/** Chemins d'exemple couverts par une source Vercel (`:rest+` : un et deux segments). */
function samplePaths(source: string): string[] {
  const rest = /^(.*)\/:rest\+(\/?)$/.exec(source);
  if (!rest) return [source];
  const [, prefix = '', slash = ''] = rest;
  return [`${prefix}/page${slash}`, `${prefix}/blog/page/2${slash}`];
}

const LEGACY_PATHS = canonicalRules
  .filter((rule) => rule.source !== TRAILING_SLASH_SOURCE)
  .flatMap((rule) => samplePaths(rule.source));
const SERVED_PATHS = [
  ...SITE_ROUTES,
  ...SITE_FILES,
  '/404.html',
  '/_astro/page.Ab12Cd.css',
  '/icons.0a1b2c.svg',
];
const EDGE_PATHS = [
  '/prestations',
  '/realisations/chalet-suisse',
  '/SERVICES/',
  '/Projet-Chalet',
  '/category/',
  '/sitemap.xml/',
  '/robots.txt',
  '/.well-known/security.txt',
  '/.well-known/acme',
  '/_vercel/insights',
  '/caf%C3%A9',
  '/services/%3Fx',
  '/a%0D%0ASet-Cookie:x',
  '/wp-admin',
];

describe('nginx-redirects : table générée depuis vercel.json', () => {
  it('une entrée par règle du domaine nu, dans l’ordre de vercel.json, même destination', () => {
    const expected = canonicalRules
      .filter((rule) => rule.source !== TRAILING_SLASH_SOURCE)
      .map((rule) => [toMapKey(rule.source), `"${rule.destination}"`]);
    const lines = [...generated.matchAll(/^\s+("~[^"]+")\s+("[^"]*")\s*;$/gm)].map((match) => [
      match[1],
      match[2],
    ]);
    expect(lines).toEqual(expected);
    expect(generated).toMatch(/^map \$uri \$amg_redirect \{\n {2}default "";\n/m);
  });

  it('expressions sensibles à la casse (`~`, jamais `~*` ni clé exacte, insensible chez nginx)', () => {
    const keys = [...generated.matchAll(/^\s+(\S+)\s/gm)].map((match) => match[1]);
    for (const key of keys.filter((key) => key !== 'default')) {
      expect(key, key).toMatch(/^"~\^[^*]/);
    }
  });

  it('le script en ligne de commande écrit exactement la table de buildRedirectMap()', () => {
    const script = fileURLToPath(new URL('../../scripts/nginx-redirects.ts', import.meta.url));
    const output = execFileSync(process.execPath, [script, fileURLToPath(VERCEL_FILE)], {
      encoding: 'utf8',
    });
    expect(output).toBe(generated);
  });
});

describe('nginx-redirects : même réponse que Vercel', () => {
  it('chaque ancienne URL (avec et sans barre finale) : 308 vers la même destination', () => {
    for (const path of LEGACY_PATHS) {
      const expected = vercelRedirect(path);
      expect(expected, path).not.toBeNull();
      expect(nginxRedirect(path), path).toEqual(expected);
    }
  });

  it('pages, fichiers et cas limites : redirigés ou servis exactement comme chez Vercel', () => {
    for (const path of [...SERVED_PATHS, ...EDGE_PATHS]) {
      expect(nginxRedirect(path), path).toEqual(vercelRedirect(path));
    }
    for (const path of SERVED_PATHS) expect(nginxRedirect(path), path).toBeNull();
  });

  it('paramètres de requête (UTM) conservés sur chaque type de redirection, `?` vide retiré', () => {
    const query = '?utm_source=newsletter&utm_medium=email&a=%20b';
    for (const path of [...LEGACY_PATHS, '/prestations', '/caf%C3%A9']) {
      expect(nginxRedirect(`${path}${query}`), path).toEqual(vercelRedirect(`${path}${query}`));
      expect(nginxRedirect(`${path}${query}`)?.location, path).toMatch(
        /\?utm_source=newsletter&utm_medium=email&a=%20b$/,
      );
    }
    expect(nginxRedirect('/services/?')).toEqual({ status: 308, location: '/prestations/' });
    expect(nginxRedirect('/prestations?')).toEqual({ status: 308, location: '/prestations/' });
  });

  it('hôte www : un seul saut vers l’URL finale absolue du domaine nu, paramètres compris', () => {
    for (const path of [...LEGACY_PATHS, ...SERVED_PATHS, ...EDGE_PATHS, '/prestations?utm=1']) {
      const expected = vercelRedirect(path, WWW_HOST);
      expect(expected?.location, path).toMatch(new RegExp(`^${CANONICAL_ORIGIN}/`));
      expect(nginxRedirect(path, WWW_HOST), path).toEqual(expected);
    }
  });

  it('chemin brut conservé dans Location : aucun saut de ligne décodé (injection d’en-tête)', () => {
    expect(nginxRedirect('/a%0D%0ASet-Cookie:x')?.location).toBe('/a%0D%0ASet-Cookie:x/');
    expect(nginxRedirect('/caf%C3%A9?q=1')?.location).toBe('/caf%C3%A9/?q=1');
  });

  it('un seul code, 308 (`permanent: true` chez Vercel), sur les trois `return` de nginx.conf', () => {
    expect(returns.map(({ status }) => status)).toEqual([
      REDIRECT_STATUS,
      REDIRECT_STATUS,
      REDIRECT_STATUS,
    ]);
    for (const rule of vercel.redirects)
      expect(vercelStatus(rule), rule.source).toBe(REDIRECT_STATUS);
  });

  it('hôte www de nginx.conf = condition `has` de vercel.json, origine = domaine canonique', () => {
    expect([...origins]).toEqual([[WWW_HOST, CANONICAL_ORIGIN]]);
    const hostConditions = new Set(
      vercel.redirects.flatMap((rule) => rule.has ?? []).map((condition) => condition.value),
    );
    expect(hostConditions.size).toBe(1);
    const [hostPattern = ''] = hostConditions;
    expect(new RegExp(`^${hostPattern}$`).test(WWW_HOST)).toBe(true);
  });
});

describe('nginx-redirects : traduction des sources (échappement)', () => {
  it('chemin littéral : expression ancrée, points et caractères spéciaux échappés', () => {
    expect(toMapKey('/sitemap.xml')).toBe('"~^/sitemap\\.xml$"');
    expect(toMapKey('/projet_magali/')).toBe('"~^/projet_magali/$"');
    expect(toMapKey('/a[b]{c}|d^e')).toBe('"~^/a\\[b\\]\\{c\\}\\|d\\^e$"');
    const sitemap = new RegExp(toMapKey('/sitemap.xml').slice(2, -1));
    expect(sitemap.test('/sitemap.xml')).toBe(true);
    expect(sitemap.test('/sitemapXxml')).toBe(false);
    expect(sitemap.test('/sitemap.xml/extra')).toBe(false);
  });

  it('source encodée : comparée au chemin décodé ($uri)', () => {
    expect(toMapKey('/d%C3%A9co/')).toBe('"~^/déco/$"');
  });

  it('`:rest+` : un ou plusieurs segments non vides, barre finale selon la source', () => {
    const without = new RegExp(toMapKey('/category/:rest+').slice(2, -1));
    const withSlash = new RegExp(toMapKey('/category/:rest+/').slice(2, -1));
    expect(['/category/a', '/category/a/b'].every((path) => without.test(path))).toBe(true);
    expect(
      ['/category/', '/category/a/', '/category//a', '/categoryx/a'].some((path) =>
        without.test(path),
      ),
    ).toBe(false);
    expect(withSlash.test('/category/a/b/')).toBe(true);
    expect(withSlash.test('/category/a')).toBe(false);
  });

  it.each([
    ['/a b', 'espace'],
    ['/a"b', 'guillemet'],
    ['/a\\b', 'barre oblique inverse'],
    ['/a$b', 'variable nginx'],
    ['/a%0Ab', 'saut de ligne encodé'],
    ['/a%ZZ', 'encodage invalide'],
    ['/:slug', 'paramètre nommé'],
    ['/:path(.*)', 'expression'],
    ['/a/:rest*', 'répétition facultative'],
    ['/a?b=1', 'requête'],
    ['relative', 'chemin relatif'],
  ])('source refusée : %s (%s)', (source) => {
    expect(() => toMapKey(source)).toThrow(/Source Vercel/);
  });
});

/** vercel.json minimal : règles données, puis la règle « barre finale ». */
function withTrailing(...rules: VercelRedirect[]): VercelRedirect[] {
  return [...rules, { source: TRAILING_SLASH_SOURCE, destination: '/:path/', permanent: true }];
}
const rule = (
  source: string,
  destination: string,
  extra: Partial<VercelRedirect> = {},
): VercelRedirect => ({
  source,
  destination,
  permanent: true,
  ...extra,
});

describe('nginx-redirects : ordre et garde-fous', () => {
  it('règles qui se recouvrent : la première de vercel.json l’emporte', () => {
    const map = parseRegexMap(
      buildRedirectMap(
        withTrailing(
          rule('/category/:rest+', '/conseils-deco/'),
          rule('/category/blog', '/a-propos/'),
        ),
      ),
    );
    expect(map.find(({ pattern }) => pattern.test('/category/blog'))?.value).toBe(
      '/conseils-deco/',
    );
  });

  it('même source deux fois : seule la première est écrite', () => {
    const output = buildRedirectMap(withTrailing(rule('/a', '/b/'), rule('/a', '/c/')));
    expect(output).toContain('"~^/a$" "/b/";');
    expect(output).not.toContain('/c/');
  });

  it('code autre que 308 refusé (nginx.conf ne sait renvoyer que 308)', () => {
    expect(() => buildRedirectMap(withTrailing(rule('/a', '/b/', { permanent: false })))).toThrow(
      /307/,
    );
    expect(() => buildRedirectMap(withTrailing(rule('/a', '/b/', { statusCode: 301 })))).toThrow(
      /301/,
    );
    expect(buildRedirectMap(withTrailing(rule('/a', '/b/', { statusCode: 308 })))).toContain(
      '"~^/a$"',
    );
  });

  it('règle « barre finale » absente ou suivie d’une autre règle : refusé', () => {
    expect(() => buildRedirectMap([rule('/a', '/b/')])).toThrow(/absente/);
    expect(() => buildRedirectMap([...withTrailing(), rule('/a', '/b/')])).toThrow(/dernière/);
  });

  it.each([
    ['https://ailleurs.example/', 'absolue'],
    ['//ailleurs.example/', 'protocole relatif'],
    ['/$host/', 'variable nginx'],
    ['/a"b/', 'guillemet'],
    ['/b/?x=1', 'requête'],
    ['/:path/', 'paramètre'],
  ])('destination refusée : %s (%s)', (destination) => {
    expect(() => buildRedirectMap(withTrailing(rule('/a', destination)))).toThrow(/Destination/);
  });

  it('règles www qui ne reprennent pas exactement celles du domaine nu : refusé', () => {
    const has = [{ type: 'host', value: 'www\\.example\\.com' }];
    const canonical = withTrailing(rule('/a', '/b/'));
    const mirror = [
      ...canonical.map((entry) =>
        rule(entry.source, `https://example.com${entry.destination}`, { has }),
      ),
      rule(WWW_CATCH_ALL_SOURCE, 'https://example.com/:path', { has }),
    ];
    expect(buildRedirectMap([...mirror, ...canonical])).toContain('"~^/a$" "/b/";');
    expect(() => buildRedirectMap([...mirror.slice(1), ...canonical])).toThrow(/www/);
    expect(() => buildRedirectMap([...mirror.slice(0, -1), ...canonical])).toThrow(/www/);
    const otherHost = mirror.map((entry, index) =>
      index === 0 ? { ...entry, has: [{ type: 'host', value: 'autre\\.example\\.com' }] } : entry,
    );
    expect(() => buildRedirectMap([...otherHost, ...canonical])).toThrow(/www/);
    const header = mirror.map((entry) => ({
      ...entry,
      has: [{ type: 'header', key: 'x-a', value: '1' }],
    }));
    expect(() => buildRedirectMap([...header, ...canonical])).toThrow(/www/);
  });
});

describe('nginx.conf : en-têtes de vercel.json repris', () => {
  const serverHeaders = new Map(
    [...nginxConf.matchAll(/^ {4}add_header (\S+) "([^"]*)" always;$/gm)].map((match) => [
      (match[1] ?? '').toLowerCase(),
      match[2] ?? '',
    ]),
  );

  it('en-têtes de sécurité (CSP, HSTS, etc.) : mêmes valeurs que la règle globale de vercel.json', () => {
    const global = vercel.headers.find(
      (entry) => entry.source === '/(.*)' && entry.has === undefined,
    );
    expect(global).toBeDefined();
    for (const { key, value } of global?.headers ?? []) {
      expect(serverHeaders.get(key.toLowerCase()), key).toBe(value);
    }
    expect([...serverHeaders.keys()].sort()).toEqual(
      (global?.headers ?? []).map(({ key }) => key.toLowerCase()).sort(),
    );
  });

  it('en-têtes posés au niveau serveur seulement, avec `always` (404 et redirections compris)', () => {
    // Un add_header dans une location annulerait tous ceux du serveur pour cette location.
    expect(nginxConf.match(/^\s*add_header\s/gm)?.length).toBe(serverHeaders.size + 1);
    expect(nginxConf).toMatch(/^ {4}add_header Cache-Control \$amg_cache_control always;$/m);
  });

  it('Cache-Control : immuable pour les fichiers versionnés, sinon la valeur par défaut de Vercel', () => {
    const block = mapBlock('$amg_cache_control');
    const map = parseRegexMap(block);
    const defaultValue = /default "([^"]*)";/.exec(block)?.[1];
    const cacheOf = (path: string): string | undefined =>
      map.find(({ pattern }) => pattern.test(path))?.value ?? defaultValue;
    const rules = vercel.headers.filter((entry) =>
      entry.headers.some(({ key }) => key.toLowerCase() === 'cache-control'),
    );
    const samples: Readonly<Record<string, string>> = {
      '/_astro/(.*)': '/_astro/page.Ab12Cd.css',
      '/icons.(.*).svg': '/icons.0a1b2c.svg',
    };
    expect(rules.map(({ source }) => source).sort()).toEqual(Object.keys(samples).sort());
    for (const entry of rules) {
      const value = entry.headers.find(({ key }) => key.toLowerCase() === 'cache-control')?.value;
      expect(cacheOf(samples[entry.source] ?? ''), entry.source).toBe(value);
    }
    for (const path of ['/', '/prestations/', '/robots.txt', '/icons.svg', '/favicon.svg']) {
      expect(cacheOf(path), path).toBe('public, max-age=0, must-revalidate');
    }
  });

  it('Content-Type texte en UTF-8 (robots.txt, llms.txt) comme vercel.json', () => {
    const textRules = vercel.headers.filter((entry) =>
      entry.headers.some(
        ({ key, value }) =>
          key.toLowerCase() === 'content-type' && value === 'text/plain; charset=utf-8',
      ),
    );
    expect(textRules.map(({ source }) => source).sort()).toEqual(['/llms.txt', '/robots.txt']);
    expect(nginxConf).toMatch(/^\s+charset utf-8;$/m);
    expect(/^\s+charset_types ([^;]+);$/m.exec(nginxConf)?.[1]?.split(' ')).toContain('text/plain');
  });

  it('seule règle non reprise : X-Robots-Tag des préversions *.vercel.app (préproduction : Traefik)', () => {
    const conditional = vercel.headers.filter((entry) => entry.has !== undefined);
    expect(conditional.flatMap((entry) => entry.headers.map(({ key }) => key))).toEqual([
      'X-Robots-Tag',
    ]);
    expect(JSON.stringify(conditional[0]?.has)).toContain('vercel\\\\.app');
  });
});
