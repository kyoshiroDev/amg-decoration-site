// Sprite des icônes généré au build (src/lib/icon-sprite.ts), référencé par Icon.astro.
// URL versionnée par l'empreinte du contenu (`/icons.<version>.svg`) : cache immuable.
import type { APIRoute, GetStaticPaths } from 'astro';
import { ICON_SPRITE_VERSION, iconPaths } from '@/components/ui/icons';
import { buildIconSprite } from '@/lib/icon-sprite';

export const getStaticPaths = (() => [
  { params: { version: ICON_SPRITE_VERSION } },
]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
  new Response(buildIconSprite(iconPaths), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
