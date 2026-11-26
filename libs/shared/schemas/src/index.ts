// Point d'entrée unique de @amg/shared-schemas (exports du package.json → dist/index.js).
export { EMAIL_MAX_LENGTH, emailSchema, uuidSchema } from './common.js';
export { healthResponseSchema, type HealthResponse } from './health.js';
