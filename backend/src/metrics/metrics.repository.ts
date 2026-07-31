import { Injectable } from '@nestjs/common';
import { AgreementStatus, DepositStatus, OrderSide, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';

export interface DepositTimestamp {
  userId: string;
  createdAt: Date;
}

export interface BuyOrderStats {
  totalUsd: Prisma.Decimal;
  count: number;
}

@Injectable()
export class MetricsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  // "Capital captado" (§10) = suma de depósitos APPROVED en la ventana.
  async sumApprovedDepositsSince(since: Date, advisorId?: string): Promise<Prisma.Decimal> {
    const result = await this.tenantContext.getTx().deposit.aggregate({
      where: {
        status: DepositStatus.APPROVED,
        createdAt: { gte: since },
        ...(advisorId ? { user: { advisorId } } : {}),
      },
      _sum: { verifiedAmountUsd: true },
    });
    return result._sum.verifiedAmountUsd ?? new Prisma.Decimal(0);
  }

  // "Ticket promedio de inversión" (§10) = totalUsd / cantidad de órdenes BUY.
  async getBuyOrderStatsSince(since: Date, advisorId?: string): Promise<BuyOrderStats> {
    const result = await this.tenantContext.getTx().order.aggregate({
      where: {
        side: OrderSide.BUY,
        createdAt: { gte: since },
        ...(advisorId ? { user: { advisorId } } : {}),
      },
      _sum: { totalUsd: true },
      _count: true,
    });
    return { totalUsd: result._sum.totalUsd ?? new Prisma.Decimal(0), count: result._count };
  }

  // Todo el historial de depósitos APPROVED (sin ventana) — insumo de
  // "frecuencia de fondeo" y "clientes nuevos", que necesitan la serie de
  // fechas por cliente, no un agregado SQL directo.
  async listApprovedDepositTimestamps(advisorId?: string): Promise<DepositTimestamp[]> {
    return this.tenantContext.getTx().deposit.findMany({
      where: {
        status: DepositStatus.APPROVED,
        ...(advisorId ? { user: { advisorId } } : {}),
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // "Tasa de renovación" / "Salidas anticipadas" (§10) — ventana sobre
  // updatedAt (fecha de la transición de estado).
  async countAgreementsByStatusSince(
    statuses: AgreementStatus[],
    since: Date,
    advisorId?: string,
  ): Promise<number> {
    return this.tenantContext.getTx().managementAgreement.count({
      where: {
        status: { in: statuses },
        updatedAt: { gte: since },
        ...(advisorId ? { client: { advisorId } } : {}),
      },
    });
  }
}
