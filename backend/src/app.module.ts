import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuditModule } from './audit/audit.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UsersModule } from './users/users.module';
import { TenantContextInterceptorModule } from './common/interceptors/tenant-context.module';
import { LedgerModule } from './ledger/ledger.module';
import { ProfileModule } from './profile/profile.module';
import { AgreementsModule } from './agreements/agreements.module';
import { DepositsModule } from './deposits/deposits.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { MarketModule } from './market/market.module';
import { OrdersModule } from './orders/orders.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // mount: true asegura un contexto CLS activo desde el arranque de cada request,
    // incluso en rutas públicas (register/login) donde TenantContextService.run() se
    // llama directo desde el service, sin pasar por TenantContextInterceptor.
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60000),
        limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
      },
    ]),
    PrismaModule,
    TenantContextInterceptorModule,
    AuditModule,
    TenantsModule,
    AuthModule,
    OnboardingModule,
    UsersModule,
    LedgerModule,
    ProfileModule,
    AgreementsModule,
    DepositsModule,
    WithdrawalsModule,
    MarketModule,
    OrdersModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
