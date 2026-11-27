// Configuration du CLI Prisma 7 (generate, migrate). Aucune URL dans l'environnement : elle est
// construite en mémoire depuis DB_HOST, DB_PORT, DB_NAME, DB_USER et le fichier DB_PASSWORD_FILE
// (rôle des migrations `amg_migrator`, jamais celui de l'API). Sans aucune de ces variables, pas de
// source de données : `prisma generate` fonctionne sans base, `migrate` échoue avec l'erreur de Prisma.
// Les imports visent les sources TypeScript (chargées par Prisma), pas dist/ : generate précède le build.
import { defineConfig } from 'prisma/config';
import { buildDatabaseUrl, loadCliDatabaseConnection } from './src/database-config.js';
import { readSecretFile } from './src/secret-file.js';

const connection = loadCliDatabaseConnection(process.env, readSecretFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(connection === undefined ? {} : { datasource: { url: buildDatabaseUrl(connection) } }),
});
