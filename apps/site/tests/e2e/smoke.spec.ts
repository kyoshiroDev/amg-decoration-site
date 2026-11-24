import { expect, test, type APIRequestContext } from '@playwright/test';
import { ALL_PAGE_PATHS, NOT_FOUND_PATH } from './helpers';

// Les audits axe-core de toutes les pages sont centralisés dans a11y.spec.ts ; les liens internes
// (200, slash final, aucune ancienne URL) dans seo.spec.ts.

/** Fichiers produits par le build (`/_astro/…`) cités dans un document HTML ou une feuille CSS. */
const ASTRO_ASSET = /\/_astro\/[\w.@%~/-]+/g;

/** Statut attendu du document : la page introuvable répond 404. */
function expectedStatus(path: string): number {
  return path === NOT_FOUND_PATH ? 404 : 200;
}

async function fetchText(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(path, { maxRedirects: 0 });
  expect(response.status(), path).toBe(expectedStatus(path));
  return response.text();
}

test.describe('Accueil', () => {
  test('répond et expose un unique h1', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/AMG Décoration/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

test.describe('Console', () => {
  for (const path of ALL_PAGE_PATHS) {
    test(`aucune erreur console ni exception sur ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // Le statut 404 du document lui-même est attendu sur la page introuvable.
        const isExpected404 =
          path === NOT_FOUND_PATH && message.location().url.endsWith(NOT_FOUND_PATH);
        if (!isExpected404) errors.push(message.text());
      });
      await page.goto(path, { waitUntil: 'load' });
      // Toutes les images différées chargées : une ressource manquante produirait une erreur.
      await page.evaluate(() => {
        for (const image of document.querySelectorAll('img[loading="lazy"]')) {
          (image as HTMLImageElement).loading = 'eager';
        }
      });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Ressources du build', { tag: '@desktop' }, () => {
  test('chaque fichier /_astro/ cité par une page ou une feuille CSS existe', async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const assets = new Set<string>();
    for (const path of ALL_PAGE_PATHS) {
      for (const [asset] of (await fetchText(request, path)).matchAll(ASTRO_ASSET)) {
        assets.add(asset);
      }
    }
    // Les feuilles CSS citent à leur tour polices et textures.
    for (const stylesheet of [...assets].filter((asset) => asset.endsWith('.css'))) {
      for (const [asset] of (await fetchText(request, stylesheet)).matchAll(ASTRO_ASSET)) {
        assets.add(asset);
      }
    }
    expect([...assets].some((asset) => asset.endsWith('.woff2'))).toBe(true);

    const missing: string[] = [];
    for (const asset of assets) {
      const response = await request.head(asset, { maxRedirects: 0 });
      if (response.status() !== 200) missing.push(`${asset} : HTTP ${response.status()}`);
    }
    expect(missing).toEqual([]);
  });
});

test.describe('Liens externes', { tag: '@desktop' }, () => {
  // Format seulement, sans requête réseau : https, nouvel onglet protégé par noopener.
  for (const path of ALL_PAGE_PATHS) {
    test(`https et rel noopener sur ${path}`, async ({ page, baseURL }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const local = new URL(baseURL ?? 'http://localhost:4321').origin;
      const links = await page.locator('a[href]').evaluateAll((anchors) =>
        anchors.map((a) => ({
          href: (a as HTMLAnchorElement).href,
          target: a.getAttribute('target'),
          rel: (a.getAttribute('rel') ?? '').split(/\s+/),
        })),
      );
      const problems: string[] = [];
      for (const { href, target, rel } of links) {
        const url = new URL(href);
        const external = /^https?:$/.test(url.protocol) && url.origin !== local;
        if (external && url.protocol !== 'https:') problems.push(`${href} : pas en https`);
        if (target === '_blank' && !rel.includes('noopener')) {
          problems.push(`${href} : target="_blank" sans rel="noopener"`);
        }
        if (external && target === '_blank' && !rel.includes('noreferrer')) {
          problems.push(`${href} : lien externe sans rel="noreferrer"`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
