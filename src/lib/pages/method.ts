/**
 * Données de la page « Visualisation 3D » : lit les collections puis délègue à
 * `buildMethodModel` (pure, testée). Seul point d'accès aux collections pour cette page.
 */
import { getCollection } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { buildMethodModel, type MethodModel } from './method-model';
import { getPageData } from './page';

export async function getMethodData(): Promise<MethodModel> {
  const [page, etapes, avantages, articles, prestations, projets] = await Promise.all([
    getPageData('visualisation-3d'),
    getCollection('etapes'),
    getCollection('avantages'),
    getCollection('articles'),
    getCollection('prestations'),
    getCollection('projets'),
  ]);
  return buildMethodModel({
    page,
    etapes,
    avantages,
    homeLabel: microcopy.home,
    further: { articles, prestations, projets },
  });
}
