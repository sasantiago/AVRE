import { Prisma } from '@prisma/client';
import { HoldingRepository } from './holding.repository';

describe('HoldingRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';
  const instrumentId = '018f0000-0000-7000-8000-000000000003';

  let tx: any;
  let tenantContext: any;
  let repo: HoldingRepository;

  beforeEach(() => {
    tx = {
      holding: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn((args: any) => args.data),
        update: jest.fn((args: any) => ({ id: args.where.id, ...args.data })),
        delete: jest.fn(),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new HoldingRepository(tenantContext);
  });

  describe('findAllForUser', () => {
    it('incluye el instrumento relacionado', async () => {
      await repo.findAllForUser(userId);
      expect(tx.holding.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { instrument: true },
      });
    });
  });

  describe('upsertBuy', () => {
    it('crea el holding si el cliente no tenía posición en ese instrumento', async () => {
      tx.holding.findUnique.mockResolvedValue(null);
      await repo.upsertBuy(
        userId,
        instrumentId,
        new Prisma.Decimal('10'),
        new Prisma.Decimal('100'),
      );

      const data = tx.holding.create.mock.calls[0][0].data;
      expect(data.quantity.toString()).toBe('10');
      expect(data.avgCostUsd.toString()).toBe('100');
    });

    it('recalcula el costo promedio ponderado si ya existía la posición', async () => {
      tx.holding.findUnique.mockResolvedValue({
        id: 'holding-1',
        quantity: new Prisma.Decimal('10'),
        avgCostUsd: new Prisma.Decimal('100'),
      });

      // Compra 10 más a 200 -> nuevo promedio = (10*100 + 10*200) / 20 = 150
      await repo.upsertBuy(
        userId,
        instrumentId,
        new Prisma.Decimal('10'),
        new Prisma.Decimal('200'),
      );

      const data = tx.holding.update.mock.calls[0][0].data;
      expect(data.quantity.toString()).toBe('20');
      expect(data.avgCostUsd.toString()).toBe('150');
    });
  });

  describe('deleteForUser', () => {
    it('borra por la clave compuesta tenant/usuario/instrumento', async () => {
      await repo.deleteForUser(userId, instrumentId);
      expect(tx.holding.delete).toHaveBeenCalledWith({
        where: { tenantId_userId_instrumentId: { tenantId, userId, instrumentId } },
      });
    });
  });
});
