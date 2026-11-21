/**
 * Données des pages Prestations : lit les collections puis délègue la mise en forme aux
 * fonctions pures de ./services-model.ts. Seul point d'accès aux collections pour ces pages.
 */
import { getImage } from 'astro:assets';
import { getCollection, render, type CollectionEntry } from 'astro:content';
import type { Thing } from 'schema-dts';
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import type { FurtherItem } from './articles-model';
import {
  buildServiceDetailModel,
  buildServiceFurtherReading,
  buildServicesModel,
  type ServiceDetailModel,
  type ServicesInput,
  type ServicesModel,
} from './services-model';
import { buildCollectionPage, buildService, webPageInputFrom } from '../jsonld';
import { requireSiteOrigin } from '../url';
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
  /** « Pour aller plus loin » : 1 article publié et 1 réalisation. */
  readonly further: readonly FurtherItem[];
  /** Nœud JSON-LD `Service` (visuel `cover` compris s'il existe), prêt pour le layout. */
  readonly jsonLd: readonly Thing[];
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}

/**
 * `getStaticPaths` de /prestations/[slug]/ : une page par entrée de la collection.
 * `Astro.site` n'existe pas dans `getStaticPaths` : l'origine vient de `import.meta.env.SITE`.
 */
export async function getServicePaths(): Promise<
  { params: { slug: string }; props: ServicePageProps }[]
> {
  const origin = requireSiteOrigin(
    import.meta.env.SITE ? new URL(import.meta.env.SITE) : undefined,
  );
  const [{ input, entries }, articles, projets] = await Promise.all([
    readInput(),
    getCollection('articles'),
    getCollection('projets'),
  ]);
  const { article, project } = microcopy.services.further;
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
      const further = buildServiceFurtherReading({
        slug: entry.id,
        articles,
        projets,
        labels: { article, project },
      });
      return {
        params: { slug: entry.id },
        props: {
          model,
          further,
          jsonLd: [
            buildService({ ...model.service, imageUrl: image?.src }, site.areaServed, origin),
          ],
          Content,
        },
      };
    }),
  );
}
