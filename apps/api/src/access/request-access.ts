// État d'accès d'une requête, établi par les gardes (hôte, puis session) et lu par les contrôleurs.
// Table faible indexée par l'objet requête : rien n'est ajouté à la requête elle-même.
import type { SessionAudience } from '@amg/shared-schemas';
import type { SessionRecord } from '../session/session.types.js';

export interface AuthenticatedAccess {
  readonly audience: SessionAudience;
  /** Jeton du cookie : jamais renvoyé, jamais journalisé (rotation, révocation, CSRF). */
  readonly token: string;
  readonly record: SessionRecord;
}

interface RequestAccess {
  audience?: SessionAudience;
  session?: AuthenticatedAccess;
}

const access = new WeakMap<object, RequestAccess>();

function entry(request: object): RequestAccess {
  let current = access.get(request);
  if (current === undefined) {
    current = {};
    access.set(request, current);
  }
  return current;
}

export function setRequestAudience(request: object, audience: SessionAudience): void {
  entry(request).audience = audience;
}

export function requestAudience(request: object): SessionAudience | undefined {
  return access.get(request)?.audience;
}

export function setRequestSession(request: object, session: AuthenticatedAccess): void {
  entry(request).session = session;
}

export function requestSession(request: object): AuthenticatedAccess | undefined {
  return access.get(request)?.session;
}
