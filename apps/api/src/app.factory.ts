// Construction de l'application, partagée par main.ts et les tests HTTP : les tests vérifient
// exactement la configuration servie en production (préfixe, en-têtes, absence de CORS).
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LoggerService, NestApplicationOptions } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { registerSecurityHeaders } from './http/security-headers.js';

/** Préfixe de toutes les routes : l'API est servie sous `admin.…/api/` et `espace.…/api/` (même origine). */
export const API_PREFIX = 'api';

/** Corps JSON maximal hors fichiers (les dépôts de fichiers auront leurs propres limites, CRM 5). */
export const JSON_BODY_LIMIT_BYTES = 64 * 1024;

export interface CreateAppOptions {
  readonly logger: LoggerService | false;
}

export async function createApp(options: CreateAppOptions): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: JSON_BODY_LIMIT_BYTES,
    // Aucun en-tête X-Forwarded-* cru tant que le lot 3 n'a pas restreint la confiance à Traefik.
    trustProxy: false,
    logger: false,
  });
  // Pas d'option `cors` : même origine que les CRM, aucun en-tête Access-Control-* (ADR-0023).
  // Options typées par `Pick` (type mappé) : Nest déclare ses options comme une classe, qu'un objet
  // littéral ne peut pas satisfaire au sens de `no-unsafe-class-instance-assignment`.
  const nestOptions: Pick<NestApplicationOptions, 'logger' | 'abortOnError'> = {
    logger: options.logger,
    // Erreur d'amorçage levée (puis journalisée par main.ts) au lieu d'un `process.abort()`.
    abortOnError: false,
  };
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, nestOptions);
  app.setGlobalPrefix(API_PREFIX);
  registerSecurityHeaders(app.getHttpAdapter().getInstance());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
