// robots.txt généré au build (src/lib/crawlers.ts) : sitemap en URL absolue tirée de `site`.
import type { APIRoute } from 'astro';
import { buildRobotsTxt } from '@/lib/crawlers';
import { requireSiteOrigin } from '@/lib/url';

export const GET: APIRoute = ({ site }) => {
  const origin = requireSiteOrigin(site);
  const body = buildRobotsTxt({ sitemapUrl: new URL('/sitemap-index.xml', origin).href });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
