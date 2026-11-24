/**
 * Modèles du blog « Conseils déco » (index et page article), construits à partir des entrées
 * BRUTES des collections (fonctions pures, testées dans tests/unit/articles-model.test.ts).
 * Les brouillons (`draft: true`) sont retirés ici et nulle part ailleurs : ni carte, ni route,
 * ni lien « à lire aussi ». L'accès aux collections est dans ./articles.ts.
 */
import type { ImageMetadata } from 'astro';
import { ContentError, filterPublished, requireSection } from '../content';
import { FOUNDER_PROFILE_PATH, type BreadcrumbItem } from '../jsonld';
import type { InternalPath } from '@/config/site';
import { lowerFirst } from '../format';
import { readingTime } from '../reading-time';
import { articlePath, projectPath, servicePath, type ArticlePath } from '../routes';
import type { ProjectEntryLike, ServiceEntryLike } from '../cards';
import type { PageSection } from './types';

interface Figure {
  readonly image: ImageMetadata;
  readonly alt: string;
}

export interface ArticleEntryLike {
  readonly id: string;
  /** Corps MDX brut (fourni par le loader `glob`). */
  readonly body?: string | undefined;
  readonly data: {
    readonly title: string;
    readonly publishedAt: Date;
    readonly updatedAt?: Date | undefined;
    readonly cover: Figure;
    readonly tags: readonly string[];
    readonly relatedService?: { readonly id: string } | undefined;
    readonly relatedProject?: { readonly id: string } | undefined;
    readonly draft: boolean;
    readonly seo: { readonly title: string; readonly description: string };
  };
}

export interface DateDisplay {
  /** Valeur de l'attribut `datetime` (AAAA-MM-JJ). */
  readonly iso: string;
  /** « 1ᵉʳ décembre 2026 », « 18 novembre 2026 ». */
  readonly label: string;
}

export interface ArticleCardData {
  readonly slug: string;
  readonly href: ArticlePath;
  readonly title: string;
  /** Extrait : la meta description, rédigée pour donner envie de lire. */
  readonly excerpt: string;
  readonly cover: Figure;
  readonly tags: readonly string[];
  readonly published: DateDisplay;
  readonly readingTime: string;
}

const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });

/** Date d'un article (saisie AAAA-MM-JJ, donc minuit UTC) en français, sans décalage horaire. */
export function formatArticleDate(date: Date): DateDisplay {
  const day = date.getUTCDate();
  return {
    iso: date.toISOString().slice(0, 10),
    label: `${day === 1 ? '1\u1D49\u02B3' : String(day)}\u00A0${MONTH_FORMAT.format(date)} ${date.getUTCFullYear()}`,
  };
}

/** Articles publiés, du plus récent au plus ancien (puis par identifiant, ordre stable). */
export function selectPublishedArticles<T extends ArticleEntryLike>(entries: readonly T[]): T[] {
  return filterPublished(entries).sort(
    (first, second) =>
      second.data.publishedAt.getTime() - first.data.publishedAt.getTime() ||
      first.id.localeCompare(second.id),
  );
}

export function toArticleCard(entry: ArticleEntryLike, readingTemplate: string): ArticleCardData {
  const { data } = entry;
  const minutes = readingTime(entry.body ?? '');
  return {
    slug: entry.id,
    href: articlePath(entry.id),
    title: data.title,
    excerpt: data.seo.description,
    cover: data.cover,
    tags: data.tags,
    published: formatArticleDate(data.publishedAt),
    readingTime: readingTemplate.replace('{minutes}', String(minutes)),
  };
}

/* ------------------------------------------------------------------ */
/* Index /conseils-deco/                                               */
/* ------------------------------------------------------------------ */

export interface ArticlesIndexInput {
  readonly page: {
    readonly seo: { readonly title: string; readonly description: string };
    readonly hero: PageSection;
    readonly sections: Readonly<Record<string, PageSection>>;
  };
  readonly articles: readonly ArticleEntryLike[];
  readonly readingTemplate: string;
  readonly labels: { readonly home: string; readonly indexLabel: string };
}

export interface ArticlesIndexModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly hero: PageSection;
  readonly cta: PageSection;
  readonly articles: readonly ArticleCardData[];
  readonly breadcrumbs: readonly BreadcrumbItem[];
  /** Image Open Graph : couverture de la première carte affichée (image par défaut si aucune). */
  readonly ogImage?: Figure | undefined;
}

