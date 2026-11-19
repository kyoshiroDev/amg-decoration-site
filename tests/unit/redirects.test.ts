import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildVercelRedirects,
  resolveRedirect,
  SITE_FILES,
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
  '/projet-1/': '/realisations/',
  '/projet-2/': '/realisations/',
  '/projet-3/': '/realisations/',
  '/projet-4/': '/realisations/',
  '/projet-5/': '/realisations/',
  '/projet-6/': '/realisations/',
  '/projet-7/': '/realisations/',
  '/projet-marine/': '/realisations/',
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

  it('ne contient aucune source en double', () => {
    const sources = redirects.map((rule) => rule.source);
    expect(new Set(sources).size).toBe(sources.length);
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
