// Tests d'intégration de l'API contre un PostgreSQL réel, migrations appliquées (job CI « API
// (intégration) »). Hors de `npm run test` et de `verify` ; échouent sans les variables de la base.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
