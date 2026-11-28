// Jetons d'injection des services d'infrastructure (Redis, pool du journal), fournis par
// InfrastructureModule depuis createApp.
export const SESSION_STORE = Symbol('SESSION_STORE');
export const ONCE_STORE = Symbol('ONCE_STORE');
export const JOURNAL_WRITER = Symbol('JOURNAL_WRITER');
