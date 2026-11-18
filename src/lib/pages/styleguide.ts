/**
 * Données du styleguide interne (src/pages/styleguide.astro) : textes d'ouverture, contenus
 * réels de l'accueil pour présenter les blocs, et un corps Markdown pour `RichText`.
 */
import { getEntry, render } from 'astro:content';
import { requireEntry } from '../content';
import { getHomeData } from './home';
import type { HomeModel } from './home-model';
import { getPageData } from './page';
import type { PageData } from './types';

/** Prestation dont le corps Markdown sert d'échantillon à `RichText`. */
const RICH_TEXT_SAMPLE = 'essentiel';

export interface StyleguideData {
  readonly page: PageData;
  readonly home: HomeModel;
  readonly richText: Awaited<ReturnType<typeof render>>;
}

export async function getStyleguideData(): Promise<StyleguideData> {
  const [page, home, sample] = await Promise.all([
    getPageData('styleguide'),
    getHomeData(),
    getEntry('prestations', RICH_TEXT_SAMPLE),
  ]);
  const richText = await render(requireEntry(sample, 'prestations', RICH_TEXT_SAMPLE));
  return { page, home, richText };
}
