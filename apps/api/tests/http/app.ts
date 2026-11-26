// Application de test : la même fabrique que main.ts, journaux coupés.
import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';

export function createTestApp(): Promise<NestFastifyApplication> {
  return createApp({ logger: false });
}
