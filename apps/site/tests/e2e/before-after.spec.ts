import { expect, test, type Locator, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { compareValueText } from '../../src/lib/before-after';
import { expectNoAxeViolations } from './helpers';

// Comparateur « Rendu 3D ↔ Réalisé » : comportements détaillés sur le styleguide (placeholders),
// présence publique vérifiée sur /visualisation-3d/ (vraie paire de src/config/media.ts).

const copy = microcopy.projects.beforeAfter;
const valueText = (value: number): string => compareValueText(value, copy.valueText);

function compare(page: Page): Locator {
  return page.locator('#sg-b-before-after').locator('xpath=ancestor::section[1]');
}

test.describe('Comparateur avant / après', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/styleguide/');
    await compare(page).scrollIntoViewIfNeeded();
  });

  test('curseur natif nommé, aria-valuetext tenu à jour au clavier', async ({ page }) => {
    const slider = compare(page).getByRole('slider', { name: copy.slider });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(50));

    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('51');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(51));
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('49');
    await page.keyboard.press('PageUp');
    await expect(slider).toHaveValue('59');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await expect(slider).toHaveValue('39');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(0));
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(100));
    // Le masque du rendu 3D et la poignée suivent la valeur (variable posée sur le comparateur).
    await expect(compare(page).locator('[data-before-after]')).toHaveAttribute(
      'style',
      /--compare-pos:\s*100%/,
    );
  });

  test('consigne visible reliée au curseur (souris, tactile et clavier)', async ({ page }) => {
    const slider = compare(page).getByRole('slider', { name: copy.slider });
    await expect(slider).toHaveAccessibleDescription(copy.hint);
    await expect(compare(page).getByText(copy.hint)).toBeVisible();
  });

  test('0 violation axe, poignée focalisée', async ({ page }) => {
    await compare(page).getByRole('slider').focus();
    await expectNoAxeViolations(page);
  });

  test('souris : glisser règle le curseur', { tag: '@desktop' }, async ({ page }) => {
    const stage = compare(page).locator('[data-before-after-stage]');
    const box = await stage.boundingBox();
    if (!box) throw new Error('scène introuvable');
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 });
    await page.mouse.up();
    const slider = compare(page).getByRole('slider');
    await expect(slider).toHaveValue('20');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(20));
    await expect(slider).toBeFocused();
  });

  test(
    'tactile : glisser horizontal règle, geste vertical fait défiler',
    { tag: '@mobile' },
    async ({ page }) => {
      const stage = compare(page).locator('[data-before-after-stage]');
      await expect(stage).toHaveCSS('touch-action', 'pan-y');
      const box = await stage.boundingBox();
      if (!box) throw new Error('scène introuvable');
      const session = await page.context().newCDPSession(page);
      type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
      const touch = async (type: TouchType, x: number, y: number): Promise<void> => {
        await session.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
        });
      };
      const swipe = async (from: [number, number], to: [number, number]): Promise<void> => {
        await touch('touchStart', ...from);
        for (let i = 1; i <= 8; i += 1) {
          await touch(
            'touchMove',
            from[0] + ((to[0] - from[0]) * i) / 8,
            from[1] + ((to[1] - from[1]) * i) / 8,
          );
        }
        await touch('touchEnd', ...to);
      };
      const slider = compare(page).getByRole('slider');
      const y = box.y + box.height / 2;

      await swipe([box.x + box.width / 2, y], [box.x + box.width * 0.75, y]);
      await expect(slider).toHaveValue('75');

      const scrollBefore = await page.evaluate(() => window.scrollY);
      await swipe([box.x + box.width * 0.3, y + 60], [box.x + box.width * 0.3, y - 140]);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
      await expect(slider).toHaveValue('75');
      await session.detach();
    },
  );
});

test.describe('Comparateur, appui simple (WCAG 2.5.7)', () => {
  test('un appui bref sans glisser place la poignée', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/styleguide/');
    const stage = compare(page).locator('[data-before-after-stage]');
    await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox();
    if (!box) throw new Error('scène introuvable');
    await stage.tap({ position: { x: box.width * 0.25, y: box.height / 2 } });
    await expect(compare(page).getByRole('slider')).toHaveValue('25');
  });
});

test.describe('Comparateur sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('les deux images restent visibles côte à côte, sans curseur', async ({ page }) => {
    await page.goto('/styleguide/');
    const section = compare(page);
    await expect(section.getByRole('slider')).toHaveCount(0);
    const figures = section.locator('figure');
    await expect(figures).toHaveCount(2);
    for (const figure of await figures.all()) await expect(figure).toBeVisible();
    await expect(section.locator('figcaption')).toHaveText([copy.rendering, copy.result]);
  });
});

test.describe('Comparateur sur /visualisation-3d/', () => {
  test('présent après « Ma promesse », utilisable au clavier', async ({ page }) => {
    await page.goto('/visualisation-3d/');
    const section = page.locator('#comparatif-titre').locator('xpath=ancestor::section[1]');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(copy.heading);
    // Placé entre la promesse et la méthode (ordre du document).
    const order = await page
      .locator('#promesse-titre, #comparatif-titre, #methode-titre')
      .evaluateAll((headings) => headings.map((h) => h.id));
    expect(order).toEqual(['promesse-titre', 'comparatif-titre', 'methode-titre']);
    // Vraie paire : plus aucune mention de placeholder, rendu 3D puis photo du résultat.
    await expect(section.getByText(/provisoire/)).toHaveCount(0);
    const alts = await section
      .locator('img')
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('alt') ?? ''));
    expect(alts).toEqual([expect.stringMatching(/^Rendu 3D /), expect.stringMatching(/^Photo /)]);

    const slider = section.getByRole('slider', { name: copy.slider });
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toHaveAccessibleDescription(copy.hint);
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(50));
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('49');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(49));
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuetext', valueText(0));

    // Dévoilement en transform : le bord droit du calque du rendu 3D suit la valeur, l'image
    // reste immobile (aucune propriété de mise en page ni clip-path).
    await page.keyboard.press('End');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await expect(slider).toHaveValue('70');
    const stage = section.locator('[data-before-after-stage]');
    const layer = section.locator('.before-after__layer--rendering');
    const image = section.locator('[data-before-after-kind="rendering"] img');
    await expect(layer).toHaveCSS('clip-path', 'none');
    await expect
      .poll(async () => {
        const [s, l, i] = await Promise.all([
          stage.boundingBox(),
          layer.boundingBox(),
          image.boundingBox(),
        ]);
        if (!s || !l || !i) return undefined;
        return [
          Math.round(((l.x + l.width - s.x) / s.width) * 100),
          Math.round(i.x - s.x),
          Math.round(i.width - s.width),
        ];
      })
      .toEqual([70, 0, 0]);
  });
});
