/**
 * Utilitaires partagés des tests e2e (pas un fichier de test : non collecté par Playwright).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { SITE_ROUTES } from '../site-routes';

/** Niveaux WCAG vérifiés par axe-core (CLAUDE.md §6 : 0 violation). */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** URL qui n'existe pas : sert la page 404. */
export const NOT_FOUND_PATH = '/page-inexistante/';

/** Pages servies mais non indexées (hors sitemap). */
export const NOINDEX_PATHS = ['/merci/', '/styleguide/', NOT_FOUND_PATH] as const;

/** Toutes les pages du build : pages publiques, articles compris, puis pages non indexées. */
export const ALL_PAGE_PATHS: readonly string[] = [...SITE_ROUTES, ...NOINDEX_PATHS];

export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Bouton d'ouverture du menu mobile (Popover API). Nom accessible = libellé visible « Menu »
 * (exact : sinon « Fermer le menu » correspondrait aussi), l'état est porté par `expanded`.
 */
export function menuToggle(page: Page): Locator {
  return page.getByRole('button', { name: microcopy.mobileMenu.open, exact: true });
}

/**
 * Panneau du menu mobile. Le popover n'a pas de rôle ARIA propre : on le cible par l'id
 * référencé par `popovertarget` (contrat d'accessibilité, pas un détail de style).
 */
export function menuPanel(page: Page): Locator {
  return page.locator('#menu-mobile');
}

/** Appuie sur Tab jusqu'à focaliser `target` (échoue après `max` pressions). */
export async function tabUntilFocused(page: Page, target: Locator, max = 15): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Élément jamais focalisé après ${max} pressions sur Tab`);
}

/** Ouvre le menu mobile au clavier depuis le haut de la page. */
export async function openMenuWithKeyboard(page: Page): Promise<void> {
  await tabUntilFocused(page, menuToggle(page));
  await page.keyboard.press('Enter');
  await expect(menuPanel(page)).toBeVisible();
}

/**
 * Attend la fin de toutes les animations et transitions CSS en cours, hors animations infinies
 * (défilement continu du bandeau de mots, qui ne s'arrête jamais par définition) et hors
 * animations liées au défilement (apparitions `animation-timeline: view()`, ADR-0013) : elles
 * n'avancent pas avec le temps, seulement avec la position de la page.
 */
export async function waitForAnimationsToSettle(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          !(animation.timeline instanceof DocumentTimeline) ||
          animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  );
}

/** Fait défiler toute la page par paliers, pour déclencher les apparitions au scroll. */
export async function scrollThroughPage(page: Page): Promise<void> {
  const [height, step] = await page.evaluate(() => [
    document.documentElement.scrollHeight,
    Math.round(window.innerHeight / 2),
  ]);
  for (let y = 0; y < height; y += step) {
    await page.evaluate((delta) => window.scrollBy(0, delta), step);
    await page.waitForTimeout(100);
  }
}

/**
 * Éléments rendus et visibles mais à opacité nulle (un contenu caché par une animation).
 * Les éléments non rendus (`display: none`, dialogue fermé) ne comptent pas.
 */
export async function countTransparentElements(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('body *')].filter(
        (element) => element.checkVisibility() && getComputedStyle(element).opacity === '0',
      ).length,
  );
}

/**
 * État `expanded` du bouton menu tel qu'exposé aux technologies d'assistance. Avec la
 * Popover API, Chromium le calcule sans attribut `aria-expanded` dans le DOM : on le lit
 * dans l'arbre d'accessibilité via le protocole DevTools (projets Chromium uniquement).
 */
export async function menuToggleExpanded(page: Page): Promise<boolean | undefined> {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send('Runtime.evaluate', {
      expression: 'document.querySelector(\'button[popovertarget="menu-mobile"]\')',
    });
    if (!result.objectId) return undefined;
    const { nodes } = await session.send('Accessibility.getPartialAXTree', {
      objectId: result.objectId,
      fetchRelatives: false,
    });
    const expanded = nodes[0]?.properties?.find((property) => property.name === 'expanded');
    return expanded === undefined ? undefined : Boolean(expanded.value.value);
  } finally {
    await session.detach();
  }
}

/** Marqueurs JPEG « Start Of Frame » (SOF0 à SOF15, hors DHT C4, JPG C8 et DAC CC). */
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Dimensions d'un JPEG lues dans son en-tête (segment SOF), sans dépendance : parcourt les
 * segments à partir du marqueur SOI jusqu'au premier SOF (baseline ou progressif).
 */
export function readJpegSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0) !== 0xffd8) throw new Error('Fichier non JPEG (marqueur SOI absent)');
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) throw new Error(`JPEG invalide à l'octet ${offset}`);
    const marker = view.getUint8(offset + 1);
    if (marker === 0xff) {
      offset += 1; // octet de remplissage
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (JPEG_SOF_MARKERS.has(marker)) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('Segment SOF introuvable dans le JPEG');
}

/** Messages console des violations de Content-Security-Policy (formulations de Chromium). */
const CSP_CONSOLE_MESSAGE = /Content[ -]Security[ -]Policy/i;

/**
 * Enregistre toutes les violations de la CSP (ADR-0012) pendant la vie de la page, navigations
 * comprises : évènements `securitypolicyviolation` (détail de la directive et de la ressource) et
 * messages console du navigateur. À appeler avant le premier `page.goto`.
 */
export async function watchCspViolations(page: Page): Promise<readonly string[]> {
  const violations: string[] = [];
  await page.exposeFunction('reportCspViolation', (violation: string) => {
    violations.push(violation);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { reportCspViolation: (v: string) => void })
        .reportCspViolation;
      report(
        `${event.effectiveDirective} : ${event.blockedURI} (${event.sample}) sur ${location.pathname}`,
      );
    });
  });
  page.on('console', (message) => {
    if (CSP_CONSOLE_MESSAGE.test(message.text())) violations.push(message.text());
  });
  return violations;
}

/** Politique de la balise meta CSP de la page (une seule balise, dans le <head>). */
export async function readMetaCsp(page: Page): Promise<string> {
  const meta = page.locator('head meta[http-equiv="content-security-policy"]');
  await expect(meta).toHaveCount(1);
  return (await meta.getAttribute('content')) ?? '';
}

/** Valeur d'une directive CSP (`connect-src` → `'self' https://…`), `undefined` si absente. */
export function cspDirective(policy: string, name: string): string | undefined {
  for (const entry of policy.split(';')) {
    const [directive, ...sources] = entry.trim().split(/\s+/);
    if (directive === name) return sources.join(' ');
  }
  return undefined;
}
