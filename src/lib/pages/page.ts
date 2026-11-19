/**
 * Accès générique à une entrée de la collection `pages` (404, styleguide, pages simples).
 * Lève une erreur explicite si le fichier src/content/pages/<id>.md manque.
 */
import { getEntry } from 'astro:content';
import { requireEntry } from '../content';
import type { PageData } from './types';

export async function getPageData(id: string): Promise<PageData> {
  return requireEntry(await getEntry('pages', id), 'pages', id).data;
}
