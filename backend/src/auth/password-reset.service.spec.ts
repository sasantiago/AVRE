import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';

  let userRepo: any;
  let tokenRepo: any;
  let refreshTokenRepo: any;
  let tenantsService: any;
  let tenantContext: any;
  let emailSender: any;
  let config: any;
  let service: PasswordResetService;

  beforeEach(() => {
    userRepo = { findByEmail: jest.fn(), updatePasswordHash: jest.fn() };
    tokenRepo = { create: jest.fn(), findByTokenHash: jest.fn(), markUsed: jest.fn() };
    refreshTokenRepo = { revokeAllForUser: jest.fn() };
    tenantsService = { resolveDefaultTenantId: jest.fn().mockResolvedValue(tenantId) };
    tenantContext = { run: jest.fn((_t, work) => work()) };
    emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn() };

    service = new PasswordResetService(
      userRepo,
      tokenRepo,
      refreshTokenRepo,
      tenantsService,
      tenantContext,
      emailSender,
      config,
    );
  });

  describe('requestReset', () => {
    it('no envía email ni crea token si el usuario no existe, pero no lanza error', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.requestReset('no-existe@avre.test')).resolves.toBeUndefined();
      expect(tokenRepo.create).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    });

    it('crea el token y envía el email si el usuario existe', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: userId, email: 'cliente@avre.test' });

      await service.requestReset('cliente@avre.test');

      expect(tokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, userId }),
      );
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'cliente@avre.test' }),
      );
    });
  });

  describe('confirmReset', () => {
    const scopedToken = `${tenantId}.abc123`;

    it('rechaza un token sin prefijo de tenant', async () => {
      await expect(service.confirmReset('sin-tenant', 'nuevaPassword123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza un token ya usado', async () => {
      tokenRepo.findByTokenHash.mockResolvedValue({
        id: 'prt-1',
        userId,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.confirmReset(scopedToken, 'nuevaPassword123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza un token expirado', async () => {
      tokenRepo.findByTokenHash.mockResolvedValue({
        id: 'prt-1',
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.confirmReset(scopedToken, 'nuevaPassword123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('actualiza la password, marca el token usado y revoca refresh tokens activos', async () => {
      tokenRepo.findByTokenHash.mockResolvedValue({
        id: 'prt-1',
        userId,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.confirmReset(scopedToken, 'nuevaPassword123');

      expect(userRepo.updatePasswordHash).toHaveBeenCalledWith(userId, expect.any(String));
      expect(tokenRepo.markUsed).toHaveBeenCalledWith('prt-1');
      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});