export function buildArticlesIndexModel(input: ArticlesIndexInput): ArticlesIndexModel {
  const articles = selectPublishedArticles(input.articles).map((entry) =>
    toArticleCard(entry, input.readingTemplate),
  );
  return {
    seo: input.page.seo,
    hero: input.page.hero,
    cta: requireSection(input.page.sections, 'cta', 'conseils-deco'),
    articles,
    ogImage: articles[0]?.cover,
    breadcrumbs: [
      { label: input.labels.home, href: '/' },
      { label: input.labels.indexLabel, href: '/conseils-deco/' },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Page article /conseils-deco/<slug>/                                 */
/* ------------------------------------------------------------------ */

export interface FurtherItem {
  readonly kind: 'service' | 'project' | 'article';
  readonly eyebrow: string;
  readonly title: string;
  readonly text: string;
  readonly href: string;
}

export interface ArticleLabels {
  readonly home: string;
  readonly indexLabel: string;
  readonly readingTime: string;
  readonly further: {
    readonly service: string;
    readonly project: string;
    readonly article: string;
  };
}

export interface ArticlePageModel extends ArticleCardData {
  readonly seo: { readonly title: string; readonly description: string };
  readonly updated: DateDisplay | undefined;
  readonly publishedAt: Date;
  readonly updatedAt: Date | undefined;
  readonly further: readonly FurtherItem[];
  readonly breadcrumbs: readonly BreadcrumbItem[];
}

export interface ArticlePageInput {
  readonly entry: ArticleEntryLike;
  /** Tous les articles (brouillons compris : ils sont écartés ici). */
  readonly articles: readonly ArticleEntryLike[];
  readonly prestations: readonly ServiceEntryLike[];
  readonly projets: readonly ProjectEntryLike[];
  readonly labels: ArticleLabels;
}

function findOrThrow<T extends { readonly id: string }>(
  entries: readonly T[],
  id: string,
  field: string,
  articleId: string,
): T {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new ContentError(
      `« ${id} » introuvable (src/content/articles/${articleId}.mdx, champ \`${field}\`).`,
    );
  }
  return entry;
}

/** Liens « Pour aller plus loin » : formule liée, réalisation liée, article publié le plus récent. */
export function buildFurtherReading(input: ArticlePageInput): FurtherItem[] {
  const { entry, labels } = input;
  const { relatedService, relatedProject } = entry.data;
  const items: FurtherItem[] = [];
  if (relatedService) {
    const service = findOrThrow(input.prestations, relatedService.id, 'relatedService', entry.id);
    items.push({
      kind: 'service',
      eyebrow: labels.further.service,
      title: service.data.title,
      text: service.data.summary,
      href: servicePath(service.id),
    });
  }
  if (relatedProject) {
    const project = findOrThrow(input.projets, relatedProject.id, 'relatedProject', entry.id);
    items.push({
      kind: 'project',
      eyebrow: labels.further.project,
      title: project.data.title,
      text: project.data.summary,
      href: projectPath(project.id),
    });
  }
  const other = selectPublishedArticles(input.articles).find(({ id }) => id !== entry.id);
  if (other) {
    items.push({
      kind: 'article',
      eyebrow: labels.further.article,
      title: other.data.title,
      text: other.data.seo.description,
      href: articlePath(other.id),
    });
  }
  return items;
}

export function buildArticlePageModel(input: ArticlePageInput): ArticlePageModel {
  const { entry, labels } = input;
  if (entry.data.draft) {
    throw new ContentError(
      `L’article « ${entry.id} » est un brouillon : il ne doit pas être publié.`,
    );
  }
  const card = toArticleCard(entry, labels.readingTime);
  const { updatedAt, publishedAt } = entry.data;
  // Une « mise à jour » le jour même de la publication n'apporte rien au lecteur.
  const updated =
    updatedAt && updatedAt.getTime() !== publishedAt.getTime()
      ? formatArticleDate(updatedAt)
      : undefined;
  return {
    ...card,
    seo: entry.data.seo,
    updated,
    publishedAt,
    updatedAt,
    further: buildFurtherReading(input),
    breadcrumbs: [
      { label: labels.home, href: '/' },
      { label: labels.indexLabel, href: '/conseils-deco/' },
      { label: entry.data.title, href: card.href },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Signature de l'article (auteur visible, identique au JSON-LD)       */
/* ------------------------------------------------------------------ */

export interface Byline {
  /** « Par ». */
  readonly prefix: string;
  /** Nom de l'autrice, lien vers sa page de présentation. */
  readonly name: string;
  /** Métier en minuscule initiale, après la virgule : « designer d’intérieur ». */
  readonly role: string;
  readonly href: InternalPath;
}

/**
 * Signature d'un article : même personne que l'`author` du `BlogPosting` (`site.founder`),
 * liée à `/a-propos/` comme l'`url` de l'entité `Person`.
 */
export function buildByline(
  founder: { readonly name: string; readonly jobTitle: string },
  prefix: string,
): Byline {
  return {
    prefix,
    name: founder.name,
    role: lowerFirst(founder.jobTitle),
    href: FOUNDER_PROFILE_PATH,
  };
}
