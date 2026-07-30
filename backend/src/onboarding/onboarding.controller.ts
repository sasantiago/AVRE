import { Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AgreementAcceptedGuard } from '../common/guards/agreement-accepted.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('agreement')
  async getActiveAgreement() {
    return this.onboardingService.getActiveAgreement();
  }

  @Get('status')
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    const accepted = await this.onboardingService.hasAcceptedActiveAgreement(user.userId);
    return { accepted };
  }

  @Post('agreement/accept')
  async acceptAgreement(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.onboardingService.acceptActiveAgreement({
      userId: user.userId,
      tenantId: user.tenantId,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return { accepted: true };
  }

  // Placeholder — no existe todavía el módulo real de "aportes" (fuera de alcance de
  // las Fases 0-2). Sirve para probar end-to-end que AgreementAcceptedGuard bloquea
  // correctamente hasta que el usuario acepte la versión vigente del acuerdo.
  @Get('placeholder-contributions')
  @UseGuards(AgreementAcceptedGuard)
  async placeholderContributions() {
    return { ok: true, note: 'Placeholder — el módulo real de aportes va en una fase posterior.' };
  }
}
