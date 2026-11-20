/**
 * Données structurées schema.org (docs/SEO-STRATEGIE.md §4), fonctions PURES.
 * Une page = un seul `<script type="application/ld+json">` contenant un `@graph` ;
 * les entités globales (site, entreprise, fondatrice) sont reliées par `@id`.
 * Pas d'`AggregateRating` auto-attribué, pas d'`Offer` tant que les tarifs ne sont pas validés.
 */
import type {
  AboutPage,
  BlogPosting,
  BreadcrumbList,
  CollectionPage,
  ContactPage,
  CreativeWork,
  DayOfWeek as SchemaDayOfWeek,
  Graph,
  ItemList,
  OpeningHoursSpecification,
  Person,
  Place,
  ProfessionalService,
  Service,
  Thing,
  WebSite,
} from 'schema-dts';
import type { AreaServed, InternalPath, OpeningHoursRule, SiteConfig } from '@/config/site';
import { absoluteUrl } from './url';

export type EntityKey = 'site' | 'entreprise' | 'fondatrice';

/** Page de présentation d'Amandine : `url` de l'entité `Person` (signal E-E-A-T). */
export const FOUNDER_PROFILE_PATH: InternalPath = '/a-propos/';

export interface BreadcrumbItem {
  readonly label: string;
  readonly href: InternalPath;
}

/** Fragment d'identifiant du nœud principal d'une page (`https://domaine/chemin/#service`). */
export type PageNodeKey = 'service' | 'projet' | 'article' | 'page' | 'fil-ariane';

/** Identifiant stable d'un nœud propre à une page : URL canonique + fragment. */
export function pageNodeId(path: InternalPath, origin: URL | string, key: PageNodeKey): string {
  return `${absoluteUrl(path, origin)}#${key}`;
}

/** Identifiant stable d'une entité globale : `https://domaine/#entreprise`. */
export function entityId(origin: URL | string, key: EntityKey): string {
  return `${new URL('/', origin).href}#${key}`;
}

export function buildOpeningHoursSpecification(
  rules: readonly OpeningHoursRule[],
): OpeningHoursSpecification[] {
  return rules.map((rule) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: rule.days.map((day): SchemaDayOfWeek => `https://schema.org/${day}`),
    opens: rule.opens,
    closes: rule.closes,
  }));
}

/** Zone desservie (source : `site.areaServed`), partagée par l'entreprise et ses prestations. */
export function buildAreaServed(areas: readonly AreaServed[]): Place[] {
  return areas.map((area) => ({ '@type': area.type, name: area.name }));
}

export function buildWebSite(config: SiteConfig, origin: URL): WebSite {
  return {
    '@type': 'WebSite',
    '@id': entityId(origin, 'site'),
    url: new URL('/', origin).href,
    name: config.name,
    // Nom court proposé à Google pour le « nom du site » dans les résultats.
    alternateName: config.shortName,
    inLanguage: 'fr-FR',
    publisher: { '@id': entityId(origin, 'entreprise') },
  };
}

export function buildFounder(config: SiteConfig, origin: URL): Person {
  return {
    '@type': 'Person',
    '@id': entityId(origin, 'fondatrice'),
    name: config.founder.name,
    jobTitle: config.founder.jobTitle,
    url: absoluteUrl(FOUNDER_PROFILE_PATH, origin),
    worksFor: { '@id': entityId(origin, 'entreprise') },
    ...withSameAs(socialUrls(config, 'founder')),
  };
}

/** URL des profils sociaux d'un titulaire (`founder` = profil personnel, sinon entreprise). */
export function socialUrls(config: SiteConfig, owner: 'business' | 'founder'): string[] {
  return config.socials
    .filter((social) => (social.owner ?? 'business') === owner)
    .map((social) => social.url);
}

/** `sameAs` n'est émis que s'il existe au moins un profil. */
function withSameAs(urls: readonly string[]): { sameAs?: string[] } {
  return urls.length > 0 ? { sameAs: [...urls] } : {};
}

