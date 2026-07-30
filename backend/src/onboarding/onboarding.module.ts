import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AgreementAcceptedGuard } from '../common/guards/agreement-accepted.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AgreementAcceptanceRepository } from './repositories/agreement-acceptance.repository';
import { AgreementRepository } from './repositories/agreement.repository';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    AgreementRepository,
    AgreementAcceptanceRepository,
    AgreementAcceptedGuard,
  ],
  exports: [OnboardingService],
})
export class OnboardingModule {}
