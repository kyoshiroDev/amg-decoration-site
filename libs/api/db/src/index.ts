// Point d'entrée unique de @amg/api-db (exports du package.json → dist/index.js) : client Prisma
// généré, fabrique du client et configuration de connexion.
export {
  ActivationPurpose,
  Prisma,
  PrismaClient,
  SecurityEventType,
  UserRole,
  UserStatus,
  type ActivationToken,
  type EnrollmentCode,
  type RecoveryCode,
  type SecurityEvent,
  type TotpFactor,
  type User,
} from './generated/prisma/client.js';
export {
  DB_PASSWORD_MAX_LENGTH,
  DB_PASSWORD_MIN_LENGTH,
  DatabaseConfigError,
  buildDatabaseUrl,
  databaseEnvShape,
  loadCliDatabaseConnection,
  tcpPortSchema,
  type DatabaseConnection,
  type RevealableSecret,
} from './database-config.js';
export {
  API_CONNECTION_OPTIONS,
  API_SEARCH_PATH,
  DatabaseRoleError,
  POOL_TIMEOUTS,
  SESSION_PRIVILEGES_SQL,
  assertLeastPrivilegedSession,
  buildPoolConfig,
  createPrismaClient,
  type CreatePrismaClientOptions,
  type GuardedPoolConfig,
  type SessionQueryable,
} from './prisma-client.js';
export {
  SECRET_FILE_MAX_BYTES,
  readSecretFile,
  stripFinalNewline,
  type SecretFileReader,
} from './secret-file.js';