/** Visuels de marque de l'entreprise (URL relatives ou absolues), publiés seulement s'ils existent. */
export interface BusinessMedia {
  /** Logo carré ≥ 112 × 112 px, lisible sur fond blanc (consigne Google `Organization.logo`). */
  readonly logoUrl?: string | undefined;
  /** Photos ou rendus 3D représentatifs (idéalement 16:9, 4:3 et 1:1). */
  readonly imageUrls?: readonly string[] | undefined;
}

/**
 * Entreprise : volontairement sans `streetAddress` ni `geo` (adresse non publiée,
 * entreprise de zone desservie) et sans `priceRange` (tarifs non validés).
 * `logo` et `image` ne sont émis que si de vrais visuels de marque sont fournis.
 */
export function buildBusiness(
  config: SiteConfig,
  origin: URL,
  media: BusinessMedia = {},
): ProfessionalService {
  const images = (media.imageUrls ?? []).map((url) => new URL(url, origin).href);
  return {
    '@type': 'ProfessionalService',
    '@id': entityId(origin, 'entreprise'),
    name: config.name,
    alternateName: config.shortName,
    ...(media.logoUrl ? { logo: new URL(media.logoUrl, origin).href } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    slogan: config.tagline,
    url: new URL('/', origin).href,
    telephone: config.phone.e164,
    email: config.email,
    address: {
      '@type': 'PostalAddress',
      addressRegion: config.address.addressRegion,
      addressCountry: config.address.addressCountry,
    },
    areaServed: buildAreaServed(config.areaServed),
    openingHoursSpecification: buildOpeningHoursSpecification(config.openingHours),
    founder: { '@id': entityId(origin, 'fondatrice') },
    ...withSameAs(socialUrls(config, 'business')),
  };
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[], origin: URL): BreadcrumbList {
  if (items.length === 0) {
    throw new Error('Un fil d’Ariane doit contenir au moins un élément.');
  }
  const current = items.at(-1);
  return {
    '@type': 'BreadcrumbList',
    // Le dernier élément est la page courante : son URL porte l'identifiant du fil.
    ...(current ? { '@id': pageNodeId(current.href, origin, 'fil-ariane') } : {}),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.href, origin),
    })),
  };
}

export interface ServiceInput {
  readonly name: string;
  readonly description: string;
  readonly path: InternalPath;
  /** Visuel de la prestation (URL relative ou absolue), émis seulement s'il existe. */
  readonly imageUrl?: string | undefined;
  /** Catégorie de service (`serviceType` schema.org), émise seulement si renseignée. */
  readonly serviceType?: string | undefined;
}

/**
 * Prestation : rattachée à l'entreprise, même zone desservie qu'elle, volontairement
 * sans `offers` (tarifs non validés, ADR-0007).
 */
export function buildService(
  input: ServiceInput,
  areas: readonly AreaServed[],
  origin: URL,
): Service {
  return {
    '@type': 'Service',
    '@id': pageNodeId(input.path, origin, 'service'),
    name: input.name,
    description: input.description,
    ...(input.serviceType ? { serviceType: input.serviceType } : {}),
    url: absoluteUrl(input.path, origin),
    ...(input.imageUrl ? { image: new URL(input.imageUrl, origin).href } : {}),
    provider: { '@id': entityId(origin, 'entreprise') },
    areaServed: buildAreaServed(areas),
  };
}

export interface CreativeWorkInput {
  readonly name: string;
  readonly description: string;
  readonly path: InternalPath;
  readonly imageUrls: readonly string[];
}

export function buildCreativeWork(input: CreativeWorkInput, origin: URL): CreativeWork {
  return {
    '@type': 'CreativeWork',
    '@id': pageNodeId(input.path, origin, 'projet'),
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    image: input.imageUrls.map((url) => new URL(url, origin).href),
    creator: { '@id': entityId(origin, 'fondatrice') },
    isPartOf: { '@id': entityId(origin, 'site') },
    inLanguage: 'fr-FR',
  };
}

export interface BlogPostingInput {
  readonly headline: string;
  readonly description: string;
  readonly path: InternalPath;
  readonly datePublished: Date;
  readonly dateModified?: Date | undefined;
  readonly imageUrl: string;
  /** Étiquettes de l'article (`keywords`), omises si vides. */
  readonly keywords?: readonly string[] | undefined;
}

