import { authenticator } from 'otplib';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { encryptSecret } from '../common/utils/crypto.util';
import { TotpService } from './totp.service';

describe('TotpService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const encryptionKey = randomBytes(32).toString('base64');

  let totpSecretRepo: any;
  let userRepo: any;
  let config: any;
  let service: TotpService;

  beforeEach(() => {
    totpSecretRepo = { upsert: jest.fn(), findByUserId: jest.fn() };
    userRepo = { findById: jest.fn(), setTotpEnabled: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'TOTP_ENCRYPTION_KEY') return encryptionKey;
        if (key === 'TOTP_ISSUER') return 'AVRE Capital Group';
        return undefined;
      }),
    };
    service = new TotpService(totpSecretRepo, userRepo, config);
  });

  it('enroll genera un otpauth URL y persiste el secreto cifrado (no en claro)', async () => {
    userRepo.findById.mockResolvedValue({ id: userId, email: 'cliente@avre.test' });

    const result = await service.enroll(tenantId, userId);

    expect(result.otpauthUrl).toContain('otpauth://totp/');
    expect(totpSecretRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, userId }),
    );
    const upsertArg = totpSecretRepo.upsert.mock.calls[0][0];
    expect(result.otpauthUrl).not.toContain(upsertArg.payload.ciphertext);
  });

  it('verifyAndEnable activa 2FA con un código válido generado a partir del secreto guardado', async () => {
    const secret = authenticator.generateSecret();
    const payload = encryptSecret(secret, Buffer.from(encryptionKey, 'base64'));
    totpSecretRepo.findByUserId.mockResolvedValue({
      secretCiphertext: payload.ciphertext,
      secretIv: payload.iv,
      secretAuthTag: payload.authTag,
    });

    const code = authenticator.generate(secret);
    await service.verifyAndEnable(userId, code);

    expect(userRepo.setTotpEnabled).toHaveBeenCalledWith(userId, true);
  });

  it('verifyAndEnable rechaza un código inválido', async () => {
    const secret = authenticator.generateSecret();
    const payload = encryptSecret(secret, Buffer.from(encryptionKey, 'base64'));
    totpSecretRepo.findByUserId.mockResolvedValue({
      secretCiphertext: payload.ciphertext,
      secretIv: payload.iv,
      secretAuthTag: payload.authTag,
    });

    await expect(service.verifyAndEnable(userId, '000000')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.setTotpEnabled).not.toHaveBeenCalled();
  });
});
