import { Module } from '@nestjs/common';
import { AdminSessionController, ClientSessionController } from './session.controllers.js';
import { SessionRoutes } from './session-routes.service.js';

@Module({
  controllers: [AdminSessionController, ClientSessionController],
  providers: [SessionRoutes],
  exports: [SessionRoutes],
})
export class SessionModule {}
