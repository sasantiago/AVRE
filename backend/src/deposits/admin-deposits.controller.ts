import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { DepositService } from './deposit.service';
import { RejectDepositDto } from './dto/review-deposit.dto';

// Cola de depósitos de todo el tenant (§4.3) — incluye clientes sin asesor asignado.
@Controller('admin/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminDepositsController {
  constructor(private readonly depositService: DepositService) {}

  @Get()
  async queue() {
    return this.depositService.listQueueForAdmin();
  }

  @Post(':id/approve')
  async approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.depositService.approve(admin, id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectDepositDto,
  ) {
    return this.depositService.reject(admin, id, dto.rejectionReason);
  }
}
