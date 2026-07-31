import { ConflictException, Injectable } from '@nestjs/common';
import {
  AgreementStatus,
  ChainNetwork,
  Prisma,
  Withdrawal,
  WithdrawalStatus,
  WithdrawalType,
} from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export interface CreateWithdrawalInput {
  userId: string;
  type: WithdrawalType;
  requestedAmountUsd: Prisma.Decimal.Value;
  agreementId: string;
  agreementStatusAtRequest: AgreementStatus;
  capitalUsd: Prisma.Decimal.Value;
  gainsUsd: Prisma.Decimal.Value;
  // null = "a definir" (retiro definitivo anticipado sin penalidad calculada
  // todavía — ver WithdrawalService.createFinal).
  penaltyUsd: Prisma.Decimal.Value | null;
  finalAmountUsd: Prisma.Decimal.Value | null;
  destinationWalletAddress: string;
  destinationWalletNetwork: ChainNetwork;
}

export interface ListQueueFilter {
  status?: WithdrawalStatus;
  advisorId?: string;
}

const ACTIVE_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING_REVIEW,
  WithdrawalStatus.APPROVED,
  WithdrawalStatus.PROCESSING,
];

@Injectable()
export class WithdrawalRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateWithdrawalInput): Promise<Withdrawal> {
    return this.tenantContext.getTx().withdrawal.create({
      data: {
        id: generateId(),
        tenantId: this.tenantContext.getTenantId(),
        ...input,
      },
    });
  }

  async findById(id: string): Promise<Withdrawal | null> {
    return this.tenantContext.getTx().withdrawal.findUnique({ where: { id } });
  }

  // A lo sumo un retiro "en curso" por cliente (§7.5 #4) — reforzado además por
  // el índice único parcial de la base (one_active_withdrawal_per_client).
  async findActiveForClient(userId: string): Promise<Withdrawal | null> {
    return this.tenantContext.getTx().withdrawal.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
    });
  }

  async listForClient(userId: string): Promise<Withdrawal[]> {
    return this.tenantContext.getTx().withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listQueueForTenant(filter: ListQueueFilter): Promise<Withdrawal[]> {
    return this.tenantContext.getTx().withdrawal.findMany({
      where: {
        status: filter.status,
        ...(filter.advisorId ? { user: { advisorId: filter.advisorId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // `negotiated` completa penaltyUsd/finalAmountUsd cuando la solicitud se creó
  // con la penalidad "a definir" (retiro definitivo anticipado sin porcentaje
  // automático — ver WithdrawalService.createFinal) y el asesor ya acordó el
  // monto con el cliente antes de aprobar.
  async approve(
    id: string,
    reviewerId: string,
    negotiated?: { finalAmountUsd: Prisma.Decimal.Value; penaltyUsd: Prisma.Decimal.Value },
  ): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.PENDING_REVIEW, {
      status: WithdrawalStatus.APPROVED,
      reviewedByUserId: reviewerId,
      reviewedAt: new Date(),
      ...negotiated,
    });
  }

  async reject(id: string, reviewerId: string, reason: string): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.PENDING_REVIEW, {
      status: WithdrawalStatus.REJECTED,
      rejectionReason: reason,
      reviewedByUserId: reviewerId,
      reviewedAt: new Date(),
    });
  }

  // Cancelación por el propio cliente — nunca pasó por revisión humana, así que
  // reviewedByUserId/reviewedAt quedan null (a diferencia de reject).
  async cancel(id: string): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.PENDING_REVIEW, {
      status: WithdrawalStatus.CANCELLED,
    });
  }

  // El operador ejecuta la transferencia manualmente fuera del sistema y recién
  // acá registra el hash (§7.4, §13.3 — nunca hay firma automática en el backend).
  async markProcessing(id: string, outboundTxHash: string): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.APPROVED, {
      status: WithdrawalStatus.PROCESSING,
      outboundTxHash,
    });
  }

  async markCompleted(id: string): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.PROCESSING, { status: WithdrawalStatus.COMPLETED });
  }

  async markFailed(id: string): Promise<Withdrawal> {
    return this.transition(id, WithdrawalStatus.PROCESSING, { status: WithdrawalStatus.FAILED });
  }

  // Compare-and-swap (§5.3): dos revisores no pueden aprobar/rechazar el mismo
  // retiro en simultáneo, y ninguna transición salta un paso de la máquina de
  // estados (§7.4) — mismo patrón que DepositRepository.transitionFromPendingReview.
  private async transition(
    id: string,
    fromStatus: WithdrawalStatus,
    data: Prisma.WithdrawalUncheckedUpdateManyInput,
  ): Promise<Withdrawal> {
    const tx = this.tenantContext.getTx();
    const result = await tx.withdrawal.updateMany({ where: { id, status: fromStatus }, data });
    if (result.count === 0) {
      throw new ConflictException(
        `El retiro ya no está en el estado esperado (${fromStatus}) — puede haber sido modificado por otro usuario`,
      );
    }
    return tx.withdrawal.findUniqueOrThrow({ where: { id } });
  }
}
