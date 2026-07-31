import { Module } from '@nestjs/common';
import { AdminClientPortfolioController } from './admin-portfolio.controller';
import { AdvisorClientPortfolioController } from './advisor-portfolio.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClientOrdersController } from './client-orders.controller';
import { HoldingRepository } from './holding.repository';
import { LedgerModule } from '../ledger/ledger.module';
import { MarketModule } from '../market/market.module';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Module({
  imports: [AuthModule, LedgerModule, AuditModule, MarketModule],
  controllers: [
    ClientOrdersController,
    AdvisorClientPortfolioController,
    AdminClientPortfolioController,
  ],
  providers: [HoldingRepository, OrderRepository, OrderService],
  // OrderService lo necesita WithdrawalsModule para liquidar holdings al
  // confirmar un retiro definitivo (§7.3).
  exports: [OrderService],
})
export class OrdersModule {}
