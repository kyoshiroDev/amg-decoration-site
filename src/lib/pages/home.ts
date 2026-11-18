/**
 * Données de l'accueil (src/pages/index.astro) : lit les collections puis délègue la mise en
 * forme à `buildHomeModel` (pure, testée). Seul point d'accès aux collections pour cette page.
 */
import { getCollection } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import { buildHomeModel, type HomeModel } from './home-model';
import { getPageData } from './page';

export async function getHomeData(): Promise<HomeModel> {
  const [page, prestations, projets, etapes, avantages, temoignages] = await Promise.all([
    getPageData('accueil'),
    getCollection('prestations'),
    getCollection('projets'),
    getCollection('etapes'),
    getCollection('avantages'),
    getCollection('temoignages'),
  ]);

  return buildHomeModel({
    page,
    prestations,
    projets,
    etapes,
    avantages,
    temoignages,
    pricing: { showPrices: site.pricing.showPrices, fromLabel: microcopy.services.priceFrom },
    fallbackEyebrow: `${site.founder.name} · ${site.founder.jobTitle}`,
  });
}
