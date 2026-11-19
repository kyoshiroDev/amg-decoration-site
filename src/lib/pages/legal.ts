/**
 * Données des pages légales : `getStaticPaths` de src/pages/[legal].astro. Lit la collection
 * `pages`, rend le corps Markdown et délègue la mise en forme à `buildLegalModel` (pure).
 */
import { getEntry, render } from 'astro:content';
import { microcopy } from '@/config/microcopy';
import { requireEntry } from '../content';
import { LEGAL_PAGE_IDS, buildLegalModel, type LegalModel } from './legal-model';

export interface LegalPageProps {
  readonly model: LegalModel;
  readonly Content: Awaited<ReturnType<typeof render>>['Content'];
}

export async function getLegalPaths(): Promise<
  { params: { legal: string }; props: LegalPageProps }[]
> {
  return Promise.all(
    LEGAL_PAGE_IDS.map(async (id) => {
      const entry = requireEntry(await getEntry('pages', id), 'pages', id);
      const { Content, headings } = await render(entry);
      return {
        params: { legal: id },
        props: {
          model: buildLegalModel({ id, page: entry.data, headings, homeLabel: microcopy.home }),
          Content,
        },
      };
    }),
  );
}
