import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import {
  NOT_FOUND_PATH,
  expectNoAxeViolations,
  menuPanel,
  menuToggle,
  waitForAnimationsToSettle,
} from './helpers';

const AUDITED_PAGES = [
  { name: 'accueil', path: '/' },
  { name: 'styleguide', path: '/styleguide/' },
  { name: '404', path: NOT_FOUND_PATH },
] as const;

/** Durée maximale tolérée en mouvement réduit (token --dur-reduced). */
const REDUCED_MOTION_MAX_MS = 150;

test.describe('axe-core (WCAG 2.2 AA)', () => {
  for (const { name, path } of AUDITED_PAGES) {
    test(`${name} : 0 violation, menu fermé`, async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });

    test(`${name} : 0 violation, menu mobile ouvert`, { tag: '@mobile' }, async ({ page }) => {
      await page.goto(path);
      await menuToggle(page).click();
      await expect(menuPanel(page)).toBeVisible();
      await waitForAnimationsToSettle(page);
      await expectNoAxeViolations(page);
    });
  }
});

/**
 * Plus longue durée (durée + délai) de transition ou d'animation calculée sur les éléments
 * de l'en-tête, du lien d'évitement et du menu mobile, pseudo-éléments compris.
 */
async function longestMotion(page: Page): Promise<{ ms: number; where: string }> {
  return page.evaluate(() => {
    const toMs = (value: string): number[] =>
      value.split(',').map((part) => {
        const trimmed = part.trim();
        return trimmed.endsWith('ms') ? parseFloat(trimmed) : parseFloat(trimmed) * 1000;
      });
    const elements = [
      ...document.querySelectorAll('header, header *, #menu-mobile, #menu-mobile *'),
      ...document.querySelectorAll('a[href="#contenu"]'),
    ];
    let longest = { ms: 0, where: '' };
    for (const el of elements) {
      for (const pseudo of [null, '::before', '::after', '::backdrop']) {
        const style = getComputedStyle(el, pseudo);
        const pairs: [string, string][] = [
          [style.transitionDuration, style.transitionDelay],
          [style.animationDuration, style.animationDelay],
        ];
        for (const [durations, delays] of pairs) {
          const d = toMs(durations);
          const w = toMs(delays);
          d.forEach((duration, i) => {
            const total = duration + Math.max(0, w[i % w.length] ?? 0);
            if (total > longest.ms) {
              longest = { ms: total, where: `${el.tagName.toLowerCase()}${pseudo ?? ''}` };
            }
          });
        }
      }
    }
    return longest;
  });
}

test.describe('Mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('aucune transition ni animation longue dans l’en-tête', async ({ page }) => {
    await page.goto('/');
    const longest = await longestMotion(page);
    expect(longest.ms, longest.where).toBeLessThanOrEqual(REDUCED_MOTION_MAX_MS);
  });

  test(
    'aucune transition ni animation longue, menu ouvert',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      await menuToggle(page).click();
      await expect(menuPanel(page)).toBeVisible();
      await expect(
        menuPanel(page).getByRole('button', { name: microcopy.mobileMenu.close }),
      ).toBeVisible();
      const longest = await longestMotion(page);
      expect(longest.ms, longest.where).toBeLessThanOrEqual(REDUCED_MOTION_MAX_MS);
    },
  );
});

test.describe('Débordement horizontal à 320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  for (const { name, path } of AUDITED_PAGES) {
    test(`${name} ne déborde pas`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
