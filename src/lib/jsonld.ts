/**
 * Données structurées schema.org (docs/SEO-STRATEGIE.md §4), fonctions PURES.
 * Une page = un seul `<script type="application/ld+json">` contenant un `@graph` ;
 * les entités globales (site, entreprise, fondatrice) sont reliées par `@id`.
 * Pas d'`AggregateRating` auto-attribué, pas d'`Offer` tant que les tarifs ne sont pas validés.
 */
import type {
  BlogPosting,
  BreadcrumbList,
  CreativeWork,
  DayOfWeek as SchemaDayOfWeek,
  Graph,
  OpeningHoursSpecification,
  Person,
  ProfessionalService,
  Service,
  Thing,
  WebSite,
} from 'schema-dts';
import type { InternalPath, OpeningHoursRule, SiteConfig } from '@/config/site';
import { absoluteUrl } from './url';

export type EntityKey = 'site' | 'entreprise' | 'fondatrice';

export interface BreadcrumbItem {
  readonly label: string;
  readonly href: InternalPath;
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
    worksFor: { '@id': entityId(origin, 'entreprise') },
  };
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
    areaServed: config.areaServed.map((area) => ({ '@type': area.type, name: area.name })),
    openingHoursSpecification: buildOpeningHoursSpecification(config.openingHours),
    founder: { '@id': entityId(origin, 'fondatrice') },
    sameAs: config.socials.map((social) => social.url),
  };
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[], origin: URL): BreadcrumbList {
  if (items.length === 0) {
    throw new Error('Un fil d’Ariane doit contenir au moins un élément.');
  }
  return {
    '@type': 'BreadcrumbList',
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
}

/** Prestation : rattachée à l'entreprise, volontairement sans `offers` (tarifs non validés). */
export function buildService(input: ServiceInput, origin: URL): Service {
  return {
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    provider: { '@id': entityId(origin, 'entreprise') },
    areaServed: { '@type': 'Country', name: 'France' },
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
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    image: input.imageUrls.map((url) => new URL(url, origin).href),
    creator: { '@id': entityId(origin, 'fondatrice') },
  };
}

export interface BlogPostingInput {
  readonly headline: string;
  readonly description: string;
  readonly path: InternalPath;
  readonly datePublished: Date;
  readonly dateModified?: Date | undefined;
  readonly imageUrl: string;
}

export function buildBlogPosting(input: BlogPostingInput, origin: URL): BlogPosting {
  return {
    '@type': 'BlogPosting',
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.path, origin),
    mainEntityOfPage: absoluteUrl(input.path, origin),
    image: new URL(input.imageUrl, origin).href,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: { '@id': entityId(origin, 'fondatrice') },
    publisher: { '@id': entityId(origin, 'entreprise') },
    inLanguage: 'fr-FR',
  };
}

export function buildGraph(nodes: readonly Thing[]): Graph {
  return { '@context': 'https://schema.org', '@graph': [...nodes] };
}

/**
 * Sérialisation sûre pour `set:html` : `<` est échappé en `<`, ce qui neutralise
 * toute séquence `</script>` ou `<!--` dans les données (le JSON reste équivalent).
 */
export function serializeJsonLd(data: Graph): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
