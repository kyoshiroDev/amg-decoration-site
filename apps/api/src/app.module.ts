import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { SessionModule } from './session/session.module.js';

@Module({
  imports: [AccessModule, DatabaseModule, HealthModule, SessionModule],
})
export class AppModule {}
