// Configuration ESLint du projet : base typée commune de la racine (ADR-0023), sans règle désactivée.
// Client Prisma généré (src/generated/, ignoré par Git) : produit par `prisma generate`, non linté.
import { defineConfig, globalIgnores } from 'eslint/config';
import { typedTsConfigs } from '../../../eslint.config.js';

export default defineConfig(
  globalIgnores(['dist/', 'node_modules/', 'coverage/', 'src/generated/']),
  ...typedTsConfigs(import.meta.dirname),
);
