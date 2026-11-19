/**
 * Contrôles des données structurées d'une page (pas un fichier de test : non collecté par
 * Playwright). Chaque fonction renvoie la liste des problèmes trouvés (vide = conforme) pour
 * qu'un seul test signale toutes les pages fautives d'un coup. docs/SEO-STRATEGIE.md §4.
 */

export const SITE_ORIGIN = 'https://amgdecorationdinterieur.com';

/** Entités globales émises par BaseLayout sur toutes les pages, dans cet ordre. */
export const GLOBAL_TYPES = ['WebSite', 'ProfessionalService', 'Person'] as const;

/** Longueur maximale conseillée pour `headline` (consigne Google Article). */
export const HEADLINE_MAX_LENGTH = 110;

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

/** Types JSON-LD propres à chaque gabarit de page (en plus des entités globales). Table unique. */
export function expectedPageTypes(path: string): string[] {
  if (path === '/' || path === '/merci/') return [];
  const types = ['BreadcrumbList'];
  if (['/prestations/', '/realisations/', '/conseils-deco/'].includes(path)) {
    types.push('CollectionPage');
  } else if (path.startsWith('/realisations/')) types.push('CreativeWork');
  else if (path.startsWith('/conseils-deco/')) types.push('BlogPosting');
  else if (path.startsWith('/prestations/')) types.push('Service');
  else if (path === '/a-propos/') types.push('AboutPage');
  else if (path === '/contact/') types.push('ContactPage');
  return types;
}

/** Contenu brut de chaque `<script type="application/ld+json">` du HTML. */
export function extractJsonLdScripts(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1] ?? '',
  );
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parcourt récursivement une valeur JSON (objets et tableaux). */
function walk(value: JsonValue, visit: (node: JsonObject) => void): void {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (isObject(value)) {
    visit(value);
    Object.values(value).forEach((item) => walk(item, visit));
  }
}

/** Une référence est un objet réduit à `{ "@id": … }`. */
function isReference(node: JsonObject): boolean {
  const keys = Object.keys(node);
  return keys.length === 1 && keys[0] === '@id';
}

/** Toutes les chaînes ressemblant à une URL (`http…` ou `/…`) sous des clés d'URL connues. */
const URL_KEYS = new Set(['url', 'item', 'image', 'mainEntityOfPage', 'logo', '@id']);

export interface PageGraph {
  readonly path: string;
  readonly graph: readonly JsonObject[];
}

/** Lit le graphe d'une page : un seul script parsable, `@context` schema.org, `@graph` tableau. */
export function parseGraph(
  path: string,
  html: string,
): { graph: JsonObject[]; problems: string[] } {
  const scripts = extractJsonLdScripts(html);
  if (scripts.length !== 1) {
    return { graph: [], problems: [`${path} : ${scripts.length} scripts ld+json (1 attendu)`] };
  }
  let data: JsonValue;
  try {
    data = JSON.parse(scripts[0] ?? '') as JsonValue;
  } catch (error) {
    return { graph: [], problems: [`${path} : JSON-LD non parsable (${String(error)})`] };
  }
  if (!isObject(data) || data['@context'] !== 'https://schema.org') {
    return { graph: [], problems: [`${path} : @context https://schema.org attendu`] };
  }
  const graph = data['@graph'];
  if (!Array.isArray(graph) || !graph.every(isObject)) {
    return { graph: [], problems: [`${path} : @graph doit être un tableau d'objets`] };
  }
  return { graph: graph as JsonObject[], problems: [] };
}

/** Types (globaux puis propres à la route), `@id` uniques, références résolues, URL absolues. */
export function checkGraphStructure({ path, graph }: PageGraph): string[] {
  const problems: string[] = [];
  const types = graph.map((node) => String(node['@type']));
  if (JSON.stringify(types.slice(0, 3)) !== JSON.stringify(GLOBAL_TYPES)) {
    problems.push(`${path} : entités globales ${types.slice(0, 3).join(', ')}`);
  }
  const pageTypes = types.slice(3).sort();
  const expected = expectedPageTypes(path).sort();
  if (JSON.stringify(pageTypes) !== JSON.stringify(expected)) {
    problems.push(`${path} : types ${pageTypes.join(', ')} (attendu ${expected.join(', ')})`);
  }

  const defined = new Set<string>();
  const references: string[] = [];
  walk(graph as JsonValue[], (node) => {
    const id = node['@id'];
    if (typeof id !== 'string') return;
    if (isReference(node)) {
      references.push(id);
    } else if (defined.has(id)) {
      problems.push(`${path} : @id dupliqué ${id}`);
    } else {
      defined.add(id);
    }
  });
  for (const id of references) {
    if (!defined.has(id)) problems.push(`${path} : référence @id non résolue ${id}`);
  }

  walk(graph as JsonValue[], (node) => {
    for (const [key, value] of Object.entries(node)) {
      if (!URL_KEYS.has(key)) continue;
      for (const url of [value].flat()) {
        if (typeof url !== 'string') continue;
        if (!url.startsWith(`${SITE_ORIGIN}/`) && !/^https:\/\//.test(url)) {
          problems.push(`${path} : ${key} non absolue « ${url} »`);
        } else if (key !== 'image' && key !== 'logo' && !url.startsWith(`${SITE_ORIGIN}/`)) {
          problems.push(`${path} : ${key} hors de l'origine de production « ${url} »`);
        }
      }
    }
  });
  return problems;
}

