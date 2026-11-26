// Vivacité du processus. Le lot 1 ajoutera la disponibilité (Postgres, Redis) sur une route distincte.
import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@amg/shared-schemas';

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
