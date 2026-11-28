// Application de test : la même fabrique que main.ts, journaux coupés, configuration de test et
// infrastructure en mémoire (sessions, journal, limitation de débit), sauf si `infrastructure` vaut
// `'real'` (tests d'intégration : Redis et pool du journal de la configuration).
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';
import type { LoadedApiConfig } from '../../src/config/config.module.js';
import {
  memoryInfrastructure,
  type MemoryInfrastructure,
} from '../support/memory-infrastructure.js';
import { loadTestConfig } from '../support/test-config.js';

export function createTestApp(
  rootModule?: Type<object>,
  config: LoadedApiConfig = loadTestConfig(),
  infrastructure: MemoryInfrastructure | 'real' = memoryInfrastructure(),
): Promise<NestFastifyApplication> {
  return createApp({
    logger: false,
    config,
    ...(rootModule === undefined ? {} : { rootModule }),
    ...(infrastructure === 'real' ? {} : { infrastructure }),
  });
}
