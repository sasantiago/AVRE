import { Module } from '@nestjs/common';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdvisorWithdrawalsController } from './advisor-withdrawals.controller';
import { AgreementsModule } from '../agreements/agreements.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientWithdrawalsController } from './client-withdrawals.controller';
import { DepositsModule } from '../deposits/deposits.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OrdersModule } from '../orders/orders.module';
import { WithdrawalRepository } from './withdrawal.repository';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [AuthModule, LedgerModule, AuditModule, AgreementsModule, DepositsModule, OrdersModule],
  controllers: [
    ClientWithdrawalsController,
    AdvisorWithdrawalsController,
    AdminWithdrawalsController,
  ],
  providers: [WithdrawalRepository, WithdrawalService],
})
export class WithdrawalsModule {}
