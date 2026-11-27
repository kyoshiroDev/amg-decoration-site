// Journal de sécurité de l'API (ADR-0023, « Journal de sécurité : rôle et pool dédiés ») : chaque
// événement est écrit sur le pool du journal par un INSERT seul (writeSecurityEvent). Un échec est
// consigné au journal applicatif (type d'événement, nom et code de l'erreur, sans donnée
// personnelle) et n'empêche jamais l'opération qu'il décrit (révocation, réponse).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { writeSecurityEvent, type JournalWriter, type SecurityEventInput } from '@amg/api-db';
import { JOURNAL_WRITER, ONCE_STORE } from '../infrastructure/tokens.js';
import type { OnceStore } from '../session/session.types.js';

/** Un événement répétitif (refus d'accès, CSRF) au plus par session et par fenêtre. */
export const REPEATED_EVENT_WINDOW_MS = 10 * 60_000;

const logger = new Logger('SecurityJournal');

function errorCode(error: unknown): string | undefined {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

@Injectable()
export class SecurityJournal {
  constructor(
    @Inject(JOURNAL_WRITER) private readonly writer: JournalWriter,
    @Inject(ONCE_STORE) private readonly once: OnceStore,
  ) {}

  async record(event: SecurityEventInput): Promise<void> {
    try {
      await writeSecurityEvent(this.writer, event);
    } catch (error: unknown) {
      logger.error({
        message: 'Journal de sécurité : écriture impossible',
        type: event.type,
        error: error instanceof Error ? error.name : 'inconnue',
        code: errorCode(error),
      });
    }
  }

  /** Écrit l'événement si aucun de même clé ne l'a été dans la fenêtre (anti-inondation). */
  async recordOnce(key: string, event: SecurityEventInput): Promise<void> {
    let first: boolean;
    try {
      first = await this.once.claim(`${event.type}:${key}`, REPEATED_EVENT_WINDOW_MS);
    } catch {
      logger.warn({
        message: 'Journal de sécurité : anti-répétition indisponible',
        type: event.type,
      });
      return;
    }
    if (first) await this.record(event);
  }
}
