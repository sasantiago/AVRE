import { readFileSync } from 'fs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EMAIL_SENDER } from './email/email-sender.interface';
import { NodemailerEmailSender } from './email/nodemailer-email-sender';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { TotpSecretRepository } from './repositories/totp-secret.repository';
import { UserRepository } from './repositories/user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TotpService } from './totp.service';

@Module({
  imports: [
    PassportModule,
    AuditModule,
    TenantsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: readFileSync(config.get<string>('JWT_PRIVATE_KEY_PATH')!, 'utf8'),
        publicKey: readFileSync(config.get<string>('JWT_PUBLIC_KEY_PATH')!, 'utf8'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
          issuer: config.get<string>('JWT_ISSUER'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TotpService,
    PasswordResetService,
    JwtStrategy,
    UserRepository,
    RefreshTokenRepository,
    TotpSecretRepository,
    PasswordResetTokenRepository,
    { provide: EMAIL_SENDER, useClass: NodemailerEmailSender },
  ],
  exports: [AuthService, UserRepository],
})
export class AuthModule {}
