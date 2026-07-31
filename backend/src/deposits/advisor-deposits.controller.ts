import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { DepositService } from './deposit.service';
import { RejectDepositDto } from './dto/review-deposit.dto';

// Cola de depósitos de los clientes asignados a este asesor (§4.2) — ya
// verificados on-chain, esperando aprobación humana.
@Controller('advisor/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADVISOR)
export class AdvisorDepositsController {
  constructor(private readonly depositService: DepositService) {}

  @Get()
  async queue(@CurrentUser() advisor: AuthenticatedUser) {
    return this.depositService.listQueueForAdvisor(advisor.userId);
  }

  @Post(':id/approve')
  async approve(@CurrentUser() advisor: AuthenticatedUser, @Param('id') id: string) {
    return this.depositService.approve(advisor, id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() advisor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectDepositDto,
  ) {
    return this.depositService.reject(advisor, id, dto.rejectionReason);
  }
}
