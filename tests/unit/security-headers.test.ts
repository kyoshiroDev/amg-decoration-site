import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// En-têtes HTTP de sécurité posés par Vercel (vercel.json, ADR-0012). `astro preview` ne les
// applique pas : ce test est leur seule vérification locale.

interface HeaderRule {
  source: string;
  has?: unknown[];
  headers: { key: string; value: string }[];
}

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
  headers: HeaderRule[];
};

/** En-têtes de la règle qui couvre toutes les URLs (sans condition `has`). */
function globalHeaders(): Map<string, string> {
  const rule = vercel.headers.find((entry) => entry.source === '/(.*)' && !entry.has);
  expect(rule, 'règle globale /(.*) absente de vercel.json').toBeDefined();
  return new Map(rule?.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

const EXPECTED: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

describe('vercel.json : en-têtes de sécurité', () => {
  it('pose les en-têtes attendus sur toutes les URLs', () => {
    const headers = globalHeaders();
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(headers.get(key), key).toBe(value);
    }
  });

  it('HSTS d’au moins un an', () => {
    const maxAge = Number(
      /max-age=(\d+)/.exec(globalHeaders().get('strict-transport-security') ?? '')?.[1],
    );
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
  });

  it('Permissions-Policy : capteurs, paiement, USB et Topics désactivés', () => {
    const policy = globalHeaders().get('permissions-policy') ?? '';
    for (const feature of [
      'camera',
      'microphone',
      'geolocation',
      'payment',
      'usb',
      'browsing-topics',
    ]) {
      expect(policy, feature).toContain(`${feature}=()`);
    }
    // Fonction retirée des navigateurs : la déclarer produit un avertissement console.
    expect(policy).not.toContain('interest-cohort');
  });

  it('CSP d’en-tête : seulement ce que la balise meta ne peut pas porter', () => {
    const csp = globalHeaders().get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // Scripts et styles : politique par empreintes de la balise meta (calculées au build).
    // Les déclarer aussi ici ajouterait une seconde politique, figée, qui bloquerait les styles.
    expect(csp).not.toMatch(/(script|style|default)-src/);
  });
});

describe('vercel.json : cache des fichiers versionnés', () => {
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  const cacheControl = (source: string): string | undefined =>
    vercel.headers
      .find((entry) => entry.source === source)
      ?.headers.find(({ key }) => key.toLowerCase() === 'cache-control')?.value;

  it('fichiers de /_astro/ (empreinte dans le nom) : cache immuable d’un an', () => {
    expect(cacheControl('/_astro/(.*)')).toBe(IMMUTABLE);
  });

  it('sprite d’icônes versionné (/icons.<version>.svg) : cache immuable d’un an', () => {
    expect(cacheControl('/icons.(.*).svg')).toBe(IMMUTABLE);
  });
});
