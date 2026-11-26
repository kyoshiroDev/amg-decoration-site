// Application de test : la même fabrique que main.ts, journaux coupés.
import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';

export function createTestApp(rootModule?: Type<object>): Promise<NestFastifyApplication> {
  return createApp(rootModule === undefined ? { logger: false } : { logger: false, rootModule });
}
