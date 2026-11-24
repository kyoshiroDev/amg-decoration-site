import { expect, test } from '@playwright/test';
import { MOCK_FORM_ENDPOINT } from '../../playwright.service.config';
import { cspDirective, readMetaCsp, watchCspViolations } from '../e2e/helpers';

// CSP du build avec service de formulaire (ADR-0012) : l'origine de `PUBLIC_FORM_ENDPOINT` est
// autorisée pour `fetch` (connect-src) et pour l'envoi HTML (form-action), mailto: ne l'est plus.
// Aucun appel réseau réel : l'endpoint est intercepté par `page.route`.

const SERVICE_ORIGIN = new URL(MOCK_FORM_ENDPOINT).origin;

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
});

test('connect-src et form-action autorisent l’origine du service, sans mailto:', async ({
  page,
}) => {
  await page.goto('/contact/');
  const policy = await readMetaCsp(page);
  expect(cspDirective(policy, 'connect-src')).toBe(`'self' ${SERVICE_ORIGIN}`);
  expect(cspDirective(policy, 'form-action')).toBe(`'self' ${SERVICE_ORIGIN}`);
  expect(cspDirective(policy, 'default-src')).toBe("'self'");
});

test('envoi par fetch vers le service sans violation CSP', async ({ page }) => {
  const violations = await watchCspViolations(page);
  let requested = false;
  await page.route(MOCK_FORM_ENDPOINT, async (route) => {
    requested = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/contact/');
  await page.getByLabel('Votre nom').fill('Camille Martin');
  await page.getByLabel('Votre email').fill('camille@exemple.fr');
  await page.getByLabel('Votre message').fill('Un salon de 20 m² à repenser en 3D.');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

  await expect(page.getByRole('status')).toContainText(/Merci, votre message est bien parti/);
  expect(requested).toBe(true);
  expect(violations).toEqual([]);
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('envoi HTML vers le service autorisé par form-action', async ({ page }) => {
    // Sans JS, seuls les messages console du navigateur signalent une violation.
    const violations = await watchCspViolations(page);
    await page.route(MOCK_FORM_ENDPOINT, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<p>Reçu</p>' }),
    );
    await page.goto('/contact/');
    await page.getByLabel('Votre nom').fill('Camille Martin');
    await page.getByLabel('Votre email').fill('camille@exemple.fr');
    await page.getByLabel('Votre message').fill('Un salon de 20 m² à repenser en 3D.');
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

    await expect(page.getByText('Reçu')).toBeVisible();
    expect(violations).toEqual([]);
  });
});
