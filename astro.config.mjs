// @ts-check
import { defineConfig } from 'astro/config';
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
  integrations: [mdx(), sitemap()],
});
