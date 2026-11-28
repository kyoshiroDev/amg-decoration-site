// Point d'entrée unique de @amg/shared-schemas (exports du package.json → dist/index.js).
export { EMAIL_MAX_LENGTH, emailSchema, uuidSchema } from './common.js';
export { healthResponseSchema, type HealthResponse } from './health.js';
export {
  MAX_SESSIONS,
  SESSION_AUDIENCES,
  adminSessionListResponseSchema,
  adminSessionSummarySchema,
  clientSessionListResponseSchema,
  clientSessionSummarySchema,
  csrfTokenSchema,
  currentSessionResponseSchema,
  errorResponseSchema,
  sessionAudienceSchema,
  sessionIdSchema,
  sessionParamsSchema,
  type AdminSessionListResponse,
  type AdminSessionSummary,
  type ClientSessionListResponse,
  type ClientSessionSummary,
  type CurrentSessionResponse,
  type ErrorResponse,
  type SessionAudience,
  type SessionParams,
} from './session.js';
