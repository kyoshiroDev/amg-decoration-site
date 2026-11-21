import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildVercelRedirects,
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  resolveRedirect,
  SITE_FILES,
  WWW_HOST,
  type VercelRedirect,
} from '@/lib/redirects';
import { SITE_ROUTES } from '../site-routes';
import { publishedArticleRoutes } from '@/lib/article-files';

interface VercelConfig {
  trailingSlash?: boolean;
  redirects?: VercelRedirect[];
  headers?: unknown[];
}

const vercel = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig;
const redirects = buildVercelRedirects();

/**
 * Inventaire des URLs du site WordPress (docs/CONTENU-EXISTANT.md §1, relevé du 18/11/2026) :
 * les 26 URLs de contenu, puis le flux RSS et les 7 sitemaps, avec leur destination attendue.
 * `null` = URL conservée à l'identique (servie en 200).
 */
const LEGACY_URLS: Readonly<Record<string, string | null>> = {
  '/': null,
  '/services/': '/prestations/',
  '/about/': '/realisations/',
  '/a-propos/': null,
  '/contact/': null,
  '/politique-de-confidentialite/': '/mentions-legales/',
  '/conditions-generales-de-services-cgs/': '/conditions-generales/',
  '/projet-chalet/': '/realisations/chalet-suisse/',
  '/projet-lamyae/': '/realisations/piece-de-vie-bois-pierre/',
  '/projet-iryna/': '/realisations/espace-de-vie-scandinave/',
  '/projet_magali/': '/realisations/sous-sol-suite-parentale/',
  '/projet-1/': '/realisations/meuble-tv-sur-mesure/',
  '/projet-2/': '/realisations/sejour-verriere/',
  '/projet-3/': '/realisations/chambre-enfant-safari/',
  '/projet-4/': '/realisations/terrasse-pergola/',
  '/projet-5/': '/realisations/villa-mediterraneenne/',
  '/projet-6/': '/realisations/salon-cheminee/',
  '/projet-7/': '/realisations/chambre-enfant-dinosaures/',
  '/projet-marine/': '/realisations/piece-de-vie-boheme/',
  '/projet-marine-dupliquer-3417/': '/realisations/',
  '/projet-chambre-ado/': '/realisations/',
  '/projet-chambre-ado-dupliquer-3454/': '/realisations/',
  '/bonjour-tout-le-monde/': '/conseils-deco/',
  '/2593-2/': '/conseils-deco/',
  '/category/blog/': '/conseils-deco/',
  '/author/amgdecorationdinterieur-com/': '/a-propos/',
  '/feed/': '/conseils-deco/',
  '/sitemap.xml': '/sitemap-index.xml',
  '/sitemap_index.xml': '/sitemap-index.xml',
  '/wp-sitemap.xml': '/sitemap-index.xml',
  '/sitemap.rss': '/sitemap-index.xml',
  '/page-sitemap.xml': '/sitemap-index.xml',
  '/post-sitemap.xml': '/sitemap-index.xml',
  '/category-sitemap.xml': '/sitemap-index.xml',
};

/** Variantes relevées dans les liens du site actuel ou générées par WordPress. */
const LEGACY_VARIANTS: Readonly<Record<string, string>> = {
  '/projet-chalet': '/realisations/chalet-suisse/',
  '/projet-lamyae': '/realisations/piece-de-vie-bois-pierre/',
  '/projet-iryna': '/realisations/espace-de-vie-scandinave/',
  '/projet-iryna/projet-chalet': '/realisations/chalet-suisse/',
  '/services': '/prestations/',
  '/category/blog/page/2/': '/conseils-deco/',
  '/category/blog/feed/': '/conseils-deco/',
  '/author/amgdecorationdinterieur-com/feed/': '/a-propos/',
  '/feed/atom/': '/conseils-deco/',
  '/comments/feed/': '/conseils-deco/',
  '/bonjour-tout-le-monde/feed/': '/conseils-deco/',
};

