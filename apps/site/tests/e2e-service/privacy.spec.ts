import { expect, test } from '@playwright/test';
import { PRIVACY_PATH, PRIVACY_TEXTS } from '../e2e/privacy-texts';

// Politique de confidentialité en mode service (ADR-0016) : build `dist-service/` avec
// `PUBLIC_FORM_ENDPOINT` défini, seuls les blocs `{formulaire:service}` sont publiés.

test('confidentialité en mode service : le service de formulaire est décrit', async ({ page }) => {
  await page.goto(PRIVACY_PATH);
  await expect(page.getByText(PRIVACY_TEXTS.serviceIp)).toBeVisible();
  await expect(page.getByText(PRIVACY_TEXTS.serviceRecipient)).toBeVisible();
  await expect(page.getByText(PRIVACY_TEXTS.mailtoSending)).toHaveCount(0);
  await expect(page.getByText(PRIVACY_TEXTS.mailtoRecipient)).toHaveCount(0);
  await expect(page.locator('.rich-text')).not.toContainText('{formulaire');
});
