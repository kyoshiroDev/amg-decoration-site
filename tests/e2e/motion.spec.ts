import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { countTransparentElements, scrollThroughPage } from './helpers';

// Effets de la Phase 5 : apparitions au scroll, bandeau de mots, CTA magnétique, View
// Transitions, stabilité de la mise en page (CLS). Comparateur et visionneuse : specs dédiées.

/** Somme des décalages de mise en page sans interaction récente (comme le CLS). */
async function observeLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = window as unknown as { __shift: number };
    store.__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) store.__shift += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

const layoutShift = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);

test.describe('Apparitions au scroll', () => {
  test('rien n’est caché au chargement au-dessus de la ligne de flottaison', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    const hiddenAboveFold = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-reveal-state]')].filter(
          (el) => el.getBoundingClientRect().top < window.innerHeight,
        ).length,
    );
    expect(hiddenAboveFold).toBe(0);
  });

  test('un bloc sous la ligne de flottaison apparaît une fois atteint', async ({ page }) => {
    await page.goto('/');
    const target = page.locator('.project-grid [data-reveal]').first();
    await expect(target).toHaveAttribute('data-reveal-state', 'pending');
    await expect(target).toHaveCSS('opacity', '0');
    await target.scrollIntoViewIfNeeded();
    await expect(target).not.toHaveAttribute('data-reveal-state', /.*/);
    await expect(target).toHaveCSS('opacity', '1');
    await expect(target).toHaveCSS('transform', 'none');
  });

  test('un élément en attente qui reçoit le focus clavier apparaît aussitôt', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.project-grid [data-reveal]').first();
    await expect(card).toHaveAttribute('data-reveal-state', 'pending');
    // Focus sans défilement préalable : l'état doit tomber sans attendre IntersectionObserver.
    const opacity = await card.evaluate((element) => {
      element.querySelector<HTMLElement>('a')?.focus();
      return getComputedStyle(element).opacity;
    });
    expect(opacity).toBe('1');
    await expect(card).not.toHaveAttribute('data-reveal-state', /.*/);
  });

  test('après un défilement complet, plus aucun élément transparent', async ({ page }) => {
    await page.goto('/');
    await scrollThroughPage(page);
    await expect.poll(() => countTransparentElements(page)).toBe(0);
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('aucun état d’animation, aucun élément transparent', async ({ page }) => {
      for (const path of ['/', '/realisations/chalet-suisse/', '/styleguide/']) {
        await page.goto(path);
        await expect(page.locator('[data-reveal-state]')).toHaveCount(0);
        expect(await countTransparentElements(page), path).toBe(0);
      }
    });
  });

  test.describe('mouvement réduit', () => {
    test.use({ reducedMotion: 'reduce' });

    test('aucune apparition préparée : tout est visible d’emblée', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-reveal-state]')).toHaveCount(0);
      expect(await countTransparentElements(page)).toBe(0);
    });
  });
});

test.describe('Bandeau de mots', () => {
  const labels = microcopy.marquee;

  test('lu une fois, 3 copies dont 2 masquées', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-marquee] ul')).toHaveCount(3);
    await expect(page.locator('[data-marquee] ul[aria-hidden="true"]')).toHaveCount(2);
    await expect(page.getByRole('list', { name: labels.label })).toHaveCount(1);
  });

  test('défile, et le bouton le met en pause puis le relance au clavier', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('.marquee__track');
    // Le conteneur, pas la piste : un élément animé n'est jamais « stable » pour Playwright.
    await page.locator('[data-marquee]').scrollIntoViewIfNeeded();
    const playState = (): Promise<string> =>
      track.evaluate((el) => el.getAnimations()[0]?.playState ?? 'none');
    // Ni survol ni focus dans le bandeau (ils le mettent aussi en pause).
    const leave = async (): Promise<void> => {
      await page.mouse.move(0, 0);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    };
    await expect.poll(playState).toBe('running');

    const pause = page.getByRole('button', { name: labels.pause });
    await expect(pause).toBeVisible();
    const box = await pause.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    await pause.focus();
    await page.keyboard.press('Enter');
    const play = page.getByRole('button', { name: labels.play });
    await expect(play).toBeFocused();
    await leave();
    await expect.poll(playState).toBe('paused');

    await play.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: labels.pause })).toBeVisible();
    await leave();
    await expect.poll(playState).toBe('running');
  });

  test('en pause au survol', { tag: '@desktop' }, async ({ page }) => {
    await page.goto('/');
    const track = page.locator('.marquee__track');
    await page.locator('[data-marquee]').hover();
    await expect
      .poll(() => track.evaluate((el) => el.getAnimations()[0]?.playState))
      .toBe('paused');
  });

  test.describe('mouvement réduit', () => {
    test.use({ reducedMotion: 'reduce' });

    test('à l’arrêt, sans bouton', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.marquee__track')).toHaveCSS('animation-name', 'none');
      await expect(page.getByRole('button', { name: labels.pause })).toBeHidden();
    });
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('statique, sans bouton', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.marquee__track')).toHaveCSS('animation-name', 'none');
      await expect(page.locator('[data-marquee-toggle]')).toBeHidden();
    });
  });
});

