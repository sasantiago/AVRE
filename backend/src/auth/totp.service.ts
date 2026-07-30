import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { decryptSecret, encryptSecret } from '../common/utils/crypto.util';
import { TotpSecretRepository } from './repositories/totp-secret.repository';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class TotpService {
  constructor(
    private readonly totpSecretRepo: TotpSecretRepository,
    private readonly userRepo: UserRepository,
    private readonly config: ConfigService,
  ) {}

  private getEncryptionKey(): Buffer {
    const key = this.config.get<string>('TOTP_ENCRYPTION_KEY');
    if (!key) {
      throw new InternalServerErrorException('TOTP_ENCRYPTION_KEY no está configurado');
    }
    const buffer = Buffer.from(key, 'base64');
    if (buffer.length !== 32) {
      throw new InternalServerErrorException('TOTP_ENCRYPTION_KEY debe ser 32 bytes en base64');
    }
    return buffer;
  }

  // Genera un secreto nuevo y lo persiste cifrado, pero NO activa 2FA todavía —
  // eso ocurre recién en verify() cuando el usuario prueba que lo pudo leer/usar.
  async enroll(tenantId: string, userId: string): Promise<{ otpauthUrl: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario inválido');
    }

    const secret = authenticator.generateSecret();
    const issuer = this.config.get<string>('TOTP_ISSUER') ?? 'AVRE Capital Group';

    await this.totpSecretRepo.upsert({
      tenantId,
      userId,
      payload: encryptSecret(secret, this.getEncryptionKey()),
    });

    return { otpauthUrl: authenticator.keyuri(user.email, issuer, secret) };
  }

  async verifyAndEnable(userId: string, code: string): Promise<void> {
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new BadRequestException('Código TOTP inválido');
    }
    await this.userRepo.setTotpEnabled(userId, true);
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const record = await this.totpSecretRepo.findByUserId(userId);
    if (!record) return false;

    const secret = decryptSecret(
      {
        ciphertext: record.secretCiphertext,
        iv: record.secretIv,
        authTag: record.secretAuthTag,
      },
      this.getEncryptionKey(),
    );

    return authenticator.verify({ token: code, secret });
  }
}
