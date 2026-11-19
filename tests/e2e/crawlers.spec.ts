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
