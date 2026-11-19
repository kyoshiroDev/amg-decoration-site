import { expect, test, type Locator, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { counterText, statusText } from '../../src/lib/lightbox';
import { expectNoAxeViolations } from './helpers';

// Visionneuse des galeries : styleguide (3 placeholders, navigation) et page projet (1 image).

const labels = microcopy.lightbox;
const counter = (index: number, total: number): string => counterText(index, total, labels.counter);
/** Début du nom des vignettes ; l'espace insécable devient une espace dans le nom calculé. */
const OPEN_NAME = new RegExp(`^${labels.open.replace(/\u00A0/g, '\\s')}`);

function gallery(page: Page): Locator {
  return page.locator('#sg-b-gallery').locator('xpath=ancestor::section[1]');
}

function thumbnails(page: Page): Locator {
  return gallery(page).getByRole('link', { name: OPEN_NAME });
}

test.describe('Visionneuse : styleguide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/styleguide/');
  });

  test('ouverture à la demande, navigation, Échap, retour du focus', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: labels.label });
    await expect(dialog).toBeHidden();
    // Grand format non chargé tant que la visionneuse est fermée.
    await expect(page.locator('[data-lightbox] img')).toHaveCount(0);

    const first = thumbnails(page).first();
    await expect(thumbnails(page)).toHaveCount(3);
    const alts = await gallery(page)
      .locator('a[data-lightbox-item]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('data-alt')));
    await first.click();
    await expect(dialog).toBeVisible();
    const image = dialog.getByRole('img');
    await expect(image).toHaveAttribute('alt', alts[0] ?? '');
    await expect(image).toHaveAttribute('srcset', /\.webp \d+w/);
    await expect(dialog.getByRole('button', { name: labels.close })).toBeFocused();
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText(counter(0, 3));

    await page.keyboard.press('ArrowRight');
    await expect(image).toHaveAttribute('alt', alts[1] ?? '');
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText(counter(1, 3));
    await dialog.getByRole('button', { name: labels.next }).click();
    await expect(image).toHaveAttribute('alt', alts[2] ?? '');
    await page.keyboard.press('ArrowRight');
    await expect(image).toHaveAttribute('alt', alts[0] ?? '');
    await page.keyboard.press('ArrowLeft');
    await expect(image).toHaveAttribute('alt', alts[2] ?? '');
    await dialog.getByRole('button', { name: labels.previous }).click();
    await expect(image).toHaveAttribute('alt', alts[1] ?? '');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();
  });

  test('annonce « Image n sur N : légende » dans une seule région live', async ({ page }) => {
    const links = gallery(page).locator('a[data-lightbox-item]');
    const legends = await links.evaluateAll((items) =>
      items.map((link) => link.getAttribute('data-caption') || link.getAttribute('data-alt')),
    );
    await thumbnails(page).first().click();
    const dialog = page.getByRole('dialog', { name: labels.label });
    await expect(dialog).toBeVisible();
    // Une seule région live ; le compteur visuel « 1 / 3 » est masqué aux lecteurs d'écran.
    await expect(dialog.locator('[aria-live]')).toHaveCount(1);
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveAttribute('aria-hidden', 'true');
    const status = dialog.locator('[aria-live="polite"]');
    await expect(status).toHaveText(statusText(0, 3, labels.status, legends[0] ?? ''));
    await page.keyboard.press('ArrowRight');
    await expect(status).toHaveText(statusText(1, 3, labels.status, legends[1] ?? ''));
    await expect(status).toContainText(/^Image 2 sur 3/);
  });

  test('ouverte au clavier, focus piégé dans la visionneuse', async ({ page }) => {
    const second = thumbnails(page).nth(1);
    await second.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: labels.label });
    await expect(dialog).toBeVisible();
    // Modale native : le reste de la page est inerte. Après le dernier bouton, le focus peut
    // passer à l'interface du navigateur (body), jamais à un élément de la page dessous.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate(
        (el) => el.contains(document.activeElement) || document.activeElement === document.body,
      );
      expect(inside).toBe(true);
    }
    await dialog.getByRole('button', { name: labels.close }).click();
    await expect(dialog).toBeHidden();
    await expect(second).toBeFocused();
  });

  test('0 violation axe, visionneuse ouverte', async ({ page }) => {
    await thumbnails(page).first().click();
    await expect(page.getByRole('dialog', { name: labels.label })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe('Visionneuse : page projet', () => {
  test('une seule image : ni compteur ni boutons de navigation', async ({ page }) => {
    await page.goto('/realisations/chalet-suisse/');
    const link = page.locator('a[data-lightbox-item]').first();
    await expect(link).toHaveAccessibleName(OPEN_NAME);
    await link.click();
    const dialog = page.getByRole('dialog', { name: labels.label });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: labels.next })).toBeHidden();
    await expect(dialog.locator('[data-lightbox-counter]')).toHaveText('');
    await expect(dialog.locator('[data-lightbox-status]')).toHaveText('');
    await dialog.getByRole('button', { name: labels.close }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('Visionneuse sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('images visibles, liens vers le grand format, visionneuse jamais affichée', async ({
    page,
  }) => {
    await page.goto('/styleguide/');
    for (const link of await thumbnails(page).all()) {
      await expect(link).toHaveAttribute('href', /\/_astro\/.+\.webp$/);
      await expect(link.locator('img')).toBeVisible();
    }
    await expect(page.locator('dialog[data-lightbox]')).toBeHidden();
  });
});
