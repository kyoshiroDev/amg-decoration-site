// Routes réservées aux tests HTTP, greffées sur AppModule : l'API n'a encore aucune route POST, or
// Fastify ne contrôle le type du corps (415) que pour une route existante.
import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';

@Controller('test')
class TestRoutesController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body() body: unknown): { readonly received: unknown } {
    return { received: body };
  }
}

@Module({ imports: [AppModule], controllers: [TestRoutesController] })
export class TestRoutesModule {}
