import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Tests e2e du formulaire de contact en mode service (ADR-0003) : build distinct dans
 * `dist-service/` avec un `PUBLIC_FORM_ENDPOINT` factice (jamais appelé, intercepté par les
 * tests). Le build principal (`dist/`, sans variable) couvre le repli `mailto:`.
 */
const PORT = 4322;
const OUT_DIR = 'dist-service';
export const MOCK_FORM_ENDPOINT = 'https://formulaire.test/envoi';

export default defineConfig({
  ...base,
  testDir: 'tests/e2e-service',
  // Dossiers distincts : la suite principale (lancée avant en CI) garde son rapport.
  outputDir: 'test-results/service',
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report/service' }]]
    : 'list',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // `--ignore-lock` : voir playwright.config.ts (serveur gardé au premier plan).
    command: `npx astro build --outDir ${OUT_DIR} && npx astro preview --outDir ${OUT_DIR} --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    // Variable lue par Vite au build (`import.meta.env.PUBLIC_*` depuis `process.env`).
    env: { PUBLIC_FORM_ENDPOINT: MOCK_FORM_ENDPOINT },
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
