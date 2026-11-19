import { expect, test } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { site } from '../../src/config/site';
import {
  NOT_FOUND_PATH,
  menuPanel,
  menuToggle,
  menuToggleExpanded,
  openMenuWithKeyboard,
  waitForAnimationsToSettle,
} from './helpers';

test.describe('Navigation desktop', () => {
  test('liste les entrées de site.mainNav dans l’ordre', { tag: '@desktop' }, async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: microcopy.nav.main });
    await expect(nav).toHaveCount(1);
    const links = nav.getByRole('link');
    await expect(links).toHaveText(site.mainNav.map((item) => item.label));
    for (const [index, item] of site.mainNav.entries()) {
      await expect(links.nth(index)).toHaveAttribute('href', item.href);
    }
  });

  test('marque Accueil comme page courante sur /', { tag: '@desktop' }, async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: microcopy.nav.main });
    await expect(nav.getByRole('link', { name: microcopy.home, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
  });

  test(
    'le CTA d’en-tête pointe vers site.headerCta.href',
    { tag: '@desktop' },
    async ({ page }) => {
      await page.goto('/');
      const cta = page.getByRole('banner').getByRole('link', { name: site.headerCta.label });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', site.headerCta.href);
    },
  );

  test('le menu mobile est masqué sur grand écran', { tag: '@desktop' }, async ({ page }) => {
    await page.goto('/');
    await expect(menuToggle(page)).toBeHidden();
  });
});

test.describe('Lien d’évitement', () => {
  test('est focalisé et visible au premier Tab, Entrée mène au contenu', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: microcopy.skipLink });
    await expect(skipLink).not.toBeInViewport();

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport({ ratio: 1 });

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);
    await expect(page.getByRole('main')).toBeFocused();
  });
});

test.describe('Menu mobile', () => {
  test(
    's’ouvre au clavier et ses liens sont atteignables au Tab',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      await openMenuWithKeyboard(page);
      const panel = menuPanel(page);
      await expect.poll(() => menuToggleExpanded(page)).toBe(true);
      // Le script place le focus dans le panneau à l'ouverture.
      await expect(panel.getByRole('button', { name: microcopy.mobileMenu.close })).toBeFocused();

      const nav = panel.getByRole('navigation', { name: microcopy.nav.main });
      for (const item of site.mainNav) {
        await page.keyboard.press('Tab');
        const link = nav.getByRole('link', { name: item.label, exact: true });
        await expect(link).toBeFocused();
        await expect(link).toHaveAttribute('href', item.href);
      }
      await expect(panel).toBeVisible();
    },
  );

  test(
    'Échap ferme le panneau et rend le focus au bouton',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      await openMenuWithKeyboard(page);
      await page.keyboard.press('Escape');
      await expect(menuPanel(page)).toBeHidden();
      await expect(menuToggle(page)).toBeFocused();
      await expect.poll(() => menuToggleExpanded(page)).toBe(false);
    },
  );

  test('le bouton de fermeture ferme le panneau', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await menuToggle(page).click();
    const panel = menuPanel(page);
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: microcopy.mobileMenu.close }).click();
    await expect(panel).toBeHidden();
  });

  test('sortir du panneau au Tab le ferme', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await openMenuWithKeyboard(page);
    const panel = menuPanel(page);
    const lastControl = panel.getByRole('link', { name: microcopy.footer.whatsapp });
    // Avance jusqu'au dernier élément du panneau, puis un Tab de plus.
    for (let i = 0; i < 20; i += 1) {
      if (await lastControl.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(lastControl).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel).toBeHidden();
    const focusInsidePanel = await panel.evaluate((el) => el.contains(document.activeElement));
    expect(focusInsidePanel).toBe(false);
  });

  test('un clic sur un lien ferme le panneau', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await menuToggle(page).click();
    const panel = menuPanel(page);
    await expect(panel).toBeVisible();
    // Neutralise la navigation (après le gestionnaire du panneau, qui écoute en amont) pour
    // observer la fermeture sur la page courante, comme pour une ancre interne.
    await page.evaluate(() => {
      document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    });
    const target = site.mainNav[1];
    await panel.getByRole('link', { name: target.label, exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL('/');
  });

  test(
    'Maj+Tab depuis le premier élément ferme le panneau et laisse le focus visible sur Menu',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      await openMenuWithKeyboard(page);
      const panel = menuPanel(page);
      await expect(panel.getByRole('button', { name: microcopy.mobileMenu.close })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(panel).toBeHidden();
      await expect(menuToggle(page)).toBeFocused();
      await expect(menuToggle(page)).toBeInViewport({ ratio: 1 });
    },
  );

  test(
    'ouvrir le menu au clavier conserve la position de défilement',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => window.scrollTo(0, 300));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
      await menuToggle(page).focus();
      await page.keyboard.press('Enter');
      await expect(menuPanel(page)).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(300);
      await page.keyboard.press('Escape');
      await expect(menuPanel(page)).toBeHidden();
      expect(await page.evaluate(() => window.scrollY)).toBe(300);
    },
  );

  test(
    'le bouton menu remplace la nav et le CTA d’en-tête',
    { tag: '@mobile' },
    async ({ page }) => {
      await page.goto('/');
      const banner = page.getByRole('banner');
      await expect(menuToggle(page)).toBeVisible();
      // Panneau fermé et nav desktop masquée : aucun lien de nav ni CTA exposé dans l'en-tête.
      await expect(banner.getByRole('navigation', { name: microcopy.nav.main })).toHaveCount(0);
      await expect(banner.getByRole('link', { name: site.headerCta.label })).toHaveCount(0);
    },
  );
});

