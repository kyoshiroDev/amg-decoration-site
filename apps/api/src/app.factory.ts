// Construction de l'application, partagée par main.ts et les tests HTTP : les tests vérifient
// exactement la configuration servie en production (préfixe, en-têtes, absence de CORS).
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';
import type { DynamicModule, LoggerService, NestApplicationOptions, Type } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ConfigModule, type LoadedApiConfig } from './config/config.module.js';
import { handleFrameworkError, registerSecurityHeaders } from './http/security-headers.js';

/** Préfixe de toutes les routes : l'API est servie sous `admin.…/api/` et `espace.…/api/` (même origine). */
export const API_PREFIX = 'api';

/** Corps JSON maximal hors fichiers (les dépôts de fichiers auront leurs propres limites, CRM 5). */
export const JSON_BODY_LIMIT_BYTES = 64 * 1024;

/**
 * Délai maximal de réception d'une requête complète (en-têtes et corps) : coupe les clients lents
 * (Slowloris) même si Traefik ne le faisait plus. Les dépôts de fichiers (CRM 5) le réévalueront.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Inactivité maximale d'une connexion. Supérieur au `keepAliveTimeout` de Fastify (72 s) : c'est lui
 * qui ferme les connexions de Traefik inactives entre deux requêtes, pas ce délai.
 */
export const CONNECTION_TIMEOUT_MS = 120_000;

export interface CreateAppOptions {
  readonly logger: LoggerService | false;
  /** Configuration validée par `loadEnv` (main.ts) ; injectée sous le jeton API_CONFIG. */
  readonly config: LoadedApiConfig;
  /**
   * Module racine, `AppModule` par défaut. Les tests HTTP passent un module qui importe `AppModule`
   * et ajoute des routes de test (ex. POST pour éprouver les parseurs) : même configuration servie.
   */
  readonly rootModule?: Type<object>;
}

/** Racine technique : la configuration (module global) au-dessus du module applicatif. */
@Module({})
class ApplicationRoot {}

function rootModule(options: CreateAppOptions): DynamicModule {
  return {
    module: ApplicationRoot,
    imports: [ConfigModule.forRoot(options.config), options.rootModule ?? AppModule],
  };
}

export async function createApp(options: CreateAppOptions): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: JSON_BODY_LIMIT_BYTES,
    // Aucun en-tête X-Forwarded-* cru tant que le lot 3 n'a pas restreint la confiance à Traefik.
    trustProxy: false,
    logger: false,
    requestTimeout: REQUEST_TIMEOUT_MS,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    // Valeurs par défaut de Fastify, rendues explicites : `__proto__` ou `constructor.prototype`
    // dans un JSON reçu → 400.
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
    // URL mal encodée, paramètre trop long : réponse générique avec les en-têtes de sécurité.
    frameworkErrors: handleFrameworkError,
  });
  // Parseurs de corps : celui de JSON intégré à Fastify, seul. `text/plain` (intégré à Fastify) est
  // retiré, et `application/x-www-form-urlencoded` (ajouté par Nest) n'est jamais enregistré
  // (`bodyParser: false`) : un formulaire HTML inter-origines ne peut pas atteindre un contrôleur.
  adapter.getInstance().removeContentTypeParser('text/plain');
  // Pas d'option `cors` : même origine que les CRM, aucun en-tête Access-Control-* (ADR-0023).
  // Options typées par `Pick` (type mappé) : Nest déclare ses options comme une classe, qu'un objet
  // littéral ne peut pas satisfaire au sens de `no-unsafe-class-instance-assignment`.
  const nestOptions: Pick<NestApplicationOptions, 'logger' | 'abortOnError' | 'bodyParser'> = {
    logger: options.logger,
    bodyParser: false,
    // Erreur d'amorçage levée (puis journalisée par main.ts) au lieu d'un `process.abort()`.
    abortOnError: false,
  };
  const app = await NestFactory.create<NestFastifyApplication>(
    rootModule(options),
    adapter,
    nestOptions,
  );
  app.setGlobalPrefix(API_PREFIX);
  registerSecurityHeaders(app.getHttpAdapter().getInstance());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
