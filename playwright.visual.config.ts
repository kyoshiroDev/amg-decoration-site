import { defineConfig, devices } from '@playwright/test';

/**
 * Régression visuelle de référence (`toHaveScreenshot`), hors CI et hors `npm run test:e2e` :
 * le rendu des polices et l'anticrénelage dépendent de la machine, des références prises en
 * local feraient échouer le runner GitHub Actions. Mode d'emploi : tests/visual/README.md.
 *
 * Build distinct dans `dist-visual/` servi sur un port dédié : ne gêne ni `dist/` ni le
 * serveur de la suite e2e (4321) s'ils tournent en parallèle.
 */
const PORT = 4338;
const OUT_DIR = 'dist-visual';

export default defineConfig({
  testDir: 'tests/visual',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  workers: 1,
  retries: 0,
  // Captures pleine page de pages longues et riches en images : plus lentes qu'un test e2e.
  timeout: 120_000,
  reporter: 'list',
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Tolérance faible : absorbe l'anticrénelage, détecte tout décalage de bloc.
      maxDiffPixelRatio: 0.002,
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: 'reduce',
    trace: 'off',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // `--ignore-lock` : voir playwright.config.ts (serveur gardé au premier plan).
    command: `npx astro build --outDir ${OUT_DIR} && npx astro preview --outDir ${OUT_DIR} --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    // Build compris : voir playwright.config.ts (génération des images à froid ~6 min en CI).
    timeout: 600_000,
  },
});
