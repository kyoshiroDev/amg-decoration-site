import { expect, test } from '@playwright/test';

const SITE_ORIGIN = 'https://amgdecorationdinterieur.com';

test.describe('Fichiers pour les robots', { tag: '@desktop' }, () => {
  test('robots.txt : 200 en texte brut, tout autorisé, sitemap absolu existant', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    const body = await response.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body).toMatch(/^Allow: \/$/m);
    expect(body).not.toMatch(/disallow/i);

    const sitemaps = [...body.matchAll(/^Sitemap: (\S+)$/gm)].map((match) => match[1] ?? '');
    expect(sitemaps).toEqual([`${SITE_ORIGIN}/sitemap-index.xml`]);
    // Le domaine de production est servi localement par la prévisualisation.
    const sitemap = await request.get(new URL(sitemaps[0] ?? '').pathname);
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('<sitemapindex');
  });
});

test.describe('llms.txt', { tag: '@desktop' }, () => {
  test('cohérent avec le sitemap : liens existants, aucune page de détail oubliée', async ({
    request,
  }) => {
    const response = await request.get('/llms.txt', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    const body = await response.text();
    expect(body).toMatch(/^# \S/);
    expect(body).toMatch(/^> \S/m);
    expect(body).toMatch(/^## Optional$/m);
    expect(body, 'aucun prix').not.toMatch(/€/);

    const links = [...body.matchAll(/^- \[[^\]]*\]\((\S+)\)/gm)].map((match) => match[1] ?? '');
    expect(links.length).toBeGreaterThan(0);
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');
    for (const link of links) {
      expect(link.startsWith(`${SITE_ORIGIN}/`), `${link} : URL absolue de production`).toBe(true);
      expect(sitemapUrls, `${link} : présent dans le sitemap`).toContain(link);
    }
    const details = sitemapUrls.filter((url) =>
      /\/(prestations|realisations|conseils-deco)\/[^/]+\/$/.test(url),
    );
    expect(details.length).toBeGreaterThan(0);
    for (const url of details) expect(links, `${url} : absent de llms.txt`).toContain(url);
  });
});
