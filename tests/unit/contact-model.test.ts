import { describe, expect, it } from 'vitest';
import { ContentError } from '@/lib/content';
import {
  CONTACT_SECTION_KEYS,
  THANKS_PATH,
  buildContactModel,
  type ContactFormContent,
  type ContactInput,
} from '@/lib/pages/contact-model';
import type { PageSection } from '@/lib/pages/types';

const section = (heading: string): PageSection => ({ heading, items: [], actions: [] });
const field = { label: 'L', hint: 'H' };

const form: ContactFormContent = {
  fields: {
    name: field,
    email: field,
    phone: field,
    project: { ...field, options: ['A', 'Je ne sais pas encore'], defaultOption: 'A' },
    message: field,
  },
  optionalMark: '(facultatif)',
  honeypotLabel: 'Ne remplissez pas ce champ',
  submit: { label: 'Envoyer', sending: 'Envoi…' },
  notice: {
    text: 'Écrivez-moi à {email}. Merci',
    moreLabel: 'En savoir plus :',
    link: { label: 'politique', href: '/confidentialite/' },
  },
  errors: {
    summary: 'S',
    nameRequired: 'N',
    emailRequired: 'E',
    emailInvalid: 'EI',
    phoneInvalid: 'P',
    messageRequired: 'M',
  },
  success: { title: 'Merci', text: 'Reçu' },
  failure: 'Échec : écrivez à {email}.',
};

function input(overrides: Partial<ContactInput> = {}): ContactInput {
  return {
    page: {
      seo: { title: 'T', description: 'D' },
      hero: { ...section('Contact'), eyebrow: 'Contact et devis' },
      sections: Object.fromEntries(CONTACT_SECTION_KEYS.map((key) => [key, section(key)])),
      form,
    },
    endpoint: 'https://submit-form.com/abc',
    email: 'a@b.fr',
    origin: new URL('https://amgdecorationdinterieur.com'),
    homeLabel: 'Accueil',
    ...overrides,
  };
}

describe('buildContactModel', () => {
  it('envoie au service et redirige vers /merci/ (envoi sans JS)', () => {
    const model = buildContactModel(input());
    expect(model.form.target).toEqual({ action: 'https://submit-form.com/abc', kind: 'service' });
    expect(model.form.redirectUrl).toBe(`https://amgdecorationdinterieur.com${THANKS_PATH}`);
  });

  it('se replie sur mailto: sans endpoint, sans redirection', () => {
    const model = buildContactModel(input({ endpoint: undefined }));
    expect(model.form.target).toEqual({ action: 'mailto:a@b.fr', kind: 'mailto' });
    expect(model.form.redirectUrl).toBeUndefined();
  });

  it('insère l’adresse du site dans la mention et le message d’échec', () => {
    const model = buildContactModel(input());
    expect(model.form.notice).toEqual({ before: 'Écrivez-moi à ', after: '. Merci' });
    expect(model.form.failure).toBe('Échec : écrivez à a@b.fr.');
  });

  it('fil d’Ariane : Accueil › Contact et devis', () => {
    expect(buildContactModel(input()).breadcrumbs.at(-1)).toEqual({
      label: 'Contact et devis',
      href: '/contact/',
    });
  });

  it('échoue sans clé `form`', () => {
    const base = input();
    const page = { ...base.page, form: undefined };
    expect(() => buildContactModel({ ...base, page })).toThrow(ContentError);
  });
});
