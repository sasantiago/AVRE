import { ConflictException } from '@nestjs/common';
import { LedgerEntryType, Prisma } from '@prisma/client';
import { LedgerRepository } from './ledger.repository';

describe('LedgerRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';

  let tx: any;
  let tenantContext: any;
  let repo: LedgerRepository;

  beforeEach(() => {
    tx = {
      user: {
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn((args: any) => args.data),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new LedgerRepository(tenantContext);
  });

  describe('appendEntry', () => {
    it('con monto positivo, incrementa el saldo y crea el asiento con balanceAfter del resultado', async () => {
      tx.user.update.mockResolvedValue({ cashBalanceUsd: new Prisma.Decimal('150.00000000') });

      const entry = await repo.appendEntry({
        userId,
        type: LedgerEntryType.DEPOSIT,
        amount: '100',
        refType: 'Deposit',
        refId: 'dep-1',
      });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { cashBalanceUsd: { increment: expect.any(Prisma.Decimal) } },
      });
      expect(tx.user.updateMany).not.toHaveBeenCalled();
      expect(entry.balanceAfter.toString()).toBe('150');
      expect(entry.tenantId).toBe(tenantId);
      expect(entry.type).toBe(LedgerEntryType.DEPOSIT);
    });

    it('con monto negativo y saldo suficiente, debita condicionalmente (gte) y crea el asiento', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.user.findUniqueOrThrow.mockResolvedValue({ cashBalanceUsd: new Prisma.Decimal('50') });

      const entry = await repo.appendEntry({ userId, type: LedgerEntryType.BUY, amount: '-50' });

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: userId, cashBalanceUsd: { gte: expect.any(Prisma.Decimal) } },
        data: { cashBalanceUsd: { decrement: expect.any(Prisma.Decimal) } },
      });
      expect(entry.amount.toString()).toBe('-50');
      expect(entry.balanceAfter.toString()).toBe('50');
    });

    it('con monto negativo y saldo insuficiente, lanza ConflictException y no crea el asiento', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.appendEntry({ userId, type: LedgerEntryType.WITHDRAWAL, amount: '-999' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('sumAmountByUserAndType', () => {
    it('devuelve 0 cuando no hay asientos de ese tipo', async () => {
      tx.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amount: null } });
      const sum = await repo.sumAmountByUserAndType(userId, LedgerEntryType.DEPOSIT);
      expect(sum.toString()).toBe('0');
    });

    it('devuelve la suma agregada cuando hay asientos', async () => {
      tx.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('300') } });
      const sum = await repo.sumAmountByUserAndType(userId, LedgerEntryType.DEPOSIT);
      expect(sum.toString()).toBe('300');
    });

    it('acota por fecha cuando se pasa since (capital "del período", §7.3)', async () => {
      tx.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('100') } });
      const since = new Date('2026-01-01');
      await repo.sumAmountByUserAndType(userId, LedgerEntryType.DEPOSIT, since);
      expect(tx.ledgerEntry.aggregate).toHaveBeenCalledWith({
        where: { userId, type: LedgerEntryType.DEPOSIT, createdAt: { gte: since } },
        _sum: { amount: true },
      });
    });
  });

  describe('listForUser', () => {
    it('lista los asientos del usuario ordenados por fecha descendente', async () => {
      await repo.listForUser(userId);
      expect(tx.ledgerEntry.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
