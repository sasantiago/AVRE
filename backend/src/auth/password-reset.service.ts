import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { hashToken } from '../common/utils/crypto.util';
import { hashPassword } from '../common/utils/password.util';
import { buildScopedToken, parseTenantIdFromScopedToken } from '../common/utils/scoped-token.util';
import { TenantsService } from '../tenants/tenants.service';
import { EMAIL_SENDER, IEmailSender } from './email/email-sender.interface';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: PasswordResetTokenRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
    private readonly config: ConfigService,
  ) {}

  // Siempre resuelve en éxito, exista o no el email — el controller responde el mismo
  // mensaje genérico en ambos casos para no permitir enumeración de usuarios.
  async requestReset(email: string): Promise<void> {
    const tenantId = await this.tenantsService.resolveDefaultTenantId();
    await this.tenantContext.run(tenantId, async () => {
      const user = await this.userRepo.findByEmail(tenantId, email);
      if (!user) return;

      const tokenValue = buildScopedToken(tenantId);
      const expiresMs = ms(this.config.get<string>('RESET_TOKEN_EXPIRES_IN') ?? '30m');
      await this.tokenRepo.create({
        tenantId,
        userId: user.id,
        tokenHash: hashToken(tokenValue),
        expiresAt: new Date(Date.now() + expiresMs),
      });

      const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN');
      const resetUrl = `${frontendOrigin}/reset-password?token=${encodeURIComponent(tokenValue)}`;
      await this.emailSender.send({
        to: user.email,
        subject: 'Restablecé tu contraseña — AVRE Capital Group',
        text: `Para restablecer tu contraseña entrá a: ${resetUrl}\n\nSi no pediste esto, ignorá este email — tu contraseña sigue igual.`,
      });
    });
  }

  async confirmReset(tokenValue: string, newPassword: string): Promise<void> {
    const tenantId = parseTenantIdFromScopedToken(tokenValue);
    if (!tenantId) {
      throw new BadRequestException('Token inválido');
    }

    await this.tenantContext.run(tenantId, async () => {
      const tokenHash = hashToken(tokenValue);
      const record = await this.tokenRepo.findByTokenHash(tokenHash);

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestException('Token inválido o expirado');
      }

      const passwordHash = await hashPassword(newPassword);
      await this.userRepo.updatePasswordHash(record.userId, passwordHash);
      await this.tokenRepo.markUsed(record.id);
      // El reset es el punto donde se "expulsa" a cualquiera que tuviera la cuenta
      // comprometida — se revocan todas las sesiones activas.
      await this.refreshTokenRepo.revokeAllForUser(record.userId);
    });
  }
}
