import { ConflictException, Injectable } from '@nestjs/common';
import { ChainNetwork, Deposit, DepositStatus, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export interface CreateDepositInput {
  userId: string;
  chain: ChainNetwork;
  toAddress: string;
  declaredAmountToken: Prisma.Decimal.Value;
  expiresAt: Date;
}

export interface ApplyVerificationInput {
  status: DepositStatus;
  confirmations: number;
  verifierSnapshot: Prisma.InputJsonValue;
  verifiedAmountUsd?: Prisma.Decimal.Value;
  sourceWalletAddress?: string;
  rejectionReason?: string;
}

export interface ListQueueFilter {
  status?: DepositStatus;
  advisorId?: string;
}

@Injectable()
export class DepositRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateDepositInput): Promise<Deposit> {
    return this.tenantContext.getTx().deposit.create({
      data: {
        id: generateId(),
        tenantId: this.tenantContext.getTenantId(),
        userId: input.userId,
        chain: input.chain,
        toAddress: input.toAddress,
        declaredAmountToken: input.declaredAmountToken,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findById(id: string): Promise<Deposit | null> {
    const deposit = await this.tenantContext.getTx().deposit.findUnique({ where: { id } });
    return deposit ? this.applyLazyExpiration(deposit) : null;
  }

  // Chequeo previo a la unicidad real de la base (@@unique([chain, txHash])) —
  // permite devolver un 409 con mensaje claro antes de intentar el INSERT/UPDATE.
  async findByChainAndTxHash(chain: ChainNetwork, txHash: string): Promise<Deposit | null> {
    return this.tenantContext
      .getTx()
      .deposit.findUnique({ where: { chain_txHash: { chain, txHash } } });
  }

  async listForClient(userId: string): Promise<Deposit[]> {
    const deposits = await this.tenantContext.getTx().deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(deposits.map((d) => this.applyLazyExpiration(d)));
  }

  async listQueueForTenant(filter: ListQueueFilter): Promise<Deposit[]> {
    const deposits = await this.tenantContext.getTx().deposit.findMany({
      where: {
        status: filter.status,
        ...(filter.advisorId ? { user: { advisorId: filter.advisorId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(deposits.map((d) => this.applyLazyExpiration(d)));
  }

  // Último depósito APPROVED del cliente antes de este — usado para la alerta de
  // "wallet de origen distinta" (§6.3 #8).
  async findLastApprovedForUser(userId: string, beforeId?: string): Promise<Deposit | null> {
    return this.tenantContext.getTx().deposit.findFirst({
      where: {
        userId,
        status: DepositStatus.APPROVED,
        ...(beforeId ? { id: { not: beforeId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyTxHashSubmission(id: string, txHash: string): Promise<Deposit> {
    return this.tenantContext.getTx().deposit.update({
      where: { id },
      data: { txHash, status: DepositStatus.PENDING_CONFIRMATIONS },
    });
  }

  async applyVerificationResult(id: string, input: ApplyVerificationInput): Promise<Deposit> {
    return this.tenantContext.getTx().deposit.update({
      where: { id },
      data: {
        status: input.status,
        confirmations: input.confirmations,
        verifierSnapshot: input.verifierSnapshot,
        verifiedAmountUsd: input.verifiedAmountUsd,
        sourceWalletAddress: input.sourceWalletAddress,
        rejectionReason: input.rejectionReason,
      },
    });
  }

  // Compare-and-swap (§5.3): dos revisores no pueden aprobar/rechazar el mismo
  // depósito en simultáneo. Igual patrón que LedgerRepository.debitIfSufficient.
  async approve(id: string, reviewerId: string): Promise<Deposit> {
    return this.transitionFromPendingReview(id, reviewerId, { status: DepositStatus.APPROVED });
  }

  async reject(id: string, reviewerId: string, reason: string): Promise<Deposit> {
    return this.transitionFromPendingReview(id, reviewerId, {
      status: DepositStatus.REJECTED,
      rejectionReason: reason,
    });
  }

  private async transitionFromPendingReview(
    id: string,
    reviewerId: string,
    data: { status: DepositStatus; rejectionReason?: string },
  ): Promise<Deposit> {
    const tx = this.tenantContext.getTx();
    const result = await tx.deposit.updateMany({
      where: { id, status: DepositStatus.PENDING_REVIEW },
      data: { ...data, reviewedByUserId: reviewerId, reviewedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'El depósito ya no está pendiente de revisión (aprobado/rechazado por otro usuario)',
      );
    }
    return tx.deposit.findUniqueOrThrow({ where: { id } });
  }

  // TTL de la solicitud (§6.4): sin cron (§13.2), se evalúa en cada lectura — mismo
  // patrón que AgreementRepository.applyLazyFulfillment.
  private async applyLazyExpiration(deposit: Deposit): Promise<Deposit> {
    if (deposit.status === DepositStatus.PENDING_TX && deposit.expiresAt.getTime() <= Date.now()) {
      return this.tenantContext.getTx().deposit.update({
        where: { id: deposit.id },
        data: { status: DepositStatus.EXPIRED },
      });
    }
    return deposit;
  }
}
