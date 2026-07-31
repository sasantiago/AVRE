import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgreementStatus, ClientPackage, Prisma } from '@prisma/client';
import { AgreementService } from './agreement.service';

describe('AgreementService', () => {
  const clientId = '018f0000-0000-7000-8000-000000000002';
  const advisorId = '018f0000-0000-7000-8000-000000000003';
  const agreementId = '018f0000-0000-7000-8000-000000000004';

  let agreementRepo: any;
  let ledgerService: any;
  let userRepo: any;
  let service: AgreementService;

  beforeEach(() => {
    agreementRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findActiveForClient: jest.fn(),
      listForTenant: jest.fn(),
      updateTerms: jest.fn(),
    };
    ledgerService = { getCapital: jest.fn().mockResolvedValue(new Prisma.Decimal(0)) };
    userRepo = { findById: jest.fn(), findByIdForAdvisor: jest.fn() };
    service = new AgreementService(agreementRepo, ledgerService, userRepo);
  });

  describe('create', () => {
    it('rechaza si el cliente no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ clientId, packageType: ClientPackage.BASIC }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(agreementRepo.create).not.toHaveBeenCalled();
    });

    it('rechaza si el cliente ya tiene un acuerdo ACTIVE', async () => {
      userRepo.findById.mockResolvedValue({ id: clientId });
      agreementRepo.findActiveForClient.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ clientId, packageType: ClientPackage.BASIC }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(agreementRepo.create).not.toHaveBeenCalled();
    });

    it('usa los valores de PACKAGE_TERMS del paquete cuando no se pasan explícitos', async () => {
      userRepo.findById.mockResolvedValue({ id: clientId });
      agreementRepo.findActiveForClient.mockResolvedValue(null);

      await service.create({ clientId, packageType: ClientPackage.GROWTH });

      const arg = agreementRepo.create.mock.calls[0][0];
      expect(arg.termMonths).toBe(12);
      expect(arg.earlyWithdrawalMaxPct).toBe(15);
      expect(arg.earlyExitPenaltyPct).toBe(12);
    });

    it('respeta valores explícitos por sobre los defaults del paquete', async () => {
      userRepo.findById.mockResolvedValue({ id: clientId });
      agreementRepo.findActiveForClient.mockResolvedValue(null);

      await service.create({
        clientId,
        packageType: ClientPackage.GROWTH,
        termMonths: 18,
        earlyWithdrawalMaxPct: 25,
        earlyExitPenaltyPct: 5,
      });

      const arg = agreementRepo.create.mock.calls[0][0];
      expect(arg.termMonths).toBe(18);
      expect(arg.earlyWithdrawalMaxPct).toBe(25);
      expect(arg.earlyExitPenaltyPct).toBe(5);
    });
  });

  describe('updateTerms', () => {
    it('lanza NotFoundException si el acuerdo no existe', async () => {
      agreementRepo.findById.mockResolvedValue(null);
      await expect(service.updateTerms(agreementId, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(agreementRepo.updateTerms).not.toHaveBeenCalled();
    });
  });

  describe('getOwnWithProgress', () => {
    it('lanza NotFoundException si el cliente no tiene acuerdo activo', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(null);
      await expect(service.getOwnWithProgress(clientId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('calcula daysElapsed/daysTotal y el monto retirable hoy a partir del capital', async () => {
      const startDate = new Date(Date.now() - 30 * 86_400_000);
      const endDate = new Date(Date.now() + 60 * 86_400_000); // total 90 días
      agreementRepo.findActiveForClient.mockResolvedValue({
        clientId,
        startDate,
        endDate,
        earlyWithdrawalMaxPct: new Prisma.Decimal('20'),
      });
      ledgerService.getCapital.mockResolvedValue(new Prisma.Decimal('1000'));

      const progress = await service.getOwnWithProgress(clientId);

      expect(progress.daysTotal).toBe(90);
      expect(progress.daysElapsed).toBe(30);
      expect(progress.withdrawableTodayUsd).toBe('200.00000000'); // 20% de 1000
    });
  });

  describe('getForAdvisorClient', () => {
    it('lanza NotFoundException si el cliente no está asignado a ese asesor', async () => {
      userRepo.findByIdForAdvisor.mockResolvedValue(null);
      await expect(service.getForAdvisorClient(advisorId, clientId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(agreementRepo.findActiveForClient).not.toHaveBeenCalled();
    });

    it('devuelve el progreso si el cliente sí está asignado', async () => {
      userRepo.findByIdForAdvisor.mockResolvedValue({ id: clientId });
      const startDate = new Date(Date.now() - 10 * 86_400_000);
      const endDate = new Date(Date.now() + 10 * 86_400_000);
      agreementRepo.findActiveForClient.mockResolvedValue({
        clientId,
        startDate,
        endDate,
        earlyWithdrawalMaxPct: new Prisma.Decimal('10'),
        status: AgreementStatus.ACTIVE,
      });

      const progress = await service.getForAdvisorClient(advisorId, clientId);
      expect(progress.agreement.clientId).toBe(clientId);
    });
  });
});
