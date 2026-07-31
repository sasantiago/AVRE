import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChainNetwork, Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const tenantId = '018f0000-0000-7000-8000-000000000001';

  let userRepo: any;
  let auditRecorder: any;
  let service: ProfileService;

  const client: AuthenticatedUser = { userId, tenantId, role: Role.CLIENT };
  const advisor: AuthenticatedUser = { userId, tenantId, role: Role.ADVISOR };

  beforeEach(() => {
    userRepo = { findById: jest.fn(), updateProfile: jest.fn() };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ProfileService(userRepo, auditRecorder);
  });

  describe('getOwn', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getOwn(client)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('nunca expone passwordHash', async () => {
      userRepo.findById.mockResolvedValue({ id: userId, passwordHash: 'secret', country: 'AR' });
      const result = await service.getOwn(client);
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateOwn — matriz de permisos §2.2', () => {
    it('CLIENT puede editar su propia wallet de retiro', async () => {
      userRepo.findById.mockResolvedValue({ id: userId, withdrawalWalletAddress: null });
      userRepo.updateProfile.mockResolvedValue({ id: userId });

      await service.updateOwn(client, {
        withdrawalWalletAddress: '0xabc',
        withdrawalWalletNetwork: ChainNetwork.POLYGON,
      });

      expect(userRepo.updateProfile).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          withdrawalWalletAddress: '0xabc',
          withdrawalWalletNetwork: ChainNetwork.POLYGON,
          withdrawalWalletUpdatedAt: expect.any(Date),
        }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WITHDRAWAL_WALLET_CHANGED', actorUserId: userId }),
      );
    });

    it('ADVISOR no puede tocar wallet de retiro — no aplica para su rol (§2.1)', async () => {
      userRepo.findById.mockResolvedValue({ id: userId });

      await expect(
        service.updateOwn(advisor, {
          withdrawalWalletAddress: '0xabc',
          withdrawalWalletNetwork: ChainNetwork.POLYGON,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepo.updateProfile).not.toHaveBeenCalled();
    });

    it('ADVISOR sí puede editar país/teléfono/avatar de sí mismo', async () => {
      userRepo.findById.mockResolvedValue({ id: userId });
      userRepo.updateProfile.mockResolvedValue({ id: userId });

      await service.updateOwn(advisor, { country: 'UY', phoneNumber: '+59899123456' });

      expect(userRepo.updateProfile).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ country: 'UY', phoneNumber: '+59899123456' }),
      );
    });

    it('rechaza wallet address sin network (deben ir juntos)', async () => {
      userRepo.findById.mockResolvedValue({ id: userId });
      await expect(
        service.updateOwn(client, { withdrawalWalletAddress: '0xabc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un avatar que supera el tamaño máximo', async () => {
      userRepo.findById.mockResolvedValue({ id: userId });
      const oversized = 'data:image/png;base64,' + 'A'.repeat(80_000);
      await expect(service.updateOwn(client, { avatarUrl: oversized })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('no audita si la wallet enviada es igual a la actual (sin cambio real)', async () => {
      userRepo.findById.mockResolvedValue({ id: userId, withdrawalWalletAddress: '0xabc' });
      userRepo.updateProfile.mockResolvedValue({ id: userId });

      await service.updateOwn(client, {
        withdrawalWalletAddress: '0xabc',
        withdrawalWalletNetwork: ChainNetwork.POLYGON,
      });

      expect(auditRecorder.record).not.toHaveBeenCalled();
    });
  });
});
