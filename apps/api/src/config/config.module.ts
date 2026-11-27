// Configuration chargée et validée au démarrage (main.ts), mise à disposition de tous les modules
// sous le jeton API_CONFIG. Global : enregistré une fois par createApp, au-dessus du module racine.
import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiConfig } from './load-env.js';
import type { ApiSecrets } from './secrets.js';

export const API_CONFIG = Symbol('API_CONFIG');

export type LoadedApiConfig = ApiConfig<ApiSecrets>;

@Module({})
export class ConfigModule {
  static forRoot(config: LoadedApiConfig): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: API_CONFIG, useValue: config }],
      exports: [API_CONFIG],
    };
  }
}
