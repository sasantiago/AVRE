import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, from, firstValueFrom } from 'rxjs';
import { TenantContextService } from '../tenant/tenant-context.service';

// Se aplica con @UseInterceptors(TenantContextInterceptor) en rutas ya autenticadas
// (request.user poblado por JwtAuthGuard, que corre antes al ser un guard). Las rutas
// públicas de auth (register/login/refresh/password-reset) no lo usan — resuelven su
// propio tenant vía TenantContextService.run() directamente en el service, porque
// todavía no hay JWT del que sacar el tenantId.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Falta tenantId en el token de acceso');
    }
    return from(this.tenantContext.run(tenantId, () => firstValueFrom(next.handle())));
  }
}
