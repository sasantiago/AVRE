import { ConflictException } from '@nestjs/common';
import { AgreementStatus, ChainNetwork, WithdrawalStatus, WithdrawalType } from '@prisma/client';
import { WithdrawalRepository } from './withdrawal.repository';

describe('WithdrawalRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';
  const userId = '018f0000-0000-7000-8000-000000000002';
  const withdrawalId = '018f0000-0000-7000-8000-000000000003';

  let tx: any;
  let tenantContext: any;
  let repo: WithdrawalRepository;

  beforeEach(() => {
    tx = {
      withdrawal: {
        create: jest.fn((args: any) => args.data),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new WithdrawalRepository(tenantContext);
  });

  const createInput = () => ({
    userId,
    type: WithdrawalType.PARTIAL,
    requestedAmountUsd: '100',
    agreementId: 'agreement-1',
    agreementStatusAtRequest: AgreementStatus.ACTIVE,
    capitalUsd: '1000',
    gainsUsd: 0,
    penaltyUsd: 0,
    finalAmountUsd: '100',
    destinationWalletAddress: 'Twallet',
    destinationWalletNetwork: ChainNetwork.TRON_TRC20,
  });

  describe('create', () => {
    it('crea con tenantId del contexto', async () => {
      await repo.create(createInput());
      const data = tx.withdrawal.create.mock.calls[0][0].data;
      expect(data.tenantId).toBe(tenantId);
      expect(data.userId).toBe(userId);
    });
  });

  describe('findActiveForClient', () => {
    it('busca por estados activos (PENDING_REVIEW/APPROVED/PROCESSING)', async () => {
      await repo.findActiveForClient(userId);
      expect(tx.withdrawal.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: {
            in: [
              WithdrawalStatus.PENDING_REVIEW,
              WithdrawalStatus.APPROVED,
              WithdrawalStatus.PROCESSING,
            ],
          },
        },
      });
    });
  });

  describe('listQueueForTenant', () => {
    it('filtra por advisorId a través de la relación user', async () => {
      tx.withdrawal.findMany.mockResolvedValue([]);
      await repo.listQueueForTenant({
        status: WithdrawalStatus.PENDING_REVIEW,
        advisorId: 'adv-1',
      });
      expect(tx.withdrawal.findMany).toHaveBeenCalledWith({
        where: { status: WithdrawalStatus.PENDING_REVIEW, user: { advisorId: 'adv-1' } },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('transiciones — compare-and-swap', () => {
    it('approve lanza ConflictException si ya no está PENDING_REVIEW', async () => {
      tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });
      await expect(repo.approve(withdrawalId, 'reviewer-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('approve transiciona correctamente', async () => {
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: withdrawalId,
        status: WithdrawalStatus.APPROVED,
      });

      await repo.approve(withdrawalId, 'reviewer-1');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: withdrawalId, status: WithdrawalStatus.PENDING_REVIEW },
        data: {
          status: WithdrawalStatus.APPROVED,
          reviewedByUserId: 'reviewer-1',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('cancel no setea reviewedByUserId (nunca pasó por revisión humana)', async () => {
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: withdrawalId,
        status: WithdrawalStatus.CANCELLED,
      });

      await repo.cancel(withdrawalId);

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: withdrawalId, status: WithdrawalStatus.PENDING_REVIEW },
        data: { status: WithdrawalStatus.CANCELLED },
      });
    });

    it('markProcessing exige estado APPROVED y guarda el outboundTxHash', async () => {
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: withdrawalId,
        status: WithdrawalStatus.PROCESSING,
      });

      await repo.markProcessing(withdrawalId, '0xabc');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: withdrawalId, status: WithdrawalStatus.APPROVED },
        data: { status: WithdrawalStatus.PROCESSING, outboundTxHash: '0xabc' },
      });
    });

    it('markCompleted exige estado PROCESSING', async () => {
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: withdrawalId,
        status: WithdrawalStatus.COMPLETED,
      });

      await repo.markCompleted(withdrawalId);

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: withdrawalId, status: WithdrawalStatus.PROCESSING },
        data: { status: WithdrawalStatus.COMPLETED },
      });
    });
  });
});
