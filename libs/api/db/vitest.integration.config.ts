// Tests d'intégration contre un PostgreSQL réel, migrations appliquées (job CI « API (intégration) »).
// Jamais lancés par `npm run test` ni `verify` : `npm run test:integration` exige les variables de
// connexion (tests/integration/test-database.ts) et échoue sans elles au lieu de passer à vide.
// Un seul fichier à la fois : une base, des transactions concurrentes contrôlées par les tests.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
