/**
 * Données de la page « À propos » : page, biographie (corps Markdown) et témoignages, mis en
 * forme par `buildAboutModel` (pure, testée). Seul point d'accès aux collections pour cette page.
 */
import { getCollection, getEntry, render } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import type { Thing } from 'schema-dts';
import { requireEntry } from '../content';
import { buildAboutPage, webPageInputFrom } from '../jsonld';
import { buildAboutModel, type AboutModel } from './about-model';

const PAGE_ID = 'a-propos';

export interface AboutData {
  readonly model: AboutModel;
  /** Biographie : corps Markdown de src/content/pages/a-propos.md. */
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
  /** JSON-LD `AboutPage` (entité principale : la fondatrice). */
  readonly jsonLd: readonly Thing[];
}

export async function getAboutData(origin: URL): Promise<AboutData> {
  const [entry, temoignages] = await Promise.all([
    getEntry('pages', PAGE_ID),
    getCollection('temoignages'),
  ]);
  const page = requireEntry(entry, 'pages', PAGE_ID);
  const { Content } = await render(page);
  const model = buildAboutModel({ page: page.data, temoignages, homeLabel: microcopy.home });
  return { model, Content, jsonLd: [buildAboutPage(webPageInputFrom(model), origin)] };
}
