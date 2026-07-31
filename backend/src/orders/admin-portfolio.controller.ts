import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { OrderService } from './order.service';

@Controller('admin/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminClientPortfolioController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id/portfolio')
  async portfolio(@Param('id') clientId: string) {
    return this.orderService.getPortfolioForAdmin(clientId);
  }
}
