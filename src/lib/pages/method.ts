/**
 * Données de la page « Visualisation 3D » : lit les collections puis délègue à
 * `buildMethodModel` (pure, testée). Seul point d'accès aux collections pour cette page.
 * JSON-LD : nœud `Service` relié à l'entreprise (`provider` → `#entreprise`).
 */
import { getCollection } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import { buildService } from '../jsonld';
import { buildMethodModel, type MethodModel } from './method-model';
import { getPageData } from './page';
import type { WithJsonLd } from './types';

export async function getMethodData(origin: URL): Promise<WithJsonLd<MethodModel>> {
  const [page, etapes, avantages, articles, prestations, projets] = await Promise.all([
    getPageData('visualisation-3d'),
    getCollection('etapes'),
    getCollection('avantages'),
    getCollection('articles'),
    getCollection('prestations'),
    getCollection('projets'),
  ]);
  const model = buildMethodModel({
    page,
    etapes,
    avantages,
    homeLabel: microcopy.home,
    further: { articles, prestations, projets },
  });
  return { ...model, jsonLd: [buildService(model.service, site.areaServed, origin)] };
}
