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
      // Replis ajustés maison (src/styles/font-fallbacks.css) : Times New Roman/Liberation,
      // Noto Serif (Android), DejaVu Serif (Ubuntu). Ceux d'Astro ne couvrent ni Linux ni Android.
      optimizedFallbacks: false,
      fallbacks: [
        'fraunces-fallback-times',
        'fraunces-fallback-noto',
        'fraunces-fallback-dejavu',
        'Georgia',
        'serif',
      ],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-body',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      // Replis ajustés maison (src/styles/font-fallbacks.css) : Arial/Liberation/Roboto,
      // Noto Sans, DejaVu Sans (Ubuntu).
      optimizedFallbacks: false,
      fallbacks: [
        'manrope-fallback-sans',
        'manrope-fallback-noto',
        'manrope-fallback-dejavu',
        'system-ui',
        'sans-serif',
      ],
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
