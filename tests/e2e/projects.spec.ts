import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { microcopy } from '../../src/config/microcopy';
import { expectNoAxeViolations } from './helpers';

// Pages Réalisations : index filtrable (avec et sans JS) et page projet.

const INDEX = '/realisations/';
const PROJECT = '/realisations/chalet-suisse/';
const filters = microcopy.projects.filters;
/** Une carte par fiche de `src/content/projets/` : le total suit le contenu. */
const PROJECT_COUNT = readdirSync('src/content/projets').filter((file) =>
  file.endsWith('.md'),
).length;

function statusText(count: number): string {
  return (count === 1 ? filters.statusOne : filters.statusOther).replace('{count}', String(count));
}

async function readGraph(page: Page): Promise<{ '@type': string; [key: string]: unknown }[]> {
  const raw = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';
  return (JSON.parse(raw) as { '@graph': { '@type': string }[] })['@graph'];
}

test.describe('Réalisations : index', () => {
  test('h1 unique, 0 violation axe, chaque carte mène à sa page', async ({ page }) => {
    await page.goto(INDEX);
    await expect(page.locator('h1')).toHaveCount(1);
    const links = page.locator('main [data-project-rooms] h2 a');
    expect(await links.count()).toBe(PROJECT_COUNT);
    for (const href of await links.evaluateAll((a) => a.map((el) => el.getAttribute('href')))) {
      expect(href).toMatch(/^\/realisations\/[a-z0-9-]+\/$/);
    }
    await expectNoAxeViolations(page);
  });

  test('le filtre masque les autres projets, met à jour aria-pressed et annonce le résultat', async ({
    page,
  }) => {
    await page.goto(INDEX);
    const group = page.getByRole('group', { name: filters.label });
    await expect(group).toBeVisible();
    const all = group.getByRole('button', { name: filters.all });
    const dressing = group.getByRole('button', { name: microcopy.projects.roomTypes.dressing });
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    const box = await dressing.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await dressing.click();
    await expect(dressing).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    const visible = page.locator('[data-project-rooms]:visible');
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveAttribute('data-project-rooms', /\bdressing\b/);
    await expect(page.getByRole('status')).toHaveText(statusText(1));
    await expectNoAxeViolations(page);

    await all.click();
    await expect(page.locator('[data-project-rooms]:visible')).toHaveCount(PROJECT_COUNT);
    await expect(page.getByRole('status')).toHaveText(statusText(PROJECT_COUNT));
  });

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('barre de filtres absente, grille complète visible', async ({ page }) => {
      await page.goto(INDEX);
      await expect(page.getByRole('group', { name: filters.label })).toBeHidden();
      await expect(page.locator('[data-project-rooms]:visible')).toHaveCount(PROJECT_COUNT);
    });
  });
});

test.describe('Réalisations : page projet', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(PROJECT);
    expect(response?.status()).toBe(200);
  });

  test('fil d’Ariane, h1 unique, hiérarchie sans saut, 0 violation axe', async ({ page }) => {
    const crumbs = page.getByRole('navigation', { name: microcopy.nav.breadcrumb });
    await expect(crumbs.getByRole('listitem')).toHaveCount(3);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(
      await page.locator('h1').innerText(),
    );
    await expect(page.locator('h1')).toHaveCount(1);
    const levels = await page
      .locator('main :is(h1, h2, h3, h4)')
      .evaluateAll((els) => els.map((el) => Number(el.tagName.slice(1))));
    levels.forEach((level, i) => {
      if (i > 0) expect(level - (levels[i - 1] ?? 1)).toBeLessThanOrEqual(1);
    });
    await expectNoAxeViolations(page);
  });

  test('une seule image prioritaire, couverture nommée comme sa carte', async ({ page }) => {
    const priority = page.locator('img[fetchpriority="high"]');
    await expect(priority).toHaveCount(1);
    const frame = page.locator('.project-hero .arch-image__frame');
    await expect(frame).toHaveAttribute('style', /view-transition-name: projet-chalet-suisse/);
    await page.goto(INDEX);
    await expect(page.locator('[style*="view-transition-name: projet-chalet-suisse"]')).toHaveCount(
      1,
    );
  });

  test('galerie groupée par nature, chaque vignette mène au grand format', async ({ page }) => {
    const gallery = page.locator('#galerie-titre').locator('xpath=ancestor::section[1]');
    const kinds = Object.values(microcopy.projects.gallery.kinds);
    for (const label of await gallery.locator('h3').allInnerTexts()) {
      expect(kinds).toContain(label);
    }
    const images = await gallery.locator('li img').count();
    expect(images).toBeGreaterThan(0);
    await expect(gallery.locator('a[data-lightbox-item][href$=".webp"] img')).toHaveCount(images);
  });

  test('navigation vers les autres projets et CTA', async ({ page }) => {
    const pager = page.getByRole('navigation', { name: microcopy.projects.pager.label });
    await expect(pager.getByRole('link')).toHaveCount(2);
    // Sens et titre séparés (texte du lien « Projet suivant : … », jamais « suivantTitre »).
    const { previous, next, separator } = microcopy.projects.pager;
    for (const [index, direction] of [previous, next].entries()) {
      await expect(pager.getByRole('link').nth(index)).toHaveText(
        new RegExp(`^\\s*${direction}${separator}\\S`),
      );
    }
    await expect(page.locator('main a[href="/contact/"]').first()).toBeVisible();
  });

  test('JSON-LD CreativeWork avec images absolues', async ({ page }) => {
    const work = (await readGraph(page)).find((node) => node['@type'] === 'CreativeWork');
    expect(work?.['url']).toBe(`https://amgdecorationdinterieur.com${PROJECT}`);
    const images = work?.['image'] as string[];
    expect(images.length).toBeGreaterThan(0);
    for (const url of images)
      expect(url).toMatch(/^https:\/\/amgdecorationdinterieur\.com\/_astro\//);
  });
});
