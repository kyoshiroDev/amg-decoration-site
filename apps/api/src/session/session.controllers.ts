// Routes de session de l'atelier (`/api/admin/*`, hôte admin.) et de l'espace client
// (`/api/client/*`, hôte espace.) : mêmes opérations, réponses propres à chaque audience (aucune
// adresse réseau côté client). Session, hôte et CSRF sont contrôlés par les gardes globales.
import { Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import {
  sessionParamsSchema,
  type AdminSessionListResponse,
  type ClientSessionListResponse,
  type CurrentSessionResponse,
  type SessionParams,
} from '@amg/shared-schemas';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentSession } from '../access/access.decorators.js';
import type { AuthenticatedAccess } from '../access/request-access.js';
import { SessionRoutes } from './session-routes.service.js';

@Controller('admin')
export class AdminSessionController {
  constructor(private readonly routes: SessionRoutes) {}

  @Get('session')
  current(@CurrentSession() session: AuthenticatedAccess): CurrentSessionResponse {
    return this.routes.current(session);
  }

  @Get('sessions')
  async list(@CurrentSession() session: AuthenticatedAccess): Promise<AdminSessionListResponse> {
    return { sessions: await this.routes.listForAdmin(session) };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async close(
    @CurrentSession() session: AuthenticatedAccess,
    @Param({ schema: sessionParamsSchema }) params: SessionParams,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.routes.close(session, params.id, request, reply);
  }

  @Post('session/logout')
  @HttpCode(204)
  async logout(
    @CurrentSession() session: AuthenticatedAccess,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.routes.logout(session, request, reply);
  }
}

@Controller('client')
export class ClientSessionController {
  constructor(private readonly routes: SessionRoutes) {}

  @Get('session')
  current(@CurrentSession() session: AuthenticatedAccess): CurrentSessionResponse {
    return this.routes.current(session);
  }

  @Get('sessions')
  async list(@CurrentSession() session: AuthenticatedAccess): Promise<ClientSessionListResponse> {
    return { sessions: await this.routes.listForClient(session) };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async close(
    @CurrentSession() session: AuthenticatedAccess,
    @Param({ schema: sessionParamsSchema }) params: SessionParams,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.routes.close(session, params.id, request, reply);
  }

  @Post('session/logout')
  @HttpCode(204)
  async logout(
    @CurrentSession() session: AuthenticatedAccess,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.routes.logout(session, request, reply);
  }
}
