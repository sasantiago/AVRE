import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import * as passwordUtil from '../common/utils/password.util';

describe('AuthService', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';

  let userRepo: any;
  let refreshTokenRepo: any;
  let tenantsService: any;
  let tenantContext: any;
  let jwtService: any;
  let totpService: any;
  let auditRecorder: any;
  let config: any;
  let service: AuthService;

  const baseUser = {
    id: userId,
    tenantId,
    email: 'cliente@avre.test',
    passwordHash: 'hashed',
    fullName: 'Cliente Test',
    role: Role.CLIENT,
    totpEnabled: false,
  };

  beforeEach(() => {
    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    refreshTokenRepo = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      markReplaced: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    tenantsService = { resolveDefaultTenantId: jest.fn().mockResolvedValue(tenantId) };
    // Simula la transacción: ejecuta el work() directo, sin abrir Prisma real.
    tenantContext = { run: jest.fn((_tenantId, work) => work()) };
    jwtService = { sign: jest.fn().mockReturnValue('signed.access.token') };
    totpService = { verifyCode: jest.fn() };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn((key: string) => (key === 'REFRESH_TOKEN_EXPIRES_IN' ? '7d' : undefined)) };

    service = new AuthService(
      userRepo,
      refreshTokenRepo,
      tenantsService,
      tenantContext,
      jwtService,
      totpService,
      auditRecorder,
      config,
    );
  });

  describe('register', () => {
    it('crea un usuario CLIENT cuando el email no existe', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue({ ...baseUser });
      jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('hashed');

      const result = await service.register({
        email: baseUser.email,
        password: 'password123',
        fullName: 'Cliente Test',
      });

      expect(result.userId).toBe(userId);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.CLIENT, tenantId }),
      );
    });

    it('rechaza el registro si el email ya existe', async () => {
      userRepo.findByEmail.mockResolvedValue(baseUser);

      await expect(
        service.register({ email: baseUser.email, password: 'password123', fullName: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rechaza credenciales inválidas y audita el intento fallido', async () => {
      userRepo.findByEmail.mockResolvedValue(baseUser);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(false);

      await expect(
        service.login({ email: baseUser.email, password: 'wrong' }, { ip: '1.2.3.4', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAILED' }),
      );
    });

    it('pide TOTP si el usuario lo tiene habilitado y no vino el código', async () => {
      userRepo.findByEmail.mockResolvedValue({ ...baseUser, totpEnabled: true });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);

      const result = await service.login(
        { email: baseUser.email, password: 'ok' },
        { ip: '1.2.3.4', userAgent: 'jest' },
      );

      expect(result.requiresTotp).toBe(true);
      expect(result.tokens).toBeUndefined();
    });

    it('rechaza un código TOTP inválido', async () => {
      userRepo.findByEmail.mockResolvedValue({ ...baseUser, totpEnabled: true });
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
      totpService.verifyCode.mockResolvedValue(false);

      await expect(
        service.login(
          { email: baseUser.email, password: 'ok', totpCode: '000000' },
          { ip: '1.2.3.4', userAgent: 'jest' },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('emite tokens cuando las credenciales (y TOTP si aplica) son válidas', async () => {
      userRepo.findByEmail.mockResolvedValue(baseUser);
      jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
      refreshTokenRepo.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.login(
        { email: baseUser.email, password: 'ok' },
        { ip: '1.2.3.4', userAgent: 'jest' },
      );

      expect(result.requiresTotp).toBe(false);
      expect(result.tokens?.accessToken).toBe('signed.access.token');
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCESS' }),
      );
    });
  });

  describe('refresh', () => {
    const scopedToken = `${tenantId}.someRandomValue`;

    it('rota el token cuando el refresh token es válido y no está revocado', async () => {
      refreshTokenRepo.findByTokenHash.mockResolvedValue({
        id: 'rt-old',
        userId,
        revokedAt: null,
        replacedByTokenId: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepo.findById.mockResolvedValue(baseUser);
      refreshTokenRepo.create.mockResolvedValue({ id: 'rt-new' });

      const tokens = await service.refresh(scopedToken);

      expect(tokens.accessToken).toBe('signed.access.token');
      expect(refreshTokenRepo.markReplaced).toHaveBeenCalledWith('rt-old', 'rt-new');
      expect(refreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('revoca toda la familia si detecta reuse fuera de la ventana de gracia', async () => {
      refreshTokenRepo.findByTokenHash.mockResolvedValue({
        id: 'rt-old',
        userId,
        revokedAt: new Date(Date.now() - 60_000), // hace 60s, ventana default es 10s
        replacedByTokenId: 'rt-already-issued',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh(scopedToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(userId);
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REFRESH_TOKEN_REUSE_DETECTED' }),
      );
    });

    it('dentro de la ventana de gracia rota de nuevo sin revocar la familia', async () => {
      refreshTokenRepo.findByTokenHash.mockResolvedValue({
        id: 'rt-old',
        userId,
        revokedAt: new Date(Date.now() - 2_000), // hace 2s, dentro de la ventana default 10s
        replacedByTokenId: 'rt-already-issued',
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepo.findById.mockResolvedValue(baseUser);
      refreshTokenRepo.create.mockResolvedValue({ id: 'rt-newer' });

      const tokens = await service.refresh(scopedToken);

      expect(tokens.accessToken).toBe('signed.access.token');
      expect(refreshTokenRepo.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('rechaza un token sin separador de tenant reconocible', async () => {
      await expect(service.refresh('sin-separador-de-tenant')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revoca la familia del usuario si el token existe', async () => {
      const scopedToken = `${tenantId}.value`;
      refreshTokenRepo.findByTokenHash.mockResolvedValue({ id: 'rt-1', userId });

      await service.logout(scopedToken);

      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});
