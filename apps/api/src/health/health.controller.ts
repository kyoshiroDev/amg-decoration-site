// `GET /api/health` : sonde de vivacité (HEALTHCHECK du conteneur, sur 127.0.0.1). Seule route
// publique servie quel que soit l'hôte (ADR-0023) ; exemptée de la limitation de débit.
import { Controller, Get } from '@nestjs/common';
import { AnyHost, Public } from '../access/access.decorators.js';
import type { HealthResponse } from '@amg/shared-schemas';
// Import de valeur (pas `import type`) : la classe sert de jeton d'injection via `design:paramtypes`.
import { HealthService } from './health.service.js';

@Controller('health')
@Public()
@AnyHost()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  get(): HealthResponse {
    return this.health.check();
  }
}
