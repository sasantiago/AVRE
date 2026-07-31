import { Module } from '@nestjs/common';
import { AdminMetricsController } from './admin-metrics.controller';
import { AuthModule } from '../auth/auth.module';
import { MetricsRepository } from './metrics.repository';
import { MetricsService } from './metrics.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminMetricsController],
  providers: [MetricsRepository, MetricsService],
})
export class MetricsModule {}
