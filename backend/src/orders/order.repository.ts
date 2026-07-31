import { Injectable } from '@nestjs/common';
import { Order, OrderSide, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';

export interface CreateOrderInput {
  // A diferencia del resto de los repos, el id lo genera y pasa el SERVICE
  // (OrderService.buy): el asiento de ledger se crea primero, referenciando
  // este mismo id en refId, y recién si el débito no falla se crea la orden.
  // LedgerEntry.refId no tiene FK real, así que no hay problema de orden.
  id: string;
  userId: string;
  instrumentId: string;
  side: OrderSide;
  quantity: Prisma.Decimal.Value;
  executionPrice: Prisma.Decimal.Value;
  totalUsd: Prisma.Decimal.Value;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateOrderInput): Promise<Order> {
    return this.tenantContext.getTx().order.create({
      data: { tenantId: this.tenantContext.getTenantId(), ...input },
    });
  }

  async listForUser(userId: string): Promise<Order[]> {
    return this.tenantContext.getTx().order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
