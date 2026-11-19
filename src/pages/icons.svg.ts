// Sprite des icônes généré au build (src/lib/icon-sprite.ts), référencé par Icon.astro.
import type { APIRoute } from 'astro';
import { iconPaths } from '@/components/ui/icons';
import { buildIconSprite } from '@/lib/icon-sprite';

export const GET: APIRoute = () =>
  new Response(buildIconSprite(iconPaths), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
