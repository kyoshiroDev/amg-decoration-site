// Routes de session communes aux deux audiences (ADR-0023, « Hôtes, gardes et limitation de
// débit ») : session courante, liste, fermeture d'une session, déconnexion. La connexion arrive au
// lot 4 ; « fermer toutes les autres » aussi (ré-authentification récente exigée).
import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminSessionSummary,
  ClientSessionSummary,
  CurrentSessionResponse,
  SessionAudience,
} from '@amg/shared-schemas';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedAccess } from '../access/request-access.js';
import { clearSessionCookie } from '../access/session-cookies.js';
import { clientIp, deviceLabel } from '../http/client-info.js';
import { SESSION_STORE } from '../infrastructure/tokens.js';
import { SecurityJournal } from '../journal/security-journal.service.js';
import { deriveCsrfToken } from './session-token.js';
import { idleExpiresAt, type SessionRecord, type SessionStore } from './session.types.js';

const iso = (millis: number): string => new Date(millis).toISOString();

function summary(record: SessionRecord, current: SessionRecord): ClientSessionSummary {
  return {
    id: record.publicId,
    current: record.publicId === current.publicId,
    createdAt: iso(record.createdAt),
    lastSeenAt: iso(record.lastSeenAt),
    device: record.device,
  };
}

@Injectable()
export class SessionRoutes {
  constructor(
    @Inject(SESSION_STORE) private readonly store: SessionStore,
    private readonly journal: SecurityJournal,
  ) {}

  current(session: AuthenticatedAccess): CurrentSessionResponse {
    const { record } = session;
    return {
      id: record.publicId,
      audience: record.audience,
      createdAt: iso(record.createdAt),
      lastSeenAt: iso(record.lastSeenAt),
      idleExpiresAt: iso(idleExpiresAt(record)),
      absoluteExpiresAt: iso(record.absoluteExpiresAt),
      csrfToken: deriveCsrfToken(session.token),
    };
  }

  async listForClient(session: AuthenticatedAccess): Promise<ClientSessionSummary[]> {
    const records = await this.store.list(session.record.userId, session.audience);
    return records.map((record) => summary(record, session.record));
  }

  async listForAdmin(session: AuthenticatedAccess): Promise<AdminSessionSummary[]> {
    const records = await this.store.list(session.record.userId, session.audience);
    return records.map((record) => ({
      ...summary(record, session.record),
      network: record.network,
    }));
  }

  /**
   * Ferme une session du compte courant. Identifiant inconnu ou d'un autre compte : sans effet, même
   * réponse (aucune information sur les sessions des autres). Session courante : cookie effacé.
   */
  async close(
    session: AuthenticatedAccess,
    publicId: string,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const revoked = await this.store.revokeByPublicId(
      session.record.userId,
      session.audience,
      publicId,
    );
    if (publicId === session.record.publicId) clearSessionCookie(reply, session.audience);
    if (revoked) {
      await this.journal.record({
        type: 'SESSION_REVOKED',
        userId: session.record.userId,
        actorId: null,
        ip: clientIp(request),
        device: deviceLabel(request.headers['user-agent']),
        details: { audience: session.audience, reason: 'self', sessionId: publicId },
      });
    }
  }

  /** Déconnexion : session révoquée côté serveur, cookie effacé, événement `LOGOUT`. */
  async logout(
    session: AuthenticatedAccess,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    await this.store.revoke(session.token, session.audience);
    clearSessionCookie(reply, session.audience);
    await this.journal.record({
      type: 'LOGOUT',
      userId: session.record.userId,
      actorId: null,
      ip: clientIp(request),
      device: deviceLabel(request.headers['user-agent']),
      details: { audience: session.audience },
    });
  }

  /** Révocations au-delà de la limite de sessions simultanées (création, lot 4). */
  async recordEvictions(
    audience: SessionAudience,
    userId: string,
    evicted: readonly string[],
    request: FastifyRequest,
  ): Promise<void> {
    for (const sessionId of evicted) {
      await this.journal.record({
        type: 'SESSION_REVOKED',
        userId,
        actorId: null,
        ip: clientIp(request),
        device: deviceLabel(request.headers['user-agent']),
        details: { audience, reason: 'limit', sessionId },
      });
    }
  }
}
