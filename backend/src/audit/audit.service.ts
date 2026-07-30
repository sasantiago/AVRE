import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';
import { IAuditRecorder, RecordAuditEntryInput } from './audit.types';

@Injectable()
export class AuditService implements IAuditRecorder {
  constructor(private readonly tenantContext: TenantContextService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    const tx = this.tenantContext.getTx();
    const tenantId = this.tenantContext.getTenantId();

    await tx.auditLog.create({
      data: {
        id: generateId(),
        tenantId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
