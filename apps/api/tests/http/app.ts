// Application de test : la même fabrique que main.ts, journaux coupés, configuration de test.
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';
import type { LoadedApiConfig } from '../../src/config/config.module.js';
import { loadTestConfig } from '../support/test-config.js';

export function createTestApp(
  rootModule?: Type<object>,
  config: LoadedApiConfig = loadTestConfig(),
): Promise<NestFastifyApplication> {
  return createApp(
    rootModule === undefined ? { logger: false, config } : { logger: false, config, rootModule },
  );
}
