import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { AuditQueryService } from './audit-query.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Controller('admin/audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  async list(@Query() query: QueryAuditLogDto) {
    return this.auditQueryService.list(query);
  }
}
