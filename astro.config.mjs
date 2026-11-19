// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { loadEnv } from 'vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readArticleSources } from './src/lib/article-files.ts';
import { buildLastmodMap } from './src/lib/sitemap-lastmod.ts';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cspDirectives, INLINE_SCRIPT_HASHES, pruneCspHashes } from './src/lib/csp.ts';

const SITE = 'https://amgdecorationdinterieur.com';

// `lastmod` du sitemap : dates réelles des articles seulement (src/lib/sitemap-lastmod.ts).
const lastmod = buildLastmodMap(readArticleSources(), SITE);

// Service de formulaire (ADR-0003) : lu comme Vite le lira (`process.env`, puis fichiers `.env`),
// pour autoriser son origine dans la CSP.
const { PUBLIC_FORM_ENDPOINT } = {
  ...loadEnv(process.env['NODE_ENV'] ?? 'production', process.cwd(), 'PUBLIC_'),
  ...process.env,
};

// Configuration Astro — voir docs/ARCHITECTURE.md (§ Configuration).
export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  // Content-Security-Policy en balise meta, empreintes calculées au build (ADR-0012).
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: cspDirectives(PUBLIC_FORM_ENDPOINT),
      scriptDirective: {
        // Scripts `is:inline` : Astro ne les hache pas (ADR-0010).
        hashes: [...INLINE_SCRIPT_HASHES],
      },
      styleDirective: {
        // Attributs `style` (variables CSS posées par les composants) : voir ADR-0012.
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
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
    // Empreintes CSP réduites, page par page, à celles des éléments inline présents (ADR-0012).
    {
      name: 'amg:csp-par-page',
      hooks: {
        'astro:build:done': ({ dir }) => {
          const root = fileURLToPath(dir);
          for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
            if (!file.endsWith('.html')) continue;
            const path = `${root}/${file}`;
            const html = readFileSync(path, 'utf8');
            const pruned = pruneCspHashes(html);
            if (pruned !== html) writeFileSync(path, pruned);
          }
        },
      },
    },
    mdx(),
    sitemap({
      // Pages non indexées (noindex) : jamais dans le sitemap (styleguide interne, remerciement du formulaire).
      filter: (page) => !page.includes('/styleguide/') && !page.includes('/merci/'),
      serialize: (item) => {
        const date = lastmod.get(item.url);
        return date ? { ...item, lastmod: date } : item;
      },
    }),
  ],
});
