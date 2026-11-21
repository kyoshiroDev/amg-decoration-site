// llms.txt généré au build (spécification llmstxt.org) : src/lib/pages/llms.ts.
import type { APIRoute } from 'astro';
import { getLlmsTxt } from '@/lib/pages/llms';
import { requireSiteOrigin } from '@/lib/url';

export const GET: APIRoute = async ({ site }) => {
  return new Response(await getLlmsTxt(requireSiteOrigin(site)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
