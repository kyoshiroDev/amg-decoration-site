// Garde de session (2e garde globale, refus par défaut, ADR-0023) : toute route exige une session
// valide de l'audience de son hôte, à l'étape `AUTHENTICATED`, sauf `@Public()`. Le cookie lu est
// celui de l'hôte ; un jeton d'une autre audience est refusé (et journalisé). Absent, mal formé,
// inconnu, expiré, révoqué ou d'une autre audience : même 401. Magasin indisponible : 503.
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { clientIp, deviceLabel } from '../http/client-info.js';
import { SESSION_STORE } from '../infrastructure/tokens.js';
import { SecurityJournal } from '../journal/security-journal.service.js';
import { isSessionToken } from '../session/session-token.js';
import type { SessionStage, SessionStore } from '../session/session.types.js';
import { IS_PUBLIC } from './access.decorators.js';
import { requestAudience, setRequestSession } from './request-access.js';
import { SESSION_COOKIE_NAMES } from './session-cookies.js';

/**
 * Étapes admises par défaut : authentification complète seulement. Le lot 4 ajoute un décorateur
 * pour les routes des étapes intermédiaires (TOTP attendu ou à enrôler).
 */
const ROUTE_STAGES: readonly SessionStage[] = ['AUTHENTICATED'];

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_STORE) private readonly store: SessionStore,
    private readonly journal: SecurityJournal,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const audience = requestAudience(request);
    if (audience === undefined) throw new UnauthorizedException();
    const token = request.cookies[SESSION_COOKIE_NAMES[audience]];
    if (!isSessionToken(token)) throw new UnauthorizedException();

    const lookup = await this.store.validate(token, audience);
    if (lookup.status === 'audience') {
      await this.journal.recordOnce(lookup.publicId, {
        type: 'ACCESS_DENIED',
        userId: lookup.userId,
        actorId: null,
        ip: clientIp(request),
        device: deviceLabel(request.headers['user-agent']),
        details: { audience, reason: 'audience' },
      });
      throw new UnauthorizedException();
    }
    if (lookup.status === 'absent' || !ROUTE_STAGES.includes(lookup.record.stage)) {
      throw new UnauthorizedException();
    }
    setRequestSession(request, { audience, token, record: lookup.record });
    return true;
  }
}
