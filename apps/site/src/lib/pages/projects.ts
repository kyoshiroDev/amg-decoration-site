/**
 * Données des pages Réalisations (src/pages/realisations/) : lit les collections puis délègue
 * la mise en forme aux fonctions pures de ./projects-model.ts. Seul point d'accès aux
 * collections pour ces pages.
 */
import type { ImageMetadata } from 'astro';
import type { PageSection, WithJsonLd } from './types';
import { getImage } from 'astro:assets';
import { getCollection, render } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { requireSection } from '../content';
import { buildCollectionPage, webPageInputFrom } from '../jsonld';
import { getPageData } from './page';
import {
  buildProjectPageModel,
  buildProjectsIndexModel,
  type ProjectPageModel,
  type ProjectsIndexModel,
} from './projects-model';

/** Largeur des images publiées dans le JSON-LD (Google recommande ≥ 1200 px). */
const JSON_LD_IMAGE_WIDTH = 1200;

/** Index des réalisations ; JSON-LD `CollectionPage` listant les projets dans l'ordre affiché. */
export async function getProjectsIndexData(origin: URL): Promise<WithJsonLd<ProjectsIndexModel>> {
  const [page, projets] = await Promise.all([
    getPageData('realisations'),
    getCollection('projets'),
  ]);
  const model = buildProjectsIndexModel({
    page,
    projets,
    roomTypeLabels: microcopy.projects.roomTypes,
    labels: { home: microcopy.home, indexLabel: microcopy.projects.indexLabel },
  });
  const items = model.projects.map((project) => ({ name: project.title, path: project.href }));
  return {
    ...model,
    jsonLd: [buildCollectionPage({ ...webPageInputFrom(model), items }, origin)],
  };
}

/** URL (relatives au site) des visuels d'un projet, en JPEG, sans doublon. */
async function jsonLdImageUrls(images: readonly ImageMetadata[]): Promise<string[]> {
  const unique = [...new Set(images)];
  const results = await Promise.all(
    unique.map((src) =>
      getImage({ src, width: Math.min(JSON_LD_IMAGE_WIDTH, src.width), format: 'jpg' }),
    ),
  );
  return [...new Set(results.map((result) => result.src))];
}

export interface ProjectPageProps {
  readonly project: ProjectPageModel;
  /** Visuels pour le JSON-LD `CreativeWork` (URL relatives, rendues absolues par le layout). */
  readonly imageUrls: readonly string[];
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
  /** Appel à l'action de fin de page, partagé avec l'index (src/content/pages/realisations.md). */
  readonly cta: PageSection;
}

/** Chemins statiques de `/realisations/<slug>/` (un par fichier de src/content/projets/). */
export async function getProjectPaths(): Promise<
  { params: { slug: string }; props: ProjectPageProps }[]
> {
  const [projets, prestations, page] = await Promise.all([
    getCollection('projets'),
    getCollection('prestations'),
    getPageData('realisations'),
  ]);
  const cta = requireSection(page.sections, 'cta', 'realisations');
  const labels = {
    home: microcopy.home,
    indexLabel: microcopy.projects.indexLabel,
    roomTypes: microcopy.projects.roomTypes,
    facts: microcopy.projects.facts,
    galleryKinds: microcopy.projects.gallery.kinds,
  };
  return Promise.all(
    projets.map(async (entry) => {
      const [{ Content }, imageUrls] = await Promise.all([
        render(entry),
        jsonLdImageUrls([entry.data.cover.image, ...entry.data.gallery.map((item) => item.image)]),
      ]);
      const project = buildProjectPageModel({ entry, projets, prestations, labels });
      return { params: { slug: entry.id }, props: { project, imageUrls, Content, cta } };
    }),
  );
}
