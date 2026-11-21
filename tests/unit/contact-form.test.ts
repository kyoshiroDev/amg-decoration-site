import { describe, expect, it } from 'vitest';
import {
  EMAIL_TOKEN,
  fillEmail,
  CONTACT_ERROR_KEYS,
  isFormMessages,
  isValidEmail,
  isValidPhone,
  resolveFormTarget,
  selectNoticeText,
  splitOnEmail,
  validateContact,
  type ContactValues,
} from '@/lib/contact-form';

const valid: ContactValues = {
  name: 'Camille Martin',
  email: 'camille@exemple.fr',
  phone: '',
  project: 'Je ne sais pas encore',
  message: 'Un salon de 20 m² à repenser.',
};

describe('validateContact', () => {
  it('accepte une demande complète, téléphone facultatif', () => {
    expect(validateContact(valid)).toEqual({});
  });

  it('signale les champs obligatoires vides (espaces compris)', () => {
    expect(validateContact({ ...valid, name: '  ', email: '', message: '\n' })).toEqual({
      name: 'nameRequired',
      email: 'emailRequired',
      message: 'messageRequired',
    });
  });

  it('distingue un email vide d’un email invalide', () => {
    expect(validateContact({ ...valid, email: 'camille@exemple' }).email).toBe('emailInvalid');
  });

  it('vérifie le téléphone seulement s’il est saisi', () => {
    expect(validateContact({ ...valid, phone: '06 12' }).phone).toBe('phoneInvalid');
    expect(validateContact({ ...valid, phone: '06 12 34 56 78' }).phone).toBeUndefined();
  });
});

describe('formats', () => {
  it.each(['prenom.nom@exemple.fr', ' a@b.co '])('email valide : %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['a@b', 'a b@c.fr', '@exemple.fr'])('email invalide : %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it.each(['06 12 34 56 78', '+33 6 12 34 56 78', '06.12.34.56.78', '(0)6-12-34-56-78'])(
    'téléphone valide : %s',
    (phone) => {
      expect(isValidPhone(phone)).toBe(true);
    },
  );

  it.each(['06 12 34', 'appelez-moi', '+33 6 12 34 56 78 90 12 34'])(
    'téléphone invalide : %s',
    (phone) => {
      expect(isValidPhone(phone)).toBe(false);
    },
  );
});

describe('jeton {email}', () => {
  it('remplace et découpe autour de l’adresse', () => {
    const text = `Écrivez-moi à ${EMAIL_TOKEN}.`;
    expect(fillEmail(text, 'a@b.fr')).toBe('Écrivez-moi à a@b.fr.');
    expect(splitOnEmail(text)).toEqual({ before: 'Écrivez-moi à ', after: '.' });
    expect(splitOnEmail('Sans adresse')).toEqual({ before: 'Sans adresse', after: '' });
  });
});

describe('resolveFormTarget', () => {
  it('utilise le service quand l’endpoint est défini', () => {
    expect(resolveFormTarget(' https://submit-form.com/abc ', 'a@b.fr')).toEqual({
      action: 'https://submit-form.com/abc',
      kind: 'service',
    });
  });

  it('se replie sur mailto: si l’endpoint est absent ou vide', () => {
    const fallback = { action: 'mailto:a@b.fr', kind: 'mailto' };
    expect(resolveFormTarget(undefined, 'a@b.fr')).toEqual(fallback);
    expect(resolveFormTarget('  ', 'a@b.fr')).toEqual(fallback);
  });

  it('refuse un endpoint non https', () => {
    expect(() => resolveFormTarget('http://exemple.fr', 'a@b.fr')).toThrow(/https/);
  });
});

describe('selectNoticeText', () => {
  const notice = { text: 'Service sécurisé', mailtoText: 'Votre messagerie s’ouvre' };

  it('mention du service quand un endpoint est configuré', () => {
    expect(selectNoticeText(notice, 'service')).toBe('Service sécurisé');
  });

  it('mention adaptée au repli mailto: (aucun service ne transmet les données)', () => {
    expect(selectNoticeText(notice, 'mailto')).toBe('Votre messagerie s’ouvre');
  });
});

describe('isFormMessages', () => {
  const complete = Object.fromEntries(CONTACT_ERROR_KEYS.map((key) => [key, `Erreur ${key}`]));

  it('accepte un message texte pour chaque clé d’erreur', () => {
    expect(isFormMessages(complete)).toBe(true);
  });

  it('refuse un objet incomplet ou un message non textuel', () => {
    const incomplete = Object.fromEntries(
      Object.entries(complete).filter(([key]) => key !== 'emailInvalid'),
    );
    expect(isFormMessages(incomplete)).toBe(false);
    expect(isFormMessages({ ...complete, phoneInvalid: 42 })).toBe(false);
  });

  it('refuse ce qui n’est pas un objet', () => {
    expect(isFormMessages(null)).toBe(false);
    expect(isFormMessages('{}')).toBe(false);
    expect(isFormMessages([])).toBe(false);
  });
});
