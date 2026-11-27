// Module global de l'infrastructure : magasin de sessions, anti-répétition et pool du journal,
// démarrés après l'amorçage et fermés à l'arrêt (SIGTERM, app.close()).
import {
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Infrastructure } from './infrastructure.js';
import { JOURNAL_WRITER, ONCE_STORE, SESSION_STORE } from './tokens.js';

const INFRASTRUCTURE = Symbol('INFRASTRUCTURE');

@Injectable()
export class InfrastructureLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(INFRASTRUCTURE) private readonly infrastructure: Infrastructure) {}

  onApplicationBootstrap(): void {
    this.infrastructure.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.infrastructure.close();
  }
}

@Module({})
export class InfrastructureModule {
  static forRoot(infrastructure: Infrastructure): DynamicModule {
    return {
      module: InfrastructureModule,
      global: true,
      providers: [
        { provide: INFRASTRUCTURE, useValue: infrastructure },
        { provide: SESSION_STORE, useValue: infrastructure.sessionStore },
        { provide: ONCE_STORE, useValue: infrastructure.onceStore },
        { provide: JOURNAL_WRITER, useValue: infrastructure.journal },
        InfrastructureLifecycle,
      ],
      exports: [SESSION_STORE, ONCE_STORE, JOURNAL_WRITER],
    };
  }
}
