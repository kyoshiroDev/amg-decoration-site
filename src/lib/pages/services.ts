/**
 * Données des pages Prestations : lit les collections puis délègue la mise en forme aux
 * fonctions pures de ./services-model.ts. Seul point d'accès aux collections pour ces pages.
 */
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
import { getPageData } from './page';

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

export async function getServicesData(): Promise<ServicesModel> {
  return buildServicesModel((await readInput()).input);
}

export interface ServicePageProps {
  readonly model: ServiceDetailModel;
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}

/** `getStaticPaths` de /prestations/[slug]/ : une page par entrée de la collection. */
export async function getServicePaths(): Promise<
  { params: { slug: string }; props: ServicePageProps }[]
> {
  const { input, entries } = await readInput();
  return Promise.all(
    entries.map(async (entry) => {
      const { Content } = await render(entry);
      return {
        params: { slug: entry.id },
        props: { model: buildServiceDetailModel({ ...input, slug: entry.id }), Content },
      };
    }),
  );
}
