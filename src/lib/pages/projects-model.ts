/**
 * Modèles des pages Réalisations (index filtrable et page projet), construits à partir des
 * entrées BRUTES des collections (fonctions pures, testées dans tests/unit/projects-model.test.ts).
 * L'accès aux collections est dans ./projects.ts.
 */
import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import {
  toProjectCard,
  type ProjectCardData,
  type ProjectEntryLike,
  type ServiceEntryLike,
} from '../cards';
import { ContentError, requireSection, sortByOrder } from '../content';
import type { BreadcrumbItem } from '../jsonld';
import { projectPath, servicePath, type ProjectPath, type ServicePath } from '../routes';
import type { PageSection } from './types';

export type RoomType = CollectionEntry<'projets'>['data']['roomTypes'][number];
export type GalleryKind = CollectionEntry<'projets'>['data']['gallery'][number]['kind'];

/** Ordre de lecture de la galerie : l'existant, le projet en 3D, puis le résultat. */
export const GALLERY_KIND_ORDER: readonly GalleryKind[] = ['avant', '3d', 'apres'];

interface Figure {
  readonly image: ImageMetadata;
  readonly alt: string;
}

export interface ProjectDetailEntryLike extends ProjectEntryLike {
  readonly data: ProjectEntryLike['data'] & {
    readonly roomTypes: readonly RoomType[];
    readonly service?: { readonly id: string } | undefined;
    readonly gallery: readonly (Figure & {
      readonly kind: GalleryKind;
      readonly caption?: string | undefined;
    })[];
    readonly beforeAfter?: { readonly rendering: Figure; readonly result: Figure } | undefined;
    readonly seo: { readonly title: string; readonly description: string };
  };
}

/* ------------------------------------------------------------------ */
/* Index /realisations/                                                */
/* ------------------------------------------------------------------ */

export interface FilterOption {
  readonly value: RoomType;
  readonly label: string;
  readonly count: number;
}

export interface CatalogItem extends ProjectCardData {
  readonly rooms: readonly RoomType[];
}

export interface ProjectsIndexInput {
  readonly page: {
    readonly seo: { readonly title: string; readonly description: string };
    readonly hero: PageSection;
    readonly sections: Readonly<Record<string, PageSection>>;
  };
  readonly projets: readonly ProjectDetailEntryLike[];
  readonly roomTypeLabels: Readonly<Record<RoomType, string>>;
  readonly labels: { readonly home: string; readonly indexLabel: string };
}

export interface ProjectsIndexModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly hero: PageSection;
  readonly cta: PageSection;
  readonly projects: readonly CatalogItem[];
  /** Types de pièce présents, dans l'ordre des libellés ; vide s'il n'y a rien à filtrer. */
  readonly filters: readonly FilterOption[];
  readonly breadcrumbs: readonly BreadcrumbItem[];
  /** Image Open Graph : couverture de la première carte affichée (image par défaut si aucune). */
  readonly ogImage?: Figure | undefined;
}

const INDEX_PAGE_ID = 'realisations';

/** Un filtre par type de pièce présent dans au moins un projet (ordre des libellés). */
export function buildRoomFilters(
  projects: readonly { readonly rooms: readonly RoomType[] }[],
  labels: Readonly<Record<RoomType, string>>,
): FilterOption[] {
  const options = (Object.keys(labels) as RoomType[])
    .map((value) => ({
      value,
      label: labels[value],
      count: projects.filter((project) => project.rooms.includes(value)).length,
    }))
    .filter((option) => option.count > 0);
  // Un seul type de pièce, ou un type commun à tous les projets : filtrer n'apporterait rien.
  const useful = options.filter((option) => option.count < projects.length);
  return useful.length > 0 ? options : [];
}

export function buildProjectsIndexModel(input: ProjectsIndexInput): ProjectsIndexModel {
  const projects = sortByOrder(input.projets).map((entry) => ({
    ...toProjectCard(entry),
    rooms: entry.data.roomTypes,
  }));
  return {
    seo: input.page.seo,
    hero: input.page.hero,
    cta: requireSection(input.page.sections, 'cta', INDEX_PAGE_ID),
    projects,
    filters: buildRoomFilters(projects, input.roomTypeLabels),
    breadcrumbs: [
      { label: input.labels.home, href: '/' },
      { label: input.labels.indexLabel, href: '/realisations/' },
    ],
    ogImage: projects[0] && { image: projects[0].image, alt: projects[0].alt },
  };
}

/* ------------------------------------------------------------------ */
/* Page projet /realisations/<slug>/                                   */
/* ------------------------------------------------------------------ */

export interface ProjectFact {
  readonly label: string;
  readonly value: string;
  readonly href?: ServicePath | undefined;
}

