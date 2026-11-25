/**
 * Conformité de l'image nginx du site (ADR-0020) avec Vercel : `npm run test:conformance -w @amg/site`
 * (conteneur démarré par container.ts). Requêtes HTTP réelles sur nginx ; attendu dérivé de
 * vercel.json (`resolveRedirect()`, simulation de Vercel) et des comportements relevés sur la
 * préversion Vercel (paramètres de requête conservés, `?` vide retiré, casse respectée).
 *
 * `VERCEL_REFERENCE_URL` (ex. l'URL de préversion) : compare en plus, en direct, un petit
 * échantillon de requêtes HEAD entre Vercel et nginx (une requête par chemin, pas de charge).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { describe, expect, inject, it } from 'vitest';
import {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  resolveRedirect,
  SITE_FILES,
  TRAILING_SLASH_REDIRECT,
  WWW_HOST,
  type VercelRedirect,
} from '../../src/lib/redirects';
import { SITE_ROUTES } from '../site-routes';

interface HeaderRule {
  source: string;
  has?: unknown[];
  headers: { key: string; value: string }[];
}

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

const vercel = JSON.parse(
  readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8'),
) as {
  redirects: VercelRedirect[];
  headers: HeaderRule[];
};
const DIST = new URL('../../dist/', import.meta.url);
const baseUrl = inject('baseUrl');

/** Requête HTTP brute : chemin envoyé tel quel (fetch le normaliserait), hôte au choix. */
function send(
  base: string,
  path: string,
  options: { method?: 'GET' | 'HEAD'; host?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const url = new URL(base);
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method: options.method ?? 'HEAD',
        headers: { host: options.host ?? url.host, ...options.headers },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body }),
        );
      },
    );
    outgoing.on('error', reject);
    outgoing.end();
  });
}

const nginx = (path: string, options?: Parameters<typeof send>[2]): Promise<Reply> =>
  send(baseUrl, path, options);

/** Redirection attendue de Vercel : 308, paramètres conservés, `?` vide retiré. */
function expectedRedirect(requestUri: string, host = CANONICAL_HOST): string | null {
  const [path = '', query] = requestUri.split(/\?(.*)/s);
  const destination = resolveRedirect(path, vercel.redirects, host);
  return destination === null ? null : `${destination}${query ? `?${query}` : ''}`;
}

/** Chemins couverts par une source Vercel (`:rest+` : un et plusieurs segments). */
function samplePaths(source: string): string[] {
  const rest = /^(.*)\/:rest\+(\/?)$/.exec(source);
  if (!rest) return [source];
  const [, prefix = '', slash = ''] = rest;
  return [`${prefix}/page${slash}`, `${prefix}/blog/page/2${slash}`];
}

const LEGACY_PATHS = vercel.redirects
  .filter((rule) => rule.has === undefined && rule.source !== TRAILING_SLASH_REDIRECT.source)
  .flatMap((rule) => samplePaths(rule.source));
const UTM = '?utm_source=newsletter&utm_medium=email&utm_campaign=conformite';

const SECURITY_HEADERS = new Map(
  (
    vercel.headers.find((rule) => rule.source === '/(.*)' && rule.has === undefined)?.headers ?? []
  ).map(({ key, value }) => [key.toLowerCase(), value]),
);
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';

function expectSecurityHeaders(reply: Reply, label: string): void {
  expect(SECURITY_HEADERS.size, 'règle globale de vercel.json').toBeGreaterThan(0);
  for (const [key, value] of SECURITY_HEADERS)
    expect(reply.headers[key], `${label} : ${key}`).toBe(value);
}

const distAssets = readdirSync(new URL('_astro/', DIST));
const assetOf = (extension: string): string => {
  const file = distAssets.find((name) => name.endsWith(extension));
  expect(file, `aucun fichier ${extension} dans dist/_astro`).toBeDefined();
  return `/_astro/${file ?? ''}`;
};
const iconSprite = readdirSync(DIST).find((name) => /^icons\..+\.svg$/.test(name));

describe('conteneur', () => {
  it('sonde /healthz : 200', async () => {
    expect((await nginx('/healthz', { method: 'GET' })).body).toBe('ok\n');
  });
});

describe('redirections de vercel.json', () => {
  it.each(LEGACY_PATHS)('%s : 308 et Location identiques à Vercel', async (path) => {
    const reply = await nginx(path);
    expect(reply.status).toBe(308);
    expect(reply.headers.location).toBe(expectedRedirect(path));
  });

  it.each(LEGACY_PATHS)('%s?utm_… : paramètres de requête conservés', async (path) => {
    const reply = await nginx(`${path}${UTM}`);
    expect(reply.status).toBe(308);
    expect(reply.headers.location).toBe(`${resolveRedirect(path, vercel.redirects) ?? ''}${UTM}`);
  });

  it.each(LEGACY_PATHS)('www%s?utm_… : un saut vers l’URL absolue du domaine nu', async (path) => {
    const reply = await nginx(`${path}${UTM}`, { host: WWW_HOST });
    expect(reply.status).toBe(308);
    expect(reply.headers.location).toBe(expectedRedirect(`${path}${UTM}`, WWW_HOST));
    expect(reply.headers.location).toMatch(new RegExp(`^${CANONICAL_ORIGIN}/`));
  });

  it.each([
    ['/prestations', '/prestations/'],
    ['/prestations?utm_source=x&a=%20b', '/prestations/?utm_source=x&a=%20b'],
    ['/prestations?', '/prestations/'],
    ['/services/?', '/prestations/'],
    ['/realisations/chalet-suisse', '/realisations/chalet-suisse/'],
    ['/caf%C3%A9?q=1', '/caf%C3%A9/?q=1'],
    ['/services/%3Fx', '/services/%3Fx/'],
    ['/a%0D%0ASet-Cookie:%20x', '/a%0D%0ASet-Cookie:%20x/'],
  ])('barre finale %s → %s (relevé sur Vercel)', async (path, location) => {
    const reply = await nginx(path);
    expect(reply.status).toBe(308);
    expect(reply.headers.location).toBe(location);
    expect(reply.headers['set-cookie']).toBeUndefined();
  });

  it.each(['/', '/prestations/', '/robots.txt', '/prestations?utm=1', '/_astro/x.css'])(
    'www%s : même chemin sur le domaine nu, en un saut',
    async (path) => {
      const reply = await nginx(path, { host: WWW_HOST });
      expect(reply.status).toBe(308);
      expect(reply.headers.location).toBe(expectedRedirect(path, WWW_HOST));
    },
  );

  it('redirections : en-têtes de sécurité présents (HSTS compris)', async () => {
    expectSecurityHeaders(await nginx('/services/'), '/services/');
  });
});

