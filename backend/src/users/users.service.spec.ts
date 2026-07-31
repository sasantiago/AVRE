import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountStatus, ClientPackage, ContractType, Role } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const actor = { userId: 'admin-1', tenantId, role: Role.ADMIN };

  let userRepo: any;
  let auditRecorder: any;
  let service: UsersService;

  beforeEach(() => {
    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findAllByTenant: jest.fn(),
      updateRole: jest.fn(),
      updateAdvisor: jest.fn(),
      updateAccountStatus: jest.fn(),
      findByAdvisor: jest.fn(),
      findByIdForAdvisor: jest.fn(),
      updateProfile: jest.fn(),
    };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(userRepo, auditRecorder);
  });

  const fakeUser = (overrides = {}) => ({
    id: 'u1',
    tenantId,
    email: 'x@e2e.test',
    passwordHash: 'super-secret-hash',
    fullName: 'X',
    role: Role.CLIENT,
    totpEnabled: false,
    agreementAcceptedVersionId: null,
    advisorId: null,
    accountStatus: AccountStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('createUser', () => {
    it('rechaza si el email ya existe', async () => {
      userRepo.findByEmail.mockResolvedValue(fakeUser());
      await expect(
        service.createUser(actor, {
          email: 'x@e2e.test',
          password: 'x',
          fullName: 'X',
          role: Role.ADVISOR,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crea el usuario, audita y nunca devuelve passwordHash', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(fakeUser({ role: Role.ADVISOR }));

      const result = await service.createUser(actor, {
        email: 'x@e2e.test',
        password: 'x',
        fullName: 'X',
        role: Role.ADVISOR,
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED_BY_ADMIN', actorUserId: actor.userId }),
      );
    });
  });

  describe('assignAdvisor', () => {
    it('rechaza si el advisorId no corresponde a un usuario con rol ADVISOR', async () => {
      userRepo.findById.mockResolvedValue(fakeUser({ id: 'not-advisor', role: Role.CLIENT }));
      await expect(service.assignAdvisor(actor, 'client-1', 'not-advisor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('asigna correctamente y audita cuando el advisorId es válido', async () => {
      userRepo.findById.mockResolvedValue(fakeUser({ id: 'adv-1', role: Role.ADVISOR }));
      userRepo.updateAdvisor.mockResolvedValue(fakeUser({ id: 'client-1', advisorId: 'adv-1' }));

      const result = await service.assignAdvisor(actor, 'client-1', 'adv-1');

      expect(userRepo.updateAdvisor).toHaveBeenCalledWith('client-1', 'adv-1');
      expect(result.advisorId).toBe('adv-1');
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_ADVISOR_ASSIGNED' }),
      );
    });

    it('permite desasignar (advisorId undefined/null) sin validar', async () => {
      userRepo.updateAdvisor.mockResolvedValue(fakeUser({ advisorId: null }));
      await service.assignAdvisor(actor, 'client-1', undefined);
      expect(userRepo.findById).not.toHaveBeenCalled();
      expect(userRepo.updateAdvisor).toHaveBeenCalledWith('client-1', null);
    });
  });

  describe('getAdvisorClientDetail', () => {
    it('lanza NotFoundException si el cliente no pertenece a ese asesor', async () => {
      userRepo.findByIdForAdvisor.mockResolvedValue(null);
      await expect(
        service.getAdvisorClientDetail('adv-1', 'client-de-otro-asesor'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devuelve el cliente sin passwordHash cuando sí pertenece al asesor', async () => {
      userRepo.findByIdForAdvisor.mockResolvedValue(fakeUser({ advisorId: 'adv-1' }));
      const result = await service.getAdvisorClientDetail('adv-1', 'u1');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateProfile — admin-only sobre contractType/clientPackage (§2.2)', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateProfile(actor, 'ghost', { contractType: ContractType.MIXED }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('escribe contractType/clientPackage y audita cada cambio por separado', async () => {
      userRepo.findById.mockResolvedValue(fakeUser({ contractType: null, clientPackage: null }));
      userRepo.updateProfile.mockResolvedValue(fakeUser());

      await service.updateProfile(actor, 'u1', {
        contractType: ContractType.STOCKS,
        clientPackage: ClientPackage.PREMIUM,
      });

      expect(userRepo.updateProfile).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          contractType: ContractType.STOCKS,
          clientPackage: ClientPackage.PREMIUM,
        }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONTRACT_TYPE_CHANGED' }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_PACKAGE_CHANGED' }),
      );
    });

    it('no audita cambios de contractType/clientPackage si el valor no cambió', async () => {
      userRepo.findById.mockResolvedValue(fakeUser({ contractType: ContractType.STOCKS }));
      userRepo.updateProfile.mockResolvedValue(fakeUser({ contractType: ContractType.STOCKS }));

      await service.updateProfile(actor, 'u1', { contractType: ContractType.STOCKS });

      expect(auditRecorder.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONTRACT_TYPE_CHANGED' }),
      );
    });
  });

  describe('listUsers / getAdvisorPortfolio', () => {
    it('listUsers nunca expone passwordHash', async () => {
      userRepo.findAllByTenant.mockResolvedValue([fakeUser(), fakeUser({ id: 'u2' })]);
      const result = await service.listUsers({});
      expect(result.every((u) => !('passwordHash' in u))).toBe(true);
    });

    it('getAdvisorPortfolio delega en findByAdvisor con el id del asesor logueado', async () => {
      userRepo.findByAdvisor.mockResolvedValue([fakeUser()]);
      await service.getAdvisorPortfolio('adv-1');
      expect(userRepo.findByAdvisor).toHaveBeenCalledWith('adv-1');
    });
  });
});
