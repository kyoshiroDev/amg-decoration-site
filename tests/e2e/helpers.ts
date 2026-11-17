/**
 * Utilitaires partagés des tests e2e (pas un fichier de test : non collecté par Playwright).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';

/** Niveaux WCAG vérifiés par axe-core (CLAUDE.md §6 : 0 violation). */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** URL qui n'existe pas : sert la page 404. */
export const NOT_FOUND_PATH = '/page-inexistante/';

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

/** Attend la fin de toutes les animations et transitions CSS en cours. */
export async function waitForAnimationsToSettle(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().length === 0);
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
