import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { AgreementService } from './agreement.service';

// Estado del acuerdo propio (§3.3, §4.1): progreso del plazo y monto retirable
// hoy, siempre a la vista — "el cliente nunca debería tener que preguntar".
@Controller('client/agreement')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT)
export class ClientAgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Get()
  async getOwn(@CurrentUser() actor: AuthenticatedUser) {
    return this.agreementService.getOwnWithProgress(actor.userId);
  }
}
