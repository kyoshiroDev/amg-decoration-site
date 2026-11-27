// Filtre global des erreurs : toute exception (Nest, Fastify relayée par Nest, magasin de sessions,
// erreur inattendue) devient une réponse au corps générique (error-bodies.ts). Les en-têtes de
// sécurité sont posés par le crochet `onSend` (security-headers.ts), y compris ici.
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SessionStoreUnavailableError } from '../session/session.types.js';
import { errorBody } from './error-bodies.js';

const logger = new Logger('Http');

/** Code HTTP d'une exception : 503 si le magasin de sessions est indisponible, 500 par défaut. */
export function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof SessionStoreUnavailableError) return 503;
  return 500;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const status = statusOf(exception);
    if (exception instanceof SessionStoreUnavailableError) {
      logger.warn({ message: 'Magasin de sessions indisponible : requête refusée (503)' });
    } else if (status >= 500) {
      // Nom de l'erreur seulement : son message pourrait citer une donnée, un hôte ou un chemin.
      logger.error({
        message: 'Erreur inattendue',
        error: exception instanceof Error ? exception.name : 'inconnue',
      });
    }
    if (reply.sent) return;
    void reply.code(status).send(errorBody(status));
  }
}
