/**
 * Modèle du fichier /llms.txt (fonction pure, tests/unit/crawlers.test.ts) : assemble les
 * informations de src/config/site.ts et les entrées BRUTES des collections. Aucun prix
 * (affichage soumis à validation, ADR-0007) ; articles publiés seulement ; URL absolues.
 * L'accès aux collections est dans ./llms.ts.
 */
import type { InternalPath, NavItem, SiteConfig } from '@/config/site';
import { sortByOrder } from '../content';
import type { LlmsLink, LlmsTxtInput } from '../crawlers';
import { articlePath, projectPath, servicePath } from '../routes';
import { lowerFirst } from '../format';
import { absoluteUrl } from '../url';
import { selectPublishedArticles, type ArticleEntryLike } from './articles-model';

/** Page fixe (navigation principale ou pages légales) et sa meta description. */
export interface LlmsPage {
  readonly label: string;
  readonly href: InternalPath;
  readonly description: string;
}

/** Entrée de collection résumée (prestation ou réalisation). */
export interface LlmsEntryLike {
  readonly id: string;
  readonly data: { readonly title: string; readonly summary: string; readonly order: number };
}

export interface LlmsLabels {
  /** Paragraphe factuel, gabarit à jetons `{founder}`, `{jobTitle}`, `{name}`, `{areas}`, `{email}`, `{phone}`. */
  readonly about: string;
  readonly sections: {
    readonly main: string;
    readonly services: string;
    readonly projects: string;
    readonly articles: string;
  };
}

export interface LlmsModelInput {
  readonly site: Pick<
    SiteConfig,
    'name' | 'tagline' | 'founder' | 'areaServed' | 'email' | 'phone'
  >;
  readonly origin: URL;
  readonly labels: LlmsLabels;
  readonly mainPages: readonly LlmsPage[];
  readonly legalPages: readonly LlmsPage[];
  readonly prestations: readonly LlmsEntryLike[];
  readonly projets: readonly LlmsEntryLike[];
  /** Tous les articles (brouillons compris : ils sont écartés ici). */
  readonly articles: readonly ArticleEntryLike[];
}

/** Pages fixes : libellé de navigation + meta description de la page (`descriptions[href]`). */
export function toLlmsPages(
  items: readonly NavItem[],
  descriptions: Readonly<Record<string, string>>,
): LlmsPage[] {
  return items.map((item) => {
    const description = descriptions[item.href];
    if (description === undefined) {
      throw new Error(`llms.txt\u00A0: description introuvable pour la page « ${item.href} ».`);
    }
    return { label: item.label, href: item.href, description };
  });
}

function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);
}

export function buildLlmsModel(input: LlmsModelInput): LlmsTxtInput {
  const { site, origin, labels } = input;
  const link = (title: string, path: InternalPath, description: string): LlmsLink => ({
    title,
    url: absoluteUrl(path, origin),
    description,
  });
  const pageLink = (page: LlmsPage): LlmsLink => link(page.label, page.href, page.description);
  const about = fillTemplate(labels.about, {
    founder: site.founder.name,
    // Repris au milieu d'une phrase : « Amandine Gaury, designer d'intérieur ».
    jobTitle: lowerFirst(site.founder.jobTitle),
    name: site.name,
    areas: site.areaServed.map((area) => area.name).join(', '),
    email: site.email,
    phone: site.phone.display,
  });
  return {
    name: site.name,
    summary: site.tagline,
    details: [about],
    sections: [
      { title: labels.sections.main, links: input.mainPages.map(pageLink) },
      {
        title: labels.sections.services,
        links: sortByOrder(input.prestations).map((entry) =>
          link(entry.data.title, servicePath(entry.id), entry.data.summary),
        ),
      },
      {
        title: labels.sections.projects,
        links: sortByOrder(input.projets).map((entry) =>
          link(entry.data.title, projectPath(entry.id), entry.data.summary),
        ),
      },
      {
        title: labels.sections.articles,
        links: selectPublishedArticles(input.articles).map((entry) =>
          link(entry.data.title, articlePath(entry.id), entry.data.seo.description),
        ),
      },
    ],
    optional: input.legalPages.map(pageLink),
  };
}
