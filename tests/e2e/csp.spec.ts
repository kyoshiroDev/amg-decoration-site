import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { site } from '../../src/config/site';
import {
  ALL_PAGE_PATHS,
  cspDirective,
  menuPanel,
  menuToggle,
  NOT_FOUND_PATH,
  watchCspViolations,
} from './helpers';

// Content-Security-Policy (ADR-0012) : balise meta générée par Astro au build. Ce fichier vérifie
// la politique elle-même et l'absence de toute violation, au chargement et pendant les
// interactions. Build principal sans service de formulaire : repli mailto: (le mode service est
// couvert par tests/e2e-service/csp.spec.ts).

/** Scripts et styles inline exécutés par le navigateur (hors JSON-LD, hors fichiers externes). */
const INLINE_BLOCK = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/g;

/** Balise meta de la politique, telle qu'Astro la rend. */
const META_CSP = /<meta http-equiv="content-security-policy" content="([^"]*)"/g;

/** Décode les entités qu'Astro produit dans un attribut (`'` → `&#39;`). */
function decodeAttribute(value: string): string {
  return value.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
}

function sha256(source: string): string {
  return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

/** Charge les images différées et attend qu'elles soient toutes décodées ou en échec. */
async function loadAllImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) {
      (image as HTMLImageElement).loading = 'eager';
    }
  });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

test.describe('CSP : politique de chaque page', { tag: '@desktop' }, () => {
  for (const path of ALL_PAGE_PATHS) {
    test(`balise meta stricte, inline autorisé par empreinte sur ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(path === NOT_FOUND_PATH ? 404 : 200);
      const html = await response.text();
      const head = html.slice(0, html.indexOf('</head>'));
      const metas = [...head.matchAll(META_CSP)];
      expect(metas, 'une seule balise meta CSP dans le <head>').toHaveLength(1);
      expect(html.slice(head.length).match(META_CSP)).toBeNull();
      const policy = decodeAttribute(metas[0]?.[1] ?? '');

      expect(cspDirective(policy, 'default-src')).toBe("'self'");
      expect(cspDirective(policy, 'object-src')).toBe("'none'");
      expect(cspDirective(policy, 'base-uri')).toBe("'self'");
      expect(cspDirective(policy, 'connect-src')).toBe("'self'");
      expect(cspDirective(policy, 'form-action')).toBe("'self' mailto:");
      for (const name of ['script-src', 'style-src']) {
        const sources = cspDirective(policy, name) ?? '';
        expect(sources, name).toMatch(/^'self'( 'sha256-[\w+/=]+')+$/);
      }
      // Seule concession : les attributs `style` (variables CSS des composants), ADR-0012.
      expect(cspDirective(policy, 'style-src-attr')).toBe("'unsafe-inline'");
      expect(policy).not.toMatch(/unsafe-eval|strict-dynamic/);

      const allowed = new Set(
        `${cspDirective(policy, 'script-src')} ${cspDirective(policy, 'style-src')}`
          .split(' ')
          .map((source) => source.replaceAll("'", '')),
      );
      const inline = [...html.matchAll(INLINE_BLOCK)].filter(
        ([, , attributes = '']) => !/\bsrc=|application\/ld\+json/.test(attributes),
      );
      expect(inline.length).toBeGreaterThan(0);
      for (const [, tag, , content = ''] of inline) {
        expect(allowed.has(sha256(content)), `<${tag}> inline sans empreinte`).toBe(true);
      }
      // Empreintes limitées à la page (pruneCspHashes) : aucune n'autorise un élément absent.
      const present = new Set(inline.map(([, , , content = '']) => sha256(content)));
      const unused = [...allowed].filter(
        (source) => source.startsWith('sha') && !present.has(source),
      );
      expect(unused, 'empreintes sans élément inline sur la page').toEqual([]);
    });
  }
});

test.describe('CSP : aucune violation au chargement', () => {
  test('témoin : un <style> injecté sans empreinte est bloqué et signalé', async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'body { outline: 1px solid; }';
      document.head.append(style);
    });
    await expect.poll(() => violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toContain('style-src');
  });

  for (const path of ALL_PAGE_PATHS) {
    test(`aucune violation sur ${path}`, async ({ page }) => {
      const violations = await watchCspViolations(page);
      await page.goto(path, { waitUntil: 'load' });
      await loadAllImages(page);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      expect(violations).toEqual([]);
    });
  }
});

test.describe('CSP : aucune violation pendant les interactions', () => {
  test('menu mobile : ouverture, fermeture par Échap', { tag: '@mobile' }, async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/');
    await menuToggle(page).click();
    await expect(menuPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuPanel(page)).toBeHidden();
    expect(violations).toEqual([]);
  });

  test('navigation entre pages (préchargement au survol, transition native)', async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/realisations/');
    const card = page
      .getByRole('main')
      .getByRole('link', { name: /chalet/i })
      .first();
    await card.hover();
    await card.click();
    await expect(page).toHaveURL(/\/realisations\/chalet-suisse\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(violations).toEqual([]);
  });

  test('filtres des réalisations', async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/realisations/');
    const group = page.getByRole('group', { name: microcopy.projects.filters.label });
    const filter = group.getByRole('button', { name: microcopy.projects.roomTypes.dressing });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await group.getByRole('button', { name: microcopy.projects.filters.all }).click();
    expect(violations).toEqual([]);
  });

  test('visionneuse et comparateur du styleguide', async ({ page }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/styleguide/');

    const dialog = page.getByRole('dialog', { name: microcopy.lightbox.label });
    const gallery = page.locator('#sg-b-gallery').locator('xpath=ancestor::section[1]');
    await gallery.getByRole('link').first().click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img')).toHaveJSProperty('complete', true);
    await dialog.getByRole('button', { name: microcopy.lightbox.next }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const slider = page.getByRole('slider', { name: microcopy.projects.beforeAfter.slider });
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('100');
    expect(violations).toEqual([]);
  });

  test('formulaire : erreurs puis envoi vers mailto: autorisé par form-action', async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);
    await page.goto('/contact/');
    const submit = page.getByRole('button', { name: 'Envoyer ma demande' });
    await submit.click();
    await expect(page.getByLabel('Votre nom')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Votre nom').fill('Camille Martin');
    await page.getByLabel('Votre email').fill('camille@exemple.fr');
    await page.getByLabel('Votre message').fill('Un salon de 20 m² à repenser en 3D.');
    // Envoi au clavier : Tab du dernier champ au bouton, puis Entrée. Envoi natif vers mailto:,
    // sans client mail dans le navigateur de test : la page reste affichée.
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(site.email);
    expect(violations).toEqual([]);
  });
});
