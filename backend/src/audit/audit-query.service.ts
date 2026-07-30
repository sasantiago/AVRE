import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface PaginatedAuditLog {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

// Lado de lectura del audit log, separado de AuditService/IAuditRecorder (que
// solo escribe) — segregación de interfaces: los módulos que auditan acciones no
// necesitan saber que existe una vía de consulta, y viceversa.
@Injectable()
export class AuditQueryService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async list(filter: QueryAuditLogDto): Promise<PaginatedAuditLog> {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 25;
    const tx = this.tenantContext.getTx();

    const where: Prisma.AuditLogWhereInput = {
      action: filter.action,
      actorUserId: filter.actorUserId,
      createdAt:
        filter.from || filter.to
          ? { gte: filter.from, lte: filter.to }
          : undefined,
    };

    const [items, total] = await Promise.all([
      tx.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
