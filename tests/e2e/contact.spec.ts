import { expect, test, type Page } from '@playwright/test';
import { site } from '../../src/config/site';
import { expectNoAxeViolations } from './helpers';

// Formulaire de contact (docs/CONFORMITE.md §5). Aucun appel réseau réel : l'envoi est
// intercepté par `page.route` et toute requête hors du serveur local est bloquée.

const MOCK_ENDPOINT = 'https://formulaire.test/envoi';

const TEXTS = {
  submit: 'Envoyer ma demande',
  sending: 'Envoi en cours…',
  summary: /Votre demande n’est pas encore partie/,
  nameRequired: 'Indiquez votre nom pour que je sache comment m’adresser à vous.',
  emailInvalid: /Cette adresse email semble incomplète/,
  phoneInvalid: /Ce numéro semble incomplet/,
  success: /Merci, votre message est bien parti/,
  failure: /Votre message n’a pas pu être envoyé/,
  mailtoNotice: /votre messagerie s’ouvre avec votre demande pré-remplie/,
  serviceNotice: /service de formulaire/,
  mailtoHint: /Si rien ne s’ouvre, écrivez-moi directement à/,
};

async function blockExternalRequests(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
}

/**
 * Le build de test n'a pas de `PUBLIC_FORM_ENDPOINT` (repli mailto:). On simule un service
 * configuré en réécrivant la destination, lue par le script au moment de l'envoi.
 */
async function useMockService(page: Page): Promise<void> {
  await page.locator('form[data-contact-form]').evaluate((form, endpoint) => {
    form.setAttribute('action', endpoint);
    form.removeAttribute('enctype');
    (form as HTMLFormElement).dataset['kind'] = 'service';
  }, MOCK_ENDPOINT);
}

async function fillValidForm(page: Page): Promise<void> {
  await page.getByLabel('Votre nom').fill('Camille Martin');
  await page.getByLabel('Votre email').fill('camille@exemple.fr');
  await page.getByLabel('Votre message').fill('Un salon de 20 m² à repenser en 3D.');
}

test.describe('Contact : sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('formulaire HTML conforme, champs et attributs attendus', async ({ page }) => {
    await page.goto('/contact/');
    const form = page.locator('form[data-contact-form]');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', /^(https:\/\/|mailto:)/);

    const expectations = [
      { label: 'Votre nom', autocomplete: 'name', required: true },
      { label: 'Votre email', autocomplete: 'email', required: true },
      { label: /Votre téléphone/, autocomplete: 'tel', required: false },
      { label: 'Votre projet', autocomplete: 'off', required: true },
      { label: 'Votre message', autocomplete: 'off', required: true },
    ];
    for (const { label, autocomplete, required } of expectations) {
      const field = page.getByLabel(label, { exact: typeof label === 'string' });
      await expect(field).toHaveAttribute('autocomplete', autocomplete);
      if (required) await expect(field).toHaveAttribute('required', '');
      else await expect(field).not.toHaveAttribute('required');
    }
    await expect(page.getByText('(facultatif)')).toBeVisible();
    const project = page.getByLabel('Votre projet', { exact: true });
    await expect(project).toHaveValue('Je ne sais pas encore');
    await expect(project.locator('option')).toHaveCount(8);
  });

  test('ni adresse, ni case de consentement', async ({ page }) => {
    await page.goto('/contact/');
    const form = page.locator('form[data-contact-form]');
    await expect(form.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(
      form.locator('[autocomplete*="address"], [autocomplete="postal-code"]'),
    ).toHaveCount(0);
  });

  test('repli mailto: mention adaptée, indice visible, aucun champ piège', async ({ page }) => {
    await page.goto('/contact/');
    const form = page.locator('form[data-contact-form]');
    await expect(form).toHaveAttribute('action', `mailto:${site.email}`);
    const notice = page.locator('.contact-form__notice');
    await expect(notice).toContainText(TEXTS.mailtoNotice);
    await expect(notice).not.toContainText(TEXTS.serviceNotice);
    const hint = form.locator('[data-form-mailto-hint]');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(TEXTS.mailtoHint);
    await expect(hint.getByRole('link', { name: site.email })).toHaveAttribute(
      'href',
      `mailto:${site.email}`,
    );
    await expect(form.locator('input[name="_honeypot"]')).toHaveCount(0);
    await expect(form.locator('input[name="_redirect"]')).toHaveCount(0);
  });

  test('mention d’information sous le bouton, email du site et lien politique', async ({
    page,
  }) => {
    await page.goto('/contact/');
    const notice = page.locator('.contact-form__notice');
    await expect(notice).toContainText('conservées au maximum 3 ans');
    await expect(notice.getByRole('link', { name: site.email })).toHaveAttribute(
      'href',
      `mailto:${site.email}`,
    );
    await expect(
      notice.getByRole('link', { name: /politique de confidentialité/ }),
    ).toHaveAttribute('href', '/confidentialite/');
  });

  test('coordonnées directes à côté du formulaire', async ({ page }) => {
    await page.goto('/contact/');
    const details = page.locator('#coordonnees-titre').locator('xpath=ancestor::section[1]');
    await expect(details.locator(`a[href="tel:${site.phone.e164}"]`)).toHaveCount(1);
    await expect(details.locator(`a[href="mailto:${site.email}"]`)).toHaveCount(1);
    await expect(details.locator(`a[href="${site.whatsapp.url}"]`)).toHaveCount(1);
    await expect(details).toContainText(/lundi au vendredi/);
  });
});

