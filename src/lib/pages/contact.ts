/**
 * Données des pages Contact et Merci. Lit la collection `pages` et la variable
 * `PUBLIC_FORM_ENDPOINT` (ADR-0003, voir README § Variables d’environnement) au build, puis délègue aux fonctions
 * pures de ./contact-model.ts.
 */
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import { buildContactModel, type ContactModel } from './contact-model';
import { getPageData } from './page';
import type { PageData } from './types';

export async function getContactData(origin: URL): Promise<ContactModel> {
  const page = await getPageData('contact');
  return buildContactModel({
    page,
    endpoint: import.meta.env.PUBLIC_FORM_ENDPOINT,
    email: site.email,
    origin,
    homeLabel: microcopy.home,
  });
}

/** Page de remerciement (noindex) : textes de src/content/pages/merci.md. */
export async function getThanksData(): Promise<PageData> {
  return getPageData('merci');
}