/** Chemins `/_astro/…` des images publiées dans le graphe (à vérifier dans `dist/`). */
export function collectAssetPaths(graph: readonly JsonObject[]): string[] {
  const paths = new Set<string>();
  walk(graph as JsonValue[], (node) => {
    for (const key of ['image', 'logo']) {
      for (const url of [node[key]].flat()) {
        if (typeof url === 'string' && url.startsWith(`${SITE_ORIGIN}/_astro/`)) {
          paths.add(new URL(url).pathname);
        }
      }
    }
  });
  return [...paths];
}

function nonEmpty(value: JsonValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

/** Positions 1..n d'une liste `itemListElement`. */
function checkPositions(path: string, type: string, node: JsonObject): string[] {
  const items = node['itemListElement'];
  if (!Array.isArray(items) || items.length === 0) return [`${path} : ${type} sans élément`];
  const positions = items.map((item) => (isObject(item) ? item['position'] : undefined));
  const ok = positions.every((position, index) => position === index + 1);
  return ok ? [] : [`${path} : ${type} positions ${positions.join(',')} (attendu 1..n)`];
}

/** Propriétés requises ou recommandées par type de nœud. */
export function checkRequiredProperties({ path, graph }: PageGraph): string[] {
  const problems: string[] = [];
  const require = (node: JsonObject, keys: readonly string[]): void => {
    for (const key of keys) {
      if (!nonEmpty(node[key])) problems.push(`${path} : ${String(node['@type'])}.${key} manquant`);
    }
  };
  walk(graph as JsonValue[], (node) => {
    switch (node['@type']) {
      case 'BlogPosting': {
        require(node, ['headline', 'image', 'datePublished', 'author']);
        const headline = node['headline'];
        if (typeof headline === 'string' && [...headline].length > HEADLINE_MAX_LENGTH) {
          problems.push(`${path} : BlogPosting.headline > ${HEADLINE_MAX_LENGTH} caractères`);
        }
        break;
      }
      case 'Service':
        require(node, ['name', 'provider', 'areaServed']);
        break;
      case 'CreativeWork':
        require(node, ['name', 'image']);
        break;
      case 'ItemList': {
        const items = node['itemListElement'];
        const count = Array.isArray(items) ? items.length : -1;
        if (node['numberOfItems'] !== count) {
          problems.push(`${path} : ItemList.numberOfItems ≠ ${count}`);
        }
        if (count > 0) problems.push(...checkPositions(path, 'ItemList', node));
        break;
      }
      case 'BreadcrumbList':
        problems.push(...checkPositions(path, 'BreadcrumbList', node));
        break;
      default:
        break;
    }
  });
  return problems;
}

/** Texte visible approximatif du `<main>` (balises retirées, entités courantes décodées). */
export function mainText(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/.exec(html)?.[0] ?? '';
  return main
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/**
 * Auteur d'un `BlogPosting` visible sur la page (consigne Google : les données structurées
 * décrivent le contenu affiché) : nom de la `Person` référencée dans le `<main>`, avec un lien
 * vers son `url`.
 */
export function checkAuthorVisible({ path, graph }: PageGraph, html: string): string[] {
  const problems: string[] = [];
  const text = mainText(html);
  const main = /<main\b[\s\S]*?<\/main>/.exec(html)?.[0] ?? '';
  for (const node of graph) {
    if (node['@type'] !== 'BlogPosting') continue;
    const ref = node['author'];
    const authorId = isObject(ref) ? ref['@id'] : undefined;
    const person = graph.find((candidate) => candidate['@id'] === authorId);
    const name = person?.['name'];
    const url = person?.['url'];
    if (typeof name !== 'string' || typeof url !== 'string') {
      problems.push(`${path} : auteur du BlogPosting non résolu`);
      continue;
    }
    if (!text.includes(name)) problems.push(`${path} : « ${name} » absent du <main>`);
    const href = new URL(url).pathname;
    if (!main.includes(`href="${href}"`)) {
      problems.push(`${path} : aucun lien vers ${href} dans le <main>`);
    }
  }
  return problems;
}
