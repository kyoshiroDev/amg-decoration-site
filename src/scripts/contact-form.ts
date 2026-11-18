/**
 * Formulaire de contact — amélioration progressive (blocks/ContactForm.astro). Sans ce script,
 * le formulaire s'envoie en POST HTML (validation native du navigateur).
 * Ajouts : validation avec les microcopies du contenu, erreurs reliées aux champs
 * (`aria-invalid`, `aria-describedby`), résumé des erreurs focalisé en tête, envoi `fetch` vers
 * le service, état « Envoi en cours… », succès ou échec annoncé (`role="status"`) puis focalisé.
 * En repli `mailto:` (aucun service configuré), le script valide puis laisse l'envoi natif.
 */
import {
  CONTACT_FIELDS,
  validateContact,
  type ContactErrorKey,
  type ContactErrors,
  type ContactFieldKey,
  type ContactValues,
} from '@/lib/contact-form';
import { onPageReady } from './lifecycle';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Messages = Readonly<Record<ContactErrorKey, string>>;

const FIELD_KEYS = Object.keys(CONTACT_FIELDS) as ContactFieldKey[];

function control(form: HTMLFormElement, key: ContactFieldKey): Control | null {
  return form.querySelector<Control>(`[data-field="${CONTACT_FIELDS[key]}"]`);
}

function readValues(form: HTMLFormElement): ContactValues {
  const entries = FIELD_KEYS.map((key) => [key, control(form, key)?.value ?? '']);
  return Object.fromEntries(entries) as Record<ContactFieldKey, string>;
}

/** Affiche (ou efface) l'erreur de chaque champ ; renvoie les champs en erreur, dans l'ordre. */
function renderFieldErrors(form: HTMLFormElement, errors: ContactErrors, messages: Messages) {
  return FIELD_KEYS.flatMap((key) => {
    const field = control(form, key);
    const slot = form.querySelector(`[data-field-error="${CONTACT_FIELDS[key]}"]`);
    const error = errors[key];
    if (!field || !slot) return [];
    slot.textContent = error ? messages[error] : '';
    if (error) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return error ? [{ field, message: messages[error] }] : [];
  });
}

function renderSummary(summary: HTMLElement, invalid: { field: Control; message: string }[]) {
  const list = summary.querySelector('[data-form-summary-list]');
  list?.replaceChildren(
    ...invalid.map(({ field, message }) => {
      const link = Object.assign(document.createElement('a'), {
        href: `#${field.id}`,
        textContent: message,
      });
      link.addEventListener('click', (event) => {
        event.preventDefault();
        field.focus();
      });
      const item = document.createElement('li');
      item.append(link);
      return item;
    }),
  );
  summary.hidden = invalid.length === 0;
}

function showStatus(status: HTMLElement, state: string, template: HTMLTemplateElement | null) {
  status.dataset['state'] = state;
  status.replaceChildren(template ? template.content.cloneNode(true) : '');
  status.focus();
}

onPageReady((signal) => {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  const root = form?.parentElement;
  const summary = root?.querySelector<HTMLElement>('[data-form-summary]');
  const status = root?.querySelector<HTMLElement>('[data-form-status]');
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitLabel = submit?.querySelector('.button__label');
  if (!form || !root || !summary || !status || !submit || !submitLabel) return;

  const messages = JSON.parse(form.dataset['messages'] ?? '{}') as Messages;
  const idleLabel = submitLabel.textContent ?? '';
  let sending = false;
  form.noValidate = true;

  const setSending = (value: boolean): void => {
    sending = value;
    submit.setAttribute('aria-disabled', String(value));
    submitLabel.textContent = value ? (form.dataset['sending'] ?? idleLabel) : idleLabel;
  };

  // Une fois signalé, un champ est revérifié à la sortie : l'erreur disparaît dès qu'il est corrigé.
  form.addEventListener(
    'focusout',
    (event) => {
      const target = event.target as Element;
      if (target.getAttribute('aria-invalid') !== 'true') return;
      renderFieldErrors(form, validateContact(readValues(form)), messages);
    },
    { signal },
  );

  form.addEventListener(
    'submit',
    (event) => {
      const invalid = renderFieldErrors(form, validateContact(readValues(form)), messages);
      renderSummary(summary, invalid);
      if (invalid.length > 0) {
        event.preventDefault();
        summary.focus();
        return;
      }
      if (form.dataset['kind'] !== 'service') return; // repli mailto: envoi natif
      event.preventDefault();
      if (sending) return;
      void send();
    },
    { signal },
  );

  async function send(): Promise<void> {
    if (!form || !status) return;
    setSending(true);
    status.dataset['state'] = 'sending';
    status.textContent = '';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
        signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      form.hidden = true;
      showStatus(status, 'success', root?.querySelector('[data-form-success]') ?? null);
    } catch {
      if (signal.aborted) return;
      showStatus(status, 'failure', root?.querySelector('[data-form-failure]') ?? null);
    } finally {
      setSending(false);
    }
  }
});
