import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { AgreementService } from './agreement.service';

// Mismo prefijo que AdvisorPortfolioController (backend/src/users/) — rutas
// distintas (:id/agreement vs :id), sin colisión.
@Controller('advisor/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADVISOR)
export class AdvisorAgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Get(':id/agreement')
  async detail(@CurrentUser() advisor: AuthenticatedUser, @Param('id') clientId: string) {
    return this.agreementService.getForAdvisorClient(advisor.userId, clientId);
  }
}
