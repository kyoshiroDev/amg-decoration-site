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
      fallbacks: ['sans-serif', 'system-ui'],
    },
  ],
  integrations: [
    mdx(),
    sitemap({
      // Pages non indexées (noindex) : jamais dans le sitemap (styleguide interne, remerciement du formulaire).
      filter: (page) => !page.includes('/styleguide/') && !page.includes('/merci/'),
    }),
  ],
});
