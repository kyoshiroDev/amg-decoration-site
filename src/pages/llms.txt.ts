// llms.txt généré au build (spécification llmstxt.org) : src/lib/pages/llms.ts.
import type { APIRoute } from 'astro';
import { getLlmsTxt } from '@/lib/pages/llms';

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error('llms.txt : `site` doit être défini dans astro.config.mjs.');
  }
  return new Response(await getLlmsTxt(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
