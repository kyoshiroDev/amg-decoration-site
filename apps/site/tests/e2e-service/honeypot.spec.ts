import { expect, test, type Page } from '@playwright/test';
import { HONEYPOT_NAME, REDIRECT_NAME } from '../../src/lib/contact-form';
import { MOCK_FORM_ENDPOINT } from '../../playwright.service.config';
import { THANKS_PATH } from '../../src/lib/pages/contact-model';
import { expectNoAxeViolations } from '../e2e/helpers';
import { SITE_ORIGIN } from '../e2e/jsonld-assert';

// Formulaire de contact en mode service (ADR-0003, docs/CONFORMITE.md §5) : build de
// `dist-service/` avec `PUBLIC_FORM_ENDPOINT` = MOCK_FORM_ENDPOINT. Aucun appel réseau réel :
// toute requête hors du serveur local est bloquée, l'endpoint est intercepté par `page.route`.

const TEXTS = {
  submit: 'Envoyer ma demande',
  honeypotLabel: 'Ne remplissez pas ce champ',
  success: /Merci, votre message est bien parti/,
  serviceNotice: /transmises par un service de formulaire sécurisé/,
  mailtoNotice: /votre messagerie s’ouvre/,
};

/** URL absolue de /merci/ transmise au service (`_redirect`, envoi sans JS). */
const THANKS_URL = new URL(THANKS_PATH, SITE_ORIGIN).href;

const VALID_INPUT = {
  nom: 'Camille Martin',
  email: 'camille@exemple.fr',
  message: 'Un salon de 20 m² à repenser en 3D.',
};

async function blockExternalRequests(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
}

async function fillValidForm(page: Page): Promise<void> {
  await page.getByLabel('Votre nom').fill(VALID_INPUT.nom);
  await page.getByLabel('Votre email').fill(VALID_INPUT.email);
  await page.getByLabel('Votre message').fill(VALID_INPUT.message);
}

function honeypot(page: Page) {
  return page.locator(`form[data-contact-form] input[name="${HONEYPOT_NAME}"]`);
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test('destination du service, mention du service, aucun indice mailto', async ({ page }) => {
  await page.goto('/contact/');
  const form = page.locator('form[data-contact-form]');
  await expect(form).toHaveAttribute('action', MOCK_FORM_ENDPOINT);
  await expect(form).toHaveAttribute('data-kind', 'service');
  await expect(form).not.toHaveAttribute('enctype');
  await expect(form.locator(`input[name="${REDIRECT_NAME}"]`)).toHaveValue(THANKS_URL);

  await expect(page.getByText(TEXTS.serviceNotice)).toBeVisible();
  await expect(page.getByText(TEXTS.mailtoNotice)).toHaveCount(0);
  await expect(form.locator('[data-form-mailto-hint]')).toHaveCount(0);
});

test('champ piège : hors de l’ordre de tabulation, masqué à l’écran et aux lecteurs', async ({
  page,
}) => {
  await page.goto('/contact/');
  const trap = honeypot(page);
  await expect(trap).toHaveCount(1);
  await expect(trap).toHaveAttribute('tabindex', '-1');
  await expect(trap).toHaveAttribute('autocomplete', 'off');
  await expect(trap).toHaveValue('');
  const container = trap.locator('xpath=..');
  await expect(container).toHaveAttribute('aria-hidden', 'true');

  // Absent de l'arbre d'accessibilité : introuvable par son rôle et son libellé.
  await expect(page.getByRole('textbox', { name: TEXTS.honeypotLabel })).toHaveCount(0);
  // Conteneur réduit à 1 px et découpé (technique « visually hidden ») : rien de perceptible.
  const box = await container.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(1);
  expect(box?.height ?? 0).toBeLessThanOrEqual(1);

  // Tab passe du dernier champ au bouton d'envoi sans s'arrêter sur le piège.
  await page.getByLabel('Votre message').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: TEXTS.submit })).toBeFocused();
});

test('envoi avec JS : le piège part vide dans la demande, succès annoncé', async ({ page }) => {
  let payload: Record<string, string> | undefined;
  await page.route(MOCK_FORM_ENDPOINT, async (route) => {
    payload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/contact/');
  await fillValidForm(page);
  await page.getByRole('button', { name: TEXTS.submit }).click();

  await expect(page.getByRole('status')).toContainText(TEXTS.success);
  expect(payload).toMatchObject({ ...VALID_INPUT, [HONEYPOT_NAME]: '' });
  await expectNoAxeViolations(page);
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('envoi HTML : le piège vide et la redirection partent avec la demande', async ({ page }) => {
    let body = '';
    await page.route(MOCK_FORM_ENDPOINT, async (route) => {
      body = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<p>Reçu</p>',
      });
    });
    await page.goto('/contact/');
    await fillValidForm(page);
    await page.getByRole('button', { name: TEXTS.submit }).click();

    await expect(page.getByText('Reçu')).toBeVisible();
    const sent = new URLSearchParams(body);
    expect(sent.get(HONEYPOT_NAME)).toBe('');
    expect(sent.get(REDIRECT_NAME)).toBe(THANKS_URL);
    expect(sent.get('nom')).toBe(VALID_INPUT.nom);
  });
});

test('0 violation axe au repos', async ({ page }) => {
  await page.goto('/contact/');
  await expectNoAxeViolations(page);
});
