import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { MetricsService } from './metrics.service';

// Vista agregada de negocio (§4.3, §10) — totales del tenant + desglose por
// asesor. Gráficos y export a CSV quedan pendientes de confirmación comercial
// (§15), no se construyen acá.
@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async get(@Query() query: MetricsQueryDto) {
    return this.metricsService.getMetrics(query);
  }
}
