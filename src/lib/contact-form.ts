/**
 * Formulaire de contact (docs/CONFORMITE.md §5) : noms des champs, validation et gestion du
 * jeton `{email}` des microcopies. Fonctions PURES, partagées par le rendu (build) et par
 * src/scripts/contact-form.ts (navigateur) ; testées dans tests/unit/contact-form.test.ts.
 */

/** Jeton des microcopies remplacé par `site.email` (l'adresse n'est jamais écrite dans le contenu). */
export const EMAIL_TOKEN = '{email}';

/** Attribut `name` des champs envoyés (lisibles dans l'email reçu par Amandine). */
export const CONTACT_FIELDS = {
  name: 'nom',
  email: 'email',
  phone: 'telephone',
  project: 'projet',
  message: 'message',
} as const;

export type ContactFieldKey = keyof typeof CONTACT_FIELDS;

/** Champ piège : nom attendu par Formspark (ADR-0003), à vérifier si un autre service est choisi. */
export const HONEYPOT_NAME = '_honeypot';
/** Champ de redirection après un envoi sans JS (Formspark). */
export const REDIRECT_NAME = '_redirect';

export type ContactErrorKey =
  'nameRequired' | 'emailRequired' | 'emailInvalid' | 'phoneInvalid' | 'messageRequired';

export type ContactValues = Readonly<Record<ContactFieldKey, string>>;

/** Erreur par champ, dans l'ordre d'affichage du formulaire (ordre du résumé). */
export type ContactErrors = Partial<Record<ContactFieldKey, ContactErrorKey>>;

/** Adresse plausible : une arobase, un domaine avec un point, aucun espace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Caractères admis dans un numéro saisi librement. */
const PHONE_CHARACTERS = /^\+?[\d\s.()-]+$/;
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** « 06 12 34 56 78 », « +33 6 12 34 56 78 », « 06.12.34.56.78 » : 10 à 15 chiffres. */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_CHARACTERS.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

/** Valide la saisie ; un objet vide signifie que la demande peut partir. */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  if (values.name.trim() === '') errors.name = 'nameRequired';
  if (values.email.trim() === '') errors.email = 'emailRequired';
  else if (!isValidEmail(values.email)) errors.email = 'emailInvalid';
  if (values.phone.trim() !== '' && !isValidPhone(values.phone)) errors.phone = 'phoneInvalid';
  if (values.message.trim() === '') errors.message = 'messageRequired';
  return errors;
}

/** Remplace le jeton `{email}` par l'adresse. */
export function fillEmail(text: string, email: string): string {
  return text.replaceAll(EMAIL_TOKEN, email);
}

/** Découpe un texte autour du premier jeton `{email}` (pour y insérer un lien `mailto:`). */
export function splitOnEmail(text: string): { readonly before: string; readonly after: string } {
  const index = text.indexOf(EMAIL_TOKEN);
  if (index === -1) return { before: text, after: '' };
  return { before: text.slice(0, index), after: text.slice(index + EMAIL_TOKEN.length) };
}

/** Méthode d'envoi selon la destination : service HTTP (`fetch` possible) ou repli `mailto:`. */
export interface FormTarget {
  readonly action: string;
  readonly kind: 'service' | 'mailto';
}

/**
 * Destination du formulaire : `PUBLIC_FORM_ENDPOINT` s'il est défini (URL https), sinon un
 * repli `mailto:` vers l'adresse du site (le formulaire reste utilisable, ADR-0003).
 */
export function resolveFormTarget(endpoint: string | undefined, email: string): FormTarget {
  const trimmed = endpoint?.trim() ?? '';
  if (trimmed !== '') {
    if (!/^https:\/\//.test(trimmed)) {
      throw new Error(`PUBLIC_FORM_ENDPOINT doit être une URL https (reçu « ${trimmed} »).`);
    }
    return { action: trimmed, kind: 'service' };
  }
  return { action: `mailto:${email}`, kind: 'mailto' };
}
