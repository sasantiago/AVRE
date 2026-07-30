import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit-query.service';
import { AuditService } from './audit.service';
import { AUDIT_RECORDER } from './audit.types';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditQueryService,
    { provide: AUDIT_RECORDER, useExisting: AuditService },
  ],
  exports: [AuditService, AUDIT_RECORDER],
})
export class AuditModule {}