describe('pages et fichiers servis', () => {
  it.each([...SITE_ROUTES, ...SITE_FILES])(
    '%s : 200, en-têtes de sécurité et cache de Vercel',
    async (path) => {
      const reply = await nginx(path);
      expect(reply.status).toBe(200);
      expectSecurityHeaders(reply, path);
      expect(reply.headers['cache-control']).toBe(REVALIDATE);
      const type = path.endsWith('.txt')
        ? 'text/plain; charset=utf-8'
        : path.endsWith('.xml')
          ? /^(text|application)\/xml/
          : 'text/html; charset=utf-8';
      if (typeof type === 'string') expect(reply.headers['content-type']).toBe(type);
      else expect(reply.headers['content-type']).toMatch(type);
    },
  );

  it.each([
    '/SERVICES/',
    '/Prestations/',
    '/category/',
    '/.well-known/security.txt',
    '/_astro/',
    '/page-inconnue/',
    // Jamais `Location: /\evil.com/x/` (lu `//evil.com/x/` par les navigateurs : redirection ouverte).
    '/\\evil.com/x',
  ])('%s : 404 personnalisée, sans redirection (comme Vercel)', async (path) => {
    const reply = await nginx(path, { method: 'GET' });
    expect(reply.status).toBe(404);
    expect(reply.headers.location).toBeUndefined();
    expect(reply.headers['content-type']).toBe('text/html; charset=utf-8');
    expectSecurityHeaders(reply, path);
    const page = readFileSync(new URL('404.html', DIST), 'utf8');
    expect(reply.body).toBe(page);
  });

  it('fichier /_astro/ absent : 404 sans cache immuable (un déploiement suivant peut le créer)', async () => {
    const reply = await nginx('/_astro/absent.Zz99.js');
    expect(reply.status).toBe(404);
    expect(reply.headers['cache-control']).toBe(REVALIDATE);
  });
});

describe('fichiers versionnés', () => {
  it.each([
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.avif', 'image/avif'],
    ['.webp', 'image/webp'],
  ])('/_astro/*%s : 200, cache immuable d’un an, %s', async (extension, type) => {
    const reply = await nginx(assetOf(extension));
    expect(reply.status).toBe(200);
    expect(reply.headers['cache-control']).toBe(IMMUTABLE);
    expect(reply.headers['content-type']).toBe(type);
    expectSecurityHeaders(reply, extension);
  });

  it('sprite /icons.<version>.svg : cache immuable d’un an', async () => {
    expect(iconSprite).toBeDefined();
    const reply = await nginx(`/${iconSprite ?? ''}`);
    expect(reply.status).toBe(200);
    expect(reply.headers['cache-control']).toBe(IMMUTABLE);
  });

  it('CSS précompressée servie en gzip (gzip_static), Vary: Accept-Encoding', async () => {
    const reply = await nginx(assetOf('.css'), { headers: { 'accept-encoding': 'gzip' } });
    expect(reply.headers['content-encoding']).toBe('gzip');
    expect(reply.headers.vary).toContain('Accept-Encoding');
  });
});

/** Échantillon comparé en direct avec Vercel (codes, Location, en-têtes des réponses servies). */
const LIVE_SAMPLE = [
  '/services',
  '/services/?utm_source=x&a=b',
  '/services/?',
  '/projet-chalet?utm_medium=email',
  '/category/blog/page/2?x=1',
  '/prestations?utm=1',
  '/prestations?',
  '/caf%C3%A9?q=1',
  '/SERVICES/',
  '/page-inconnue/',
  '/',
  '/robots.txt',
];
const reference = process.env['VERCEL_REFERENCE_URL'];

describe.runIf(reference)('comparaison en direct avec Vercel (VERCEL_REFERENCE_URL)', () => {
  const COMPARED = ['cache-control', 'content-type', ...SECURITY_HEADERS.keys()];
  it.each(LIVE_SAMPLE)('%s : même réponse que Vercel', async (path) => {
    const [live, local] = await Promise.all([send(reference ?? '', path), nginx(path)]);
    expect(local.status, 'code').toBe(live.status);
    expect(local.headers.location, 'Location').toBe(live.headers.location);
    // Vercel n'ajoute pas les en-têtes de vercel.json aux redirections : comparés sur 200 et 404.
    if (live.status < 300 || live.status >= 400) {
      for (const key of COMPARED) expect(local.headers[key], key).toBe(live.headers[key]);
    }
  });
});
