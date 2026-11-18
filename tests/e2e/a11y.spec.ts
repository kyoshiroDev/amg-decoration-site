import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { SITE_ROUTES } from '../../src/lib/redirects';
import { articlePath } from '../../src/lib/routes';
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

const ARTICLES_DIR = new URL('../../src/content/articles/', import.meta.url);

/**
 * Articles publiés, lus depuis les sources (et non depuis dist/ : la collecte des tests précède
 * le build lancé par le webServer). Un brouillon (`draft: true`) n'est pas construit.
 */
const PUBLISHED_ARTICLES = readdirSync(ARTICLES_DIR)
  .filter((file) => /\.mdx?$/.test(file))
  .filter((file) => !/^draft:\s*true\s*$/m.test(readFileSync(new URL(file, ARTICLES_DIR), 'utf8')))
  .map((file) => articlePath(file.replace(/\.mdx?$/, '')));

/** Toutes les pages construites : routes du plan de site, articles, pages hors sitemap. */
const ALL_PAGES = [
  ...SITE_ROUTES,
  ...PUBLISHED_ARTICLES,
  '/merci/',
  '/styleguide/',
  NOT_FOUND_PATH,
] as const;

/** Pages longues ou à formulaire : espacement du texte (1.4.12) et focus non masqué (2.4.11). */
const LONG_PAGES = [
  '/contact/',
  '/prestations/confort/',
  '/conseils-deco/plan-3d-avant-renovation/',
];

/** Espacements imposés par le critère WCAG 1.4.12 (bookmarklet de référence). */
const TEXT_SPACING_CSS = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-block-end: 2em !important; }`;

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

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

test.describe('Débordement horizontal à 320 px (1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test('la liste couvre toutes les pages construites', () => {
    expect(PUBLISHED_ARTICLES.length).toBeGreaterThan(0);
    expect(new Set(ALL_PAGES).size).toBe(ALL_PAGES.length);
  });

  for (const path of ALL_PAGES) {
    test(`${path} ne déborde pas`, async ({ page }) => {
      await page.goto(path);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('Espacement du texte (1.4.12)', () => {
  test.use({ viewport: { width: 375, height: 720 } });

  for (const path of LONG_PAGES) {
    test(`${path} : aucun débordement avec les espacements WCAG`, async ({ page }) => {
      await page.goto(path);
      await page.addStyleTag({ content: TEXT_SPACING_CSS });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('Focus non masqué par l’en-tête collant (2.4.11)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of LONG_PAGES) {
    test(`${path} : en remontant au clavier, le focus reste sous l’en-tête`, async ({ page }) => {
      await page.goto(path);
      await page.locator('footer a').last().focus();
      const header = page.locator('header').first();
      // Remonte (Maj+Tab) jusqu'au premier élément du contenu principal.
      for (let i = 0; i < 80; i += 1) {
        await page.keyboard.press('Shift+Tab');
        const state = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || !el.closest('main, footer')) return null;
          const { top, bottom } = el.getBoundingClientRect();
          return { top, bottom, label: el.textContent?.trim().slice(0, 40) ?? '' };
        });
        if (!state) break;
        const box = await header.boundingBox();
        const headerBottom = box ? box.y + box.height : 0;
        expect(state.bottom, state.label).toBeGreaterThan(headerBottom);
      }
    });
  }
});
