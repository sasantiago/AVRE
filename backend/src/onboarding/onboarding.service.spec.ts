import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';
  const agreementId = '018f0000-0000-7000-8000-000000000003';

  let agreementRepo: any;
  let acceptanceRepo: any;
  let userRepo: any;
  let tenantContext: any;
  let auditRecorder: any;
  let service: OnboardingService;

  beforeEach(() => {
    agreementRepo = { findActive: jest.fn() };
    acceptanceRepo = { create: jest.fn() };
    userRepo = { findById: jest.fn(), setAgreementAcceptedVersion: jest.fn() };
    tenantContext = { run: jest.fn((_t, work) => work()) };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };

    service = new OnboardingService(agreementRepo, acceptanceRepo, userRepo, tenantContext, auditRecorder);
  });

  describe('getActiveAgreement', () => {
    it('lanza NotFoundException si no hay versión activa', async () => {
      agreementRepo.findActive.mockResolvedValue(null);
      await expect(service.getActiveAgreement()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devuelve la versión activa', async () => {
      agreementRepo.findActive.mockResolvedValue({ id: agreementId, version: 'v1' });
      await expect(service.getActiveAgreement()).resolves.toEqual(
        expect.objectContaining({ id: agreementId }),
      );
    });
  });

  describe('acceptActiveAgreement', () => {
    it('rechaza si no hay IP (capturada server-side, nunca del body)', async () => {
      agreementRepo.findActive.mockResolvedValue({ id: agreementId, version: 'v1' });

      await expect(
        service.acceptActiveAgreement({ userId, tenantId, ipAddress: '', userAgent: 'jest' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(acceptanceRepo.create).not.toHaveBeenCalled();
    });

    it('crea la aceptación, actualiza el flag del usuario y audita', async () => {
      agreementRepo.findActive.mockResolvedValue({ id: agreementId, version: 'v1' });

      await service.acceptActiveAgreement({
        userId,
        tenantId,
        ipAddress: '203.0.113.5',
        userAgent: 'jest-agent',
      });

      expect(acceptanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          tenantId,
          agreementVersionId: agreementId,
          ipAddress: '203.0.113.5',
          userAgent: 'jest-agent',
        }),
      );
      expect(userRepo.setAgreementAcceptedVersion).toHaveBeenCalledWith(userId, agreementId);
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AGREEMENT_ACCEPTED', actorUserId: userId }),
      );
    });
  });

  describe('hasAcceptedActiveAgreement', () => {
    it('false si el usuario no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      agreementRepo.findActive.mockResolvedValue({ id: agreementId });
      await expect(service.hasAcceptedActiveAgreement(userId)).resolves.toBe(false);
    });

    it('false si no hay versión activa', async () => {
      userRepo.findById.mockResolvedValue({ agreementAcceptedVersionId: agreementId });
      agreementRepo.findActive.mockResolvedValue(null);
      await expect(service.hasAcceptedActiveAgreement(userId)).resolves.toBe(false);
    });

    it('false si aceptó una versión vieja (no la vigente)', async () => {
      userRepo.findById.mockResolvedValue({ agreementAcceptedVersionId: 'version-vieja' });
      agreementRepo.findActive.mockResolvedValue({ id: agreementId });
      await expect(service.hasAcceptedActiveAgreement(userId)).resolves.toBe(false);
    });

    it('true si aceptó exactamente la versión activa vigente', async () => {
      userRepo.findById.mockResolvedValue({ agreementAcceptedVersionId: agreementId });
      agreementRepo.findActive.mockResolvedValue({ id: agreementId });
      await expect(service.hasAcceptedActiveAgreement(userId)).resolves.toBe(true);
    });
  });
});
