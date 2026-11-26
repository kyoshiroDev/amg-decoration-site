// Garde-fou de l'outillage (ADR-0023) : l'injection de Nest repose sur la métadonnée
// `design:paramtypes`, émise par tsc au build et par le transformeur Oxc de Vite sous Vitest. Si un
// changement d'outil (Vite, Vitest, TypeScript) ou un `import type` sur une classe injectée la fait
// disparaître, ce test échoue avant que l'API ne casse.
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { HealthController } from '../../src/health/health.controller.js';
import { HealthService } from '../../src/health/health.service.js';

describe('métadonnées de décorateurs sous Vitest', () => {
  it('émet le type des paramètres du constructeur', () => {
    expect(Reflect.getMetadata('design:paramtypes', HealthController)).toEqual([HealthService]);
  });
});
