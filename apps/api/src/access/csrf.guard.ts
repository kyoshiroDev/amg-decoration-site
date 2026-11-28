// Garde CSRF (3e garde globale, ADR-0023, « Exposition HTTP ») : sur toute méthode autre que GET et
// HEAD, trois contrôles cumulés, tous évalués : jeton synchroniseur `X-CSRF-Token` (dérivé du jeton
// de session, comparé en temps constant), `Sec-Fetch-Site: same-origin`, `Origin` exactement égal à
// l'origine configurée de l'hôte servi (`null` refusé). Un seul manque : 403 générique, journalisé
// (une fois par session et par fenêtre). Route publique (sans session, connexion au lot 4) : les
// deux contrôles d'en-têtes seulement.
import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { CSRF_CHECKS } from '@amg/api-db';
import { clientIp, deviceLabel } from '../http/client-info.js';
import { SecurityJournal } from '../journal/security-journal.service.js';
import { csrfTokenMatches } from '../session/session-token.js';
import { IS_PUBLIC } from './access.decorators.js';
import { SERVED_HOSTS } from './access.tokens.js';
import { requestAudience, requestSession } from './request-access.js';
import type { ServedHosts } from './served-hosts.js';

/** Méthodes sans effet (aucun contrôle CSRF) : celles que Fastify expose pour les lectures. */
const SAFE_METHODS: readonly string[] = ['GET', 'HEAD'];

export const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SERVED_HOSTS) private readonly hosts: ServedHosts,
    private readonly journal: SecurityJournal,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.includes(request.method)) return true;
    const audience = requestAudience(request);
    // Route sans hôte attitré (@AnyHost) : aucune origine attendue, aucune écriture admise.
    if (audience === undefined) throw new ForbiddenException();

    const failed: (typeof CSRF_CHECKS)[number][] = [];
    const session = requestSession(request);
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    if (
      !isPublic &&
      (session === undefined || !csrfTokenMatches(session.token, request.headers[CSRF_HEADER]))
    ) {
      failed.push('token');
    }
    if (request.headers['sec-fetch-site'] !== 'same-origin') failed.push('fetch-site');
    if (request.headers.origin !== this.hosts.origin(audience)) failed.push('origin');
    if (failed.length === 0) return true;

    if (session !== undefined) {
      await this.journal.recordOnce(session.record.publicId, {
        type: 'CSRF_REJECTED',
        userId: session.record.userId,
        actorId: null,
        ip: clientIp(request),
        device: deviceLabel(request.headers['user-agent']),
        details: { audience, failed },
      });
    }
    throw new ForbiddenException();
  }
}
