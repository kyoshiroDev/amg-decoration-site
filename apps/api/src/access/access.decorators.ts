// Déclarations d'accès des routes (refus par défaut, ADR-0023) : toute route exige une session de
// l'audience de son hôte, sauf `@Public()` ; toute route est liée à l'hôte de son préfixe
// (`/api/admin/*`, `/api/client/*`), sauf `@AnyHost()` (seulement `GET /api/health`).
import {
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { requestSession, type AuthenticatedAccess } from './request-access.js';

export const IS_PUBLIC = 'amg:access:public';
export const ANY_HOST = 'amg:access:any-host';

/** Route accessible sans session (la garde d'hôte et la garde CSRF s'appliquent toujours). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Route servie quel que soit l'hôte (sonde de santé seulement). */
export const AnyHost = (): MethodDecorator & ClassDecorator => SetMetadata(ANY_HOST, true);

/** Session authentifiée de la requête, établie par la garde de session. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAccess => {
    const session = requestSession(context.switchToHttp().getRequest<object>());
    if (session === undefined) throw new UnauthorizedException();
    return session;
  },
);
