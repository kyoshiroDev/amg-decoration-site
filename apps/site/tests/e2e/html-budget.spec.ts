import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { ICON_SPRITE_URL, iconNames } from '../../src/components/ui/icons';

// Budget HTML de l'accueil (ROADMAP Phase 7) : le document doit tenir, compressé, dans la
// fenêtre TCP initiale (14 Kio = 14 336 octets) pour que le navigateur reçoive tout le HTML,
// donc l'image héro et la feuille de style, dès le premier aller-retour.
const HOME_HTML_GZIP_BUDGET = 14 * 1024;

test.describe('Poids du HTML', { tag: '@desktop' }, () => {
  test('accueil sous 14 Kio gzip', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBe(true);
    const size = gzipSync(await response.body()).length;
    expect(size, `${size} octets gzip`).toBeLessThanOrEqual(HOME_HTML_GZIP_BUDGET);
  });

  test('les icônes viennent du sprite, sans tracé répété dans la page', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(ICON_SPRITE_URL).toMatch(/^\/icons\.[0-9a-f]{10}\.svg$/);
    expect(html).toContain(`<use href="${ICON_SPRITE_URL}#`);
    expect(html).not.toMatch(/<svg[^>]*class="icon[^"]*"[^>]*>\s*<path/);
    const sprite = await request.get(ICON_SPRITE_URL);
    expect(sprite.headers()['content-type']).toContain('image/svg+xml');
    const body = await sprite.text();
    for (const name of iconNames) expect(body).toContain(`<symbol id="${name}"`);
  });
});
