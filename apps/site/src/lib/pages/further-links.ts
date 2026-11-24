/**
 * Cartes « Pour aller plus loin » déclarées dans le contenu d'une page (src/content/pages/) :
 * chaque lien (`links`) d'une section donne le surtitre (`label`) et la cible (`href`) ; le titre et le
 * texte viennent de l'entrée de collection visée, pour rester identiques partout. Fonction PURE.
 * Une cible inconnue (ou un article brouillon) fait échouer le build.
 */
import type { ProjectEntryLike, ServiceEntryLike } from '../cards';
import { ContentError } from '../content';
import { articlePath, projectPath, servicePath } from '../routes';
import { selectPublishedArticles, type ArticleEntryLike, type FurtherItem } from './articles-model';
import type { PageSection } from './types';

export interface FurtherSources {
  /** Tous les articles (brouillons compris : ils ne sont jamais des cibles valides). */
  readonly articles: readonly ArticleEntryLike[];
  readonly prestations: readonly ServiceEntryLike[];
  readonly projets: readonly ProjectEntryLike[];
}

export function resolveFurtherLinks(
  section: PageSection,
  sources: FurtherSources,
  pageId: string,
): FurtherItem[] {
  const candidates: FurtherItem[] = [
    ...selectPublishedArticles(sources.articles).map((entry): FurtherItem => ({
      kind: 'article',
      eyebrow: '',
      title: entry.data.title,
      text: entry.data.seo.description,
      href: articlePath(entry.id),
    })),
    ...sources.prestations.map((entry): FurtherItem => ({
      kind: 'service',
      eyebrow: '',
      title: entry.data.title,
      text: entry.data.summary,
      href: servicePath(entry.id),
    })),
    ...sources.projets.map((entry): FurtherItem => ({
      kind: 'project',
      eyebrow: '',
      title: entry.data.title,
      text: entry.data.summary,
      href: projectPath(entry.id),
    })),
  ];
  return (section.links ?? []).map((action) => {
    const target = candidates.find((candidate) => candidate.href === action.href);
    if (!target) {
      throw new ContentError(
        `Lien « ${action.href} » de src/content/pages/${pageId}.md : aucun article publié, aucune prestation ni réalisation à cette adresse.`,
      );
    }
    return { ...target, eyebrow: action.label };
  });
}
