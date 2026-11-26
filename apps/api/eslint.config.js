// Configuration ESLint du projet : base typée commune de la racine (ADR-0023), sans règle désactivée.
import { defineConfig, globalIgnores } from 'eslint/config';
import { typedTsConfigs } from '../../eslint.config.js';

export default defineConfig(
  globalIgnores(['dist/', 'node_modules/', 'coverage/']),
  ...typedTsConfigs(import.meta.dirname),
);
