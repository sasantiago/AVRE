import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { MarkProcessingDto } from './dto/mark-processing.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { WithdrawalService } from './withdrawal.service';

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Get()
  async queue() {
    return this.withdrawalService.listQueueForAdmin();
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.withdrawalService.approve(admin, id, dto.finalAmountUsd);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawalService.reject(admin, id, dto.rejectionReason);
  }

  // Solo el operador (ADMIN) ejecuta la transferencia de salida manualmente y
  // registra el hash acá (§7.4, §13.3).
  @Post(':id/mark-processing')
  async markProcessing(@Param('id') id: string, @Body() dto: MarkProcessingDto) {
    return this.withdrawalService.markProcessing(id, dto.outboundTxHash);
  }
}
