import { AgreementStatus, ClientPackage } from '@prisma/client';
import { AgreementRepository } from './agreement.repository';

describe('AgreementRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const clientId = '018f0000-0000-7000-8000-000000000002';
  const agreementId = '018f0000-0000-7000-8000-000000000003';

  let tx: any;
  let tenantContext: any;
  let repo: AgreementRepository;

  beforeEach(() => {
    tx = {
      managementAgreement: {
        create: jest.fn((args: any) => args.data),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn((args: any) => args.data),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new AgreementRepository(tenantContext);
  });

  describe('create', () => {
    it('calcula endDate sumando termMonths a startDate', async () => {
      const startDate = new Date('2026-01-15T00:00:00.000Z');
      await repo.create({
        clientId,
        packageType: ClientPackage.GROWTH,
        startDate,
        termMonths: 12,
        earlyWithdrawalMaxPct: 15,
        earlyExitPenaltyPct: 12,
      });

      const data = tx.managementAgreement.create.mock.calls[0][0].data;
      expect(data.tenantId).toBe(tenantId);
      expect(data.endDate.getUTCFullYear()).toBe(2027);
      expect(data.endDate.getUTCMonth()).toBe(0); // enero
      expect(data.status).toBeUndefined(); // default ACTIVE lo pone la base, no el repo
    });
  });

  describe('findById', () => {
    it('devuelve null si no existe', async () => {
      tx.managementAgreement.findUnique.mockResolvedValue(null);
      await expect(repo.findById(agreementId)).resolves.toBeNull();
    });

    it('transiciona a FULFILLED de forma lazy si endDate ya pasó y sigue ACTIVE', async () => {
      tx.managementAgreement.findUnique.mockResolvedValue({
        id: agreementId,
        status: AgreementStatus.ACTIVE,
        endDate: new Date(Date.now() - 1000),
      });

      const result = await repo.findById(agreementId);

      expect(tx.managementAgreement.update).toHaveBeenCalledWith({
        where: { id: agreementId },
        data: { status: AgreementStatus.FULFILLED },
      });
      expect(result?.status).toBe(AgreementStatus.FULFILLED);
    });

    it('no toca un acuerdo ACTIVE cuya endDate todavía no llegó', async () => {
      const agreement = {
        id: agreementId,
        status: AgreementStatus.ACTIVE,
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      };
      tx.managementAgreement.findUnique.mockResolvedValue(agreement);

      const result = await repo.findById(agreementId);

      expect(tx.managementAgreement.update).not.toHaveBeenCalled();
      expect(result).toBe(agreement);
    });

    it('no reabre un acuerdo que ya no está ACTIVE (ej. RENEWED) aunque endDate haya pasado', async () => {
      const agreement = {
        id: agreementId,
        status: AgreementStatus.RENEWED,
        endDate: new Date(Date.now() - 1000),
      };
      tx.managementAgreement.findUnique.mockResolvedValue(agreement);

      const result = await repo.findById(agreementId);

      expect(tx.managementAgreement.update).not.toHaveBeenCalled();
      expect(result?.status).toBe(AgreementStatus.RENEWED);
    });
  });

  describe('renew', () => {
    it('cierra el acuerdo anterior como RENEWED y crea uno nuevo encadenado', async () => {
      const newStart = new Date('2027-01-15T00:00:00.000Z');
      await repo.renew(agreementId, {
        clientId,
        packageType: ClientPackage.GROWTH,
        startDate: newStart,
        termMonths: 12,
        earlyWithdrawalMaxPct: 15,
        earlyExitPenaltyPct: 12,
      });

      expect(tx.managementAgreement.update).toHaveBeenCalledWith({
        where: { id: agreementId },
        data: { status: AgreementStatus.RENEWED },
      });
      const created = tx.managementAgreement.create.mock.calls[0][0].data;
      expect(created.renewedFromId).toBe(agreementId);
    });
  });

  describe('listForTenant', () => {
    it('filtra por advisorId a través de la relación client', async () => {
      await repo.listForTenant({ advisorId: 'adv-1' });
      expect(tx.managementAgreement.findMany).toHaveBeenCalledWith({
        where: {
          clientId: undefined,
          status: undefined,
          client: { advisorId: 'adv-1' },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
