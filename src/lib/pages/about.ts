/**
 * Données de la page « À propos » : page, biographie (corps Markdown) et témoignages, mis en
 * forme par `buildAboutModel` (pure, testée). Seul point d'accès aux collections pour cette page.
 */
import { getCollection, getEntry, render } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { requireEntry } from '../content';
import { buildAboutModel, type AboutModel } from './about-model';

const PAGE_ID = 'a-propos';

export interface AboutData {
  readonly model: AboutModel;
  /** Biographie : corps Markdown de src/content/pages/a-propos.md. */
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}

export async function getAboutData(): Promise<AboutData> {
  const [entry, temoignages] = await Promise.all([
    getEntry('pages', PAGE_ID),
    getCollection('temoignages'),
  ]);
  const page = requireEntry(entry, 'pages', PAGE_ID);
  const { Content } = await render(page);
  return {
    model: buildAboutModel({ page: page.data, temoignages, homeLabel: microcopy.home }),
    Content,
  };
}
