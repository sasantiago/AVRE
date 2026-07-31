import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { BuyOrderDto } from './dto/buy-order.dto';
import { OrderService } from './order.service';

@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT)
export class ClientOrdersController {
  constructor(private readonly orderService: OrderService) {}

  @Post('orders')
  async buy(@CurrentUser() actor: AuthenticatedUser, @Body() dto: BuyOrderDto) {
    return this.orderService.buy(actor, dto);
  }

  @Get('orders')
  async list(@CurrentUser() actor: AuthenticatedUser) {
    return this.orderService.listForClient(actor.userId);
  }

  @Get('portfolio')
  async portfolio(@CurrentUser() actor: AuthenticatedUser) {
    return this.orderService.getPortfolio(actor.userId);
  }
}