const isServed = (path: string): boolean => SITE_ROUTES.includes(path) || SITE_FILES.includes(path);

describe('vercel.json', () => {
  it('contient exactement les redirections de src/lib/redirects.ts, dans le même ordre', () => {
    expect(vercel.redirects).toEqual(redirects);
  });

  it('ne déclare pas trailingSlash (sinon chaîne de redirections pour les URLs sans slash)', () => {
    expect(vercel.trailingSlash).toBeUndefined();
  });

  it('conserve les en-têtes de sécurité et de cache', () => {
    expect(JSON.stringify(vercel.headers)).toContain('Strict-Transport-Security');
    expect(JSON.stringify(vercel.headers)).toContain('immutable');
  });
});

describe('table des redirections', () => {
  it('ne contient que des redirections permanentes', () => {
    expect(redirects.every((rule) => rule.permanent)).toBe(true);
  });

  it('ne contient aucune source en double (par hôte)', () => {
    const keys = redirects.map((rule) => `${JSON.stringify(rule.has ?? [])} ${rule.source}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ne redirige aucune page du nouveau site', () => {
    for (const path of [...SITE_ROUTES, ...SITE_FILES]) {
      expect(resolveRedirect(path), path).toBeNull();
    }
  });

  it('pointe toujours vers une page du nouveau site, sans chaîne', () => {
    const fixed = redirects.filter((rule) => !rule.destination.includes(':'));
    for (const { source, destination } of fixed) {
      expect(isServed(destination), `${source} → ${destination}`).toBe(true);
      expect(resolveRedirect(destination), `chaîne depuis ${source}`).toBeNull();
    }
  });

  it('ajoute le slash final en un seul saut et épargne fichiers et chemins réservés', () => {
    expect(resolveRedirect('/prestations')).toBe('/prestations/');
    expect(resolveRedirect('/realisations/chalet-suisse')).toBe('/realisations/chalet-suisse/');
    expect(resolveRedirect('/_astro/index.B1x2.css')).toBeNull();
    expect(resolveRedirect('/robots.txt')).toBeNull();
    expect(resolveRedirect('/llms.txt')).toBeNull();
    expect(resolveRedirect('/.well-known/acme-challenge/jeton')).toBeNull();
    expect(resolveRedirect('/_vercel/insights/vitals')).toBeNull();
  });
});

describe('migration : chaque ancienne URL a une destination (200 ou 301 en un saut)', () => {
  it.each(Object.entries(LEGACY_URLS))('%s', (path, expected) => {
    const location = resolveRedirect(path);
    expect(location).toBe(expected);
    const final = location ?? path;
    expect(isServed(final), final).toBe(true);
    expect(resolveRedirect(final)).toBeNull();
  });

  it.each(Object.entries(LEGACY_URLS).filter(([path]) => path.length > 1 && path.endsWith('/')))(
    '%s sans slash final',
    (path, expected) => {
      const location = resolveRedirect(path.slice(0, -1));
      expect(location).toBe(expected ?? path);
      expect(resolveRedirect(location ?? '')).toBeNull();
    },
  );

  it.each(Object.entries(LEGACY_VARIANTS))('variante %s', (path, expected) => {
    expect(resolveRedirect(path)).toBe(expected);
    expect(resolveRedirect(expected)).toBeNull();
  });

  it('laisse en 404 l’administration et les médias WordPress (décision §3)', () => {
    expect(resolveRedirect('/wp-login.php')).toBeNull();
    expect(resolveRedirect('/wp-admin/')).toBeNull();
    expect(resolveRedirect('/wp-content/uploads/2026/04/chalet2.png')).toBeNull();
  });
});

describe('hôte www → domaine nu (301/308 en un seul saut)', () => {
  const www = (path: string): string | null => resolveRedirect(path, redirects, WWW_HOST);
  /** Chemin d'une destination absolue sur le domaine nu (sinon échec explicite). */
  const pathOf = (location: string | null): string => {
    expect(location?.startsWith(`${CANONICAL_ORIGIN}/`), String(location)).toBe(true);
    return new URL(location ?? '').pathname;
  };

  it('origine canonique alignée sur `site` (astro.config.mjs) et sur la condition `has`', () => {
    const config = readFileSync(new URL('../../astro.config.mjs', import.meta.url), 'utf8');
    expect(config).toContain(`const SITE = '${CANONICAL_ORIGIN}';`);
    expect(WWW_HOST).toBe(`www.${CANONICAL_HOST}`);
    const conditions = redirects.flatMap((rule) => rule.has ?? []);
    expect(new Set(conditions.map((c) => `${c.type}:${c.value}`))).toEqual(
      new Set(['host:www\\.amgdecorationdinterieur\\.com']),
    );
  });

  it('les règles www précèdent toutes les règles du domaine nu et finissent par un générique', () => {
    const firstCanonical = redirects.findIndex((rule) => !rule.has);
    const lastWww = redirects.findLastIndex((rule) => rule.has);
    expect(lastWww).toBe(firstCanonical - 1);
    expect(redirects[lastWww]).toMatchObject({
      source: '/:path(.*)',
      destination: `${CANONICAL_ORIGIN}/:path`,
    });
  });

  it('ne s’applique qu’à www : le domaine nu et les autres hôtes ne sont pas redirigés', () => {
    for (const path of [...SITE_ROUTES, ...SITE_FILES]) {
      expect(resolveRedirect(path, redirects, CANONICAL_HOST), path).toBeNull();
    }
    expect(resolveRedirect('/', redirects, 'amg-decoration.vercel.app')).toBeNull();
    expect(resolveRedirect('/', redirects, 'wwwXamgdecorationdinterieur.com')).toBeNull();
  });

  it('chaque page et fichier du site arrive sur la même URL du domaine nu', () => {
    for (const path of [...SITE_ROUTES, ...SITE_FILES]) {
      expect(www(path), path).toBe(`${CANONICAL_ORIGIN}${path}`);
    }
    expect(www('/_astro/index.B1x2.css')).toBe(`${CANONICAL_ORIGIN}/_astro/index.B1x2.css`);
  });

  it('URL sans slash final : slash ajouté dans le même saut', () => {
    expect(www('/prestations')).toBe(`${CANONICAL_ORIGIN}/prestations/`);
    expect(www('/realisations/chalet-suisse')).toBe(
      `${CANONICAL_ORIGIN}/realisations/chalet-suisse/`,
    );
  });

  it.each([...Object.keys(LEGACY_URLS), ...Object.keys(LEGACY_VARIANTS)])(
    'ancienne URL www %s : destination finale directe, sans chaîne',
    (path) => {
      const final = pathOf(www(path));
      expect(final).toBe(resolveRedirect(path) ?? path);
      expect(isServed(final), final).toBe(true);
      expect(resolveRedirect(final)).toBeNull();
    },
  );

  it('toutes les destinations www sont absolues et sur le domaine nu', () => {
    for (const rule of redirects.filter((candidate) => candidate.has)) {
      expect(rule.destination.startsWith(`${CANONICAL_ORIGIN}/`), rule.source).toBe(true);
    }
    for (const rule of redirects.filter((candidate) => !candidate.has)) {
      expect(rule.destination.startsWith('/'), rule.source).toBe(true);
    }
  });
});

describe('SITE_ROUTES', () => {
  it('contient les articles publiés, lus dans src/content/articles/, sans brouillon', () => {
    const articles = SITE_ROUTES.filter((path) => /^\/conseils-deco\/[^/]+\/$/.test(path));
    expect(articles).toEqual(publishedArticleRoutes());
    expect(articles.length).toBeGreaterThan(0);
    expect(articles).not.toContain('/conseils-deco/modele-article/');
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(SITE_ROUTES).size).toBe(SITE_ROUTES.length);
  });
});
