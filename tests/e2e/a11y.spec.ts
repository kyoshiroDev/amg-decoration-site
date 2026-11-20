import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { SITE_ROUTES } from '../site-routes';
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

/** Toutes les pages construites : routes du plan de site (articles publiés compris), pages hors sitemap. */
const ALL_PAGES = [...SITE_ROUTES, '/merci/', '/styleguide/', NOT_FOUND_PATH] as const;

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
    expect(ALL_PAGES.some((path) => /^\/conseils-deco\/[^/]+\/$/.test(path))).toBe(true);
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
      // Feuille construite (CSSOM) plutôt qu'une balise <style> : la CSP bloque tout <style>
      // sans empreinte, comme elle le ferait pour un script injecté (ADR-0012).
      await page.evaluate((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets.push(sheet);
      }, TEXT_SPACING_CSS);
      // Espacements bien appliqués (0,12 em d'espacement des lettres sur le h1).
      const h1 = page.getByRole('heading', { level: 1 });
      const [letterSpacing, fontSize] = await h1.evaluate((el) => {
        const style = getComputedStyle(el);
        return [parseFloat(style.letterSpacing), parseFloat(style.fontSize)];
      });
      expect(letterSpacing).toBeCloseTo(fontSize * 0.12, 1);
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

// Mouvement actif : le bloc visé ne doit pas être décalé par une apparition au moment où le
// navigateur défile vers l'ancre (sinon le défilement vise la position décalée de 20 px).
test.describe('Ancre d’un titre à surtitre (2.4.11)', () => {
  test('/visualisation-3d/#avantages-titre : le surtitre reste sous l’en-tête', async ({
    page,
  }) => {
    await page.goto('/visualisation-3d/#avantages-titre');
    const eyebrow = page.locator('#avantages-titre').locator('xpath=preceding-sibling::p[1]');
    await expect(eyebrow).toHaveClass(/\beyebrow\b/);
    // Le défilement vers l'ancre peut survenir après le chargement des polices.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await waitForAnimationsToSettle(page);
    const header = await page.locator('header').first().boundingBox();
    const box = await eyebrow.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  });
});

const ASIDE = '.prose-layout__aside, .contact-layout__aside';

// Colonne latérale collante plus haute que la fenêtre (sommaire des CGS, « En bref » d'une
// prestation, coordonnées de la page Contact) : sur un écran bas ou zoomé, sa fin restait hors
// écran pendant toute la lecture et un lien focalisé au clavier y était invisible. Elle n'est
// désormais collante que si la fenêtre est assez haute (sinon dans le flux), avec défilement
// interne en dernier recours pour le sommaire de longueur non bornée.
test.describe(
  'Colonne latérale collante sur écran bas (2.4.7, 2.4.11)',
  { tag: '@desktop' },
  () => {
    test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 600 } });

    for (const path of ['/conditions-generales/', '/prestations/meuble-sur-mesure/', '/contact/']) {
      test(`${path} : chaque lien de la colonne reste visible au clavier`, async ({ page }) => {
        await page.goto(path);
        const aside = page.locator(ASIDE);
        const links = aside.locator('a[href], button');
        const count = await links.count();
        expect(count).toBeGreaterThan(0);
        await page.locator('main a').first().focus();
        const header = page.locator('header').first();
        let seen = 0;
        for (let i = 0; i < 40 && seen < count; i += 1) {
          await page.keyboard.press('Tab');
          const box = await page.evaluate((selector) => {
            const el = document.activeElement;
            if (!el?.closest(selector)) return null;
            const { top, bottom } = el.getBoundingClientRect();
            return { top, bottom, label: el.textContent?.trim().slice(0, 40) ?? '' };
          }, ASIDE);
          if (!box) continue;
          seen += 1;
          const headerBox = await header.boundingBox();
          const viewport = page.viewportSize();
          expect(box.top, box.label).toBeGreaterThanOrEqual(
            (headerBox?.y ?? 0) + (headerBox?.height ?? 0),
          );
          // Tolérance d'un pixel : le navigateur aligne parfois le lien au bord à une fraction près.
          expect(box.bottom, box.label).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
        }
        expect(seen).toBe(count);
      });
    }
  },
);

// Au-delà de 50rem de haut, le sommaire des pages légales reste collant et défile en interne s'il
// dépasse l'écran : cette région défilante doit rester accessible au clavier (axe :
// `scrollable-region-focusable`). La passe axe générale tourne sur des écrans où la règle ne
// s'applique pas.
test.describe('Colonne latérale défilante sur écran haut (axe)', { tag: '@desktop' }, () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 820 } });

  test('/conditions-generales/ : sommaire défilant, 0 violation', async ({ page }) => {
    await page.goto('/conditions-generales/');
    const scrollable = await page
      .locator(ASIDE)
      .first()
      .evaluate((element) => {
        const nodes = [element, ...element.querySelectorAll('*')];
        return nodes.some(
          (node) =>
            node.scrollHeight > node.clientHeight + 1 &&
            getComputedStyle(node).overflowY !== 'visible',
        );
      });
    expect(scrollable).toBe(true);
    await expectNoAxeViolations(page);
  });

  for (const path of ['/prestations/meuble-sur-mesure/', '/contact/']) {
    test(`${path} : colonne collante, 0 violation`, async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });
  }
});