export interface GalleryGroup {
  readonly kind: GalleryKind;
  readonly label: string;
  readonly items: readonly (Figure & { readonly caption: string | undefined })[];
}

export interface ProjectLabels {
  readonly home: string;
  readonly indexLabel: string;
  readonly roomTypes: Readonly<Record<RoomType, string>>;
  readonly facts: {
    readonly location: string;
    readonly rooms: string;
    readonly style: string;
    readonly service: string;
  };
  readonly galleryKinds: Readonly<Record<GalleryKind, string>>;
}

export interface ProjectPageModel {
  readonly slug: string;
  readonly href: ProjectPath;
  readonly title: string;
  readonly summary: string;
  readonly seo: { readonly title: string; readonly description: string };
  readonly cover: Figure;
  readonly facts: readonly ProjectFact[];
  readonly gallery: readonly GalleryGroup[];
  readonly beforeAfter: { readonly rendering: Figure; readonly result: Figure } | undefined;
  readonly previous: ProjectCardData | undefined;
  readonly next: ProjectCardData | undefined;
  readonly breadcrumbs: readonly BreadcrumbItem[];
}

export interface ProjectPageInput {
  readonly entry: ProjectDetailEntryLike;
  /** Toutes les réalisations (pour le projet précédent et le suivant). */
  readonly projets: readonly ProjectDetailEntryLike[];
  readonly prestations: readonly ServiceEntryLike[];
  readonly labels: ProjectLabels;
}

/**
 * Voisins d'une entrée dans une liste ordonnée, en boucle : le dernier projet mène au premier.
 * Avec deux entrées, seul `next` est rempli (précédent et suivant seraient identiques).
 */
export function selectSiblings<T extends { readonly id: string }>(
  ordered: readonly T[],
  id: string,
): { previous: T | undefined; next: T | undefined } {
  const index = ordered.findIndex((entry) => entry.id === id);
  if (index < 0 || ordered.length < 2) return { previous: undefined, next: undefined };
  const next = ordered[(index + 1) % ordered.length];
  const previous = ordered.length > 2 ? ordered.at(index - 1) : undefined;
  return { previous, next };
}

/** Images de la galerie regroupées par nature, dans l'ordre Avant → Rendu 3D → Réalisé. */
export function groupGallery(
  gallery: ProjectDetailEntryLike['data']['gallery'],
  labels: Readonly<Record<GalleryKind, string>>,
): GalleryGroup[] {
  return GALLERY_KIND_ORDER.map((kind) => ({
    kind,
    label: labels[kind],
    items: gallery
      .filter((item) => item.kind === kind)
      .map(({ image, alt, caption }) => ({ image, alt, caption })),
  })).filter((group) => group.items.length > 0);
}

/** « Pièce de vie, chambre parentale, chambre d’enfant » : capitale au premier élément seulement. */
export function formatRoomList(
  rooms: readonly RoomType[],
  labels: Readonly<Record<RoomType, string>>,
): string {
  return rooms
    .map((room, index) => {
      const label = labels[room];
      return index === 0 ? label : label.charAt(0).toLocaleLowerCase('fr-FR') + label.slice(1);
    })
    .join(', ');
}

function buildFacts(input: ProjectPageInput): ProjectFact[] {
  const { data } = input.entry;
  const { facts, roomTypes } = input.labels;
  const result: ProjectFact[] = [];
  if (data.location) result.push({ label: facts.location, value: data.location });
  result.push({
    label: facts.rooms,
    value: formatRoomList(data.roomTypes, roomTypes),
  });
  result.push({ label: facts.style, value: data.style });
  if (data.service) {
    const serviceId = data.service.id;
    const service = input.prestations.find((entry) => entry.id === serviceId);
    if (!service) {
      throw new ContentError(
        `Prestation « ${serviceId} » introuvable (src/content/projets/${input.entry.id}.md, champ \`service\`).`,
      );
    }
    result.push({ label: facts.service, value: service.data.title, href: servicePath(serviceId) });
  }
  return result;
}

export function buildProjectPageModel(input: ProjectPageInput): ProjectPageModel {
  const { entry, labels } = input;
  const { data } = entry;
  const href = projectPath(entry.id);
  const siblings = selectSiblings(sortByOrder(input.projets), entry.id);
  return {
    slug: entry.id,
    href,
    title: data.title,
    summary: data.summary,
    seo: data.seo,
    cover: data.cover,
    facts: buildFacts(input),
    gallery: groupGallery(data.gallery, labels.galleryKinds),
    beforeAfter: data.beforeAfter,
    previous: siblings.previous && toProjectCard(siblings.previous),
    next: siblings.next && toProjectCard(siblings.next),
    breadcrumbs: [
      { label: labels.home, href: '/' },
      { label: labels.indexLabel, href: '/realisations/' },
      { label: data.title, href },
    ],
  };
}
