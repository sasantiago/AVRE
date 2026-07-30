import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';
import { OnboardingService } from '../../onboarding/onboarding.service';

// TODO(fase-aportes): aplicar este guard en el futuro controller de "aportes" de
// capital (sección 6.5 del doc de requerimientos) — hoy no existe ese módulo, así que
// se valida contra un endpoint placeholder en los tests (ver onboarding e2e/spec).
//
// Corre como Guard (antes que los Interceptors en el pipeline de Nest), así que abre
// su propia transacción corta vía TenantContextService.run() en vez de depender de
// TenantContextInterceptor — que sigue aplicándose aparte para el handler real.
@Injectable()
export class AgreementAcceptedGuard implements CanActivate {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.tenantId || !user?.userId) {
      throw new ForbiddenException('Falta contexto de usuario autenticado');
    }

    const accepted = await this.tenantContext.run(user.tenantId, () =>
      this.onboardingService.hasAcceptedActiveAgreement(user.userId),
    );

    if (!accepted) {
      throw new ForbiddenException(
        'Necesitás aceptar la versión vigente del Acuerdo de Gestión Discrecional antes de continuar',
      );
    }
    return true;
  }
}