test.describe('Sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('le menu mobile s’ouvre via le popover natif', { tag: '@mobile' }, async ({ page }) => {
    await page.goto('/');
    await menuToggle(page).click();
    const panel = menuPanel(page);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('navigation', { name: microcopy.nav.main }).getByRole('link'),
    ).toHaveText(site.mainNav.map((item) => item.label));
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  for (const path of ['/', NOT_FOUND_PATH]) {
    test(`header, contenu et pied de page restent visibles sur ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await expect(
        page.getByRole('contentinfo').getByRole('navigation', { name: microcopy.nav.footer }),
      ).toBeVisible();

      // Aucun contenu masqué en attendant un script (opacité nulle, visibilité cachée).
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('header *, main *, footer *')]
          .filter((el) => !el.closest('[popover], [aria-hidden="true"]'))
          .filter((el) => {
            const style = getComputedStyle(el);
            return style.opacity === '0' || style.visibility === 'hidden';
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(hidden).toEqual([]);

      // Fond de l'en-tête affiché d'emblée (repli sans JS, contraste du logo et de la nav).
      const headerBackdropOpacity = await page
        .getByRole('banner')
        .evaluate((el) => getComputedStyle(el, '::before').opacity);
      expect(headerBackdropOpacity).toBe('1');
    });
  }
});

test.describe('En-tête au scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const store = window as unknown as { __cls: number };
      store.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) store.__cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
  });

  test('pose data-compact après 80 px sans décaler la mise en page', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    const main = page.getByRole('main');
    await expect(header).not.toHaveAttribute('data-compact', 'true');
    await waitForAnimationsToSettle(page);

    const mainTop = (): Promise<number> =>
      main.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const headerHeight = (): Promise<number> =>
      header.evaluate((el) => el.getBoundingClientRect().height);
    const before = { main: await mainTop(), header: await headerHeight() };
    const clsBefore = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);

    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveAttribute('data-compact', 'true');
    await waitForAnimationsToSettle(page);

    expect(await mainTop()).toBe(before.main);
    expect(await headerHeight()).toBe(before.header);
    const clsAfter = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(clsAfter - clsBefore).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute('data-compact', 'false');
  });

  test('ne se compacte pas sous le seuil de 80 px', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 40));
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await expect(page.getByRole('banner')).not.toHaveAttribute('data-compact', 'true');
  });
});

test.describe('Pied de page', () => {
  test('expose coordonnées, liens légaux et réseaux', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');

    const phone = footer.getByRole('link', { name: site.phone.display });
    await expect(phone).toHaveAttribute('href', 'tel:+33782358132');
    await expect(phone).toHaveAttribute('href', `tel:${site.phone.e164}`);
    await expect(footer.getByRole('link', { name: site.email })).toHaveAttribute(
      'href',
      `mailto:${site.email}`,
    );
    const whatsapp = footer.getByRole('link', { name: microcopy.footer.whatsapp });
    await expect(whatsapp).toHaveAttribute('href', site.whatsapp.url);
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+$/);

    const legal = footer.getByRole('navigation', { name: microcopy.nav.legal }).getByRole('link');
    await expect(legal).toHaveText(site.legalNav.map((item) => item.label));
    for (const [index, item] of site.legalNav.entries()) {
      await expect(legal.nth(index)).toHaveAttribute('href', item.href);
    }

    const sitemap = footer
      .getByRole('navigation', { name: microcopy.nav.footer })
      .getByRole('link');
    await expect(sitemap).toHaveText(site.mainNav.map((item) => item.label));

    for (const social of site.socials) {
      const link = footer.getByRole('link', { name: `${social.label}${microcopy.newTab}` });
      await expect(link).toHaveAttribute('href', social.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    }
  });

  test('le repli du menu mobile cible le plan du site du pied de page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('contentinfo').getByRole('navigation', { name: microcopy.nav.footer }),
    ).toHaveAttribute('id', 'pied-navigation');
  });
});

test.describe('Page 404', () => {
  test('sorties vers les réalisations, les prestations et le contact', async ({ page }) => {
    const response = await page.goto(NOT_FOUND_PATH);
    expect(response?.status()).toBe(404);
    const hrefs = await page
      .locator('main a')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(expect.arrayContaining(['/realisations/', '/prestations/', '/contact/']));
  });
});
