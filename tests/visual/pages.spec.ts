/**
 * Régression visuelle des pages clés, pleine page, mobile (390×844) et desktop (1440×900).
 * Hors CI (voir README.md du dossier) : `npm run test:visual`.
 */
import { expect, test, type Page } from '@playwright/test';
import { NOT_FOUND_PATH, waitForAnimationsToSettle } from '../e2e/helpers';

const PAGES = [
  { name: 'accueil', path: '/' },
  { name: 'prestations', path: '/prestations/' },
  { name: 'prestation-confort', path: '/prestations/confort/' },
  { name: 'visualisation-3d', path: '/visualisation-3d/' },
  { name: 'realisations', path: '/realisations/' },
  { name: 'projet-chalet-suisse', path: '/realisations/chalet-suisse/' },
  { name: 'a-propos', path: '/a-propos/' },
  { name: 'conseils-deco', path: '/conseils-deco/' },
  { name: 'article-plan-3d', path: '/conseils-deco/plan-3d-avant-renovation/' },
  { name: 'contact', path: '/contact/' },
  { name: '404', path: NOT_FOUND_PATH },
] as const;

/**
 * Retire le grain de papier (`body::after`) des captures : ce bruit fixe ne compresse pas et
 * triplerait le poids des PNG de référence, sans rien apporter à la détection de régressions de
 * mise en page. Feuille ajoutée par le CSSOM (`adoptedStyleSheets`) : une balise `<style>`
 * injectée serait bloquée par la CSP (ADR-0012), qu'on ne contourne pas.
 */
const CAPTURE_CSS = 'body::after { background-image: none !important; }';

/**
 * Rend la page déterministe : grain retiré, images différées chargées d'emblée et décodées,
 * polices prêtes, animations terminées, défilement remis en haut.
 */
async function stabilize(page: Page): Promise<void> {
  await page.evaluate(async (css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    await document.fonts.ready;
  }, CAPTURE_CSS);
  await page.waitForLoadState('networkidle');
  await waitForAnimationsToSettle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const { name, path } of PAGES) {
  test(`capture pleine page : ${name}`, async ({ page }) => {
    await page.goto(path);
    await stabilize(page);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      // Bandeau de mots : défilement continu quand le mouvement est permis, masqué par sûreté.
      mask: [page.locator('[data-marquee]')],
    });
  });
}
