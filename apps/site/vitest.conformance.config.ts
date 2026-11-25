/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Conformité de l'image nginx avec Vercel (tests/conformance/) : hors de `npm run test` et de
// `verify`, car il faut l'image Docker construite (voir tests/conformance/container.ts).
export default getViteConfig({
  test: {
    include: ['tests/conformance/nginx-conformance.ts'],
    globalSetup: ['tests/conformance/container.ts'],
    environment: 'node',
    passWithNoTests: false,
    testTimeout: 15_000,
  },
});
