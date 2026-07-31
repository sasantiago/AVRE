import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AdminInstrumentsController } from './admin-instruments.controller';
import { AuditModule } from '../audit/audit.module';
import { ClientMarketController } from './client-market.controller';
import { InstrumentRepository } from './instrument.repository';
import { MarketDataService } from './market-data.service';
import { MarketService } from './market.service';
import { REDIS_CLIENT } from './redis-client.token';

@Module({
  imports: [AuditModule, ConfigModule],
  controllers: [AdminInstrumentsController, ClientMarketController],
  providers: [
    InstrumentRepository,
    MarketDataService,
    MarketService,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL')!, {
          // No queremos que una compra se cuelgue esperando reconectar Redis —
          // MarketDataService ya degrada sin caché si Redis falla.
          maxRetriesPerRequest: 1,
          retryStrategy: () => 2000,
        }),
      inject: [ConfigService],
    },
  ],
  exports: [MarketDataService, InstrumentRepository],
})
export class MarketModule {}