export function buildBlogPosting(input: BlogPostingInput, origin: URL): BlogPosting {
  return {
    '@type': 'BlogPosting',
    '@id': pageNodeId(input.path, origin, 'article'),
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    mainEntityOfPage: absoluteUrl(input.path, origin),
    image: new URL(input.imageUrl, origin).href,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: { '@id': entityId(origin, 'fondatrice') },
    publisher: { '@id': entityId(origin, 'entreprise') },
    isPartOf: { '@id': entityId(origin, 'site') },
    inLanguage: 'fr-FR',
    ...(input.keywords && input.keywords.length > 0 ? { keywords: input.keywords.join(', ') } : {}),
  };
}

/** Élément d'une liste de pages (carte de réalisation, article…). */
export interface ListedPage {
  readonly name: string;
  readonly path: InternalPath;
}

/** Liste ordonnée des pages présentées par une page d'index (sémantique : pas de résultat enrichi). */
export function buildItemList(items: readonly ListedPage[], origin: URL): ItemList {
  return {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path, origin),
    })),
  };
}

export interface WebPageInput {
  readonly name: string;
  readonly description: string;
  readonly path: InternalPath;
}

/** Modèle de page minimal : titre et description SEO, fil d'Ariane (dernier élément = page). */
export interface PageModelLike {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
}

/** Nom, description et chemin d'un nœud `WebPage` tirés du modèle de page (mêmes textes que le `<head>`). */
export function webPageInputFrom(model: PageModelLike): WebPageInput {
  const current = model.breadcrumbs.at(-1);
  if (!current) {
    throw new Error('Le fil d’Ariane de la page est vide : chemin de la page inconnu.');
  }
  return { name: model.seo.title, description: model.seo.description, path: current.href };
}

interface WebPageBase {
  readonly '@id': string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly isPartOf: { readonly '@id': string };
  readonly inLanguage: 'fr-FR';
  readonly breadcrumb: { readonly '@id': string };
}

/**
 * Propriétés communes aux nœuds `WebPage` : identifiant `#page`, rattachement au site et
 * fil d'Ariane (`BreadcrumbList` ajoutée par `PageLayout`) par `@id`.
 */
function webPageBase(input: WebPageInput, origin: URL): WebPageBase {
  return {
    '@id': pageNodeId(input.path, origin, 'page'),
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    isPartOf: { '@id': entityId(origin, 'site') },
    inLanguage: 'fr-FR',
    breadcrumb: { '@id': pageNodeId(input.path, origin, 'fil-ariane') },
  };
}

/**
 * Page d'index (prestations, réalisations, articles) : `CollectionPage` dont l'entité principale est la
 * liste des pages présentées. Aucun résultat enrichi Google pour ce type de site ; utile pour
 * la compréhension de la structure, sans risque (contenu visible identique).
 */
export function buildCollectionPage(
  input: WebPageInput & { readonly items: readonly ListedPage[] },
  origin: URL,
): CollectionPage {
  return {
    '@type': 'CollectionPage',
    ...webPageBase(input, origin),
    mainEntity: buildItemList(input.items, origin),
  };
}

/** Page « À propos » : son entité principale est la fondatrice, elle parle de l'entreprise. */
export function buildAboutPage(input: WebPageInput, origin: URL): AboutPage {
  return {
    '@type': 'AboutPage',
    ...webPageBase(input, origin),
    mainEntity: { '@id': entityId(origin, 'fondatrice') },
    about: { '@id': entityId(origin, 'entreprise') },
  };
}

/** Page « Contact » : rattachée à l'entreprise (dont les coordonnées sont dans le graphe global). */
export function buildContactPage(input: WebPageInput, origin: URL): ContactPage {
  return {
    '@type': 'ContactPage',
    ...webPageBase(input, origin),
    about: { '@id': entityId(origin, 'entreprise') },
  };
}

export function buildGraph(nodes: readonly Thing[]): Graph {
  return { '@context': 'https://schema.org', '@graph': [...nodes] };
}

/**
 * Sérialisation sûre pour `set:html` : `<` est échappé en `\u003c`, ce qui neutralise
 * toute séquence `</script>` ou `<!--` dans les données (le JSON reste équivalent).
 */
export function serializeJsonLd(data: Graph): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
