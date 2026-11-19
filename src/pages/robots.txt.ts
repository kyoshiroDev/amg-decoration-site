// robots.txt généré au build (src/lib/crawlers.ts) : sitemap en URL absolue tirée de `site`.
import type { APIRoute } from 'astro';
import { buildRobotsTxt } from '@/lib/crawlers';

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error('robots.txt\u00A0: `site` doit être défini dans astro.config.mjs.');
  }
  const body = buildRobotsTxt({ sitemapUrl: new URL('/sitemap-index.xml', site).href });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
