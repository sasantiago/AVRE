import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { MarketService } from './market.service';

// Dashboard de mercado del cliente (§4.1): catálogo habilitado para su tenant,
// con cotización. También accesible por ADVISOR/ADMIN para armar la vista de
// cartera de un cliente sin duplicar el catálogo.
@Controller('client/market')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT, Role.ADVISOR, Role.ADMIN)
export class ClientMarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get()
  async list() {
    return this.marketService.listForClient();
  }

  @Get(':symbol')
  async detail(@Param('symbol') symbol: string) {
    return this.marketService.getQuoteForClient(symbol);
  }
}
