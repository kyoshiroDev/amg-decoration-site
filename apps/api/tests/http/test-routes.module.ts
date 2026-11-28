// Routes réservées aux tests HTTP, greffées sur AppModule : POST publics pour éprouver les parseurs
// (Fastify ne contrôle le type du corps, 415, que pour une route existante), sous le préfixe de
// l'atelier (garde d'hôte) ; la garde CSRF s'y applique (Origin et Sec-Fetch-Site).
import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { Public } from '../../src/access/access.decorators.js';
import { AppModule } from '../../src/app.module.js';

/** En-têtes d'une requête de même origine sur l'hôte admin de test. */
export const ADMIN_SAME_ORIGIN = Object.freeze({
  host: 'admin.example.test',
  origin: 'https://admin.example.test',
  'sec-fetch-site': 'same-origin',
});

@Controller('admin/test')
@Public()
class TestRoutesController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body() body: unknown): { readonly received: unknown } {
    return { received: body };
  }
}

@Module({ imports: [AppModule], controllers: [TestRoutesController] })
export class TestRoutesModule {}