test.describe('Contact : avec JavaScript', () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/contact/');
  });

  test('erreurs : résumé focalisé, champs invalides reliés à leur message', async ({ page }) => {
    await page.getByLabel('Votre email').fill('camille@exemple');
    await page.getByLabel(/Votre téléphone/).fill('06 12');
    await page.getByRole('button', { name: TEXTS.submit }).click();

    const summary = page.locator('[data-form-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(TEXTS.summary);
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link')).toHaveCount(4);

    const name = page.getByLabel('Votre nom');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(new RegExp(TEXTS.nameRequired));
    await expect(page.getByLabel('Votre email')).toHaveAccessibleDescription(TEXTS.emailInvalid);
    await expect(page.getByLabel(/Votre téléphone/)).toHaveAccessibleDescription(
      TEXTS.phoneInvalid,
    );

    await summary.getByRole('link', { name: TEXTS.nameRequired }).click();
    await expect(name).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test('une erreur corrigée disparaît à la sortie du champ', async ({ page }) => {
    await page.getByRole('button', { name: TEXTS.submit }).click();
    const name = page.getByLabel('Votre nom');
    await name.fill('Camille');
    await name.blur();
    await expect(name).not.toHaveAttribute('aria-invalid');
  });

  test('succès : état d’envoi, message annoncé et focalisé, formulaire masqué', async ({
    page,
  }) => {
    await useMockService(page);
    let payload: Record<string, string> = {};
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(MOCK_ENDPOINT, async (route) => {
      payload = route.request().postDataJSON() as Record<string, string>;
      await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await fillValidForm(page);
    await page.getByRole('button', { name: TEXTS.submit }).click();
    const button = page.locator('form[data-contact-form] button[type="submit"]');
    await expect(button).toHaveText(TEXTS.sending);
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('status')).toHaveText(TEXTS.sending);
    release();

    const status = page.getByRole('status');
    await expect(status).toContainText(TEXTS.success);
    await expect(status).toBeFocused();
    await expect(page.locator('form[data-contact-form]')).toBeHidden();
    expect(payload).toMatchObject({
      nom: 'Camille Martin',
      email: 'camille@exemple.fr',
      projet: 'Je ne sais pas encore',
    });
    await expectNoAxeViolations(page);
  });

  test('échec : message avec l’email du site, formulaire conservé', async ({ page }) => {
    await useMockService(page);
    await page.route(MOCK_ENDPOINT, (route) => route.fulfill({ status: 500, body: '' }));
    await fillValidForm(page);
    await page.getByRole('button', { name: TEXTS.submit }).click();

    const status = page.getByRole('status');
    await expect(status).toContainText(TEXTS.failure);
    await expect(status).toContainText(site.email);
    await expect(status).toBeFocused();
    await expect(page.getByLabel('Votre nom')).toHaveValue('Camille Martin');
    await expect(page.getByRole('button', { name: TEXTS.submit })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  test('repli mailto: l’indice est annoncé avant l’ouverture de la messagerie', async ({
    page,
  }) => {
    // Le script du site s'exécute d'abord ; ce second écouteur empêche seulement l'ouverture
    // réelle d'un client mail pendant le test.
    await page
      .locator('form[data-contact-form]')
      .evaluate((form) => form.addEventListener('submit', (event) => event.preventDefault()));
    await fillValidForm(page);
    await page.getByRole('button', { name: TEXTS.submit }).click();
    await expect(page.getByRole('status')).toContainText(TEXTS.mailtoHint);
    await expect(page.getByRole('status')).toContainText(site.email);
    await expect(page.locator('[data-form-summary]')).toBeHidden();
  });

  test('0 violation axe au repos', async ({ page }) => {
    await expectNoAxeViolations(page);
  });
});
