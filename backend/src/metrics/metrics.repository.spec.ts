import { AgreementStatus, DepositStatus, OrderSide, Prisma } from '@prisma/client';
import { MetricsRepository } from './metrics.repository';

describe('MetricsRepository', () => {
  const advisorId = '018f0000-0000-7000-8000-000000000001';
  const since = new Date('2026-01-01');

  let tx: any;
  let tenantContext: any;
  let repo: MetricsRepository;

  beforeEach(() => {
    tx = {
      deposit: { aggregate: jest.fn(), findMany: jest.fn() },
      order: { aggregate: jest.fn() },
      managementAgreement: { count: jest.fn() },
    };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new MetricsRepository(tenantContext);
  });

  describe('sumApprovedDepositsSince', () => {
    it('filtra por status APPROVED y la ventana, sin advisorId por defecto', async () => {
      tx.deposit.aggregate.mockResolvedValue({ _sum: { verifiedAmountUsd: null } });
      const sum = await repo.sumApprovedDepositsSince(since);
      expect(tx.deposit.aggregate).toHaveBeenCalledWith({
        where: { status: DepositStatus.APPROVED, createdAt: { gte: since } },
        _sum: { verifiedAmountUsd: true },
      });
      expect(sum.toString()).toBe('0');
    });

    it('agrega el filtro por asesor cuando se pasa advisorId', async () => {
      tx.deposit.aggregate.mockResolvedValue({
        _sum: { verifiedAmountUsd: new Prisma.Decimal('500') },
      });
      const sum = await repo.sumApprovedDepositsSince(since, advisorId);
      expect(tx.deposit.aggregate).toHaveBeenCalledWith({
        where: { status: DepositStatus.APPROVED, createdAt: { gte: since }, user: { advisorId } },
        _sum: { verifiedAmountUsd: true },
      });
      expect(sum.toString()).toBe('500');
    });
  });

  describe('getBuyOrderStatsSince', () => {
    it('filtra por side BUY y devuelve totalUsd=0/count=0 por defecto', async () => {
      tx.order.aggregate.mockResolvedValue({ _sum: { totalUsd: null }, _count: 0 });
      const stats = await repo.getBuyOrderStatsSince(since);
      expect(tx.order.aggregate).toHaveBeenCalledWith({
        where: { side: OrderSide.BUY, createdAt: { gte: since } },
        _sum: { totalUsd: true },
        _count: true,
      });
      expect(stats.totalUsd.toString()).toBe('0');
      expect(stats.count).toBe(0);
    });
  });

  describe('listApprovedDepositTimestamps', () => {
    it('trae solo userId/createdAt de los APPROVED, ordenados', async () => {
      await repo.listApprovedDepositTimestamps();
      expect(tx.deposit.findMany).toHaveBeenCalledWith({
        where: { status: DepositStatus.APPROVED },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('countAgreementsByStatusSince', () => {
    it('filtra por lista de estados y la ventana sobre updatedAt', async () => {
      await repo.countAgreementsByStatusSince([AgreementStatus.RENEWED], since);
      expect(tx.managementAgreement.count).toHaveBeenCalledWith({
        where: { status: { in: [AgreementStatus.RENEWED] }, updatedAt: { gte: since } },
      });
    });

    it('filtra por client.advisorId cuando se pasa advisorId', async () => {
      await repo.countAgreementsByStatusSince([AgreementStatus.BREACHED], since, advisorId);
      expect(tx.managementAgreement.count).toHaveBeenCalledWith({
        where: {
          status: { in: [AgreementStatus.BREACHED] },
          updatedAt: { gte: since },
          client: { advisorId },
        },
      });
    });
  });
});
