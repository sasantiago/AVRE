import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AdminAgreementsController } from './admin-agreements.controller';
import { AdvisorAgreementController } from './advisor-agreement.controller';
import { AgreementRepository } from './agreement.repository';
import { AgreementService } from './agreement.service';
import { ClientAgreementController } from './client-agreement.controller';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [AdminAgreementsController, AdvisorAgreementController, ClientAgreementController],
  providers: [AgreementRepository, AgreementService],
  exports: [AgreementService, AgreementRepository],
})
export class AgreementsModule {}
