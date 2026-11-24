/**
 * Données des pages Contact et Merci. Lit la collection `pages` et la variable
 * `PUBLIC_FORM_ENDPOINT` (ADR-0003, voir README § Variables d’environnement) au build, puis délègue aux fonctions
 * pures de ./contact-model.ts.
 */
import { microcopy } from '@/config/microcopy';
import { site } from '@/config/site';
import { buildContactPage, webPageInputFrom } from '../jsonld';
import { buildContactModel, type ContactModel } from './contact-model';
import { getPageData } from './page';
import type { PageData, WithJsonLd } from './types';

/** Page Contact ; JSON-LD `ContactPage` rattachée à l'entreprise. */
export async function getContactData(origin: URL): Promise<WithJsonLd<ContactModel>> {
  const page = await getPageData('contact');
  const model = buildContactModel({
    page,
    endpoint: import.meta.env.PUBLIC_FORM_ENDPOINT,
    email: site.email,
    origin,
    homeLabel: microcopy.home,
  });
  return { ...model, jsonLd: [buildContactPage(webPageInputFrom(model), origin)] };
}

/** Page de remerciement (noindex) : textes de src/content/pages/merci.md. */
export async function getThanksData(): Promise<PageData> {
  return getPageData('merci');
}
