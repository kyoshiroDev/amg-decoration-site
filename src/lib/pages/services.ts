/**
 * Données des pages Prestations : lit les collections puis délègue la mise en forme aux
 * fonctions pures de ./services-model.ts. Seul point d'accès aux collections pour ces pages.
 */
import { getImage } from 'astro:assets';
import { getCollection, render, type CollectionEntry } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import {
  buildServiceDetailModel,
  buildServicesModel,
  type ServiceDetailModel,
  type ServicesInput,
  type ServicesModel,
} from './services-model';
import { buildCollectionPage, webPageInputFrom } from '../jsonld';
import { getPageData } from './page';
import type { WithJsonLd } from './types';

/** Largeur de l'image publiée dans le JSON-LD (Google recommande ≥ 1200 px). */
const JSON_LD_IMAGE_WIDTH = 1200;

async function readInput(): Promise<{
  input: ServicesInput;
  entries: CollectionEntry<'prestations'>[];
}> {
  const [page, entries] = await Promise.all([
    getPageData('prestations'),
    getCollection('prestations'),
  ]);
  const input: ServicesInput = {
    page,
    prestations: entries,
    pricing: { showPrices: site.pricing.showPrices, fromLabel: microcopy.services.priceFrom },
    labels: { home: microcopy.home, index: microcopy.services.indexLabel },
  };
  return { input, entries };
}

/** Index des prestations ; JSON-LD `CollectionPage` listant formules puis offres, dans l'ordre affiché. */
export async function getServicesData(origin: URL): Promise<WithJsonLd<ServicesModel>> {
  const model = buildServicesModel((await readInput()).input);
  const items = [...model.formulas, ...model.offers].map((card) => ({
    name: card.title,
    path: card.href,
  }));
  return {
    ...model,
    jsonLd: [buildCollectionPage({ ...webPageInputFrom(model), items }, origin)],
  };
}

export interface ServicePageProps {
  readonly model: ServiceDetailModel;
  /** Visuel `cover` pour le JSON-LD `Service` (URL relative), absent sans visuel. */
  readonly imageUrl: string | undefined;
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}

/** `getStaticPaths` de /prestations/[slug]/ : une page par entrée de la collection. */
export async function getServicePaths(): Promise<
  { params: { slug: string }; props: ServicePageProps }[]
> {
  const { input, entries } = await readInput();
  return Promise.all(
    entries.map(async (entry) => {
      const cover = entry.data.cover?.image;
      const [{ Content }, image] = await Promise.all([
        render(entry),
        cover &&
          getImage({
            src: cover,
            width: Math.min(JSON_LD_IMAGE_WIDTH, cover.width),
            format: 'jpg',
          }),
      ]);
      const model = buildServiceDetailModel({ ...input, slug: entry.id });
      return { params: { slug: entry.id }, props: { model, imageUrl: image?.src, Content } };
    }),
  );
}
