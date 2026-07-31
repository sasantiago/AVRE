import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({
  imports: [AuditModule],
  providers: [LedgerRepository, LedgerService],
  exports: [LedgerRepository, LedgerService],
})
export class LedgerModule {}
