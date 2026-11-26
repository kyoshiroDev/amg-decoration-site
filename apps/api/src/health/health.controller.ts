// `GET /api/health` : sonde de vivacité (HEALTHCHECK du conteneur, Traefik). Publique par nature ; la
// garde « refus par défaut » du lot 3 la déclarera explicitement publique.
import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@amg/shared-schemas';
// Import de valeur (pas `import type`) : la classe sert de jeton d'injection via `design:paramtypes`.
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  get(): HealthResponse {
    return this.health.check();
  }
}
