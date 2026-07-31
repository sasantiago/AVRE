import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { WithdrawalService } from './withdrawal.service';

@Controller('advisor/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADVISOR)
export class AdvisorWithdrawalsController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Get()
  async queue(@CurrentUser() advisor: AuthenticatedUser) {
    return this.withdrawalService.listQueueForAdvisor(advisor.userId);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() advisor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.withdrawalService.approve(advisor, id, dto.finalAmountUsd);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() advisor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawalService.reject(advisor, id, dto.rejectionReason);
  }
}