test.describe('CTA magnétique', () => {
  const translation = (page: Page): Promise<number[]> =>
    page
      .locator('[data-magnetic]')
      .first()
      .evaluate((el) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return [matrix.m41, matrix.m42];
      });

  test('suit le pointeur de 6 px au plus, puis revient', { tag: '@desktop' }, async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('[data-magnetic]').first();
    const box = await cta.boundingBox();
    if (!box) throw new Error('CTA introuvable');
    // Bord droit, à mi-hauteur (les coins d'une pilule ne reçoivent pas le pointeur).
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
    await expect.poll(async () => (await translation(page))[0] ?? 0).toBeGreaterThan(3);
    await page.waitForTimeout(600);
    const [x = 0, y = 0] = await translation(page);
    expect(x).toBeLessThanOrEqual(6);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
    await page.mouse.move(box.x + box.width / 2, box.y - 200, { steps: 4 });
    await expect.poll(async () => (await translation(page))[0] ?? 0).toBe(0);
  });

  test('inactif sur écran tactile (pointeur grossier)', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-magnetic]').first().hover();
    await page.waitForTimeout(200);
    await expect(page.locator('[style*="--magnet"]')).toHaveCount(0);
  });
});

test.describe('View Transitions grille → projet', { tag: '@desktop' }, () => {
  async function recordReveal(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const store = window as unknown as { __vt?: { active: boolean; pseudos: string[] } };
      window.addEventListener('pagereveal', (event) => {
        const transition = (event as Event & { viewTransition: ViewTransition | null })
          .viewTransition;
        store.__vt = { active: Boolean(transition), pseudos: [] };
        void transition?.ready.then(() => {
          store.__vt = {
            active: true,
            pseudos: document
              .getAnimations()
              .map((animation) => (animation.effect as KeyframeEffect).pseudoElement ?? ''),
          };
        });
      });
    });
  }

  test('morphing du visuel de la carte vers la couverture', async ({ page }) => {
    await recordReveal(page);
    await page.goto('/realisations/');
    await page.locator('a[href="/realisations/chalet-suisse/"]').first().click();
    await page.waitForURL('**/realisations/chalet-suisse/');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __vt?: { pseudos: string[] } }).__vt?.pseudos ?? [],
        ),
      )
      .toContain('::view-transition-group(projet-chalet-suisse)');
  });

  test.describe('mouvement réduit', () => {
    test.use({ reducedMotion: 'reduce' });

    test('aucune transition', async ({ page }) => {
      await recordReveal(page);
      await page.goto('/realisations/');
      await page.locator('a[href="/realisations/chalet-suisse/"]').first().click();
      await page.waitForURL('**/realisations/chalet-suisse/');
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __vt?: { active: boolean } }).__vt?.active),
        )
        .toBe(false);
    });
  });
});

test.describe('Stabilité de la mise en page', () => {
  test('accueil : défilement complet sans décalage', async ({ page }) => {
    await observeLayoutShifts(page);
    await page.goto('/');
    await scrollThroughPage(page);
    await page.waitForTimeout(500);
    expect(await layoutShift(page)).toBeLessThan(0.05);
  });

  test('réalisations : filtres affichés d’emblée, filtrage et défilement', async ({ page }) => {
    await observeLayoutShifts(page);
    await page.goto('/realisations/');
    await expect(page.getByRole('group', { name: microcopy.projects.filters.label })).toBeVisible();
    await page.getByRole('button', { name: microcopy.projects.roomTypes.dressing }).click();
    await page.getByRole('button', { name: microcopy.projects.filters.all }).click();
    await scrollThroughPage(page);
    await page.waitForTimeout(500);
    expect(await layoutShift(page)).toBeLessThan(0.05);
  });
});
