import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { OrderService } from './order.service';

// Mismo prefijo que AdvisorPortfolioController (backend/src/users/) y
// AdvisorAgreementController — ruta distinta (:id/portfolio), sin colisión.
@Controller('advisor/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADVISOR)
export class AdvisorClientPortfolioController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id/portfolio')
  async portfolio(@CurrentUser() advisor: AuthenticatedUser, @Param('id') clientId: string) {
    return this.orderService.getPortfolioForAdvisorClient(advisor.userId, clientId);
  }
}
