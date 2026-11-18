/**
 * Modèles des pages Contact (/contact/) et Merci (/merci/) : textes de la page, formulaire
 * (docs/CONFORMITE.md §5) et destination d'envoi. Fonctions PURES (tests/unit/contact-model.test.ts),
 * accès aux collections et à l'environnement dans ./contact.ts.
 */
import { fillEmail, resolveFormTarget, splitOnEmail, type FormTarget } from '../contact-form';
import { ContentError } from '../content';
import type { BreadcrumbItem } from '../jsonld';
import { breadcrumbTrail } from './breadcrumb-trail';
import { readSections } from './sections';
import type { PageData, PageSection } from './types';

export const CONTACT_SECTION_KEYS = ['formulaire', 'coordonnees'] as const;
export type ContactSectionKey = (typeof CONTACT_SECTION_KEYS)[number];

export const CONTACT_PATH = '/contact/';
/** Page de remerciement après un envoi sans JavaScript (noindex, hors sitemap). */
export const THANKS_PATH = '/merci/';
const PAGE_ID = 'contact';

export type ContactFormContent = NonNullable<PageData['form']>;

export interface ContactFormModel {
  readonly target: FormTarget;
  /** URL absolue de /merci/ transmise au service (envoi sans JS) ; absente en repli `mailto:`. */
  readonly redirectUrl: string | undefined;
  readonly email: string;
  readonly content: ContactFormContent;
  /** Mention d'information découpée autour de l'adresse (insérée en lien `mailto:`). */
  readonly notice: { readonly before: string; readonly after: string };
  /** Message d'échec, adresse insérée. */
  readonly failure: string;
}

export interface ContactInput {
  readonly page: Pick<PageData, 'seo' | 'hero' | 'sections' | 'form'>;
  /** `PUBLIC_FORM_ENDPOINT` (ADR-0003), `undefined` tant que le service n'est pas choisi. */
  readonly endpoint: string | undefined;
  readonly email: string;
  readonly origin: URL;
  readonly homeLabel: string;
}

export interface ContactModel {
  readonly seo: { readonly title: string; readonly description: string };
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly hero: PageSection;
  readonly sections: Readonly<Record<ContactSectionKey, PageSection>>;
  readonly form: ContactFormModel;
}

export function buildContactFormModel(
  content: ContactFormContent,
  options: Pick<ContactInput, 'endpoint' | 'email' | 'origin'>,
): ContactFormModel {
  const target = resolveFormTarget(options.endpoint, options.email);
  return {
    target,
    redirectUrl: target.kind === 'service' ? new URL(THANKS_PATH, options.origin).href : undefined,
    email: options.email,
    content,
    notice: splitOnEmail(content.notice.text),
    failure: fillEmail(content.failure, options.email),
  };
}

export function buildContactModel(input: ContactInput): ContactModel {
  const { page } = input;
  if (!page.form) {
    throw new ContentError(
      `La clé \`form\` est absente de src/content/pages/${PAGE_ID}.md (formulaire de contact).`,
    );
  }
  return {
    seo: page.seo,
    breadcrumbs: breadcrumbTrail(input.homeLabel, {
      label: page.hero.eyebrow ?? page.hero.heading,
      href: CONTACT_PATH,
    }),
    hero: page.hero,
    sections: readSections(page.sections, CONTACT_SECTION_KEYS, PAGE_ID),
    form: buildContactFormModel(page.form, input),
  };
}
