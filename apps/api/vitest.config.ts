// Tests unitaires et HTTP (app.inject de Fastify, sans réseau ni base). Les métadonnées de
// décorateurs (`design:paramtypes`, injection Nest) sont émises par le transformeur Oxc de Vite 8,
// qui lit `emitDecoratorMetadata` dans tsconfig.json : aucun plugin SWC (ADR-0023). Le test
// tests/unit/decorator-metadata.test.ts échoue si ce n'est plus le cas. Les tests contre une vraie
// base (tests/integration) passent par vitest.integration.config.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/http/**/*.test.ts'],
    environment: 'node',
    // Les tests de limitation de débit enchaînent quelques centaines de requêtes (app.inject) : le
    // délai par défaut de 5 s est trop court quand les fichiers tournent en parallèle.
    testTimeout: 20_000,
  },
});
