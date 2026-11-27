// Contrôle d'accès global (ADR-0023) : trois gardes, dans cet ordre, sur toute route : hôte (404),
// session (401, 503), CSRF (403). Enregistrées ici seulement, dans un seul tableau : l'ordre
// d'enregistrement des APP_GUARD est leur ordre d'exécution.
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { API_CONFIG, type LoadedApiConfig } from '../config/config.module.js';
import { SecurityJournal } from '../journal/security-journal.service.js';
import { SERVED_HOSTS } from './access.tokens.js';
import { CsrfGuard } from './csrf.guard.js';
import { HostGuard } from './host.guard.js';
import { ServedHosts } from './served-hosts.js';
import { SessionGuard } from './session.guard.js';

@Global()
@Module({
  providers: [
    {
      provide: SERVED_HOSTS,
      useFactory: (config: LoadedApiConfig) => new ServedHosts(config),
      inject: [API_CONFIG],
    },
    SecurityJournal,
    { provide: APP_GUARD, useClass: HostGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [SERVED_HOSTS, SecurityJournal],
})
export class AccessModule {}
