/**
 * Content-Security-Policy du site (ADR-0012). Fonctions PURES, lues par astro.config.mjs
 * (`security.csp`) et testées dans tests/unit/csp.test.ts. Sans alias d'import : chargé avant
 * la configuration de Vite.
 *
 * Astro calcule lui-même les empreintes des scripts et styles qu'il produit et rend la politique
 * dans un `<meta http-equiv="content-security-policy">` sur chaque page statique. Ce module
 * fournit le reste : les directives hors `script-src`/`style-src` et les empreintes des scripts
 * `is:inline`, qu'Astro ne hache pas.
 */
import { createHash } from 'node:crypto';
import { JS_CLASS_SCRIPT } from './inline-scripts';

/** Empreinte CSP (`sha256-…`, base64) d'un script ou d'un style inline. */
export function cspHash(source: string): `sha256-${string}` {
  return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

/** Empreintes des scripts `is:inline` de BaseLayout (ADR-0010), à déclarer dans `script-src`. */
export const INLINE_SCRIPT_HASHES: readonly `sha256-${string}`[] = [cspHash(JS_CLASS_SCRIPT)];

/**
 * Origine du service de formulaire (`PUBLIC_FORM_ENDPOINT`, ADR-0003), `undefined` s'il n'est
 * pas défini. Même exigence que `resolveFormTarget` (src/lib/contact-form.ts) : https seulement.
 */
export function formEndpointOrigin(endpoint: string | undefined): string | undefined {
  const trimmed = endpoint?.trim() ?? '';
  if (trimmed === '') return undefined;
  const url = URL.parse(trimmed);
  if (url?.protocol !== 'https:') {
    throw new Error(`PUBLIC_FORM_ENDPOINT doit être une URL https (reçu « ${trimmed} »).`);
  }
  return url.origin;
}

/**
 * Directives de la politique, hors `script-src`/`style-src` (gérées par `scriptDirective` et
 * `styleDirective` d'Astro). Tout est servi par le site lui-même ; seule exception, le service de
 * formulaire : `fetch` (connect-src) et envoi HTML sans JS (form-action). Sans service, le
 * formulaire s'envoie vers `mailto:`.
 *
 * `frame-ancestors`, `report-uri` et `sandbox` sont ignorés dans une balise meta : la protection
 * contre l'intégration en cadre reste portée par les en-têtes de vercel.json.
 */
/** Directives produites ici : sous-ensemble de celles qu'accepte `security.csp.directives`. */
type DirectiveName =
  | 'default-src'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'form-action'
  | 'base-uri'
  | 'object-src'
  | 'manifest-src'
  | 'worker-src'
  | 'frame-src';

export type CspDirective = `${DirectiveName} ${string}`;

export function cspDirectives(endpoint: string | undefined): CspDirective[] {
  const formOrigin = formEndpointOrigin(endpoint);
  const service = formOrigin === undefined ? '' : ` ${formOrigin}`;
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${service}`,
    `form-action 'self'${formOrigin === undefined ? ' mailto:' : service}`,
    "base-uri 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'none'",
    "frame-src 'none'",
  ];
}
