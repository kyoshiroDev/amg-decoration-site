import { describe, expect, it } from 'vitest';
import { buildRobotsTxt } from '@/lib/crawlers';

describe('buildRobotsTxt', () => {
  const robots = buildRobotsTxt({
    sitemapUrl: 'https://amgdecorationdinterieur.com/sitemap-index.xml',
  });

  it('autorise tout et déclare le sitemap en URL absolue', () => {
    expect(robots).toBe(
      [
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: https://amgdecorationdinterieur.com/sitemap-index.xml',
        '',
      ].join('\n'),
    );
  });

  it('ne contient aucune directive Disallow', () => {
    expect(robots).not.toMatch(/disallow/i);
  });

  it('refuse un sitemap relatif ou hors http(s)', () => {
    expect(() => buildRobotsTxt({ sitemapUrl: '/sitemap-index.xml' })).toThrow(/absolue/);
    expect(() => buildRobotsTxt({ sitemapUrl: 'ftp://exemple.fr/sitemap.xml' })).toThrow(/http/);
  });
});
