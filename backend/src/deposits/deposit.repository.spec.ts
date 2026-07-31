import { ConflictException } from '@nestjs/common';
import { ChainNetwork, DepositStatus } from '@prisma/client';
import { DepositRepository } from './deposit.repository';

describe('DepositRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';
  const depositId = '018f0000-0000-7000-8000-000000000003';

  let tx: any;
  let tenantContext: any;
  let repo: DepositRepository;

  beforeEach(() => {
    tx = {
      deposit: {
        create: jest.fn((args: any) => args.data),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn((args: any) => ({ id: args.where.id, ...args.data })),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new DepositRepository(tenantContext);
  });

  describe('create', () => {
    it('crea con tenantId del contexto y status default (no lo fuerza el repo)', async () => {
      const expiresAt = new Date();
      await repo.create({
        userId,
        chain: ChainNetwork.TRON_TRC20,
        toAddress: 'Tplatform',
        declaredAmountToken: '100',
        expiresAt,
      });
      const data = tx.deposit.create.mock.calls[0][0].data;
      expect(data.tenantId).toBe(tenantId);
      expect(data.userId).toBe(userId);
      expect(data.expiresAt).toBe(expiresAt);
    });
  });

  describe('findById — expiración lazy', () => {
    it('devuelve null si no existe', async () => {
      tx.deposit.findUnique.mockResolvedValue(null);
      await expect(repo.findById(depositId)).resolves.toBeNull();
    });

    it('transiciona a EXPIRED si PENDING_TX y expiresAt ya pasó', async () => {
      tx.deposit.findUnique.mockResolvedValue({
        id: depositId,
        status: DepositStatus.PENDING_TX,
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await repo.findById(depositId);
      expect(tx.deposit.update).toHaveBeenCalledWith({
        where: { id: depositId },
        data: { status: DepositStatus.EXPIRED },
      });
      expect(result?.status).toBe(DepositStatus.EXPIRED);
    });

    it('no toca un PENDING_TX que todavía no venció', async () => {
      const deposit = {
        id: depositId,
        status: DepositStatus.PENDING_TX,
        expiresAt: new Date(Date.now() + 60_000),
      };
      tx.deposit.findUnique.mockResolvedValue(deposit);
      const result = await repo.findById(depositId);
      expect(tx.deposit.update).not.toHaveBeenCalled();
      expect(result).toBe(deposit);
    });

    it('no toca un depósito en otro estado aunque expiresAt haya pasado', async () => {
      const deposit = {
        id: depositId,
        status: DepositStatus.PENDING_REVIEW,
        expiresAt: new Date(Date.now() - 1000),
      };
      tx.deposit.findUnique.mockResolvedValue(deposit);
      const result = await repo.findById(depositId);
      expect(tx.deposit.update).not.toHaveBeenCalled();
      expect(result).toBe(deposit);
    });
  });

  describe('findByChainAndTxHash', () => {
    it('busca por la clave compuesta chain_txHash', async () => {
      await repo.findByChainAndTxHash(ChainNetwork.POLYGON, '0xabc');
      expect(tx.deposit.findUnique).toHaveBeenCalledWith({
        where: { chain_txHash: { chain: ChainNetwork.POLYGON, txHash: '0xabc' } },
      });
    });
  });

  describe('listQueueForTenant', () => {
    it('filtra por advisorId a través de la relación user', async () => {
      tx.deposit.findMany.mockResolvedValue([]);
      await repo.listQueueForTenant({ status: DepositStatus.PENDING_REVIEW, advisorId: 'adv-1' });
      expect(tx.deposit.findMany).toHaveBeenCalledWith({
        where: { status: DepositStatus.PENDING_REVIEW, user: { advisorId: 'adv-1' } },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('sin advisorId no agrega el filtro de relación (cola admin)', async () => {
      tx.deposit.findMany.mockResolvedValue([]);
      await repo.listQueueForTenant({ status: DepositStatus.PENDING_REVIEW });
      expect(tx.deposit.findMany).toHaveBeenCalledWith({
        where: { status: DepositStatus.PENDING_REVIEW },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('approve / reject — compare-and-swap', () => {
    it('approve lanza ConflictException si ya no está PENDING_REVIEW (carrera)', async () => {
      tx.deposit.updateMany.mockResolvedValue({ count: 0 });
      await expect(repo.approve(depositId, 'reviewer-1')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.deposit.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('approve transiciona correctamente cuando sí está PENDING_REVIEW', async () => {
      tx.deposit.updateMany.mockResolvedValue({ count: 1 });
      tx.deposit.findUniqueOrThrow.mockResolvedValue({
        id: depositId,
        status: DepositStatus.APPROVED,
      });

      await repo.approve(depositId, 'reviewer-1');

      expect(tx.deposit.updateMany).toHaveBeenCalledWith({
        where: { id: depositId, status: DepositStatus.PENDING_REVIEW },
        data: {
          status: DepositStatus.APPROVED,
          reviewedByUserId: 'reviewer-1',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('reject exige motivo y lo persiste', async () => {
      tx.deposit.updateMany.mockResolvedValue({ count: 1 });
      tx.deposit.findUniqueOrThrow.mockResolvedValue({
        id: depositId,
        status: DepositStatus.REJECTED,
      });

      await repo.reject(depositId, 'reviewer-1', 'monto no coincide');

      expect(tx.deposit.updateMany).toHaveBeenCalledWith({
        where: { id: depositId, status: DepositStatus.PENDING_REVIEW },
        data: {
          status: DepositStatus.REJECTED,
          rejectionReason: 'monto no coincide',
          reviewedByUserId: 'reviewer-1',
          reviewedAt: expect.any(Date),
        },
      });
    });
  });
});
