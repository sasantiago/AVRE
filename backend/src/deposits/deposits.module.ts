import { Module } from '@nestjs/common';
import { AdminDepositsController } from './admin-deposits.controller';
import { AdvisorDepositsController } from './advisor-deposits.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientDepositsController } from './client-deposits.controller';
import { DepositRepository } from './deposit.repository';
import { DepositService } from './deposit.service';
import { LedgerModule } from '../ledger/ledger.module';
import { DepositVerifierRegistry } from './verifiers/deposit-verifier.registry';
import { PolygonVerifier } from './verifiers/polygon.verifier';
import { TronVerifier } from './verifiers/tron.verifier';

@Module({
  imports: [AuthModule, LedgerModule, AuditModule],
  controllers: [ClientDepositsController, AdvisorDepositsController, AdminDepositsController],
  providers: [
    DepositRepository,
    DepositService,
    TronVerifier,
    PolygonVerifier,
    DepositVerifierRegistry,
  ],
  // DepositVerifierRegistry se reusa en WithdrawalsModule para confirmar la
  // transferencia de salida con el mismo verificador (§7.4: "verifica su
  // confirmación con los mismos verificadores de §6.3").
  exports: [DepositVerifierRegistry],
})
export class DepositsModule {}
