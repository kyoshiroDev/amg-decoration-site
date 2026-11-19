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

/** Balise meta de la politique, telle qu'Astro la rend (contenu entre guillemets doubles). */
const META_CSP = /(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i;

/** Éléments `<script>`/`<style>` ; le contenu est le texte brut haché par le navigateur. */
const INLINE_BLOCK = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Empreinte au format CSP (`'sha256-…'`, `'sha384-…'`, `'sha512-…'`). */
const HASH_SOURCE = /^'(sha256|sha384|sha512)-[A-Za-z0-9+/=]+'$/;

/** Directives dont les empreintes autorisent des éléments inline, par type d'élément. */
const HASHED_DIRECTIVES: Readonly<Record<string, 'script' | 'style'>> = {
  'script-src': 'script',
  'script-src-elem': 'script',
  'style-src': 'style',
  'style-src-elem': 'style',
};

function decodeAttribute(value: string): string {
  return value.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
}

/**
 * Réduit les empreintes de la balise meta CSP d'une page à celles de SES éléments inline.
 *
 * Astro (7.4.12, `core/csp/common.js`) met dans la politique de chaque page les empreintes de
 * tous les styles inlinés du site, de ses directives `client:*` et de ses scripts inlinés, qu'ils
 * figurent ou non sur la page : ~2,3 Ko incompressibles par document (ADR-0012). Une empreinte sans
 * élément correspondant n'autorise rien d'utile, mais autoriserait ce contenu s'il était injecté :
 * la retirer allège le HTML et resserre la politique. Les autres sources (`'self'`, origines,
 * `'unsafe-inline'` de `style-src-attr`) et les autres directives sont conservées telles quelles.
 * Les `<script>` à `src` et le JSON-LD (non exécuté) ne comptent pas comme éléments inline.
 */
export function pruneCspHashes(html: string): string {
  const meta = META_CSP.exec(html);
  if (meta === null) return html;

  const present = new Set<string>();
  for (const [, tag = '', attributes = '', content = ''] of html.matchAll(INLINE_BLOCK)) {
    if (/\bsrc\s*=|application\/ld\+json/i.test(attributes)) continue;
    for (const algorithm of ['sha256', 'sha384', 'sha512']) {
      const digest = createHash(algorithm).update(content).digest('base64');
      present.add(`${tag.toLowerCase()} '${algorithm}-${digest}'`);
    }
  }

  const policy = decodeAttribute(meta[2] ?? '')
    .split(';')
    .map((entry) => {
      const [name = '', ...sources] = entry.trim().split(/\s+/);
      const kind = HASHED_DIRECTIVES[name.toLowerCase()];
      if (kind === undefined) return entry;
      const kept = sources.filter(
        (source) => !HASH_SOURCE.test(source) || present.has(`${kind} ${source}`),
      );
      return `${/^\s*/.exec(entry)?.[0] ?? ''}${[name, ...kept].join(' ')}`;
    })
    .join(';')
    .replaceAll('&', '&amp;');

  return html.replace(META_CSP, (_match, open: string, _content, close: string) => {
    return `${open}${policy}${close}`;
  });
}
