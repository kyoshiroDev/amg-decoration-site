// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Configuration Astro — voir docs/ARCHITECTURE.md (§ Configuration).
export default defineConfig({
  site: 'https://amgdecorationdinterieur.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  // Polices auto-hébergées via la Fonts API (docs/DESIGN-SYSTEM.md §3).
  // Fraunces en graisses statiques 300/400 : ~18–23 Ko par fichier contre ~120–150 Ko
  // pour le fichier variable complet (axes opsz/SOFT/WONK) — budget LCP.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-display',
      weights: [300, 400],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-body',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  integrations: [
    mdx(),
    sitemap({
      // Le styleguide est un outil interne (noindex) : jamais dans le sitemap.
      filter: (page) => !page.includes('/styleguide/'),
    }),
  ],
});
