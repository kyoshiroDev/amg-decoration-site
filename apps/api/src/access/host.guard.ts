// Garde d'hôte (1re garde globale, ADR-0023) : avant toute authentification, une route n'existe que
// sur l'hôte de son audience. Hôte inconnu, route admin sur l'hôte espace, route client sur l'hôte
// admin, route sans préfixe d'audience non déclarée `@AnyHost()` : même 404 qu'une route inconnue.
import {
  Inject,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ANY_HOST } from './access.decorators.js';
import { setRequestAudience } from './request-access.js';
import { SERVED_HOSTS } from './access.tokens.js';
import { routeAudience, type ServedHosts } from './served-hosts.js';

@Injectable()
export class HostGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SERVED_HOSTS) private readonly hosts: ServedHosts,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(ANY_HOST, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const hostAudience = this.hosts.audienceOf(request.headers.host);
    const audience = routeAudience(request.routeOptions.url);
    if (hostAudience === undefined || audience !== hostAudience) throw new NotFoundException();
    setRequestAudience(request, hostAudience);
    return true;
  }
}
