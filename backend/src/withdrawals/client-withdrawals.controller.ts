import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalService } from './withdrawal.service';

@Controller('client/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT)
export class ClientWithdrawalsController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalService.create(actor, dto);
  }

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser) {
    return this.withdrawalService.listOwn(actor);
  }

  @Get(':id')
  async detail(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.withdrawalService.getOwn(actor, id);
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.withdrawalService.cancel(actor, id);
  }
}
